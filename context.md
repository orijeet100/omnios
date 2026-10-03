# OmniOS: Project Context

> **Read this first.** This file is the source of truth for the OmniOS hackathon demo. It explains what we are building, why, for whom, and how. Follow it unless the user says otherwise. Items tagged **[DEFAULT]** are decisions I made to keep us moving and can be changed. Items tagged **[VERIFY]** are real-world claims that were stated from memory and must not be presented as fact without checking.

---

## 1. One-paragraph summary

**OmniOS** is a unified wearable-data and insight layer for hospitals that manage Medicaid patients under value-based contracts. It connects to the consumer devices patients already own (Apple Watch, Fitbit, Garmin, Oura, Whoop) plus clinical-adjacent devices (CGMs, home BP cuffs), normalizes everything into one canonical layer, and surfaces which patients are drifting toward trouble and why. **Care managers and population health nurses** triage those patients in the OmniOS platform and route cases onward. **Clinicians** receive the result as a notification inside their existing EHR and make every clinical decision themselves. OmniOS never decides, prescribes, or orders.

**Hackathon goal:** a working, end-to-end demo by the end of today. Data sources are mocked. The unification and analysis must look and behave realistically, but clinical-grade validation is explicitly out of scope.

---

## 2. The problem we solve

- Medicaid members sign up for wearables (Whoop, Apple Watch, etc.) through their own Medicaid accounts. **The hospital has no connection to those devices and cannot see the data.**
- **Post-2028**, the cost of devices for attributed Medicaid members is charged against the medical assistance allocated to the hospital.
- Pre-2028 the pool was somewhat higher. Post-2028 the government adds a small increase on top, but the device costs exceed that increase. **The hospital ends up in a net loss before any bonus**, paying for devices it cannot use to manage its patients.

**Illustrative numbers (placeholders only, never present as real):** pre-2028 pool $5.0M, post-2028 pool $5.2M, with device costs charged against it that exceed the $0.2M increase.

---

## 3. Business model

Hospitals commonly hold **value-based contracts**. Patients are attributed to the hospital, and if they hit outcome targets (controlled blood pressure, controlled glucose, fewer ER visits) the hospital earns a year-end bonus. Specific contracts vary widely and are intentionally **not modeled in depth** for this demo.

**The OmniOS thesis, in four steps:**
1. Unify the device data the hospital is already paying for.
2. Identify at-risk patients early.
3. Route them to clinicians for timely intervention.
4. Healthier patients mean contract targets are met, which means a bonus and fewer ER visits.

**Hospital net position:**

```
Net = value-based bonus + avoided ER costs
      − device costs charged to assistance (net of the added funding)
      − OmniOS fee
```

**Pitch line:** OmniOS turns a loss into a smaller loss, break-even, or a profit.

> The funding math lives in the **spoken pitch only**. There is **no leadership or finance screen** in the product or the demo.

---

## 4. Users and roles

The hospital is the customer, but the product has exactly these users and no others:

| User group | Roles | Where they work | What they do |
|---|---|---|---|
| **OmniOS users** | Care managers, population health nurses | **OmniOS platform** (we build this) | Review cohort trends, investigate at-risk patients, route cases to clinicians |
| **Clinicians** | Physicians and other treating clinicians | **Inside the hospital's existing EHR** (we only *mock* this) | See the notification and patient context, then decide: outreach, medication review, visit, or dismiss |

**Out of scope:** leadership, executive, admin, and patient-facing views. No OmniOS login or app for clinicians. They stay in the EHR.

---

## 5. Design principles (non-negotiable)

1. **Insight, never decision.** OmniOS does not make clinical decisions, place orders, or prescribe. The clinician always decides.
2. **Generic suggestions only.** Allowed phrasing: "flag for clinician review," "consider medication review," "consider outreach." Never name a drug, dose, or specific treatment.
3. **Every insight shows its work:** what changed, versus which baseline, over what window, with what data confidence, from which sources.
4. **Honest risk.** A patient's risk score always reflects the data. Routing a case changes its **worklist status**, never its risk.
5. **Human in the loop, with an audit trail** of who saw what and what they did.
6. **No new app for clinicians.** The product meets them inside the EHR.
7. **Demo data is synthetic.** All patients are synthetic. **[Owner decision: the UI no longer shows a "Synthetic data" badge.]** Never present the data as real patient data, and keep every claim honest in the docs and the spoken pitch.

