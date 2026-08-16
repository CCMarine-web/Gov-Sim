# DESIGN.md — Government Simulator

**Status:** Draft for approval (Phase 1 not yet implemented)
**Last updated:** 2026-08-15
**Companion documents:** [`docs/ECONOMY.md`](docs/ECONOMY.md) (simulation model), [`docs/UI.md`](docs/UI.md) (interface specification)

---

## 0. How to use this document

This is the orienting document for the project. Any future session — human or AI — should read this file first and treat it as authoritative on **vision, architecture, and data model**. It deliberately repeats some context so it can be read standalone.

Where this document and the code disagree, that is a bug in one of them. Fix it in the same commit that caused the drift.

Three documents own three concerns, and nothing is duplicated between them:

| Document | Owns |
|---|---|
| `DESIGN.md` (this file) | Vision, architecture rules, data model, systems design, roadmap |
| `docs/ECONOMY.md` | Every simulation variable, formula, causal claim, and calibration constant |
| `docs/UI.md` | Screen-by-screen interface specification |
| `docs/THEMING.md` | Design tokens, skins, the asset registry, the audio bus, interface copy |

---

## 1. Vision

A real-time grand strategy game in which the player governs the United States from its founding to the present day.

Structurally the reference is **Hearts of Iron IV**: a day-by-day clock running in real time with pause and speed controls, an event feed, and deep interlocking systems. The subject, though, is governing rather than commanding armies — closer in content to **Victoria 3** or **Democracy 4**, but with HOI4's pacing and feel.

The player begins on **30 April 1789** — the day George Washington was inaugurated — founds the United States, chooses a form of government, and steers the nation forward. The objective is to make the USA the greatest country of all time, scored across economic, military, diplomatic, and domestic quality-of-life dimensions.

### 1.1 Design pillars

**1. Founding choice.**
At game start the player founds the USA and chooses a government type. In a **monarchy** the player is king and their bloodline succeeds them. In a **republic** the player is president. Other forms — parliamentary, federal republic, one-party state — arrive in later phases. The choice must have real mechanical teeth, not just different flavor text. See §9.

**2. Continuous authorship.**
The player persists in power for the entire game regardless of who nominally holds office. Elections, successions, and cabinet turnover happen *around* the player and constrain them, but never remove them. The player is not one officeholder; the player is the enduring will of the office. This has a direct architectural consequence: **there is no game-over screen.** See §10.

**3. Historical pressure, not historical rails.**
The real spine of US history arrives as events and crises the player must navigate — assumption of state debts, the Louisiana Purchase, sectional conflict and Civil War risk, industrialization, WWI, the Depression, WWII, the Cold War. Outcomes can diverge sharply from real history based on player choices. **The game never forces an outcome.** It applies pressure and lets consequences follow.

**4. Deep, interconnected simulation.**
Real laws, real budgeting, real finance, taxation, debt service, trade, war, and administration. Economic variables must be genuinely causally linked. Changing a tariff must ripple through customs revenue, trade volume, regional prosperity, sectional tension, and political stability over subsequent months — not just move a single number. If a change only moves one number, the model is wrong.

**5. Historical benchmarking.**
At any moment the player can open a comparison view showing their USA against the real USA on that same date: GDP, population, federal debt, receipts and outlays, military size, and quality-of-life measures. Every real figure carries a source citation. See §12.

**6. Objective.**
Steer the USA to become the greatest country of all time. Full scoring lands in Phase 5; earlier phases surface the component dimensions without a composite score.

### 1.2 Tone

Serious and grounded. This is a simulation of governance, not a comedy.

Historical events are presented factually with real context. Morally difficult decisions — slavery, removal, internment, segregation — are represented honestly as the consequential choices they were, without either sanitizing them or being gratuitous. When the game presents such a decision, it includes factual historical context so the player understands what actually happened.

The practical test: **a history teacher should be able to look at any event card and find nothing false on it.** Narrative framing is allowed to be evocative; the `historicalContext` field is not allowed to be anything but accurate.

---

## 2. Phase roadmap

Only Phase 1 is being built. Later phases are recorded here so that Phase 1 decisions don't foreclose them.

| Phase | Period | Adds |
|---|---|---|
| **1** | 1789–1800 | Core loop, economy, treasury, legislation, events, regions-as-cards, history comparison, save/load, deployment |
| **2** | 1800–1860 | SVG map layer, territorial expansion, elections and succession, sectional tension mechanics |
| **3** | 1860–1900 | Civil War system, military and combat, industrialization |
| **4** | 1900–1945 | Foreign diplomacy, WWI, the Depression, WWII |
| **5** | 1945–present | Cold War through present, full scoring and "greatest country" endgame evaluation |

**Forward-compatibility commitments made in Phase 1** (these exist to prevent Phase 2+ from becoming a rewrite):

- Regions are modeled in data from day one, and each region contains a list of constituent states — so Phase 2's map attaches geometry to existing entities rather than introducing them (§8).
- `Ruler` carries birth year and heir fields even though succession is inert in Phase 1 (§9.3).
- The event and law systems are data-driven, so new periods are content additions rather than engine changes (§7).
- `schemaVersion` and a migration path exist from the first save ever written (§11).

---

## 3. Phase 1 scope

A vertical slice covering **1789-04-30 through 1800-12-31 only**. Its job is to prove the loop works end to end.

### 3.1 Acceptance criteria

Phase 1 is done when:

1. I can create an account, start a new game, choose monarchy or republic, and name my ruler.
2. The clock ticks day by day, pauses with spacebar, and runs at each of the five speeds without the UI stuttering or the browser tab pegging a CPU core.
3. Setting tax rates and spending in the Treasury panel produces effects that propagate through the economy over subsequent weeks and months in ways I can trace.
4. Every stat in the game can be hovered to reveal its full modifier breakdown, and the numbers add up.
5. At least 6 real 1790s events fire on historically appropriate dates with genuine branching choices, each carrying factual historical context.
6. The History view compares my run to real 1790s data with every figure cited, and honestly marks the years where we lack data.
7. I can save to Supabase, close the browser, log back in on another machine, and resume exactly where I left off.
8. The whole thing is deployed and playable on a Vercel URL.
9. `README.md`, `DESIGN.md`, and `docs/ECONOMY.md` are accurate and current.

### 3.2 Explicitly out of scope for Phase 1

Any map. Military combat. Foreign diplomacy. Elections. AI opponents. Multiplayer. Anything after 1800.

### 3.3 On the absence of a map

Phase 1 deliberately has no map. Building a geographically accurate 1790 US map with evolving territorial boundaries is weeks of work that doesn't prove the core loop works. Regions are modeled in data from day one and presented as cards; an SVG map layer is skinned on top in Phase 2 **without touching the simulation**.

This is a settled decision, and it is architecturally cheap precisely because regions are real simulation entities rather than a presentation convenience.

**The map arrived in Phase 2, queue item 9, and the promise held**: it was skinned on top without touching the simulation. Its design, and the one real inaccuracy it carries, are §8.4.

---

## 4. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | |
| Styling | Tailwind CSS | All colors as theme tokens; no arbitrary hex in components |
| UI state | Zustand | Selective re-rendering matters enormously for a ticking game |
| Database | Supabase (Postgres) via Prisma | Accounts and save games |
| Auth | Supabase Auth | |
| Icons | Lucide | Consistent stroke weight throughout |
| Fonts | `next/font` | Serif for headings and narrative, sans for UI chrome |
| Version control | GitHub | |
| Hosting | Vercel | |

**Verified local toolchain:** Node 24.18.0, npm 11.16.0, Git 2.55.0 on Windows 11.

### 4.1 Supabase / Prisma configuration requirements

These are known failure modes. Set them up correctly the first time.

**Two connection URLs are required.** This remains true and is still the most common Supabase setup mistake:

- `DATABASE_URL` → transaction pooler, port **6543**, with `?pgbouncer=true` — used by the running application
- `DIRECT_URL` → direct connection, port **5432** — used by `prisma migrate`

Migrations *must* bypass the pooler: they take PostgreSQL advisory locks and issue DDL, and a transaction pooler does not hold a session open across statements. The symptom is a migration that hangs or reports a lock error which never mentions pooling.

