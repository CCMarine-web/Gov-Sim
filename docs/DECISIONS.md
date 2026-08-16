# DECISIONS.md

Decisions taken on the project owner's behalf during the autonomous runs of
2026-08-15 (Phase 1) and 2026-08-16 (Phase 2), with reasoning. Reverse anything
here you disagree with.

Format: what was decided, why, and what the alternative was.

D-001 to D-009 are Phase 1. D-010 onwards are Phase 2.

---

## D-001 — Enacting a budget charges legitimacy through the modifier ledger

**Context.** The queue said "Enacting writes modifiers through the ledger like
everything else." But tax rates are not modifiers — they are inputs to the
economy formulas (`ECONOMY.md` §7.5–7.9). A tariff is not a stat adjustment.
So there was a question of what, if anything, should go through the ledger.

**Decided.** Enacting a tax *rise* applies a `policy`-type modifier to
legitimacy, proportional to the aggregate rate increase, expiring after two
years. Tax cuts cost nothing and buy nothing.

**Why.** It makes the ledger entry meaningful rather than ceremonial: the
player can hover Legitimacy and see which of their own decisions is weighing on
it. It also implements the "cost of unilateral action" row of `DESIGN.md` §9.2,
which had no implementation before — a monarchy pays 0.55× what a republic
pays for the same rise. That row was previously documented but inert.

Cuts buy no legitimacy deliberately: if they did, the optimal play would be to
oscillate rates to farm it.

**Alternative rejected.** No ledger involvement at all, letting the rates speak
for themselves through the economy. Simpler, but it left §9.2 unimplemented and
made the Enact action feel weightless.

---

## D-002 — The Treasury projection enacts through `enactPolicy` rather than setting rates directly

**Context.** `projectPolicy` originally cloned the state and assigned the
proposed rates. A test comparing the projection against actually playing the
same policy found a mismatch of about 0.02% (1,170 on ~7M of receipts).

**Cause.** `enactPolicy` charges the D-001 legitimacy cost; the projection did
not. Lower legitimacy feeds lower compliance feeds lower revenue, so the
projection was systematically *optimistic* about policies it was recommending.

**Decided.** The projection now calls `enactPolicy` on its clone — the same
function the Enact button uses.

**Why.** The mismatch was small but it was drift between two code paths, which
is precisely what the projection module exists to prevent. One path means they
cannot disagree. A projection that is optimistic about the cost of the thing it
is projecting is the worst possible failure mode for that screen.

---

## D-003 — The projection runs against an empty content pack

**Decided.** Forward simulation for the Treasury projection suppresses all
events.

**Why.** Two reasons. A projection that fired a `pausesGame` event would block
on a pending decision and never return. More importantly the player is asking
"what does this policy do", not "what will happen to me over the next year" —
folding the Jay Treaty into a tariff projection would make the number
unreadable.

**Alternative rejected.** Running with real content and auto-resolving
decisions. That would have meant the projection silently choosing on the
player's behalf, which is worse than excluding events.

---

## D-004 — The projection horizon is 365 days, and both columns are simulated

**Decided.** Both the "current policy" and "projected" columns are forward-
simulated over the same 365 days.

**Why.** Comparing a forward-simulated proposal against today's un-simulated
actuals would attribute a year of ordinary drift to the player's slider. Same
horizon for both makes the delta attributable to the policy alone.

365 days specifically because the lag constants in `ECONOMY.md` §7.1 run up to
12 months for prosperity — a shorter horizon would hide the compliance collapse
that a punitive excise causes, which is the single most important thing the
screen has to communicate.

**Consequence for the docs.** `UI.md` §5.4 previously said the projection
excludes lagged sentiment and compliance effects. That is now false — it
includes them, because it is a real forward simulation. `UI.md` updated.

---

## D-005 — Redundant UI state removed rather than worked around, twice

**Context.** The `react-hooks/set-state-in-effect` lint rule fired twice: once
on the event modal's visibility, once on the Treasury's "computing" flag.

**Decided.** Both times, delete the state rather than suppress the rule.

- The event modal cannot be dismissed without answering, so "is a decision
  pending" was already the complete answer to "should the modal show".
- The Treasury projection is stored together with the draft and state it was
  computed from, so "are we still computing" is a comparison, not a flag.

**Why.** The brief said a lint rule fighting you is usually pointing at a real
design problem. It was, both times: one fact held in two places.

---

## D-007 — Sourced the price index and implemented the real-terms comparison

**Context.** `ECONOMY.md` §11.7 recorded decision (b) — compare GDP in real
terms — but the price index had not been sourced, and `BLOCKERS.md` B-002 was
open.

**Decided.** Retrieved the MeasuringWorth annual consumer price index for
1789–1801, stored it as benchmark data with its citation, and implemented
deflation to constant 1790 dollars in the History view.

**Why.** The recorded decision turned out to be workable after all — the index
was one fetch away. The apparent GDP shortfall fell from 45% to about 24%, and
the residual is attributable to the exogenous post-1793 shipping boom rather
than to a modelling error.

**Design note.** Deflation happens at read time and is labelled on screen as a
derivation. The data files keep the nominal figures exactly as published,
because a converted figure is not the figure the source printed.

---

## D-008 — GDP per head is derived from two rows, and says so

**Decided.** The History view computes historical GDP per head by dividing the
GDP figure by the population figure, rather than sourcing it separately. The
resulting cell carries a note naming both source years and stating it is not
separately sourced.

**Why.** No separate per-capita series was available, and deriving one is
arithmetic rather than invention — provided the derivation is disclosed. The
subtlety is that the two inputs are often from different years (population is
decennial), so the note names both.

**Alternative rejected.** Rendering the row as unavailable. That would have
been over-cautious: the inputs are both sourced and the division is not an
estimate.

---

## D-009 — The historical trajectory line is broken across data gaps

**Decided.** In the trajectory charts, the historical line is drawn only
between figures in **consecutive years**. Population, which exists only for
1790 and 1800, renders as two open markers with no line joining them, and the
chart is annotated "gaps: no annual data".

**Why.** Drawing a line between 1790 and 1800 would assert nine years of values
that no source provides. A line is a claim about the points between its
endpoints. This is the charting equivalent of the no-interpolation rule.

---

## D-006 — Enslaved population growth (carried over, recorded here for completeness)

