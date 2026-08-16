# PROGRESS.md

**Live status of the build. Written for a reader with no memory of the session
that produced it.**

If you are resuming with no context: read `DESIGN.md` first, then this file,
then `docs/DECISIONS.md` and `docs/BLOCKERS.md`. Then continue the **Phase 2
queue** below, which is `gov-sim-phase2-brief.md` §9.

**Last updated:** Phase 2 run of 2026-08-16, after queue item 3.

---

## Where things stand

| | |
|---|---|
| Production URL | <https://gov-sim.vercel.app> |
| Deploy | auto-deploys from `main` on push |
| Tests | 370 passing |
| Save schema | version **2** — v1 saves migrate forward, fixture committed |
| Gates | tests, lint, typecheck, production build — all green |
| Database | Supabase, `save_games` table migrated, verified reachable from production |
| Phase | **2 — in progress.** Phase 1 shipped. |

---

## Phase 2 queue — `gov-sim-phase2-brief.md` §9

| Item | Status |
|---|---|
| 1 — Numbers flicker fix + regression test | **complete** — see below and DECISIONS.md D-010…D-014 |
| 2 — Speed rebalance with config table | **complete** — see below and D-015, D-016 |
| 3 — Dynamic tax and spending instances | **complete** — see below and D-018, D-019 |
| 4 — Political capital system | not started |
| 5 — Legislation categories and bill schema (≥25 bills) | not started |
| 6 — Monarchy decree path | not started |
| 7 — Congress and the republic path | not started |
| 8 — Bloc model | not started |
| 9 — Map view replacing the Desk | not started |
| 10 — Remaining map modes and state detail panel | not started |
| 11 — Diplomacy tab | not started |
| 12 — War declaration paths | not started |
| 13 — Cabinet competence and loyalty | not started |
| 14 — Theming, asset registry, audio abstraction | not started |
| 15 — Causal web view | not started |

### Item 1 — the number flicker: complete

**What it actually was.** `TreasuryPanel` keyed its projection on the identity
of the published `GameState`. The loop publishes a new state object four times
a second, so every 250ms the projection went stale, all ten figures rendered as
em-dashes, and a 180ms debounce restarted — then two full 365-day forward
simulations ran on the main thread to bring them back. Measured before the fix:
**405 of 600 frames blank, 36 re-simulations in ten seconds of wall time.**

Full diagnosis, including which of the brief's five suspects were ruled out and
how, is `DECISIONS.md` D-011.

**What changed.**

- `src/sim/projection.ts` — new `projectionBasisKey(state)`. Staleness is now a
  simulation question answered in `src/sim/`, not an identity comparison in a
  component (Rule 7). The basis is the monthly economy recompute, the committed
  policy, the enacted laws and the modifier ledger; `state.day` and the treasury
  balance are deliberately excluded.
- `src/components/game/TreasuryPanel.tsx` — re-bases on that key, and never
  blanks: the previous projection stays on screen while a new one computes,
  labelled with the in-game date it was simulated from.
- `src/components/game/CommandBar.tsx` — dropped `overflow-x-auto`, which
  toggled a scrollbar inside the 64px bar as value lengths changed and was also
  clipping every stat popover opened from there.
- `src/app/globals.css` — new `stat-slot` utility reserving width, so a value
  changing length cannot move its neighbours.
- `DESIGN.md` §6.3/§6.5 and `docs/UI.md` §2.5 — corrected. They promised a
  300ms number interpolation that was never built and will not be; D-013 has the
  reasoning.

**How it is protected.** `src/components/game/numberStability.test.tsx` (6 tests)
drives the real loop against a real DOM under a controlled clock and asserts:
no value ever blank/NaN/undefined; commits stay inside the publication budget at
every speed; a rendered value never changes while the published snapshot stands
still; the projection never blanks over 600 frames; and it re-simulates at most
four times in ten seconds. `src/components/game/testHarness.tsx` is the shared
fake-clock, fake-rAF and render-counting infrastructure.

Two checks still need human eyes, because jsdom has no layout engine: the
command bar not jumping, and popovers not being clipped. Both are
`docs/MANUAL-QA.md` §10.

### Item 2 — speed rebalance: complete

**The table now lives in one place**, `src/runtime/speeds.ts`. Before, three
rates were a formula in the loop plus four independent hard-coded lists that
nothing forced to agree. The old values are recorded in `DECISIONS.md` D-015
before they were touched, as the brief asked.

| Control | ms per in-game day | days per real second | full Phase 1 run |
|---|---|---|---|
| 1x | 600 | 1.67 | 43 min |
| 2x | 300 | 3.33 | 21 min |
| 3x | 200 | **5** — what Phase 1 called 5x | 14 min |
| 4x | 100 | 10 | 7 min |
| 5x | *uncapped* | as fast as the machine can go | seconds |

