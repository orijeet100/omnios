# OmniOS frontend design brief

The frontend started as a generic admin dashboard template (shadcn/ui,
Tailwind v4). This brief says what we keep from it, what we add, and the rules
every screen must follow. It exists so the UI stays consistent and so a
reviewer can check a screen against a short list.

## 1. What the template already defines (we keep this)

| Area | What is there today | Where |
|---|---|---|
| **Color** | Neutral slate palette as semantic tokens in OKLCH: `background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `ring`, `chart-1..5`, `sidebar-*`. Light and dark values for each. | `src/styles/theme.css` |
| **Font** | Inter for everything (Manrope and a system option exist but are not needed). | `index.html`, `src/styles/index.css` |
| **Radius** | One base radius, `0.625rem`. Cards use `rounded-xl`, buttons and badges `rounded-md`. | `theme.css`, `ui/card.tsx` |
| **Page title** | `text-2xl font-bold tracking-tight` | dashboard, users, tasks |
| **Section title** | `text-lg font-semibold tracking-tight` or `text-lg font-medium` | settings, chats |
| **Card title** | `font-semibold leading-none`; stat cards use `text-sm font-medium` | `ui/card.tsx`, dashboard |
| **Big number** | `text-2xl font-bold` | dashboard stat cards |
| **Body / helper** | `text-sm`, with secondary text `text-sm text-muted-foreground`; captions `text-xs text-muted-foreground` | everywhere |
| **Spacing** | Page padding `px-4 py-6`, max width `max-w-7xl`, header `h-16`, grids `gap-4`, card padding `p-6` with `gap-6` | `layout/main.tsx`, `layout/header.tsx`, `ui/card.tsx` |
| **Layout** | Inset sidebar (16rem, collapses to icons), header with sidebar trigger, content in `<Main>` | `layout/*`, `ui/sidebar.tsx` |
| **Grid** | Stat cards: 1 column, 2 at `sm`, 4 at `lg` | dashboard |
| **Status** | Badge variants `default / secondary / outline / destructive`; no success or warning color exists | `ui/badge.tsx` |
| **Dark mode** | Class-based, light / dark / system, via the theme provider | `context/theme-provider.tsx` |

## 2. Constraint rules

These are the rules we build to. They come from the table above, plus the
medical constraints in `context.md`.

### Visual

1. **Tokens only.** Use the semantic Tailwind tokens (`bg-card`,
   `text-muted-foreground`, `border`, ...). No hex, rgb or hard-coded colors,
   and no new color tokens.
2. **One font: Inter.** Numbers that line up in columns or cards use
   `tabular-nums`.
3. **Fixed type scale.** Only these sizes, with these jobs:

   | Job | Classes |
   |---|---|
   | Page title (`h1`, one per page) | `text-2xl font-bold tracking-tight` |
   | Page subtitle | `text-sm text-muted-foreground` |
   | Card title | `text-base font-semibold` |
   | Big number | `text-3xl font-bold tabular-nums` |
   | Label / body | `text-sm` (`font-medium` for labels) |
   | Caption / metadata | `text-xs text-muted-foreground` |

   No other sizes. No sizes bigger than `text-3xl`.
4. **One heading level per job.** Page title is `h1`, card titles are `h2`
   (or `h3` inside a card that already has an `h2`). Never skip a level.
5. **Spacing from the template scale.** Grids use `gap-4`, page sections
   `space-y-6`, cards keep their built-in padding. No arbitrary pixel values.
6. **Radius from the template.** Cards `rounded-xl`, badges and buttons
   `rounded-md`. No custom radii.
7. **Reuse components.** Build screens from `Card`, `Badge`, `Button`,
   `Dialog`, `Skeleton` and the sidebar parts that already exist. Icons come
   only from `lucide-react`, at `size-4`, muted. Charts use Recharts; the small
   trend lines on cards are a plain SVG `Sparkline`, because a page can show
   hundreds of them.
8. **Color is never the only signal.** Anything flagged also carries text, a
   number or an icon. `destructive` (red) is reserved for abnormal values and
   the abnormal stretch of a line. Nothing else is red.
9. **Dark mode comes free.** Because of rule 1, no `dark:` overrides in
   screens.

### Layout and interaction

10. **One shell.** Inset sidebar with two items (Dashboard, All patients), a
    sticky header with the sidebar trigger, the "Synthetic data" badge and the
    theme switch, and content in `<Main>` (max width `7xl`).
11. **Clickable means obvious.** A card that navigates is a real link; a card
    that opens a modal is a real `<button>`. Both are keyboard focusable with a
    visible focus ring, and both shift to `bg-accent` on hover.
12. **Responsive grid.** Patient tiles use 1 column on mobile, 2 from 480px,
    3 at `lg` and 4 at `xl`, with `gap-4`. Segment rows are full-width.
13. **Every list handles empty and loading.** An empty segment says so in plain
    words. Data that is slow shows a `Skeleton`, not a blank screen.

### Medical and product (from `context.md`)

14. **Label the data.** The header always shows a "Synthetic data" badge.
15. **Insight, never decision.** Copy says what changed and against what.
    It never tells a clinician what to do, never names a drug, dose or
    treatment, and never says "diagnosis".
16. **Show the basis in the chart, not in prose.** A flagged measurement is
    charted with its threshold as a dashed line ("Target 140") and its
    abnormal weeks in red, so the reader sees why without a paragraph.
17. **No dollars, no contract ranking.** No currency anywhere. Lists are in a
    neutral, fixed order, never sorted by contract value or "easiest win".
18. **Honest absence.** When there is too little data we say "Not enough data",
    never a guess or a zero.
19. **Plain language.** Short labels a care manager reads in a second. No
    jargon like "z-score" or "baseline delta" on screen.
20. **Minimal text.** Titles, labels and numbers only. No explanation
    paragraphs or helper copy on cards, rows or in modals.

### Charts

21. **One chart style.** The normal line is `--primary`, abnormal stretches are
    `--destructive` and drawn on top, the threshold is a dashed
    `--muted-foreground` line labelled outside the plot, grid lines are
    `--border`, and hovering shows a tooltip with the date and value. A day is
    abnormal when the weekly check says its week is `off`, so red always
    matches the dashboard counts.
22. **Modals show the measurement that is off.** The modal charts only the
    measurements that put the patient in the segment (all of a patient's
    abnormal ones), with two actions: Send to doctor and Dismiss.

## 3. Screens

| Screen | Route | Content |
|---|---|---|
| **Dashboard** | `/` | Title "Patients showing abnormalities", then one wide horizontal card per segment (BP above target, Glucose time in range low, Recovery signals off, Not enough data) with its count. Each links to its patients. |
| **Segment** | `/segments/<id>` | Square patient tiles for the patients who are off this week, each with small trend lines for the measurements that are off. Clicking a tile opens the patient modal (`?patient=<id>`). |
| **All patients** | `/patients` | Square tiles for every patient with a trend line per measurement (BP, glucose, heart rate, HRV, SpO2 where they have the device). A red dot marks patients with an abnormality. Clicking a tile opens the same modal. |
| **Patient modal** | `?patient=<id>` on either page | Charts of the off measurements (or the usual two for a patient with none), then Dismiss and Send to doctor. Both buttons are placeholders and do nothing yet. |

Not built: routing a patient to a clinician, the EHR mock, search, settings,
sign-in. We add them as we go, using the rules above.

## 4. Open questions

- **Patient order within a segment.** For now patients are in a neutral fixed
  order (by patient id). A clinical-risk order needs the risk score, which is
  not built yet.
- **Status colors.** The template has no success or warning color. We do not
  add one until a screen truly needs it.
- **Send to doctor and Dismiss.** Placeholders for now. When wired, they map to
  the routing flow in `context.md` section 6.4 (worklist status changes, never
  risk).
- **Data gap in the dashboard.** "Not enough data" is listed with the
  abnormality cards although it is a data-quality category, not an
  abnormality. Move it if that reads wrong.
