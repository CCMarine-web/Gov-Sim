/**
 * ENACTING POLICY
 *
 * Applies a proposed tax and spending policy to the state.
 *
 * Two things happen, and both matter:
 *
 *   1. The rates change. Their economic effect flows through the model
 *      (ECONOMY.md §7.5-7.9), not through the ledger — a tariff is an input to
 *      the trade formula, not a modifier on a stat.
 *
 *   2. The POLITICAL cost is charged through the ledger, as a `policy`
 *      modifier on legitimacy. Raising taxes spends political capital, and the
 *      player should be able to hover Legitimacy and see exactly which of their
 *      own decisions is weighing on it.
 *
 * The cost is asymmetric by government type. A republic must carry the country
 * with it; a crown may simply act. This is the mechanical expression of
 * DESIGN.md §9.2's "cost of unilateral action" row, which had no implementation
 * before now.
 *
 * Cutting taxes is free. It buys no legitimacy either — a government does not
 * earn lasting consent by charging less for the same thing, and if it did the
 * optimal play would be to oscillate rates to farm it.
 */

import {
  MONARCHY_ACTION_COST,
  POLICY_COST_DURATION_DAYS,
  POLICY_LEGITIMACY_COST,
  REPUBLIC_ACTION_COST,
} from './calibration';
import { formatLongDate } from './calendar';
import { upsertModifier } from './modifiers';
import type {
  GameState,
  SpendingAllocation,
  TaxRates,
  TickEffect,
} from './types';

/**
 * A proposed tax and spending policy, before it is enacted.
 *
 * Defined here rather than in projection.ts so the dependency runs one way:
 * projection uses policy, never the reverse.
 */
export interface ProposedPolicy {
  taxRates: TaxRates;
  spending: SpendingAllocation;
}

/** Has anything actually changed? Drives the Enact button's disabled state. */
export function policyDiffers(state: GameState, proposed: ProposedPolicy): boolean {
  const a = state.policies;
  return (
    a.taxRates.tariffAvg !== proposed.taxRates.tariffAvg ||
    a.taxRates.excise !== proposed.taxRates.excise ||
    a.taxRates.landTax !== proposed.taxRates.landTax ||
    a.spending.military !== proposed.spending.military ||
    a.spending.civil !== proposed.spending.civil ||
    a.spending.infrastructure !== proposed.spending.infrastructure
  );
}

/**
 * Aggregate size of a tax INCREASE, ignoring cuts.
 *
 * Rates are summed unweighted. A more elaborate weighting by revenue share
 * would be defensible, but the simpler form is easier for a player to predict,
 * and predictability is worth more here than precision.
 */
export function taxIncrease(state: GameState, proposed: ProposedPolicy): number {
  const before = state.policies.taxRates;
  const after = proposed.taxRates;
  return (
    Math.max(0, after.tariffAvg - before.tariffAvg) +
    Math.max(0, after.excise - before.excise) +
    Math.max(0, after.landTax - before.landTax)
  );
}

/** The legitimacy a proposed policy would cost, for preview before enacting. */
export function policyLegitimacyCost(
  state: GameState,
  proposed: ProposedPolicy,
): number {
  const increase = taxIncrease(state, proposed);
  if (increase <= 0) return 0;

  const factor =
    state.governmentType === 'monarchy'
      ? MONARCHY_ACTION_COST
      : REPUBLIC_ACTION_COST;

  return increase * POLICY_LEGITIMACY_COST * factor;
}

function describeChange(state: GameState, proposed: ProposedPolicy): string {
  const before = state.policies.taxRates;
  const after = proposed.taxRates;
  const parts: string[] = [];

  const rate = (label: string, from: number, to: number) => {
    if (from === to) return;
    const verb = to > from ? 'raised' : 'lowered';
    parts.push(`${label} ${verb} from ${(from * 100).toFixed(1)}% to ${(to * 100).toFixed(1)}%`);
  };

  rate('Tariff', before.tariffAvg, after.tariffAvg);
  rate('Excise', before.excise, after.excise);
  rate('Land tax', before.landTax, after.landTax);

  const spendBefore = state.policies.spending;
  const spendAfter = proposed.spending;
  const spend = (label: string, from: number, to: number) => {
    if (from === to) return;
    parts.push(`${label} spending set to $${Math.round(to).toLocaleString('en-US')}`);
  };
  spend('Military', spendBefore.military, spendAfter.military);
  spend('Civil', spendBefore.civil, spendAfter.civil);
  spend('Infrastructure', spendBefore.infrastructure, spendAfter.infrastructure);

  return parts.length > 0 ? parts.join('. ') + '.' : 'No changes.';
}

export function enactPolicy(
  state: GameState,
  proposed: ProposedPolicy,
): { state: GameState; effects: TickEffect[] } {
  const effects: TickEffect[] = [];
  const cost = policyLegitimacyCost(state, proposed);

  let activeModifiers = state.activeModifiers;

  if (cost > 0) {
    // A stable id keyed to the day, so a later change on a different day adds a
    // separate visible line rather than silently replacing the earlier cost.
    const id = `policy:budget_${state.day}:nation.legitimacy`;
    activeModifiers = upsertModifier(activeModifiers, {
      id,
      source: `Tax rise of ${formatLongDate(state.day)}`,
      sourceType: 'policy',
      target: 'nation.legitimacy',
      value: -cost,
      isPercentage: false,
      startDay: state.day,
      endDay: state.day + POLICY_COST_DURATION_DAYS,
    });

    effects.push({
      kind: 'modifierApplied',
      day: state.day,
      description: `Raising taxes cost ${cost.toFixed(1)} legitimacy`,
      refs: [id],
    });
  }

  const next: GameState = {
    ...state,
    policies: {
      ...state.policies,
      taxRates: { ...proposed.taxRates },
      spending: { ...proposed.spending },
    },
    activeModifiers,
    log: [
      ...state.log,
      {
        id: `${state.day}:budget:${state.log.length}`,
        day: state.day,
        tier: 'enactment',
        category: 'treasury',
        title: 'The budget is altered',
        body: describeChange(state, proposed),
        relatedEventId: null,
      },
    ],
  };

  return { state: next, effects };
}