`600 : 300 : 200` puts 1x, 2x and 3x in an exact 1 : 2 : 3 ratio. 4x doubles 3x.
Reasoning in D-016.

**Uncapped works by wall-clock budget.** At 5x the accumulator is bypassed and
the frame simulates continuously until it has spent `UNCAPPED_FRAME_BUDGET_MS`
(8ms, half a 60Hz frame), then yields. `UNCAPPED_MAX_DAYS_PER_FRAME` (400) is a
backstop against a *stopped* clock, not a speed cap — at 60Hz it would be 24,000
days a second, so it never binds in play.

**The publication ceiling holds, and is asserted rather than assumed.** The
brief predicted this is where things would break. It does not break, because
publication is throttled by wall clock rather than by days, so four per second
is the ceiling at any simulation rate. `src/runtime/uncapped.test.ts` drives the
real loop with a controllable clock and a real rAF queue — no DOM, no React —
and asserts: uncapped beats the fastest capped speed by an order of magnitude;
publication stays at or under 4/second across 300 frames and 1,000+ simulated
days; the frame yields once its budget is spent; the backstop binds when the
clock is frozen; dropping back to a capped speed restores a fixed rate; and
**the loop still halts on the exact day a decision fires**, which is the thing
most likely to break when one frame can simulate hundreds of days.

**Everything reads from the table**: the loop, the command bar buttons and their
hover descriptions, the `1`–`5` keyboard shortcuts (derived from `SPEEDS`, not
switched on by hand), and the keyboard help sheet. `Speed` is defined in
`speeds.ts` and re-exported by the store as a type-only import, so there is no
runtime import cycle and no second definition of the speed set.

**One consequence, logged not fixed:** uncapped speed reaches 1800-12-31 in
seconds, and nothing stops the clock there. That is `BLOCKERS.md` B-005, with a
recommendation. Four tests confirm running to 1810 stays deterministic,
NaN-free and save-able, so it is a design gap rather than a defect.

### Item 3 — taxes and spending as instances: complete

The structural change the rest of the brief rests on. `PolicyState.taxRates`
(three fields) and `PolicyState.spending` (three fields) are gone. In their place:

- **`src/sim/taxBases.ts`** — the registry of twelve taxable bases: the nine the
  federal government actually used in this period, two counterfactuals, and
  `exports`, which the Constitution forbids outright. Each carries how it is
  assessed, which receipt bucket it rolls into, which regional exposure channel
  its burden travels, how collectable it is, its historicity, a sourced factual
  note, and — where it is locked — the real reason, stated verbatim.
- **`src/sim/taxes.ts`** — pure queries and updates over the instance arrays.
  `taxesInForce`, `aggregateRate`, `tradeTaxRate`, `burdenLevies`, `spendingFor`,
  `rollupReceipts`, and the upsert/repeal operations.
- **`computeTaxRevenue`** in `economy/fiscal.ts` — one general formula replacing
  three bespoke ones, reporting **two losses separately**: not remitted (a
  region's consent) and uncollected (the administration's reach).
- **`TreasuryState.receiptLines` / `outlayLines`** — per-instance attribution.
  The four headline buckets are a rollup of these, never a parallel calculation.
- **Schema version 2**, with `migrations/v1ToV2.ts` and a committed fixture,
  `fixtures/v1-republic-day900.json`, generated once by
  `scripts/make-v1-fixture.mts` and never regenerated.

**The constraint that shaped it: it moved no calibrated number.** Every solved
constant is anchored to the day-0 equilibrium composing to the verified 1790 GDP
of $193M, so a structural change that shifted revenue would have invalidated the
calibration and the History comparison with it. `src/sim/taxes.test.ts` asserts
the general path equals `computeCustomsRevenue`, `computeExciseRevenue` and
`computeLandRevenue` exactly — the three old formulas were kept for that purpose
rather than deleted.

**Content now uses the new grammar.** The 1791 whiskey event `enactTax`s the
excise with its real name and its statutory exemption, so Treasury shows a line
called the Whiskey Excise of 1791. The 1794 rebellion's concession `repealTax`s
it rather than setting it to zero, so the line goes.

**Tests:** 25 in `taxes.test.ts` (formula equivalence, attribution reconciling,
create/change/repeal, registry coherence), 8 in `treasuryInstances.test.tsx` (the
screen follows the array with no component edit), and the migration file grew to
21 including seven against the v1 fixture.

Human-eye checks are `docs/MANUAL-QA.md` §11.