> ⚠️ **Prisma 7 changed where these URLs live** (verified during setup, 2026-08-15). The original brief specified putting both in `schema.prisma` under `datasource db`. That was correct through Prisma 6. **In Prisma 7 it is a hard validation error** — `P1012: The datasource property 'url' is no longer supported in schema files`. Not a deprecation warning; the schema simply will not compile.

The URLs now live in two separate places:

| URL | Lives in | Used by |
|---|---|---|
| `DIRECT_URL` (5432) | `prisma.config.ts` → `datasource.url` | Prisma CLI: `migrate`, `studio` |
| `DATABASE_URL` (6543) | `src/lib/prisma.ts` → `PrismaPg` adapter | The running application |

`datasource db` in `schema.prisma` now declares only `provider = "postgresql"`.

**Other Prisma 7 consequences worth knowing:**

- **Driver adapters are mandatory.** Prisma 7 dropped the bundled Rust query engine in favor of a WASM query compiler plus a driver adapter. PostgreSQL requires `@prisma/adapter-pg` and `pg`, and `PrismaClient` is constructed as `new PrismaClient({ adapter })`.
- **`.env` is no longer loaded automatically.** `prisma.config.ts` must `import 'dotenv/config'` at the top or every CLI command fails with "environment variable not found" while the variable sits plainly in `.env`.
- **The generated client is TypeScript output to a path we choose** (`src/generated/prisma`), not an injected `node_modules/@prisma/client`. It is a build artifact: git-ignored, and regenerated by a `postinstall` script so Vercel rebuilds it on every deploy.

**Remaining setup rules:**

- If the database password contains special characters such as `!`, they **must be percent-encoded** in the connection string or the URL silently breaks (`!` → `%21`).
- Vercel needs explicit permission to access the GitHub repo. Handle that at deploy time.
- Never commit `.env`. `.env.example` is committed with placeholder values and is the documented list of required variables.
- **Row Level Security does not protect Prisma queries.** Prisma connects as the database owner and bypasses RLS entirely. Authorization must be enforced in server-side code by checking the Supabase session before every query — RLS is a second layer, not the first. See §11.2.

---

## 5. Architecture rules (non-negotiable)

These matter more than any feature. A pull request that violates one of these is wrong even if it works.

### Rule 1 — The simulation engine is pure TypeScript, fully isolated from React

Everything in `/src/sim/` has **no React imports, no browser APIs, no network calls, no filesystem access**. It exports plain functions over plain data. The core entry point is:

```ts
advanceDay(state: GameState, content: ContentPack): TickResult
```

`TickResult` contains the new state plus a list of things that happened that day — events fired, modifiers applied, thresholds crossed.

*Why:* the engine must be testable in isolation, runnable on a server for save validation, and replayable without a DOM. It also means simulation bugs can never be caused by a render.

*Enforcement:* an ESLint rule bans importing `react`, `next/*`, and any DOM global from `/src/sim/**`. A unit test imports the whole sim module graph in a bare Node context and fails if anything touches `window` or `document`.

### Rule 2 — Determinism

Same state in, same state out, always. Any randomness uses a seeded PRNG whose state lives inside `GameState`, so a save can be replayed to an identical result. **No `Math.random()` anywhere in `/src/sim/`.**

Also banned in `/src/sim/`: `Date.now()`, `new Date()` with no arguments, `Intl` formatting that depends on system locale, and iteration over object keys where insertion order isn't guaranteed to be stable.

*Enforcement:* a determinism test runs the full 4,263-day Phase 1 span twice from an identical seed and deep-equals the resulting states. This test is the single most valuable one in the suite; it catches nondeterminism the moment it's introduced rather than months later when a save won't reload.

### Rule 3 — One serializable state object

`GameState` must `JSON.stringify` and round-trip losslessly. **No class instances, no `Date` objects, no functions, no `Map`, no `Set`, no `undefined` values, no `NaN`, no `Infinity`.**

Dates are stored as either day-number integers (preferred, for anything the sim reasons about) or ISO 8601 strings (for wall-clock metadata only). Lookup tables use plain objects (`Record<string, T>`), which serialize cleanly.

*Enforcement:* a round-trip test asserts `deepEqual(state, JSON.parse(JSON.stringify(state)))` after a long simulated run, plus a recursive scan rejecting `undefined`/`NaN`/non-finite numbers.

### Rule 4 — Content is data, not code

Adding a new historical event must require editing only a content file — never engine logic.

This means trigger conditions and effects are **declarative data structures interpreted by the engine**, not TypeScript callbacks. It is tempting to let an event carry `apply: (state) => {...}`; that breaks serialization, breaks review-ability, and puts simulation logic in `/src/content/`. See §7 for the condition and effect grammars.

The test: *could a non-programmer add an event by copying an existing file and editing the values?* If not, the content system is under-built.

### Rule 5 — Modifier ledger: every number must explain itself

Nothing mutates a stat directly. All changes flow through modifiers:

```ts
interface Modifier {
  id: string;
  source: string;            // "Whiskey Tax of 1791"
  sourceType: 'law' | 'event' | 'policy' | 'structural' | 'crisis';
  target: string;            // "nation.stability"
  value: number;
  isPercentage: boolean;
  startDay: number;
  endDay: number | null;     // null = permanent
}
```

The state carries the full active modifier list, and the UI can show exactly which sources are pushing a stat up or down and by how much. **This is simultaneously the best feature in the game and the only way we will ever debug the economy.**

Resolution order for any stat is fixed and documented: `base → sum of flat modifiers → apply percentage modifiers → clamp to range`. Percentages are additive with each other, not multiplicative, because additive percentages are the ones a player can reason about ("+10% and +15% is +25%").

**Ledger hygiene** (added so the ledger stays useful rather than becoming a landfill over 4,263 days):

- Expired modifiers are removed from `activeModifiers` on the tick they expire. Their historical record lives in `log`, so nothing is lost.
- Repealing a law removes its permanent modifiers.
- A single source emits **one aggregated modifier per target**, not many small ones.
- A modifier's `id` is deterministic and derived from `${sourceType}:${sourceId}:${target}`, so re-application is idempotent and duplicates are impossible.

*Enforcement:* a test asserts that for every displayed stat, `displayedValue === resolve(base, activeModifiers)` — the UI can never show a number the ledger can't account for.

### Rule 6 — The tick loop lives outside React's render cycle

The engine runs in a loop that writes to a Zustand store. The UI subscribes and re-renders at a **throttled cadence, maximum 4 times per second, independent of simulation speed.** At 5x speed the sim processes several days per second — React must not attempt to render each one.

This is specified in full in §6. Get it right early; retrofitting it is painful.

### Rule 7 — The UI is a renderer

Components read state and dispatch player actions. **Zero simulation math in components.** If a component needs a derived number, the derivation lives in `/src/sim/` (if it's simulation truth) or `/src/lib/format.ts` (if it's presentation only, e.g. currency formatting).

A component may not decide, for example, what the projected annual balance would be under a proposed tax rate. It calls `projectAnnualBalance(state, proposedPolicy, content)` from the sim and renders the answer.

### Rule 8 — Schema versioning on saves

`GameState` includes a `schemaVersion` integer. Saves record it. On load:

- **Same version** → load directly.
- **Older version with a registered migration path** → migrate forward through each step, then load, and tell the player it was upgraded.
- **Older version with no path, or newer than the running build** → refuse cleanly with a readable message naming both versions.

**Never crash, never silently load a broken state.** Migrations live in `/src/sim/migrations/` as pure functions `vN → vN+1` and are covered by tests using stored fixture saves.

---

## 6. The tick loop and performance architecture

This is the part most likely to be got wrong, so it is specified concretely.

### 6.1 The problem

Three things run at different rates and must not be coupled:

| Thing | Rate |
|---|---|
| Simulation | 1.67 to 10 in-game days per second, set by the speed control, or unbounded at the top speed |
| UI publication | Max 4 times per second, always |
| Browser paint | Whatever the display does, typically 60Hz |

Naively putting `GameState` in Zustand and calling `advanceDay` on an interval couples all three: every simulated day triggers a store write, which triggers subscriber notification, which triggers React renders. At 5x, that's a re-render storm of the entire dense information-heavy UI.

### 6.2 The design

