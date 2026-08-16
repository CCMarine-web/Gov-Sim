/**
 * CALIBRATION CONSTANTS
 *
 * Every tunable parameter in the simulation, in one reviewable place.
 * Implements the register in ECONOMY.md §9.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THESE ARE NOT HISTORICAL FACTS.
 *
 * DESIGN.md §12.2 draws a hard line between two kinds of number:
 *
 *   BENCHMARK DATA (src/content/history/) is a claim about what really
 *   happened. Every figure carries a source citation, or is explicitly marked
 *   unavailable. It may be shown to the player as history.
 *
 *   CALIBRATION CONSTANTS (this file) are game-design parameters. They are
 *   documented and reasoned, and several are anchored to verified figures —
 *   but they are NEVER presented to the player as historical fact.
 *
 * The History comparison view reads only from benchmark data. Nothing in this
 * file may reach it. That separation is what lets us honour "never fabricate a
 * historical number" while still having an economy that runs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ============================================================================
// POPULATION (ECONOMY.md §7.2)
// ============================================================================

/**
 * Annual population growth rate at neutral prosperity and stability.
 *
 * The strongest-provenance constant in the model: it falls directly out of two
 * verified census figures rather than being tuned.
 *
 *   (5,308,483 / 3,929,326) ^ (1/10) − 1 = 0.03054
 *
 * Sources: 1790 and 1800 United States Censuses.
 */
export const BASE_GROWTH = 0.0305;

/** Prosperity swings growth by ±10% at the extremes of the 0–100 range. */
export const PROSPERITY_GROWTH_DIVISOR = 500;

/** Stability swings growth by ±5% at the extremes. */
export const STABILITY_GROWTH_DIVISOR = 1000;

/**
 * Monthly share of a settled region's population that migrates to the frontier
 * at neutral relative prosperity.
 *
 * Kentucky grew from 73,677 (1790) to 220,955 (1800) — about 11.6%/yr, far
 * beyond any natural rate. Migration is modelled as a transfer, so national
 * population is conserved. Tuned so an unperturbed run approximately
 * reproduces the real 1800 regional distribution (ECONOMY.md §10).
 */
export const MIGRATION_RATE = 0.00035;

// ============================================================================
// LABOUR (ECONOMY.md §7.3)
// ============================================================================

/**
 * Share of the free population in the labour force.
 * Low by modern standards because roughly half the 1790 population was under
 * sixteen. Flagged for refinement against census age structure.
 */
export const FREE_PARTICIPATION = 0.32;

/**
 * Share of the enslaved population subjected to forced labour.
 *
 * Higher than free participation because enslaved women, children, and the
 * elderly were worked. This is a documented fact of the period's economy, and
 * omitting it would make the model systematically understate Southern output
 * and misrepresent why the sectional conflict was so intractable.
 * (ECONOMY.md §7.16)
 */
export const COERCED_PARTICIPATION = 0.55;

// ============================================================================
// OUTPUT (ECONOMY.md §7.4)
// ============================================================================

/**
 * Dollars of annual agricultural output per agricultural worker.
 *
 * Solved, not guessed: chosen so that day-0 output composes exactly to the
 * verified 1790 nominal GDP of $193M, given the labour force implied by the
 * census figures and the day-0 stability drag. See §7.6.
 */
export const AG_PRODUCTIVITY = 114.7013;

/**
 * Dollars of annual manufacturing output per manufacturing worker.
 *
 * Solved as above, but note the extra term: manufacturing output also carries
 * the tariff protection bonus, so this is solved against
 * `manLabor x drag x (1 + TARIFF_PROTECTION_K x startingTariff)`. Solving it
 * without that factor overstates day-0 GDP by about 0.7%, which is exactly
 * what the createGame test caught the first time round.
 */
export const MAN_PRODUCTIVITY = 146.2268;

/** Share of each region's labor force working in agriculture. */
export const AG_LABOR_SHARE: Record<string, number> = {
  new_england: 0.7, // significant shipping, fishing, early manufacturing
  mid_atlantic: 0.78, // mixed farming, milling, commerce
  south: 0.9, // staple-crop plantation agriculture
  frontier: 0.95, // subsistence farming and distilling
};

/**
 * Instability suppresses output: disrupted markets, seized goods, men under
 * arms rather than at the plough. At stability 100 the drag is 1.0; at 0 it is
 * 0.85. A 15% swing is large enough to matter without making a crisis fatal.
 */
export const STABILITY_DRAG_FLOOR = 0.85;
export const STABILITY_DRAG_RANGE = 0.15;

/** Asymptotic ceiling on the infrastructure output bonus. */
export const INFRA_MAX = 0.25;

/**
 * Cumulative infrastructure spend at which ~63% of the maximum bonus is
 * reached. Diminishing returns: the tenth road matters less than the first.
 */
export const INFRA_SCALE = 5_000_000;

/** Tariff protection bonus to manufacturing, per unit of tariff rate. */
export const TARIFF_PROTECTION_K = 0.4;

// ============================================================================
// TRADE AND THE TARIFF CURVE (ECONOMY.md §7.5)
// ============================================================================

/**
 * Elasticity constant in `tradeVolume = capacity × e^(−K × rate²)`.
 *
 * K = 8 places peak customs revenue at exactly `1/√(2K)` = 0.25 — the 25%
 * figure the design brief specifies. The squared exponent makes the curve
 * gentle below 15% and sharply punishing above 30%, which is what makes the
 * tariff an interesting decision rather than a slider to max out.
 */
export const TARIFF_ELASTICITY_K = 8;

/** Where customs revenue peaks. Derived: 1/√(2K). Marked on the Treasury slider. */
export const TARIFF_REVENUE_PEAK = 0.25;

