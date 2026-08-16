# PROGRESS.md

**Live status of the build. Written for a reader with no memory of the session
that produced it.**

If you are resuming with no context: read `DESIGN.md` first, then this file,
then `docs/DECISIONS.md` and `docs/BLOCKERS.md`. Then continue the **Phase 2
queue** below, which is `gov-sim-phase2-brief.md` §9.

**Last updated:** Phase 2 run of 2026-08-16, after queue item 7.

---

## Where things stand

| | |
|---|---|
| Production URL | <https://gov-sim.vercel.app> |
| Deploy | auto-deploys from `main` on push |
| Tests | 584 passing |
| Save schema | version **6** — v1 to v5 saves migrate forward, all five fixtures committed |
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
| 4 — Political capital system | **complete** — see below and D-020 to D-022 |
| 5 — Legislation categories and bill schema (≥25 bills) | **complete** — 32 bills, see below and D-023 to D-026 |
| 6 — Monarchy decree path | **complete** — see below and D-027 to D-029 |
| 7 — Congress and the republic path | **complete** — see below and D-030 to D-032 |
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

### Item 4 — political capital: complete

One currency, accruing daily, gating what the government can get done. It sits
**beside** legitimacy rather than replacing it, because they answer different
questions: legitimacy is whether the country accepts your right to govern,
capital is whether you can get this particular thing done. Legitimacy feeds
capital accrual; spending capital does not spend legitimacy. (D-020)

- **`src/sim/economy/politics.ts`** — accrual, cap, elite support and the
  accrual-with-cap step, each with its causal claim.
- **`src/sim/offices.ts`** — reads the historical office record: which
  departments exist on a day, and which are staffed.
