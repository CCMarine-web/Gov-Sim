# ECONOMY.md — The Phase 1 Simulation Model

**Status:** Draft for approval. **No code has been written.** This document is the specification the engine will be built from.
**Scope:** 1789-04-30 (day 0) through 1800-12-31 (day 4262).
**Companion documents:** [`../DESIGN.md`](../DESIGN.md) (architecture), [`UI.md`](UI.md) (interface).

---

## 1. How to read this document

Every formula in this document is preceded by a **causal claim** — a plain-English statement of what the formula asserts about how the world works. The claim is the thing to argue with; the algebra is just its encoding.

When this model is implemented, **the causal claim becomes the comment above the formula in the code.** That is the mechanism by which this document and the engine stay in sync.

Two conventions used throughout:

- **[VERIFIED]** — a real historical figure with a precise citation. These may be shown to the player as history.
- **[CALIBRATION]** — a game-design parameter. Documented and reasoned, but **never presented to the player as a historical fact.** See `DESIGN.md` §12.2 for why this distinction is load-bearing.

---

## 2. Verified historical data

Everything in this section was retrieved and checked during the writing of this document. These figures are the seed of `/src/content/history/`.

### 2.1 Population — 1790 Census [VERIFIED]

The First Census, enumerated as of 2 August 1790.

| Region | States / territories included | Total population | Enslaved | Enslaved share |
|---|---|---:|---:|---:|
| **New England** | Vermont, New Hampshire, Maine (District of Mass.), Massachusetts, Rhode Island, Connecticut | 1,009,522 | 3,886 | 0.4% |
| **Mid-Atlantic** | New York, New Jersey, Pennsylvania, Delaware | 1,017,726 | 45,371 | 4.5% |
| **South** | Maryland, Virginia, North Carolina, South Carolina, Georgia | 1,792,710 | 632,593 | 35.3% |
| **Frontier** | Kentucky, Southwest Territory | 109,368 | 15,847 | 14.5% |
| **National** | | **3,929,326** | **697,697** | **17.8%** |

Per-state figures used to build this table:

| State / Territory | Total | Free | Enslaved |
|---|---:|---:|---:|
| Vermont | 85,539 | 85,523 | 16 |
| New Hampshire | 141,885 | 141,727 | 158 |
| Maine | 96,540 | 96,540 | 0 |
| Massachusetts | 378,787 | 378,787 | 0 |
| Rhode Island | 68,825 | 67,877 | 948 |
| Connecticut | 237,946 | 235,182 | 2,764 |
| New York | 340,120 | 318,796 | 21,324 |
| New Jersey | 184,139 | 172,716 | 11,423 |
| Pennsylvania | 434,373 | 430,636 | 3,737 |
| Delaware | 59,094 | 50,207 | 8,887 |
| Maryland | 319,728 | 216,692 | 103,036 |
| Virginia | 747,610 | 454,983 | 292,627 |
| Kentucky | 73,677 | 61,247 | 12,430 |
| North Carolina | 393,751 | 293,179 | 100,572 |
| South Carolina | 249,073 | 141,979 | 107,094 |
| Georgia | 82,548 | 53,284 | 29,264 |
| Southwest Territory | 35,691 | 32,274 | 3,417 |

*Arithmetic check performed:* regional totals sum to 3,929,326 and regional enslaved populations sum to 697,697, both exactly matching the stated national totals.

**Source:** 1790 United States Census, per US Census Bureau returns. Retrieved 2026-08-15 via https://en.wikipedia.org/wiki/1790_United_States_census

> ⚠️ **Discrepancy to resolve before this ships.** Two national totals circulate for the 1790 census: **3,929,326** (the sum of the published per-state returns, used above) and **3,929,214** (also widely cited as the official figure, with 3,231,533 free and 697,681 enslaved). The 112-person difference almost certainly reflects a later correction to the returns. The per-state table is internally consistent and sums exactly, so it is what we use — but this figure is flagged `sourceTier: 'secondary'` until confirmed against a census.gov primary document. **This is precisely the kind of thing the citation requirement exists to catch**, and it surfaced within an hour of starting.

**Historical notes that affect region assignment:**
- **Vermont** was an independent republic until 4 March 1791; the census enumerated it separately.
- **Maine** was the District of Maine, part of Massachusetts, until 1820, but was enumerated separately.
- **Kentucky** was part of Virginia until 1 June 1792.
- **Southwest Territory** became Tennessee on 1 June 1796.

Region membership is therefore modeled as static for Phase 1, with these transitions available as flavor events. Phase 2's map layer will need them as real boundary changes.

### 2.2 Population — 1800 Census [VERIFIED]

**Total: 5,308,483.**

**Source:** 1800 United States Census. Retrieved 2026-08-15.

This is the only other population data point in the Phase 1 window, and it is the anchor for the population growth rate (§6.1).

### 2.3 Nominal GDP, 1790–1801 [VERIFIED]

Millions of current US dollars.

| Year | Nominal GDP | Year | Nominal GDP |
|---:|---:|---:|---:|
| 1790 | $193M | 1796 | $423M |
| 1791 | $210M | 1797 | $415M |
| 1792 | $230M | 1798 | $418M |
| 1793 | $256M | 1799 | $447M |
| 1794 | $321M | 1800 | $486M |
| 1795 | $390M | 1801 | $520M |

**Source:** Louis Johnston and Samuel H. Williamson, "What Was the U.S. GDP Then?" MeasuringWorth, https://www.measuringworth.com/datasets/usgdp/ — retrieved 2026-08-15.

**Modeling note:** the Johnston–Williamson series deliberately **includes government output and private services**, which some other historical GDP series exclude. Our simulated GDP must be composed the same way (§6.6) or the History comparison will show a false gap that is really a definitional mismatch. This is exactly the kind of error the comparison view exists to avoid, so it must not be built into it.

Derived: **GDP per capita in 1790 = $49.12** ($193M ÷ 3,929,326). This is a derived figure, not a separately sourced one, and the UI will label it as such.

### 2.4 Federal debt outstanding, 1790–1801 [VERIFIED]

Total public debt outstanding, as of 1 January of each year. Between 1789 and 1842 the federal fiscal year began in January, so these are fiscal-year-start figures.

| Date | Debt outstanding |
|---|---:|
| 1790-01-01 | $71,060,508.50 |
| 1791-01-01 | $75,463,476.52 |
| 1792-01-01 | $77,227,924.66 |
| 1793-01-01 | $80,358,634.04 |
| 1794-01-01 | $78,427,404.77 |
| 1795-01-01 | $80,747,587.39 |
| 1796-01-01 | $83,762,172.07 |
| 1797-01-01 | $82,064,479.33 |
| 1798-01-01 | $79,228,529.12 |
| 1799-01-01 | $78,408,669.77 |
| 1800-01-01 | $82,976,294.35 |
| 1801-01-01 | $83,038,050.80 |

**Source:** US Department of the Treasury, Fiscal Data — "Historical Debt Outstanding" dataset, retrieved 2026-08-15 from
`https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_outstanding`

This is a **primary source served as machine-readable JSON by the Treasury**, which makes it the highest-quality series we have. `sourceTier: 'primary'`.

**Note on the 1790→1791 jump.** The rise from $71.06M to $75.46M reflects the **assumption of state debts** under the Funding Act of 1790. This matters for gameplay: assumption is a player decision (§ event slate in `DESIGN.md` §7.5). A player who declines assumption should visibly diverge from this real debt line — which is the History view doing exactly its job.

### 2.5 Summary of data quality

| Series | Status | Tier | Covers |
|---|---|---|---|
| Population | ✅ Verified | Secondary (per-state sums; see discrepancy note) | 1790, 1800 only |
| Nominal GDP | ✅ Verified | Secondary (scholarly, authoritative) | 1790–1801 annual |
| Federal debt | ✅ Verified | **Primary** (Treasury API) | 1790–1801 annual |
| Federal receipts | ❌ **Gap** | — | — |
| Federal outlays | ❌ **Gap** | — | — |
| Military size | ❌ **Gap** | — | — |

---

## 3. Open data gaps

Per `DESIGN.md` §12, a gap is recorded honestly rather than filled with a guess. These three are unresolved.

### 3.1 Federal receipts and outlays, 1789–1800

**The brief's suggested source does not cover this period annually.** This was checked directly: **OMB Historical Tables, Table 1.1 reports 1789–1849 as a single aggregated row** (receipts $1,160M, outlays $1,090M, surplus $70M for the whole 60-year period) and only begins annual reporting in 1901. It cannot support a year-by-year comparison.

Sources checked and their outcomes:

| Source | Outcome |
|---|---|
| OMB Historical Tables Table 1.1 | ❌ 1789–1849 aggregated into one row |
| CRS Report RL33665, "US Federal Government Revenues: 1790 to the Present" | ❌ Despite the title, tabulated figures begin at fiscal 1820 |
| Treasury Fiscal Data, "Account of Receipts and Expenditures" | ❌ Dataset page returns HTTP 403; no working API endpoint found |
| usgovernmentrevenue.com | ⚠️ Cites the correct primary source but presents no usable figures for these years; ad-supported aggregator, not citable to our standard |
| *Historical Statistics of the United States, Colonial Times to 1970*, series Y 335–338 | ✅ **This is the right source** — but it is available only as a scanned PDF, and this environment has no PDF text-extraction tooling installed |

**Resolution plan:** install PDF text extraction (`poppler-utils` or an equivalent Node library) and extract series Y 335–338 from the Census Bureau's scanned edition, or obtain the *Historical Statistics* Millennial Edition tables. Alexander Hamilton's Treasury reports on Founders Online are a viable primary-source cross-check for individual years.

**Until resolved:** the History view renders federal receipts and outlays in the explicit **"no verified data"** state described in `DESIGN.md` §12.1. It does not show a zero, a blank, or an estimate.

**This does not block Phase 1.** The simulation produces its own receipts and outlays from the model below; only the *historical comparison rows* for those two metrics are affected, and they degrade gracefully by design.

### 3.2 Military size, 1789–1800

Not yet researched. Phase 1 has no military system (`DESIGN.md` §3.2), so this metric renders in the unavailable state. To be resolved when the military system arrives in Phase 3.

### 3.3 Price level / deflator — resolved

Sourced during the Phase 1 autonomous run. See `docs/BLOCKERS.md` B-002 and `docs/DECISIONS.md` D-007: the MeasuringWorth annual consumer price index for 1789–1801 is stored with its citation, and the History view deflates nominal GDP to constant 1790 dollars.

### 3.4 Assessed values for the non-founding tax bases — weakly anchored

*Added in Phase 2, queue item 3.*

The eight base values added in §7.8b have **weaker provenance than the rest of the calibration register**, and this entry exists so that is on the record rather than buried in a comment.

| Constant | Anchor | Strength |
|---|---|---|
| `CARRIAGE_VALUE_BASE` | Solved so a 2% rate approaches the ~$150k/yr the 1794 carriage duty actually yielded | Reasonable — anchored to an observed yield |
| `ENSLAVED_ASSESSMENT_BASE` | Regional split follows the sourced 1790 census distribution; the conversion to an assessed value is a design choice | Split is sourced, level is not |
| `DWELLING_VALUE_BASE` | Reasoned from the 1798 direct tax's apportioned $2,000,000 target and the settled-wealth distribution | Weak on level, defensible on shape |
| `STAMPABLE_BASE`, `AUCTION_VALUE_BASE`, `REFINED_GOODS_BASE` | Reasoned from where the taxed activity was concentrated. No yield figure was found for any of the three | **Weakest of the set** |
| `ASSESSABLE_INCOME_SHARE`, `RETAIL_SALES_SHARE` | Nothing to anchor to — no one measured national income or retail sales in 1790 | Openly a design parameter |

