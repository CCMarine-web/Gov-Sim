# UI.md — Interface Specification

**Status:** Draft for approval. No components written yet.
**Companion documents:** [`../DESIGN.md`](../DESIGN.md) (architecture), [`ECONOMY.md`](ECONOMY.md) (simulation model).

---

## 1. Design direction

**"War room ledger."** Institutional, serious, legible under a ticking clock. Not a parchment-and-quill pastiche, and not a generic SaaS dashboard.

The governing image is a briefing room in a government building: dark panelled walls, warm lamplight on paper, brass fittings. Information is dense because the job is dense. Nothing decorative earns its place unless it aids reading.

**Five principles, in priority order:**

1. **Legibility under motion.** The clock is always running. Anything that jitters, reflows, or forces the eye to re-find its place is a defect, not a style choice.
2. **Density with structure.** This is an information game. Favor compact, scannable data — but hold a strict type scale and spacing grid so it reads as designed rather than cramped.
3. **Every number explains itself.** The modifier breakdown (§7) is a first-class interface element, not a debug tool. It is available on every number in the game.
4. **Honesty is visible.** Simulated and historical values never look alike. Missing data looks like missing data (§9).
5. **Restraint on feedback.** Enacting a policy produces a brief flash and a chronicle entry. No confetti, no celebration. The tone is institutional.

---

## 2. Design tokens

All values are Tailwind theme tokens. **No arbitrary hex values in components** — if a color is needed that isn't here, it gets added here first.

### 2.1 Color

**Base — ink** (the shell: chrome, backgrounds, structure)

| Token | Hex | Use |
|---|---|---|
| `ink-900` | `#0D0F13` | Deepest recess; modal scrim base |
| `ink-800` | `#12151A` | **App background** (the value from the brief) |
| `ink-700` | `#1A1E26` | Raised panel background |
| `ink-600` | `#232833` | Card background on dark |
| `ink-500` | `#2E3440` | Hover / active surface |
| `ink-400` | `#3D4452` | Borders and dividers |

**Parchment** (dense content surfaces — tables, ledgers, event narrative)

| Token | Hex | Use |
|---|---|---|
| `parchment-50` | `#F5F1E8` | Lightest surface |
| `parchment-100` | `#EDE7D9` | **Primary parchment surface** |
| `parchment-200` | `#DED5C0` | Row banding, subtle fills |
| `parchment-300` | `#C9BC9F` | Borders on parchment |

**Text**

| Token | Hex | On `ink-800` | Use |
|---|---|---|---|
| `text-primary` | `#E8E4DA` | **14.41:1** | Primary text and data |
| `text-secondary` | `#A8A396` | **7.27:1** | Labels, supporting text |
| `text-muted` | `#8A857A` | **4.98:1** | De-emphasized but still readable content |
| `text-disabled` | `#6F6B61` | 3.44:1 | **Disabled states only** — never carries information |

**Brass** — the player's authority, primary actions

| Token | Hex | Contrast | Use |
|---|---|---|---|
| `brass-300` | `#D9B978` | 9.72:1 on ink-800 | Emphasis text on dark |
| `brass-400` | `#C9A227` | 7.56:1 on ink-800 | **Primary accent, buttons, active nav** |
| `brass-700` | `#7D631F` | 4.63:1 on parchment-100 | Brass text *on parchment* |
| `brass-focus` | `#E0C060` | 10.35:1 on ink-800 | Focus ring |

**Oxblood** — danger, deficit, crisis

| Token | Hex | Contrast | Use |
|---|---|---|---|
| `oxblood-300` | `#C86B60` | 4.99:1 on ink-800 | **Danger text on dark** |
| `oxblood-400` | `#A34A42` | 3.15:1 on ink-800 | Fills, borders, large text — **not body text** |
| `oxblood-600` | `#6E2C26` | 8.30:1 on parchment-100 | Danger text on parchment |

**Verdigris** — favorable, surplus

| Token | Hex | Contrast | Use |
|---|---|---|---|
| `verdigris-400` | `#6B9E78` | 5.91:1 on ink-800 | Favorable text and indicators |
| `verdigris-600` | `#3B6146` | 5.71:1 on parchment-100 | Favorable text on parchment |

**Steel** — reserved exclusively for historical/benchmark data (§9)

| Token | Hex | Contrast | Use |
|---|---|---|---|
| `steel-400` | `#7A93B8` | 5.83:1 on ink-800 | **Historical series only** |
| `steel-600` | `#45597A` | 5.75:1 on parchment-100 | Historical text on parchment |

> **All contrast ratios above were computed, not estimated.** Every value used for text meets WCAG AA (≥4.5:1 for body, ≥3:1 for large text and UI components). `ink-400` borders sit at 1.87:1 against the background and are therefore **decorative only** — a border may never be the sole carrier of meaning.

> **Steel is reserved.** No simulated value, and no UI chrome, may use a steel token. This makes "is this real history or my run?" answerable at a glance anywhere in the app. Paired with a text label in every case (§9) — never color alone.

