# OmniOS API contract

Source of truth is the zod schemas in [`src/contracts/`](../src/contracts). This doc explains them. The frontend mock and the real backend must both implement the same endpoints and shapes.

## The key constraint: daily grain

Vendors are synced **once every 24h** and give us **daily summaries**, not raw streams. So the canonical unit is:

> **one value per patient, per metric, per day, per source**

No minute-level HR, no 5-minute CGM. Where a source has the data (resting HR, SpO2, HRV, sleep, steps, BP, glucose summary), we take the daily number. Where it doesn't, the day is simply missing and lowers data confidence.

## Entities and how data flows

```
DataSource (catalog)          what vendors/devices exist and which metrics each can supply
   │
SourceConnection              patient <-> source link, with status and last sync
   │
SyncRun                       one 24h pull for one connection (received / rejected / errors)
   │
Observation                   canonical daily value from ONE source, quality-flagged, never deleted
   │   resolution pipeline: pick one value per metric/day, keep all candidates, flag conflicts
ResolvedMetric                the unified value + candidates[] + conflict flag
   │   analysis (backend)
MetricDeviation, DataConfidence, RiskAssessment
   │   weekly check (simple threshold on the weekly average)
WeeklyFlag  ->  Segment       "Blood pressure above normal", "Glucose time in range low", ... (counts)
   │   insight
InsightNote                   structured features -> prose (the only AI step)
   │
WorklistItem  ->  Notification (EHR mock)  ->  AuditEvent
```

### Resolution pipeline (backend internal, no endpoint)

For each patient, metric, and day:

1. Collect all `Observation`s from every connected source.
2. Drop nothing, but ignore non-`ok` values when choosing the winner.
3. Winner = first source in `RESOLUTION_PRECEDENCE[metric]` with an `ok` value (`strategy: precedence`, or `single_source` if only one reported).
4. If `ok` candidates differ by more than `METRICS[metric].conflictTolerance`, set `conflict: true` and `spread`.
5. Return the winner as `value`, all candidates in `candidates[]`.

Do **not** convert between HRV definitions. `hrv_sdnn` (Apple) and `hrv_rmssd` (others) are separate metrics. Baselines are computed per patient and metric, so a patient's own deviation is what matters, which also absorbs per-device bias.

### Normalization rules (per-vendor adapters, backend internal)

`(vendorPayload) => Observation[]`, one pure function per vendor. Units are converted here (°F to °C, etc.), `quality_flag` is set from `METRICS[metric].plausible`, and late data is flagged `late`. Idempotent on `(patient_id, date, metric, source_id)`.

## Endpoints

`kind`: **read** no side effects, **action** changes worklist/EHR state (never risk), **ai** calls an LLM, **demo** demo-only controls.

| Endpoint | Kind | Purpose |
|---|---|---|
| `GET /sources` | read | Device catalog |
| `GET /sources/summary` | read | Per source: patients connected / stale / error, last sync (Connected sources panel) |
| `GET /patients/:id/connections` | read | A patient's connections and sync freshness |
| `GET /sync-runs` | read | Sync history, filterable by patient |
| `GET /patients/:id/observations` | read | Per-source daily values, before resolution (multi-device overlay) |
| `GET /patients/:id/resolved` | read | Unified daily series after resolution, with conflicts |
| `GET /patients/:id` | read | Patient summary (identity + conditions), risk, confidence, deviations, worklist item |
| `GET /ehr/patients/:id/chart` | read | **EHR side only**: full clinical chart for the clinician context card |
| `GET /cohort/summary` | read | "N patients trending toward X" and tier counts |
| `GET /cohort/segments` | read | Weekly check results as counts per segment (BP, glucose, recovery signals, data gap) |
| `GET /patients/:id/weekly-flags` | read | One patient's weekly verdicts per metric |
| `GET /worklist` | read | Worklist ranked by clinical risk only; filter by tier, status, or segment |
| `GET /patients/:id/insight` | read | Current insight note |
| `POST /insights/generate` | **ai** | Features in, prose out |
| `POST /patients/:id/route` | action | Snooze + EHR notification |
| `GET /ehr/notifications` | read | Clinician inbox |
| `POST /ehr/notifications/:id/actions` | action | Acknowledge / dismiss / add plan note |
| `GET /audit` | read | Audit trail |
| `POST /demo/sync` | demo | Simulate the 24h sync |
| `POST /demo/patients/:id/worsen` | demo | Trigger re-escalation |
| `POST /demo/clock/advance` | demo | Move the demo clock |

Full request and response schemas are in [`src/contracts/api.ts`](../src/contracts/api.ts).

## The AI call: `POST /insights/generate`