---

## Phase 1 run queue (complete)

| Item | Status |
|---|---|
| 1 — Treasury screen | **complete** |
| 2 — Supabase auth and save/load | **built; cloud path awaits two env vars** |
| 3 — History comparison view | **complete** |
| 4 — Government screen | **complete** |
| 5 — Full acceptance pass | **complete** — table below |
| Stretch 1 — performance verification | **complete** |
| Stretch 2 — more events (14 now, from 9) | **complete** |
| Stretch 3 — accessibility audit | **complete** — two real contrast failures found and fixed |
| Stretch 4 — responsive to 1280px | **complete** — feed collapses to a drawer |
| Stretch 5 — documentation sweep | **complete** — done incrementally, reconciled at Item 5 |
| Stretch 6 — chronicle filtering and search | **complete** |

Every left-nav section is now built. The "not yet implemented" placeholder
component has been deleted.

---

## What exists

**Engine** (`src/sim/`) — pure TypeScript, no React, no DOM, deterministic.

- `calendar.ts` — integer day ↔ civil date, proleptic Gregorian. Day 0 is
  1789-04-30; Phase 1 ends day 4262 (1800-12-31). **1800 is not a leap year.**
- `rng.ts` — seeded mulberry32 behind a pure interface. Resumes identically
  after a JSON round trip.
- `modifiers.ts` — the ledger. Fixed resolution order, additive percentages,
  clamping exposed as an explicit reconciling line.
- `types.ts` — `GameState` and content shapes.
- `calibration.ts` — every tunable constant, in one place.
- `conditions.ts` / `effects.ts` — declarative content grammars, plus
  `describe()` so locked content explains itself.
- `economy/production.ts`, `economy/fiscal.ts`, `economy/society.ts` — the
  model, each formula carrying its causal claim as a comment.
- `advanceDay.ts` — the tick. Daily and monthly cadences. Also `resolveDecision`.
- `createGame.ts` — day-0 state from census seed data.
- `policy.ts` — enacting a budget, and its legitimacy cost.
- `projection.ts` — forward simulation for the Treasury screen.
- `narrative.ts` — state-of-the-union prose and crisis lines.

**Content** (`src/content/`) — **fourteen events**, six laws, cabinet tenures,
and region seed data, all with sourced historical context.

**Runtime** (`src/runtime/gameLoop.ts`) — the authoritative state lives here in
a module variable, NOT in Zustand. rAF accumulator, 10-day frame cap, publishes
to the store at most 4×/second.

**UI** (`src/components/`, `src/app/`) — title, founding, and the three-zone
shell. **All seven sections are built**: Desk, Treasury, Legislation, Regions,
Government, History, Chronicle. Plus the event modal and the save menu.

**Saves** (`src/lib/saves/`, `src/sim/migrations/`) — one interface, local and
cloud backends, autosave off the tick path, and a load path that migrates or
refuses readably but never crashes.

**Historical benchmarks** (`src/content/history/`) — population, nominal GDP,
federal debt and a consumer price index, every figure cited. Receipts, outlays
and military size are declared gaps.

---

## Item 1 — Treasury screen: complete

Built:

- Tax sliders (tariff, excise, land) and spending sliders (military, civil,
  infrastructure), with debt service shown as non-discretionary.
- Live projection with **both columns forward-simulated over the same 365
  days** by the real engine.
- Explicit Enact and Revert. Nothing commits from a drag.
- Enacting charges legitimacy through the ledger and writes a chronicle entry.
- The tariff slider marks the 25% revenue peak on its track.
- The excise slider shows live projected frontier compliance.

**The projection is not a separate formula.** It clones the state, calls the
same `enactPolicy` the button calls, and runs `advanceDay` forward. A test
asserts the projection equals what actually happens when the policy is played
out. See `DECISIONS.md` D-002 for why that mattered — the first version was
0.02% optimistic because it skipped the legitimacy cost.

24 new tests, including the tariff curve turning over inside the projection and
the excise compliance collapse being visible in it.

---

## Item 2 — auth and save/load: built, cloud path dormant

Built:

- `src/sim/migrations/` — the load path. Same version loads; older with a
  registered path migrates forward; older without one, newer than this build,
  malformed JSON, and non-save files all **refuse readably**. Never throws.
  16 tests, including a guard against a migration that forgets to bump the
  version and would otherwise loop forever.
- `src/lib/saves/` — one `SaveStore` interface, two implementations
  (`localStore`, `cloudStore`), and a facade that picks between them. A failed
  cloud write falls back to local and says so; a network hiccup cannot destroy
  a run.
