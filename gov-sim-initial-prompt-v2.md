# Initial Claude Code Prompt — Government Simulator (v2)

Copy everything below the line into Claude Code as your first message.

---

I'm building a government simulator game from scratch and this is our first session. Read this entire brief before writing any code. It's long because I'd rather over-specify now than untangle a mess later.

---

## 1. How to work with me

I'm a beginner at coding. I work in an executive role at a shipyard, so I'm strong on systems thinking and weak on syntax. Please:

- Explain the *why* behind each step in plain English, not just what to type.
- Give me terminal commands **one at a time, one command per message**. I'm on Windows Command Prompt and pasting multiple lines merges them into a broken command.
- When there's a real decision to make, lay out the options and give me your recommendation with reasoning.
- Don't silently install heavy dependencies or restructure folders. Tell me first.
- When something fails, explain what the error actually means before we fix it.

---

## 2. The long-term vision

A real-time grand strategy game where the player governs the United States from its founding to the present day. Structurally it's Hearts of Iron IV — a day-by-day clock that runs in real time with pause and speed controls, an event feed, and deep interlocking systems — but the subject is governing rather than commanding armies. Closer in spirit to Victoria 3 or Democracy 4 in content, HOI4 in pacing and feel.

**Core pillars:**

1. **Founding choice.** At game start the player founds the USA and chooses a government type. Monarchy: you are king and your bloodline succeeds you. Republic: you are the president. Other forms (parliamentary, federal republic, one-party state) come later.

2. **Continuous authorship.** The player persists in power the entire game regardless of who nominally holds office. Elections, successions, and cabinet turnover happen *around* the player and constrain them, but never remove them. Think of the player as the enduring will of the office rather than one officeholder.

3. **Historical pressure, not historical rails.** The real spine of US history arrives as events and crises the player must navigate: assumption of state debts, the Louisiana Purchase, sectional conflict and Civil War risk through the 1800s, industrialization, WWI, the Depression, WWII, the Cold War. Outcomes can diverge sharply from real history based on player choices. The game should never force an outcome — it should apply pressure and let consequences follow.

4. **Deep, interconnected simulation.** Real laws, real budgeting, real finance, taxation, debt service, trade, war, and administration. Economic variables must be genuinely causally linked — changing a tariff should ripple through customs revenue, trade volume, regional prosperity, sectional tension, and political stability over subsequent months, not just move a single number.

5. **Historical benchmarking.** At any moment the player can open a comparison view showing their USA against the real USA on that same date: GDP, population, federal debt, receipts and outlays, military size, and quality-of-life measures.

6. **Objective.** Steer the USA to become the greatest country of all time, scored across economic, military, diplomatic, and domestic quality-of-life dimensions.

**Tone.** Serious and grounded. This is a simulation of governance, not a comedy. Historical events are presented factually with real context; morally difficult decisions (slavery, removal, internment, segregation) are represented honestly as the consequential choices they were, without either sanitizing them or being gratuitous. When the game presents such a decision, it should include factual historical context so the player understands what actually happened.

---

## 3. Tech stack

Same stack I've used before, because it's what I can maintain:

- **Next.js (App Router) + TypeScript + Tailwind CSS**
- **Zustand** for game state in the UI layer (lightweight, avoids prop drilling, and lets us re-render selectively — this matters a lot for a ticking game)
- **Prisma + Supabase (Postgres)** for accounts and save games
- **GitHub** for version control
- **Vercel** for deployment

**Supabase/Prisma gotchas I've hit before — set these up correctly the first time:**

- Prisma needs **both** connection URLs: `DATABASE_URL` pointing at the transaction pooler on port **6543** with `?pgbouncer=true`, and `DIRECT_URL` pointing at the direct connection on port **5432**. Put both in `schema.prisma` under `datasource db`.
- If the database password contains special characters like `!`, they must be **percent-encoded** in the connection string or the URL silently breaks.
- Vercel needs explicit permission to access the GitHub repo. Handle that when we deploy.