Decided before this run but not previously logged. Enslaved population grows at
the same rate as its region rather than at a separately calibrated rate.

**Why.** A static enslaved population shifted the labour mix toward the lower
free-participation rate every month, dragging output per head downward for no
reason the player caused. Same-rate growth holds the mix stable and is close to
the record (nationally 697,697 in 1790 to roughly 894,000 in 1800, slightly
slower than total population).

**Outstanding.** Should be anchored against 1800 census state-level figures.
Logged in `BLOCKERS.md`.

---

# Phase 2

## D-010 — A DOM test environment was added, opt-in per file

**Context.** Brief §0.1 asked for a regression test that would have caught the
number flicker, and specifically for the verification to be pushed into code
rather than left to a human watching the screen. The test suite had no DOM:
`vitest.config.mts` sets `environment: 'node'` deliberately, because running the
simulation tests without a DOM is what enforces DESIGN.md Rule 1.

**Decided.** Added `jsdom`, `@testing-library/react` and `@testing-library/dom`
as **dev** dependencies. The default vitest environment stays `node`. Component
tests opt in per file with a `// @vitest-environment jsdom` docblock.

**Why.** Opting in per file keeps the Rule 1 guarantee intact — a `window`
reference that leaks into `src/sim/` still fails, because the simulation tests
still run with no DOM. A global jsdom environment would have quietly removed the
enforcement that made Rule 1 real.

Nothing ships to the browser: all three are `devDependencies` and none is
imported by application code.

**Alternative rejected.** A second vitest project for UI tests. More
configuration for the same result, and two configs drift.

---

## D-011 — The number flicker: diagnosis before the fix

**The hypothesis, written before touching code**, per the brief's instruction to
diagnose first. Five suspects were offered. Taking them in order:

| Suspect | Verdict |
|---|---|
| Value-interpolation animation restarting on every publish | **Not the cause.** There is no interpolation anywhere in the codebase. DESIGN.md §6.3 and §6.5 promise it; it was never built. See D-013. |
| Unstable React keys causing remounts | **Not the cause.** Measured: 2,000 frames of the full shell under a running clock produced **zero** DOM node identity changes for any stat. |
| Conditional rendering briefly returning null between frames | **This is the cause**, in the Treasury panel. Details below. |
| `tabular-nums` missing somewhere | **Not the cause.** Every numeric display goes through `<Stat>` or a `.tabular` span; the utility is defined in `globals.css` and both fonts carry `tnum`. |
| The throttle and the animation duration fighting each other | **Effectively yes** — but it is the throttle and a *debounce* fighting, not an animation. |

**The actual mechanism.** `TreasuryPanel` computed its projection in a
`useEffect` whose dependency array was `[state, draft]`, where `state` is the
published snapshot. The loop publishes a **new state object four times a
second** while the clock runs (DESIGN.md §6.2). So, on a 250ms cadence:

1. A publish arrives. `state` is a new object.
2. `fresh = result.forState === state` becomes false, so `projection` becomes
   `null`.
3. Every figure on the screen renders as an em-dash: all five projection rows in
   both columns, the three per-slider revenue figures, and the header flips to
   "simulating…".
4. The effect re-runs. Its cleanup clears the pending 180ms debounce and starts
   a new one.
5. 180ms later the debounce fires, two full 365-day forward simulations run
   **synchronously on the main thread**, and the figures reappear.
6. 70ms after that the next publish arrives and it starts again.

So the Treasury screen's numbers blanked out and returned four times a second,
and the machine ran 8 × 365 simulated days per second to achieve it. That is
both halves of the report — the flicker *and* the "feels broken" — from one
defect.

The 180ms debounce being shorter than the 250ms publish interval is why the
numbers reappeared at all. Had it been longer than 250ms, the effect's cleanup
would have cancelled every pending computation and the projection would have
shown em-dashes **permanently** while the clock ran. The bug was 70ms away from
being much more obvious.

**Why no test caught it.** There were no component tests at all. Every existing
test of this area asserts that `comparePolicies` returns the right numbers,
which it does. The defect is entirely in *when* the component asks for them.

---

## D-012 — The projection re-bases on material change, not on every publish

**Decided.** The Treasury projection recomputes when its *basis* changes, not
when the state object's identity changes. The basis is defined in
`src/sim/projection.ts` as `projectionBasisKey(state)`, covering:

- the day the economy was last recomputed (the monthly cadence — everything
  downstream of it is constant in between),
- the committed tax rates and spending,
- the enacted law set,
- the active modifier ledger, by id and value.

Deliberately **excluded**: `state.day` and the treasury balance. One day of
accrual does not move a 365-day forward simulation by anything a player could
read, and including it is precisely what forced a recompute on every tick.

**And the numbers never blank.** While a fresh projection computes, the previous
one stays on screen and is labelled with the in-game date it was computed from.
A figure that is twenty days stale and says so is better than an em-dash, and
far better than an em-dash that flashes.

**Why this shape.** The alternative — memoising harder, or comparing states
deeply — treats the symptom. The real statement is that a 365-day projection has
a *basis*, that basis changes monthly, and the screen should say which basis it
is showing. Making that explicit in the sim layer also keeps Rule 7 intact: the
component does not decide what makes a projection stale, `src/sim/` does.

**Alternative rejected.** Recomputing in a web worker so the cost is off the
main thread. That would have fixed the CPU burn while leaving the numbers
flashing, which is the wrong half of the problem, and it would have put the
engine behind an async boundary for no simulation benefit.

---

## D-013 — Displayed numbers do not interpolate, and DESIGN.md now says so

**Context.** DESIGN.md §6.3 said "Displayed numbers interpolate over ~300ms
toward the latest published value", and §6.5 said the display "interpolates
between monthly values so numbers move smoothly rather than stepping once a
month". Neither was ever implemented. The brief's first suspect for the flicker
assumed the animation existed and was misbehaving.

**Decided.** Remove the promise rather than build it. Both sections of DESIGN.md
are corrected in the same commit, per the standing rule that a document and the
code disagreeing is a bug in one of them.

**Why.**

1. **It would display numbers the simulation never produced.** This project's
   hardest rule is that a figure on screen must be accountable to something real
   (Rule 5, §12). An eased tween between $231,204 and $248,911 puts sixty values
   on screen that no tick ever computed, and the stat popover — which shows the
   arithmetic behind the number — would disagree with the number beside it.
