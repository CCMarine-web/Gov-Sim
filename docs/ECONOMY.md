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

### 3.3 Price level / deflator

Not yet sourced. Needed only if we want real (inflation-adjusted) comparisons. Phase 1 compares nominal figures throughout, and **labels them as nominal**, which is honest and sufficient. MeasuringWorth carries the series when we want it.

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

### 7.9 Receipts, outlays, and the treasury

```
annualReceipts = customsRevenue + exciseRevenue + landRevenue + OTHER_RECEIPTS

debtService    = debt × weightedRate                       ← non-discretionary, computed first
annualOutlays  = debtService + militarySpending + civilSpending + infrastructureSpending
```

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

   **What (b) requires:**
   1. Source a price index covering 1789–1800 with a citation, and store it in `/src/content/history/` like any other benchmark series.
   2. Convert the nominal GDP benchmark to constant 1790 dollars at load time, never in the data file — the file keeps the sourced nominal figures as published.
   3. The History view labels the GDP row explicitly as **"real, constant 1790 dollars"** for both columns. Per §12 of DESIGN.md, the conversion is a derivation and must be visible as one; a converted figure is not the figure the source published.
   4. The deflator itself is benchmark data and carries its own citation. If we lack a sourced index for a year, that year renders unavailable like any other gap.

   Until (b) is implemented, the null-run test asserts what the model actually claims — per-capita stability — and pins the known ratio against 1800 so the gap cannot silently drift.
