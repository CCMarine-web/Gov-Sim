/**
 * POLITICAL CAPITAL
 *
 * The government's capacity to act. Implements ECONOMY.md §7.17.
 *
 * Every function below is preceded by the causal claim it encodes, in the same
 * wording used in ECONOMY.md. The claim is the thing to argue with; the algebra
 * is only its encoding.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A SECOND CURRENCY, WHEN LEGITIMACY ALREADY EXISTS
 *
 * They answer different questions.
 *
 *   LEGITIMACY          Does the country accept your right to govern?
 *   POLITICAL CAPITAL   Can you actually get this particular thing done?
 *
 * A government can be widely thought legitimate and still unable to move —
 * Washington's second term is largely a study in exactly that. It can also
 * spend its standing acting decisively, which is what the legitimacy cost of a
 * tax rise already models (D-001). Collapsing the two would lose the
 * distinction between being respected and being effective.
 *
 * The relationship runs one way: legitimacy FEEDS capital accrual, and spending
 * capital does not spend legitimacy. Acting unpopularly costs both, but through
 * two separate mechanisms with two separate reasons.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  ADMIN_TO_CAPITAL,
  BASE_CAPITAL_ACCRUAL,
  BASE_CAPITAL_CAP,
  CAPITAL_CAP_FROM_LEGITIMACY,
  ELITE_SUPPORT_TO_CAPITAL,
  LEGITIMACY_TO_CAPITAL,
  MAX_CAPITAL_ACCRUAL,
  MONARCHY_CAPITAL_CAP_FACTOR,
  POPULAR_SUPPORT_TO_CAPITAL,
  STABILITY_TO_CAPITAL,
} from '../calibration';
import type { GovernmentType } from '../types';

/**
 * CAUSAL CLAIM
 * A government cannot execute what it has no one to execute. In April 1789
 * there was a President, a Congress and essentially no administration: the
 * Department of State was created on 27 July 1789, War on 7 August, and the
 * Treasury not until 2 September. A player beginning on inauguration day holds
 * an office in a government that does not yet exist, and their capacity to act
 * should reflect that and then grow as the machinery is built.
 *
 * Measured as the share of the offices that exist on this day which are
 * actually filled, weighted by how many exist at all — so a government with one
 * office, filled, is not treated as fully staffed.
 */
export function administrativeCapacityTarget(params: {
  /** Offices that had been created by this day. */
  officesCreated: number;
  /** Of those, how many have someone in post. */
  officesFilled: number;
  /** Offices the content pack describes in total, created or not. */
  officesTotal: number;
  /**
   * Mean competence of the men in post, 0–100, or null when nobody is.
   *
   * PHASE 2 ITEM 13. Until this existed, capacity asked only whether an office
   * had a body in it. That is the first question and not the last: a department
   * run by a man out of his depth is not the same government as one run by
   * Hamilton, and the model now says so. (brief §5, ECONOMY.md §7.25)
   */
  competence?: number | null;
}): number {
  if (params.officesTotal <= 0) return 0;

  // Three factors now, multiplied: how much of the government exists, how much
  // of what exists is staffed, and how well. A vacancy in a department that was
  // never created is not a vacancy.
  const existence = params.officesCreated / params.officesTotal;
  const staffing =
    params.officesCreated > 0 ? params.officesFilled / params.officesCreated : 0;

  /*
    Quality runs from 0.7 at hopeless to 1.15 at superb, about 1.0 at the
    baseline. Deliberately a narrower band than the other two factors: a
    brilliant Secretary cannot conjure a department that does not exist, and an
    incompetent one still has clerks. Competence modulates the machine; it is
    not the machine.
  */
  const quality =
    params.competence === null || params.competence === undefined
      ? 1
      : 0.7 + (params.competence / 100) * 0.45;

  return Math.min(100, Math.max(0, existence * staffing * quality * 100));
}