**Why this is acceptable rather than a violation.** These are calibration constants, not benchmark data (`DESIGN.md` §12.2): they are never shown to the player as historical fact, and the historical claims that *are* shown — the statutes, the dates, the court decisions, the reasons a base is locked — are separately sourced in `src/sim/taxBases.ts`. The rule forbids fabricating a historical number and presenting it as history. It does not forbid a documented game parameter.

**What would strengthen them.** Annual federal receipts by source for 1789–1800, which is the same missing source as §3.1 — *Historical Statistics of the United States* series Y 352–357. Clearing B-001 would let five of these eight be solved against observed yields rather than reasoned. Recorded there.

**What is not affected.** The null run: no instance exists against any of these bases at the founding, so none of them contributes a dollar until a bill creates one.

---

## 4. Starting state at day 0 (1789-04-30)

The game begins on Washington's inauguration day. **There is no census, no GDP estimate, and no debt figure dated 30 April 1789.** Every starting value is therefore a `[CALIBRATION]` constant, most of them anchored to the nearest verified figure.

This is the two-category distinction (`DESIGN.md` §12.2) doing real work: these numbers run the engine, and **none of them is ever displayed to the player as a historical fact.**

| Quantity | Day-0 value | Basis |
|---|---:|---|
| National population | 3,929,326 | 1790 census, used un-adjusted. Back-projecting 15 months would require inventing a growth rate we would then also be estimating from this same figure — circular. Documented as the anchor, not as a 1789 measurement. |
| Regional populations | Per §2.1 table | Same basis |
| Enslaved population | 697,697 (regional split per §2.1) | Same basis |
| Nominal GDP | $193M | 1790 MeasuringWorth figure, earliest available |
| Federal debt | $71,060,508.50 | 1790-01-01 Treasury figure, earliest available |
| Treasury balance | $0 | The Treasury Department was created 2 Sept 1789 — after day 0. Starting at zero is both defensible and dramatically correct. |
| Weighted debt interest rate | 4.0% | Hamilton's funding plan carried much of the domestic debt at 6% with a deferred 3% tranche; 4% is a reasonable blended effective rate. **Flagged for refinement** once receipts/outlays data lands and debt service can be checked against actuals. |
| Average tariff rate | 10.0% | Tariff Act of 1789 schedules averaged roughly 8–10% ad valorem. **Revised up from an initial 5.0% during implementation:** at 10% the model produces $4.30M in customs revenue, against a real 1790s figure of roughly $4.4M. At 5% it produced barely half that. Player-adjustable from day 0. |
| Excise rate | 0% | No federal excise existed until March 1791 — it arrives as an event. |
| Land tax rate | 0% | No federal direct tax until 1798. |
| Stability | 55 / 100 | Newly ratified constitution, functioning but untested |
| Legitimacy | Republic 70, Monarchy 50 | See §7 |
| Sectional tension | 20 / 100 | Low but non-zero; the fault lines already existed |

### 4.1 Regional starting profiles [CALIBRATION]

Population and enslaved population are from §2.1. The remaining fields are calibration, set to encode the real economic geography of the period.

| Region | Dominant industry | Prosperity | Sentiment | Primary tax exposure |
|---|---|---:|---:|---|
| **New England** | Shipping, fishing, nascent manufacturing | 55 | +20 | **Tariff** — merchants and shipowners bear it directly |
| **Mid-Atlantic** | Mixed farming, milling, commerce | 58 | +25 | Balanced across all three |
| **South** | Staple-crop plantation agriculture (tobacco, rice, indigo; cotton from the mid-1790s) | 52 | +5 | **Tariff** — exports staples, imports manufactures, so bears tariff without receiving protection |
| **Frontier** | Subsistence farming, distilling | 40 | −10 | **Excise** — whiskey was how bulk grain was transported to market at all |

The tax-exposure column is the heart of the regional model. It is what makes a single tariff decision produce four different political reactions, and it is historically grounded rather than arbitrary.

---

## 5. Variables

Fourteen core variables, plus the regional and policy vectors.

**National stocks** (persist across ticks, change slowly)
1. Population
2. Labor force
3. Agricultural output
4. Manufacturing output
5. Trade volume
6. GDP *(derived from 3–5 plus government output)*
7. Stability (0–100)
8. Legitimacy (0–100)
9. Sectional tension (0–100)

**Fiscal**
10. Federal receipts *(customs + excise + land + other)*
11. Federal outlays *(debt service + military + civil + infrastructure)*
12. Treasury balance
13. National debt
14. Debt service *(derived: debt × weighted rate)*

**Policy vector** (player-controlled): tariff rate, excise rate, land tax rate, military spending, civil spending, infrastructure spending.

**Per region:** population, enslaved population, labor force, agricultural output, manufacturing output, trade volume, prosperity (0–100), sentiment (−100…+100), compliance (0–100).

---

## 6. The causal graph

```
                    ┌──────────────────────────────────────────┐
                    │            PLAYER POLICY                 │
                    │  tariff · excise · land tax · spending   │
                    └───┬──────────────┬───────────────┬───────┘
                        │              │               │
              ┌─────────▼───┐   ┌──────▼──────┐  ┌─────▼──────┐
              │ TRADE       │   │  REGIONAL   │  │  OUTLAYS   │
              │ VOLUME      │──▶│  SENTIMENT  │  │            │
              │ (suppressed │   │  (per-region│  └─────┬──────┘
              │  nonlinearly)│  │  exposure)  │        │
              └──────┬──────┘   └──┬───────┬──┘        │
                     │             │       │           │
              ┌──────▼──────┐      │       │           │
              │  RECEIPTS   │      │  ┌────▼─────┐     │
              │ customs +   │      │  │COMPLIANCE│     │
              │ excise +    │◀─────┼──┤          │     │
              │ land        │      │  └──────────┘     │
              └──────┬──────┘      │                   │
                     │             │                   │
                     └──────┬──────┴───────────────────┘
                            │
                     ┌──────▼───────┐      ┌──────────────┐
                     │  TREASURY    │─────▶│  NATIONAL    │
                     │  BALANCE     │      │  DEBT        │
                     └──────┬───────┘      └──────┬───────┘
                            │                     │
                            │              ┌──────▼───────┐
                            │              │ DEBT SERVICE │──┐
                            │              └──────┬───────┘  │
                            │                     │          │
                     ┌──────▼───────┐      ┌──────▼───────┐  │
                     │   CREDIT     │◀─────┤  DEBT / GDP  │  │
                     │   RATING     │      └──────────────┘  │
                     └──────┬───────┘                        │
                            │  (borrowing cost)              │
                            └────────────────────────────────┘

     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
     │  PROSPERITY  │────▶│  SENTIMENT   │────▶│  STABILITY   │
     │  (regional)  │     │  (regional)  │     │  (national)  │
     └──────▲───────┘     └──────┬───────┘     └──────▲───────┘
            │                    │                    │
            │             ┌──────▼───────┐            │
            │             │  SECTIONAL   │────────────┘
            │             │  TENSION     │
            │             └──────────────┘
            │
     ┌──────┴───────┐     ┌──────────────┐
     │   OUTPUT     │────▶│     GDP      │
     │  ag + manu   │     │              │
     └──────▲───────┘     └──────────────┘
            │
     ┌──────┴───────┐     ┌──────────────┐
     │  POPULATION  │◀────┤  LEGITIMACY  │──▶ compliance floor
     │  LABOR FORCE │     │              │
     └──────────────┘     └──────────────┘
```

The two loops that make this a simulation rather than a spreadsheet:

- **The fiscal loop.** Tax → revenue → debt paid down → credit rating rises → borrowing cheaper → more fiscal room. Hamilton's actual thesis, playable.
- **The consent loop.** Tax → regional sentiment falls → compliance falls → *revenue falls below the linear projection* → the player raises rates to compensate → sentiment falls further. A revenue death spiral is reachable through entirely reasonable-looking decisions. This is the Whiskey Rebellion, mechanically.

---

## 7. Formulas

Recompute cadence per `DESIGN.md` §6.5: **daily** for calendar, events, modifier expiry, and treasury cash flow; **monthly (on the 1st)** for everything in this section unless marked otherwise.

### 7.1 Lag mechanics

> **Causal claim.** Economies and populations do not respond to policy instantly. A tax change moves revenue within weeks because collection is mechanical, but moves prosperity and public sentiment over many months because those depend on people changing their behavior, their circumstances, and their minds.

Every slow-moving variable uses a standard first-order lag toward a target:

```
value ← value + (target − value) × α
```

`α` is derived from a time constant `τ` in months: `α = 1 − e^(−1/τ)`. Computed values:

| Variable | τ (months) | α | Reaches ~63% of a change in |
|---|---:|---:|---|
| Stability | 3 | 0.2835 | 1 quarter |
| Regional sentiment | 6 | 0.1535 | 6 months |
| Regional prosperity | 12 | 0.0800 | 1 year |
| Credit rating | 12 | 0.0800 | 1 year |
| Trade capacity | 24 | 0.0408 | 2 years |

Receipts respond immediately (within the monthly recompute). Prosperity takes a year. That spread is what makes the economy traceable rather than twitchy — and it is why the Treasury screen must show *projected* effects (`UI.md`), because the player cannot otherwise see what they have set in motion.

### 7.2 Population

> **Causal claim.** Population grows at a high natural rate in an agrarian society with abundant land, modulated by prosperity (which affects both fertility and mortality) and stability (crises kill and displace people). The frontier additionally grows by migration *from* the settled regions, which is why frontier population grew far faster than natural increase can explain.

```
annualGrowthRate = BASE_GROWTH × prosperityFactor × stabilityFactor

  prosperityFactor = 1 + (prosperity − 50) / 500      →  ±10% at extremes
  stabilityFactor  = 1 + (stability  − 50) / 1000     →  ±5%  at extremes

monthlyGrowth = (1 + annualGrowthRate)^(1/12) − 1
region.population ← region.population × (1 + monthlyGrowth)
```

**`BASE_GROWTH = 0.0305` [CALIBRATION, census-anchored].** Derived from the two verified census figures: (5,308,483 ÷ 3,929,326)^(1/10) − 1 = **0.03054**. This is the strongest-provenance calibration constant in the model — it falls directly out of two primary data points rather than being tuned.

**Frontier migration** [CALIBRATION]. Kentucky grew from 73,677 (1790) to 220,955 (1800) — roughly 11.6%/yr, far beyond any natural rate. Migration is modeled as a transfer:

```
migrants = Σ_settled( region.population × MIGRATION_RATE × pullFactor )
  pullFactor = 1 + (frontier.prosperity − sourceRegion.prosperity) / 100
```

Migrants leave the source region and join the frontier, so national population is conserved. `MIGRATION_RATE` is tuned so that an unperturbed run approximately reproduces the real 1800 regional distribution — see §10.

### 7.3 Labor force

> **Causal claim.** Only part of a population works. In 1790 roughly half the population was under sixteen, so participation was low by modern standards. Enslaved people were subjected to forced labor at far higher participation rates, including women, children, and the elderly — this is a documented fact of the period's economy and the model would misstate Southern output if it were ignored.

```
region.laborForce = (region.population − region.enslavedPopulation) × FREE_PARTICIPATION
                  + region.enslavedPopulation × COERCED_PARTICIPATION

FREE_PARTICIPATION    = 0.32   [CALIBRATION]
COERCED_PARTICIPATION = 0.55   [CALIBRATION]
```

Both constants are flagged for refinement against age-structure data from the 1790 census when we have it.

### 7.4 Agricultural and manufacturing output

