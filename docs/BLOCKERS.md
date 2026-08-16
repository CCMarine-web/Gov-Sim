# BLOCKERS.md

Things that need the project owner, with what was already tried.

Nothing here stops the queue — each item was worked around and the run
continued. These are for you to clear when you are back.

---

## B-001 — Annual federal receipts and outlays, 1789–1800

**Status:** open. Blocks full fidelity of the History view's receipts and
outlays rows, which currently render the honest "no verified data" state.

**What is needed.** Year-by-year federal receipts and outlays for 1789 through
1800, from a citable source.

**What was tried.**

| Source | Outcome |
|---|---|
| OMB Historical Tables, Table 1.1 | Reports **1789–1849 as a single aggregated row** ($1,160M receipts, $1,090M outlays, $70M surplus). Annual reporting begins 1901. Cannot support a year-by-year comparison. |
| CRS Report RL33665, "US Federal Government Revenues: 1790 to the Present" | Despite the title, tabulated figures begin at fiscal 1820. |
| Treasury Fiscal Data, "Account of Receipts and Expenditures" | Dataset page returns HTTP 403; no working API endpoint found. |
| usgovernmentrevenue.com | Cites the correct primary source but publishes no usable figures for these years. Ad-supported aggregator, not citable to this project's standard. |
| *Historical Statistics of the United States, Colonial Times to 1970*, series Y 335–338 | **This is the right source.** Available only as a scanned PDF, and this environment has no PDF text-extraction tooling. |

**What would clear it.** Any one of:

1. Install PDF text extraction (`poppler-utils`, or a Node PDF library) so
   series Y 335–338 can be extracted from the Census Bureau's scanned edition.
2. Institutional access to the *Historical Statistics* Millennial Edition
   (Cambridge), which publishes these tables digitally.
3. You transcribing the figures manually from any copy you have access to.
   Twelve years, two columns — a small job for a human, impossible for me
   without the source.

**Why it was not worked around.** Fabricating or interpolating these figures
would violate the hardest rule in the project. The gap state is the correct
output and is now built and shipping.

**Its value went up in Phase 2.** Queue item 3 added eight assessed-value
calibration constants for the non-founding tax bases (`ECONOMY.md` §3.4), and
five of the eight are reasoned rather than solved because no yield figure could
be found for them. Series Y 352–357 gives federal receipts *by source*, which
would let those five be solved against observed yields the way
`START_TRADE_CAPACITY` was. Clearing this blocker is now worth more than it was.

---

## B-002 — Price index for 1789–1800 — ✅ CLEARED

**Status:** resolved during the autonomous run, 2026-08-15.

Sourced the MeasuringWorth annual consumer price index for 1789–1801 and
stored it in `src/content/history/benchmarks.ts` with its citation. Decision (b)
from `ECONOMY.md` §11.7 is now implemented: the History view deflates the
nominal GDP benchmark to constant 1790 dollars and states the basis on screen.

Effect: the apparent GDP shortfall against 1800 fell from **45% to about 24%**.
The 1800 benchmark of $486M nominal is $353.8M in 1790 dollars, against the
model's $268.8M. What remains is largely the exogenous post-1793 shipping boom,
which the model cannot produce because it has no diplomacy system — a known and
documented limitation rather than a calibration error.

Source: Samuel H. Williamson, "The Annual Consumer Price Index for the United
States, 1774–Present", MeasuringWorth. Retrieved 2026-08-15.

---

## B-003 — Enslaved population growth rate is unanchored

**Status:** open, low priority. Does not block anything.

Enslaved population currently grows at the same rate as its region (see
`DECISIONS.md` D-006). The real national figures are 697,697 (1790) and roughly
894,000 (1800), implying growth slightly slower than total population.

**What would clear it.** State-level enslaved population figures from the 1800
census, which would let the rate be calibrated per region rather than assumed
uniform.

---

## B-004 — Supabase Auth environment variables not configured

**Status:** open. See `docs/ENV-SETUP.md` for the exact list.

`DATABASE_URL` and `DIRECT_URL` are configured and verified working in both
local and production environments. `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are **not** set in either — the local `.env`
still holds template placeholders, and the health endpoint reports both absent
in production.

Auth was built behind a clean interface with the local-storage fallback fully
working, so the game does not regress. Setting the two variables activates the
cloud path with no code change.

---

## B-005 — The clock runs past the end of the content, and uncapped speed makes it obvious

**Status:** open, known, not blocking. Raised by the Phase 2 speed rebalance.

Nothing stops the simulation at 1800-12-31. It never mattered much before: at
the old top speed reaching the end of the content took fourteen minutes of
play. At the new uncapped speed it takes a few seconds, after which the player
is in 1801, then 1805, in a country where no further events exist and the
economy simply extrapolates.

**Not fixed here deliberately.** Two defensible answers exist and choosing
between them is a content decision, not a clock one:

1. **Stop at the content horizon** — the loop refuses to advance past the last
   day the content pack covers, and says so. Honest, and cheap.
2. **Extend the content**, which is what Phase 2 is for: the brief takes the
   game to 1860. Once that lands, the horizon moves and the problem shrinks.

Since queue items 5 to 12 add a great deal of content, the horizon is going to
move anyway, and building a stop now would mean building it against a boundary
that is about to change. **Recommendation:** implement (1) as a small guard once
the Phase 2 content settles, sourced from the content pack rather than a
hard-coded date, so it never needs revisiting again.

**What was verified in the meantime**, rather than assumed. Four tests in
`src/sim/advanceDay.test.ts` ("running beyond the end of the content") run ten
further years, to 1810, and assert that the calendar stays correct, the run
stays deterministic, no value anywhere in the state becomes NaN or non-finite,
and the state still round-trips through JSON so a save taken there loads.

It is a design gap, not a defect — and if any of those four ever fails, that is
the moment it becomes one.

---

## B-006 — Party composition of Congress by state and Congress, 1789–1800

**Status:** open, known, not blocking. Raised by Phase 2 queue item 7.

The **seat counts** in `src/content/government/congress.ts` are historical and
cited: the Constitution's original allocation of 65, the Apportionment Act of
1792 raising the House to 105, two senators per state, and the real admission
dates. Those are solid.

The **party split of those seats is a model**. It is derived from each region's
economic character and its sentiment toward the government, documented in
`ECONOMY.md` §7.20, and the Congress screen states plainly that it is a model
rather than a record. No screen presents it as a historical figure.

**What would improve it.** A state-by-state party breakdown for each Congress
from 1789 to 1800. Two candidate sources:

1. **Biographical Directory of the United States Congress** — gives party by
   member, and labels the 1st and 2nd Congresses only "Pro-Administration" and
   "Anti-Administration", which is itself the useful fact that no formal parties
   existed. Extracting a per-state tally would mean reading several hundred
   member entries.
2. **US House of Representatives, "Party Divisions of the House of
   Representatives, 1789 to Present"** — gives NATIONAL totals per Congress,
   which would let the model be calibrated against a real aggregate even without
   the state-level detail. This is the cheaper and probably better first step.

**Why it was not worked around.** Fabricating per-state party counts and
presenting them as history would violate the hardest rule in the project. A
documented model that says it is a model does not.

**What is affected.** Only the realism of the starting composition. The
mechanics — how a delegation votes, how sectional interest overrides party, how
elections shift seats — do not depend on it and would be unchanged by better
data.