/**
 * Day-0 trade capacity, in dollars.
 * Set so that at the starting 10% tariff, trade volume is about $43M — roughly
 * consistent with contemporary import and export totals — and customs revenue
 * comes to $4.30M against a real figure of roughly $4.4M.
 */
export const START_TRADE_CAPACITY = 46_581_344;

/**
 * Domestic commercial activity supported per dollar of trade volume.
 * Represents the distribution and commerce sector, not a margin on foreign
 * trade alone. Solved so day-0 GDP composes to $193M.
 */
export const TRADE_SERVICES_MULTIPLIER = 0.6733;

/** Share of federal outlays counted as government output in GDP. */
export const GOV_OUTPUT_FACTOR = 1.0;

// ============================================================================
// EXCISE AND COMPLIANCE (ECONOMY.md §7.7)
// ============================================================================

/** Compliance with no sentiment effect either way. */
export const BASE_COMPLIANCE = 85;

/** Compliance points gained per point of regional sentiment. */
export const SENTIMENT_TO_COMPLIANCE = 0.25;

/** Compliance points gained per point of legitimacy above 50. */
export const LEGITIMACY_TO_COMPLIANCE = 0.2;

/**
 * Legitimacy below this begins dragging regional compliance downward — the
 * degraded-governance mechanism. The player never loses power; they lose the
 * ability to collect taxes, which is worse and more interesting.
 * (DESIGN.md §10)
 */
export const COMPLIANCE_THRESHOLD = 30;

/**
 * Taxable distilling base per region, in dollars.
 *
 * Overwhelmingly concentrated on the frontier, because whiskey was the only
 * form in which a bulk grain crop could profitably cross the mountains to
 * market. This is why the excise is a regional weapon rather than a national
 * one, and why the Whiskey Rebellion happened where it did.
 */
export const DISTILLING_BASE: Record<string, number> = {
  new_england: 1_800_000,
  mid_atlantic: 3_200_000,
  south: 2_400_000,
  frontier: 4_100_000,
};

/** Taxable land value per region, in dollars. */
export const LAND_VALUE_BASE: Record<string, number> = {
  new_england: 22_000_000,
  mid_atlantic: 28_000_000,
  south: 41_000_000,
  frontier: 4_000_000,
};

/** Miscellaneous receipts — post office, patents, land sales. */
export const OTHER_RECEIPTS = 120_000;

// ============================================================================
// TAXABLE BASES FOR THE REMAINING REVENUE BASES (ECONOMY.md §7.8)
//
// These are the taxable values behind the tax bases the federal government
// either did use in this period or plausibly could have. Each is a CALIBRATION
// CONSTANT, not a historical measurement, and none is ever shown to the player
// as history.
//
// NONE OF THESE AFFECTS THE NULL RUN. A base only produces revenue when a tax
// instance exists against it, and at the founding only the impost, the spirits
// excise and the land tax exist — the latter two at a rate of zero. So these
// figures are inert until a bill creates an instance, which is deliberate: the
// structural change in queue item 3 must not move a single calibrated number.
// (docs/DECISIONS.md D-018)
// ============================================================================

/**
 * Assessed value of pleasure carriages, per region.
 *
 * Anchored to the Carriage Duty Act of 1794, which the Supreme Court upheld in
 * *Hylton v. United States* (1796) and which yielded on the order of $150,000 a
 * year nationally. These figures put a 2% ad valorem rate near that yield,
 * which is the reference the base is solved against. Concentrated in the
 * commercial cities — a pleasure carriage was a marker of urban wealth, and the
 * frontier had almost none.
 */
export const CARRIAGE_VALUE_BASE: Record<string, number> = {
  new_england: 1_900_000,
  mid_atlantic: 2_800_000,
  south: 2_600_000,
  frontier: 200_000,
};

/**
 * Assessed value of dwelling houses, per region.
 *
 * Part of the Direct Tax of 1798, which assessed dwellings, land and enslaved
 * people together to raise an apportioned $2,000,000. Housing value tracks
 * settled urban wealth, so it is weighted toward the north-east far more
 * strongly than farmland is.
 */
export const DWELLING_VALUE_BASE: Record<string, number> = {
  new_england: 19_000_000,
  mid_atlantic: 24_000_000,
  south: 17_000_000,
  frontier: 2_000_000,
};

/**
 * Assessed value on which the 1798 direct tax's per-head levy on enslaved
 * people fell, per region.
 *
 * The 1798 act laid a flat 50 cents per enslaved person aged 12 to 50. This is
 * expressed here as an assessed value so that every tax base in the model
 * shares one arithmetic — rate times base — rather than some being ad valorem
 * and others per-head. The regional split follows the 1790 census distribution
 * of enslaved people, which is sourced benchmark data
 * (src/content/regions/regions1790.ts); the conversion to an assessed value is
 * a calibration choice.
 *
 * This tax is available in the model because it existed. Its presence is a
 * statement of fact about what the federal government did, not an endorsement,
 * and the interface presents it with that context. (DESIGN.md §8.3)
 */
export const ENSLAVED_ASSESSMENT_BASE: Record<string, number> = {
  new_england: 40_000,
  mid_atlantic: 1_100_000,
  south: 20_500_000,
  frontier: 900_000,
};

/**
 * Value of transactions reachable by stamp duties, per region.
 *
 * Anchored to the Stamp Act of 1797, a federal duty on legal instruments,
 * bonds, insurance policies and ships' papers. Legal and financial paper is
 * created where commerce is, so this is heavily weighted to the mercantile
 * regions.
 */
export const STAMPABLE_BASE: Record<string, number> = {
  new_england: 3_400_000,
  mid_atlantic: 4_600_000,
  south: 2_100_000,
  frontier: 250_000,
};