### 2.2 Typography

Loaded via `next/font` for zero layout shift.

| Role | Family | Rationale |
|---|---|---|
| Headings, event narrative, historical context | **EB Garamond** (serif) | Carries period weight without being a costume |
| UI chrome, labels, all data | **Inter** (sans) | Neutral, excellent at small sizes, strong tabular figures |

**Type scale** — strict, no intermediate sizes.

| Token | Size / line-height | Family | Use |
|---|---|---|---|
| `display` | 28 / 32 | Serif | Founding screen, title screen |
| `h1` | 22 / 28 | Serif | Screen titles, event titles |
| `h2` | 17 / 24 | Serif | Card titles, event body lead |
| `label` | 11 / 14, uppercase, `tracking-wider` | Sans | Section and field labels |
| `body` | 14 / 20 | Sans | UI text |
| `body-serif` | 15 / 24 | Serif | Event narrative and historical context only |
| `small` | 12.5 / 16 | Sans | Secondary/supporting text |
| `data-lg` | 24 / 28 | Sans | Command bar headline stats |
| `data-md` | 17 / 20 | Sans | Card primary figures |
| `data-sm` | 13 / 16 | Sans | Table cells |

**Numerals — non-negotiable.** Every numeric display carries `font-variant-numeric: tabular-nums`. With a ticking clock, proportional numerals cause visible width jitter as digits change. This is enforced by putting it on a shared `<Stat>` primitive rather than trusting per-component discipline, and by an ESLint rule flagging raw numeric interpolation in JSX outside that primitive.

### 2.3 Spacing and density

Base unit **4px**. Allowed steps: `1(4) 2(8) 3(12) 4(16) 6(24) 8(32) 12(48)`.

Density targets:
- Card internal padding: `12px` (not 24 — this is a dense game)
- Table row height: `28px`
- Gap between cards in a grid: `12px`
- Left nav item height: `36px`

### 2.4 Borders, radii, elevation

- Radii: `2px` default, `4px` for cards and modals. Nothing more rounded — softness reads as consumer software.
- Borders: `1px solid ink-400` on dark; `1px solid parchment-300` on parchment.
- **No drop shadows on dark surfaces** — they read as mud. Elevation is expressed by background lightness step (`ink-800 → ink-700 → ink-600`).
- Modals are the sole exception: `ink-900` scrim at 70% opacity plus a `brass-400` top border on the dialog.

### 2.5 Motion

| Interaction | Duration | Notes |
|---|---|---|
| Panel / section transition | 160ms | Under the 200ms budget |
| Number interpolation | 300ms | Ease-out; **never causes layout shift** (tabular numerals + fixed-width containers) |
| Commit flash on a stat | 400ms | Brass wash, fades out |
| Popover open | 100ms | Near-instant; this is an inspection tool |
| Modal enter | 180ms | Fade + 4px rise |

**`prefers-reduced-motion: reduce`** disables number interpolation (values snap), disables the rise on modals, and reduces all transitions to opacity-only at 80ms. Nothing becomes unusable.

---

## 3. Where the tokens live

> **Implementation note (corrected 2026-08-15).** This section originally
> proposed a `tailwind.config.ts`. The project scaffolded onto **Tailwind CSS
> v4**, which is configured **in CSS** rather than in a JavaScript config file.
> The tokens are identical; only the declaration site changed. There is no
> `tailwind.config.ts` in this project and there should not be one.

Tokens are declared in **`src/app/globals.css`** inside an `@theme` block.
Tailwind generates the utilities automatically — `--color-brass-400` yields
`bg-brass-400`, `text-brass-400`, `border-brass-400`, and so on.

```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  --color-ink-800: #12151a;          /* -> bg-ink-800, text-ink-800, ... */
  --color-parchment-100: #ede7d9;
  --color-brass-400: #c9a227;
  --color-steel-400: #7a93b8;        /* HISTORICAL DATA ONLY */
  --color-content-primary: #e8e4da;

  --font-serif: var(--font-garamond), Georgia, serif;
  --font-sans: var(--font-inter), system-ui, sans-serif;

  --text-display: 28px;
  --text-display--line-height: 32px;

  --radius-card: 4px;
}
```

The full token set is in `src/app/globals.css`, annotated with the measured
contrast ratio for each color and its permitted use. **That file is the
implementation of §2 and the two must agree.**

Also defined there:

- **`@utility tabular`** — applies `font-variant-numeric: tabular-nums`. Used by
  the shared `<Stat>` primitive so it cannot be forgotten per call site (§2.2).
- **`:focus-visible`** — a 2px `brass-focus` ring, never removed (§10).
- **`prefers-reduced-motion`** — the reduced-motion behavior described in §2.5.

**Verification.** After a production build, the compiled CSS was checked to
confirm the tokens actually resolve rather than silently producing nothing —
`c9a227`, `12151a`, `ede7d9`, `7a93b8`, `tabular-nums`, `font-garamond`, and the
reduced-motion query were all confirmed present in the output. Worth repeating
whenever tokens are added, because an unrecognized Tailwind class fails quietly.

