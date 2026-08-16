# DECISIONS.md

Decisions taken on the project owner's behalf during the autonomous run of
2026-08-15, with reasoning. Reverse anything here you disagree with.

Format: what was decided, why, and what the alternative was.

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