- **`GameState.politicalCapital`** — stock, model targets, resolved rate and
  cap, emergency powers, and lifetime accrued/spent/**wasted**.
- **Accrual is daily** (HOI4's cadence, not D4's quarterly turns); the *rate* is
  recomputed monthly with the other slow aggregates.
- **The cap is real**, and capital accruing into a full reserve is counted as
  wasted — so "hoarding is not a strategy" is falsifiable rather than asserted.
- **Emergency powers**, D4's mechanic, raise both rate and cap immediately and
  **end on a fixed day**, clawing the stock back to the ordinary ceiling.
- **Spending**: budget changes cost capital on the *absolute* movement, and the
  Enact button disables with a sentence saying how many days short you are.

**Administrative capacity is real, not a placeholder.** Brief §3 lists cabinet
quality as an accrual driver, and item 13 owns competence and loyalty — but the
historical office record already exists and is cited, so capacity is "how much of
the government exists × how much of it is staffed". That makes day 0 genuinely
**zero**: State was created 27 July 1789, War 7 August, the Treasury 2 September.
The player starts holding an office in a government that does not yet exist.
(D-021)

**Two things that fell out of it.**

1. The engine now reads offices, so `ContentPack` gained `offices` and
   `Office`/`Tenure` moved into `src/sim/types.ts`. That meant threading content
   into `projectPolicy`, which is an improvement on its own terms — the
   projection is now a pure function of state, proposal *and* content.
2. Clamping the office census at the end of the record exposed that the cabinet
   data was **missing two real officers**: John Marshall (State, from 6 June
   1800) and Samuel Dexter (War, from 12 June 1800). Both are now in the record
   with citations.

**Schema version 3**, `migrations/v2ToV3.ts`, with a committed v2 fixture. The
fixture script is now `scripts/make-fixture.mts <version>` and **refuses to
overwrite an existing fixture** — the never-regenerate rule is behaviour rather
than a comment. (D-022)

**Tests:** 30 in `politicalCapital.test.ts`, 4 more in
`treasuryInstances.test.tsx` for the affordability gate, 5 more in
`migrations.test.ts` against the v2 fixture. Human-eye checks are
`docs/MANUAL-QA.md` §12.

### Item 5 — legislation: complete

`Law` is gone. `Bill` replaces it outright (D-023), with Democracy 4's policy
structure: a department, four separate capital costs, an optional slider,
prerequisites that explain themselves, a declared relationship to the historical
record, and a statement of who gains and who loses.

**The slate: 32 bills, across all 17 departments, on all four tiers.**
The brief's floor was 25 bills across six departments; a test asserts the floor
so shrinking it is a deliberate act.

| Tier | Count | Examples |
|---|---|---|
| enacted | 23 | Judiciary Act 1789, Tonnage Act 1789, Coinage Act 1792, Carriage Duty 1794, Slave Trade Act 1794, Stamp Act 1797, Direct Tax 1798, Marine Hospital Service 1798 |
| proposed | 4 | Commercial discrimination against Britain, Hamilton's bounties on manufactures, a national university, a board of agriculture |
| counterfactual | 3 | A general sales tax, federal gradual emancipation, a national road programme |
| anachronistic | 2 | A federal income tax, an export duty on staples — both locked, both quoting the constitutional bar in full |

Eight bills create a tax; twelve fund a spending programme. Passing one produces
its Treasury line, attributed to the bill by name; repealing it takes the line
with it. That is the join between this item and item 3, and the requirement the
brief states most plainly.

**Phase-in is real.** `Modifier` gained `rampDays`, and a bill's effects ramp
from nothing to full over `phaseInDays`. This does NOT duplicate the existing lag
constants — `rampDays` is the statute taking hold (officers appointed, collectors
sent), the lags are the country responding. They are sequential, and for
legitimacy, which is cumulative rather than target-seeking, `rampDays` is the
only ramp there is. The ledger's reconciliation invariant survives it: the
breakdown reports the ramped contribution plus `rampProgress`. (D-024)

**Bloc reactions are live, not inert.** Every bill declares who gains and who
loses with a strength and a reason. Until item 8 builds the real bloc model, each
bloc is distributed across the regions by a documented weighting
(`ECONOMY.md` §7.18) and its reaction moves that region's *base* sentiment. Item
8 replaces the table and nothing in `src/content/` changes. Repeal does not
refund the resentment. (D-025)

**Counterfactual is not the same as locked.** The line is whether anything
actually forbade the thing. An export duty is locked because Article I §9 forbids
it; a general sales tax is available, because nothing forbade it and it was
simply unadministrable. Federal gradual emancipation is available at 200 capital
and total planter opposition, because locking it would say the Constitution
forbade it — which is false and would misteach the player about why it did not
happen. (D-026)

**New Legislation screen** (`LegislationPanel.tsx`) organised by department, with
nothing hidden: every department listed, every bill listed, every locked bill
quoting its reason verbatim, every card carrying its factual note and sources.

**Schema version 4**, `migrations/v3ToV4.ts`, with a committed v3 fixture
carrying twelve enacted bills and 35 modifiers.

**Tests:** 38 in `bills.test.ts`, 15 in `legislation.test.tsx`, 7 more in
`migrations.test.ts`. Human-eye checks are `docs/MANUAL-QA.md` §13.

### Item 6 — the monarchy decree path: complete

The bargain, stated before the numbers were chosen and then asserted by tests:
**the crown buys speed and pays in consent.**

| | Republic | Monarchy |
|---|---|---|
| Capital to pass a bill | full | **×0.35** — no votes to whip |
| Legitimacy to pass a bill | **none** | floor + power-weighted opposition |
| Grievance created | ×1 | **×4** |
| Ruler mortality | none | annual, −9 legitimacy each time |
| Capital ceiling | full | ×0.75 |

**Grievance is per bloc**, which is the whole design — "decreeing against the
planters repeatedly builds planter grievance specifically, not generic
unhappiness". Regional grievance is *derived* from bloc grievance through the
same weighting bills use, so a bloc's anger lands where that bloc actually is.
Support banks nothing: a government cannot decree something popular and spend the
credit on something hated.

**`BLOC_POWER` is not size.** The small farmers are the most numerous bloc and
carry the least weight; the financiers are a few hundred men and carry a great
deal. A crown answers to whoever can obstruct it. Power weights the *cost to the
government*, not the anger of the bloc.

**Three stages of consequence**, with the warning first: sentiment falls at any
level of grievance, compliance only above 35 (resistance), stability only above
55 (defiance) and 78 (revolt). It should be impossible to be surprised by a
rising — `src/sim/grievance.ts`, `MANUAL-QA.md` §14.5.

**Succession is real.** The ruler ages and dies, rolled annually against an age
band using the seeded PRNG — so a save replays identically and the same king dies
on the same day. The RNG advances whether or not he dies. An orderly succession
costs 9 legitimacy; a disputed one 26 plus 15 stability for two years. **Which
one it is, is the player's doing**: a new ruler gets an heir only if the dynasty's
legitimacy is above 42, so a crown that has spent its standing on decrees finds
the succession it was relying on has stopped being safe. The Government screen
states which state you are currently in.

**The player never leaves.** DESIGN.md pillar 2 holds: the name at the top of the
screen changes and the player carries on.

**Two bugs the tests found**, both recorded in D-029 because the shape recurs:
unrest could not survive the smallest dip (severities compared by name rather
than rank), and two long-standing decay tests turned out to be measuring the new
succession cost.

**Schema version 5**, `migrations/v4ToV5.ts`, with a committed v4 fixture.
Grievance seeds **empty** — a v4 save contains no record of decrees, and deriving
one from current sentiment would invent a history the player never made.

**Tests:** 38 in `grievance.test.ts`, 12 in `monarchy.test.tsx`, 5 more in
`migrations.test.ts`. Human-eye checks are `docs/MANUAL-QA.md` §14.

**Coupled to item 7, and now settled by it.** While this shipped alone both paths
still enacted instantly, so the crown's speed showed up only as a lower capital
price. Item 7 gave the republic something that can refuse, and the difference is
now the one the brief describes.

---

### Item 7 — Congress and the republic path: complete

**What it is for.** Item 6 built the monarchy's side of the bargain and left the
republic's side missing: a bill cost capital and then passed, so "the crown buys
speed" bought speed over nothing. **Congress is the thing that can say no.**

**The seat record is history; the party split is a model, and the screen says
so.** 65 House seats under the Constitution's original allocation, 105 from the
Third Congress under the Apportionment Act of 1792 (1 Stat. 253), two senators
per state, and the real admission dates for Vermont, Kentucky and Tennessee. What
is *not* sourced is which way each state's delegation leaned, so that is derived
and labelled as derived — `BLOCKERS.md` B-006 records what would clear it.

**How a delegation makes up its mind.** Party line, plus its own state's
interest, minus its grievance. Every term is a named reason the player can read,
and the reasons sum to the verdict exactly the way a stat's contributions sum to
the stat. **Sectional interest can override the party line**, which is the point:
a Federalist delegation from a shipping state does not vote to close its own
harbour, and no discipline changes that.

**Parties are dated content.** Only Pro-Administration and Anti-Administration
exist until 4 March 1793, because that is what existed. The Federalists and
Democratic-Republicans *succeed* them rather than replacing them, so a delegation
seated under the old name is still counted under the new one — the interests
became the parties (D-030).

**Three tools, each with a price on the button**, and the projected division
visible *before* committing: whipping (capital per point), riders (capital, and
the rider's effect ships with the bill), and promises (capital now, twice as much
later, or legitimacy if the promise is broken). Whipping and riders are spent
whether the bill carries or not, and the UI says so.

**Defeat costs something.** Legitimacy, rising with each defeat to a cap, plus a
240-day cooldown on the bill and a chronicle entry naming the chamber and the
division. Cooldowns, promises and the defeat count survive an election; whipping
does not, because the members it bought are gone.

**Elections** seat a new Congress on 4 March of every odd year, drawn from the
country as it now is. A region the government has alienated returns members who
vote it down. This is the republic's answer to mortality: the player never
leaves, but the country they must persuade is not the one they persuaded before.

**The Senate lags, and that is constitutional rather than tuned.** Article I §3
divides the senators into three classes, so only a third face election in any
cycle. Found while writing this documentation — the doc said a third, the code
re-seated the whole chamber, and the code was wrong. Fixed before the commit
while schema v6 was still free to change (D-032). Without it the Senate held the
same opinion as the House by construction and could never be the chamber that
refused a bill.

**Two model bugs the tests found.** Whip counts came back at zero for any date
after 1793 (delegations keyed to parties that no longer existed — fixed by
resolving forward, which is also the historically correct reading), and the
Federalists enthusiastically supported federal emancipation because a negative
affinity times a negative reaction read as a positive. The second changed the
model: a party is pleased by its opponents' discomfort only a little, and defends
its own people a great deal (D-031).

**Schema version 6**, `migrations/v5ToV6.ts`, with a committed v5 fixture. It
seats a Congress **as of the save's own day** — a save from 1796 loads into the
Fourth Congress with sixteen states and two parties, not a fresh 1789 one. It
cannot recover a sitting Senate class, so a migrated Senate starts matching the
House and the two diverge from the next election.

**Tests:** 37 in `sim/congress.test.ts`, 15 in `components/game/congress.test.tsx`,
plus migration coverage. Human-eye checks are `docs/MANUAL-QA.md` §15.

**Where the balance now stands.** Both paths cost something real and neither is
strictly better, which is asserted rather than intended: the crown acts cheaply
and accumulates grievance it cannot spend away; the republic acts freely of
grievance and must assemble a majority every single time, paying capital for
votes and standing for defeats.

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

Added in Phase 2, in queue order:

- `taxBases.ts` / `taxes.ts` — the twelve taxable bases, and pure queries and
  updates over the tax and spending instance arrays (item 3).
- `economy/politics.ts` — political capital: accrual, cap, administrative
  capacity, elite support (item 4).
- `bills.ts` — validating, pricing, enacting, amending and repealing a bill,
  and the modifiers it produces (item 5).
- `grievance.ts` — who resents the government, per bloc and per region, and the
  unrest it produces (item 6).
- `succession.ts` — the ruler ages, dies, and is succeeded (item 6).
- `congress.ts` — delegations, the vote model, whipping, riders, log-rolling,
  cooldowns and elections (item 7).
- `offices.ts` — who holds which office on a given day.

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
