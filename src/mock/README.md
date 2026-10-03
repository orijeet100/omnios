# Mock data layer

Synthetic data for the OmniOS demo: 100 patients, 13 full weeks (91 days) of
device data, an EMR chart per patient, and the weekly check that turns the data
into segments. Everything is generated from a fixed seed, so every run is
identical. All patients are fake.

If you are building the real backend, read **"What to port"** first.

## The pipeline

```
profile            generate              resolve               weekly check          segments
(who is the   ->   daily Observation  -> one ResolvedMetric -> WeeklyFlag per     -> counts per
 patient)          per source              per metric per day    metric per week       segment
cohort.ts          generate.ts             resolve.ts            weekly.ts             weekly.ts
```

1. **Profile** (`cohort.ts`): who the patient is, which devices they own, how
   often they use them, and a `Plan` describing how their story unfolds.
2. **Generate** (`generate.ts`): one `Observation` per patient, day, metric and
   source, in the shape the contract defines. Includes messiness: missing days,
   implausible values (e.g. HR 220), two devices disagreeing, a device swap.
3. **Resolve** (`resolve.ts`): when several sources report the same metric on
   the same day, pick one by precedence and flag a conflict if they disagree.
4. **Weekly check** (`weekly.ts`): average the resolved values per calendar
   week and compare to a threshold. At or beyond it means `off`.
5. **Segments** (`weekly.ts`): group patients who are `off` for the same reason
   (BP, glucose, recovery signals) or lack data. Counts only.

## What to port to the real backend

| Port this (real logic)                                          | Do not port (mock scaffolding)                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `resolve.ts`: precedence and conflict rules                     | `cohort.ts`, `cohort-spec.ts`, `names.ts`: invent patients                     |
| `weekly.ts`: weekly verdict and segments                        | `generate.ts`, `shapes.ts`: invent device readings                             |
| Rules in `../contracts/checks.ts` and `../contracts/sources.ts` | `chart.ts`: invents an EMR record (the real one comes from the hospital's EHR) |

`weeklyVerdict()` in `weekly.ts` is the whole business rule in about 15 lines.

## The data grain

Vendors sync once every 24 hours and give **daily summaries**, not raw streams.
So one row is **one value per patient, per metric, per day, per source**. There
is no minute-level HR or 5-minute CGM data anywhere.

## The archetypes (and the answer key)

Each patient is created from an archetype, which decides how their data behaves:

| Archetype              | Count | What the data does                            | Rewarded by the contract?     |
| ---------------------- | ----- | --------------------------------------------- | ----------------------------- |
| stable_controlled      | 39    | Nothing off                                   | No (already meeting targets)  |
| stable_bp_uncontrolled | 8     | BP off every week                             | Yes, BP control               |
| bp_drifting            | 15    | BP rises, off in the latest weeks             | Yes, BP control               |
| glucose_off            | 10    | Glucose time in range low                     | Yes, glucose control          |
| near_target_improving  | 8     | Off early, ok by the latest week              | Yes, shows progress           |
| acute_decliner         | 7     | Recovery signals worsen; 3 end in an ER visit | Yes, fewer ER visits          |
| low_adherence          | 8     | Mostly no data                                | Indirect (we cannot see them) |
| false_alarm            | 5     | One bad day, weekly average stays ok          | No (tests specificity)        |

**The archetype label is only an answer key for tests.** The product must derive
categories from the data using the weekly check, never from this label. The
mock-only answer key (`groundTruth` in `index.ts`: ER dates, decline onset,
false-alarm dates) must never be exposed by the API or shown in the UI.

## Rules this code must not break

- **No dollars.** Segments show counts and progress only. The funding story is
  spoken, not a screen.
- **Never rank by contract value.** The worklist is ordered by clinical risk.
  Segments only filter. Otherwise the sickest patients could be deprioritized
  for being harder to improve.
- **Honest risk.** Routing a patient changes worklist status, never risk.
- **EMR is display-only.** `chart.ts` data appears only on the clinician's EHR
  card. OmniOS analysis never reads it. Medications are drug classes, never
  brand names or doses.
- **Insight, not decision.** Generic suggestions only; no drug names or doses
  in any insight text.

## Using it

```ts
import { getDataset, computeSegments } from './index'

const ds = getDataset() // built once, then cached (about half a second)
const week = '2026-09-21'
const { segments } = computeSegments(ds.profiles, ds.weeklyFlags, week)
```

`Dataset` holds: `profiles`, `charts`, `observations`, `resolved`,
`weeklyFlags`, `connections` and the mock-only `groundTruth`. The data window
is `2026-06-29` to `2026-09-27` (see `dates.ts`).

Run the checks (they run in Node, which is faster than `npm test`'s browser
mode for pure logic):

```bash
npx vitest run src/mock --browser.enabled=false
```

The tests assert that every planted story lands where it should: stable
patients are rarely flagged, drifting BP is caught, false alarms never trip a
check, and each ER patient is flagged in a full week before the visit.

## Things to know

- **Determinism.** The order of random draws is part of the output. Changing
  the order in `cohort.ts`, `generate.ts` or `chart.ts` changes the data, and
  the tests' thresholds may need retuning. Each patient uses its own random
  stream, so adding a patient does not change the others.
- **Early weeks.** Baseline rules (resting HR, HRV, respiration, SpO2) need 10
  prior days, so the first two weeks show them as `insufficient_data`.
- **Thresholds are placeholders** [VERIFY]: BP 140/90, glucose time in range
  below 70%, and the recovery-signal deltas are demo values, not contract or
  clinical guidance. Same for metric ranges and source precedence.
- **Not built yet:** risk scores, insight notes, the worklist and its status
  changes, the mock API adapter, vendor-shaped raw files, and sync runs.
- **Device swap.** A swapped patient has a 6-day gap with no wearable data
  between the old and the new device.

Contracts: [`../contracts`](../contracts) and
[`../../docs/api-contract.md`](../../docs/api-contract.md).