> **Causal claim.** Output is labor times productivity. Productivity rises slowly with infrastructure investment and falls with instability (disrupted markets, seized goods, men under arms rather than at the plough). Agriculture dominates this period; manufacturing is small but is the thing tariff protection can grow.

```
region.agOutput  = region.laborForce × agShare(region)  × AG_PRODUCTIVITY
                   × (1 + infrastructureBonus) × stabilityDrag

region.manOutput = region.laborForce × manShare(region) × MAN_PRODUCTIVITY
                   × (1 + infrastructureBonus) × stabilityDrag
                   × (1 + tariffProtectionBonus)

  infrastructureBonus   = diminishing(cumulativeInfrastructureSpend)
  stabilityDrag         = 0.85 + 0.15 × (stability / 100)
  tariffProtectionBonus = TARIFF_PROTECTION_K × tariffRate
```

> **Causal claim (protection).** A tariff makes imported manufactures more expensive, which shelters domestic manufacturing and lets it grow. This benefit accrues to regions that *have* manufacturing — New England and the Mid-Atlantic — while the cost falls on every region that buys manufactured goods. That asymmetry is the origin of sectional conflict over the tariff, and the model must produce it rather than assert it.

`agShare`/`manShare` are per-region labor allocation constants [CALIBRATION] reflecting the §4.1 profiles. `AG_PRODUCTIVITY` and `MAN_PRODUCTIVITY` are set so that day-0 output composes to the verified $193M GDP (§7.6).

**Diminishing returns** on infrastructure:
```
infrastructureBonus = INFRA_MAX × (1 − e^(−cumulativeSpend / INFRA_SCALE))
```
Asymptotic, so infrastructure can never be spammed to infinity — the tenth road matters less than the first.

### 7.5 Trade volume and customs revenue — the tariff curve

> **Causal claim.** A tariff raises revenue on every dollar of trade, but it also suppresses the volume of trade it taxes. At low rates the suppression is negligible and revenue rises almost linearly. As the rate climbs the suppression compounds, and **above roughly 25% the volume lost outweighs the rate gained and total customs receipts fall.** Punitive tariffs collect less money than moderate ones.

```
tradeVolume = tradeCapacity × e^(−TARIFF_ELASTICITY_K × tariffRate²)
customsRevenue = tradeVolume × tariffRate

TARIFF_ELASTICITY_K = 8   [CALIBRATION]
```

Revenue is maximized at `tariffRate = 1 / √(2K)` = **exactly 0.25** with K = 8. The constant was chosen to place the peak precisely where the design brief's causal claim says it should be.

Behavior of the curve (verified numerically):

| Tariff | Trade index | Customs revenue index |
|---:|---:|---:|
| 0% | 1.000 | 0.0000 |
| 5% | 0.980 | 0.0490 |
| 10% | 0.923 | 0.0923 |
| 15% | 0.835 | 0.1253 |
| 20% | 0.726 | 0.1452 |
| **25%** | 0.607 | **0.1516 ← peak** |
| 30% | 0.487 | 0.1460 |
| 40% | 0.278 | 0.1112 |
| 50% | 0.135 | 0.0677 |

Note the shape: gentle below 15%, sharply punishing above 30%. The squared exponent is what produces this. A linear or simple-exponential form would either punish moderate tariffs too hard or fail to punish extreme ones — both make the decision boring.

`tradeCapacity` is a lagged stock (τ = 24 months) that grows with GDP and port infrastructure and is cut by war and embargo events. Because it lags two years, **a tariff cut does not restore trade overnight** — the player who wrecks trade with a 45% tariff spends years digging out. That asymmetry is deliberate.

### 7.6 GDP

> **Causal claim.** GDP is the sum of what the country produces. Our composition must match the composition of the historical series we benchmark against, or the comparison view will report a difference that is really a definitional artifact.

```
gdp = Σ_regions(agOutput + manOutput) + tradeServices + governmentOutput
  tradeServices    = tradeVolume × TRADE_MARGIN
  governmentOutput = federalOutlays × GOV_OUTPUT_FACTOR
```

`governmentOutput` is included specifically because the Johnston–Williamson series includes it (§2.3). Omitting it would make our GDP systematically lower than the benchmark for reasons that have nothing to do with player performance.

### 7.7 Excise revenue and the compliance mechanism

> **Causal claim.** An excise is only worth what people actually pay. Frontier farmers distilled grain into whiskey because whiskey was the only form in which a bulk crop could profitably be carried over the mountains to market — so a whiskey excise was, to them, a tax on the act of selling anything at all. When resented enough, it was simply not paid, and collecting it required force that cost more than the tax raised.

```
exciseRevenue = Σ_regions( region.distillingBase × exciseRate × region.compliance / 100 )

region.compliance ← lag(τ=6 months) toward complianceTarget

complianceTarget = clamp(0, 100,
      BASE_COMPLIANCE
    + region.sentiment × SENTIMENT_TO_COMPLIANCE
    + enforcementBonus(militarySpending, region)
    + legitimacyBonus(legitimacy)
)
```

This is the single most important feedback loop in Phase 1. Raising the excise lowers frontier sentiment, which lowers compliance, which means revenue rises **less than proportionally** — and past a threshold, actually falls. The player watching only the rate slider will not see this coming; the player watching the modifier breakdown will.

`region.distillingBase` is far higher in the Frontier than anywhere else [CALIBRATION], which is why the excise is a regional weapon rather than a national one.

### 7.8 Land tax revenue

> **Causal claim.** A direct tax on land is the most visible and most resented form of taxation, because it falls on people whether or not they have any cash that year. It raises real money and costs real political capital everywhere at once, unlike the tariff (which is concentrated on merchants) or the excise (concentrated on the frontier).

```
landRevenue = Σ_regions( region.landValueBase × landTaxRate × region.compliance / 100 )
```

Sentiment penalty applies to **every** region, not one. This makes the 1798 direct tax a genuine last resort — which is what it historically was.

### 7.8b Taxes as instances — the general revenue formula

*Added in Phase 2, queue item 3. Supersedes the three bespoke formulas in §7.5, §7.7 and §7.8 as the way the engine actually computes revenue — those three remain as the named special cases they reduce to, and a test pins them together.*

Phase 1 had three tax rates as fixed fields. A bill cannot create a tax if the only taxes the engine can compute are three fields with three formulas, so a tax is now an **instance** in `GameState.policies.taxes` naming a **base** from the registry in `src/sim/taxBases.ts`.

The general formula, for one tax:

```
assessedBase   = TRADE      → nation.tradeVolume
                 REGIONAL   → Σ_regions( base.regionalBase[region] )
                 OUTPUTSHARE→ Σ_regions( region.output × base.outputShare )

gross          = assessedBase × rate
afterCompliance= (compliance-weighted assessedBase) × rate
net            = afterCompliance × tax.collectionEfficiency
```

with two losses reported separately, because they have different causes and different remedies:

| Loss | Cause | Whose property |
|---|---|---|
| `gross − afterCompliance` | a region assessed but did not pay | **the region's** — consent |
| `afterCompliance − net` | the administration could not reach it | **the tax's** — capacity |

**Trade-assessed taxes carry no compliance term.** The duty is taken at the wharf before the goods move inland, which is precisely why the impost was the one tax the early republic could reliably collect. This is not a simplification — it is the reason the impost supplied the overwhelming majority of federal revenue.

**Several taxes on one base sum.** Two duties on imports are, to the merchant paying them and to the trade-suppression curve alike, one duty at the sum of their rates. `tradeTaxRate()` is what the suppression curve and the manufacturing protection bonus both read.

**Collection efficiency of the three founding taxes is 1.0, deliberately.** Their assessed bases in `src/sim/calibration.ts` were *solved against observed revenue*, so collection losses are already inside those figures; applying a second factor would double-count them. Every other base carries a `referenceEfficiency` relative to that baseline — a duty taken at a few dozen customs houses is not the same job as one assessed on every still in the backcountry.

**This change moved no calibrated number.** With the three founding taxes the general formula is arithmetically identical to the three it replaced, and `src/sim/taxes.test.ts` asserts that against each of `computeCustomsRevenue`, `computeExciseRevenue` and `computeLandRevenue` directly. That mattered: every solved constant in §9.1 is anchored to the day-0 equilibrium, so a structural change that shifted revenue would have invalidated the whole calibration and the History comparison with it.

#### The taxable bases

| Base | Assessment | Bucket | Burden channel | Reference efficiency | Historicity |
|---|---|---|---|---|---|
| `imports` | trade | customs | tariff | 1.00 | enacted |
| `spirits` | regional | excise | excise | 1.00 | enacted |
| `carriages` | regional | excise | excise | 0.85 | enacted |
| `refined_goods` | regional | excise | excise | 0.80 | enacted |
| `auctions` | regional | excise | tariff | 0.90 | enacted |
| `stamps` | regional | other | tariff | 0.88 | enacted |
| `land` | regional | land | land | 1.00 | enacted |
| `dwellings` | regional | land | land | 0.92 | enacted |
| `enslaved_persons` | regional | land | land | 0.95 | enacted |
| `income` | outputShare | other | land | 0.45 | **anachronistic — locked** |
| `sales` | outputShare | other | excise | 0.40 | counterfactual |
| `exports` | trade | customs | tariff | — | **prohibited — locked** |

Two locks, both with real reasons the interface states verbatim rather than paraphrasing:

- **`exports`** — Article I §9 cl. 5: *"No Tax or Duty shall be laid on Articles exported from any State."* A ratification condition for the staple-exporting states, never amended, still good law.
- **`income`** — a tax on income is a direct tax and Article I requires direct taxes to be apportioned by population, which income is not. Decisive in *Pollock* (1895); removed only by the Sixteenth Amendment in 1913.

`sales` is *not* locked, and the distinction is the point: a general sales tax is constitutionally available as an excise and was simply never administrable in the 1790s. One is a bar; the other is a choice the player may make and be judged on.

#### Newly added base values [CALIBRATION]

`CARRIAGE_VALUE_BASE`, `DWELLING_VALUE_BASE`, `ENSLAVED_ASSESSMENT_BASE`, `STAMPABLE_BASE`, `AUCTION_VALUE_BASE`, `REFINED_GOODS_BASE`, `ASSESSABLE_INCOME_SHARE`, `RETAIL_SALES_SHARE`.

Each is documented at its definition with what it is anchored to. **None of them affects the null run**: a base produces revenue only when a tax instance exists against it, and at the founding only the impost, the spirits excise and the land tax exist — the latter two at a rate of zero. They are inert until a bill creates an instance.

Their provenance is weaker than the solved constants in §9.1, and that is recorded honestly in §3.4 rather than glossed over.

### 7.9 Receipts, outlays, and the treasury

```
annualReceipts = Σ_taxes( net revenue per §7.8b ) + OTHER_RECEIPTS      ← ROLLED UP into
                                                                          the four buckets
debtService    = debt × weightedRate                       ← non-discretionary, computed first
annualOutlays  = debtService + Σ_programs( annualAmount by category )
```

The four headline buckets — `customs`, `excise`, `land`, `other` — are a **rollup** of the per-instance lines, never a parallel calculation. Each base declares the bucket it rolls into, and `rollupReceipts()` is the only thing that produces the headline figures. That is what guarantees the Treasury screen's detailed attribution and its headline total cannot disagree; a test asserts they reconcile.

Spending is likewise `SpendingProgram[]` rather than three fields, summed by category.

**Daily accrual** (this part runs every day, not monthly):
```
treasury.balance += (annualReceipts − annualOutlays) / daysInYear
```

Using the actual days in the current year — 365 or 366 — keeps accrual exact across leap years. Remember 1800 is **not** a leap year (`DESIGN.md` §6.6).

