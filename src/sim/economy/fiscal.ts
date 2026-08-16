/**
 * FISCAL
 *
 * Revenue, outlays, debt, and credit. Implements ECONOMY.md sections 7.7
 * to 7.10.
 *
 * The compliance mechanism in this file is the single most important feedback
 * loop in Phase 1. Raising a tax lowers regional sentiment, which lowers
 * compliance, which means revenue rises LESS than proportionally, and past a
 * threshold actually falls. The player watching only the rate slider will not
 * see it coming; the player watching the modifier breakdown will.
 */

import {
  BASE_COMPLIANCE,
  BASE_CREDIT,
  DEBT_TO_GDP_PENALTY,
  DISTILLING_BASE,
  EMERGENCY_BORROWING_PREMIUM,
  LAND_VALUE_BASE,
  LEGITIMACY_TO_COMPLIANCE,
  MAX_BORROWING_RATE,
  MIN_BORROWING_RATE,
  MISSED_PAYMENT_PENALTY,
  SENTIMENT_TO_COMPLIANCE,
  STABILITY_TO_CREDIT,
} from '../calibration';

/**
 * CAUSAL CLAIM
 * A tax is only worth what people actually pay. Frontier farmers distilled
 * grain into whiskey because whiskey was the only form in which a bulk crop
 * could profitably be carried over the mountains to market, so a whiskey
 * excise was, to them, a tax on the act of selling anything at all. When
 * resented enough it was simply not paid, and collecting it required force
 * that cost more than the tax raised.
 *
 * Compliance is therefore driven by sentiment and by legitimacy: a government
 * widely believed to have the right to govern is obeyed more readily than one
 * that is not, independent of how popular any particular tax is.
 */
export function complianceTarget(params: {
  sentiment: number;
  legitimacy: number;
}): number {
  const raw =
    BASE_COMPLIANCE +
    params.sentiment * SENTIMENT_TO_COMPLIANCE +
    (params.legitimacy - 50) * LEGITIMACY_TO_COMPLIANCE;

  return Math.min(100, Math.max(0, raw));
}

/**
 * Excise revenue from one region.
 *
 * The distilling base is concentrated overwhelmingly on the frontier, which is
 * why the excise is a regional weapon rather than a national one.
 *
 * Retained as the named formula behind the `spirits` base. `computeTaxRevenue`
 * is the general path; this is what it reduces to for the spirits excise, and
 * keeping it makes the calibration test that pins the two together meaningful.
 */
export function computeExciseRevenue(
  regionId: string,
  exciseRate: number,
  compliance: number,
): number {
  const base = DISTILLING_BASE[regionId] ?? 0;
  return base * Math.max(0, exciseRate) * (compliance / 100);
}

/**
 * CAUSAL CLAIM
 * A direct tax on land is the most visible and most resented form of
 * taxation, because it falls on people whether or not they have any cash that
 * year. It raises real money and costs real political capital EVERYWHERE at
 * once, unlike the tariff (concentrated on merchants) or the excise
 * (concentrated on the frontier). That is what makes the 1798 direct tax a
 * genuine last resort, which is what it historically was.
 */
export function computeLandRevenue(
  regionId: string,
  landTaxRate: number,
  compliance: number,
): number {
  const base = LAND_VALUE_BASE[regionId] ?? 0;
  return base * Math.max(0, landTaxRate) * (compliance / 100);
}

// ============================================================================
// REVENUE PER TAX INSTANCE (Phase 2 brief §4.3)
// ============================================================================

/** What a region contributes to the assessment of one tax. */
export interface RegionFiscalContext {
  id: string;
  compliance: number;
  /** Agricultural plus manufacturing output, for `outputShare` bases. */
  output: number;
}

/**
 * CAUSAL CLAIM
 * A tax yields its rate times what it can reach, less what cannot be collected
 * and less what is simply not paid. The three are separate losses with separate
 * causes, and the Treasury screen shows them separately, because a government
 * whose problem is administrative capacity needs a different remedy from one
 * whose problem is that a region has stopped obeying it.
 *
 * `collectionEfficiency` is a property of the tax — how reachable its base is.
 * `compliance` is a property of the region — whether it consents to pay. A tax
 * on imports at a handful of customs houses scores high on the first whatever
 * the second is doing; a tax on backcountry stills scores badly on both.
 *
 * Trade-assessed taxes have no regional compliance term: the duty is taken at
 * the wharf before the goods move inland, which is precisely why the impost was
 * the one tax the early republic could actually collect.
 */