/**
 * Value of goods sold at auction, per region.
 * The 1794 excise taxed sales at auction. Auctions were a port-city
 * institution — a principal channel for disposing of imported cargo.
 */
export const AUCTION_VALUE_BASE: Record<string, number> = {
  new_england: 2_200_000,
  mid_atlantic: 3_100_000,
  south: 1_400_000,
  frontier: 80_000,
};

/**
 * Value of refined sugar and manufactured snuff, per region.
 * Both were taxed by the 1794 excise. Refining and snuff manufacture were
 * concentrated in the northern cities.
 */
export const REFINED_GOODS_BASE: Record<string, number> = {
  new_england: 900_000,
  mid_atlantic: 1_600_000,
  south: 500_000,
  frontier: 40_000,
};

/**
 * Assessable income, per region — COUNTERFACTUAL.
 *
 * No federal income tax existed in this period, and levying one would have run
 * straight into the apportionment requirement for direct taxes (Article I §2
 * and §9) — the objection that eventually required the Sixteenth Amendment in
 * 1913. The base exists so the model can answer "what if", clearly labelled as
 * ahistorical, and so the interface can explain exactly what would have had to
 * change first.
 *
 * Derived as a fraction of regional output rather than sourced, because there
 * is nothing to source: no one measured national income in 1790.
 */
export const ASSESSABLE_INCOME_SHARE = 0.18;

/**
 * Retail sales reachable by a general sales tax, per region — COUNTERFACTUAL.
 * Same status as income: administratively out of reach in the 1790s, present so
 * the counterfactual can be asked and answered.
 */
export const RETAIL_SALES_SHARE = 0.11;

// ============================================================================
// DEBT AND CREDIT (ECONOMY.md §7.9, §7.10)
// ============================================================================

/**
 * Effective blended annual interest rate on the day-0 debt.
 * Hamilton's funding plan carried much of the domestic debt at 6% with a
 * deferred 3% tranche; 4% is a reasonable blend. FLAGGED FOR REFINEMENT once
 * annual outlays data lands and debt service can be checked against actuals.
 */
export const START_DEBT_RATE = 0.04;

/** Borrowing to cover a deficit costs more than the shortfall. */
export const EMERGENCY_BORROWING_PREMIUM = 0.15;

/** Best and worst achievable rates on new borrowing. */
export const MIN_BORROWING_RATE = 0.03;
export const MAX_BORROWING_RATE = 0.14;

/** Credit rating with no debt burden and neutral stability. */
export const BASE_CREDIT = 60;

/** Credit points lost per unit of debt-to-GDP ratio. */
export const DEBT_TO_GDP_PENALTY = 45;

/** Credit points lost per missed debt service payment. Permanent. */
export const MISSED_PAYMENT_PENALTY = 20;

/** Credit points gained per point of stability above 50. */
export const STABILITY_TO_CREDIT = 0.3;

// ============================================================================
// PROSPERITY, SENTIMENT, TENSION, STABILITY (ECONOMY.md §7.11–§7.14)
// ============================================================================

export const TAX_TO_PROSPERITY = 60;
export const INFRA_TO_PROSPERITY = 40;

export const TAX_TO_SENTIMENT = 90;
export const PROSPERITY_TO_SENTIMENT = 0.6;
export const TREND_TO_SENTIMENT = 4;

export const SPREAD_TO_TENSION = 0.35;
export const PROSPERITY_SPREAD_TO_TENSION = 0.25;

export const SENTIMENT_TO_STABILITY = 0.3;
export const TENSION_TO_STABILITY = 0.25;
export const LEGITIMACY_TO_STABILITY = 0.2;

// ============================================================================
// LEGITIMACY AND GOVERNMENT TYPE (ECONOMY.md §7.15, §8)
// ============================================================================

/**
 * Monthly legitimacy decay for a republic.
 *
 * A republic must continually re-earn consent; a monarchy claims legitimacy by
 * right and does not decay, but has further to fall when it fails. This single
 * asymmetry is the mechanical expression of the founding choice.
 */
export const REPUBLIC_DECAY_PER_MONTH = 0.18;

/** A monarchy converts prosperity into legitimacy less efficiently. */
export const MONARCHY_GAIN_FACTOR = 0.6;

/** A monarchy suffers amplified legitimacy penalties from crises. */
export const MONARCHY_PENALTY_FACTOR = 1.5;

export const PROSPERITY_TO_LEGITIMACY = 0.25;

/**
 * Legitimacy cost of raising taxes, per unit of aggregate rate increase.
 *
 * Enacting an unpopular policy spends political capital. A 10-point tariff
 * rise (0.10) costs `0.10 x 45 = 4.5` legitimacy at the republic's rate.
 * Applied as a decaying `policy` modifier so the cost is visible in the stat
 * breakdown and wears off rather than being permanent.
 */
export const POLICY_LEGITIMACY_COST = 45;

/** How long the political cost of a policy change lingers. */
export const POLICY_COST_DURATION_DAYS = 730;

/**
 * A republic must carry the country with it; a crown may simply act.
 * The mechanical expression of DESIGN.md §9.2, "cost of unilateral action".
 */
export const REPUBLIC_ACTION_COST = 1.0;
export const MONARCHY_ACTION_COST = 0.55;

// ============================================================================
// POLITICAL CAPITAL (ECONOMY.md §7.17)
//
// The scale is chosen so that a well-run republic accrues roughly 1.5 a day —
// about 45 a month, 550 a year — against a cap near 100. That makes a major
// legislative push a matter of a few months of husbanding rather than of years,
// which is the right pace for a game whose clock runs at several days a second.
// ============================================================================