**Deficit handling:**
```
if treasury.balance < 0:
    shortfall = −treasury.balance
    debt += shortfall × (1 + EMERGENCY_BORROWING_PREMIUM)
    treasury.balance = 0
    emergencyBorrowing = true
    → applies a stability modifier and a credit-rating penalty
```

Borrowing to cover a deficit costs *more* than the shortfall. Chronic deficits compound into debt service that crowds out everything else — the degraded-governance path from `DESIGN.md` §10.

### 7.10 Credit rating and the cost of borrowing

> **Causal claim.** A government that services its debts reliably can borrow cheaply; one that defaults, or that lets its debt outrun its economy, pays a premium or cannot borrow at all. This was Hamilton's central argument for assumption and funding, and it should be *demonstrable in play* rather than merely asserted in an event card.

```
creditTarget = clamp(0, 100,
      BASE_CREDIT
    − debtToGdpPenalty(debt / gdp)
    − MISSED_PAYMENT_PENALTY × missedPaymentCount
    + (stability − 50) × STABILITY_TO_CREDIT
)

creditRating ← lag(τ=12 months) toward creditTarget

newBorrowingRate = MIN_RATE + (MAX_RATE − MIN_RATE) × (1 − creditRating/100)²
```

The **squared** term means credit deterioration accelerates: falling from 80 to 60 costs far less than falling from 40 to 20. Countries do not slide gently into a debt crisis.

`weightedRate` on existing debt updates as a weighted average when new debt is issued, so past cheap borrowing keeps benefiting the player.

### 7.11 Regional prosperity

> **Causal claim.** A region's prosperity is its output per head relative to where it started, dragged down by the share of that output taken in tax and lifted by infrastructure. It moves slowly — a year to substantially register a change — because prosperity is lived conditions, not a policy setting.

```
outputPerCapita = (region.agOutput + region.manOutput) / region.population
prosperityTarget = clamp(0, 100,
      50 × (outputPerCapita / region.baselineOutputPerCapita)
    − taxBurden(region) × TAX_TO_PROSPERITY
    + infrastructureBonus × INFRA_TO_PROSPERITY
)
region.prosperity ← lag(τ=12 months) toward prosperityTarget
```

### 7.12 Regional sentiment — the political core

> **Causal claim.** How a region feels about the federal government depends on what that government costs it, what it delivers, and whether things are getting better or worse. Crucially, **the cost is weighted by the region's own tax exposure** — the same tariff that enriches a New England manufacturer impoverishes a Southern planter. One national policy, four different reactions. This is the mechanism from which sectional conflict emerges, rather than being scripted.

```
taxBurden(region) =
      tariffRate  × region.tariffExposure
    + exciseRate  × region.exciseExposure
    + landTaxRate × region.landExposure

sentimentTarget = clamp(−100, +100,
      BASE_SENTIMENT
    − taxBurden(region) × TAX_TO_SENTIMENT
    + (region.prosperity − 50) × PROSPERITY_TO_SENTIMENT
    + prosperityTrend(region) × TREND_TO_SENTIMENT       ← direction matters, not just level
    + governmentTypeAffinity(region, governmentType)     ← §8
    + Σ(active sentiment modifiers from events and laws)
)
region.sentiment ← lag(τ=6 months) toward sentimentTarget
```

Exposure vectors [CALIBRATION], encoding §4.1:

| Region | tariffExposure | exciseExposure | landExposure |
|---|---:|---:|---:|
| New England | 1.3 | 0.4 | 0.8 |
| Mid-Atlantic | 1.0 | 0.7 | 1.0 |
| South | 1.2 | 0.3 | 1.1 |
| Frontier | 0.4 | **2.2** | 1.3 |

The Frontier's 2.2 excise exposure is the Whiskey Rebellion waiting to happen. It is a data value in a content file, which is exactly where it should live.

**`prosperityTrend` matters independently of level.** A region getting poorer from a high base is angrier than a region getting richer from a low base. This is why booms buy goodwill and why a downturn is politically expensive even when absolute conditions remain decent.

### 7.13 Sectional tension

> **Causal claim.** Sectional tension is not about any region being unhappy — it is about regions being unhappy *differently*. A nation where every region is equally aggrieved has a legitimacy problem; a nation where regions are pulling in opposite directions has a *union* problem. Divergence, not dissatisfaction, is what breaks countries apart.

```
sentimentSpread   = max(region.sentiment) − min(region.sentiment)
prosperitySpread  = max(region.prosperity) − min(region.prosperity)

tensionTarget = clamp(0, 100,
      sentimentSpread  × SPREAD_TO_TENSION
    + prosperitySpread × PROSPERITY_SPREAD_TO_TENSION
    + slaveryTensionAccumulator                       ← from events, §7.16
)
sectionalTension ← lag(τ=6 months) toward tensionTarget
```

Phase 1 surfaces this as a stat and lets events read it. It has no terminal consequence yet — it is the seed Phases 2 and 3 grow the Civil War from. Building it now costs almost nothing; retrofitting it would mean redesigning the regional model.

### 7.14 Stability

> **Causal claim.** Stability is the government's practical capacity to govern — whether laws are obeyed, order is kept, and business proceeds. It reflects how people feel on average, degraded by internal division and by illegitimacy, and shocked by crises.

```
stabilityTarget = clamp(0, 100,
      50
    + meanRegionalSentiment × SENTIMENT_TO_STABILITY
    − sectionalTension × TENSION_TO_STABILITY
    + (legitimacy − 50) × LEGITIMACY_TO_STABILITY
    + Σ(active stability modifiers)
)
stability ← lag(τ=3 months) toward stabilityTarget
```

Stability feeds back into output (§7.4) and population growth (§7.2), so a stability collapse is genuinely economically destructive rather than a number going down.

### 7.15 Legitimacy — where the founding choice pays off

> **Causal claim.** Legitimacy is the belief that the government has the right to govern, which is different from whether it is currently doing a good job. **A republic must continually re-earn it through consent and results; a monarchy claims it by right and does not decay, but has further to fall when it fails.** This is the mechanical expression of the founding choice, and it must be felt rather than read.

**Republic:**
```
legitimacy ← legitimacy
    − REPUBLIC_DECAY_PER_MONTH                       ← constant downward pressure
    + prosperityGain × PROSPERITY_TO_LEGITIMACY      ← results renew consent
    + crisisResolvedBonus
    + Σ(event legitimacy modifiers)
```

**Monarchy:**
```
legitimacy ← legitimacy
    + 0                                              ← no decay; the crown simply persists
    + prosperityGain × PROSPERITY_TO_LEGITIMACY × MONARCHY_GAIN_FACTOR   (< 1)
    + Σ(event legitimacy modifiers) × MONARCHY_PENALTY_FACTOR            (> 1 on penalties)
```

The republic player is on a treadmill and must keep delivering. The monarchy player can coast, but a mishandled crisis hurts disproportionately and there is no natural recovery mechanism pulling them back up. Two different games.

**Legitimacy below `COMPLIANCE_THRESHOLD` (proposed: 30)** begins dragging regional compliance targets downward — the degraded-governance mechanism from `DESIGN.md` §10. The player never loses power; they lose the ability to collect taxes, which is worse and more interesting.

### 7.16 Slavery in the model

> **Causal claim.** Enslaved labor produced a large share of Southern agricultural output — this is an economic fact of the period, and a model that omitted it would systematically understate the Southern economy and misrepresent why the sectional conflict was so intractable. Simultaneously, every federal action touching slavery moved the sections further apart, and that accumulating divergence is what the Civil War eventually grew out of.

Mechanically:

- Enslaved population enters the labor force at `COERCED_PARTICIPATION` (§7.3) and drives Southern agricultural output.
- Enslaved population grows at its own rate [CALIBRATION], to be anchored against the 1800 census when those state-level figures are added.
- A `slaveryTensionAccumulator` rises when slavery-related events resolve in ways that push the sections apart, and feeds §7.13. It does not decay — this is deliberate, and historically accurate.
- Phase 1 has no emancipation mechanic. The 1790 Quaker petitions and the 1793 Fugitive Slave Act are presented as the decisions they were, with sourced historical context, and their consequences are recorded.

**Presentation requirement.** These figures appear in the Regions view as demographic and economic fact with historical context attached. The UI must never present enslaved population as a resource to be optimized — no "increase output" affordance operates on it, and the number is displayed alongside its human context, not as a bare production input. This is a constraint on `UI.md`, recorded here because it arises from the model.

### 7.17 Political capital

*Added in Phase 2, queue item 4. Brief §3.*

> **Causal claim.** The ability to get things done is drawn from four places: the belief that you have the right to govern, the support of whoever it is that keeps you in office, the absence of a crisis consuming your attention, and having an administration capable of carrying out an instruction.

#### Why a second currency

Legitimacy and political capital answer different questions, and collapsing them would lose the difference between being respected and being effective.

| | Question |
|---|---|
| **Legitimacy** | Does the country accept your right to govern? |
| **Political capital** | Can you actually get *this particular thing* done? |

The relationship runs one way: legitimacy **feeds** capital accrual, and spending capital does not spend legitimacy. Acting unpopularly costs both, through two separate mechanisms with two separate reasons — capital because the act consumed the government's capacity, legitimacy because the country minded (§7.15, D-001).

#### Daily accrual

```
support     = republic  → meanRegionalSentiment × POPULAR_SUPPORT_TO_CAPITAL
              monarchy  → eliteSupport          × ELITE_SUPPORT_TO_CAPITAL

accrual     = BASE_CAPITAL_ACCRUAL
            + (legitimacy − 50)          × LEGITIMACY_TO_CAPITAL
            + support
            + (stability − 50)           × STABILITY_TO_CAPITAL
            + administrativeCapacity     × ADMIN_TO_CAPITAL

            clamped to [0, MAX_CAPITAL_ACCRUAL], then × emergency multiplier
```

**Floored at zero, never negative.** A government in collapse gains nothing; it does not *owe* capital. Negative accrual would make the cap meaningless and could trap a player permanently, which is the wrong shape for a game with no game-over (`DESIGN.md` §10).

**Daily, not monthly.** Following HOI4 rather than Democracy 4's quarterly turns: a real-time clock wants a currency that moves with it. The *rate* is recomputed monthly with every other slow aggregate; the *stock* ticks daily.

#### The cap

```
cap = (BASE_CAPITAL_CAP + (legitimacy − 50) × CAPITAL_CAP_FROM_LEGITIMACY)
      × (monarchy ? MONARCHY_CAPITAL_CAP_FACTOR : 1)
      × emergency multiplier
```

> **Causal claim.** Political capital is a standing, not a bank balance — the goodwill and attention available to a government at one moment. It cannot be saved indefinitely and spent all at once, because the willingness of others to go along with you does not accumulate that way.

Capital that accrues into a full reserve is **lost, and counted**: `totalWasted` exists so that "hoarding is not a strategy" is a falsifiable claim rather than an assertion.

#### Where the two paths diverge

| | Republic | Monarchy |
|---|---|---|
| Support base | Broad popular sentiment | Prosperity-weighted sentiment — the propertied interest |
| Coefficient | Lower per point | Higher per point, narrower base |
| Cap | Full | × `MONARCHY_CAPITAL_CAP_FACTOR` (0.75) |
| Cost of action | Full (§7.15) | × `MONARCHY_ACTION_COST` (0.55) |

**Neither is strictly better, and that is checked.** The crown acts more cheaply but cannot husband capacity for a large reform; the republic acts dearly but can save for one. Speed against reach. `src/sim/politicalCapital.test.ts` asserts the monarchy's ceiling is genuinely lower — if it were ever both cheaper *and* deeper, the monarchy would dominate, which the brief calls a defect and would be right to.