```
┌─────────────────────────────────────────────────────────────┐
│  /src/sim/          PURE. No React. No DOM. No time.        │
│  advanceDay(state, content) → TickResult                    │
└────────────────────────┬────────────────────────────────────┘
                         │ called by
┌────────────────────────▼────────────────────────────────────┐
│  /src/runtime/gameLoop.ts    THE ONLY MUTABLE OWNER         │
│                                                              │
│  • holds authoritative GameState in a plain module variable │
│    (NOT in Zustand — no subscribers, no notifications)      │
│  • requestAnimationFrame loop with a time accumulator       │
│  • msPerDay = 1000 / speed                                  │
│  • drains accumulated time, capped at MAX_DAYS_PER_FRAME    │
│  • publishes to the store on a 250ms throttle               │
└────────────────────────┬────────────────────────────────────┘
                         │ publishes ≤4x/sec
┌────────────────────────▼────────────────────────────────────┐
│  /src/store/gameStore.ts     Zustand                        │
│  Read-only snapshot + player action dispatchers             │
└────────────────────────┬────────────────────────────────────┘
                         │ selector subscriptions
┌────────────────────────▼────────────────────────────────────┐
│  /src/components/            Pure renderers                 │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Specific requirements

**Speeds live in one table.** `src/runtime/speeds.ts` is the single definition of the five settings, in real milliseconds per in-game day. The loop, the command bar buttons, the keyboard shortcuts and the help sheet all read from it; nothing about a speed is written down twice. It lives in `/src/runtime/` rather than `/src/sim/` because the engine has no concept of real time at all (Rules 1 and 2).

| Control | ms per in-game day | In-game days per real second |
|---|---|---|
| 1x | 600 | 1.67 |
| 2x | 300 | 3.33 |
| 3x | 200 | 5 |
| 4x | 100 | 10 |
| 5x | *uncapped* | as fast as the machine can simulate |

**Accumulator, not naive interval.** At the four capped speeds, `requestAnimationFrame` fires at display rate, each frame accumulates elapsed time and drains whole days out of it. This keeps in-game time proportional to real time even when frames are dropped.

**The top speed is uncapped.** At 5x the accumulator is bypassed. The frame simulates days continuously until it has spent a wall-clock budget (`UNCAPPED_FRAME_BUDGET_MS`, 8ms — half a 60Hz frame) and then yields to the browser. There is no target rate, because the point of the setting is that a faster machine simply gets more days. A finite backstop of 400 days per frame exists so that a *stopped* clock cannot hang the tab; at 60Hz that is ~24,000 days a second, so it never binds in play.

The publication throttle is unaffected by any of this, and that is by construction rather than by luck: it is a **wall-clock** throttle, not a per-day one, so four publications per second is the ceiling at every speed including the uncapped one. `src/runtime/uncapped.test.ts` asserts it.

**Frame budget cap.** At the capped speeds, `MAX_DAYS_PER_FRAME = 10`. If the tab is backgrounded for thirty seconds, we do **not** simulate 150 days on the first frame back — that would freeze the tab and, worse, silently fast-forward past a decision the player should have seen. Excess accumulated time is discarded and the discard is logged. In-game time is allowed to fall behind real time; the simulation is never allowed to skip a day.

**Background tabs.** `requestAnimationFrame` is throttled or halted when the tab is hidden. On `visibilitychange` to hidden the loop auto-pauses; on return it stays paused until the player resumes. This is honest and avoids the "came back to find the treasury empty" failure.

**Publication throttle.** The store is written at most every 250ms. Between publications the engine may have advanced many days; the UI simply sees the newest state. The one exception is **pause-requesting effects**, which publish immediately (see below).

**Immediate publication on pause.** When a `pausesGame: true` event fires, the loop halts *on that day*, does not advance further, and publishes synchronously. A decision must never be missed because the game was running at 5x. This is why `advanceDay` returns `pauseRequested` in its `TickResult` rather than the loop having to inspect state.

**Selective subscription.** Components subscribe via narrow selectors with shallow equality. The command bar's date display re-renders on date change; the Treasury panel does not re-render because the date changed.

**Displayed numbers do not interpolate.** They change when a publication changes them, and layout stability — not motion — is what keeps a ticking readout calm. Every headline stat reserves a slot wide enough for its longest realistic value, so a changing digit count cannot move anything beside it.

This reverses an earlier version of this section, which specified a ~300ms tween toward each published value. Interpolating would put values on screen that no tick ever computed, and the stat popover beside the number shows the arithmetic that produced it — so the number and its own explanation would disagree. Reasoning in `docs/DECISIONS.md` D-013.

**The screen may lag the engine, and says so where it matters.** The loop deliberately runs ahead of what the UI has been told. Anything expensive enough to be recomputed on a slower cadence than the publish throttle — the Treasury projection is the one such thing today — states the in-game date it was computed from rather than implying it is live, and never blanks its figures while recomputing. D-011 and D-012 record what happens when this is got wrong.

**React Strict Mode.** Development double-invokes effects. The loop module is a singleton guarded against double-start; starting an already-running loop is a no-op.

### 6.4 Performance targets

- Idle CPU at 5x speed: well under one core on a mid-range laptop.
- `advanceDay` on a typical day: sub-millisecond. Month-boundary days (which recompute the economy, §6.5) may be longer but must stay under ~5ms.
- A full 4,263-day headless run in tests: a few seconds at most.

### 6.5 Daily tick vs. monthly economy

The clock ticks daily, but GDP and agricultural output do not meaningfully change day to day, and recomputing fourteen interlinked variables 4,263 times is both wasteful and physically odd.

- **Every day:** advance the calendar, expire modifiers, evaluate event triggers, accrue treasury cash flows (receipts and outlays accrue daily at 1/365 of their annual rate), fire scheduled events, append log entries.
- **On the 1st of each month:** recompute the economic aggregates — output, trade, GDP, prosperity, sentiment — applying the lagged responses documented in `docs/ECONOMY.md`.
- **Display:** shows the monthly value as computed. It steps once a month rather than being smoothed, because a smoothed figure is one the simulation never produced and the stat popover could not account for (§6.3, `docs/DECISIONS.md` D-013).

This remains fully deterministic: the recompute is triggered by calendar date derived from `day`, not by wall-clock timing. The exact cadence and lag structure are specified in `docs/ECONOMY.md`.

### 6.6 The calendar

`day` is an integer count of days since **1789-04-30 = day 0**. Phase 1 ends at **day 4262 = 1800-12-31**, a span of 4,263 days.

Date conversion is a pure function in `/src/sim/calendar.ts` implementing the **proleptic Gregorian calendar** — Britain and its colonies adopted Gregorian in 1752, so Gregorian is correct throughout the game's range.

> **Gotcha, verified:** **1800 was not a leap year.** The Gregorian rule excludes century years not divisible by 400. A naive `year % 4 === 0` check puts every date after February 1800 one day off — which would land the end of Phase 1, and every historical event in 1800, on the wrong date. The calendar module implements the full rule and is unit-tested against known dates including 1800-02-28 → 1800-03-01.

---

## 7. Content system

Content lives in `/src/content/` and is interpreted by the engine. Per Rule 4, content contains **no executable logic**.

### 7.1 Events

```ts
interface GameEvent {
  id: string;
  title: string;
  historicalDate?: string;       // ISO date it happened in reality
  triggerConditions: Condition[]; // all must be satisfied
  body: string;                  // narrative framing
  historicalContext: string;     // what actually happened, factually
  sources: string[];             // citations for historicalContext
  options: EventOption[];        // 2–4
  pausesGame: boolean;
  weight?: number;               // tie-break when several fire same day
  oneShot: boolean;              // default true
}

interface EventOption {
  id: string;
  label: string;
  description: string;
  requirements?: Condition[];    // if unmet, option shown disabled with reason
  disabledReason?: string;
  effects: EffectSpec[];
  previewedEffects: string[];    // plain-English effect summary shown on the card
}
```

- Events with `pausesGame: true` **auto-pause the clock** when they fire.
- Every option applies modifiers and may schedule follow-on events, so choices have downstream consequences rather than one-time hits.
- Each event carries `historicalContext` explaining what actually occurred, shown alongside the choice. **This is the educational backbone of the game.**
- `previewedEffects` is authored prose, not generated from `effects`. The player should see "Strengthens federal credit, angers frontier distillers" rather than a list of raw numbers.

### 7.2 The condition grammar

Declarative and serializable, so triggers can be authored, tested, and shown to the player as "why is this locked".

```ts
type Condition =
  | { kind: 'dateOnOrAfter'; date: string }
  | { kind: 'dateBefore'; date: string }
  | { kind: 'stat'; path: string; op: '<' | '<=' | '>' | '>=' | '=='; value: number }
  | { kind: 'regionStat'; regionId: string; path: string; op: string; value: number }
  | { kind: 'flag'; key: string; equals: string | number | boolean }
  | { kind: 'lawEnacted'; lawId: string }
  | { kind: 'eventFired'; eventId: string }
  | { kind: 'optionChosen'; eventId: string; optionId: string }
  | { kind: 'governmentType'; is: 'monarchy' | 'republic' }
  | { kind: 'not'; of: Condition }
  | { kind: 'all'; of: Condition[] }
  | { kind: 'any'; of: Condition[] };
