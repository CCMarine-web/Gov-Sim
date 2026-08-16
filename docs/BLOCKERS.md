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