---

## 6. Architecture and workflow

### 6.1 Pipeline

```
Mock device sources → Ingestion → Normalization → Analysis → Insight notes → Worklist → Handoff → EHR mockup
```

1. **Ingestion.** In reality: connector-based. OAuth for Fitbit, Garmin, Oura, and Whoop; Apple Health data relayed through a phone app; CGM and BP cuff data via vendor connections. No manual patient entry. **[VERIFY exact integration paths per vendor.]** In the demo: mock files shaped like vendor/aggregator output, plus a "Connected sources" panel.
2. **Normalization.** Vendor-specific records are mapped into one canonical, FHIR-Observation-shaped schema, with unit and definition reconciliation (SDNN vs rMSSD, °C vs °F, different sleep-score scales).
3. **Analysis.** Personal baselines, deviation scoring, trend features, risk tiers.
4. **Insight layer.** A structured insight note per flagged patient.
5. **Handoff.** The care manager or nurse routes the case. A notification surfaces in the EHR mockup.

### 6.2 Two surfaces (only one is a real product)

**A. OmniOS platform: care managers and population health nurses. Built properly.**
- **Connected sources panel:** which devices are unified across the cohort, with sync freshness.
- **Population view:** cohort-level trends, e.g. "15 patients trending toward elevated BP. Here is what is driving it." Ranked worklist with risk tier, trend, confidence, and status.
- **Patient detail:** multi-device timeline overlay, baseline deviation, insight note, data confidence, contributing sources, device-conflict indicators.
- **Action:** a **"Route to clinician"** button.