/** Accrual with everything neutral: legitimacy 50, stability 50, no support. */
export const BASE_CAPITAL_ACCRUAL = 0.9;

/** Accrual per point of legitimacy above 50. */
export const LEGITIMACY_TO_CAPITAL = 0.014;

/** Accrual per point of mean regional sentiment. The republic's base. */
export const POPULAR_SUPPORT_TO_CAPITAL = 0.009;

/**
 * Accrual per point of prosperity-weighted sentiment. The crown's base.
 *
 * Larger than the republic's coefficient because the base is narrower: a crown
 * needs the acquiescence of fewer people, so each point of their satisfaction
 * is worth more. The flip side is that it responds to a smaller constituency,
 * which is what makes a monarchy fail suddenly rather than gradually.
 */
export const ELITE_SUPPORT_TO_CAPITAL = 0.013;

/** Accrual per point of stability above 50. A crisis consumes attention. */
export const STABILITY_TO_CAPITAL = 0.006;

/** Accrual per point of administrative capacity. */
export const ADMIN_TO_CAPITAL = 0.006;

/** Nothing accrues faster than this, whatever the circumstances. */
export const MAX_CAPITAL_ACCRUAL = 6;

/** The cap at neutral legitimacy. */
export const BASE_CAPITAL_CAP = 90;

/** Cap points per point of legitimacy above 50. */
export const CAPITAL_CAP_FROM_LEGITIMACY = 0.9;

/**
 * A crown's cap, relative to a republic's.
 *
 * The counterweight to cheaper action (DESIGN.md §9.2). A crown may act more
 * freely at any moment but cannot husband capacity for a large reform the way a
 * republic can: speed against reach. If this were 1.0 the monarchy would be
 * strictly better, which the brief calls a defect and it would be right to.
 */
export const MONARCHY_CAPITAL_CAP_FACTOR = 0.75;

/**
 * Capital cost of a budget change, per unit of aggregate rate movement.
 *
 * Charged on the ABSOLUTE change, unlike the legitimacy cost, which falls only
 * on rises (D-001). Lowering a tax still takes a bill through, still consumes
 * the government's attention, and still has to be argued for. Charging both
 * directions also closes the last door on rate-oscillation as a strategy.
 */
export const BUDGET_CAPITAL_COST_PER_RATE = 200;

/**
 * Capital cost per dollar of change to a spending programme.
 *
 * Cheaper per unit of disruption than a tax change, and deliberately: an
 * appropriation is politically easier than a levy. Doubling the military
 * establishment costs about five capital; a thirty-point swing in the tariff
 * costs sixty. That ordering is the point.
 */
export const BUDGET_CAPITAL_COST_PER_DOLLAR = 0.000008;

/** No budget change is free, however small — a bill is a bill. */
export const BUDGET_CAPITAL_COST_FLOOR = 1.5;

/** Default multiplier on accrual and cap while emergency powers are in force. */
export const EMERGENCY_POWERS_MULTIPLIER = 2.5;

// ============================================================================
// BLOCS (ECONOMY.md §7.21, brief §1 and queue item 8)
//
// WHO THE COUNTRY IS MADE OF, AT THE FOUNDING.
//
// Membership is a fraction of a REGION'S population, per bloc, and it is the
// day-0 seed for a quantity that then moves — the live figures are state, in
// `GameState.blocs`, and the model that moves them is `src/sim/blocs.ts`.
//
// These are CALIBRATION CONSTANTS, not benchmark data (DESIGN.md §12.2). No
// census counted planters, and none of these figures is displayed anywhere as a
// historical fact. What they are is a documented reading of the economic
// geography the region seeds already encode, with each column reasoned below.
//
// TWO PROPERTIES THAT LOOK LIKE ERRORS AND ARE NOT.
//
// The rows do not sum to 1 in either direction, on purpose:
//
//   ABOVE 1 on the frontier (about 1.37), because membership OVERLAPS. Half the
//   frontier are small farmers and four fifths are frontier settlers, and most
//   of them are both people. That is the graduated, overlapping membership the
//   brief asks for, and a column summing to exactly 1 would be the binary model
//   it asks us to leave behind.
//
//   BELOW 1 in the South (about 0.60), because a third of the region's people
//   were enslaved and had no political interest this model can represent — they
//   were permitted none. Rounding them into "small farmers" would make the
//   column tidy by asserting something false about 1790. The gap is reported to
//   the player instead (`unrepresentedShare`).
// ============================================================================

export const BLOC_MEMBERSHIP_1790: Record<string, Record<string, number>> = {
  /*
    NEW ENGLAND — 1,009,522 people, almost no enslaved population, poor soil and
    the country's deepest harbours. Farms are small and worked by their owners;
    the carrying trade and the fisheries are the region's cash. The standing
    order of Congregational churches is stronger here than anywhere else, which
    is why the clergy share is the highest of the four.
  */
  new_england: {
    small_farmers: 0.55,
    artisans: 0.1,
    merchants: 0.035,
    seamen: 0.045,
    financiers: 0.005,
    clergy: 0.022,
    planters: 0.002,
    frontier_settlers: 0.004,
  },
  /*
    MID-ATLANTIC — 1,017,726 people, the mixed-farming and milling belt, and the
    two cities where the public debt and the banks actually live. Highest
    financier share by a wide margin, and the largest artisan population.
  */
  mid_atlantic: {
    small_farmers: 0.55,
    artisans: 0.11,
    merchants: 0.04,
    seamen: 0.025,
    financiers: 0.008,
    clergy: 0.016,
    planters: 0.012,
    frontier_settlers: 0.012,
  },
  /*
    SOUTH — 1,792,710 people, of whom 632,593 are enslaved. Staple agriculture on
    large holdings is a SMALL share of households and a dominant share of wealth,
    which is why planters are 5.5% of the population and carry the highest
    `BLOC_POWER` of any bloc. The shares total about 0.60; see the note above.
  */
  south: {
    small_farmers: 0.42,
    artisans: 0.04,
    merchants: 0.015,
    seamen: 0.008,
    financiers: 0.002,
    clergy: 0.012,
    planters: 0.055,
    frontier_settlers: 0.01,
  },
  /*
    FRONTIER — 109,368 people in Kentucky and the Southwest Territory. Almost
    everybody here is a frontier settler, and most of them are also a small
    farmer: land-hungry, cash-poor, distilling grain because it is the only form
    in which a crop can be carried over the mountains. Which is exactly why the
    whiskey excise landed the way it did.
  */
  frontier: {
    small_farmers: 0.5,
    artisans: 0.03,
    merchants: 0.008,
    seamen: 0.001,
    financiers: 0.001,
    clergy: 0.008,
    planters: 0.02,
    frontier_settlers: 0.8,
  },
};