export function computeTaxRevenue(params: {
  rate: number;
  collectionEfficiency: number;
  assessment: 'trade' | 'regional' | 'outputShare';
  /** For `trade`: the volume subject to the duty. */
  tradeVolume: number;
  /** For `regional`: assessed value per region id. */
  regionalBase: Record<string, number> | null;
  /** For `outputShare`: the share of regional output that is assessable. */
  outputShare: number | null;
  regions: RegionFiscalContext[];
}): { assessedBase: number; gross: number; lostToCollection: number; lostToNonCompliance: number; net: number } {
  const rate = Math.max(0, params.rate);
  const efficiency = Math.min(1, Math.max(0, params.collectionEfficiency));

  let assessedBase = 0;
  /** Assessed base weighted by the compliance that applies to it. */
  let complianceWeighted = 0;

  if (params.assessment === 'trade') {
    assessedBase = Math.max(0, params.tradeVolume);
    // Collected at the port, so no regional compliance term. See above.
    complianceWeighted = assessedBase;
  } else {
    for (const region of params.regions) {
      const base =
        params.assessment === 'regional'
          ? (params.regionalBase?.[region.id] ?? 0)
          : Math.max(0, region.output) * (params.outputShare ?? 0);

      assessedBase += base;
      complianceWeighted += base * (Math.min(100, Math.max(0, region.compliance)) / 100);
    }
  }

  const gross = assessedBase * rate;
  const afterCompliance = complianceWeighted * rate;
  const lostToNonCompliance = gross - afterCompliance;
  const net = afterCompliance * efficiency;
  const lostToCollection = afterCompliance - net;

  return { assessedBase, gross, lostToCollection, lostToNonCompliance, net };
}

/**
 * How heavily the current tax settings fall on a given region.
 *
 * Weighted by that region's own exposure, which is the mechanism that makes
 * one national policy produce four different political reactions. The same
 * tariff that shelters a New England manufacturer impoverishes a Southern
 * planter. (ECONOMY.md §7.12)
 *
 * Now summed over whatever taxes exist rather than over three fixed fields. The
 * arithmetic is identical for the three founding taxes — `rate × exposure`,
 * summed — so the calibration is untouched; what changes is that a fourth tax
 * can now contribute to it.
 */
export function taxBurden(params: {
  /** One entry per tax in force: its rate and the exposure channel it uses. */
  levies: Array<{ rate: number; channel: 'tariff' | 'excise' | 'land' }>;
  tariffExposure: number;
  exciseExposure: number;
  landExposure: number;
}): number {
  const exposureFor = (channel: 'tariff' | 'excise' | 'land'): number => {
    switch (channel) {
      case 'tariff':
        return params.tariffExposure;
      case 'excise':
        return params.exciseExposure;
      case 'land':
        return params.landExposure;
    }
  };

  let burden = 0;
  for (const levy of params.levies) {
    burden += levy.rate * exposureFor(levy.channel);
  }
  return burden;
}

/** Debt service is non-discretionary and is computed before anything else. */
export function computeDebtService(
  debtPrincipal: number,
  weightedRate: number,
): number {
  return debtPrincipal * weightedRate;
}

/**
 * CAUSAL CLAIM
 * A government that services its debts reliably can borrow cheaply; one that
 * defaults, or that lets its debt outrun its economy, pays a premium or cannot
 * borrow at all. This was Hamilton's central argument for assumption and
 * funding, and it should be demonstrable in play rather than merely asserted
 * on an event card.
 */
export function creditTarget(params: {
  debtPrincipal: number;
  gdp: number;
  missedPayments: number;
  stability: number;
}): number {
  const debtToGdp = params.gdp > 0 ? params.debtPrincipal / params.gdp : 0;

  const raw =
    BASE_CREDIT -
    debtToGdp * DEBT_TO_GDP_PENALTY -
    params.missedPayments * MISSED_PAYMENT_PENALTY +
    (params.stability - 50) * STABILITY_TO_CREDIT;

  return Math.min(100, Math.max(0, raw));
}

/**
 * The interest rate on NEW borrowing.
 *
 * The squared term means credit deterioration accelerates: falling from 80 to
 * 60 costs far less than falling from 40 to 20. Countries do not slide gently
 * into a debt crisis.
 */
export function borrowingRate(creditRating: number): number {
  const normalised = Math.min(100, Math.max(0, creditRating)) / 100;
  const deficiency = 1 - normalised;
  return (
    MIN_BORROWING_RATE +
    (MAX_BORROWING_RATE - MIN_BORROWING_RATE) * deficiency * deficiency
  );
}

export interface BorrowingResult {
  debtPrincipal: number;
  weightedRate: number;
  borrowed: number;
}

/**
 * Cover a shortfall by borrowing.
 *
 * Borrowing to cover a deficit costs MORE than the shortfall: the premium is
 * the price of raising money in a hurry. Chronic deficits therefore compound
 * into debt service that crowds out every other outlay, which is the
 * degraded-governance path from DESIGN.md §10 — the player keeps power and
 * loses the capacity to govern.
 *
 * The weighted rate on existing debt is updated as a weighted average, so past
 * cheap borrowing keeps benefiting the player rather than being erased.
 */
export function borrow(params: {
  shortfall: number;
  debtPrincipal: number;
  weightedRate: number;
  creditRating: number;
}): BorrowingResult {
  const issued = params.shortfall * (1 + EMERGENCY_BORROWING_PREMIUM);
  const newDebt = params.debtPrincipal + issued;
  const newRate = borrowingRate(params.creditRating);

  const weightedRate =
    newDebt > 0
      ? (params.debtPrincipal * params.weightedRate + issued * newRate) / newDebt
      : params.weightedRate;

  return { debtPrincipal: newDebt, weightedRate, borrowed: issued };
}

/**
 * Days in the year for daily accrual.
 *
 * Annual figures accrue at 1/daysInYear per day. Using the actual length of
 * the current year keeps accrual exact across leap years — and 1800 is not one
 * (see src/sim/calendar.ts).
 */
export function dailyAccrual(annualAmount: number, daysInYear: number): number {
  return annualAmount / daysInYear;
}