---

## 4. What lives where (single source of truth per concern)

I care a lot about not having the same fact stored in two places where they can drift apart. Be strict about this:

| Concern | Owner | Why |
|---|---|---|
| Simulation logic & formulas | Versioned TS files in `/src/sim/` | Must be deterministic and code-reviewable |
| Game content (events, laws, policies) | Versioned data files in `/src/content/` | Editable without touching engine logic |
| Real historical benchmark data | Versioned data files in `/src/content/history/` with citations | Git-tracked, diffable, reviewable — I want to see in a pull request when a historical number changes |
| Player accounts | Supabase Auth | — |
| Save games | Supabase Postgres via Prisma | Cross-device, survives browser clears |
| In-progress session state | Browser memory + localStorage fallback | The tick loop can't hit the network every day |

Historical data stays in the repo rather than the database on purpose: it's reference data that should never change without a reviewed commit, and the game needs it instantly at every tick.

---

## 5. Architecture rules (non-negotiable)

These matter more than any feature.

1. **The simulation engine is pure TypeScript, fully isolated from React.** Everything in `/src/sim/` — no React imports, no browser APIs, no network calls. It exports plain functions. The core is:
   ```ts
   advanceDay(state: GameState, content: ContentPack): TickResult
   ```
   `TickResult` contains the new state plus a list of things that happened that day (events fired, modifiers applied, thresholds crossed).

2. **Determinism.** Same state in, same state out, always. Any randomness uses a seeded PRNG whose seed and call-count live inside `GameState`, so a save can be replayed to an identical result. No `Math.random()` anywhere in `/src/sim/`.

3. **One serializable state object.** `GameState` must `JSON.stringify` and round-trip losslessly. No class instances, no Dates (store ISO strings or day-number integers), no functions, no Maps.

4. **Content is data, not code.** Adding a new historical event must require editing only a content file — never engine logic.

5. **Modifier ledger — every number must explain itself.** Nothing mutates a stat directly. All changes flow through modifiers:
   ```ts
   interface Modifier {
     id: string;
     source: string;        // "Whiskey Tax of 1791"
     sourceType: 'law' | 'event' | 'policy' | 'structural' | 'crisis';
     target: string;        // "stability"
     value: number;
     isPercentage: boolean;
     startDay: number;
     endDay: number | null; // null = permanent
   }
   ```
   The state carries the full active modifier list, and the UI can show exactly which sources are pushing a stat up or down and by how much. This is simultaneously the best feature in the game and the only way we'll ever debug the economy.

6. **The tick loop lives outside React's render cycle.** The engine runs in a `requestAnimationFrame` or interval loop that mutates a Zustand store. The UI subscribes and re-renders at a **throttled cadence, maximum 4 times per second, independent of simulation speed**. At 5x speed the sim may process dozens of days per second — React must not attempt to render each one. Get this right early; retrofitting it is painful.

7. **The UI is a renderer.** Components read state and dispatch player actions. Zero simulation math in components.

8. **Schema versioning on saves.** `GameState` includes a `schemaVersion` integer. Saves record it. On load, if versions mismatch, either migrate or refuse cleanly with a readable message — never crash or silently load a broken state.

---

## 6. Core data model (starting sketch — refine and propose back to me)

```ts
interface GameState {
  schemaVersion: number;
  seed: number;
  rngCalls: number;
  day: number;                    // days since 1789-04-30
  governmentType: 'monarchy' | 'republic';
  ruler: Ruler;
  nation: NationStats;
  regions: Region[];
  treasury: TreasuryState;
  policies: PolicyState;
  activeModifiers: Modifier[];
  eventState: { firedEventIds: string[]; pendingDecisions: PendingEvent[] };
  log: LogEntry[];
}
```

**Regions from day one.** Even though Phase 1 has no map, the nation must be modeled as regions (New England, Mid-Atlantic, South, Frontier to start). Regional divergence in economy, population, and sentiment is what makes sectional tension and eventually the Civil War possible. Building it in later would be a rewrite.

