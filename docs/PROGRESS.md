# PROGRESS.md

**Live status of the build. Written for a reader with no memory of the session
that produced it.**

If you are resuming with no context: read `DESIGN.md` first, then this file,
then `docs/DECISIONS.md` and `docs/BLOCKERS.md`. Then continue the **Phase 2
queue** below, which is `gov-sim-phase2-brief.md` §9.

**Last updated:** Phase 2 run of 2026-08-16, after queue item 11.

---

## Where things stand

| | |
|---|---|
| Production URL | <https://gov-sim.vercel.app> |
| Deploy | auto-deploys from `main` on push |
| Tests | 735 passing |
| Save schema | version **8** — v1 to v7 saves migrate forward, all seven fixtures committed |
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
| 8 — Bloc model | **complete** — see below and D-033 to D-035 |
| 9 — Map view replacing the Desk | **complete** — see below and D-036 to D-038 |
| 10 — Remaining map modes and state detail panel | **complete** — see below and D-039 to D-041 |
| 11 — Diplomacy tab | **complete** — see below and D-042 to D-044 |
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

### Item 8 — the bloc model: complete

**What it replaced.** Item 5 shipped a deliberately interim answer: a static
table of how much of each bloc lived in each region, with a comment saying item 8
would replace it. A tariff could make the artisans happier. It could not make
there be more of them.

**Membership is now state.** `GameState.blocs.membership[region][bloc]` — a
fraction of that region's population, drifting monthly toward what the economy
and the statute book imply. The old table survives only as `BLOC_MEMBERSHIP_1790`,
the day-0 seed.

**Two properties that look like errors and are not.** The shares do not sum to 1
in either direction:

- **Above 1 on the frontier** (about 1.37), because membership OVERLAPS. Half the
  frontier are small farmers and four fifths are frontier settlers, and most of
  them are both people. A column summing to exactly 1 would be the binary model
  the brief asks us to leave behind.
- **Below 1 in the South** (about 0.60), because a third of the region's people
  were enslaved and belonged to no political interest — they were permitted none.
  Rounding them into "small farmers" would tidy a column by asserting something
  false about 1790. The gap is stated on the Regions screen instead.

**Every driver is a ratio to its own founding value**, so at day 0 every ratio is
1 and nothing moves. The founding is an equilibrium the model sits still in
rather than a point it slides away from — the same discipline `baseProsperity`
carries, and the reason a fresh game does not start drifting for no reason.

**Policy moves blocs through the ledger**, target `bloc.<id>.<region>`, so the
phase-in ramp applies and the breakdown names the statute. Eight bills now do it,
each with its historical argument beside it: the Bank makes financiers, the
Bounties make artisans **out of the farmers**, Commercial Discrimination makes
artisans and unmakes merchants in the same statute, the Land Act and the National
Road move people west, and federal emancipation **dissolves the planters** — an
interest defined by holding people in bondage cannot outlive the bondage.

**Drift is 3% of the gap a month** — a half-life of about 23 months. It falls out
of that, rather than needing a separate mechanism, that a measure repealed before
it has taken hold leaves the country roughly where it found it.

**A model bug the tests caught, and it mattered.** Moving Congress onto live
membership silently collapsed the sectional term: a region's standing is
normalised within the region, and the small farmers are ~62% of every region's
politics, so every region started looking alike. Mean regional spread fell from
0.42 to 0.13 — the property the brief cares most about, lost quietly while the
model still ran. Fixed by weighting the sectional term with a **location
quotient**: what divides a country is not what a measure does, it is whether it
falls here more than elsewhere (D-034). Two tests that failed were corrected
rather than widened, and both are stronger for it.

**Schema version 7**, `migrations/v6ToV7.ts`, with a committed v6 fixture. It
seeds the founding shares and takes the save's own present as its baseline, so a
migrated save behaves like a new game begun on its own date rather than one
carrying a decade of change it never made.

