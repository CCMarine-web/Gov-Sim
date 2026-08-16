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