---

## 4. The shell

Persistent three-zone layout once a game is running. **The shell never scrolls — internal panels do.**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ COMMAND BAR                                                    fixed, 64px │
│ ┌──────┐                                                                   │
│ │ SEAL │  Gen. Washington        ⏸  1x  2x  5x     TREASURY   DEBT   STAB. │
│ │      │  President · Federalist                   $1.24M    $71.1M   55   │
│ └──────┘  14 March 1791                            ▲ ╱‾╲╱‾   ▬ ‾‾╲   ▼ ╲__ │
├──────────┬──────────────────────────────────────────────┬──────────────────┤
│ LEFT NAV │              MAIN PANEL                      │   RIGHT FEED     │
│  200px   │              (active section)                │      320px       │
│          │                                              │                  │
│ ▸ Desk   │                                              │ ┌──────────────┐ │
│ ▸ Treas.•│                                              │ │▌DECISION     │ │
│ ▸ Legis. │                                              │ │ Assumption   │ │
│ ▸ Regions│                                              │ │ of State Debt│ │
│ ▸ Gov't  │                                              │ └──────────────┘ │
│ ▸ History│                                              │  14 Mar · Customs│
│ ▸ Chron. │                                              │  receipts rose…  │
│          │                                              │  12 Mar · The    │
│          │                                              │  excise bill…    │
└──────────┴──────────────────────────────────────────────┴──────────────────┘
```

### 4.1 Command bar (fixed, 64px)

Left → right: national seal · ruler name and title (portrait slot reserved) · **current date in period-appropriate long form ("14 March 1791")** · clock controls · 4–6 headline stats.

Each headline stat shows **value + directional arrow + 90-day sparkline**. Arrow and sparkline are both present so direction is never conveyed by color alone.

Clock controls: `⏸ / ▶` then `1x 2x 5x`. Active speed has a brass underline *and* `aria-pressed`. When the game is auto-paused by an event, the pause control shows a distinct **"PAUSED — DECISION REQUIRED"** state in oxblood so the player understands *why* they are paused.

Headline stats for Phase 1: Treasury balance, National debt, Stability, Legitimacy, Population, GDP.

### 4.2 Left nav (200px)

Icon + label, 36px rows. Sections: **Desk · Treasury · Legislation · Regions · Government · History · Chronicle.**

A section showing a **badge dot** needs attention (pending decision, unaffordable budget, newly unlocked law). The dot is brass, paired with an `aria-label` suffix ("Treasury, 1 item needs attention") — never color alone.

### 4.3 Right feed (320px)

Reverse-chronological chronicle. **Two visual tiers, deliberately unlike each other:**

- **Informational** — muted, no border, `text-secondary`, not interactive. Date prefix, one or two lines.
- **Decision required** — `parchment-100` background, 3px `brass-400` left border, clickable, and **persistent until resolved**. It does not scroll away.

The feed is an ARIA live region (`aria-live="polite"`) so new entries are announced. Decision entries are `role="alert"`.

Below 1280px the feed collapses into a drawer with a badge count on its toggle (§11).

### 4.4 Main panel

Renders the active section. Internal panels scroll independently; the shell stays fixed.

---

## 5. Screens

### 5.1 Title screen

Minimal and atmospheric. `ink-900` field, the seal, the title in `display` serif, and a short vertical stack of actions.

```
                        ┌────────────┐
                        │    SEAL    │
                        └────────────┘

                   THE AMERICAN EXPERIMENT
                    a government simulator

                      ▸  New Game
                      ▸  Continue          (hidden if no save)
                      ▸  Load Game
                      ▸  Settings

                  ── not signed in ──
                  Playing as guest. Sign in to
                  save across devices.        [Sign in]
