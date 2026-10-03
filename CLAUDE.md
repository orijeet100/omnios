# OmniOS: guide for AI agents and developers

Read this first. It is short on purpose; the linked files hold the detail.

## What this is

A hackathon demo of a wearable-data insight layer for care managers (see
`context.md`). The frontend is a React app that reads a **mock data layer**
standing in for a backend that does not exist yet. Everything is synthetic.

## Read before changing anything

| File | Why |
|---|---|
| `context.md` | Source of truth for the product, users and the non-negotiable rules. |
| `docs/design-brief.md` | The 25 rules every screen must follow (type scale, tokens, arrows, modal, charts). |
| `docs/api-contract.md` + `src/contracts/` | The backend contract. The mock and the real backend must both match it. |
| `src/mock/README.md` | The data generator: what to port, what is scaffolding. |

## Non-negotiable product rules

These come from `context.md`. Do not break them.

- **Insight, never decision.** No orders, prescriptions, drug names, doses or
  specific treatments in any text. Generic suggestions only.
- **No dollars anywhere** and **never rank or sort patients by contract value.**
  Lists use a neutral fixed order (patient id) until a clinical risk score
  exists.
- **Honest risk.** Routing a patient changes worklist status, never the risk
  score.
- **EMR is display-only.** The chart (`PatientChart`) belongs to the EHR side
  and is never used by OmniOS analysis.
- **Be honest about the demo.** All patients and data are synthetic. By the
  owner's decision the UI no longer shows a "Synthetic data" badge, so never
  describe this data as real patient data, and never claim a real EHR, device or
  Medicaid integration.
- **Do not build** a leadership/finance view, a clinician-facing OmniOS app, or
  any patient-facing UI.
- Items marked **[VERIFY]** or **[DEFAULT]** in the docs are placeholders:
  flag them to the user instead of silently deciding.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000, strictPort: fails if 3000 is taken
npm run build      # tsc -b + vite build (also regenerates the route tree)
npm run lint
npm run format
npx vitest run src/mock --browser.enabled=false   # generator tests, in Node
```

`npm test` runs in a Playwright browser and needs `npm run test:browser:install`.
The mock tests are pure logic, so use the Node command above.

## Structure

```
src/
  contracts/      zod schemas + endpoint table (the backend contract)
  mock/           seeded synthetic data + unify + weekly check (see its README)
  features/
    dashboard/    dashboard rows, category page, category data helper
    patients/     all-patients page + search, patient card, arrows, avatar, modal, chart, data helper
    errors/       not-found and general error screens
  components/
    layout/       app shell: sidebar, header, main
    ui/           shadcn/ui primitives (eslint-ignored; edit sparingly)
  routes/         TanStack Router file routes (_app layout, /, /patients, /segments/$id)
  styles/         theme.css (color tokens, font), index.css
docs/             api-contract.md, design-brief.md
context.md        product source of truth
```

## How data flows

`src/mock` (`getDataset()`) -> `features/patients/data.ts` and
`features/dashboard/segments.ts` (view-models) -> components. The features
never read the mock's internals directly; they go through those two files. When
a real backend exists, replace the mock calls in those two files with API calls
that return the shapes in `src/contracts`.

The dashboard counts and the card arrows come from the **weekly check**
("weekly average at or beyond a threshold", `src/contracts/checks.ts`). In the
charts, a **day is red exactly when it is past the dashed line**, which is
always labelled **Target** ("Target 140"). So a chart can show a few red days in
a week that is not counted. Use the shared vocabulary in `docs/design-brief.md`
section 5: say "target" (never "limit", "baseline" or "threshold") in the UI.

## Conventions

- TypeScript, no semicolons, single quotes, Prettier (`npm run format`). Lint
  must pass with no errors.
- **Design:** follow `docs/design-brief.md`. Semantic color tokens only, one
  font (Inter), the fixed type scale, minimal text (no explanation paragraphs),
  red only for abnormal values. Reuse `ui/` components; add shadcn primitives
  only when needed.
- **Cards show markers, not graphs.** Graphs live only in the patient modal
  (Recharts), one tab per device. Keep one chart style (design brief rule 25).
  Red arrow = past target, green dot = on target; nothing else is red or green. Device tabs use the brand logos in `public/images` (`features/patients/device-logo.tsx`).
- **Clean code:** small functions, named constants instead of magic numbers,
  meaningful names, no dead code. Prefer simple, readable code over cleverness.
- **Mock determinism:** the order of random draws is part of the seed's output.
  Do not reorder draws in `src/mock/{cohort,generate,chart}.ts` without
  retuning the tests.
- Modal state lives in the URL (`?patient=<id>`), so it is linkable and the
  Back button closes it. The same `PatientDialog` is used by every page.
- "Not enough data" (`data_gap`) exists in the contract and generator but is
  deliberately not shown on the dashboard (it is a data-quality signal, not an
  abnormality).

## Gotchas

- `src/routeTree.gen.ts` is **generated** by the router plugin when you run
  `npm run dev` or `npm run build`. Never edit it. A new route file must exist
  with real content before a build runs, or the plugin overwrites it with
  placeholder boilerplate.
- TanStack Router hooks want different `from` values: `useParams` and
  `useSearch` take the route id (`'/_app/patients'`), `useNavigate` takes the
  full path (`'/patients'`).
- The dev server port is fixed to 3000 (`strictPort`). If it fails with "port
  in use", an old Vite from this project is still running; stop it, delete
  `node_modules/.vite`, and start again. A stale dev server can show a blank
  page after dependencies change.
- Package manager is **npm** (`package-lock.json`). Do not use pnpm or yarn.
- `src/components/ui` is excluded from eslint (shadcn-generated).
- Windows: line endings are normalized by git; ignore the "LF will be replaced
  by CRLF" warnings.

## Current status and next steps

Built: contracts, synthetic data generator (100 patients, tested), dashboard
(3 categories, counts only), category pages, all-patients page with search, and
the patient modal (per-device charts).

Not built yet (see `context.md` sections 6 and 13): risk score and tiers,
insight notes, worklist with status lifecycle, "Route to clinician" flow, the
EHR mockup and closed loop, re-escalation, audit log, a real API adapter.
**Send to doctor** in the patient modal is a placeholder that does nothing
(Dismiss closes the modal). Patient photos are placeholders: `PatientAvatar` shows
a stock portrait from randomuser.me chosen by sex and patient id
(`features/patients/avatar.ts`; needs internet, falls back to a person icon).
Pass `photoUrl` to use a real photo.