/**
 * How hard each bloc's size responds to each economic quantity.
 *
 * An elasticity against the day-0 value: `(now / then)^e`. A bloc with e = 0.6
 * on trade per head grows by about 6% when trade per head grows by 10%. Sign
 * matters — `small_farmers` has a NEGATIVE elasticity on manufacturing, because
 * the workshop fills from the farm and always has.
 *
 * Magnitudes are deliberately below 1 across the board. People move between
 * occupations more slowly than the economy moves, and an elasticity above 1
 * would have a bloc outrunning the thing supposedly causing it.
 */
export const BLOC_ELASTICITIES: Record<
  string,
  Partial<
    Record<
      | 'tradePerHead'
      | 'manufacturingPerHead'
      | 'agriculturePerHead'
      | 'enslavedShare'
      | 'prosperity'
      | 'population',
      number
    >
  >
> = {
  /** The carrying trade makes merchants; nothing else does. */
  merchants: { tradePerHead: 0.6, prosperity: 0.15 },
  /** Crews are hired to carry cargo. Slightly less responsive than their masters. */
  seamen: { tradePerHead: 0.5 },
  /** Protection and prosperity fill the workshops. */
  artisans: { manufacturingPerHead: 0.7, prosperity: 0.2 },
  /**
   * Grows with farm output and SHRINKS as manufacturing rises — the single
   * clearest case of the brief's "policies change the size of groups": a tariff
   * that builds workshops does not just please the artisans, it makes more of
   * them, out of the farmers.
   */
  small_farmers: { agriculturePerHead: 0.25, manufacturingPerHead: -0.3 },
  /** Staple agriculture on large holdings tracks the labour it was built on. */
  planters: { enslavedShare: 0.8, agriculturePerHead: 0.2 },
  /** Paper, banks and the public debt. The most concentrated and most volatile. */
  financiers: { tradePerHead: 0.4, prosperity: 0.5 },
  /** The west fills by migration, so its settlers track its population. */
  frontier_settlers: { population: 0.45 },
  /** Congregations are supported out of surplus, and only just track it. */
  clergy: { prosperity: 0.2 },
};

/**
 * How much of the remaining gap a bloc closes in a month.
 *
 * 3% a month is a half-life of about 23 months. Occupations change over years,
 * not quarters, and a bloc that snapped to its target would make policy feel
 * like a switch. It also means a measure repealed before it has taken hold
 * leaves the country roughly where it found it, which is the correct behaviour
 * and not a separate mechanism.
 */
export const BLOC_DRIFT_PER_MONTH = 0.03;

/** Nobody is ever quite nobody, and nobody is ever quite everybody. */
export const BLOC_MEMBERSHIP_MIN = 0.0005;
export const BLOC_MEMBERSHIP_MAX = 0.95;

/**
 * Sentiment points per unit of (reaction strength × regional weight).
 *
 * A bill that a bloc feels at full strength (100) and which is wholly
 * concentrated in one region (weight 1.0) moves that region's BASE sentiment by
 * 6 points — a large but not decisive shift, and one the six-month sentiment lag
 * then spreads over half a year. The whiskey excise, at −70 on frontier
 * settlers weighted 0.78, moves frontier base sentiment by about −3.3.
 */
export const BLOC_REACTION_TO_SENTIMENT = 0.06;

/**
 * How much a bloc's displeasure costs a government that ignores it.
 *
 * NOT the same as size. The small farmers are by far the most numerous bloc and
 * carry the least weight here; the financiers are a few hundred men in three
 * cities and carry a great deal. That asymmetry is the point of having a
 * separate number: a crown answers to whoever can actually obstruct it, and in
 * 1790 that is credit, commerce, the pulpit and the men who own the land — not
 * the majority.
 *
 * It is what makes decreeing against the planters a different act from
 * decreeing against the artisans, and it is the mechanism by which the
 * monarchy's freedom of action turns into its instability. (ECONOMY.md §7.19)
 */
export const BLOC_POWER: Record<string, number> = {
  planters: 1.0,
  financiers: 0.95,
  merchants: 0.85,
  clergy: 0.6,
  frontier_settlers: 0.5,
  artisans: 0.45,
  seamen: 0.35,
  small_farmers: 0.4,
};

// ============================================================================
// GRIEVANCE AND UNREST (ECONOMY.md §7.19, brief §2.1)
// ============================================================================

/**
 * Grievance points per unit of bloc opposition when a measure is DECREED.
 *
 * A decree is imposed. Nobody was persuaded, nobody consented, and the losers
 * had no opportunity to be heard — so the whole of their opposition becomes
 * resentment at the government rather than disappointment at an argument lost.
 */