2. **The reference games do not do it.** HOI4 and Victoria 3 update their
   numbers discretely and reserve the width instead. What makes their readouts
   feel calm is stable layout, not motion.
3. **It is a flicker source, not a flicker cure.** An interpolation retargeted
   four times a second by the publish throttle is the brief's own first suspect.
   Building it to fix a flicker would have been building the thing that was
   suspected of causing it.

**What replaces it.** Layout stability: every `<Stat>` reserves a minimum width
so a changing digit count cannot move anything else on the row. See D-014.

**Reversible.** If the motion is wanted later, the honest form is to animate
only *presentation* — a brief highlight on change — never the digits themselves.

---

## D-014 — The command bar no longer scrolls horizontally

**Context.** The command bar's stat row was `ml-auto flex items-center gap-5
overflow-x-auto`. Two consequences, both bad:

1. **A scrollbar that toggles.** Six stats plus the seal, ruler and clock
   overflow a 1280px bar. `overflow-x-auto` therefore shows a horizontal
   scrollbar — inside a 64px-tall header — and as the rendered values change
   character count (`$8,587` → `$10.0K` → `$231.2K` → `$1.24M`) the content
   width crosses the container width repeatedly, so the scrollbar appears and
   disappears and the whole row jumps. `tabular-nums` does not help: it makes
   digits equal in width to *each other*, not strings equal in length.
2. **Clipped popovers.** `overflow-x-auto` establishes a scroll container, which
   clips absolutely-positioned children. Every modifier breakdown opened from
   the command bar was being cut off — and that breakdown is acceptance
   criterion 4.

**Decided.** Drop `overflow-x-auto`, and give each `<Stat>` a reserved minimum
width so its value can change length without moving its neighbours.

**Note on evidence.** Unlike D-011 this was found by reading, not measured:
jsdom has no layout engine, so a scrollbar cannot be observed in a test. The
popover clipping, however, is unconditional and follows from the CSS alone.
Recorded in `docs/MANUAL-QA.md` as a check to make with human eyes.

---

## D-015 — The speed table before the rebalance, recorded

Brief §0.2 asked for the existing values to be written down before anything
changed. There was no table to read: the rates were a formula,
`msPerDayAt(speed) = 1000 / speed`, over three hard-coded speed values.

**What Phase 1 shipped:**

| Control | ms per in-game day | In-game days per real second |
|---|---|---|
| 1x | 1000 | 1 |
| 2x | 500 | 2 |
| 5x | 200 | 5 |

Consequences worth recording, because they are the baseline the rebalance is
measured against:

- A full Phase 1 run (4,263 days) took **71 minutes at 1x**, 14.2 minutes at 5x.
- The keyboard mapping was `1` → 1x, `2` → 2x, **`3` → 5x**. There was no key
  for a "3x", because there was no 3x.
- The three values existed in five places that had to agree: the formula in
  `gameLoop.ts`, the `Speed` union in `gameStore.ts`, the `SPEEDS` array in
  `CommandBar.tsx`, the switch in `GameShell.tsx`, and the prose in
  `KeyboardHelp.tsx`. Nothing enforced that they did agree — which is the
  "magic numbers scattered around" the brief asked to eliminate.

---

## D-016 — Five speeds, expressed as one table, with 5x uncapped

**The requirement.** Brief §0.2: the old 5x becomes the new 3x, 1x and 2x scale
down proportionally, 4x is meaningfully faster than 3x, and 5x is uncapped in
the HOI4 sense — as fast as the machine can process.

**Decided.** `src/runtime/speeds.ts` holds the single table:

| Control | ms per in-game day | In-game days per real second | Full Phase 1 run |
|---|---|---|---|
| 1x | 600 | 1.67 | 43 min |
| 2x | 300 | 3.33 | 21 min |
| 3x | 200 | **5** | 14 min |
| 4x | 100 | 10 | 7 min |
| 5x | *uncapped* | as fast as the engine can process | seconds |

**Why these numbers.** 3x at 200ms/day is *exactly* the old 5x, as asked. The
proportionality then falls out cleanly: 600, 300, 200 give day rates in a
precise 1 : 2 : 3 ratio, so a control labelled 2x really does run twice 1x. 4x
doubles the 3x rate rather than nudging it — "meaningfully faster" should be a
step you can feel, not a 20% trim.

The fractional day rates at 1x and 2x are a consequence of anchoring 3x to a
round *interval* rather than a round *rate*, and anchoring the interval is
correct: the interval is what the loop actually uses, and 600/300/200/100 are
exact in floating point where 5/3 and 10/3 are not.

**How uncapped works.** At 5x the accumulator is bypassed entirely. The frame
simulates days continuously until it has spent its wall-clock budget
(`UNCAPPED_FRAME_BUDGET_MS`, 8ms — half a 60Hz frame), then yields to the
browser. There is no fixed day cap; a faster machine simply gets more days per
frame, which is the requested behaviour.

Two guards remain, and both matter:

- **The publication throttle is untouched.** It is a wall-clock throttle, not a
  per-day one, so it holds at any simulation rate by construction. The brief
  predicted this is where things would break; it is asserted directly now, and
  D-017 records what the assertion measured.
- **`UNCAPPED_MAX_DAYS_PER_FRAME` (400) is a backstop, not a cap.** A frame
  bounded only by wall-clock time never terminates under a stopped clock, which
  is exactly the situation in a test with a controllable clock — and would also
  be the situation if `performance.now()` were ever coarsened. 400 days per
  frame is ~24,000 days per second at 60Hz, several times faster than any real
  machine reaches, so it never binds in play.

**Pause-on-decision still halts on the day.** The uncapped loop checks
`pauseRequested` on every day exactly as the accumulator loop does. Running
fast must not mean running past a decision.

**Alternative rejected for the 5x label.** Making 5x a large finite rate (say
50 days/second) instead of genuinely uncapped. It would have been simpler to
reason about, but the brief was specific and the reasoning is sound: a finite
top speed makes the late game slower on a fast machine for no benefit.

---

## D-017 — Uncapped speed runs past the end of the content, and that is logged not fixed

**Context.** At the old top speed, reaching 1800-12-31 took fourteen minutes of
play. Uncapped, it takes seconds — and nothing stops the clock there.

**Decided.** Log it (`BLOCKERS.md` B-005) with a recommendation, and verify that
running past the horizon is harmless, rather than building a stop now.

**Why.** Two defensible fixes exist and choosing between them is a content
decision, not a clock one: stop at the content horizon, or extend the content.
Queue items 5 through 12 add a great deal of content and the brief takes the game
to 1860, so the horizon is about to move. Building a stop against a boundary that
is about to change would mean building it twice.

**What was verified rather than assumed.** Four tests run ten further years, to
1810, and assert the calendar stays correct, the run stays deterministic, no
value becomes NaN or non-finite, and the state still round-trips through JSON so
a save taken there loads. It is a design gap, not a defect — and if any of those
four ever fails, that is the moment it becomes one.

---

## D-018 — Taxes and spending become instances, and the change moves no number

**Context.** Brief §4.3, and its own assessment: "Getting this data model right
is the single most important structural change in this brief — do it before
building any UI on top of it." Phase 1 had `taxRates: { tariffAvg, excise,
landTax }` and `spending: { military, civil, infrastructure }`. A bill cannot
create a tax when the only taxes the engine can compute are three fields with
three bespoke formulas.

**Decided.** `PolicyState.taxes: TaxInstance[]` and
`PolicyState.programs: SpendingProgram[]`, with a tax-base registry in
`src/sim/taxBases.ts` saying what each base is worth and how it behaves.
`SCHEMA_VERSION` goes to 2 with a registered migration and a committed fixture.

**The constraint that shaped everything: it had to move no calibrated number.**
Every solved constant in `ECONOMY.md` §9.1 — `AG_PRODUCTIVITY`,
`MAN_PRODUCTIVITY`, `TRADE_SERVICES_MULTIPLIER`, `START_TRADE_CAPACITY` — is
anchored to the day-0 equilibrium composing to the verified 1790 GDP of $193M.
A structural change that shifted revenue by even a per cent would have
invalidated the whole calibration and the History comparison with it.

So the general per-instance formula is arithmetically identical to the three it
replaced for the three founding taxes, and `src/sim/taxes.test.ts` asserts that
directly against `computeCustomsRevenue`, `computeExciseRevenue` and
`computeLandRevenue` rather than trusting it. The three old formulas were kept
rather than deleted, precisely so that assertion is possible.

**Decisions inside the decision:**

- **Old fields removed, not kept alongside.** Keeping `taxRates` as a derived
  mirror would be one fact in two places, and the stale copy would be the one a
  future reader trusted.
- **A repealed tax is not deleted.** `repealedDay` is set and the instance stays,
  so a run keeps the record of what was levied and when. Every query asks about
  taxes *in force on a day* rather than about the array's contents.
- **Several taxes on one base sum.** Two duties on imports are, to the merchant
  and to the trade-suppression curve alike, one duty at the sum of their rates.
- **Founding taxes collect at efficiency 1.0.** Their assessed bases were solved
  against observed revenue, so collection losses are already inside those
  figures; a second factor would double-count. Later bases carry an efficiency
  relative to that baseline, which is stated in `ECONOMY.md` §7.8b rather than
  left as an unexplained 1.
- **`enactTax` is a separate effect from `setTaxRate`.** Creating a statute and
  changing a rate are different political acts and should read differently in
  the chronicle. The 1791 whiskey event now *enacts* the excise, with its real
  name and its statutory exemption; the 1794 rebellion's concession *repeals* it
  rather than setting it to zero, so the Treasury line goes.

**Alternative rejected.** Keeping the three fields and adding an
`extraTaxes: TaxInstance[]` array beside them. Less work, and it would have
produced two code paths for the same concept — which is the exact failure mode
D-002 already caught once on this project.

---

## D-019 — Revenue attribution is a ledger of lines, not entries in the modifier ledger

**Context.** Brief §4.3: "the modifier ledger attributes each dollar to its
originating law by name."

**Decided.** Revenue is **not** routed through `Modifier[]`. It gets
`TreasuryState.receiptLines: RevenueLine[]` and `outlayLines: OutlayLine[]`
instead — one line per tax in force, naming the tax, the bill that created it,
the assessed base, what was lost, and what arrived.

**Why not the modifier ledger.** A `Modifier` is an additive or percentage
adjustment to a stat, resolved as `base → flat → percentage → clamp`
(DESIGN.md Rule 5). Revenue is a sum over instances with no base and no
percentage stage. Forcing it through would mean lying about what a modifier is,
and it would fill `activeModifiers` with a dozen entries per month that the
ledger-hygiene rules would then have to special-case.

What the brief is actually asking for is the *guarantee*, not the data
structure: every displayed number accountable to a named source, summing
visibly to its total. That guarantee is honoured exactly, in the structure that
fits — and a test asserts the lines reconcile both to the headline receipts and,
line by line, gross minus losses to net.

**The one addition worth arguing for (see D-020 for a related judgement).** The
losses are reported as two figures, not one:

- **not remitted** — a region assessed but did not pay. A question of *consent*.
- **uncollected** — the administration could not reach it. A question of
  *capacity*.

They have different causes and different remedies, and a government whose
problem is administrative capacity needs a different answer from one whose
problem is that a region has stopped obeying it. Collapsing them into a single
"losses" column would show a number the player could not act on.

---

## D-020 — Political capital sits beside legitimacy rather than replacing it

**Context.** Brief §3 asks for one currency, accruing daily, gating what the
government can do. The project already has legitimacy, which also falls when the
player acts unpopularly (D-001). The obvious question is whether the new
currency should absorb the old one.

**Decided.** They coexist and answer different questions:

| | Question |
|---|---|
| **Legitimacy** | Does the country accept your right to govern? |
| **Political capital** | Can you actually get *this particular thing* done? |

The relationship runs one way: legitimacy **feeds** capital accrual, and
spending capital does not spend legitimacy. Acting unpopularly costs both,
through two separate mechanisms — capital because the act consumed the
government's capacity, legitimacy because the country minded.

**Why not merge them.** A government can be widely thought legitimate and still
unable to move; it can also burn its standing acting decisively. Both are true
of real governments, and one number cannot express both. It also matters
mechanically: legitimacy already drives compliance, and folding an action cost
into it would mean every bill quietly reduced tax collection, which is a
consequence no player would predict from the interface.

**Decisions inside the decision:**

- **Charged on absolute movement**, unlike the legitimacy cost, which falls only
  on rises. Lowering a tax still takes a bill through. Together the two costs
  close the last door on rate-oscillation as a way to farm the model.
- **Refusal states a reason and a wait.** `canAffordPolicy` returns the
  shortfall in days of accrual, and `enactPolicy` throws if a caller skips the
  gate. A control that declines without explanation is the same failure the
  modifier ledger exists to prevent, applied to actions instead of numbers.
- **Wasted capital is counted.** `totalWasted` accumulates whatever accrues into
  a full reserve. "Hoarding is not a strategy" is a design claim, and this is
  the number that makes it falsifiable rather than merely asserted.
- **The founding position is derived, not seeded.** Day-0 accrual and cap come
  from the same formulas the monthly recompute uses, so the starting position
  cannot drift from what the model would compute for it.

---

## D-021 — Administrative capacity is read from the historical office record

**Context.** Brief §3 lists cabinet quality among the accrual drivers. Cabinet
competence and loyalty are queue item 13, so the obvious move was an inert
placeholder returning zero until then.

**Decided.** Use what already exists and is already sourced: the real record of
which executive departments existed and who held them
(`src/content/government/cabinet.ts`). Capacity is how much of the government
exists multiplied by how much of what exists is staffed.

**Why this is better than a placeholder.** It is real from day one, it is
grounded in cited historical fact rather than invented, and it produces a
genuinely interesting opening position: capacity on 30 April 1789 is **zero**,
because the Department of State was created on 27 July, War on 7 August, and the
Treasury not until 2 September. The player begins holding an office in a
government that does not yet exist, and watches the machinery get built. An
inert placeholder would have thrown that away.

Item 13 then replaces "how many offices are filled" with "how competent and
loyal the people filling them are" without touching any of the plumbing.

**The consequence that had to be handled.** The engine now reads offices, so
`ContentPack` gained an `offices` field and `Office`/`Tenure` moved into
`src/sim/types.ts` — content declares, the engine interprets, which is Rule 4
working normally. It also meant threading the content pack into
`projectPolicy`, which is an improvement on its own terms: the projection is now
a pure function of state, proposal and content rather than of state and proposal
with a hidden content pack inside it.

**What it turned up.** Clamping the office census at the end of the record
exposed that the cabinet data was **missing two real officers**: John Marshall
as Secretary of State from 6 June 1800 and Samuel Dexter as Secretary of War
from 12 June 1800. Both are documented and both are now in the record with
citations. A modelling change surfacing a genuine content gap is the system
working.

---

## D-022 — Fixtures are protected by the script, not by a comment

**Context.** D-018 established that a save fixture must be generated once and
never regenerated, because a fixture rebuilt from current code restates the new
format instead of recording the old one and makes its own test pass by
construction. That rule was written as a comment in a single-purpose script.

**Decided.** `scripts/make-fixture.mts <version>` takes the version as an
argument, knows how to downgrade through every released shape, and **refuses to
overwrite a fixture that already exists**.

**Why.** A comment saying "do not run this again" is obeyed by whoever reads it.
The next person to need a v3 fixture will copy the script, and the copy is where
the rule gets lost. Making the refusal executable means the rule survives being
forgotten — which is the only kind of rule worth having in a project meant to be
picked up by a session with no memory of this one.

---

## D-023 — `Bill` replaces `Law` outright rather than sitting beside it

**Context.** Brief §4 gives a bill schema — department, four capital costs, a
slider, prerequisites, historicity, bloc reactions — modelled on Democracy 4's
policy structure. Phase 1 had `Law`: a title, a treasury cost, some effects, six
instances of it.

**Decided.** `Law` is gone. `Bill` replaces it, the six existing laws are carried
forward into the new schema, and `ContentPack.laws` becomes `ContentPack.bills`.
`policies.enactedLawIds: string[]` becomes `policies.bills: EnactedBill[]`, and
the condition and effect kinds are renamed to match (`billEnacted`,
`unlockBill`, `repealBill`).

**Why not keep both.** Two shapes for one concept means every screen, every
condition and every migration has to handle both, and content authors have to
know which to reach for. The rename cost about twenty call sites and one
migration; carrying two systems would have cost that much again every time
either was touched.

**What the old shape could not express, and why it mattered.**
`enactedLawIds: string[]` recorded only THAT a law had passed. Not when — so a
chronicle could not say. Not at what intensity — so a slider was impossible. Not
that it had since been repealed — so the record of a run's legislative history
was simply absent. `EnactedBill` carries all three.

---

## D-024 — Phase-in is a property of the modifier, not of the stat

**Context.** Brief §4.2 requires `phaseInDays` on every bill: "effects ramp in,
never instant". The obvious objection is that most stats in this model are
ALREADY lagged — stability over three months, sentiment over six, prosperity over
twelve — because modifiers act on the target a lagged stat converges toward. Was
a second ramp double-counting?

**Decided.** No, and `Modifier` gains `rampDays`. The two model different things
and both are real:

- **`rampDays`** is the STATUTE taking hold. Officers have to be appointed, forms
  printed, collectors sent. The Judiciary Act was signed in September 1789 and
  the courts were not sitting everywhere for the better part of a year.
- **The lag constants** are the COUNTRY responding to it. Sentiment moves over
  six months because people take six months to change their minds.

A law's provisions phasing in, and the country's reaction to them lagging, are
sequential rather than duplicative. And for the stats that are *not* lagged —
legitimacy is cumulative, not target-seeking — `rampDays` is the only ramp there
is, so without it the Bank of the United States would deliver its full
legitimacy effect on the day of signature.

**The constraint that shaped the implementation.** The ledger's one invariant is
that `base + Σcontributions + clamp === total`. So the ramp is applied to the
value the breakdown REPORTS, not layered on afterwards: the popover shows what a
modifier is contributing today, plus `rampProgress` so it can say "still phasing
in". A popover reporting the eventual value while the stat reflected the ramped
one would break the one thing the ledger may never break.

**Amending does not restart the ramp.** A law already in force whose rate is
adjusted is not a new law, and making the country absorb it from nothing again
would be wrong.

---

## D-025 — Bloc reactions are declared now and land through a documented weighting

**Context.** Brief §4.2 puts `blocReactions` on every bill; the bloc model itself
is queue item 8. The easy move was to declare the field and leave it inert until
then.

**Decided.** Bills declare their reactions now, and until item 8 lands each bloc
is distributed across the four regions by `BLOC_REGION_WEIGHTS` in
`calibration.ts`. A bill's reactions move regional BASE sentiment in proportion.

**Why not inert.** An unused field rots: nobody can tell whether the numbers in
it are calibrated, because nothing depends on them. Wiring it to something real
means the twenty-eight bills' reactions were written against observable
consequences, and item 8 inherits content that has been exercised rather than
content that has only been typed.

**Why this is honest rather than a fudge.** The weighting is a documented
calibration table with a stated economic geography — the planters are the South's
staple agriculture, the seamen the northern carrying trade — and ECONOMY.md §7.18
says plainly that item 8 replaces it. Nothing in `src/content/` changes when it
does, which is the whole reason for declaring the reactions in the content rather
than deriving them.

**Two details worth defending:**

- **Base sentiment, not current sentiment.** A permanent political fact should
  move the equilibrium a lagged stat converges toward. Applying it to the stored
  value would produce a jump the model immediately undoes.
- **Repeal does not refund it.** A country does not un-resent a law because it
  was taken back, and a repeal that refunded the political damage would make
  passing an unpopular bill temporarily free.

---

## D-026 — What "counterfactual" and "anachronistic" actually mean here

**Context.** Brief §4.4 asks for four tiers. Two are obvious — `enacted` and
`proposed` are matters of record. The line between `counterfactual` and
`anachronistic` is a judgement, and getting it wrong in either direction spoils
the point.

**Decided.** The test is **whether anything made it impossible, as opposed to
merely unlikely**.

| Bill | Tier | Why |
|---|---|---|
| Export duty on staples | anachronistic | Article I §9 cl. 5 forbids it outright. A ratification condition for the South, never amended, still good law. |
| Federal income tax | anachronistic | A direct tax, which Article I requires to be apportioned by population, which income is not. Decisive in *Pollock* (1895); needed the Sixteenth Amendment. |
| General sales tax | **counterfactual** | Constitutionally available as an excise. Nothing forbade it — there was simply no machinery to assess retail sales and no inspectors to send. |
| Federal gradual emancipation | **counterfactual** | Not unthinkable: four northern states had gradual emancipation statutes by 1799. Politically impossible at federal level, which the model prices at 200 capital and −100 planters rather than by locking it. |
| National road programme | counterfactual | The constitutional objection to internal improvements was real but contested, and Congress did authorise the Cumberland Road in 1806. |

**The principle.** A LOCK is a statement that no amount of political skill could
have achieved this. Anything a sufficiently determined government could have
done is available and *priced*, however dearly. Locking gradual emancipation
would have said the Constitution forbade it, which is false and would misteach
the player about why it did not happen. Pricing it at 200 political capital and
total planter opposition says the true thing: it was possible and nobody could
carry it.

**And every tier carries the history.** A counterfactual needs its factual note
more than an enacted bill does, because the player has to know what they are
departing from. `validateBill` enforces a 120-character minimum and at least one
source on all four tiers.

---

## D-027 — What the monarchy buys, and what it pays: the balance stated in advance

**Context.** Brief §2.1 asks for the decree path, and brief §10.6 requires the
tradeoff each path embodies to be **written down and checked against**: "If
monarchy is strictly better than republic, or a single bill trivially wins the
game, that's a defect."

**The tradeoff, stated before the numbers were chosen.**

> The crown buys SPEED and pays in CONSENT. It can act when a legislature could
> not afford to, and the country remembers every time it does.

**How that becomes mechanics:**

| | Monarchy | Republic |
|---|---|---|
| Capital to act | **×0.35** — no votes to whip | full |
| Legitimacy to act | floor + power-weighted opposition | **none** |
| Grievance created | **×4** | ×1 |
| Legitimacy decay | none | continuous |
| Ruler mortality | yes, −9 legitimacy each time, −26 if disputed | no |
| Capital ceiling | ×0.75 | full |

**The two decisions inside this that were not obvious:**

1. **The republic pays NO legitimacy for legislating.** Not because passing a
   bill is free, but because its cost is already charged in political capital,
   which is dear precisely because a coalition has to be assembled. Charging
   both would make the republic strictly worse — the exact defect the brief
   names.
2. **The 4:1 grievance ratio is the load-bearing number.** Set the two rates
   equal and the republic's slowness buys nothing at all. A decree is imposed
   and the losers had no opportunity to be heard, so the whole of their
   opposition becomes resentment at the government; a bill argued through is one
   the losers were part of losing.

**How it is checked rather than asserted.** `src/sim/grievance.test.ts` has a
section titled "the two paths trade against each other" which proves the
specific claim: a measure out of reach for a legislature is within reach for a
decree, and the crown is then left holding several times the grievance the
republic avoided. A final test decrees five measures in succession and asserts
the country stops paying.

**Still to come.** Item 7 adds Congress, and the crown's advantage becomes far
more visible: today both paths enact instantly, so the monarchy's speed shows up
only as a lower capital price. When bills have to survive a vote, the difference
becomes the difference the brief describes.

---

## D-028 — Whether a succession is disputed is the player's doing, not a die roll

**Context.** Brief §2.1: "Succession crises when no clear heir exists." The
straightforward implementation gives a new ruler no heir, so the second death in
any dynasty is a crisis. That is what was built first, and running the tests
showed what was wrong with it: **every monarchy is guaranteed a crisis, whatever
the player does.** A punishment with no cause is not a mechanic.

**Decided.** A new ruler is credited with an heir if and only if
`legitimacyBase ≥ HEIR_SECURITY_THRESHOLD` (42), and the founding monarch always
has one.

**Why.** A dynasty with standing to spare has an obvious successor and nobody
troubles to dispute it. One that has spent its standing — on decrees, on
unpopular measures, on crises mishandled — finds that the question of who comes
next is suddenly worth arguing about. That gives the monarchy's worst outcome a
cause the player controls, and it closes the loop: decree freely, lose
legitimacy, and the succession you were relying on stops being safe.

**Deliberately not random.** Mortality is rolled; the *character* of the
succession is derived. Whether a dynasty's next step is settled ought to be a
consequence of how it has governed, and rolling for it would take that back out
of the player's hands.

**Surfaced on the Government screen**, in both states and in words, so a player
can see which one they are currently in before it matters.

---

## D-029 — Two bugs the tests found, recorded because the shape of them recurs

Both were caught by tests written before the code was believed finished, and
both are the same kind of mistake — comparing things by identity when the
question was about ORDER.

**1. Unrest could not survive the smallest dip.** `reconcileUnrest` closed a
running episode whenever the warranted severity differed from the running one —
including when the warranted severity was *lower*. A region at 53 with a
defiance episode running would see a wanted `resistance`, read "different", and
close. With the hysteresis margin that should have held it open, the effect was
an episode that ended and restarted every month and a chronicle full of a
rebellion that kept changing its mind. Fixed by comparing severities by **rank**
rather than by name.

**2. The decay tests were measuring the succession cost.** Two long-standing
tests asserted the monarchy loses almost no legitimacy over two years. They
began failing at 26 points — which was the new succession mechanic working
correctly: the default seed's second RNG draw is 0.0034, which kills even a
young king. The tests now use a seed whose early draws are all well clear of any
mortality rate, and **assert that no succession happened**, so a future seed
change fails with "the seed produced a succession" rather than looking like a
broken decay term.

The general lesson worth keeping: when a test that was passing starts failing
after a feature lands, the first question is whether the test was measuring what
it claimed to. Twice here it was not.

---

## D-030 — A party is a coalition of interests, not a list of positions

**Context.** Brief §2.2 asks for parties with "positions on issue axes (federal
power vs states' rights, commercial vs agrarian, pro-British vs pro-French,
fiscal, slavery)", and for members carrying regional interests that can override
the party line.

**Decided.** Parties are defined by `blocAffinity` — how strongly they take each
of the eight blocs' side — rather than by positions on five axes. The vote is
the dot product of a party's affinities and a bill's bloc reactions.

**Why this is the same idea, better encoded.**

1. **It reuses data every bill already carries.** Bills declare whom they help
   and harm (D-025), and those reactions have been exercised by the grievance
   system since item 6. Axis positions would be a second, parallel description
   of the same thing, authored separately for 32 bills and free to disagree with
   the first.
2. **It is what a party in this period actually was.** The Anti-Administration
   interest was not a programme; it was the planters, the small farmers and the
   west against the funding system. Encoding it as a coalition says the true
   thing.
3. **A new bill needs no new field.** Adding a bill in Phase 3 requires no
   thought about where it sits on five axes, and cannot be silently
   mis-positioned by leaving one out.
4. **The sectional term falls out naturally.** Weighting the same affinities by
   where each bloc lives gives a Virginia Federalist and a Massachusetts
   Federalist different votes on the same bill — which is exactly what the brief
   wants from the axes, obtained without them.

**What is lost.** A party cannot state a position on a question no bill has
touched. That costs nothing today and would matter if the game ever wanted a
party manifesto screen; the affinities would generate one.

**Also decided here: shares, not named members.** A delegation holds *fractions*
of its seats per party rather than a list of members, because this project has
not sourced a state-by-state party breakdown for every Congress. Inventing named
members would dress a model up as a record. A share is honestly a model, and the
Congress screen says so. (`BLOCKERS.md` B-006.)

---

## D-031 — A party is pleased by its opponents' discomfort only a little

**Found by a test, and it changed the model.** The first version of the whip
count took `affinity × reaction` at face value. A negative affinity times a
negative reaction is a positive, so a party set against the planters welcomed a
measure that harmed them **in exact proportion to the damage** — and the model
duly had the Federalists enthusiastically supporting federal gradual
emancipation, because it hurt an interest they opposed.

That is wrong in a way worth stating: **opposing an interest politically is not
the same as wanting it ruined.** The Federalists were more antislavery than the
Democratic-Republicans, and that is captured by their clergy and artisan
affinities; it should not additionally arrive as delight at the destruction of
the plantation economy.

**Decided.** `OPPOSED_BLOC_DISCOUNT = 0.30`. Where a party's affinity for a bloc
is negative, its whole contribution — harm or benefit — counts at three tenths.
A party defends its own people a great deal and is pleased by its opponents'
discomfort a little.

**Why symmetric.** Discounting only harm would mean a party minded its enemy
being *helped* at full strength while barely noticing its enemy being hurt,
which is an odd shape. The discount is about how much the party cares about that
bloc at all.

**What it did not change.** The emancipation bill is still passable — narrowly,
expensively, and against the whole South. It should be: locking it would say the
Constitution forbade it, which is false (D-026). What changed is that it is no
longer a Federalist enthusiasm.

---

## D-032 — The Senate turns over a third at a time

**Date:** 2026-08-16 (Phase 2, queue item 7)
**Status:** implemented

**The problem, found while writing the documentation for item 7.** The doc I was
drafting said Congress "re-seats the whole House and a third of the Senate". The
code re-seated both entirely. One of the two was wrong, and it was the code.

That is not a cosmetic mismatch. A delegation carried **one** party split used
for both chambers, so the Senate held the same opinion as the House by
construction. The only thing separating the chambers was the seat arithmetic —
two per state instead of proportional — which tilts small states but never
produces genuine disagreement. **A second chamber that agrees with the first is
decoration.** In a hundred simulated votes it would almost never be the one that
refused a bill.

**Decision: model Article I §3 clause 2 properly.** The senators are divided
into three classes and one class expires every second year. A delegation now
carries `share` for the House and `senateShare` for the Senate, and at each
election:

```
senateShare' = fresh × 1/3 + sitting × 2/3
```

**Why one third is not a tuning knob.** It is what the clause says. It goes in
`calibration.ts` next to the tuned constants because that is where the engine's
numbers live, but its provenance is the Constitution, and the comment above it
says so. If a future session is looking for something to rebalance, this is not
it.

**What it buys the game.** A real brake with a real shape. A government that
turns the country around still has to argue with the country as it was up to six
years ago; a government that has just lost the country keeps a Senate that has
not caught up. Both directions cost the player something, which is what
distinguishes an obstacle from a punishment. It also gives the player a reason to
care *when* they push a bill, not only whether they can afford it.

**Cost of doing it now rather than later.** Almost nothing, and that is why it
was done immediately rather than logged. Schema v6 was written but not yet
committed, so changing the shape of `Delegation` was free. After the commit it
would have needed a v7 and a migration that could not recover the sitting class
anyway. The five minutes were available exactly once.

**What the migration cannot do.** `v5ToV6` starts the Senate matching the House,
because a v5 save records no previous election and there is no sitting class to
recover. The chambers diverge from the next election onward. A one-time loss of
nuance in a migrated save is the correct trade against inventing a history.

**Asserted, not assumed.** Four tests in `congress.test.ts`: the House moves the
whole way and the Senate exactly a third of it; the Senate is measurably behind
the House after opinion swings; a newly admitted state gets its first two
senators outright; and a class elected as Anti-Administration still counts once
that interest becomes the Democratic-Republicans, with the shares still summing
to a whole chamber.

---

## D-033 — Bloc membership is state, and the old table survives only as its seed

**Date:** 2026-08-16 (Phase 2, queue item 8)
**Status:** implemented

**The brief asked for two things.** Overlapping, graduated membership; and sizes
that policy can change — "blocs should grow and shrink in response to policy,
not just get happier or angrier". Item 5 shipped an explicitly interim answer: a
static table of how much of each bloc lived in each region, with a comment saying
item 8 would replace it.

**Decision: membership becomes `GameState.blocs`,** a fraction of each region's
population per bloc, drifting monthly toward a target the economy and the statute
book imply. The old table is now `BLOC_MEMBERSHIP_1790` — the day-0 seed, which
is where a founding equilibrium belongs, and nothing more.

**The key discipline is that every driver is a RATIO to its own founding value.**
At day 0 every ratio is 1, so target equals seed and nothing moves. Without this
the country would slide away from the founding on the first tick for no reason
the player caused — the same failure `baseProsperity` and `baselineTaxBurden`
were introduced to prevent, and the same fix.

**What the change cost, honestly.** The old weights could not be preserved
exactly, because they were never a population distribution. They said a quarter
of the nation's small farmers lived on the frontier; the frontier held 2.8% of
the population. That was a rough political weighting doing duty as a geography,
and the discrepancy is not a rounding difference — it was wrong. Six of the eight
blocs land within a few points of the old table when derived from membership;
`small_farmers` and `frontier_settlers` move a long way, and in both cases the
new figure is the defensible one.

**Why the shares deliberately do not sum to 1, in either direction.** Above 1 on
the frontier is the overlap the brief asked for: half are small farmers, four
fifths are frontier settlers, most are both. Below 1 in the South is the harder
one — a third of the region's people were enslaved and belonged to no political
interest because they were permitted none. Rounding them into "small farmers"
would tidy a column by asserting something false about 1790. The gap is reported
on the Regions screen in words instead.

**Sizes are calibration constants, not benchmark data.** No census counted
planters. Each column's reasoning is written above it in `calibration.ts`, and no
screen shows any of them as a historical figure (DESIGN.md §12.2).

---

## D-034 — Sectional politics needs concentration, not size

**Date:** 2026-08-16 (Phase 2, queue item 8)
**Status:** implemented. Found by two failing tests, and it changed the model.

**What broke.** Moving Congress from the old national weights to live membership
made two long-standing tests fail: no delegation was undecided on any bill, and
whipping a party by thirty points no longer moved a vote. The obvious response —
widen the undecided band — would have hidden the real problem.

**What the real problem was**, once measured rather than guessed. The mean
regional SPREAD of a bill's sectional term had collapsed from 0.42 to 0.13. The
cause is that a region's standing is normalised within the region, and the small
farmers are about 62% of every region's politics — so every region looked alike
and the sectional term could no longer differentiate anything. The model had lost
the one property the brief cares most about, quietly, while still running.

**Decision: weight the sectional term by a location quotient** — how concentrated
a bloc is here against the country at large — damped by a square root.

Standing answers "what is this region made of". Concentration answers "does this
fall on us more than on them", and **that** is what divides a country. A measure
that hurts small farmers hurts everyone equally and should produce no sectional
split; one that hurts planters splits the union, because the planters are twice
as concentrated in the South as nationally. Under the old table this fell out by
accident of how the weights were written. It is now the model.

The square root is not decoration. The frontier settlers are nineteen times
over-represented on the frontier, and undamped that single quotient would swamp
every other term in the whip count. Salience rises with concentration and does so
with diminishing returns.

**The two tests were then corrected rather than weakened.** The abstention test
asked whether one bill produced an abstention; it now asks whether the undecided
band is reachable across the whole statute book, and it is — 29% of
delegation-votes. The Bank was simply the worst possible example, because nobody
abstained on the Bank, which is correct. The whipping test asserted that whipping
buys votes; it now asserts that whipping moves the division, because whipping
buys ABSTENTIONS before it buys votes — which is how persuasion works — and it
additionally asserts that a large enough whip does buy the votes themselves.
Both tests are stronger than before.

---

## D-035 — A migrated save keeps the founding shares and its own denominators

**Date:** 2026-08-16 (Phase 2, queue item 8)
**Status:** implemented

**The question `v6ToV7` had to answer.** A v6 save has no bloc state. Two
candidates:

1. **Seed the founding shares.** Every save resumes with the country made of the
   people it was made of in 1789.
2. **Derive shares from the save's current economy**, as if the drift had been
   running all along.

**(2) is tempting and wrong.** It would invent a decade of occupational change
the player never caused and then present it as their record — a save whose whole
legislative history is three tariffs would load into a country of artisans it
never made. Same reasoning as seeding grievance empty in `v4ToV5`.

**The denominators are the harder half.** Every driver is a ratio to its founding
value. A v6 save from 1798 has an economy that has grown for nine years;
measuring it against real 1789 figures is impossible because the save does not
contain them, and measuring it against today's figures reads as "nothing has
changed" — which is precisely the right answer for a save that has not been
running the model.

**So: founding shares, and the save's own present as the baseline.** The country
is what it is, and it changes from here. A migrated save then behaves like a new
game started on its own date rather than like one quietly running a model it
never had. Asserted by test: the first drift after loading moves nothing.