```

The guest-play notice (per `DESIGN.md` §11.2) is persistent but quiet. It states the actual consequence rather than nagging.

### 5.2 Founding screen

This must feel weighty. Two large cards, side by side, with a confirmation step.

```
┌────────────────────────────────────────────────────────────────────────┐
│                     30 April 1789 · New York                           │
│         The Constitution is ratified. The office is yours to shape.    │
│                                                                        │
│  ┌────────────────────────────┐   ┌────────────────────────────┐       │
│  │  MONARCHY                  │   │  REPUBLIC                  │       │
│  │  ────────                  │   │  ────────                  │       │
│  │  You are King. Authority   │   │  You are President. Auth-  │       │
│  │  rests in your person and  │   │  ority is granted by con-  │       │
│  │  passes to your bloodline. │   │  sent and must be renewed. │       │
│  │                            │   │                            │       │
│  │  AT FOUNDING               │   │  AT FOUNDING               │       │
│  │  Legitimacy         50     │   │  Legitimacy         70     │       │
│  │  New England    −  hostile │   │  New England    +  warm    │       │
│  │  Mid-Atlantic   −  hostile │   │  Mid-Atlantic   +  warm    │       │
│  │  South          +  favor.  │   │  South          ~  neutral │       │
│  │                            │   │                            │       │
│  │  OVER TIME                 │   │  OVER TIME                 │       │
│  │  ▪ Legitimacy does not     │   │  ▪ Legitimacy decays un-   │       │
│  │    decay                   │   │    less renewed by results │       │
│  │  ▪ Unilateral action costs │   │  ▪ Unpopular laws cost     │       │
│  │    less                    │   │    more political capital  │       │
│  │  ▪ Mishandled crises cost  │   │  ▪ Crises are absorbed     │       │
│  │    far more                │   │    more gracefully         │       │
│  │                            │   │                            │       │
│  │  SUCCESSION                │   │  SUCCESSION                │       │
│  │  Your heir inherits.       │   │  Elections are held.       │       │
│  │  (Phase 2)                 │   │  (Phase 2)                 │       │
│  │                            │   │                            │       │
│  │        [ Choose ]          │   │        [ Choose ]          │       │
│  └────────────────────────────┘   └────────────────────────────┘       │
│                                                                        │
│  Whichever you choose, you remain in power for the whole game.         │
│  Office-holders change around you; you do not.                        │
└────────────────────────────────────────────────────────────────────────┘
```

After choosing, a confirmation step collects **ruler name** and **dynasty name** (monarchy) or **party name** (republic), restates the choice, and requires an explicit **Found the Nation** action. The choice cannot be changed afterward, and the screen says so.

The starting-modifier figures shown here are read from the content pack, not hardcoded in the component (Rule 7).

### 5.3 The Desk (default view)

Card grid. The card set is fixed; contents are generated from state.

```
┌─────────────────────┬─────────────────────┬─────────────────────┐
│ NATIONAL VITALS     │ TREASURY SNAPSHOT   │ CURRENT CRISES      │
│ Population 3.94M ▲  │ Balance    $1.24M   │ ▌ Frontier unrest   │
│ GDP      $193.0M ▲  │ Receipts/yr $4.42M  │   compliance 61 ▼   │
│ GDP/head    $49 ▬   │ Outlays/yr  $3.90M  │                     │
│ Stability     55 ▼  │ ── Projected ────── │ (empty state:       │
│ Legitimacy    70 ▬  │ Balance   +$0.52M ▲ │  "No active crises."│
│ Sect. tension 20 ▲  │ Debt      $71.06M   │  — deliberate, not  │
│                     │ Service    $2.84M   │  blank)             │
├─────────────────────┴─────────┬───────────┴─────────────────────┤
│ ACTIVE LAWS                   │ UPCOMING                        │
│ ▪ Tariff Act of 1789          │ 1 Jan 1791 · Annual accounts    │
│ ▪ Judiciary Act of 1789       │ ~Mar 1791 · Excise proposal     │
│                               │           expected              │
├───────────────────────────────┴─────────────────────────────────┤
│ STATE OF THE UNION                                              │
│ The Treasury runs a modest surplus. Federal credit is untested. │
│ New England and the Mid-Atlantic are broadly supportive; the    │
│ frontier is restive and remits less than it owes. The debt      │
│ assumed from the states remains the central unresolved question.│
└─────────────────────────────────────────────────────────────────┘
```

The **state of the union** paragraph is generated from current state by a pure function in `/src/sim/` (Rule 7), assembled from templated clauses selected by threshold. It is prose, not a stat dump, and it names the one or two things that most need attention.

### 5.4 Treasury

The budget screen. Left: tax rates. Right: spending. Bottom: live projection.

```
┌───────────────────────────────┬─────────────────────────────────┐
│ TAXATION                      │ SPENDING                        │
│                               │                                 │
│ Tariff (avg. ad valorem)      │ Debt service    $2.84M  (fixed) │
│   5.0%  ──●─────────────  40% │   Non-discretionary             │
│   Customs revenue $3.71M      │                                 │
│   ⚠ receipts peak at 25%      │ Military        $0.62M          │
│                               │   ──●───────────────            │
│ Excise (distilled spirits)    │                                 │
│   0.0%  ●───────────────  30% │ Civil admin.    $0.31M          │
│   Excise revenue    $0.00M    │   ─●────────────────            │
│   ⚠ frontier compliance 61    │                                 │
│                               │ Infrastructure  $0.13M          │
│ Land tax                      │   ●─────────────────            │
│   0.0%  ●───────────────  10% │                                 │
│   Land revenue      $0.00M    │                                 │
│   ⚠ resented in every region  │                                 │
├───────────────────────────────┴─────────────────────────────────┤
│  CURRENT              PROJECTED (annual)          CHANGE        │
│  Receipts  $4.42M     Receipts  $5.18M            +$0.76M ▲     │
│  Outlays   $3.90M     Outlays   $3.90M                 ▬        │
│  Balance  +$0.52M     Balance  +$1.28M            +$0.76M ▲     │
│                                                                 │
│  Both columns simulated forward over the same 365 days by the   │
│  game's own engine, so they are directly comparable. Lagged      │
│  sentiment and compliance ARE included.             [ ENACT ]   │
└─────────────────────────────────────────────────────────────────┘
```

**Interaction requirements:**

- Dragging a slider updates **projected** figures live. It changes nothing in the simulation.
- **Current** and **Projected** are visually distinct — Current in `text-primary`, Projected in `brass-300` with a "PROJECTED" label.
- **An explicit `ENACT` button is required.** No policy changes from a stray drag. `ENACT` is disabled and shows "No changes to enact" when nothing is pending.
- A **Revert** action discards pending changes.
- The tariff slider marks the 25% revenue peak (§`ECONOMY.md` 7.5) directly on its track, because that's a real feature of the model the player deserves to be able to see.
- The warnings under each slider are generated from current state — frontier compliance is shown next to the excise because that is the variable that will eat the revenue.
- **The projection is the real engine, not a second formula.** Dragging a slider clones the state, enacts the proposed policy through the same `enactPolicy` the button calls, and runs `advanceDay` forward 365 days. It is debounced (180ms), never simplified. Two calculations of the same quantity drift apart, and the one on this screen — the one the player decides from — would be the liar.

  > **Corrected during implementation.** This section originally said the projection excludes lagged sentiment and compliance effects, and that admitting so was the honest thing to do. That is no longer true: because the projection is a genuine forward simulation, those effects *are* included. Raise the excise and the projected receipts already account for the frontier refusing to pay. The screen copy was updated to match. See `DECISIONS.md` D-004.

- **Both columns are simulated over the same horizon.** Comparing a forward-simulated proposal against today's un-simulated actuals would attribute a year of ordinary drift to the player's slider.

- **Enacting has a political price, shown before you commit.** A tax rise costs legitimacy through the modifier ledger, and a monarchy pays less than a republic for the same rise — the mechanical expression of §9.2's "cost of unilateral action". The cost is stated under the projection before the player presses Enact, and afterwards appears as a named line in the Legitimacy breakdown. See `DECISIONS.md` D-001.

### 5.5 Legislation

Available laws as cards.

```
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│ FUNDING ACT OF 1790              │  │ BANK OF THE UNITED STATES     🔒 │
│ Fiscal                           │  │ Fiscal                           │
│                                  │  │                                  │
│ Assume the war debts of the      │  │ Charter a national bank to hold  │
│ several states into the federal  │  │ federal deposits and issue notes.│
│ debt.                            │  │                                  │
│                                  │  │ LOCKED                           │
│ COST        $0.00M               │  │ ▪ Requires: Funding Act of 1790  │
│ EFFECTS                          │  │   enacted                        │
│ + Federal credit rating          │  │ ▪ Requires: date on or after     │
│ + Legitimacy                     │  │   1 January 1791                 │
│ − Southern sentiment             │  │                                  │
│ + Debt  +$21.5M                  │  │                                  │
│                                  │  │                                  │
│ ▸ Historical context             │  │ ▸ Historical context             │
│                    [ ENACT ]     │  │                    [ locked ]    │
└──────────────────────────────────┘  └──────────────────────────────────┘
```

**Locked laws state exactly why**, generated from the failing conditions via the `describe()` implementation on each condition kind (`DESIGN.md` §7.2). "Requires the Funding Act of 1790" is infinitely more useful than a padlock.

`▸ Historical context` expands to serif body text with source citations.

### 5.6 Regions

Four detail cards.

```
┌─────────────────────────────────────────────────────────────────┐
│ THE FRONTIER                          Kentucky, SW Territory    │
│                                                                 │
│ Population        109,368  ▲ 11.4%/yr                           │
│   of whom enslaved 15,847  (14.5%)                              │
│ Labor force        44,700                                       │
│                                                                 │
│ Prosperity      40 ▬  ████░░░░░░                                │
│ Sentiment      −18 ▼  ███░░░░░░░   hostile                      │
│ Compliance      61 ▼  ██████░░░░   remitting below assessment   │
│                                                                 │
│ Dominant industry   Subsistence farming, distilling             │
│ Output            $2.1M agricultural · $0.1M manufacturing      │
│                                                                 │
│ TAX EXPOSURE                                                    │
│   Tariff  ▪░░░░  low      Excise  ▪▪▪▪▪ very high               │
│   Land    ▪▪▪░░  high                                           │
│                                                                 │
│ ▸ Why is sentiment falling?    ▸ Historical context             │
└─────────────────────────────────────────────────────────────────┘
```

- Bars are paired with numerals and a word ("hostile", "very high") so meaning never rests on the bar or its color alone.
- **"Why is sentiment falling?"** opens the modifier breakdown for that region's sentiment — the §7 popover, in a panel.
- The **tax exposure** row is the model's causal core made visible. A player who reads this card understands why the excise is a frontier problem before it becomes one.

**On the presentation of enslaved population** (required by `ECONOMY.md` §7.16): the figure is displayed as demographic fact, indented under total population, with a share percentage and a link to historical context. **No affordance in the interface operates on this number** — there is no slider, no policy control, and no optimization hint attached to it. It appears in the Regions view and the History view as a population statistic with context, and nowhere else.

### 5.7 Government

Cabinet, officeholders, succession status, legitimacy breakdown.

```
┌───────────────────────────────┬─────────────────────────────────┐
│ THE OFFICE                    │ LEGITIMACY            70  ▬     │
│ George Washington             │                                 │
│ President · Federalist        │ Base                     50     │
│ Age 57                        │ Republican founding      +20     │
│ In office since 30 Apr 1789   │ Ratification goodwill    +12     │
│                               │ Republican decay         −7      │
│ SUCCESSION                    │ Frontier unrest          −5      │
│ Elections begin in Phase 2.   │ ─────────────────────────────    │
│ You remain in power           │ Total                    70      │
│ regardless of who holds       │                                 │
│ office.                       │ ▸ full history                  │
├───────────────────────────────┴─────────────────────────────────┤
│ CABINET                                                         │
│ Treasury      Alexander Hamilton      appointed 11 Sep 1789     │
│ State         Thomas Jefferson        appointed 22 Mar 1790     │
│ War           Henry Knox              appointed 12 Sep 1789     │
│ Attorney Gen. Edmund Randolph         appointed 26 Sep 1789     │
└─────────────────────────────────────────────────────────────────┘
```

The legitimacy breakdown is the modifier ledger rendered as a first-class panel rather than a hover popover — it is important enough to have a permanent home, and it demonstrates the ledger to a player who hasn't discovered hovering yet.

Cabinet in Phase 1 is historical flavor with no mechanical effect; the panel exists so Phase 2 has somewhere to put appointments.

### 5.8 History — the comparison view

The signature feature.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ COMPARISON · 14 March 1791                                              │
│ ├──────────────●────────────────────────────────────────────────┤       │
│ 1789                                                          1800      │
│                                                    (date scrubber)      │
├───────────────────┬──────────────────┬──────────────┬───────────────────┤
│ METRIC            │ YOUR AMERICA     │ HISTORICAL   │ TRAJECTORY        │
│                   │ ▪ simulated      │ ▫ historical │                   │
├───────────────────┼──────────────────┼──────────────┼───────────────────┤
│ Population        │ 4,061,220        │ 3,929,326    │  ╱▪               │
│                   │                  │ 1790 Census  │ ╱▫                │
│                   │      +3.4% ▲     │ ⓘ            │                   │
├───────────────────┼──────────────────┼──────────────┼───────────────────┤
│ GDP (nominal)     │ $204.1M          │ $210M        │   ╱▫              │
│                   │                  │ 1791         │  ╱▪               │
│                   │      −2.8% ▼     │ ⓘ            │                   │
├───────────────────┼──────────────────┼──────────────┼───────────────────┤
│ Federal debt      │ $71.06M          │ $77.23M      │  ▫‾‾              │
│                   │                  │ 1 Jan 1792   │  ▪__              │
│                   │      −8.0% ▼     │ ⓘ            │                   │
├───────────────────┼──────────────────┼──────────────┼───────────────────┤
│ Federal receipts  │ $4.42M           │ ─────────────────────────────────│
│                   │                  │ NO VERIFIED DATA                 │
│                   │                  │ Annual receipts for the 1790s    │
│                   │                  │ are not available in any source  │
│                   │                  │ we can cite. OMB Table 1.1       │
│                   │                  │ aggregates 1789–1849 into a      │
│                   │                  │ single figure.          ⓘ why    │
├───────────────────┼──────────────────┼──────────────┼───────────────────┤
│ Federal outlays   │ $3.90M           │ NO VERIFIED DATA                 │
├───────────────────┼──────────────────┼──────────────┼───────────────────┤
│ Military size     │ —                │ NO VERIFIED DATA                 │
│                   │ not simulated    │ not researched (Phase 3)         │
│                   │ in Phase 1       │                                  │
└───────────────────┴──────────────────┴──────────────┴───────────────────┘

  SOURCES
  Population · 1790 United States Census, US Census Bureau
  GDP · Johnston & Williamson, "What Was the U.S. GDP Then?", MeasuringWorth
  Federal debt · US Treasury Fiscal Data, "Historical Debt Outstanding"
```

