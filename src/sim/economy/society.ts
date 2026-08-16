/**
 * SOCIETY
 *
 * Population, prosperity, sentiment, sectional tension, stability, and
 * legitimacy. Implements ECONOMY.md sections 7.2 and 7.11 to 7.15.
 *
 * Almost everything here moves through a LAG rather than jumping to its
 * target. That is the difference between a simulation and a spreadsheet:
 * receipts respond within the month because collection is mechanical, but
 * prosperity takes a year and sentiment six months, because those depend on
 * people changing their circumstances and their minds.
 */

import {
  BASE_GROWTH,
  INFRA_TO_PROSPERITY,
  LEGITIMACY_TO_STABILITY,
  MONARCHY_GAIN_FACTOR,
  MONARCHY_PENALTY_FACTOR,
  PROSPERITY_GROWTH_DIVISOR,
  PROSPERITY_SPREAD_TO_TENSION,
  PROSPERITY_TO_LEGITIMACY,
  PROSPERITY_TO_SENTIMENT,
  REPUBLIC_DECAY_PER_MONTH,
  SENTIMENT_TO_STABILITY,
  SPREAD_TO_TENSION,
  STABILITY_GROWTH_DIVISOR,
  TAU_MONTHS,
  TAX_TO_PROSPERITY,
  TAX_TO_SENTIMENT,
  TENSION_TO_STABILITY,
  TREND_TO_SENTIMENT,
  lagAlpha,
} from '../calibration';
import type { GovernmentType } from '../types';

/**
 * CAUSAL CLAIM
 * Economies and populations do not respond to policy instantly. A tax change
 * moves revenue within weeks because collection is mechanical, but moves
 * prosperity and public sentiment over many months because those depend on
 * people changing their behaviour, their circumstances, and their minds.
 *
 * Standard first-order lag toward a target, applied once per month.
 */
export function lagToward(
  current: number,
  target: number,
  tauMonths: number,
): number {
  return current + (target - current) * lagAlpha(tauMonths);
}

/**
 * CAUSAL CLAIM
 * Population grows at a high natural rate in an agrarian society with abundant
 * land, modulated by prosperity (which affects both fertility and mortality)
 * and stability (crises kill and displace people).
 *
 * The base rate is not a design guess: it falls directly out of the two
 * verified census figures, 1790 and 1800.
 */
export function annualGrowthRate(prosperity: number, stability: number): number {
  const prosperityFactor = 1 + (prosperity - 50) / PROSPERITY_GROWTH_DIVISOR;
  const stabilityFactor = 1 + (stability - 50) / STABILITY_GROWTH_DIVISOR;
  return BASE_GROWTH * prosperityFactor * stabilityFactor;
}

