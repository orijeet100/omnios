# Physician view: RunLog AI and Photon

The Physician view (`/ehr`) is the doctor's side of the demo. Everything on it
is synthetic. This file covers the two outside services it calls and the
environment variables they need.

## Flow

1. **Care Practitioner** opens a patient and taps **Send to doctor**. This
   creates a notification in the mock adapter and stays on the same page.
2. **Physician** sees it in the bell (header) and in the **Inbox** (`/ehr`):
   patient, parameters outside normal range, status. **Open** goes to
   `/ehr/prescriptions/<patientId>`.
3. That page shows **OmniOS insights for <name>** (before and after against the
   patient's baseline), then "AI is suggesting a prescription…" for at least 2
   seconds, then the editable suggestion. **Send prescription** calls Photon.

## RunLog AI: the suggestion

Code: `src/integrations/runlog.ts` (client), `src/features/ehr/suggest-prescription.ts`
(prompt and parsing).

- One RunLog **project per patient** (`omnios-patient-<id>`), found or created
  on first use. The project is the memory boundary between patients.
- We open an agent run in that project, send one message (age, sex, conditions,
  current medication, changes from baseline) and read the streamed reply.
- The reply must be a JSON array
  `[{"condition", "treatment", "instructions"}]`. Anything else is ignored.
- If RunLog is not configured, fails, times out (60 s) or returns nothing
  usable, the **built-in** suggestion (`TREATMENT_PLANS` in
  `src/integrations/photon.ts`) is used and the card says so. The screen never
  presents a built-in suggestion as RunLog's.
- Not live-tested by the agent that wrote it: the stream handling (ticket, SSE)
  is the previous integration's code, kept as it was.

## Photon: the prescription

Code: `src/integrations/photon.ts`. With a token set, **Send prescription**
makes real calls to the Photon sandbox, in order:

1. `createPatient` (name, date of birth, sex, phone). The synthetic patients
   have only an age, so the birth date is `<this year - age>-01-01` and the
   phone is a placeholder. The Photon patient id is reused for later sends in
   the same session.
2. A catalog lookup per drug (`treatments(filter: {term})`, falling back to
   `medications(filter: {name})`), by the first word of the treatment.
3. `createPrescription` per drug. Photon's docs name the id argument
   `medicationId` in one place and `treatmentId` in another, so the call tries
   one and retries the other if the first is rejected.

Success shows the Photon **Rx ID**. Any failure shows the error message; there
is no silent fallback. With **no token**, nothing is sent and the card says
"Prescription simulated".

**[VERIFY]** Photon only accepts prescription writes from a token issued for a
logged-in provider; whether the sandbox token qualifies is unconfirmed. The
exact `DispenseUnit` values beyond `Each` are undocumented to us.

## Environment (`.env`, git-ignored; template in `.env.example`)

| Variable | Used for |
|---|---|
| `VITE_RUNLOG_API_URL`, `VITE_RUNLOG_API_KEY` | RunLog AI. Empty key = built-in suggestion. |
| `VITE_PHOTON_API_URL`, `VITE_PHOTON_AUTH_TOKEN`, `VITE_PHOTON_CLIENT_ID` | Photon sandbox. Empty token = simulated. |

The `VITE_` prefix is required: Vite only exposes prefixed variables to the
browser. It also means these values ship in the browser bundle, which is fine
for a sandbox demo and not for production (move the calls behind a server).
Restart `npm run dev` after editing `.env`. The Photon token expires after
about a day.