**Tests:** 24 in `blocs.test.ts`, 5 in `monarchy.test.tsx` for the Regions panel,
5 more in `migrations.test.ts`. Human-eye checks are `docs/MANUAL-QA.md` §16.

---

### Item 9 — the map: complete

**The main view is now a map.** The Desk's panels were not thrown away with it —
vitals, crises and the statute book still matter, and the chronicle badge points
at that section — so they sit beneath the map as the summary they always were.
The left nav's first item is `map`, not `desk`.

**Geometry is generated, not shipped.** `scripts/make-map-geometry.mts` reads the
`us-atlas` TopoJSON, already projected to Albers USA in a 975×610 box, and writes
`src/content/map/geometry.ts` — plain SVG path strings. **`us-atlas`,
`topojson-client` and `d3-geo` are devDependencies used only by that script.** The
game ships no map library and no runtime projection maths, and the outlines are
diffable in a pull request like every other piece of content (D-036).

**The outlines are modern, and the map says so.** Virginia here excludes West
Virginia, which did not exist until 1863; Massachusetts excludes the District of
Maine. The brief asked for the simplification to be "documented prominently and
visibly in-game" rather than discovered, so it is written under the map and a
test asserts it is there (D-037).

**What each outline WAS is real data.** `src/content/map/territory.ts` carries a
cited status history per outline — state, organised territory, unorganised,
petitioning, foreign, disputed, sovereign Native nation — running from 1789 to
1861. Rhode Island is *outside the union* in April 1789 and the map colours it
so. Ohio is the Northwest Territory. Louisiana is Spanish until December 1803.
Kansas is still a territory in 1860, which is the whole story.

**Four modes**, as the brief requires: political, support, economic, party. The
bucket-and-word split keeps Rule 7 intact — `src/sim/map.ts` returns a band index
and the word it means, and the component turns a band into a design token. No
arithmetic in the component, no colours in the engine.

**Two honesty rules enforced in code, not by convention:**

- **Absence is drawn, never shaded.** A cell with no figure gets `value: null`,
  its own flat fill, a line explaining why, and a count in the legend. A neutral
  mid-scale grey would read as "about average", which is a claim the model never
  made (D-038). As the country grows the no-data area visibly shrinks, so the map
  shows the government's reach as well as its condition.
- **The regional resolution limit is declared.** Support and economic figures are
  regional, so Virginia and Georgia are always the same colour, and the basis line
  says so rather than implying a per-state result. Party is the one genuinely
  per-state mode, and carries the opposite warning: the seat counts are history,
  the split is a model (B-006).

**Tests:** 28 in `sim/map.test.ts`, 13 in `components/game/map.test.tsx`. Human-eye
checks are `docs/MANUAL-QA.md` §17.

**Item 10 finished the job**, with two modes deliberately left out — see below.

---

### Item 10 — the rest of the map, and the state detail panel: complete

**Seven modes of the brief's nine.** Political, support, economic and party came
with item 9; population, sectional strain and compliance came with this one.

**Population is the one economic-looking map on which states differ**, because
the 1790 census counted them separately. Half history and half model, and the
halves are separable: the census figures are cited, the growth applied to them is
the region's, and the basis line says so.

**Sectional strain is the mode the brief asked most of** — "the map mode that
should make the coming Civil War legible decades in advance". It is a derived
measure, computed on demand rather than stored: the enslaved share of a region's
people, the absolute divergence of its sentiment from the union's, and the
grievance the government has built there (`ECONOMY.md` §7.22).

The first term is the largest, and the consequence is that **the South is already
well up the scale on day one of a fresh game.** That is not a bug to be tuned
out. A map on which 1789 looks calm would be a lie about 1789, and the only
honest way to make the war legible in advance is for the thing that caused it to
be visible from the start (D-040). Divergence is absolute rather than signed,
because New England in 1814 was as far outside the union as South Carolina in
1832 and a signed measure would show one and hide the other.

**Compliance** is where a collapse of legitimacy becomes a collapse of receipts,
and it names any episode of unrest running in the region.