Weighting the crown's base by prosperity rather than population is the whole content of "elite": a monarchy hears from the regions with money in them and can survive a great deal of discontent among people who have none. That is both the source of its stability and the reason it falls over suddenly.

#### Administrative capacity

```
administrativeCapacity = (officesCreated / officesTotal)
                       × (officesFilled  / officesCreated) × 100
```

Read from the historical office record in the content pack (`src/content/government/cabinet.ts`, interpreted by `src/sim/offices.ts`). Two factors multiplied: how much of the government exists, and how much of what exists is staffed. A vacancy in a department that was never created is not a vacancy.

**Zero on day 0, and correctly so.** The Department of State was created on 27 July 1789, War on 7 August, the Treasury not until 2 September. A player beginning on inauguration day holds an office in a government that does not yet exist.

**Past the end of the office record** the census is clamped to the last day the content describes. Reading a day beyond every recorded tenure would find every office vacant and collapse capacity to zero on 1 January 1801 — the content running out is a gap in the content, not an event in the game (`BLOCKERS.md` B-005).

**Item 13 will replace this.** "How many offices are filled" becomes "how competent and loyal the people filling them are". The term is here now so the currency has a real administrative component from the start rather than an inert placeholder.

#### Spending

```
cost = max(BUDGET_CAPITAL_COST_FLOOR,
             Σ|Δrate|   × BUDGET_CAPITAL_COST_PER_RATE
           + Σ|Δdollars| × BUDGET_CAPITAL_COST_PER_DOLLAR)
```

Charged on the **absolute** movement, unlike the legitimacy cost which falls only on rises. Lowering a tax still takes a bill through, still consumes attention, and still has to be argued for — and charging both directions closes the last door on rate-oscillation as a way to farm the model.

An appropriation is politically easier than a levy, and the constants say so: doubling the military establishment costs about five capital, a thirty-point swing in the tariff sixty.

**Unaffordable is refused with a reason, not a bare no.** `canAffordPolicy` returns the shortfall and how many days of accrual it represents, and the engine throws if a caller skips the gate. A control that declines without explanation is the same failure the modifier ledger exists to prevent, applied to actions rather than numbers.

#### Emergency powers

Democracy 4's mechanic. A severe enough crisis lets a government push through what it otherwise could not: both the accrual rate and the cap are multiplied, immediately rather than at the next recompute, and they **end on a fixed day**. When they lapse the stock is clawed back to the ordinary ceiling — holding crisis-sized reserves after the crisis has passed is exactly the hoarding the cap exists to prevent.

Content-declared rather than engine-inferred, so a designer decides which crises qualify and the player can be told why. Wired into two real ones:

- **The Whiskey Rebellion (1794)**, on calling out the militia. Not a game abstraction: the Militia Act of 1792 required a Supreme Court justice to certify that ordinary judicial proceedings were obstructed before the President could call out the militia against citizens, and Justice James Wilson so certified on 4 August 1794. That certification *is* the historical emergency-powers mechanism.
- **The Quasi-War (1798)**, on arming or on declaring war. Under the pressure of an undeclared naval war Congress created the Navy Department, raised a provisional army, laid the direct tax, passed the stamp duties and passed the Alien and Sedition Acts — an extraordinary volume of legislation in a few months.

### 7.18 Blocs — an interim weighting

*Added in Phase 2, queue item 5. Superseded by queue item 8.*

Brief §4.2 puts `blocReactions` on every bill: who gains, who loses, how strongly, and why. Brief §1 lists the eight blocs — planters, merchants, frontier settlers, artisans, financiers, clergy, seamen, small farmers — and item 8 builds the real model, in which membership is overlapping, graduated, and moved by policy.

**Until then, each bloc is distributed across the four regions by `BLOC_REGION_WEIGHTS`, and its reaction moves that region's base sentiment.**

```
ΔbaseSentiment[region] = Σ_blocs( reaction.strength
                               × BLOC_REGION_WEIGHTS[bloc][region]
                               × BLOC_REACTION_TO_SENTIMENT )
```

The weightings follow the economic geography the regions already encode. Each bloc's weights sum to 1.

| Bloc | New England | Mid-Atlantic | South | Frontier |
|---|---:|---:|---:|---:|
| Planters | 0.02 | 0.10 | **0.82** | 0.06 |
| Merchants | 0.36 | **0.42** | 0.19 | 0.03 |
| Frontier settlers | 0.02 | 0.08 | 0.12 | **0.78** |
| Artisans | 0.34 | **0.44** | 0.18 | 0.04 |
| Financiers | 0.30 | **0.55** | 0.13 | 0.02 |
| Clergy | **0.38** | 0.27 | 0.24 | 0.11 |
| Seamen | **0.51** | 0.31 | 0.16 | 0.02 |
| Small farmers | 0.24 | **0.27** | 0.24 | 0.25 |

`BLOC_REACTION_TO_SENTIMENT` is 0.06: a bill a bloc feels at full strength, wholly concentrated in one region, moves that region's base sentiment by 6 points. The whiskey excise, at −70 on frontier settlers weighted 0.78, moves frontier base sentiment by about −3.3, which the six-month sentiment lag then spreads over half a year.

**Two properties worth stating, because they are choices rather than accidents:**

- **BASE sentiment, not the current value.** A permanent political fact should move the equilibrium a lagged stat converges toward (§7.1). Applying it to the stored value would produce a jump the model immediately undoes.
- **A repeal does not refund it.** A country does not un-resent a law because it was taken back, and a repeal that refunded the political damage would make an unpopular bill temporarily free.

**Why declare reactions now rather than with item 8.** An unused field rots: nobody can tell whether the numbers in it are calibrated, because nothing depends on them. Wiring it to something real means the slate's reactions were written against observable consequences. When item 8 lands it replaces this table and **nothing in `src/content/` changes** — which is the whole reason the reactions live in the content rather than being derived. `docs/DECISIONS.md` D-025.

### 7.19 Grievance, unrest and succession — the price of the crown

*Added in Phase 2, queue item 6. Brief §2.1.*

> **Causal claim.** A government that acts without asking is obeyed until it is not. Every measure imposed rather than argued for is remembered by the people it was imposed on — specifically, by name — and enough of that accumulated resentment in one place stops the revenue arriving, then stops the law running, and finally puts men in arms.

#### Grievance is per bloc, and that is the whole design

> "Decreeing against the planters repeatedly builds planter grievance specifically, not just generic unhappiness." — the brief

A government can be broadly tolerated and still have made one interest implacable, and **which** interest determines where the trouble comes from. Regional grievance is **derived** from bloc grievance through the same `BLOC_REGION_WEIGHTS` bills use (§7.18), so the two cannot disagree and a bloc's anger lands where that bloc actually is.

```
Δgrievance[bloc] = −reaction.strength × rate        (only for reaction.strength < 0)

  rate = DECREE_GRIEVANCE_PER_OPPOSITION       (0.28)  when decreed
       = LEGISLATION_GRIEVANCE_PER_OPPOSITION  (0.07)  when legislated

grievance[region] = Σ_blocs( grievance[bloc] × BLOC_REGION_WEIGHTS[bloc][region] )
```

**Support banks nothing.** Only opposition accumulates. A government does not get to decree something popular and spend the credit on something hated — that asymmetry is what stops "pass a sweetener first" being a general-purpose answer to every unpopular decree.

**Decay is proportional**, 3% a month: a small grievance fades quickly, a large one lingers. A bloc at 80 is still at 55 two years later.

#### The four-to-one ratio is the balance of the two paths

`DECREE_GRIEVANCE_PER_OPPOSITION / LEGISLATION_GRIEVANCE_PER_OPPOSITION` is four. **Set them equal and the republic's slowness buys nothing**, which the brief calls a defect and would be right to. A decree is imposed and the losers had no opportunity to be heard, so the whole of their opposition becomes resentment at the government. A bill argued through and voted on is a bill the losers were part of losing: they dislike the outcome, they do not resent the process.

#### What a decree costs a crown

```
opposition  = Σ_blocs( −strength × BLOC_POWER[bloc] )     for strength < 0
legitimacy  = DECREE_LEGITIMACY_FLOOR + opposition × DECREE_LEGITIMACY_PER_OPPOSITION
capital     = ordinary bill cost × DECREE_CAPITAL_FACTOR  (0.35)
```

`BLOC_POWER` is **not** the same as size, and that separation matters. The small farmers are by far the most numerous bloc and carry the least weight; the financiers are a few hundred men in three cities and carry a great deal. A crown answers to whoever can actually obstruct it, and in 1790 that is credit, commerce, the pulpit and the men who own the land — not the majority.

| Bloc | Power |
|---|---:|
| Planters | 1.00 |
| Financiers | 0.95 |
| Merchants | 0.85 |
| Clergy | 0.60 |
| Frontier settlers | 0.50 |
| Artisans | 0.45 |
| Small farmers | 0.40 |
| Seamen | 0.35 |

Power weights the **cost to the government**, not the anger of the bloc. The seamen resent a measure that harms them exactly as much as the planters resent one that harms them; the difference is what they can do about it.

#### Consequences, in three stages

| Regional grievance | Severity | Effect |
|---:|---|---|
| < 35 | — | Sentiment only. Ordinary discontent is not rebellion. |
| ≥ 35 | resistance | Compliance falls; revenue stops arriving. No stability cost — it is already costing money. |
| ≥ 55 | defiance | Collectors turned back. −4 stability while it runs. |
| ≥ 78 | revolt | In arms. −14 stability while it runs. |

Sentiment is hit at **any** level, unlike compliance. That is deliberate: it is the channel the player sees first, which is what makes the Regions screen a warning rather than a post-mortem.

**Escalation is one step at a time and de-escalation closes outright**, so the chronicle reads as a story rather than as overlapping states. A `UNREST_RESOLUTION_MARGIN` of 6 provides hysteresis — without it an episode sitting on its threshold would start and stop every month, filling the chronicle with a rebellion that kept changing its mind.

#### Succession

The ruler ages and dies. **This is the first genuinely random thing in the simulation**, and it uses the seeded PRNG whose state lives in `GameState` (Rule 2) — so a save replays identically and two runs from one seed produce the same king dying on the same day. The roll is annual, on 1 January, and the RNG advances **whether or not the ruler dies**: advancing only on death would make the sequence depend on the outcome it produced, which is the classic way to break replay.

| Age | Annual mortality |
|---|---:|
| under 45 | 0.4% |
| 45–54 | 1.2% |
| 55–64 | 2.5% |
| 65–74 | 5.5% |
| 75–84 | 12% |
| 85+ | 25% |

These are **adult** mortality figures, not life expectancy at birth — the latter was around 35 in 1790 and is dominated by infant deaths, which say nothing about the survival of a man who has already reached fifty-seven. They are calibration constants informed by that, never shown as historical fact.

| Outcome | Legitimacy | Stability |
|---|---:|---|
| Orderly succession | −9 | — |
| Disputed succession | −26 | −15 for two years |

**Which one it is, is the player's doing.** A new ruler is credited with an heir only if `legitimacyBase ≥ HEIR_SECURITY_THRESHOLD` (42). A dynasty with standing to spare has an obvious successor and nobody troubles to dispute it; one that has spent its standing on decrees finds the question of who comes next is suddenly worth arguing about. Making it conditional rather than automatic is the difference between a mechanic and a punishment (`docs/DECISIONS.md` D-028).

**The player does not leave.** DESIGN.md pillar 2. A succession is a change in the circumstances the player governs under, not a handover: the name at the top of the screen changes, the standing the office carries drops, and the player carries on.

#### The shape of the two paths, stated so it can be checked