```

Every condition kind has a `describe()` implementation producing plain English, which is how locked laws explain themselves (`docs/UI.md` §Legislation).

### 7.3 The effect grammar

```ts
type EffectSpec =
  | { kind: 'modifier'; source: string; sourceType: Modifier['sourceType'];
      target: string; value: number; isPercentage: boolean; durationDays: number | null }
  | { kind: 'treasuryDelta'; amount: number; reason: string }
  | { kind: 'regionSentiment'; regionId: string | 'all'; delta: number }
  | { kind: 'setFlag'; key: string; value: string | number | boolean }
  | { kind: 'scheduleEvent'; eventId: string; inDays: number }
  | { kind: 'unlockLaw'; lawId: string }
  | { kind: 'repealLaw'; lawId: string }
  | { kind: 'log'; tier: LogTier; title: string; body: string };
```

### 7.4 Bills

*Phase 2 replaced `Law` with `Bill` outright — see `docs/DECISIONS.md` D-023 for why both were not kept. Modelled on Democracy 4's policy structure, as the Phase 2 brief §4.2 asks.*

```ts
interface Bill {
  id: string;
  category: Department;          // one of seventeen (brief §4.1)
  name: string;
  description: string;
  historicalNote: string;        // factual, required on EVERY tier
  sources: string[];

  hasSlider: boolean;            // a rate or intensity, or a flat enact/repeal
  sliderRange: [number, number] | null;
  sliderLabel: string | null;
  sliderUnit: 'rate' | 'dollars' | null;

  // Four numbers because the four acts are different: introducing a thing is
  // not the same as repealing it, and raising a rate is not lowering one.
  capitalCost: { introduce: number; repeal: number; raise: number; lower: number };
  treasuryCost: { min: number; max: number };   // across the slider range

  phaseInDays: number;           // effects ramp in, never instant (§7.4a)
  prerequisites: Condition[];
  availableFrom: string;
  availableUntil: string | null;

  historicity: 'enacted' | 'proposed' | 'counterfactual' | 'anachronistic';
  lockedBecause: string | null;  // required when anachronistic; rendered verbatim

  effects: ModifierTemplate[];   // persist while in force; scale with the slider
  blocReactions: BlocReaction[]; // who gains, who loses, how strongly, and why