---

## 7. Economic model requirements

Roughly 10–14 variables for Phase 1, all causally linked. Something like: population, labor force, agricultural output, manufacturing output, trade volume, GDP, tax rates (excise, tariff, land), federal receipts, federal outlays, treasury balance, national debt, debt service, stability, legitimacy.

Requirements:

- **Every formula is documented in plain English** in a comment above it, stating the causal claim it encodes. Example: "Tariff rate raises customs revenue up to a point, but above roughly 25% it suppresses trade volume enough that total receipts fall."
- **Effects propagate over time, not instantly.** A tax change should move revenue within weeks but move regional prosperity and sentiment over months. Use lagged/smoothed responses.
- **Nonlinearity and diminishing returns** where economically sensible. Linear-everything makes for boring optimization.
- **Anchor the starting values to real 1789 figures**, cited.
- Write the model in `docs/ECONOMY.md` in prose *before* implementing it. I want to review the causal logic on paper first.

---

## 8. Event system

```ts
interface GameEvent {
  id: string;
  title: string;
  historicalDate?: string;      // when it happened in reality
  triggerConditions: Condition[];
  body: string;                 // narrative framing
  historicalContext: string;    // what actually happened, factually
  sources: string[];
  options: EventOption[];
  pausesGame: boolean;
}
```

- Events with `pausesGame: true` **auto-pause the clock** when they fire. The player must never miss a decision because the game was running at 5x.
- Every option applies modifiers and may schedule follow-on events, so choices have downstream consequences rather than one-time hits.
- Each event carries a `historicalContext` field explaining what actually occurred, shown alongside the choice. This is the educational backbone of the game.

---

## 9. Historical benchmark system & data integrity

This is important to me. I've been burned by dashboards showing invented numbers, and I'd rather show a gap than a guess.

- Benchmark data lives in `/src/content/history/` as typed data with **a source citation attached to every single figure**.
- **Never fabricate a historical number.** If we lack a sourced figure for a year, the record is marked unavailable and the comparison UI shows "no verified data for this year" — never a guess, never a silently interpolated value presented as fact.
- If a value is interpolated between known data points, it carries `isInterpolated: true` and the UI labels it visibly as an estimate.
- Simulated values and real historical values must be visually distinguishable at all times — different color treatment plus a text label, not color alone.

**Suggested starting sources (verify each one and cite it precisely):**

- Federal receipts, outlays, and surplus/deficit from 1789 onward: OMB Historical Tables, Table 1.1
- Federal debt outstanding annually from 1790: US Treasury "Historical Debt Outstanding"
- Population: decennial US Census from 1790
- GDP and price-level estimates for the early period: MeasuringWorth (Johnston & Williamson)
- General reference: Historical Statistics of the United States (Cambridge)

For Phase 1 we only need 1789–1800, so this is a small, tractable dataset. Do it properly and the pattern scales.

---

## 10. UI/UX specification

### 10.1 Overall layout

A persistent three-zone game shell once a game is running:

```
┌──────────────────────────────────────────────────────────────┐
│  COMMAND BAR (fixed, ~64px)                                  │
│  Seal │ Ruler │ Date │ ⏸ 1x 2x 5x │ Treasury Debt Stability  │
├──────────┬───────────────────────────────────┬───────────────┤
│  LEFT    │                                   │  RIGHT        │
│  NAV     │        MAIN PANEL                 │  FEED         │
│  (icon+  │        (active section)           │  (chronicle   │
│  label,  │                                   │   + alerts)   │
│  ~200px) │                                   │   ~320px      │
└──────────┴───────────────────────────────────┴───────────────┘
```