| | Monarchy | Republic |
|---|---|---|
| Capital to act | ×0.35 | full |
| Legitimacy to act | floor + power-weighted opposition | none |
| Grievance created | ×4 | ×1 |
| Legitimacy decay | none | continuous (§7.15) |
| Ruler mortality | yes, with a legitimacy cost each time | no |
| Capital ceiling | ×0.75 (§7.17) | full |

The crown buys **speed** and pays in **consent**. Neither is strictly better, and `src/sim/grievance.test.ts` asserts the specific claim the brief cares about: a measure out of reach for a legislature is within reach for a decree, and the crown is then left holding the grievance the republic avoided.

### 7.20 Congress — the republic's half of the bargain

*Added in Phase 2, queue item 7. Brief §2.2.*

> **Causal claim.** A president cannot enact; he can only propose. Whether a measure passes depends on whose interests it serves, whose it harms, and where those people live — and a member who must face a state that loses by a bill will break with his party over it, which is how a party system becomes a sectional one.

#### What is history here and what is a model

| | |
|---|---|
| **History** | Seat counts. The Constitution's original 65 by name, the Apportionment Act of 1792 raising the House to 105 from the Third Congress, two senators per state, and the real admission dates of Vermont (1791), Kentucky (1792) and Tennessee (1796). All cited in `src/content/government/congress.ts`. |
| **Model** | The party split of those seats. This project has not sourced a state-by-state party breakdown for every Congress, so the split is derived from each region's economic character and its sentiment toward the government. Never presented as a historical figure; `BLOCKERS.md` B-006 records what would improve it. |

The First Congress in this model has **59 House seats, not 65**: North Carolina and Rhode Island had not ratified on 30 April 1789, and their members appear in November 1789 and May 1790 when they did.

#### A party is a coalition of interests

`blocAffinity`, −1…+1 per bloc, says whose side a party takes. Bills already declare whom they help and harm (§7.18), so the vote falls out of the two and a new bill needs no new field. `docs/DECISIONS.md` D-030 argues why this beats issue axes for this period.

There were **no formal parties** in the First and Second Congresses — the Congressional Biographical Directory labels those members only Pro- and Anti-Administration — so those interests carry low `discipline` and their members vote their state far more reliably than a line. From 4 March 1793 they become the Federalists and Democratic-Republicans, with discipline rising accordingly. A delegation seated under an old name still counts under the new one: the Pro-Administration men *became* the Federalists rather than being replaced by strangers.

#### How a delegation makes up its mind

```
partyLine   = Σ_blocs( affinity[bloc] × reaction[bloc] ) / 100
              ...with harm to a bloc the party OPPOSES counted at
              OPPOSED_BLOC_DISCOUNT (0.30) — see below
            × party.discipline × CONGRESS_PARTY_LINE_WEIGHT

regional    = Σ_blocs( reaction[bloc] × BLOC_REGION_WEIGHTS[bloc][region] ) / 100
            × CONGRESS_REGIONAL_WEIGHT

grievance   = −regionGrievance × CONGRESS_GRIEVANCE_RESISTANCE
whipping    = capital the player has spent on this party
riders      = +34 for one named party
log-roll    = +28 for one named party, and a bill later

inclination = clamp(−100, +100, sum of the above)
verdict     = for / against / undecided, within ±6
```

**The reasons sum to the inclination, visibly.** That is the same contract the modifier ledger has with a stat, and a test asserts it: a number the player cannot interrogate is a number they cannot plan against.

**Schadenfreude is discounted, and this matters.** Taken at face value, a negative affinity times a negative reaction is a positive: a party set against the planters would welcome a measure that destroyed the plantation economy in exact proportion to the damage. That produced a model in which the Federalists enthusiastically supported federal emancipation because it hurt an interest they opposed. Opposing an interest politically is not wanting it ruined, so harm to a disfavoured bloc counts at 0.30. (`docs/DECISIONS.md` D-031.)

**The regional weight is deliberately comparable to the party weight** once discipline is applied. Too much party and the sectional crisis the whole game is building toward can never emerge; too much region and parties are decoration. A Virginia Federalist and a Massachusetts Federalist are the same party and do not vote alike on a tariff, and a test asserts exactly that.

**The undecided abstain.** Real, not a rounding convenience: an undecided member in the 1790s abstained far more readily than a modern whipped one, and it means a bill can carry a thin house on a plurality.

#### The player's three tools, and their prices

| Tool | Effect | Cost now | Cost later |
|---|---|---|---|
| Whip a party | +1.0 inclination per point | 0.9 capital per point | — |
| Attach a rider | +34 for one party | 22 capital | — |
| Log-roll | +28 for one party | 8 capital | **16 capital in 540 days** |

**Everything is spent whether the bill carries or not.** A government that whips hard and loses has still whipped hard; refunding the attempt would make trying free and failure costless.

**A promise that cannot be kept costs standing instead** — `UNKEPT_PROMISE_LEGITIMACY_COST`, higher than the capital would have been, because a government that cannot keep its word has lost something a payment would not have bought back.

#### Defeat

A defeated bill goes on a **240-day cooldown** and costs legitimacy that **rises with the number of defeats**, capped at four: the third bill a government loses says something the first did not. The chronicle records which chamber refused it and the division, because "it failed" is not something a player can act on.

#### Elections

A new Congress convenes on **4 March of every odd year** — where the Confederation Congress fixed the start of the new government, and where every congressional term began until the Twentieth Amendment moved it to 3 January in 1935.

At each election the seats are re-drawn **from the country as it now is**. A region the government has alienated returns members who will not vote for it: sentiment becomes seats. That is the whole point of holding elections in a game where the player never leaves office — the player persists, and the legislature they must carry does not.

Cooldowns, obligations and the count of defeats survive an election; whipping does not, because the members it bought are gone.

#### The Senate lags, on purpose

The House is elected entire. The Senate is not: Article I §3 cl. 2 divided the senators into three classes so that **only a third face election in any cycle**, and that is modeled rather than waved away.

Each delegation therefore carries **two** party splits — `share` for the House, `senateShare` for the Senate. At an election the House takes the new result outright, and the Senate blends it in at `SENATE_CLASS_TURNOVER` = 1/3, keeping two thirds of the class already sitting:

```
senateShare' = fresh × 1/3  +  sitting × 2/3
```

A state admitted since the last election has no sitting class and takes the fresh result whole, which is what happened when Vermont and Kentucky arrived. A class elected as Anti-Administration is resolved forward before blending, so it still counts once that interest has become the Democratic-Republicans — the members did not change, only the name did.

**Why it earns its keep.** Without it the Senate is the House with different arithmetic: two seats a state instead of proportional ones, but the same opinion, so it almost never disagrees and the second chamber is decoration. With it, a government that turns the country around still has to argue with the country **as it was up to six years ago** — and, symmetrically, a government that has just lost the country keeps a Senate that has not finished hearing about it. That asymmetry is the constitutional brake the framers were describing, and it is a real obstacle the player has to time policy around rather than a flavour note.

It is not a tuned number. One third is what the clause says.

---

### 7.21 Blocs — who the country is made of, and how that changes

*Phase 2 brief §1, queue item 8. Implemented in `src/sim/blocs.ts`; the constants are in `calibration.ts` under BLOCS.*

Two ideas taken from Democracy 4, stated in the brief:

> "Nobody in Democracy 4 is only a member of one group… citizens belong to multiple overlapping blocs simultaneously, with graduated rather than binary membership."

> "Group membership is fluid and policies change the size of groups over time. Build this. Blocs should grow and shrink in response to policy, not just get happier or angrier."

Until this landed, a bloc was a row in a static table. A tariff could make the artisans happier. It could not make there be more of them.

#### What membership is

`GameState.blocs.membership[region][bloc]` — a fraction of that region's population. Overlapping and graduated, and both properties are load-bearing.

| Region | Shares total | Why that number |
|---|---:|---|
| New England | 0.78 | |
| Mid-Atlantic | 0.79 | |
| South | 0.60 | A third of the region's people were enslaved and belonged to no political interest, because they were permitted none |
| Frontier | **1.37** | Half are small farmers and four fifths are frontier settlers, because most of them are both |

**Neither direction is an error.** Above 1 is the overlap the brief asks for; a column summing to exactly 1 would be the binary model it asks us to leave behind. Below 1 is honesty: rounding the enslaved into "small farmers" would make the arithmetic tidy by asserting something false about 1790. The shortfall is reported on the Regions screen rather than hidden.

The day-0 shares are **calibration constants, not benchmark data** (DESIGN.md §12.2). No census counted planters. Each column's reasoning is written above it in `calibration.ts`, and no screen presents any of them as a historical figure.

#### How a bloc's size moves

Each month, membership drifts toward a target:

```
target      = seed × Π (driverᵢ / driverᵢ at day 0)^elasticityᵢ    ← the economy
            then through the modifier ledger, target `bloc.<id>.<region>`  ← the statute book
membership' = membership + (target − membership) × BLOC_DRIFT_PER_MONTH
```

**Every driver is a ratio to its own founding value.** At day 0 every ratio is 1, so the target equals the seed and nothing moves — the founding is an equilibrium the model sits still in rather than a point it slides away from. Same discipline as `baseProsperity` and `baselineTaxBurden`. The denominators are stored in `blocs.baseDrivers` and never recomputed; recomputing them from the current economy would make every ratio 1 at every moment and freeze the model permanently.

**Drivers are per head**, not absolute. A region whose trade doubles while its population doubles has not become more mercantile. Absolute figures would turn every bloc into a population counter.

| Bloc | Responds to | Why |
|---|---|---|
| Merchants | trade per head (+0.6), prosperity (+0.15) | The carrying trade makes merchants; nothing else does |
| Seamen | trade per head (+0.5) | Crews are hired to carry cargo |
| Artisans | manufacturing per head (+0.7), prosperity (+0.2) | Protection and prosperity fill the workshops |
| Small farmers | farm output per head (+0.25), **manufacturing per head (−0.3)** | The workshop fills from the farm and always has |
| Planters | enslaved share (+0.8), farm output per head (+0.2) | Staple agriculture on large holdings tracks the labour it was built on |
| Financiers | trade per head (+0.4), prosperity (+0.5) | Paper, banks and the public debt — the most volatile |
| Frontier settlers | population (+0.45) | The west fills by migration |
| Clergy | prosperity (+0.2) | Congregations are supported out of surplus |

Every magnitude is below 1 deliberately. People change occupation more slowly than the economy moves, and an elasticity above 1 would have a bloc outrunning the thing supposedly causing it. **`small_farmers` is the only negative**, and it is the mechanism the brief actually asked for: a measure that builds workshops does not merely please the artisans, it makes more of them, out of the farmers.

**`BLOC_DRIFT_PER_MONTH` = 3%** — a half-life of about 23 months. It falls out of that, rather than needing a separate mechanism, that a measure repealed before it has taken hold leaves the country roughly where it found it.

#### Policy moves blocs through the ledger, like everything else

A bill's `effects` may target `bloc.<blocId>.<regionId>` exactly as they target `region.south.prosperity`. Eight bills now do, each with its historical argument in a comment beside it:

| Bill | What it does to the country |
|---|---|
| Bank of the United States | Makes financiers, most of all in Philadelphia — subscription and a market in federal stock gave the seaboard a financial class where there had barely been one |
| Bounties on Manufactures | Makes artisans out of farmers. Hamilton's whole argument for bounties over duties was that they produce manufactures rather than dearer imports |
| Commercial Discrimination | Makes artisans and unmakes merchants, in the same statute. Goods that cannot be imported have to be made |
| Tonnage Act of 1789 | Makes seamen. Discriminating duties are why the American merchant marine grew as it did |
| Naval Act of 1794 | Makes seamen and shipwrights, in the northern yards |
| Land Act of 1796 | Moves people west, out of the eastern farming counties |
| National Road | Moves people west, and gives the interior a way to send a crop to market as a crop rather than as whiskey |
| Federal Gradual Emancipation | **Dissolves the planters.** An interest defined by holding people in bondage cannot outlive the bondage |