  createsTax: BillTaxTemplate | null;      // becomes a Treasury line (§4.3)
  createsProgram: BillProgramTemplate | null;
  repealable: boolean;
}
```

**A bill that cannot be passed explains itself.** `billStatus()` returns a reason in every negative case — a date not yet reached, an unmet prerequisite rendered through `describe()`, or `lockedBecause` quoted in full. A locked control with no explanation is the same failure the modifier ledger exists to prevent, applied to actions rather than numbers.

**Locked means impossible, not merely hard.** The line between `counterfactual` and `anachronistic` is whether anything actually forbade the thing. An export duty is locked because Article I §9 forbids it; a general sales tax is *not* locked, because nothing forbade it and it was simply unadministrable. Reasoning and the full tier assignments are in `docs/DECISIONS.md` D-026.

### 7.4a Phase-in

A bill's effects ramp from nothing to full over `phaseInDays`, expressed as `rampDays` on the modifiers it emits. A statute does not change a country the day it is signed: officers have to be appointed, forms printed, collectors sent.

This is **not** the same as the lag constants in `docs/ECONOMY.md` §7.1 and does not duplicate them. `rampDays` is the statute taking hold; the lags are the country responding to it. They are sequential. For stats that are not lagged at all — legitimacy is cumulative rather than target-seeking — `rampDays` is the only ramp there is. D-024 has the argument.

The ledger's invariant survives it: the breakdown reports the **ramped** contribution plus `rampProgress`, so what the popover shows is what the stat used.

### 7.5 Phase 1 event slate (proposed)

Acceptance criterion 5 requires at least six. These are the candidates, all real, all falling inside 1789–1800, and all offering genuine branches. Final selection and full authoring happen at implementation time; this list is here for your review.

| Event | Real date | Why it makes a good decision |
|---|---|---|
| Assumption of state debts / Compromise of 1790 | Jun–Jul 1790 | The foundational fiscal choice; trades Southern sentiment against federal credit |
| First Bank of the United States | Feb 1791 | Constitutional-interpretation fork with long-run credit and legitimacy effects |
| Whiskey excise enacted | Mar 1791 | Direct revenue-vs-frontier-sentiment tension; sets up 1794 |
| Bill of Rights ratified | Dec 1791 | Legitimacy anchor; monarchy path frames it very differently |
| Fugitive Slave Act | Feb 1793 | A genuine and consequential moral choice, presented factually |
| Proclamation of Neutrality / Citizen Genêt | Apr–Aug 1793 | Foreign pressure without needing a diplomacy system |
| Whiskey Rebellion | Jul–Nov 1794 | Payoff of the 1791 choice; force vs. conciliation, with real stability stakes |
| Jay Treaty | Nov 1794 – Jun 1795 | Deeply unpopular, materially beneficial — the best kind of dilemma |
| Pinckney's Treaty | Oct 1795 | Frontier prosperity via Mississippi navigation |
| Alien and Sedition Acts | Jun–Jul 1798 | Stability purchased with legitimacy; a clean illustration of the tradeoff |
| Quasi-War with France | 1798–1800 | Military spending pressure without a combat system |

---

## 8. Regions

Even though Phase 1 has no map, the nation is modeled as regions from day one. **Regional divergence in economy, population, and sentiment is what makes sectional tension and eventually the Civil War possible.** Building it in later would be a rewrite.

### 8.1 The four Phase 1 regions

**New England**, **Mid-Atlantic**, **South**, **Frontier**.

Each region contains a list of constituent states and territories with their 1790 census populations. The simulation operates at the **region** level in Phase 1 — there is no per-state math — but the data structure means Phase 2's map can attach geometry to states without a schema change.

Exact state-to-region assignments and their sourced 1790 population figures are specified in `docs/ECONOMY.md`.

### 8.2 What a region tracks

Population, enslaved population, labor force, agricultural output, manufacturing output, trade volume, prosperity index, sentiment toward the federal government, dominant industry, and compliance (the degree to which the region actually remits federal revenue — the mechanism through which legitimacy collapse becomes materially painful, §10).

### 8.3 Slavery in the model

For 1789–1800 this is not avoidable: enslaved people were roughly a third of the South's population in the 1790 census, and slavery was both the engine of Southern agricultural output and the root of the sectional conflict the game is building toward.

**Decision: it is modeled explicitly and factually.** Enslaved population is tracked per region from 1790 census figures, with real effects on agricultural output and on sectional sentiment. Related events — the 1790 Quaker antislavery petitions and the congressional gag rule that followed, the 1793 Fugitive Slave Act — present the conflict as the consequential political struggle it was, with sourced historical context.

Representing it honestly in the model *is* the version that isn't sanitized. Omitting it would misrepresent both the economy and the politics of the period. The UI presents these figures as demographic and economic fact with historical context attached, never as a resource to be optimized in isolation.

### 8.4 The map

*Implemented in Phase 2, queue item 9 (brief §6). It replaced the Desk as the main view; the Desk's panels moved beneath it, because vitals and crises did not stop mattering.*

**Geometry is generated, not shipped.** `scripts/make-map-geometry.mts` reads the `us-atlas` TopoJSON — already projected to Albers USA in a 975×610 box — and writes `src/content/map/geometry.ts`: one SVG path string per state. `us-atlas`, `topojson-client` and `d3-geo` are **devDependencies used only by that script**. The game ships no map library and no runtime projection maths, and the geometry is diffable in a pull request like every other piece of content.

**The one real inaccuracy, stated rather than hidden.** The outlines are MODERN state boundaries used for every year. Virginia here excludes West Virginia, which did not exist until 1863; Massachusetts excludes the District of Maine, which it held until 1820. The brief asked for this to be "documented prominently and visibly in-game", so it is written under the map itself, not only here.

**What each outline actually WAS is real data.** `src/content/map/territory.ts` records a status history per outline — `state`, `organized_territory`, `unorganized`, `petitioning`, `foreign`, `disputed`, `native_nation` — with a source citation on every record. It is benchmark data under §12.2, so nothing in it is interpolated: Rhode Island is *outside the union* in April 1789 and the map colours it accordingly, Ohio is the Northwest Territory, Louisiana is Spanish, and the record runs through to 1861 so the sectional crisis is legible on the map decades in advance.

**Modes are simulation, not presentation.** `src/sim/map.ts` returns a bucket index and a WORD for each cell; the component turns a bucket into a design token. **Seven modes**: political, support, economic and party (item 9), then population, sectional strain and compliance (item 10).

**Sectional strain** is the one the brief asks most of — "the map mode that should make the coming Civil War legible decades in advance". It is a derived measure rather than a stored stat: the enslaved share of a region’s people, the absolute divergence of its sentiment from the union’s, and its grievance (`docs/ECONOMY.md` §7.22). The first term is the largest, so the South is already well up the scale in 1789 — which is correct, and is the point.

**Two of the brief’s nine modes were deliberately not built.** Infrastructure needs public works tracked by region; military needs any military presence at all. The model has neither, and distributing a national figure across regions by population would look complete and be fabricated. `docs/BLOCKERS.md` B-007 records what would clear each.

**Two honesty rules the map enforces in code:**

1. **Absence is drawn, never shaded.** A cell with no figure returns `value: null` and its own flat fill, and the legend counts how many there are. A neutral shade would read as a middling value the model never computed. "No quiet interpolation to make a map mode look complete" (brief §10).
2. **The regional simplification is declared.** This model has four regions and no state-level economy, so on the support and economic maps every state in a region is the same colour, and the basis line says so. The one genuinely per-state mode is **party**, because delegations are per state — and its legend says the seat counts are history while the split is a model.

---

## 9. Government types

### 9.1 The problem this solves

Elections and succession are out of scope for Phase 1, and 1789–1800 contains no succession on either path. Without deliberate design, the founding choice — which is supposed to feel weighty — would be cosmetic in the only phase being built.

**Decision: the difference is real but non-electoral.** It shows up in starting conditions, in how legitimacy behaves over time, in the cost of action, and in which event options are available.

### 9.2 The two paths

| | **Republic** | **Monarchy** |
|---|---|---|
| Player title | President | King |
| Starting legitimacy | Higher | Lower |
| Legitimacy behavior | **Decays** over time unless renewed by popular consent — successful policies, crises averted, prosperity | **Stable**, does not decay |
| Regional sentiment at start | Broadly positive | Notably negative in New England and the Mid-Atlantic (deeply anti-monarchical in 1789), more favorable in the South |
| Cost of unilateral action | Higher — unpopular laws cost more political capital | Lower — the crown acts more cheaply |
| Crisis mishandling | Absorbed more gracefully | Sharper legitimacy penalties |
| Event options | Some options available only to a republic | Some options available only to a monarchy |
| Succession | Elections every two years for the House, a third of the Senate with them — implemented, §9.4 | Bloodline — implemented, §9.3 |

**Phase 2 gave this real teeth (brief §2.1).** The rows above were the whole of it while every path enacted instantly. They now sit on top of a concrete bargain:

| | Republic | Monarchy |
|---|---|---|
| Capital to pass a bill | full, **plus whatever the votes cost** | **×0.35** — no votes to whip |
| Legitimacy to pass a bill | **none** | floor plus power-weighted opposition |
| Grievance created | ×1 | **×4** |
| Ruler mortality | none | annual, with a legitimacy cost each time |
| Declaring war | **must carry both chambers, and can be refused** | by decree, at once |
| Appointing a cabinet | **the Senate confirms, and can refuse** | the crown appoints |
| Capital ceiling | full | ×0.75 |
| Can a bill simply be refused? | **Yes** — Congress votes it down, at a cost in standing | No |

**The crown buys speed and pays in consent.** It can act when a legislature could not afford to, and the country remembers every time it does — specifically, by bloc, accumulating into unrest that takes the revenue away. The full model is `docs/ECONOMY.md` §7.19; the balance is argued in `docs/DECISIONS.md` D-027 and asserted by tests, because "neither path is strictly better" is a claim that has to be checkable rather than merely intended.

Exact starting values and the legitimacy decay/renewal formulas are in `docs/ECONOMY.md`.

### 9.3 The ruler, and succession

*Implemented in Phase 2, queue item 6. This section previously said succession was deferred; it no longer is.*

On the **monarchical** path the ruler ages and dies. Mortality is rolled once a year against an age band, using the seeded PRNG whose state lives in `GameState` — so a save replays identically and two runs from one seed produce the same king dying on the same day. The RNG advances whether or not the ruler dies; advancing it only on death would make the sequence depend on the outcome it produced.

An orderly succession costs 9 legitimacy; a disputed one costs 26 and takes 15 stability with it for two years. **Which it is, is the player's doing**: a new ruler is credited with an heir only if the dynasty's legitimacy is above a threshold. A crown that has spent its standing on decrees finds the question of who comes next is suddenly worth arguing about (`docs/DECISIONS.md` D-028).

On the **republican** path there is no mortality. What replaces it is §9.4: the president stays, and the legislature underneath him turns over.

**The player does not leave, on either path.** Pillar 2. A succession is a change in the circumstances the player governs under, not a handover — the name at the top of the screen changes, the standing the office carries drops, and the player carries on.

### 9.4 Congress, and the republic's half of the bargain

*Implemented in Phase 2, queue item 7. Full model in `docs/ECONOMY.md` §7.20.*

The monarchy's bargain was built first (§9.2) and for a while it was one-sided: the crown paid grievance for speed, and the republic paid… nothing, because nothing could refuse it. A bill cost capital and then passed. **Congress is the thing that can say no.**

**Every state's delegation votes.** Seats are historical and cited — 65 House seats under the Constitution's original allocation, 105 after the Apportionment Act of 1792, two senators per state, real admission dates. Which way a delegation leans is a model, and the Congress screen says so on its face (§12.2, `docs/BLOCKERS.md` B-006).

A delegation's inclination is party line plus sectional interest. **Sectional interest can override party**, which is the whole point: a Federalist delegation from a shipping state does not vote for a tariff that closes its own harbour, and no amount of party discipline changes that. Interests, not positions — a party in 1793 was a coalition of people with something in common, and it votes like one (`docs/DECISIONS.md` D-030).

**Parties are dated content.** Until 4 March 1793 there are only "Pro-Administration" and "Anti-Administration", because that is what there was; the Federalists and Democratic-Republicans succeed them rather than replacing them, and a delegation's leaning carries across the transition.

**The player can work the count, at a price**, and sees the projected division broken down by chamber, party and region *before* committing:

| Tool | Effect | Price |
|---|---|---|
| Whip a party | shifts that party's undecideds | capital per point, spent win or lose |
| Attach a rider | buys one bloc, offends another | capital, and the rider's own effect ships with the bill |
| Promise a favour | buys votes now | capital now, and **twice as much later** — or legitimacy when the promise is broken |

**Defeat costs something.** A bill voted down costs legitimacy, and the next defeat costs more than the last. It also puts that bill on a cooldown, so a losing bill cannot be re-introduced the same afternoon until the ground has changed.

**Elections re-seat the whole House and a third of the Senate** on 4 March of odd years, from regional sentiment as it stands that morning. This is the republic's version of mortality: the player never leaves, but the country they have to persuade is not the one they persuaded last time.

---

## 9.5 The causal web

*Implemented in Phase 2, queue item 15. Model in `docs/ECONOMY.md` §7.26.*

The modifier ledger is a causal graph — DESIGN.md has said so since Phase 1, and Rule 5 is what makes it one. Item 15 drew it.

**It draws two kinds of edge**, and the second is the reason it is worth having. LEDGER edges are what the statute book is doing right now, read from `activeModifiers` and weighted by what each is contributing today. STRUCTURAL edges are how the country transmits an effect once it has one — a tariff suppresses trade, which cuts customs, which widens the deficit, which raises debt service, which crowds out everything else.

Ledger edges alone would draw a bipartite fan with no path longer than one hop. The structural half comes from `src/content/causalLinks.ts`, which is the model’s own claims collected as data: each entry names the formula it describes and the ECONOMY.md section it comes from. **Nothing in the engine reads it** — the simulation runs on the formulas and this describes them, so a wrong edge draws a wrong picture and cannot produce a wrong number.

**The screen opens focused rather than showing everything**, because a causal web that shows everything answers nothing. And the layout is deterministic rather than force-directed, so nodes do not wander while the clock runs (`docs/DECISIONS.md` D-055).

---

## 10. Failure, and why there is no game over

Pillar 2 says the player never leaves power. That is in direct tension with any conventional failure state, so failure is modeled differently.

**There is no game-over screen.** Instead, failure is **degraded governance** — the player persists, but governs a wreck:

- **Treasury insolvency** forces emergency borrowing at punitive interest rates, which compounds into debt service crowding out every other outlay.
- **Legitimacy collapse** triggers **regional non-compliance**: a region's `compliance` falls, it remits less federal revenue, and its sentiment craters. This is the mechanism that makes legitimacy a material variable rather than a vibe.
- **Constitutional crisis** is a state that locks certain actions until resolved.

These are recoverable, but recovery is expensive and slow. If a hard loss condition is ever wanted, Phase 2's secession mechanics are its natural home — not Phase 1.

---

## 11. State, saves, and persistence

### 11.1 What lives where

| Concern | Owner | Why |
|---|---|---|
| Simulation logic & formulas | Versioned TS in `/src/sim/` | Must be deterministic and code-reviewable |
| Game content (events, laws, policies) | Versioned data in `/src/content/` | Editable without touching engine logic |
| Real historical benchmark data | Versioned data in `/src/content/history/` with citations | Git-tracked, diffable, reviewable — a changed historical number must show up in a pull request |
| Player accounts | Supabase Auth | — |
| Save games | Supabase Postgres via Prisma | Cross-device, survives browser clears |
| In-progress session state | Browser memory + localStorage fallback | The tick loop cannot hit the network every day |

Historical data stays in the repo rather than the database on purpose: it is reference data that should never change without a reviewed commit, and the game needs it instantly at every tick.

**No fact is stored in two places where the copies can drift.** Where something must be derived, it is derived at read time, not duplicated at write time.

### 11.2 Accounts

**Guest play is allowed.** A player can reach the title screen, start a game, and play with the save held in `localStorage`, with a clear and persistent prompt that cloud save requires an account. Signing in **migrates the local save up** to Supabase.

Acceptance criterion 7 — save, close the browser, resume on another machine — is still fully proven by the authenticated path.

### 11.3 Save format and slots

- **Three named save slots per account**, plus **one rolling autosave**.
- Autosave is written **every in-game month and on every pause**.
- A save stores the **full serialized `GameState` snapshot**, not an action log. This is simpler and more robust; determinism means replay-based saves can be added later if ever wanted.
- Every save records `schemaVersion`, the content pack version, a real-world timestamp, and a short display summary (ruler name, in-game date, government type) so the load screen doesn't need to deserialize entire saves to render a list.

### 11.4 Migration policy

See Rule 8 (§5). Migrations are pure `vN → vN+1` functions in `/src/sim/migrations/`, tested against stored fixture saves. A fixture save is committed for every schema version ever released, and the migration test runs each one forward to current. This is cheap now and is the only way to avoid breaking saves later.

**Released so far:**

| Version | Change | Migration | Fixture |
|---|---|---|---|
| 1 | The Phase 1 schema | — | `fixtures/v1-republic-day900.json` |
| 2 | Three tax rates and three spending lines become `TaxInstance[]` and `SpendingProgram[]` (§13, brief §4.3) | `v1ToV2.ts` | `fixtures/v2-republic-day900.json` |
| 3 | Political capital and administrative capacity (brief §3) | `v2ToV3.ts` | `fixtures/v3-republic-day900.json` |
| 4 | Bills replace laws; modifiers gain a phase-in ramp (§7.4, brief §4) | `v3ToV4.ts` | `fixtures/v4-republic-day900.json` |
| 5 | Grievance, unrest, and a ruler who can die (brief §2.1) | `v4ToV5.ts` | `fixtures/v5-republic-day900.json` |
| 6 | Congress, parties and the seat record (§9.4, brief §2.2) | `v5ToV6.ts` | `fixtures/v6-republic-day900.json` |
| 7 | Blocs become state: overlapping membership that policy can move (brief §1) | `v6ToV7.ts` | `fixtures/v7-republic-day900.json` |
| 8 | Diplomacy: relations, treaties and tribute (brief §7) | `v7ToV8.ts` | `fixtures/v8-republic-day900.json` |
| 9 | Wars become a record (brief §7, item 12) | `v8ToV9.ts` | `fixtures/v9-republic-day900.json` |
| 10 | The cabinet becomes the player’s to appoint (brief §5) | `v9ToV10.ts` | — (current) |

A fixture is **generated once and never regenerated**, by `scripts/make-fixture.mts <version>` — which *refuses* to overwrite one that already exists. A fixture rebuilt from current code stops recording the old format and becomes a restatement of the new one, which would make its migration test pass by construction and prove nothing. That rule used to be a comment; it is now behaviour.

Every migration must state whether it is **behaviour-preserving** or a deliberate change:

- `v1ToV2` is behaviour-preserving. The three founding instances reproduce the three old formulas arithmetically, and the test asserts a migrated save's revenue is unchanged.
- `v2ToV3` **adds** a mechanic that did not exist, so there is no prior behaviour to preserve. It seeds the new reserve generously rather than at zero: the mechanic is new, so its absence in the old save was not the player's choice, and charging them for it would be the wrong way round.
- `v3ToV4` is behaviour-preserving where it can be and honest where it cannot. Carried-forward bills get `enactedDay: 0`, because no enactment day was ever recorded and there is no way to recover one — the founding is the honest answer, and the day the player happened to upgrade would be a fabrication in the game's own record of itself. Existing modifiers get `rampDays: 0`, because they were applied under a build with no phase-in and were therefore fully in force; retro-fitting a ramp would weaken effects the player has already been living with.
- `v9ToV10` adds an empty cabinet, and is behaviour-preserving BY CONSTRUCTION rather than by care: `appointments` holds only what the player has done, and every office without an entry falls back to the historical record — which is exactly how a v9 save already behaved. Writing the historical holders in as though the player had chosen them would have been the fabrication (`docs/DECISIONS.md` D-050).
- `v8ToV9` adds an empty list of wars, and is the smallest migration in the project. A v8 save fought none because it could not. It exists as its own function rather than folded into the previous one because a save written under v8 is a real save someone may hold, and the rule is one function per version with a fixture behind it.
- `v7ToV8` seeds relations at their 1789 baselines and **signs nothing**. Awarding a save the treaties that were historically concluded by its date would credit the player with an accomplishment they never had the opportunity to attempt — the Jay Treaty cost 120 political capital and was the most contested measure of the decade (`docs/DECISIONS.md` D-044).
- `v6ToV7` seeds the FOUNDING shares and takes the save’s own present as its baseline. Deriving shares from the current economy would invent a decade of occupational change the player never caused; measuring against 1789 figures the save does not contain is impossible. So the country is what it is and changes from there, and a migrated save behaves like a new game begun on its own date (`docs/DECISIONS.md` D-035).
- `v5ToV6` seats a Congress **as of the save's own day**, from the historical seat record and the save's current regional sentiment — not a fresh 1789 Congress, which would hand a save made in 1796 a legislature that had not existed for seven years. It cannot recover the sitting Senate class, because a v5 save has no record of one, so the Senate starts matching the House and the two diverge from the next election onward. That is a one-time loss of nuance in a migrated save rather than a fabricated history, which is the right way round.
- `v4ToV5` seeds grievance **empty**, and that is the only defensible answer. Grievance is a record of things the government did to particular blocs, and a v4 save contains no such record. Deriving a starting grievance from, say, current regional sentiment would invent a history of decrees the player never issued and then hold them to it.

---

## 12. Historical data integrity

This is a first-class requirement, not a nice-to-have. Dashboards showing invented numbers are worse than dashboards showing gaps.

### 12.1 The rules

- Benchmark data lives in `/src/content/history/` as typed data with **a source citation attached to every single figure**.
- **Never fabricate a historical number.** If we lack a sourced figure for a year, the record is marked unavailable and the comparison UI shows "no verified data for this year" — never a guess, never a silently interpolated value presented as fact.
- If a value is interpolated between known data points, it carries `isInterpolated: true` and the UI labels it visibly as an estimate.
- Simulated and real values must be **visually distinguishable at all times** — different color treatment *plus* a text label, never color alone.

### 12.2 The critical distinction: benchmark data vs. calibration constants

The simulation needs starting values for quantities no one has a verified 1789 figure for. Resolving this without either fabricating history or leaving the engine without numbers requires two clearly separated categories:

| | **Benchmark data** | **Calibration constants** |
|---|---|---|
| Lives in | `/src/content/history/` | `/src/sim/calibration.ts` |
| Is | A claim about what really happened | A game-design parameter |
| Requires | A precise source citation, or an explicit unavailable marker | Documentation of its reasoning in `docs/ECONOMY.md` |
| Shown to the player as | Real history | Never presented as historical fact |
| Used by | The History comparison view | The simulation |

The History view draws **only** from benchmark data. A calibration constant may be *informed by* historical estimates — and where it is, that provenance is documented — but it is never displayed as a historical figure.

This is what makes it possible to honor "never fabricate a number" while still having a running economy.

### 12.3 Sources

Starting points, each to be verified and cited precisely at the point of use:

- Federal receipts, outlays, surplus/deficit: OMB Historical Tables; **note** — Table 1.1 aggregates 1789–1849 rather than providing annual figures, so annual 1790s data requires *Historical Statistics of the United States* series Y (see `docs/ECONOMY.md`)
- Federal debt outstanding annually from 1790: US Treasury, "Historical Debt Outstanding"
- Population: decennial US Census from 1790
- GDP and price-level estimates: MeasuringWorth (Johnston & Williamson)
- General reference: *Historical Statistics of the United States* (Cambridge / Census Bureau Bicentennial Edition)

Every figure actually used, with its precise citation, is recorded in `docs/ECONOMY.md` and mirrored in the typed data files.

### 12.4 Benchmark data granularity

Benchmark data is annual at best — federal receipts and debt exist as year-end figures, and population exists only per decennial census (1790, 1800).

**Decision: no interpolation for display in Phase 1.** The History view shows the most recent verified figure with its date, clearly labeled (e.g. "Federal debt, 31 December 1793"). The `isInterpolated` flag exists in the schema and the UI handles it, but Phase 1 does not use it: where a census gap exists, the chart shows a labeled gap rather than a line drawn through it.

Honest beats smooth.

---

## 13. Core data model

A refined version of the initial sketch. Full field-level definitions live in `/src/sim/types.ts`; this is the shape and the reasoning.

```ts
interface GameState {
  // --- identity & versioning ---
  schemaVersion: number;         // current: 10 (v1-v9 migrate; see §11.4)
  gameId: string;
  createdAtISO: string;          // wall-clock, set once; never read by the sim
  contentVersion: string;