- **Command bar** is always visible: national seal, ruler name and portrait slot, current date in period-appropriate long form ("14 March 1791"), clock controls, and 4–6 headline stats. Stats show value, a directional arrow, and a 90-day sparkline.
- **Left nav** sections for Phase 1: Desk (overview), Treasury, Legislation, Regions, Government, History (comparison), and Chronicle (full log). Sections show a badge dot when they need attention.
- **Right feed** is a reverse-chronological chronicle of what's happening. Two visual tiers: **informational** entries (muted, no interaction) and **decision required** entries (accented border, clickable, persistent until resolved).
- **Main panel** renders the active section. It should never scroll the whole page — internal panels scroll, the shell stays fixed.

### 10.2 Screens for Phase 1

1. **Title screen** — new game, continue, load, settings. Minimal and atmospheric.
2. **Founding screen** — the government-type choice. This should feel weighty: two large cards (Monarchy / Republic) with a description, the starting modifiers each grants, and a note on how succession works. Confirm before committing. Also collect ruler name and dynasty/party name here.
3. **The Desk (overview)** — the default view. Card grid: national vitals, treasury snapshot, current crises, active laws, upcoming scheduled events, and a "state of the union" summary paragraph generated from current state.
4. **Treasury** — the budget screen. Tax rate sliders (excise, tariff, land) on the left, spending allocation on the right, with a live projected annual balance that updates as you drag *before* you commit. Show a clear "projected" vs "current" distinction, and require an explicit Enact button — no accidental policy changes from a stray drag.
5. **Legislation** — available laws as cards, each showing cost, requirements, effects, and historical context. Locked laws show *why* they're locked.
6. **Regions** — the four regions as detail cards showing population, economy, sentiment toward the federal government, and dominant industry. No map in Phase 1 (see below).
7. **Government** — cabinet, officeholders, succession status, legitimacy breakdown.
8. **History** — the comparison view (detailed below).
9. **Chronicle** — the full filterable log of everything that has happened.
10. **Event modal** — full-screen-ish overlay, auto-pauses the game, presents narrative body, historical context, and 2–4 options each showing their known effects. Cannot be dismissed without choosing.

**On the map:** I know HOI4 is map-first. Phase 1 deliberately has **no map** — building a geographically accurate 1790 US map with evolving territorial boundaries is weeks of work that doesn't prove the core loop works. Regions are modeled in data from day one and presented as cards; an SVG map layer gets skinned on top in Phase 2 without touching the simulation. If you disagree, argue it before we start.

### 10.3 Visual design direction

Aim for a "war room ledger" feel: institutional, serious, legible under a ticking clock. Not a parchment-and-quill pastiche, and definitely not generic SaaS dashboard.

- **Palette:** deep slate/ink base (`#12151A`-ish), warm parchment for panel surfaces where content is dense, brass/gold accent for the player's authority and primary actions, muted oxblood for danger, muted green for favorable. Define everything as Tailwind theme tokens — no arbitrary hex values scattered through components.
- **Typography:** a serif for headings and event narrative (something like EB Garamond or Libre Baskerville via `next/font`) to carry the period weight, and a clean sans for UI chrome and data labels.
- **Numbers:** all numeric displays use `font-variant-numeric: tabular-nums`. This is non-negotiable — with a ticking clock, proportional numerals cause visible jitter as digits change width.
- **Density:** this is an information game. Favor compact, scannable data over generous whitespace, but keep a strict type scale so it reads as designed rather than cramped.
- **Iconography:** Lucide. Consistent stroke weight throughout.

### 10.4 Interaction and feel

- **Keyboard:** `Space` toggles pause. `1` `2` `3` set speed. `Esc` closes overlays. `Tab` order must be sane. Show a keyboard shortcut reference in settings.
- **Auto-pause** on any decision-required event, and a setting to auto-pause on crisis thresholds too.
- **Stat inspection:** hovering (or tapping) any stat opens a popover showing base value plus every contributing modifier with its source name and magnitude, summing visibly to the displayed total. This should work on *every* number in the game.
- **Number transitions:** interpolate smoothly over ~300ms rather than snapping, but never allow layout shift.
- **Feedback on commit:** enacting a policy or resolving an event produces a brief, restrained confirmation — a flash on affected stats, an entry in the chronicle. No confetti, no celebratory noise.
- **Motion:** minimal and purposeful. Panel transitions under 200ms. Respect `prefers-reduced-motion`.
- **Empty and blocked states** are written deliberately: a locked law explains its requirement, a missing benchmark explains the data gap.

