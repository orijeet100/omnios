# OmniOS Backend Intelligence Layer

## What We Have Built

### Contracts (`src/contracts/`)
- **metrics.ts** — 22 metrics (18 original + 4 body composition: `body_fat_pct`, `muscle_mass_kg`, `bone_mass_kg`, `waist_circumference_cm`)
- **sources.ts** — 10 sources (9 original + `visualize_ai` body composition scanner)
- **checks.ts** — Weekly check rules with thresholds for BP, glucose, recovery signals
- **entities.ts** — Full entity model: Observation, ResolvedMetric, DataConfidence, MetricDeviation, RiskAssessment, InsightNote, WorklistItem, Notification, AuditEvent
- **api.ts** — API contract with 20+ endpoints (read, action, ai, demo)

### Analysis Engine (`src/analysis/`)
Pure functions, no I/O, fully testable:

| Function | Purpose |
|---|---|
| `computeBaselines()` | Rolling 30-day median per patient per metric |
| `computeDeviations()` | Current vs baseline, z-score, 7-day slope, days out of range |
| `computeConfidence()` | Wear time, missing days, implausible count, source agreement → 0–1 score |
| `computeRisk()` | Weighted z-scores by condition, dampened by confidence → 0–100 score, tier, drivers |
| `generateInsightNote()` | Rules-based prose from computed features (no LLM needed) |
| `buildWorklist()` | Join patients + risk + confidence + insight → ranked worklist |
| `buildCohortTrends()` | "N patients trending toward X" from weekly flags |
| `checkReescalation()` | Compare current risk vs `risk_at_routing`, escalate if margin exceeded |

### Mock API Adapter (`src/api/adapter.ts`)
In-memory state management serving all API endpoints:
- Worklist statuses (new → routed → acknowledged → resolved, re_escalated)
- Notifications (unread → acknowledged/dismissed)
- Audit trail (who did what, when)
- Demo controls (worsen patient, advance clock)

### External API Mocks (`src/integrations/`)
- **visualize.ts** — Visualize AI body composition mock. Generates scan results for 5 patients, converts to canonical observations, feeds into risk score.
- **photon.ts** — Photon Health e-prescribing mock. Simulates GraphQL mutation for prescription creation.

### Mock Data (`src/mock/`)
- 100 synthetic patients, 91 days, 8 archetypes, 5 planted stories
- Resolution pipeline (precedence + conflict detection)
- Weekly checks + segments
- EHR charts (medications, labs, encounters)
- Visualize AI data integrated for 5 patients

## What We Plan On Doing

### Frontend Routes (building now)
| Route | Purpose |
|---|---|
| `/population` | PHM view — cohort trends, segments, tier counts |
| `/population/:segmentId` | CM view — patients in a segment, ranked by risk |
| `/patients/:patientId` | Patient detail — timeline, insight note, confidence, "Export to EHR" |
| `/worklist` | Ranked worklist with status lifecycle |
| `/ehr` | EHR mockup — notification inbox, patient context card, clinician actions |
| `/ehr/prescriptions/:patientId` | Prescription flow with Photon mock |

### Demo Flow
1. PHM sees "15 patients trending toward elevated BP" → clicks segment
2. CM sees ranked patient list → clicks a person
3. Patient detail modal opens with multi-device timeline, insight note, confidence
4. CM clicks "Export to EHR" → confirmation, status changes to "Routed"
5. EHR mockup shows notification with insight note + patient context card
6. Clinician clicks "Proceed to prescription" → Photon mock → confirmation
7. Demo control: "Worsen patient" → re-escalation → patient returns to top of queue

## Architecture Principles
- **Insight, never decision** — OmniOS flags, clinicians decide
- **Honest risk** — status changes never alter risk scores
- **Data confidence** — low confidence dampens alerting, shown in UI
- **Synthetic data** — all patients are fake, clearly labeled
- **No real integrations** — all external APIs are mocked, labeled as demo