export const DECREE_GRIEVANCE_PER_OPPOSITION = 0.28;

/**
 * The same, when a measure is LEGISLATED.
 *
 * Much lower, and this ratio is the central balance of the two paths. A bill
 * argued through, amended, and voted on is a bill the losers were part of
 * losing. They dislike the outcome; they do not resent the process. Set the two
 * equal and the republic's slowness buys nothing, which the brief calls a
 * defect and would be right to.
 */
export const LEGISLATION_GRIEVANCE_PER_OPPOSITION = 0.07;

/**
 * Monthly decay of bloc grievance, as a fraction of the current level.
 *
 * Proportional rather than flat, so a small grievance fades quickly and a large
 * one lingers: 3% a month is roughly a third gone in a year from a low base,
 * but a bloc at 80 is still at 55 two years later. Grievances are forgotten,
 * but not quickly, and never while the thing that caused them is still in force.
 */
export const GRIEVANCE_DECAY_PER_MONTH = 0.03;

/**
 * Legitimacy a crown spends per unit of power-weighted opposition to a decree.
 *
 * The brief: "Every decree spends legitimacy, and spends more when it runs
 * against the interests of powerful blocs." A decree the planters hate at full
 * strength costs about 2.4 legitimacy; one nobody minds costs the floor.
 */
export const DECREE_LEGITIMACY_PER_OPPOSITION = 0.024;

/** No decree is free, however uncontroversial. Acting alone always costs. */
export const DECREE_LEGITIMACY_FLOOR = 0.8;

/**
 * The crown's discount on the political capital cost of legislating.
 *
 * A decree needs no votes whipped and no coalition assembled, so it costs a
 * fraction of what carrying the same measure through a legislature costs. This
 * is the monarchy's advantage made concrete, and its price is the grievance and
 * legitimacy above. Speed against consent. (docs/DECISIONS.md D-027)
 */
export const DECREE_CAPITAL_FACTOR = 0.35;

/** Regional grievance above this begins to bite. Below it, nothing happens. */
export const UNREST_THRESHOLD = {
  resistance: 35,
  defiance: 55,
  revolt: 78,
} as const;

/** Compliance points lost per point of regional grievance above the threshold. */
export const GRIEVANCE_TO_COMPLIANCE = 0.55;

/** Sentiment points lost per point of regional grievance. */
export const GRIEVANCE_TO_SENTIMENT = 0.25;

/** Stability points lost while an episode of each severity is running. */
export const UNREST_STABILITY_COST: Record<string, number> = {
  resistance: 0,
  defiance: 4,
  revolt: 14,
};

/**
 * How far regional grievance must fall below the threshold that started an
 * episode before it ends.
 *
 * Hysteresis, and necessary: without it an episode sitting exactly on its
 * threshold would start and stop every month, filling the chronicle with a
 * rebellion that keeps changing its mind.
 */
export const UNREST_RESOLUTION_MARGIN = 6;

// ============================================================================
// SUCCESSION (ECONOMY.md §7.19)
// ============================================================================

/**
 * Annual probability of death, by age band, for a man of the governing class in
 * this period.
 *
 * Adult life expectancy is the relevant figure, not life expectancy at birth —
 * the latter was around 35 in 1790 and is dominated by infant mortality, which
 * says nothing about the survival of a fifty-seven-year-old who has already
 * cleared it. A man reaching adulthood in this period could expect his sixties.
 *
 * These are game-design parameters informed by that, not a life table. They are
 * never shown to the player as historical fact. (DESIGN.md §12.2)
 */
export const MORTALITY_BY_AGE: ReadonlyArray<{ from: number; annual: number }> = [
  { from: 0, annual: 0.004 },
  { from: 45, annual: 0.012 },
  { from: 55, annual: 0.025 },
  { from: 65, annual: 0.055 },
  { from: 75, annual: 0.12 },
  { from: 85, annual: 0.25 },
];

/**
 * Legitimacy a monarchy loses at a succession, even an orderly one.
 *
 * An heir inherits the crown, not the standing. Every transfer is a moment at
 * which the question "why this family?" can be asked out loud, and the answer
 * has to be re-established rather than assumed.
 */
export const SUCCESSION_LEGITIMACY_COST = 9;

/** The same, when no heir was named and the succession is disputed. */
export const SUCCESSION_CRISIS_LEGITIMACY_COST = 26;

/** Stability lost by a disputed succession. */
export const SUCCESSION_CRISIS_STABILITY_COST = 15;

/** How long a succession crisis weighs on the country. */
export const SUCCESSION_CRISIS_DURATION_DAYS = 730;

/**
 * The legitimacy a dynasty needs for its succession to be beyond argument.
 *
 * Above this, a new ruler's heir is obvious and uncontested and the next
 * transfer will be orderly. Below it, the claim is weak enough that nobody
 * settles the question in advance, and the next death is a crisis.
 *
 * This is what gives the monarchy's worst outcome a CAUSE THE PLAYER CONTROLS.
 * Without it every second succession would be disputed regardless of how the
 * country had been governed, which is a punishment rather than a mechanic.
 * (docs/DECISIONS.md D-028)
 */
export const HEIR_SECURITY_THRESHOLD = 42;

// ============================================================================
// CONGRESS (ECONOMY.md §7.20, brief §2.2)
//
// The weights below decide how often a member breaks with their party over a
// sectional question, and getting the RATIO right matters far more than the
// absolute values: too much party and the sectional crisis the game is building
// toward can never emerge; too much region and parties are decoration.
// ============================================================================