### 10.5 The History comparison view

The signature feature. Design it carefully.

- Side-by-side columns: **Your America** vs **Historical America**, for the current in-game date.
- Metrics: population, GDP, GDP per capita, federal debt, federal receipts, federal outlays, military size.
- Each row shows both values, the delta as a percentage, and a small dual-line chart tracking both trajectories from 1789 to the current date.
- Rows where historical data is unavailable render as an explicit "no verified data" state with an explanation, styled distinctly — never blank, never zero.
- Every historical figure has its source citation visible on hover or in a footnote list.
- A date scrubber lets the player review any past point in the run.

### 10.6 Accessibility and responsiveness

- Never encode meaning in color alone — pair with arrows, icons, or text labels.
- Target WCAG AA contrast on all text.
- Full keyboard operability, proper ARIA on modals and live regions for the chronicle feed.
- Desktop-first (this is a dense strategy game), but the layout must not break below 1280px — collapse the right feed into a drawer.

---

## 11. Phase 1 scope — build only this

A vertical slice covering **1789-04-30 through 1800-12-31 only**. It must prove the loop works end to end.

**Acceptance criteria — Phase 1 is done when:**

1. I can create an account, start a new game, choose monarchy or republic, and name my ruler.
2. The clock ticks day by day, pauses with spacebar, and runs at 1x/2x/5x without the UI stuttering or the browser tab pegging a CPU core.
3. Setting tax rates and spending in the Treasury panel produces effects that propagate through the economy over subsequent weeks and months in ways I can trace.
4. Every stat in the game can be hovered to reveal its full modifier breakdown, and the numbers add up.
5. At least 6 real 1790s events fire on historically appropriate dates with genuine branching choices, each carrying factual historical context.
6. The History view compares my run to real 1790s data with every figure cited, and honestly marks the years where we lack data.
7. I can save to Supabase, close the browser, log back in on another machine, and resume exactly where I left off.
8. The whole thing is deployed and playable on a Vercel URL.
9. `README.md`, `DESIGN.md`, and `docs/ECONOMY.md` are accurate and current.

**Explicitly out of scope for Phase 1:** any map, military combat, foreign diplomacy, elections, AI opponents, multiplayer, anything after 1800.

---

## 12. Phase roadmap (sketch only — don't build these yet)

- **Phase 2:** SVG map layer, territorial expansion, 1800–1860, elections and succession, sectional tension mechanics
- **Phase 3:** Civil War system, military and combat, industrialization
- **Phase 4:** Foreign diplomacy, WWI, the Depression, WWII
- **Phase 5:** Cold War through present, full scoring and "greatest country" endgame evaluation

---

## 13. What to do right now, in this order

1. **Ask me your clarifying questions first.** Anything ambiguous in this brief, raise it now.
2. Write `DESIGN.md` at the project root: the full long-term vision, architecture rules, data model, and phase roadmap. Future sessions will read this to stay oriented, so make it genuinely thorough.
3. Write `docs/ECONOMY.md`: every Phase 1 variable, every formula, and every causal relationship, in plain English prose with the real 1789 starting values and their citations. No code yet.
4. Write `docs/UI.md`: wireframe descriptions of each screen and the Tailwind theme tokens you propose.
5. **Stop and wait for my approval on all three documents.**
6. Once approved: scaffold the Next.js project, set up the GitHub repo, wire Supabase and Prisma, and get a "hello world" deployed to Vercel before building any game logic. I want the deployment pipeline proven while it's still trivial to debug.
7. Then build Phase 1, engine first, UI second.

Start with step 1.