/** Convert an annual growth rate to the equivalent monthly rate. */
export function monthlyGrowth(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/**
 * CAUSAL CLAIM
 * A region's prosperity is its output per head relative to where it started,
 * dragged down by the share of that output taken in tax and lifted by
 * infrastructure. It moves slowly, taking about a year to substantially
 * register a change, because prosperity is lived conditions rather than a
 * policy setting.
 */
export function prosperityTarget(params: {
  baseProsperity: number;
  outputPerCapita: number;
  baselineOutputPerCapita: number;
  taxBurden: number;
  baselineTaxBurden: number;
  infrastructureBonus: number;
}): number {
  const relative =
    params.baselineOutputPerCapita > 0
      ? params.outputPerCapita / params.baselineOutputPerCapita
      : 1;

  // The tax term is a DELTA from the founding burden, not the absolute burden.
  // The seeded prosperity already reflects the tariff that existed in 1789, so
  // charging that same tariff against it a second time would make the founding
  // a state the model immediately flees.
  const taxDelta = params.taxBurden - params.baselineTaxBurden;

  const raw =
    params.baseProsperity * relative -
    taxDelta * TAX_TO_PROSPERITY +
    params.infrastructureBonus * INFRA_TO_PROSPERITY;

  return Math.min(100, Math.max(0, raw));
}

/**
 * CAUSAL CLAIM
 * How a region feels about the federal government depends on what that
 * government costs it, what it delivers, and whether things are getting better
 * or worse. Crucially the cost is weighted by the region's OWN tax exposure:
 * the same tariff that enriches a New England manufacturer impoverishes a
 * Southern planter. One national policy, four different reactions. This is the
 * mechanism from which sectional conflict emerges rather than being scripted.
 *
 * The trend term matters independently of the level. A region getting poorer
 * from a high base is angrier than a region getting richer from a low base,
 * which is why booms buy goodwill and why a downturn is politically expensive
 * even when absolute conditions remain decent.
 */
export function sentimentTarget(params: {
  baseSentiment: number;
  taxBurden: number;
  baselineTaxBurden: number;
  prosperity: number;
  baseProsperity: number;
  prosperityTrend: number;
  governmentAffinity: number;
}): number {
  // As with prosperity, the tax term is a delta from the founding burden.
  const taxDelta = params.taxBurden - params.baselineTaxBurden;

  const raw =
    params.baseSentiment -
    taxDelta * TAX_TO_SENTIMENT +
    (params.prosperity - params.baseProsperity) * PROSPERITY_TO_SENTIMENT +
    params.prosperityTrend * TREND_TO_SENTIMENT +
    params.governmentAffinity;

  return Math.min(100, Math.max(-100, raw));
}

/**
 * CAUSAL CLAIM
 * Sectional tension is not about any region being unhappy. It is about regions
 * being unhappy DIFFERENTLY. A nation where every region is equally aggrieved
 * has a legitimacy problem; a nation where regions pull in opposite directions
 * has a union problem. Divergence, not dissatisfaction, is what breaks
 * countries apart.
 */
export function tensionTarget(params: {
  sentiments: number[];
  prosperities: number[];
  slaveryTension: number;
}): number {
  if (params.sentiments.length === 0) return 0;

  const sentimentSpread =
    Math.max(...params.sentiments) - Math.min(...params.sentiments);
  const prosperitySpread =
    Math.max(...params.prosperities) - Math.min(...params.prosperities);

  const raw =
    sentimentSpread * SPREAD_TO_TENSION +
    prosperitySpread * PROSPERITY_SPREAD_TO_TENSION +
    params.slaveryTension;

  return Math.min(100, Math.max(0, raw));
}

/**
 * CAUSAL CLAIM
 * Stability is the government's practical capacity to govern: whether laws are
 * obeyed, order is kept, and business proceeds. It reflects how people feel on
 * average, degraded by internal division and by illegitimacy.
 *
 * Stability feeds back into output and population growth, so a collapse is
 * genuinely economically destructive rather than a number going down.
 */
export function stabilityTarget(params: {
  meanSentiment: number;
  sectionalTension: number;
  legitimacy: number;
}): number {
  const raw =
    50 +
    params.meanSentiment * SENTIMENT_TO_STABILITY -
    params.sectionalTension * TENSION_TO_STABILITY +
    (params.legitimacy - 50) * LEGITIMACY_TO_STABILITY;

  return Math.min(100, Math.max(0, raw));
}

/**
 * CAUSAL CLAIM - THE FOUNDING CHOICE, MECHANISED
 * Legitimacy is the belief that the government has the right to govern, which
 * is different from whether it is currently doing a good job.
 *
 * A REPUBLIC must continually re-earn it through consent and results, so it
 * decays by default and is renewed by prosperity. A MONARCHY claims it by
 * right and does not decay, but converts success into legitimacy less
 * efficiently and suffers amplified penalties when a crisis is mishandled.
 *
 * The intent is two genuinely different failure modes rather than one being
 * strictly better: the republic is on a treadmill and must keep delivering;
 * the monarchy can coast, but has further to fall and no natural recovery
 * pulling it back up.
 */
export function monthlyLegitimacyChange(params: {
  governmentType: GovernmentType;
  prosperityGain: number;
  eventDelta: number;
}): number {
  const isMonarchy = params.governmentType === 'monarchy';

  const decay = isMonarchy ? 0 : -REPUBLIC_DECAY_PER_MONTH;

  const gain =
    params.prosperityGain *
    PROSPERITY_TO_LEGITIMACY *
    (isMonarchy ? MONARCHY_GAIN_FACTOR : 1);

  // Penalties are amplified for a monarchy; bonuses are not.
  const events =
    params.eventDelta < 0 && isMonarchy
      ? params.eventDelta * MONARCHY_PENALTY_FACTOR
      : params.eventDelta;

  return decay + gain + events;
}

/** The lag time constants, re-exported so callers need one import. */
export const TAU = TAU_MONTHS;