/**
 * How heavily a delegation weighs the party line.
 *
 * Multiplied by the party's own `discipline`, which is low in the first two
 * Congresses — there was no line to vote, and the Congressional Biographical
 * Directory records no party for those members for exactly that reason.
 */
export const CONGRESS_PARTY_LINE_WEIGHT = 55;

/**
 * How heavily it weighs its own state's interest.
 *
 * Deliberately comparable to the party weight once discipline is applied. A
 * Virginia Federalist and a Massachusetts Federalist are the same party and do
 * not vote alike on a tariff, and that divergence is the seed of the sectional
 * politics the whole game is building toward. (brief §2.2)
 */
export const CONGRESS_REGIONAL_WEIGHT = 48;

/**
 * How much a party cares about what happens to a bloc it is SET AGAINST.
 *
 * Opposing an interest politically is not the same as wanting it ruined. Without
 * this, a negative affinity times a negative reaction reads as a full positive,
 * and the model had the Federalists enthusiastically supporting federal
 * emancipation because it damaged an interest they opposed. A party is pleased
 * by its opponents' discomfort a little; it defends its own people a great deal.
 * (docs/DECISIONS.md D-031)
 */
export const OPPOSED_BLOC_DISCOUNT = 0.3;

/** Inclination lost per point of regional grievance. An aggrieved region obliges nobody. */
export const CONGRESS_GRIEVANCE_RESISTANCE = 0.35;

/**
 * How much of the Senate actually turns over at a congressional election.
 *
 * Not a design choice — Article I §3 cl. 2: "immediately after they shall be
 * assembled in Consequence of the first Election, they shall be divided as
 * equally as may be into three Classes", one class expiring every second year.
 * A third is therefore the constitutional figure, not a tuned one.
 *
 * The consequence is the reason it is modeled at all: the Senate carries two
 * thirds of an opinion the electorate has already left behind, so a government
 * that turns the country around still has to argue with the country as it was.
 */
export const SENATE_CLASS_TURNOVER = 1 / 3;

/**
 * Inclination within which a delegation is genuinely undecided and abstains.
 *
 * Real, and not a rounding convenience: an undecided member in the 1790s
 * abstained far more readily than a modern whipped one, and it means a bill can
 * carry a thin house on a plurality.
 */
export const CONGRESS_UNDECIDED_BAND = 6;

/** Inclination bought per point of whipping. */
export const CONGRESS_WHIP_EFFECT = 1.0;

/** Political capital per point of whipping. Persuasion is not cheap. */
export const WHIP_CAPITAL_PER_POINT = 0.9;

/**
 * A rider: a sweetener bundled for one interest.
 *
 * Strong, and priced accordingly. It buys one party's support outright and
 * costs both capital and the embarrassment of having done it.
 */
export const RIDER_VOTE_EFFECT = 34;
export const RIDER_CAPITAL_COST = 22;

/**
 * A log-roll: a promise of future support, in exchange for votes now.
 *
 * Cheapest of the three at the moment of use, and the most expensive later —
 * the obligation comes due at twice what it cost, and it comes due whether the
 * government can afford it or not. A promise with no cost is not a promise.
 */
export const LOG_ROLL_VOTE_EFFECT = 28;
export const LOG_ROLL_CAPITAL_COST = 8;
export const LOG_ROLL_DUE_DAYS = 540;

/** How long a defeated bill must wait before it can be brought again. */
export const FAILED_BILL_COOLDOWN_DAYS = 240;

/**
 * Legitimacy lost per defeat, multiplied by the number of defeats so far,
 * capped at four.
 *
 * Rising rather than flat, because the third bill a government loses says
 * something the first did not. "Repeatedly failing bills should visibly damage
 * the player's standing." (brief §2.2)
 */
export const CONGRESS_DEFEAT_LEGITIMACY_COST = 2.2;

/**
 * Legitimacy lost when a log-rolled promise comes due and cannot be paid.
 *
 * Higher than the capital it would have cost, because a government that cannot
 * keep its word has lost something a payment would not have bought back.
 */
export const UNKEPT_PROMISE_LEGITIMACY_COST = 6;

/** A Congress sits for two years, from 4 March of every odd year. */
export const CONGRESS_TERM_DAYS = 730;

// ============================================================================
// LAG TIME CONSTANTS (ECONOMY.md §7.1)
// ============================================================================

/**
 * Time constants in months. Converted to a per-month blend factor by
 * `alpha = 1 − e^(−1/τ)`.
 *
 * The spread between these is what makes the economy traceable rather than
 * twitchy: receipts respond within the month, prosperity takes a year. It is
 * also why the Treasury screen must show projected effects — the player cannot
 * otherwise see what they have set in motion.
 */
export const TAU_MONTHS = {
  stability: 3,
  sentiment: 6,
  prosperity: 12,
  creditRating: 12,
  compliance: 6,
  tradeCapacity: 24,
} as const;

/** Convert a time constant in months to a per-month lag blend factor. */
export function lagAlpha(tauMonths: number): number {
  return 1 - Math.exp(-1 / tauMonths);
}

// ============================================================================
// STARTING VALUES (ECONOMY.md §4)
// ============================================================================

/**
 * Day-0 values. Every one of these is a calibration constant, most anchored to
 * the nearest verified figure. There is no census, GDP estimate, or debt
 * figure dated 30 April 1789, so none of these is a historical measurement and
 * none is ever displayed as one.
 */