Because it goes through the ledger, the phase-in ramp applies: a statute does not change a country the day it is signed, and the breakdown names which law is doing it.

#### Everything downstream now asks where people actually are

`blocWeights(state)` — the share of each bloc living in each region — replaced the old static table, with the same shape so nothing downstream had to be rewritten. It is now a **consequence** of where people are rather than an assertion about it, and it is what regional grievance, a bill's sentiment shifts, and the chronicle's "chiefly the planters" all read.

The visible consequence: a country whose workshops have filled for a decade reacts to a measure differently from the one that passed the first tariff.

#### Standing, and concentration

Congress asks two different questions of the same data, and they need different normalisations.

**`regionStanding(membership)`** — how much of a region's POLITICS each bloc is: membership × `BLOC_POWER`, normalised to 1. The planters are 5.5% of the South's people and about a fifth of its politics. The enslaved third is none of it. This is what a party's alignment with a region is built from, and what a delegation's own interest is measured in.

**`blocConcentration(standing, national)`** — a location quotient, damped by a square root: how concentrated a bloc is here against the country at large. **This is the term that makes sectional politics work at all.** Standing alone cannot produce a sectional split, because the small farmers are about 62% of every region's politics and a measure that hurts them hurts everywhere equally. What divides a country is not what a measure does, it is whether it falls *here* more than elsewhere: planters are twice as concentrated in the South as nationally, frontier settlers nineteen times over on the frontier.

The square root is deliberate — salience rises with concentration and does so with diminishing returns. Without it the frontier's quotient alone would swamp every other consideration in the model.

### 7.22 Sectional strain — the measure the map is coloured by

*Phase 2 queue item 10, brief §6.2: "the map mode that should make the coming Civil War legible decades in advance." Implemented as `sectionalStrain()` in `src/sim/map.ts`.*

**What it is, and what it is not.** A DERIVED PRESENTATION MEASURE: computed from simulated values for the purpose of colouring a map, never stored in `GameState`, never shown as a historical figure, and labelled on screen as derived. It is not a stat, nothing lags toward it, and no modifier acts on it. If it were stored it would need a ledger; because it is computed on demand from three quantities that each have one, it does not.

```
strain = enslavedShare × 130
       + |regionSentiment − meanSentiment| × 0.55
       + regionGrievance × 0.45
                                    clamped to 0…100
```

**Term 1 — the enslaved share of a region's people.** Not a proxy for the conflict. It *is* the axis of it. A region a third of whose people are held in bondage has an interest that cannot be reconciled with one where almost none are, and every compromise from the Constitutional Convention to 1860 was an attempt to postpone that fact rather than resolve it. The coefficient is set so that the South's 35% enslaved population alone puts it near the middle of the scale on day one — which is correct, and is the whole point of the mode. A map on which 1789 looks calm would be a lie about 1789.

**Term 2 — divergence of sentiment from the national mean, in absolute value.** A region that feels differently about the federal government from everyone else is a region pulling away, and *which direction it pulls in does not matter for this measure*. New England in 1814 was as far outside the union as South Carolina in 1832, in opposite directions. Signed divergence would show one and hide the other.

**Term 3 — grievance.** What the government has actually done to the people here (§7.19). It is the term the player controls directly, and it is what makes the mode a warning rather than a diorama.

**Why these weights.** The enslaved share is the largest because it was: it is a structural fact that does not decay, while sentiment and grievance both move. Sentiment divergence is weighted above grievance because a region can be aggrieved about a tax and still be firmly in the union — the whiskey rebels were not secessionists — whereas a region whose whole disposition has diverged is a different problem.

**What it deliberately does not include.** Economic divergence. The North and South had different economies from the beginning and that alone did not strain the union; what strained it was that one of those economies rested on holding people in bondage, which term 1 already carries. Adding a prosperity gap would double-count the same fact and would also make ordinary regional inequality read as impending war.

### 7.23 Diplomacy — relations, treaties and tribute

*Phase 2 brief §7, queue item 11. Model in `src/sim/diplomacy.ts`; the powers and treaties are content, in `src/content/diplomacy/`.*

#### Treaties use the ledger. There is no second economy.

The brief is unambiguous: trade agreements "must flow through the same model, not a parallel one." So a treaty's effects are `ModifierTemplate`s aimed at the same targets a bill aims at — `nation.tradeCapacity`, `region.frontier.prosperity`, `nation.stability` — written into the same ledger with the same phase-in ramp and a `sourceType` of `treaty`.

The consequence worth stating: **the Treasury cannot tell a treaty from a tariff.** Pinckney's Treaty and the whiskey excise argue with the same economy on the same terms, and the stat popover explains them side by side. A treaty that opened trade through a private channel would be a second model that could silently disagree with the first.

Tribute is the same discipline applied to money: the annuities under the Algiers, Tripoli and Native treaties are added to the **civil outlay line**, not deducted through a separate channel. They are charges on the Treasury and they look like it.

#### Relations

One number per power, −100 to +100, with a word attached at every level so it is never a bare figure or a colour.

**Starting values are not neutral, and that is the design.** Britain is at −35 because it still held the northwestern forts; France at +55 because the alliance of 1778 was real and recent and the United States owed it both money and independence; Algiers at −50 because it was taking American ships. Each is reasoned beside its power in the content file. A world that started at zero would make the first decade's diplomacy a blank sheet, when in fact almost every option the government had was constrained by an inheritance.

| Constant | Value | Reasoning |
|---|---:|---|
| `ENVOY_CAPITAL_COST` | 14 | A mission is a real call on the same reserve legislation draws from |
| `ENVOY_RELATION_GAIN` | 6 | Deliberately a poor exchange rate — see below |
| `DIPLOMATIC_DECAY_PER_MONTH` | 0.02 | Half-life about three years, back toward the power's own baseline |
| `TREATY_BREACH_RELATION_COST` | 55 | |
| `TREATY_BREACH_LEGITIMACY_COST` | 9 | |

**Why an envoy buys so little.** Diplomacy in this period was slow: a minister took months to arrive and years to accomplish anything. More to the point, a mission that transformed a relationship would make every treaty prerequisite meaningless, because the player could buy their way to any threshold in a single action. Small, repeatable, and paid for in the currency that legislation also needs is what makes it a choice.

**Decay runs toward each power's baseline, not toward zero.** The reasons Britain was cool and France warm did not go away because a minister had a good year. A government that stops working at a relationship loses what it bought — which is what makes the envoy a standing cost rather than a purchase.

#### Treaty prerequisites, and why a refusal explains itself

`treatyStatus` returns a reason in every negative case — not yet, too late, at war, relations too low with the figure needed, or a named treaty that must come first. This is the same contract `billStatus` has, and for the same reason: a control the player cannot use must say what would change that.

The prerequisites are historical rather than mechanical. Full commercial reciprocity with Britain requires the Jay Treaty first and a relation of +55, because it is what Jay was sent to get and did not get; Britain held the stronger position and had no reason to concede it. Buying New Orleans requires Pinckney's Treaty and a relation of +60, and Spain refused throughout — it came into American hands only because Napoleon sold it in 1803, which nobody in this period negotiated for.

#### The data-integrity rule applies abroad

The brief: "Real 1790s figures where sourced, honest gaps where not — the same data-integrity rule applies to foreign nations as to our own."

So a power's population is either cited with the year it is FOR — Britain's is the 1801 census, because no earlier count exists, and the panel says 1801 — or `null` with a stated reason. **Most are null.** Nobody counted the Muscogee in 1790, estimates for the Cherokee vary widely and follow a smallpox epidemic and a decade of war, and a plausible number in a panel would be a fabricated one.

Naval and land strength are **calibration constants**, not history: nobody published a comparable index in 1790. They are reasoned in the content file and the screen says on its face that strength is a model.

### 7.24 War — declaring it, and living with it

*Phase 2 brief §7, queue item 12. Model in `src/sim/war.ts`; the grounds are content, in `src/content/diplomacy/casusBelli.ts`. Combat is explicitly out of scope for this phase.*

#### The two paths, which is the whole point

| | **Monarchy** | **Republic** |
|---|---|---|
| How it is declared | by decree, at once | by vote of both chambers |
| What can stop it | nothing | the House or the Senate |
| A weak pretext costs | legitimacy and grievance | the vote simply fails |
| A strong one costs | little | a majority, and capital |

A crown can always have its war. What it cannot do is have it cheaply, and what it cannot do at all is be told no. This is the same bargain the rest of the game makes — speed bought with consent — applied to the largest decision in it.

**A declaration is a `Measure`** and goes through `whipCount` exactly as a bill does: same inspectable division, same reasons per delegation, same whipping, riders and promises. Widening `whipCount`'s parameter rather than writing a second vote path is deliberate — two vote paths would eventually disagree about how the House works.

#### The threshold gate

```
shortfall  = max(0, (60 − strength) / 60)
legitimacy = shortfall × 22  +  (fabricated ? 15 : 0)
```

`UNJUSTIFIED_WAR_THRESHOLD` = 60. At or above it a case is defensible and the declaration costs nothing in legitimacy. Below it the cost rises **in proportion to the shortfall**, so aggression is a spectrum rather than a switch.

The threshold was set so the real grievances of the decade fall either side of it in roughly the order contemporaries ranked them:

| Grounds | Strength | |
|---|---:|---|
| The captives at Algiers | 80 | defensible |
| The French spoliations | 74 | defensible |
| The impressment of seamen | 70 | defensible |
| The retained posts | 62 | just defensible |
| The closure of the Mississippi | 58 | thin |
| The Ohio boundary | 55 | thin |
| A manufactured grievance | 18 | nowhere near |

**A fabricated pretext is the worst deal in the game.** It carries a flat 15 legitimacy on top of a near-maximum shortfall, and it costs 25 relation with **every other power**, not only the victim — "invites foreign hostility", because a government that invents its reasons once is a government nobody can safely sign anything with.

#### Diplomacy removes grounds for war

A casus belli with a `settledBy` treaty disappears once that treaty is in force. Once Britain has evacuated the posts under the Jay Treaty there is no longer a case about the posts.

This is the mechanism by which diplomacy genuinely prevents wars rather than postponing them, and it is why the treaty and war systems had to be built against each other. **Impressment is deliberately not settled by the Jay Treaty**, because the treaty was silent on it — so a player who signs it finds one grievance closed and the other still open, which is exactly what happened.

#### A war is a state, not a campaign

There is no combat this phase, so a war is something the country is IN:

- **Trade capacity −28%**, through the ledger, with no phase-in. A war closes a trade the day it is declared.
- **Stability −8**, likewise.
- **Weariness** rises `2.8 × (2 − justification/100)` a month: about three years to exhaust a country that believed in the war, eighteen months for one that did not. This is the only term that keeps acting after the declaration, and it is what stops a badly justified war from being a single payment made up front.

#### Peace, and why it is deterministic

`peaceOnOffer` compares what the country can bring — stability, legitimacy, and how much patience is left — against the enemy's strength, and returns `victory`, `settlement` or `concession`. It is a pure function of things the player can see on screen.

**A die roll here would be worse than nothing.** With no combat to simulate there is nothing for randomness to represent, and a player deciding whether to fight on would have no way to reason about it. Deterministic terms mean "hold out another year and the terms improve" is a real judgement rather than a hope.

Victory is worth +12 legitimacy and +6 stability — the one route by which a war improves anything. A concession costs 14 legitimacy, which is more than most decrees.