**Two modes were deliberately not built.** Infrastructure needs public works
tracked by region and the model has one national figure; military needs any
military presence at all and the model has spending with nothing it is spent on.
Distributing a national figure across regions by population would look complete
and be entirely fabricated. Logged as `BLOCKERS.md` B-007 with what would clear
each (D-039).

**The state detail panel** gives five of the brief's six things: population, the
region's economy, sentiment, delegation with party shares, and active grievances
with any running episode. The sixth — notable figures — does not exist in this
project, so rather than invent a delegate the panel ends with a **"Not tracked"**
block saying so, alongside the fact that the economy figures are regional and
that roads and garrisons are not tracked by state (D-041). A place outside the
union reads "not zero, none", because a zero would be a measurement and none was
taken. Census figures appear in the steel reserved for historical data.

**Tests:** 45 in `sim/map.test.ts`, 23 in `components/game/map.test.tsx`.
Human-eye checks are `docs/MANUAL-QA.md` §18.

---

### Item 11 — the Diplomacy tab: complete

**Fourteen foreign powers as modelled entities**: Britain, France, Spain, the
Dutch, Portugal; Algiers, Morocco, Tripoli, Tunis; and the Northwestern
Confederacy, Muscogee, Cherokee, Haudenosaunee and Shawnee. Each with a dated
ruler list, its own interests, factual context and sources.

**Native nations are in the same list as Britain**, with the same fields and the
same requirements, because the brief said so and it is right: "sovereign
polities with their own interests, diplomacy, and military capacity, not map
obstacles… the historical record here is ugly and the game shouldn't launder
it." The Northwestern Confederacy's land strength is the third highest of any
power in the game, because it destroyed two American armies.

**Treaties use the ledger. There is no second economy.** A treaty's effects are
`ModifierTemplate`s aimed at the same targets a bill aims at, with the same
phase-in ramp and a new `sourceType: 'treaty'`. Tribute goes into the **civil
outlay line** rather than through a private channel. The Treasury cannot tell a
treaty from a tariff, and the stat popover explains Pinckney's Treaty and the
whiskey excise side by side (D-042).

**Thirteen treaties**, nine of them actually concluded — Jay, Pinckney,
Mortefontaine, Algiers, Tripoli, New York, Holston, Greenville, Canandaigua —
one sought and never obtained, and three counterfactuals whose notes say exactly
what they are departing from. Signing the Jay Treaty raises Britain sharply and
drops France sharply, because that is what happened.

**The world of 1789 does not start at zero.** Britain at −35 for the
northwestern forts, France at +55 for the alliance of 1778, Algiers at −50 for
the ships it was taking, Morocco at +25 for the treaty it kept. Relations decay
back toward each power's own baseline rather than toward neutral, so an envoy is
a standing cost rather than a purchase — and the envoy is deliberately weak,
because one that transformed a relationship would let a player buy past every
treaty prerequisite in a single action (D-043).

**The data-integrity rule applies abroad.** Britain's population is the 1801
census and the panel says 1801. **Most of the others are null**, with a stated
reason — nobody counted the Muscogee in 1790, and Cherokee estimates follow a
smallpox epidemic and a decade of war. Naval and land strength are calibration
constants and the screen says on its face that strength is a model.

**Schema version 8**, `migrations/v7ToV8.ts`, with a committed v7 fixture. It
seeds the 1789 baselines and **signs nothing** — awarding a 1798 save the
treaties historically concluded by then would credit the player with the hardest
achievement in the item (D-044).

**Tests:** 28 in `sim/diplomacy.test.ts`, 16 in
`components/game/diplomacy.test.tsx`, 5 more in `migrations.test.ts`. Human-eye
checks are `docs/MANUAL-QA.md` §19.

**Left for item 12:** declaring war. `PowerRelation.atWar` exists and every
query already respects it; the declaration paths that set it are the next item.

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
- `blocs.ts` — who the country is made of, and how policy and the economy
  change that (item 8).

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
