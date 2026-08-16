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

/**
 * How heavily the current tax settings fall on a given region.
 *
 * Weighted by that region's own exposure, which is the mechanism that makes
 * one national policy produce four different political reactions. The same
 * tariff that shelters a New England manufacturer impoverishes a Southern
 * planter. (ECONOMY.md §7.12)
 */
export function taxBurden(params: {
  tariffRate: number;
  exciseRate: number;
  landTaxRate: number;
  tariffExposure: number;
  exciseExposure: number;
  landExposure: number;
}): number {
  return (
    params.tariffRate * params.tariffExposure +
    params.exciseRate * params.exciseExposure +
    params.landTaxRate * params.landExposure
  );
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
