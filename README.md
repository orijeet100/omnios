# OmniOS

A unified wearable-data and insight layer for hospitals that manage Medicaid
patients under value-based contracts. It brings device data into one layer,
shows care managers which patients are drifting off target, and hands cases to
clinicians. OmniOS gives insight; clinicians make every clinical decision.

This repo is a **hackathon demo**. All patients and all data are synthetic, and
nothing here is a real EHR, device or Medicaid integration.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000 (the port is fixed)
```

Other commands:

```bash
npm run build      # typecheck + production build
npm run lint       # eslint
npm run format     # prettier
npx vitest run src/mock --browser.enabled=false   # data generator tests (Node, fast)
```

## What you see

| Screen                          | What it does                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard** (`/`)             | "Patients showing abnormalities": one wide row per category (Blood pressure above normal, glucose time in range low, early warning signs) with a count. |
| **Category** (`/segments/<id>`) | Square patient cards for that category: photo, name, age, sex and markers (red arrow past target, green dot on target).                                 |
| **All patients** (`/patients`)  | A card for every patient, with a search box (name, id, age, sex, condition or device).                                                                  |
| **Patient modal**               | One tab per device with charts, plus a Visualize tab with a rotating 3D body scan; then Dismiss (closes) and Send to doctor (placeholder).              |

## How it works

```
mock generator -> unify (resolve) -> weekly check -> segments -> screens
src/mock            src/mock           src/mock       src/mock    src/features
```

1. `src/mock` creates 100 synthetic patients with 13 weeks of daily device
   data, runs the real unification and weekly-check logic, and exposes the
   result. It is the stand-in for the backend.
2. `src/contracts` defines the shapes and endpoints the real backend must
   implement (zod schemas).
3. `src/features` turns that data into the screens above.

A day is shown in red when the weekly check says its week is off, so the red in
the charts always matches the counts on the dashboard.

## Where to read next

| File                                           | What it is                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                       | Guide for AI agents and new developers: structure, rules, gotchas. **Start here.** |
| [`context.md`](context.md)                     | What we are building and why; the non-negotiable product rules.                    |
| [`docs/design-brief.md`](docs/design-brief.md) | The visual and interaction rules every screen follows.                             |
| [`docs/api-contract.md`](docs/api-contract.md) | The backend contract, for the engineer building the real API.                      |
| [`src/mock/README.md`](src/mock/README.md)     | The data generator: pipeline, what to port, rules not to break.                    |

## Stack

React 19, Vite, TypeScript, TanStack Router, Tailwind CSS v4, shadcn/ui,
Recharts, zod. Package manager: npm.