- `src/lib/saves/autosave.ts` — subscribes to the **store**, never the tick
  path. Writes on in-game month turnover with a 60s real-time floor.
- `/api/saves` and `/api/saves/[slot]` — list, write, read, delete. Every query
  scoped to the authenticated user id.
- `SaveMenu` — four slots, sign-in by emailed link, sync-local-upward.

**Not active:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
are unset in both local and production. See `docs/ENV-SETUP.md` for exactly
where to get them and what else to configure in Supabase. Setting them
activates the cloud path with no code change.

**Consequence for acceptance criterion 7:** the local half is done and testable;
the cross-device half cannot be verified until those variables exist.

> ⚠️ **Authorization note for anyone touching the save routes.** Prisma connects
> as the database owner and **bypasses Row Level Security**. The `getUserId()`
> check in each route handler is the only thing separating one player's saves
> from another's. A route that forgets it is a data leak, not a bug.

---

## Acceptance criteria — honest status

Assessed against §11 of the original brief. **A criterion that is 80% there is
not met.** Where something cannot be proven without a browser, it is marked
partial and the specific check is in `docs/MANUAL-QA.md`.

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Create an account, start a game, choose government, name ruler | ⚠️ **Partial** | Founding flow works and is tested (`createGame.test.ts`, 33 tests). **Account creation is built but inactive** — the two `NEXT_PUBLIC_SUPABASE_*` variables are unset. See B-004. |
| 2 | Clock ticks, pauses with space, runs 1x/2x/5x without stutter or CPU peg | ⚠️ **Partial** | Accumulator, frame cap, speed mapping and pause-on-decision all unit-tested (`gameLoop.test.ts`). **Stutter and CPU cannot be measured without a browser** — MANUAL-QA §2.1–2.5. |
| 3 | Tax and spending changes propagate traceably over weeks and months | ✅ **Met** | `projection.test.ts` asserts receipts move at the first monthly recompute while frontier sentiment shifts progressively at 1, 6 and 24 months. The Treasury projection is the engine itself, tested to equal a played-out run. |
| 4 | Every stat hoverable, breakdown sums correctly | ⚠️ **Partial** | All **modifier-driven** stats have breakdowns that reconcile exactly — national stability, legitimacy, sectional tension, and per-region prosperity, sentiment, compliance. Tested for every one. **Purely computed figures — population, GDP, treasury balance, debt — have no breakdown**, because no modifier acts on them; they are outputs of formulas. Whether that satisfies "every stat" is a judgement call I could not ask about. |
| 5 | At least 6 real events on historical dates with branching and factual context | ✅ **Met** | Nine events. `content.test.ts` plays the full span and asserts all fire, each on or after its historical date, each with sourced context, and that choices diverge. |
| 6 | History view compares to real data, every figure cited, gaps marked honestly | ✅ **Met** | `history.test.ts` — every figure cited, no interpolation, gaps declared with what is missing, price index sourced so the comparison is real-terms. |
| 7 | Save, close the browser, resume on another machine | ❌ **Not met** | Local save/load and schema migration work and are tested. **Cross-device requires the Supabase auth variables.** The code path is complete and dormant. See B-004 and `ENV-SETUP.md`. |
| 8 | Deployed and playable on a Vercel URL | ✅ **Met** | <https://gov-sim.vercel.app>, auto-deploying from `main`. |
| 9 | README, DESIGN.md and ECONOMY.md accurate and current | ✅ **Met** | Reconciled against the code during this run: `DESIGN.md` §13 data model updated for fields added since it was written; `UI.md` §5.4 corrected where it had become false; `ECONOMY.md` §9 and §11.7 updated with solved constants and the implemented real-terms decision. |

**Four met, four partial, one not met.**

The two hard blockers are both the same missing pair of environment variables.
Setting them would move criterion 7 to met and criterion 1 to met, with no code
change. That is the single highest-value action available.

---

## What to do next

1. **Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`** — see
   `ENV-SETUP.md`. Clears two acceptance criteria at once.
2. Work `docs/MANUAL-QA.md`, particularly §2 (clock and CPU) and §6 (history
   gaps), which are the checks no test can make.
3. Source the receipts and outlays figures (B-001), the last real data gap.
4. Stretch queue: render-throttle instrumentation, more events, accessibility
   audit, responsive check.

---

## Standing constraints (do not violate)

- **Never fabricate historical data.** The gap state is a finished deliverable.
- Never break working functionality to add new functionality.
- All four gates pass before every commit.
- Never weaken a test to make it pass.
- No destructive database commands. Additive migrations only.
- No force-push, no rewriting pushed history.
- No secrets in tracked files.
- **Do not start Phase 2.** Nothing after 1800-12-31.