**Requirements:**

- **Your America** in `brass`, marked ▪ and labeled "simulated". **Historical** in `steel`, marked ▫, dashed line, labeled "historical". Shape + label + color, never color alone (§9).
- Each historical figure shows **the date of the figure it is quoting** ("1 Jan 1792"), because with annual data the value shown is rarely from today.
- **Rows without data render the explicit unavailable state** — never blank, never zero, and with an explanation of *why* the data is missing. The receipts row above shows the real gap documented in `ECONOMY.md` §3.1.
- The ⓘ affordance reveals the full citation. Sources are also listed as a footnote block.
- The **date scrubber** re-renders the whole table for any past date in the run, reading from `state.series`.
- No interpolation in Phase 1 — where the census gap exists, the historical line shows a labeled break rather than being drawn through (`DESIGN.md` §12.4).

### 5.9 Chronicle

The full filterable log.

```
┌─────────────────────────────────────────────────────────────────┐
│ CHRONICLE          [ All ] Treasury  Legislation  Regions  Events│
│                    Search: ▁▁▁▁▁▁▁▁▁▁▁▁                          │
├─────────────────────────────────────────────────────────────────┤
│ 14 Mar 1791 · TREASURY                                          │
│   Customs receipts for the quarter exceeded estimate by $0.11M. │
│                                                                 │
│ 12 Mar 1791 · LEGISLATION  ▌decision                            │
│   The excise on distilled spirits was enacted.                  │
│   → You chose: Enact at 9 cents per gallon                      │
│                                                                 │
│  4 Mar 1791 · SYSTEM                                            │
│   Vermont admitted as the fourteenth state.                     │
└─────────────────────────────────────────────────────────────────┘
```