---

## 8. Government type differences

Summarizing what §7 distributes, since this is the founding choice and needs to be reviewable in one place.

| Mechanism | Republic | Monarchy |
|---|---|---|
| Starting legitimacy | 70 | 50 |
| Legitimacy decay | `REPUBLIC_DECAY_PER_MONTH` | None |
| Legitimacy gain from prosperity | Full | Reduced (`MONARCHY_GAIN_FACTOR` < 1) |
| Legitimacy loss from crises | Standard | Amplified (`MONARCHY_PENALTY_FACTOR` > 1) |
| New England starting sentiment | +20 | Substantially lower |
| Mid-Atlantic starting sentiment | +25 | Substantially lower |
| South starting sentiment | +5 | Higher |
| Cost of enacting unpopular laws | Higher | Lower |
| Event options | Some republic-only | Some monarchy-only |

`governmentTypeAffinity(region, governmentType)` in §7.12 carries the regional sentiment differences. Anti-monarchical sentiment in New England and the Mid-Atlantic in 1789 was strong and well documented; a monarchy start there is a genuine handicap the player must govern around.

---

## 9. Calibration constants register

Every `[CALIBRATION]` value in one table, so tuning is a single reviewable surface rather than a hunt through the codebase. These live in `/src/sim/calibration.ts`.

| Constant | Proposed | Provenance |
|---|---:|---|
| `BASE_GROWTH` | 0.0305 | **Derived from verified 1790 and 1800 census figures** |
| `TARIFF_ELASTICITY_K` | 8 | Chosen to place peak customs revenue at exactly 25% |
| `FREE_PARTICIPATION` | 0.32 | Age structure of 1790 population; refine against census age data |
| `COERCED_PARTICIPATION` | 0.55 | Forced labor including women and children; refine |
| `START_DEBT_RATE` | 0.04 | Blended estimate of Hamilton funding plan tranches; **refine when receipts data lands** |
| `START_TARIFF` | 0.10 | Tariff Act of 1789 schedule; yields $4.30M customs vs a real ~$4.4M |
| `START_STABILITY` | 55 | Design judgment |
| `START_LEGITIMACY` | 70 / 50 | Design judgment (republic / monarchy) |
| `START_SECTIONAL_TENSION` | 20 | Design judgment |
| Regional exposure vectors | §7.12 table | Economic geography of the period |
| Regional prosperity / sentiment | §4.1 table | Economic geography of the period |
| Lag constants τ | §7.1 table | Design judgment on plausible response times |
| `AG_PRODUCTIVITY` | **114.7013** | **Solved** so day-0 output composes to the verified $193M |
| `MAN_PRODUCTIVITY` | **146.2268** | **Solved** as above, including the tariff protection factor |
| `START_TRADE_CAPACITY` | **46,581,344** | **Solved** so trade volume ≈ $43M at a 10% tariff |
| `TRADE_SERVICES_MULTIPLIER` | **0.6733** | **Solved** to close the GDP composition |
| `EMERGENCY_BORROWING_PREMIUM` | 0.15 | Deficit borrowing costs more than the shortfall |
| `MIN_BORROWING_RATE` / `MAX` | 0.03 / 0.14 | Provisional; revisit during the balance pass |
| `MIGRATION_RATE` | 0.00035/month | Provisional; tune to reproduce the 1800 regional distribution (§10) |

### 9.1 How the solved constants were derived

`AG_PRODUCTIVITY`, `MAN_PRODUCTIVITY`, `START_TRADE_CAPACITY`, and
`TRADE_SERVICES_MULTIPLIER` are not guesses. They were solved backwards from
the **verified** 1790 nominal GDP of $193M, given the labor force implied by
the census figures, with GDP apportioned as:

| Component | Share | Day-0 value |
|---|---:|---:|
| Agriculture | 65% | $125.45M |
| Manufacturing | 18% | $34.74M |
| Trade services | 15% | $28.95M |
| Government output | ~2% | $3.90M |

The implemented engine reproduces **$193.04M**, a residual of 0.02% arising
because government output uses actual computed outlays rather than the flat 2%
used in the solve. GDP per capita comes to **$49.13**.

> **A constant this anchoring catches things.** `MAN_PRODUCTIVITY` was first
> solved without the tariff protection factor that §7.4 applies to
> manufacturing, which overstated day-0 GDP by 0.74%. The `createGame` test
> failed on it immediately. That is the whole argument for anchoring
> calibration to a verified figure rather than to a number that merely looks
> plausible — a plausible number cannot fail a test.

Constants marked provisional are set during the balance pass, once the engine
runs a full span and §10 can actually be measured.

---

## 10. Validation plan

How we will know the model works, rather than merely runs.

**The null run.** Start a game, change no policy, advance to 1800-12-31. The result should land in the neighborhood of real history:

| Check | Target (verified) | Tolerance |
|---|---|---|
| National population, 31 Dec 1800 | 5,308,483 | ±10% |
| Nominal GDP, 1800 | $486M | ±25% |
| Federal debt, 1 Jan 1801 | $83,038,050.80 | ±25% |
| Kentucky/Frontier share of population | Frontier grows dramatically | Directional |

Wide tolerances are intentional. The goal is a model that lands in the right *region* of outcome space unattended, not one overfitted to replay history exactly — that would violate pillar 3 (`DESIGN.md` §1.1).

**Directional tests.** Each asserts a causal claim from §7 and will fail loudly if the sign of a relationship ever inverts:

1. Raising the tariff from 5% to 20% increases customs revenue.
2. Raising the tariff from 25% to 40% **decreases** customs revenue.
3. Raising the excise reduces Frontier sentiment, and Frontier compliance falls within 12 months.
4. Raising the excise past a threshold produces *less* total excise revenue than a moderate rate.
5. Sustained deficits reduce the credit rating and raise new borrowing costs.
6. Paying down debt raises the credit rating and lowers borrowing costs.
7. A tariff rise raises Mid-Atlantic manufacturing output and lowers Southern sentiment in the same run.
8. Regional sentiment divergence raises sectional tension even when mean sentiment is unchanged.
9. A republic left alone loses legitimacy substantially; a monarchy loses far less. *(Refined during implementation: a monarchy has no decay **term**, which is not the same as immunity to outcomes. It still converts prosperity into legitimacy at a reduced rate, so a monarchy presiding over worsening conditions does lose a little — which is correct and desirable. The claim is comparative, so the test is comparative.)*
10. No policy change produces its full effect in under one month.

**Determinism and serialization** are covered by `DESIGN.md` §15.

---

## 11. Open modeling questions

1. **Receipts/outlays benchmark data** (§3.1) — the one real blocker for full History-view fidelity. Needs PDF tooling.
2. **`START_DEBT_RATE`** is an estimate. Once annual outlays data exists, debt service can be checked against actuals and the rate refined.
3. **Enslaved population growth rate** needs the 1800 census state-level figures to anchor properly.
4. **Price level** — Phase 1 is nominal throughout. Fine for now, but real comparisons will eventually want a deflator.
5. **Foreign demand shocks.** The 1793–1815 European wars massively boosted American shipping — the GDP series shows it plainly, jumping from $256M in 1793 to $390M in 1795. Phase 1 has no diplomacy system, so this arrives as scripted events adjusting `tradeCapacity`. That is honest for now, but it means a meaningful share of the boom is exogenous rather than earned. Worth flagging to the player in the History view so a windfall is not misread as good governance.
6. **Whether `governmentOutput` should feed back into GDP at all** — including it matches the benchmark series, but it means deficit spending mechanically raises GDP. Defensible, and consistent with the source, but a player could discover it as an exploit. Watch it in the balance pass.

7. **NOMINAL VERSUS REAL — the most significant open issue. Needs a decision.**

   Discovered when the null-run validation (§10) was first executed. The model reaches roughly **$268M** by 1800 against a verified **$486M**. That gap is not a mis-tuned constant, and widening the tolerance would be exactly the kind of dishonesty this document exists to prevent.

   The decomposition:

   | | 1790 | 1800 | Growth |
   |---|---:|---:|---:|
   | Real US population | 3,929,326 | 5,308,483 | 3.05%/yr |
   | Verified nominal GDP | $193M | $486M | 9.68%/yr |
   | Verified nominal GDP per capita | $49.12 | $91.55 | **6.42%/yr** |
   | **Our model, GDP per capita** | $49.12 | ~$49 | **~0%** |

   **The model has no price level.** It is therefore effectively a constant-dollar (real) series, while the MeasuringWorth benchmark is nominal. Actual *real* per-capita growth in the 1790s was close to zero — almost the whole 6.42% was price inflation plus the exogenous shipping boom from the European wars after 1793.

   So the model is not obviously wrong; **it is measuring a different thing from the benchmark.** This is precisely the definitional mismatch §7.6 warns about for government output, in a larger and less obvious form. Shipping it unaddressed would make the History view report a 45% shortfall as though it were the player's failure, which is the exact false signal the comparison view exists to prevent.

   Three ways out, in order of preference:

   **(a) Add a price level.** Introduce a deflator series driven by money supply, war demand, and trade disruption, and make the model produce nominal figures. Most faithful, most work, and gives us inflation as a governable phenomenon — which is good, since inflation is a real instrument of governance the game should eventually model.

   **(b) Compare in real terms.** Source a price index (MeasuringWorth carries one), convert the benchmark to constant 1790 dollars, and compare real-to-real. Cheaper and immediately honest. Costs us nothing in Phase 1 and defers (a) to whenever inflation becomes a mechanic.

   **(c) Label the axis and move on.** Show both series, mark ours "real" and theirs "nominal", and let the player interpret. Honest but weak — it makes the signature feature harder to read, which defeats its purpose.

   **DECIDED 2026-08-15: option (b) for Phase 1, option (a) later.** It makes the comparison correct now at low cost and does not foreclose adding a price level when inflation becomes a system the player can act on.

   > ### ✅ IMPLEMENTED 2026-08-15
   >
   > The MeasuringWorth annual consumer price index for 1789–1801 is now sourced and stored in `src/content/history/benchmarks.ts` with its citation. The History view deflates the nominal GDP benchmark to **constant 1790 dollars** and states that basis on screen for both columns.
   >
   > **Result: the apparent gap fell from 45% to about 24%.**
   >
   > | | Nominal | Real (1790 dollars) |
   > |---|---:|---:|
   > | Verified 1800 GDP | $486M | **$353.8M** |
   > | Model reaches | $268.8M | $268.8M |
   > | Apparent shortfall | 45% | **24%** |
   >
   > The residual 24% is largely the exogenous shipping boom from the European wars after 1793, which the model cannot generate because Phase 1 has no diplomacy system. That is a known and documented limitation rather than a calibration error, and it is the right kind of gap to leave visible.
   >
   > Deflation is performed at read time as a labelled derivation. The data files keep the sourced nominal figures exactly as published — a converted figure is not the figure the source printed, and the interface says so.

   **What (b) requires:**
   1. Source a price index covering 1789–1800 with a citation, and store it in `/src/content/history/` like any other benchmark series.
   2. Convert the nominal GDP benchmark to constant 1790 dollars at load time, never in the data file — the file keeps the sourced nominal figures as published.
   3. The History view labels the GDP row explicitly as **"real, constant 1790 dollars"** for both columns. Per §12 of DESIGN.md, the conversion is a derivation and must be visible as one; a converted figure is not the figure the source published.
   4. The deflator itself is benchmark data and carries its own citation. If we lack a sourced index for a year, that year renders unavailable like any other gap.

   Until (b) is implemented, the null-run test asserts what the model actually claims — per-capita stability — and pins the known ratio against 1800 so the gap cannot silently drift.