  // --- determinism ---
  rng: RngState;                 // { seed, state, calls } — see note below

  // --- time ---
  day: number;                   // integer days since 1789-04-30 (day 0)

  // --- the polity ---
  governmentType: 'monarchy' | 'republic';
  ruler: Ruler;
  nation: NationStats;
  regions: Region[];
  treasury: TreasuryState;
  policies: PolicyState;
  // Phase 2 §3. The government's capacity to ACT, as distinct from legitimacy,
  // which is its standing. Accrues daily, caps, and is raised temporarily by
  // emergency powers. Full model in docs/ECONOMY.md §7.17.
  politicalCapital: PoliticalCapitalState;
  // Phase 2 §2.1. The price of ruling by decree: who resents the government,
  // tracked per BLOC and per region, plus the unrest it has produced. Full
  // model in docs/ECONOMY.md §7.19.
  grievance: GrievanceState;
  // Phase 2 §2.2. The thing that can say no: delegations and their party
  // shares, the cooldowns on defeated bills, the promises still owed, and the
  // count of divisions lost. Seats are history; the split is a model (§9.4).
  congress: CongressState;
  // Phase 2 §1. Who the country is MADE of: overlapping, graduated bloc
  // membership per region, drifting monthly toward what the economy and the
  // statute book imply. docs/ECONOMY.md §7.21.
  blocs: BlocState;
  // Phase 2 §7. The world outside: relations with every foreign power, the
  // treaties in force, and what they cost each year. Treaties act on the
  // economy through the SAME ledger bills use — there is no second economy.
  diplomacy: DiplomacyState;
  // Phase 2 §5. Only the offices the PLAYER has filled. Everything else falls
  // back to the historical record, so an empty cabinet is the cabinet history
  // gave you rather than an empty government.
  cabinet: CabinetState;

