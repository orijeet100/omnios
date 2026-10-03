# OmniOS Backend Intelligence Layer

## What We Have Built

### Contracts (`src/contracts/`)
- **metrics.ts** — 22 metrics (18 original + 4 body composition: `body_fat_pct`, `muscle_mass_kg`, `bone_mass_kg`, `waist_circumference_cm`)
- **sources.ts** — 10 sources (9 original + `visualize_ai` body composition scanner)
- **checks.ts** — Weekly check rules with thresholds for BP, glucose, recovery signals
- **entities.ts** — Full entity model: Observation, ResolvedMetric, DataConfidence, MetricDeviation, RiskAssessment, InsightNote, WorklistItem, Notification (with priority/message), AuditEvent
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
- Notifications (unread → acknowledged/dismissed, with priority and message)
- Audit trail (who did what, when)
- `getEhrContext()` — chart + insight + connections for EHR view
- `actOnNotificationByPatient()` — find notification by patient ID

### External API Integrations (`src/integrations/`)
- **visualize.ts** — Visualize AI body composition mock. Generates scan results for 5 patients (P001, P015, P032, P047, P063), converts to canonical observations, feeds into risk score.
- **photon.ts** — Photon Health e-prescribing integration. Attempts real GraphQL API call at `https://api.neutron.health/graphql` with bearer token from `VITE_PHOTON_AUTH_TOKEN`. Falls back to mock mode on auth failure (POC exception: includes drug names and doses). Pre-fills treatment based on patient conditions:
  - `hypertension` → "Lisinopril 10mg daily (POC demo)"
  - `t2_diabetes` → "Metformin 500mg twice daily (POC demo)"
  - `heart_failure` → "Carvedilol 6.25mg daily (POC demo)"
  - `copd` → "Albuterol inhaler 2 puffs BID PRN (POC demo)"

### Mock Data (`src/mock/`)
- 100 synthetic patients, 91 days, 8 archetypes, 5 planted stories
- Resolution pipeline (precedence + conflict detection)
- Weekly checks + segments
- EHR charts (medications, labs, encounters, clinic vitals)
- Visualize AI data integrated for 5 patients

## What We Built (UI + Wiring)

### Role Toggle (`src/components/role-toggle.tsx`, `src/context/role-provider.tsx`)
- Floating toggle in header for PHM / CM / Physician views
- PHM → Dashboard, CM → All Patients, Physician → EHR Inbox
- Sidebar hidden for Physician role

### Dashboard (`src/features/dashboard/`)
- **Segment cards** enriched: icons, trend arrows (up/down/flat), patient counts, metric labels, priority badges
- Color-coded trend indicators (red = worsening, green = improving)

### Patient Dialog (`src/features/patients/patient-dialog.tsx`)
- Insight note card with editable CM suggestion and prescription suggestions
- Risk score, confidence level, trend indicator
- Multi-device timeline with tabs (including Visualize AI body composition)
- Violations list (top 3 clickable + expandable)
- "Send to doctor" button wired to `routePatient()` → navigates directly to `/ehr/prescriptions/[patientId]`

### Violations List (`src/features/patients/violations-list.tsx`)
- Top 3 violations clickable (rows are interactive)
- Remaining violations shown on expand
- Z-score, trend arrows, priority badges (high/medium/low)

### EHR Routes (`src/routes/_app/ehr/`)
- `/ehr/` — Notification inbox with full patient context card (conditions, meds, labs, clinic vitals)
- `/ehr/prescriptions/$patientId` — Prescription flow with:
  - OmniOS insight note (what changed, suggestion, confidence, sources)
  - Pre-filled treatment based on patient conditions
  - Real Photon API call (with mock fallback)
  - Connected devices panel
  - Confirmation with Rx ID

### Segments (`src/features/dashboard/segments.ts`)
- `SegmentCardData` enhanced with `prevCount`, `trend`, `metrics`, `primaryMetric`
- Dashboard shows trend direction and previous week comparison

## Architecture Principles
- **Insight, never decision** — OmniOS flags, clinicians decide
- **Honest risk** — status changes never alter risk scores
- **Data confidence** — low confidence dampens alerting, shown in UI
- **No synthetic data badges** — per owner decision, data is unlabeled
- **Photon POC exception** — drug names/doses included for demo, not for production