/**
 * CAUSAL CLAIM — DAILY ACCRUAL
 * The ability to get things done is drawn from four places: the belief that you
 * have the right to govern, the support of whoever it is that keeps you in
 * office, the absence of a crisis consuming your attention, and having an
 * administration capable of carrying out an instruction.
 *
 * WHERE THE TWO PATHS DIVERGE. A republic draws its capital from broad popular
 * support: it governs by persuading a country. A monarchy draws its from the
 * satisfaction of the propertied and commercial interest — the people whose
 * acquiescence a crown actually requires — which is a narrower base, so it
 * responds to a smaller number of people and is less affected by general
 * discontent. That asymmetry is the point: the republic is harder to keep
 * supplied and harder to lose control of; the crown is easier to supply and
 * fails faster when the elite turns.
 *
 * (Brief §3 specifies seat share for the republic and noble satisfaction for
 * the monarchy. Congress arrives in queue item 7; until then the republican
 * term is mean regional sentiment, which is what a seat share would be a
 * consequence of. Recorded in ECONOMY.md §7.17.)
 */
export function capitalAccrualTarget(params: {
  governmentType: GovernmentType;
  legitimacy: number;
  stability: number;
  /** Mean regional sentiment, −100…+100. The republic's base. */
  popularSupport: number;
  /** Prosperity-weighted regional sentiment. The crown's base. */
  eliteSupport: number;
  administrativeCapacity: number;
}): number {
  const support =
    params.governmentType === 'republic'
      ? params.popularSupport * POPULAR_SUPPORT_TO_CAPITAL
      : params.eliteSupport * ELITE_SUPPORT_TO_CAPITAL;

  const raw =
    BASE_CAPITAL_ACCRUAL +
    (params.legitimacy - 50) * LEGITIMACY_TO_CAPITAL +
    support +
    (params.stability - 50) * STABILITY_TO_CAPITAL +
    params.administrativeCapacity * ADMIN_TO_CAPITAL;

  // Floored at zero rather than allowed to go negative. A government in total
  // collapse gains nothing; it does not owe capital. Negative accrual would
  // also make the cap meaningless and produce a currency that can trap a player
  // permanently, which is the wrong shape for a game with no game-over
  // (DESIGN.md §10).
  return Math.min(MAX_CAPITAL_ACCRUAL, Math.max(0, raw));
}

/**
 * CAUSAL CLAIM — THE CAP
 * Political capital is a standing, not a bank balance: the goodwill and
 * attention available to a government at one moment. It cannot be saved
 * indefinitely and spent all at once, because the willingness of others to go
 * along with you does not accumulate that way. So it caps, and a government
 * sitting at its cap is wasting the capacity it is generating.
 *
 * A crown's cap is lower than a republic's. This is the counterweight to the
 * monarchy's cheaper action (DESIGN.md §9.2): the crown can act more freely at
 * any moment but cannot husband its capacity for a large reform the way a
 * republic can. Speed against reach.
 */
export function capitalCapTarget(params: {
  governmentType: GovernmentType;
  legitimacy: number;
}): number {
  const raw =
    BASE_CAPITAL_CAP + (params.legitimacy - 50) * CAPITAL_CAP_FROM_LEGITIMACY;

  const factor =
    params.governmentType === 'monarchy' ? MONARCHY_CAPITAL_CAP_FACTOR : 1;

  return Math.max(1, raw * factor);
}

/**
 * Prosperity-weighted mean sentiment: the crown's support base.
 *
 * Weighting by prosperity rather than by population is the whole content of
 * "elite". A monarchy hears from the regions with money in them, and can
 * survive a great deal of discontent among people who have none — which is both
 * the source of its stability and the reason it falls over suddenly.
 */
export function eliteSupport(
  regions: Array<{ sentiment: number; prosperity: number }>,
): number {
  let weighted = 0;
  let weight = 0;

  for (const region of regions) {
    const w = Math.max(0, region.prosperity);
    weighted += region.sentiment * w;
    weight += w;
  }

  return weight > 0 ? weighted / weight : 0;
}

/**
 * Add a day's accrual to the stock, respecting the cap.
 *
 * Returns the wasted amount as well as the new total, because "hoarding is not
 * a strategy" is a design claim and the wasted figure is the evidence for or
 * against it. Silently discarding the overflow would make the claim unfalsifiable.
 */
export function accrueCapital(params: {
  current: number;
  accrualPerDay: number;
  cap: number;
}): { current: number; accrued: number; wasted: number } {
  const room = Math.max(0, params.cap - params.current);
  const accrued = Math.max(0, params.accrualPerDay);
  const applied = Math.min(room, accrued);

  return {
    current: params.current + applied,
    accrued: applied,
    wasted: accrued - applied,
  };
}
