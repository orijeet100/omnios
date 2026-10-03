# Physician view and Photon

The Physician view (`/ehr`) is the doctor's side of the demo. Everything on it
is synthetic. This file covers the flow, the one outside service it calls
(Photon) and the environment variables it needs.

## Flow

1. **Care Practitioner** opens a patient and taps **Send to doctor**. This
   creates a notification in the mock adapter and stays on the same page.
2. **Physician** sees it in the bell (header) and in the **Inbox** (`/ehr`):
   patient, parameters outside normal range, status. **Open** goes to
   `/ehr/prescriptions/<patientId>`.
3. That page shows **OmniOS insights for <name>** (before and after against the
   patient's baseline), then "AI is suggesting a prescription…" for at least 2
   seconds, then the editable suggestion (the built-in plans per condition in
   `src/integrations/photon.ts`). **Send prescription** calls Photon.

## No RunLog

An earlier version asked RunLog AI for the suggestion. It was removed: RunLog's
streaming endpoint did not match the code and we had no API docs. The
suggestion is the built-in plans, and the 2-second "AI is suggesting" step is a
fixed delay.

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

The green card says "Photon prescription confirmed / RX state: pending" with
the Rx ID. If any Photon call fails (or there is no token), the prescription is
**simulated** instead and the card looks the same; the reason is logged with
`console.warn`. Check the browser console or Photon itself to know which one
you got.

**[VERIFY]** Photon only accepts prescription writes from a token issued for a
logged-in provider; whether the sandbox token qualifies is unconfirmed. The
exact `DispenseUnit` values beyond `Each` are undocumented to us.

## Environment (`.env`, git-ignored; template in `.env.example`)

| Variable | Used for |
|---|---|
| `VITE_PHOTON_API_URL`, `VITE_PHOTON_AUTH_TOKEN`, `VITE_PHOTON_CLIENT_ID` | Photon sandbox. Empty token = simulated. |

The `VITE_` prefix is required: Vite only exposes prefixed variables to the
browser. It also means these values ship in the browser bundle, which is fine
for a sandbox demo and not for production (move the calls behind a server).
Restart `npm run dev` after editing `.env`. The Photon token expires after
about a day.