**B. EHR mockup: clinicians. A visual mock, not an OmniOS product.**
- A believable but generic EHR screen (not any real vendor's branding or UI) that surfaces the OmniOS notification: "Something changed for patient X."
- Opening it shows the insight note and a **patient context card** (header, conditions, medications, recent labs).
- Clinician actions: **Acknowledge**, **Dismiss**, **Add plan note**.
- Purpose: show what clinicians experience once OmniOS is integrated. In reality OmniOS plugs into the hospital's own EHR, so there is no separate clinician login or app.

### 6.3 Worklist status lifecycle

```
New → Routed (pending clinician review) → Clinician acknowledged → Resolved
                      ↓
                 Re-escalated  (returns to top of queue)
```

### 6.4 Demo behavior on "Route to clinician"

1. A confirmation appears: **"Request submitted (demo mode)."**
2. The patient leaves the critical queue for **1 to 2 weeks** with status **"Routed, pending clinician review."** This is a **worklist snooze**, not a claim that the patient became non-critical. The underlying risk score keeps updating honestly.
3. The notification appears in the EHR mockup, ideally in a split screen or second tab so the audience watches the handoff happen.
4. **Re-escalation beat [DEFAULT]:** during the snooze window, if the patient's risk score rises above the level at routing by a set margin, or a new critical flag fires, the patient automatically returns to the top of the queue and is marked "Re-escalated."
5. **Closed loop (optional but recommended):** when the clinician acknowledges in the EHR mockup, the status updates back in OmniOS.

### 6.5 Integration story for the pitch **[VERIFY all of this]**

The standard approach is likely **SMART on FHIR** for launching apps in the chart, **CDS Hooks** for pushing alert cards at the point of care, and **FHIR resources** (Patient, Condition, Observation, MedicationRequest) for data exchange. Epic and Oracle Health support these in some form, though the details and approval processes vary. For the demo we only need FHIR-shaped data and a convincing mock. **Do not claim a working EHR integration.**

---

## 7. Data sources (all mocked)

**Devices (connection-based, no manual entry):** Apple Watch, Fitbit, Garmin, Oura, Whoop, plus CGMs (Dexcom, Libre) and home BP cuffs (Omron, Withings).

**Realism note:** consumer wearables do **not** measure glucose directly, and BP support on wearables is limited and device-dependent **[VERIFY]**. The unified layer's value is combining wearable proxies (heart rate, HRV, sleep, activity) with CGM and BP cuff data. This is honest and is a strong demo story.

### 7.1 Signals to simulate

| Group | Signals | Typical cadence |
|---|---|---|
| **Cardiometabolic core** | Home BP (systolic/diastolic), continuous glucose (time in range, highs, overnight lows), weight trend | BP: a few readings per week. CGM: every 5 to 15 min |
| **Wearable proxies** | Resting HR, HRV (SDNN for Apple, rMSSD for Whoop), sleep (duration, efficiency, stages, awakenings), activity (steps, active minutes), wrist/skin temperature deviation, SpO2, respiratory rate | Daily summaries. Minute-level HR for a subset of patients |
| **Patient-reported / clinical** | Symptom score, medication adherence, ER visits (ground-truth labels), last A1c, clinic visits | Sparse and irregular |
| **Platform-derived** | Wear time, sync freshness, data completeness | Daily |

### 7.2 Typical ranges (for the generator)

| Signal | Healthy-ish range | Concerning direction |
|---|---|---|
| Resting HR | 50 to 90 bpm | +5 to +15 over personal baseline |
| HRV | SDNN 20 to 100 ms, rMSSD 20 to 120 ms | Down 15%+ from baseline |
| Respiratory rate (sleep) | 12 to 20 br/min | Above about 22, or +2 over baseline |
| SpO2 | 95 to 100% (lower baselines for COPD) | Repeated dips under 90% |
| Skin temp deviation | ±0.5 °C | +0.5 to +1.5 °C |
| Sleep | 5 to 9 h, efficiency 75 to 95% | Short, fragmented |
| Steps | 500 to 15,000/day | Sustained drop |
| Home BP | e.g. 110-130 / 70-85 | Sustained rise above personal baseline |
| Glucose | Per-patient, time-in-range focus | More highs, more overnight lows, lower time in range |

### 7.3 Messiness to build in (the platform must handle these)

- Missing data: charging gaps, watch not worn, nights with no sleep record
- Sensor noise and implausible values (e.g. HR 220 at rest)
- Duplicate or conflicting sources (Apple Watch and Whoop both reporting sleep)
- Unit and definition differences (SDNN vs rMSSD, °C vs °F)
- Timezone and DST shifts, late-arriving data
- Per-device bias (one device reads SpO2 a few points lower)

---

## 8. Canonical schema

Use a FHIR-Observation-shaped long format so the "plugs into your EHR" claim is credible.

> **Grain [DEFAULT]:** vendors are synced once every 24 hours and give **daily summaries**, not raw streams. One observation row is one value per patient, per metric, per day, per source (`date` is the patient's local day, not a `timestamp_utc`). Minute-level HR and 5-to-15-minute CGM readings in section 7 are what the *devices* record; the platform only receives the daily summary. The exact entities and API shapes live in `src/contracts/` and `docs/api-contract.md`, which win over the table below if they differ.

**Observation table (one row per measurement):**

```
patient_id, timestamp_utc, metric, value, unit, code_system, code,
source_device, source_vendor, quality_flag, ingested_at
```

- `metric` is a canonical name (e.g. `heart_rate`, `hrv_rmssd`, `hrv_sdnn`, `bp_systolic`, `bp_diastolic`, `glucose`, `spo2`, `resp_rate`, `skin_temp_dev`, `sleep_duration`, `steps`).
- `quality_flag` is one of `ok`, `suspect`, `implausible`, `imputed`, `late`.
- Use standard LOINC codes where known **[VERIFY codes before presenting]**.

**Patient chart table (mock EHR context):** `patient_id, name (synthetic), age, sex, conditions[], medications[], last_a1c, last_bp_clinic, last_visit_date, attributed_to_hospital`.

> **EMR is display-only [DEFAULT]:** the chart (medications, labs, clinic vitals, encounters) lives on the EHR side and appears only on the clinician's context card. OmniOS analysis, risk, and insight notes do not use it; OmniOS keeps only a patient summary (identity and conditions). The mock still generates the chart from the same patient profile as the device data so the two stay consistent. The exact shape is in `src/contracts/entities.ts`.

**Worklist table:** `patient_id, risk_score, risk_tier, status, routed_at, snooze_until, risk_at_routing, last_updated, insight_note_id`.

**Audit log:** `event_id, timestamp, actor_role, actor_id, patient_id, action, detail`.

---

## 9. Simulated cohort

About **30 synthetic patients**, **cardiometabolic-first [DEFAULT]**: hypertension, type 2 diabetes, both, and a few with heart failure or COPD (they drive ER visits). About 90 days of history.

**Generator approach:**
- Each patient has a **latent state**: baseline fitness, age, condition severity, and a daily stress/illness load.
- Every metric derives from that latent state with realistic correlations (HRV, RHR, respiratory rate, SpO2, temperature, and sleep move together).
- Circadian sinusoid plus AR(1) noise for HR and temperature.
- Per-patient device mix, adherence, and wear time.
- **Planted events with ground truth** so we can measure alert quality.

**Planted stories (all five must exist in the demo data):**
1. **True positive.** BP rising or glucose destabilizing across 3 to 7 days, followed by an ER visit. OmniOS should flag it with useful lead time.
2. **False alarm.** A hard workout or a bad night that must **not** raise a critical alert (tests specificity).
3. **Device gap.** A device swap or charging gap that lowers data confidence and is clearly shown as such.
4. **Recovering patient.** Slow improvement after an intervention, supporting the contract-outcome story.
5. **Re-escalation.** A routed patient who worsens during the snooze window and returns to the top of the queue.

Teammates' own exports can calibrate ranges but must stay private and out of the demo.

---

## 10. Analysis spec

Keep it realistic, not clinically validated.

**Core computations:**
- **Personal baselines:** rolling 14 to 30 day median per patient per metric. Deviation from the patient's own norm matters more than raw values.
- **Composite deviation score:** weighted z-scores across relevant metrics, with weights depending on the condition (BP and resting HR for hypertension, glucose variability and overnight lows for diabetes, respiratory rate and SpO2 for COPD).
- **Trend features:** 3 to 7 day slope, variability, count of days or nights out of range.
- **Weekly check [DEFAULT]:** the simplest "looks off" rule. For each patient, metric and calendar week, take the weekly average; at or beyond a threshold means `off`, and fewer than 3 days of data means `insufficient_data`. BP and glucose checks map to the contract measures; resting HR, HRV, respiratory rate, and SpO2 (against the patient's own baseline) are ER early-warning signals. Patients are grouped into fixed segments (BP, glucose, recovery signals, data gap) shown as **counts only**. Thresholds are placeholders **[VERIFY]**. Rules and thresholds live in `src/contracts/checks.ts`.
- **Data confidence:** driven by wear time, gaps, source agreement, and flagged implausible values. Low confidence must visibly dampen alerting and show in the UI.
- **Risk tiers:** e.g. Low / Watch / High / Critical, with a ranked worklist.
- **Alert quality** against planted events: true positives, false alarms, and lead time before the ER event.

**Insight note format (plain language, generated from computed features only):**

```
What changed:    Home BP up ~12 mmHg systolic over 6 days; resting HR +7 bpm.
Versus baseline: Patient's 30-day median.
Window:          Last 6 days.
Confidence:      Medium (2 sensor gaps; BP cuff + Apple Watch agree).
Sources:         Withings BP cuff, Apple Watch.
Suggestion:      Flag for clinician review. Consider medication review.
```

LLM-written text, if used, is limited to turning these computed fields into readable prose. **It must never introduce clinical decisions, drug names, or doses.**

**Stubbed (explicitly not real):** clinical validation, real contract rules, real device APIs, a real EHR connection.

---

## 11. Demo script (the narrative arc)

1. **Connected sources:** "Here are the devices our patients already own, unified in one place."
2. **Population view:** "15 patients are trending toward elevated BP. Here is what is driving it."
3. **Patient detail:** multi-device overlay, baseline deviation, insight note, confidence, device conflict handling.
4. **Route to clinician:** click, "Request submitted (demo mode)," status changes to "Routed, pending clinician review."
5. **EHR mockup (split screen):** the notification appears, with the insight note and patient context card.
6. **Closed loop:** the clinician acknowledges, and the status updates in OmniOS.
7. **Re-escalation:** a snoozed patient worsens and jumps back to the top.
8. **Close (spoken only):** the funding story, loss to break-even or profit through contract outcomes.

---

## 12. Frontend and backend

- **Frontend:** the existing template in this repo (shadcn-admin: React, Vite, TypeScript, TanStack Router and Query, Tailwind, shadcn/ui, Recharts). Package manager is **npm**; the dev server runs on **port 3000** (`npm run dev`). The OmniOS platform and the EHR mockup are two routes (or two windows) in this app, for the split-screen demo.
- **Backend:** language, storage, and hosting are **not decided yet**. Until the backend exists, the frontend reads from a mock data layer that follows the same API contract the backend will implement.
- Keep everything runnable locally with one or two commands.

---

## 13. Build plan for today

1. **Schema + mock chart data** (FHIR-shaped).
2. **Mock data generator:** cohort, signals, messiness, five planted stories. Produce vendor-shaped raw files (Apple-like, Whoop-like, Fitbit-like, CGM, cuff).
3. **Normalizer + analysis:** canonical table, baselines, deviation scores, confidence, risk tiers, insight notes.
4. **OmniOS platform:** connected sources, population view, patient detail, route action, status lifecycle.
5. **EHR mockup:** notification inbox, context card, acknowledge/dismiss/note.
6. **Wire the handoff** (route → notification → acknowledge → status update), then add re-escalation.
7. **Polish and rehearse** the split-screen demo.

If time runs short, cut in this order: closed loop, polish on the EHR mock, optional signals (respiratory, weather). **Never cut:** the planted stories, the data-confidence display, or the route-to-notification handoff.

---

## 14. Acceptance criteria

- [ ] 30 synthetic patients with about 90 days of multi-device data, including messiness
- [ ] Data from at least 5 device types normalized into one canonical schema
- [ ] All five planted stories present and detectable
- [ ] Population view with a ranked worklist and an "N patients trending toward X" summary
- [ ] Patient detail with multi-device overlay, baseline deviation, insight note, confidence
- [ ] "Route to clinician" produces the confirmation, status change, and EHR notification
- [ ] Re-escalation works for a snoozed patient who worsens
- [ ] Every insight is insight-only, with generic suggestions and no drugs or doses
- [ ] All data is synthetic, with no real patient data (the on-screen label was removed at the owner's request)

---

## 15. Rules for Claude Code

- **Do not build** a leadership/finance view, a clinician-facing OmniOS app, or any patient-facing UI.
- **Do not claim** a real EHR, device-API, or Medicaid-program integration anywhere in the UI or docs.
- **Do not use** real patient data, real people's names, or any real vendor's EHR branding in the mock.
- **Do not name** drugs, doses, or specific treatments in any insight text.
- Segments and cohort views show **counts, never dollars**, and the worklist is **never ranked by contract or measure value**, only by clinical risk.
- Keep the **risk score honest**: status changes must never alter risk values.
- Prefer simple, readable code over cleverness. This is a one-day demo.
- When something here is marked **[VERIFY]** or **[DEFAULT]**, flag it to the user instead of silently deciding.

---

## 16. Open questions (for the user)

- **Roles:** the user's wording was "two roles" but listed three titles. Treated here as **two user groups** (care managers and population health nurses on OmniOS, clinicians in the EHR). Confirm.
- **Cohort focus:** cardiometabolic-first, with respiratory as an optional add-on. Confirm.
- **Backend:** language, storage, and hosting are undecided. The frontend is the existing template in this repo.
- **Re-escalation threshold:** default is "risk rises above the level at routing by a set margin, or a new critical flag fires." Confirm or define.
- **Funding and contracts:** illustrative and generic. Name a real program or stay generic?
- **Verify before presenting as fact:** wearable BP and glucose capabilities, LOINC codes, and the FHIR / CDS Hooks / SMART on FHIR details.
