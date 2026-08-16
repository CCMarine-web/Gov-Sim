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

## B-002 — Price index for 1789–1800

**Status:** open. Needed to complete decision (b) recorded in `ECONOMY.md`
§11.7 — comparing GDP in real rather than nominal terms.

**What is needed.** An annual price index or deflator covering 1789–1800 with a
citation, to convert the nominal MeasuringWorth GDP benchmark to constant 1790
dollars.

**Why it matters.** The simulation has no price level, so it is effectively a
constant-dollar series. The benchmark is nominal. Real per-capita growth in the
1790s was near zero; nominal per-capita growth was 6.42%/yr. Comparing the two
directly reports a 45% shortfall as though it were the player's failure.

**Current state.** The History view labels the GDP comparison explicitly and
shows both figures with their basis stated, which is honest but weaker than a
like-for-like comparison. MeasuringWorth publishes a suitable series; it was
not retrieved during this run because the GDP dataset page was the only one
fetched successfully.

**What would clear it.** The MeasuringWorth annual price index (or the
Historical Statistics consumer price series) for 1789–1800, with citation.

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