Filter by category, filter by tier, and free-text search. Decision entries record **which option was chosen**, so the chronicle is a readable account of the player's run rather than a system log.

### 5.10 Event modal

Auto-pauses the game. Cannot be dismissed without choosing.

```
                    ┌──────────────────────────────────────────┐
                    │  4 March 1791                            │
                    │  THE EXCISE ON DISTILLED SPIRITS         │
                    │  ──────────────────────────────────────  │
                    │                                          │
                    │  The Secretary of the Treasury proposes  │
                    │  an excise upon distilled spirits to     │
                    │  service the assumed debt. Representa-   │
                    │  tives from the western counties warn    │
                    │  that whiskey is not a luxury there but  │
                    │  the only means by which grain reaches   │
                    │  market at all.                          │
                    │                                          │
                    │  ▸ WHAT ACTUALLY HAPPENED                │
                    │  Congress passed the excise on 3 March   │
                    │  1791. Resistance in western Pennsyl-    │
                    │  vania grew over three years into the    │
                    │  Whiskey Rebellion of 1794, which        │
                    │  Washington suppressed by leading        │
                    │  approximately 13,000 militia west —     │
                    │  the only time a sitting president has   │
                    │  commanded troops in the field.          │
                    │  Sources: ⓘ ⓘ                            │
                    │                                          │
                    │  ┌────────────────────────────────────┐  │
                    │  │ Enact at the full proposed rate    │  │
                    │  │ Strengthens federal credit         │  │
                    │  │ Angers frontier distillers         │  │
                    │  └────────────────────────────────────┘  │
                    │  ┌────────────────────────────────────┐  │
                    │  │ Enact at a reduced rate            │  │
                    │  │ Modest revenue; less resentment    │  │
                    │  └────────────────────────────────────┘  │
                    │  ┌────────────────────────────────────┐  │
                    │  │ Decline to tax spirits             │  │
                    │  │ Preserves frontier goodwill        │  │
                    │  │ Debt service must be met elsewhere │  │
                    │  └────────────────────────────────────┘  │
                    └──────────────────────────────────────────┘
```