- **Input** (`InsightFeatures`): computed features only: changes vs baseline, window, confidence reasons, sources, risk tier. No raw observations, no free text from users.
- **Output** (`InsightText`): `what_changed`, `versus_baseline`, `window`, `confidence`, `sources`, `suggestion`.
- **Guardrails** (backend enforces): generic suggestions only ("flag for clinician review", "consider medication review", "consider outreach"). Reject any output naming a drug, dose, or treatment, and fall back to a rules-based template. The LLM never changes numbers, tier, or risk.

## The weekly check and segments

The simplest possible "does this look off?" rule, defined in [`src/contracts/checks.ts`](../src/contracts/checks.ts):

> For each patient, metric and calendar week (Monday start, patient local), take the **weekly average**. If it is at or beyond the threshold, the week is `off`. With fewer than 3 days of readings it is `insufficient_data` and we make no claim.

| Check | Rule (placeholders **[VERIFY]**) | Segment | Contract tie |
|---|---|---|---|
| BP | Avg systolic >= 140 or avg diastolic >= 90 | `bp_off` | Contract measure: BP control |
| Glucose | Avg time in range < 70% | `glucose_off` | Contract measure: glucose control |
| Resting HR | 7+ bpm above own 30-day median | `recovery_off` | ER early warning |
| HRV | 15%+ below own 30-day median | `recovery_off` | ER early warning |
| Resp rate | 2+ br/min above own baseline | `recovery_off` | ER early warning |
| SpO2 | 3+ points below own baseline | `recovery_off` | ER early warning |
| Too little data | < 3 days with readings | `data_gap` | Data quality |

A **segment** is just the set of patients `off` in a group of checks for a week, returned as counts (`patient_count` of `evaluated_count`) plus patient ids. The "N patients trending toward elevated BP" headline is derived from these counts.

Tie meanings: **contract_measure** is something the contract rewards improving; **er_early_warning** is not a measure but a leading indicator for ER visits (which the contract rewards); **data_quality** means we cannot see the patient, so it is not a clinical finding.

**Hard rules:**
- **No dollars.** Segments show counts and progress only. The funding story is spoken, not a screen.
- **Never rank by contract value.** The worklist stays ordered by clinical risk, so the sickest patients are not pushed down for being harder to improve. `segment` on `GET /worklist` only filters.
- Segments are returned in a fixed order, not sorted by size or value.

## EMR data is display-only

The full clinical record (`PatientChart`: medications, labs, clinic vitals, encounters) belongs to the **EHR side**. It is served by `GET /ehr/patients/:id/chart` and shown only on the clinician's patient context card. **OmniOS screens, risk, and insight notes never read it.** The OmniOS side gets a `PatientSummary` (name, age, sex, conditions, attribution) so care managers can identify and group patients.

- `conditions` is a closed list (`hypertension`, `t2_diabetes`, `heart_failure`, `copd`), shown with `CONDITION_LABELS`. ICD-10 codes are intentionally absent until verified **[VERIFY]**.
- `medications` are drug **classes** only, with no brand names or doses **[DEFAULT]**.
- The mock generates the chart from the **same patient profile** as the device data so the two layers agree (for example A1c vs mean CGM glucose, clinic BP vs home BP, an ER encounter after a planted true-positive story). That coherence is a mock-generator concern, not an API concern.
- Planted-story ground truth (ER dates, expected flag dates) is mock-only and is not part of this contract.

## Body scans (Visualize)

A `BodyScan` (`src/contracts/body-scan.ts`) is one whole-body scan from the
Visualize SDK: measurements computed on the phone plus a 3D point cloud. It is
a rare event (weeks apart), not a daily reading, so it is its own entity.

- **Measurements:** height and weight (the scan's inputs), BMI, body fat %, lean
  muscle and bone mass (lb), girths (neck, waist, lower waist, hip, in), and
  advanced ratios (waist-hip, waist-height, central adiposity, fat mass index,
  skeletal muscle index). Units are Visualize's: inches and pounds.
- **3D:** `point_cloud` points at a binary file: N x 3 float32 (x, y, z in
  metres, y up) then N x 3 uint8 (red, green, blue). Head and torso only.
- **Privacy:** we keep height and weight only: no name, age or Visualize gender.
  The mock replicates 3 real consented scans across all patients by sex.
- Still to build: an endpoint to receive scans and one to read a patient's scan.

## Rules the contract encodes

- **Risk is honest.** `RiskAssessment` comes from data. `POST /route` and notification actions change `WorklistItem.status`, `snooze_until`, `routed_at` only. `risk_at_routing` is recorded so re-escalation can compare.
- **The backend computes risk, deviations, confidence, and trends. The frontend only displays them.**
- **Stale** = no successful sync in over 36h **[DEFAULT]**.
- **Dismiss** in the EHR sets the worklist status to `resolved` **[DEFAULT]**, pending a decision on whether to add a `dismissed` state.
- **Metric registry values** (plausible ranges, conflict tolerances, precedence order, which source provides what) are placeholders. LOINC codes are intentionally absent until verified **[VERIFY]**.