  // --- the ledger ---
  activeModifiers: Modifier[];

  // --- content interaction ---
  eventState: EventState;
  flags: Record<string, string | number | boolean>;

  // --- record ---
  log: LogEntry[];
  series: SeriesHistory;         // monthly samples for sparklines & History view

  // --- bookkeeping ---
  lastEconomyRecomputeDay: number;
}
```

**Refinement — `rng` (approved, implemented).** The brief specifies that the seed and call-count live in `GameState`. Reconstructing the generator from `seed` + `rngCalls` alone requires re-advancing it `rngCalls` times on every load, which is O(n) and grows through the run. Storing the PRNG's current state directly makes resume O(1). `seed` and `calls` are both still stored — `seed` for provenance and reproducibility from scratch, `calls` as an audit counter the determinism test asserts against.

As implemented, the three values are grouped into a single `rng: RngState` object (`{ seed, state, calls }`) rather than three flat fields, so they travel with the functions that operate on them in `src/sim/rng.ts`. Same data, still plain JSON, still Rule 3 compliant. Verified by test: a generator serialized mid-run, round-tripped through JSON, and resumed continues an identical sequence.

Supporting types:

```ts
interface Ruler {
  name: string;
  houseName: string;             // dynasty (monarchy) or party (republic)
  title: string;                 // "King" | "President", derived at creation
  birthYear: number;
  heirName: string | null;       // inert in Phase 1; present for Phase 2
  portraitId: string | null;
}

interface NationStats {
  population: number;
  laborForce: number;
  agriculturalOutput: number;    // annualised, constant dollars
  manufacturingOutput: number;
  tradeVolume: number;
  tradeCapacity: number;         // latent, before tariff suppression; lagged
  gdp: number;
  stability: number;             // 0–100
  legitimacy: number;            // 0–100, RESOLVED (base + ledger)
  legitimacyBase: number;        // 0–100, accumulated, before the ledger
  sectionalTension: number;      // 0–100
  modelTargets: {                // pre-modifier targets, for the stat popover
    stability: number;
    sectionalTension: number;
  };
}

interface Region {
  id: 'new_england' | 'mid_atlantic' | 'south' | 'frontier';
  name: string;
  states: Array<{ code: string; name: string; population1790: number }>;
  population: number;
  enslavedPopulation: number;
  laborForce: number;
  agriculturalOutput: number;
  manufacturingOutput: number;
  tradeVolume: number;
  prosperity: number;            // 0–100 index
  prosperityTrend: number;       // change at the last recompute; direction matters
  sentiment: number;             // -100..+100 toward the federal government
  compliance: number;            // 0–100; revenue actually remitted
  dominantIndustry: string;
  tariffExposure: number;        // how heavily each tax falls on this region
  exciseExposure: number;
  landExposure: number;
  baselineOutputPerCapita: number;
  baseProsperity: number;        // day-0 equilibrium, so the founding is not
  baseSentiment: number;         // a state the model immediately flees
  baselineTaxBurden: number;
  modelTargets: {                // pre-modifier targets, for the stat popover
    prosperity: number;
    sentiment: number;
    compliance: number;
  };
}

