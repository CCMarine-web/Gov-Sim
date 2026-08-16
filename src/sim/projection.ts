/**
 * POLICY PROJECTION
 *
 * "What would happen if I enacted this?" — answered by running the REAL ENGINE
 * forward on a cloned state.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY NOT A SIMPLER FORMULA
 *
 * It is tempting to write a quick revenue estimate for the Treasury screen:
 * `tradeVolume x tariffRate`, done. That would be wrong, and wrong in a way
 * that gets worse over time. Two different calculations of the same quantity
 * inevitably drift apart, and then one of them is lying to the player — most
 * likely the one on the screen they are using to make decisions.
 *
 * So the projection clones the state, applies the proposed policy, and runs
 * `advanceDay` exactly as the game does. Whatever the model says will happen is
 * what the screen shows, because it is the same model.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * EVENTS ARE SUPPRESSED DURING PROJECTION
 * The projection runs against an EMPTY content pack. Two reasons: a projection
 * that fired a decision event would block on a pending decision and never
 * finish, and more importantly the player is asking "what does this policy
 * do", not "what will happen to me over the next year". Folding unrelated
 * scripted history into a tax projection would make the number unreadable.
 */

import { advanceDay } from './advanceDay';
import { enactPolicy, type ProposedPolicy } from './policy';
import type {
  ContentPack,
  GameState,
  OutlayBreakdown,
  ReceiptBreakdown,
} from './types';

export type { ProposedPolicy };
export { policyDiffers } from './policy';

/** Content pack used for projections: the engine, with history switched off. */
const NO_EVENTS: ContentPack = { version: 'projection', events: [], laws: [] };

/** Default horizon. Long enough for lagged compliance and sentiment to register. */
export const PROJECTION_DAYS = 365;

export interface PolicyProjection {
  receipts: ReceiptBreakdown;
  outlays: OutlayBreakdown;
  totalReceipts: number;
  totalOutlays: number;
  /** Annualised receipts minus outlays at the end of the horizon. */
  annualBalance: number;
  /** Treasury cash at the end of the horizon. */
  treasuryBalance: number;
  debtPrincipal: number;
  creditRating: number;
  /** Regional sentiment at the end of the horizon, by region id. */
  regionSentiment: Record<string, number>;
  regionCompliance: Record<string, number>;
  daysSimulated: number;
}

function sumReceipts(r: ReceiptBreakdown): number {
  return r.customs + r.excise + r.land + r.other;
}

function sumOutlays(o: OutlayBreakdown): number {
  return o.debtService + o.military + o.civil + o.infrastructure;
}

/** Read a projection off a state without simulating. Used for the current policy. */
export function readProjection(state: GameState): PolicyProjection {
  const receipts = state.treasury.annualisedReceipts;
  const outlays = state.treasury.annualisedOutlays;

  return {
    receipts,
    outlays,
    totalReceipts: sumReceipts(receipts),
    totalOutlays: sumOutlays(outlays),
    annualBalance: sumReceipts(receipts) - sumOutlays(outlays),
    treasuryBalance: state.treasury.balance,
    debtPrincipal: state.treasury.debtPrincipal,
    creditRating: state.treasury.creditRating,
    regionSentiment: Object.fromEntries(
      state.regions.map((r) => [r.id, r.sentiment]),
    ),
    regionCompliance: Object.fromEntries(
      state.regions.map((r) => [r.id, r.compliance]),
    ),
    daysSimulated: 0,
  };
}

/**
 * Run the engine forward under a proposed policy and report where it lands.
 *
 * The clone goes through JSON, which is safe precisely because `GameState` is
 * required to round-trip losslessly (DESIGN.md Rule 3). If that rule were ever
 * broken, this function would break with it — which is a useful early warning
 * rather than a hazard.
 */
export function projectPolicy(
  state: GameState,
  proposed: ProposedPolicy,
  days: number = PROJECTION_DAYS,
): PolicyProjection {
  const clone: GameState = JSON.parse(JSON.stringify(state));

  // Clear anything that would halt the run. A projection must always finish.
  clone.eventState = {
    ...clone.eventState,
    pendingDecisions: [],
    scheduledEvents: [],
  };
  clone.paused = false;

  // Enact through the SAME function the Enact button uses, rather than setting
  // the rates directly. Enacting charges a legitimacy cost, and legitimacy
  // feeds compliance, which feeds revenue. Setting the rates by hand here
  // produced a projection about 0.02% optimistic — small, but it was drift
  // between two code paths, which is exactly what this module exists to
  // prevent. One path means they cannot disagree.
  let current = enactPolicy(clone, proposed).state;

  for (let i = 0; i < days; i++) {
    current = advanceDay(current, NO_EVENTS).state;
  }

  const projection = readProjection(current);
  return { ...projection, daysSimulated: days };
}

/**
 * Project both the current policy and a proposed one over the same horizon, so
 * the two figures on screen are comparable.
 *
 * Comparing a forward-simulated proposal against today's un-simulated actuals
 * would attribute a year of ordinary drift to the player's slider, which is
 * exactly the kind of quietly misleading number this module exists to avoid.
 */
export function comparePolicies(
  state: GameState,
  proposed: ProposedPolicy,
  days: number = PROJECTION_DAYS,
): { current: PolicyProjection; proposed: PolicyProjection } {
  return {
    current: projectPolicy(
      state,
      { taxRates: state.policies.taxRates, spending: state.policies.spending },
      days,
    ),
    proposed: projectPolicy(state, proposed, days),
  };
}