export const START = {
  /** 1790 census total, used un-adjusted. Back-projecting 15 months would
   *  require inventing a growth rate we would then also be estimating from
   *  this same figure — circular. */
  population: 3_929_326,
  enslavedPopulation: 697_697,

  /** Earliest available MeasuringWorth figure (1790). */
  gdp: 193_000_000,

  /** Earliest available Treasury figure (1 January 1790). */
  debt: 71_060_508.5,

  /** The Treasury Department was not created until 2 September 1789 — after
   *  day 0. Starting at zero is both defensible and dramatically correct. */
  treasuryBalance: 0,

  /** Tariff Act of 1789 schedules averaged roughly 8–10% ad valorem. At 10%
   *  the model produces $4.30M in customs revenue against a real figure of
   *  roughly $4.4M. */
  tariffRate: 0.1,

  /** No federal excise existed until March 1791; it arrives as an event. */
  exciseRate: 0,

  /** No federal direct tax until 1798. */
  landTaxRate: 0,

  stability: 55,
  sectionalTension: 20,
  creditRating: 45,

  /** Newly ratified constitution, functioning but untested. */
  legitimacy: { republic: 70, monarchy: 50 },

  spending: {
    military: 620_000,
    civil: 310_000,
    infrastructure: 130_000,
  },

  /**
   * Political capital on inauguration day.
   *
   * An inauguration is a moment of maximum goodwill, and a government that
   * could do nothing at all for its first month would be both unplayable and
   * wrong. Set so the founding administration can pass one substantial budget
   * immediately and then has to earn the next — roughly a third of the base
   * cap.
   *
   * Not the full cap: the founding choice should not be free, and a player who
   * begins at the ceiling never sees the accrual mechanic at all.
   */
  politicalCapital: 32,
} as const;

/** Stat ranges used when clamping resolved values. */
export const RANGES = {
  percent: { min: 0, max: 100 },
  sentiment: { min: -100, max: 100 },
} as const;


// ============================================================================
// DIPLOMACY (brief §7, ECONOMY.md §7.23)
// ============================================================================

/** Relations run from implacable hostility to alliance in all but name. */
export const RELATION_RANGE = { min: -100, max: 100 } as const;

/**
 * What a diplomatic mission costs, and what it buys.
 *
 * Deliberately a poor exchange rate. Diplomacy in this period was slow: a
 * minister took months to arrive and years to accomplish anything, and a single
 * mission that transformed a relationship would make every treaty prerequisite
 * meaningless — the player would buy their way to any threshold in one action.
 * The cost is real political capital, so an envoy competes with legislation for
 * the same reserve, which is the trade-off that makes the choice interesting.
 */
export const ENVOY_CAPITAL_COST = 14;
export const ENVOY_RELATION_GAIN = 6;

/**
 * How much of the gap back to a power’s BASELINE closes each month.
 *
 * Toward the baseline, not toward zero. The reasons Britain was cool and France
 * warm in 1789 did not go away because a minister had a good year, and a
 * government that stops working at a relationship loses what it bought. Two per
 * cent a month is a half-life of about three years — slow enough that a treaty
 * concluded on the strength of a good relation is not immediately at risk.
 */
export const DIPLOMATIC_DECAY_PER_MONTH = 0.02;

/**
 * What breaking a treaty costs.
 *
 * The relation cost is the larger of the two, but the LEGITIMACY cost is the
 * interesting one: a government that does not keep its word is worth less at
 * home as well as abroad. Repudiation is available, and it is not free.
 */
export const TREATY_BREACH_RELATION_COST = 55;
export const TREATY_BREACH_LEGITIMACY_COST = 9;

// ============================================================================
// WAR (brief §7, ECONOMY.md §7.24)
// ============================================================================

/**
 * The threshold gate the brief asks for.
 *
 * A casus belli at or above this is a defensible case: the declaration costs
 * almost nothing in legitimacy and a republic can usually carry it. Below it,
 * the cost rises in proportion to how far short it falls — which is what makes
 * "aggression without justification" a spectrum rather than a switch.
 *
 * 60 is set so that the real grievances of the decade sit either side of it in
 * roughly the order contemporaries ranked them: the Algerine captures (80) and
 * the French spoliations (74) above, impressment (70) above, the retained posts
 * (62) just above, the Mississippi (58) and the Ohio boundary (55) just below —
 * and a manufactured claim (18) nowhere near.
 */
export const UNJUSTIFIED_WAR_THRESHOLD = 60;

/** Political capital to put a declaration, on either path. */
export const WAR_DECLARATION_CAPITAL = 90;

/**
 * Legitimacy lost at a completely unjustified declaration, scaled down toward
 * zero as the case approaches the threshold.
 *
 * 22 is deliberately larger than any single decree in the game costs. Going to
 * war without a case should be the most expensive thing a government can do
 * short of losing one.
 */
export const WAR_LEGITIMACY_PER_MISSING_JUSTIFICATION = 22;

/** Capital to prepare a pretext, spent whether or not it is ever used. */
export const FABRICATION_CAPITAL_COST = 45;

/** On top of the shortfall, for a claim that was manufactured outright. */
export const FABRICATED_WAR_LEGITIMACY_COST = 15;

/**
 * What every OTHER power thinks of a country that fabricates a pretext.
 *
 * "Invites foreign hostility" (brief §7). A government that invents its reasons
 * once is a government nobody can safely sign anything with, so the penalty
 * falls on every relation rather than on the victim alone.
 */
export const FABRICATED_WAR_RELATION_COST = 25;

/** Trade capacity lost while a war is on. Blockade, embargo and risk. */
export const WAR_TRADE_SUPPRESSION = 0.28;

/**
 * Weariness per month at a perfectly justified war, doubled at a wholly
 * unjustified one. About three years to exhaust a country that believed in it,
 * eighteen months for one that did not.
 */
export const WAR_WEARINESS_PER_MONTH = 2.8;

/** Capital to bring a war to an end. Peace is also a negotiation. */
export const PEACE_CAPITAL_COST = 40;
