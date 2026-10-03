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
| `GET /patients/:id` | read | Chart, risk, confidence, deviations, worklist item |
| `GET /cohort/summary` | read | "N patients trending toward X" and tier counts |
| `GET /worklist` | read | Ranked worklist, filter by tier / status |
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

## Rules the contract encodes

- **Risk is honest.** `RiskAssessment` comes from data. `POST /route` and notification actions change `WorklistItem.status`, `snooze_until`, `routed_at` only. `risk_at_routing` is recorded so re-escalation can compare.
- **The backend computes risk, deviations, confidence, and trends. The frontend only displays them.**
- **Stale** = no successful sync in over 36h **[DEFAULT]**.
- **Dismiss** in the EHR sets the worklist status to `resolved` **[DEFAULT]**, pending a decision on whether to add a `dismissed` state.
- **Metric registry values** (plausible ranges, conflict tolerances, precedence order, which source provides what) are placeholders. LOINC codes are intentionally absent until verified **[VERIFY]**.