**Requirements:**

- The game is **already paused** before the modal renders (`DESIGN.md` §6.3). The modal does not request a pause; it is a consequence of one.
- Narrative body in `body-serif`. **"What actually happened"** is a distinct, always-present block in `parchment-100` — visually separated from the fiction so the player always knows which is which. This is the educational backbone and it is never collapsed by default on first view.
- Options show **authored plain-English effects** (`previewedEffects`), not raw numbers.
- Options failing their requirements render disabled **with the reason stated**.
- `Esc` does **not** close it. Focus is trapped. `role="dialog"`, `aria-modal="true"`, labelled by the title.
- After choosing, a brief brass flash on affected command-bar stats, a chronicle entry, and the clock stays paused until the player resumes — the player decides when to restart time, not the game.

---

## 6. Empty and blocked states

Written deliberately, never generic.

| Situation | Copy |
|---|---|
| No active crises | "No active crises. The republic is quiet." |
| Law locked | The specific unmet requirements, generated from conditions |
| No historical data | "No verified data for this year," plus *why* |
| No saves | "No saved games. Start a new game to begin." |
| Nothing to enact | "No changes to enact." (button disabled) |
| Metric not simulated in Phase 1 | "Not simulated in Phase 1." |

---

## 7. The stat popover

The most important cross-cutting element. **It works on every number in the game.**

```
        Stability  55 ▼
        ┌────────────────────────────────────┐
        │ STABILITY                     55   │
        │ ──────────────────────────────────  │
        │ Base                          50   │
        │ Mean regional sentiment       +6   │
        │   law · Tariff Act of 1789    −2   │
        │   event · Ratification        +8   │
        │ Sectional tension             −3   │
        │ Legitimacy (70)               +4   │
        │ crisis · Frontier unrest      −2   │
        │ ──────────────────────────────────  │
        │ Total                         55   │
        │                                    │
        │ Moving toward 51 · ~3 month lag    │
        └────────────────────────────────────┘
```