interface TreasuryState {
  balance: number;
  debtPrincipal: number;
  debtWeightedRate: number;      // effective annual interest rate
  creditRating: number;          // 0–100; drives new borrowing cost
  emergencyBorrowing: boolean;
  receiptsYTD: { customs: number; excise: number; land: number; other: number };
  outlaysYTD: { debtService: number; military: number; civil: number; other: number };
  lastYear: { receipts: number; outlays: number };

  // Phase 2. Per-instance attribution for the current run rates: which tax, at
  // what rate, on what assessed base, less what was not remitted and what could
  // not be collected. The four headline buckets above are a ROLLUP of these,
  // never a parallel calculation, so the detail and the total cannot disagree.
  //
  // Revenue is deliberately NOT routed through `Modifier[]`: a modifier is an
  // adjustment to a stat, and revenue is a sum over instances. What it gets
  // instead is the same guarantee in the right structure — see
  // `docs/DECISIONS.md` D-019.
  receiptLines: RevenueLine[];
  outlayLines: OutlayLine[];
}

interface PolicyState {
  // Phase 2: taxes and spending are INSTANCES, not fixed fields. A bill can
  // create one, and Treasury renders whatever is in the array. See below.
  taxes: TaxInstance[];
  programs: SpendingProgram[];
  enactedLawIds: string[];
  cumulativeInfrastructure: number;
}

interface TaxInstance {
  id: string;
  name: string;                  // "Whiskey Excise of 1791"
  createdByBillId: string | null; // null for the taxes present at founding
  base: TaxBase;                 // registry in src/sim/taxBases.ts
  rate: number;                  // ad valorem, 0–1
  exemptions: string[];          // display prose, as the statute wrote them
  collectionEfficiency: number;  // 0–1; enforcement is a real problem in 1790
  enactedDay: number;
  repealedDay: number | null;    // repealed, not deleted — the record survives
}

interface SpendingProgram {
  id: string;
  name: string;
  createdByBillId: string | null;
  category: 'military' | 'civil' | 'infrastructure';
  annualAmount: number;
  enactedDay: number;
  repealedDay: number | null;
}

interface EventState {
  firedEventIds: string[];
  chosenOptions: Record<string, string>;      // eventId -> optionId
  pendingDecisions: PendingEvent[];
  scheduledEvents: Array<{ eventId: string; fireOnDay: number }>;
}

interface LogEntry {
  id: string;
  day: number;
  tier: 'info' | 'decision' | 'crisis' | 'enactment';
  category: 'treasury' | 'legislation' | 'region' | 'event' | 'system';
  title: string;
  body: string;
  relatedEventId?: string;
}

interface TickResult {
  state: GameState;
  effects: TickEffect[];         // what happened, for the feed and for tests
  pauseRequested: boolean;       // §6.3 — decision events halt the loop
}
```

**On growth.** `log` is expected to reach only a few hundred entries across Phase 1 (roughly one to three per month plus events), which is well within a comfortable save size. A soft cap of 5,000 entries exists as a backstop; if it is ever hit, the oldest entries are dropped and a system log entry records the truncation rather than it happening silently. `series` stores monthly samples of a fixed metric set — about 141 months across Phase 1, which is trivial.

---

## 14. Repository layout

```
/
├── DESIGN.md                  ← this file
├── README.md                  ← setup, running, deploying
├── docs/
│   ├── ECONOMY.md             ← the simulation model, in prose
│   └── UI.md                  ← screen specs and design tokens
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/                   ← Next.js App Router routes
│   ├── components/            ← pure renderers (Rule 7)
│   ├── sim/                   ← PURE TS, no React (Rule 1)
│   │   ├── types.ts
│   │   ├── advanceDay.ts
│   │   ├── calendar.ts
│   │   ├── rng.ts
│   │   ├── modifiers.ts
│   │   ├── conditions.ts
│   │   ├── effects.ts
│   │   ├── calibration.ts     ← game-design constants (§12.2)
│   │   ├── economy/
│   │   └── migrations/
│   ├── content/               ← data only, no logic (Rule 4)
│   │   ├── events/
│   │   ├── laws/
│   │   ├── regions/
│   │   └── history/           ← benchmark data, every figure cited (§12)
│   ├── runtime/               ← the tick loop (§6)
│   ├── store/                 ← Zustand
│   └── lib/                   ← formatting, supabase client, helpers
└── tests/
```

---

## 15. Testing strategy

The tests that matter most are the ones protecting the architecture rules, because those failures are the expensive ones.

| Test | Protects |
|---|---|
| **Determinism run** — 4,263 days twice from one seed, deep-equal | Rule 2 |
| **Serialization round-trip** — after a long run, `JSON.parse(JSON.stringify(s))` deep-equals `s`; recursive scan for `undefined`/`NaN`/non-finite | Rule 3 |
| **Purity check** — import the sim graph in bare Node; fail on any DOM/React reference | Rule 1 |
| **Modifier accounting** — every displayed stat equals base plus its resolved ledger | Rule 5 |
| **Migration fixtures** — every released schema version's fixture save loads and migrates forward | Rule 8 |
| **Calendar** — known date conversions including the 1800 non-leap-year boundary | §6.6 |
| **Content validation** — every event/law parses, every condition and effect kind is known, every `sources` array is non-empty, every referenced `eventId`/`lawId`/`regionId` resolves | Rule 4 |
| **Benchmark integrity** — every historical figure has a citation; no figure is silently zero | §12 |
| **Golden master** — a fixed seed and scripted action sequence produce a recorded end state; intentional balance changes update the snapshot deliberately | Everything |

---

## 16. Decisions on record

Questions raised before implementation and their resolutions, so future sessions don't relitigate them.

| # | Question | Decision |
|---|---|---|
| 1 | What differs between monarchy and republic in Phase 1, given no elections? | Real non-electoral differences: legitimacy decay vs. stability, regional sentiment split, cost of action, path-specific event options (§9.2) |
| 2 | Can the player lose? | No game-over. Failure is degraded governance — insolvency, regional non-compliance, constitutional crisis (§10) |
| 3 | Real-time pacing | Five speeds, defined in one table in `src/runtime/speeds.ts`. 3x is 5 days/second; 1x and 2x scale proportionally below it; 4x doubles 3x; 5x is uncapped. Full Phase 1 ≈ 43 min at 1x. Rebalanced in Phase 2 — `docs/DECISIONS.md` D-015, D-016 (§6) |
| 4 | Does the ruler die? | Ages and displays age; no death or succession in Phase 1. Schema carries Phase 2 fields (§9.3) |
| 5 | Daily tick vs. monthly economy | Daily: calendar, events, cash flow, modifier expiry. Monthly: economic aggregates. Display interpolates (§6.5) |
| 6 | Modifier ledger growth | Ledger kept exactly as specified, plus hygiene: expire, remove on repeal, aggregate per source-target, deterministic ids (§5 Rule 5) |
| 7 | Do regions contain states? | Yes — states listed with 1790 populations from day one; sim operates at region level in Phase 1 (§8) |
| 8 | How is slavery handled? | Modeled explicitly and factually — per-region enslaved population with real economic and sentiment effects, plus sourced events (§8.3) |
| 9 | Sourced history vs. numbers the sim needs | Two separated categories: benchmark data (cited or marked unavailable) and calibration constants (documented, never shown as history) (§12.2) |
| 10 | Interpolate annual benchmark data? | No, not in Phase 1. Show the most recent verified figure with its date; show labeled gaps, not drawn-through lines (§12.4) |
| 11 | Is an account required to play? | No — guest play with localStorage; cloud save requires an account; signing in migrates the local save up (§11.2) |
| 12 | Save slots and autosave | Three named slots plus a rolling autosave, written monthly and on pause. Full state snapshots (§11.3) |
| 13 | Research historical figures live? | Yes — figures are researched and cited rather than written from memory (§12.3) |
| 14 | Map in Phase 1? | No. Settled, and cheap to add later because regions are real simulation entities (§3.3) |
| 15 | `rngState` added to `GameState` | Proposed refinement — O(1) resume instead of O(n) replay; `seed` and `rngCalls` both retained (§13) |

---

## 17. Open questions deferred to later phases

- How elections interact with continuous authorship in mechanical detail (Phase 2).
- Whether the monarchy path diverges into a separate content branch or shares the event slate with path-specific options — Phase 1 uses the shared-slate approach; revisit when the content volume grows.
- Scoring formula for "greatest country of all time" (Phase 5).
- Whether saves eventually move to replay-based storage now that determinism guarantees it is possible.
