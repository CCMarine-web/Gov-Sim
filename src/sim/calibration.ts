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
} as const;

/** Stat ranges used when clamping resolved values. */
export const RANGES = {
  percent: { min: 0, max: 100 },
  sentiment: { min: -100, max: 100 },
} as const;