**Requirements:**

- Every contributing modifier, with its **source name** and magnitude, **summing visibly to the displayed total**. If the arithmetic shown does not equal the displayed value, that is a bug and there is a test for it (`DESIGN.md` §15).
- Modifiers grouped and labeled by `sourceType`.
- Where the stat is lagged, the popover shows **the target it is moving toward and the time constant** — this is how the player learns that policy effects take months, which is otherwise invisible and maddening.
- Opens on hover (desktop) or tap (touch), and on keyboard focus. Dismisses on `Esc` or blur.
- Implemented once as a `<Stat>` primitive wrapping every number, which is also where `tabular-nums` is enforced.

---

## 8. Interaction and keyboard

| Key | Action |
|---|---|
| `Space` | Toggle pause |
| `1` `2` `3` | Set speed 1x / 2x / 5x |
| `Esc` | Close overlays — **except the event modal** |
| `Tab` | Sane order: command bar → nav → main → feed |
| `?` | Keyboard reference |

- Shortcuts are suppressed while a text input has focus.
- A full keyboard shortcut reference lives in Settings and on `?`.
- **Auto-pause** on any decision-required event (always) and on crisis thresholds (a setting, default on).
- **Feedback on commit:** brief brass flash on affected stats, plus a chronicle entry. Nothing celebratory.

---

## 9. Presenting simulated vs. historical data

A hard interface rule derived from `DESIGN.md` §12.

| | Simulated | Historical |
|---|---|---|
| Color | `brass` | `steel` (reserved; used for nothing else) |
| Line style | Solid | Dashed |
| Marker | ▪ filled | ▫ open |
| Label | "simulated" | "historical" |

**All four channels are always used together.** A colorblind player, a greyscale screenshot, and a screen reader user each receive the distinction through a channel that survives their context.

Missing data is never rendered as `0`, `—` alone, or an empty cell. It renders as a labeled unavailable state carrying the reason.

Interpolated values, if ever used, carry `isInterpolated` and are labeled "estimated" inline — not only in a legend.

---

## 10. Accessibility

- **Never encode meaning in color alone.** Every status color is paired with an arrow, icon, or word. Verified through the whole spec above.
- **WCAG AA contrast on all text** — computed and tabulated in §2.1, with two colors adjusted to pass rather than documented as failing.
- **Full keyboard operability**, including the stat popover.
- **ARIA:** `role="dialog"` + `aria-modal` + focus trap on modals; `aria-live="polite"` on the chronicle feed; `role="alert"` on decision entries; `aria-pressed` on speed controls; descriptive `aria-label` on nav badge dots.
- **Focus visible everywhere** — 2px `brass-focus` ring (10.35:1), never removed.
- **`prefers-reduced-motion`** honored per §2.5.
- Sparklines are decorative duplicates of adjacent numerals and are `aria-hidden`; the number and its arrow carry the meaning.

---

## 11. Responsiveness

Desktop-first — this is a dense strategy game — but **the layout must not break below 1280px.**

| Breakpoint | Behavior |
|---|---|
| ≥1600px | Full three-zone shell; main panel gets the extra width |
| 1280–1599px | Full shell; feed narrows to 280px; Desk grid drops to 2 columns |
| <1280px | **Right feed collapses into a drawer** with a badge count on its toggle. Nav collapses to icons with tooltips. Desk grid single column. |
| <900px | Not a target for Phase 1. Layout remains usable but is not optimized; no claim is made about it. |

The command bar never collapses — the clock, the date, and the pause state must be visible at every width.

---

## 12. Component inventory

Built roughly in this order.

**Primitives:** `<Stat>` (tabular numerals + popover; the most important component in the app) · `<Sparkline>` · `<Panel>` · `<Card>` · `<Button>` · `<Slider>` · `<Popover>` · `<Modal>` · `<Bar>` · `<SourceCitation>` · `<UnavailableData>`

**Shell:** `<CommandBar>` · `<ClockControls>` · `<LeftNav>` · `<ChronicleFeed>` · `<FeedEntry>`

**Screens:** `<TitleScreen>` · `<FoundingScreen>` · `<Desk>` · `<Treasury>` · `<Legislation>` · `<Regions>` · `<Government>` · `<History>` · `<Chronicle>` · `<EventModal>`

---

## 13. Open questions

1. **National seal artwork.** Placeholder geometric mark for Phase 1, or commission/source something? A weak seal will undercut the title and founding screens more than its size suggests.
2. **Ruler portraits.** `portraitId` exists in the schema but Phase 1 has no art. Proposal: a monogram plate in brass on ink — restrained, and better than an empty frame.
3. **Sparkline window.** The brief specifies 90 days. At 1x that is 90 seconds of play — possibly too short to read as a trend. Worth revisiting once the loop is running and it can actually be felt.
4. **`EB Garamond` at 11px label size** may be too delicate; the spec already assigns labels to Inter, but the founding and event screens should be reviewed on a real display before locking the pairing.
