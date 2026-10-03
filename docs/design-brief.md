# OmniOS frontend design brief

The frontend started as a generic admin dashboard template (shadcn/ui,
Tailwind v4). This brief says what we keep from it, what we add, and the rules
every screen must follow. It exists so the UI stays consistent and so a
reviewer can check a screen against a short list.

## 1. What the template defines (we keep this)

| Area | What is there | Where |
|---|---|---|
| **Color** | Neutral slate palette as semantic tokens in OKLCH: `background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `ring`, `chart-1..5`, `sidebar-*`. Light and dark values for each. We added one: `success` (green). | `src/styles/theme.css` |
| **Font** | Inter for everything. | `index.html`, `theme.css` |
| **Radius** | One base radius, `0.625rem`. Cards use `rounded-xl`, buttons and badges `rounded-md`. | `theme.css`, `ui/card.tsx` |
| **Page title** | `text-2xl font-bold tracking-tight` | every page |
| **Card title** | `font-semibold` | `ui/card.tsx` |
| **Body / helper** | `text-sm`, with secondary text `text-sm text-muted-foreground`; captions `text-xs text-muted-foreground` | everywhere |
| **Spacing** | Page padding `px-4 py-6`, max width `max-w-7xl`, header `h-16`, grids `gap-4` | `layout/main.tsx`, `layout/header.tsx` |
| **Layout** | Inset sidebar (16rem, collapses to icons), header with sidebar trigger, content in `<Main>` | `layout/*`, `ui/sidebar.tsx` |
| **Status** | Badge variants `default / secondary / outline / destructive` | `ui/badge.tsx` |
| **Dark mode** | Class-based, light / dark / system, via the theme provider | `context/theme-provider.tsx` |

## 2. Constraint rules

These are the rules we build to. They come from the table above, plus the
medical constraints in `context.md`.

### Visual

1. **Tokens only.** Use the semantic Tailwind tokens (`bg-card`,
   `text-muted-foreground`, `text-success`, ...). No hex, rgb or hard-coded
   colors. The only token we added to the template is `success`.
2. **One font: Inter.** Numbers that line up in columns or cards use
   `tabular-nums`.
3. **Fixed type scale.** Only these sizes, with these jobs:

   | Job | Classes |
   |---|---|
   | Page title (`h1`, one per page) | `text-2xl font-bold tracking-tight` |
   | Page subtitle | `text-sm text-muted-foreground` |
   | Name on a card or modal | `font-semibold` (modal: `text-lg`) |
   | Big number | `text-3xl font-bold tabular-nums` |
   | Label / body | `text-sm` (`font-medium` for labels) |
   | Caption / metadata | `text-xs text-muted-foreground` |

   No other sizes. No sizes bigger than `text-3xl`.
4. **One heading level per job.** The page title is `h1`; modal chart titles
   are `h3` under the modal title. Interactive cards use plain text, not
   headings. Never skip a level.
5. **Spacing from the template scale.** Grids use `gap-4`, page sections
   `space-y-6`. No arbitrary pixel values.
6. **Radius from the template.** Cards `rounded-xl`, badges and buttons
   `rounded-md`, avatars fully round. No custom radii.
7. **Reuse components.** Build screens from `Card`, `Badge`, `Button`,
   `Dialog`, `Tabs`, `Avatar`, `Input` and the sidebar parts that already
   exist. Icons come only from `lucide-react`. Charts use Recharts.
8. **Color is never the only signal.** Anything flagged also carries an arrow,
   a label or a number. **Red** (`destructive`) means outside the normal range,
   and is used for arrows, values and the abnormal part of a chart line.
   **Green** (`success`) means on target, and is used only for the "on target" dot.
   Nothing else is red or green.
9. **Dark mode comes free.** Because of rule 1, no `dark:` overrides in
   screens.

### Layout and interaction

10. **One shell.** Inset sidebar with two items (Dashboard, All patients), a
    sticky header with the sidebar trigger and the theme switch, and content in
    `<Main>` (max width `7xl`).
11. **Clickable means obvious.** A card that navigates is a real link; a card
    that opens a modal is a real `<button>`. Both are keyboard focusable with a
    visible focus ring, and both shift to `bg-accent` on hover.
12. **Responsive grid.** Patient cards use 1 column on mobile, 2 from 480px, 3
    at `lg` and 4 at `xl`, with `gap-4`. Dashboard rows are full width.
13. **Every list handles empty.** An empty list says so in a few words
    ("No patients found.").

### Medical and product (from `context.md`)

14. **Be honest about the demo.** All patients and data are synthetic. The UI
    has no "Synthetic data" badge (owner's decision), so never describe the data
    as real, and never claim a real EHR, device or Medicaid integration.
15. **Insight, never decision.** Copy says what is where. It never tells a
    clinician what to do, never names a drug, dose or treatment, and never says
    "diagnosis".
16. **Show the basis in the chart, not in prose.** A measurement is charted
    with the line that decides it, dashed, and the days past that line in red,
    so the reader sees why without a paragraph. The word "target" is not used.
17. **No dollars, no contract ranking.** No currency anywhere, no
    "contract measure" tags. Lists are in a neutral fixed order (patient id),
    never sorted by contract value or "easiest win".
18. **Honest absence.** We never show a guess or a zero for missing data. A
    measurement with too little data simply shows no marker.
19. **Plain language.** Short labels a care manager or a demo audience reads in
    a second ("Blood pressure above normal", "Early warning signs"). No jargon like
    "z-score" or "baseline delta".
20. **Minimal text.** Titles, labels and numbers only. No explanation
    paragraphs, helper copy, or "of N" counts on cards, rows or in modals.

### Cards, markers and the modal

21. **Dashboard row.** Icon, category name, count, chevron. Nothing else.
22. **Patient card.** A card with a photo (a stock portrait chosen by sex
    and patient id; a person icon if it fails to load), name, `age · sex`, and markers. No graphs on cards. The
    photo is a single `PatientAvatar` component, so one change adds real
    photos everywhere.
23. **Markers.** One small marker per measurement, with its label: a red arrow
    (up or down) when it is past the target, a green dot when it is on target.
    There are no sideways arrows. A measurement counts once (BP is one marker
    even if both numbers are off). Past-target markers come first.
24. **One patient modal for every page.** Header: photo, name, `age · sex`,
    arrows. Body: one tab per device, shown as the brand's logo (Whoop, Omron, Dexcom, ...; black logos are inverted in dark mode), a red
    dot on any device with an out-of-range reading, opening on the first such
    device. Each tab charts that device's measurements, out-of-range ones
    first. Footer, centered: Dismiss (closes the modal) and Send to doctor
    (placeholder, does nothing yet).
25. **One chart style.** The normal line is `--primary`, abnormal stretches are
    `--destructive` and drawn on top, the decision line is a
    dashed `--muted-foreground` line labelled outside the plot, grid lines are
    `--border`, and hovering shows a tooltip with the date and value. **A day
    is red exactly when it is past the dashed line**, so colour and line can
    never disagree. The line is always labelled "Target" with its value ("Target
    140"); for heart rate, HRV, breathing and SpO2 the value is the patient's
    own usual level plus the allowed change, for BP and glucose it is a fixed
    value. Dashboard counts still come from
    the weekly average (`src/contracts/checks.ts`), so a chart can show a few
    red days in a week that is not counted.

## 3. Screens

| Screen | Route | Content |
|---|---|---|
| **Dashboard** | `/` | Title "Patients showing abnormalities", then one wide row per category: Blood pressure above normal, Glucose time in range low, Early warning signs. Each shows a count and links to its patients. |
| **Category** | `/segments/<id>` | Square patient cards for the patients in that category; each card's arrows are the measurements that put them there. Clicking a card opens the patient modal. |
| **All patients** | `/patients` | A search box (name, id, age, sex, condition, device; every word must match) and a square card for every patient with arrows for all their measurements. Clicking a card opens the patient modal. |
| **Patient modal** | `?patient=<id>` on either page | See rule 24. Linkable, and the Back button closes it. |

"Not enough data" is a data-quality signal, not an abnormality, so it is not
shown on the dashboard.

Not built: routing a patient to a clinician, the EHR mock, settings, sign-in.
We add them as we go, using the rules above.

## 4. Open questions

- **Patient photos.** Stock portraits from randomuser.me stand in for now. They
  are photos of real people used as placeholders, and they need internet.
  Replace them with our own images by passing `photoUrl` to `PatientAvatar`.
- **Send to doctor.** A placeholder. When wired, it maps to the routing flow in
  `context.md` section 6.4 (worklist status changes, never risk).
- **Patient order.** Neutral order by patient id for now. A clinical-risk order
  needs the risk score, which is not built yet.

## 5. Language

Use these words the same way everywhere (UI, code, docs).

| Word | Means |
|---|---|
| **Target** | The line a measurement is judged against. Past it is red, on it is green. For BP and glucose it is a fixed value; for heart rate, HRV, breathing and SpO2 it is the patient's own usual level plus the allowed change. Never "limit", "baseline", "threshold" or "normal range" in the UI. |
| **Past target** | A measurement beyond its target in the bad direction (up or down). Shown as a red arrow. |
| **On target** | A measurement within its target. Shown as a green dot. |
| **Early warning signs** | Heart rate, HRV, breathing or SpO2 past target; an early sign before trouble. |
