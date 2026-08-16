/**
 * ENACTING POLICY
 *
 * Applies a proposed budget — rates for the taxes that exist, amounts for the
 * programmes that exist — to the state.
 *
 * Two things happen, and both matter:
 *
 *   1. The rates and amounts change. Their economic effect flows through the
 *      model (ECONOMY.md §7.5-7.9), not through the ledger — a tariff is an
 *      input to the trade formula, not a modifier on a stat.
 *
 *   2. The POLITICAL cost is charged through the ledger, as a `policy`
 *      modifier on legitimacy. Raising taxes spends political capital, and the
 *      player should be able to hover Legitimacy and see exactly which of their
 *      own decisions is weighing on it.
 *
 * The cost is asymmetric by government type. A republic must carry the country
 * with it; a crown may simply act. This is the mechanical expression of
 * DESIGN.md §9.2's "cost of unilateral action" row.
 *
 * Cutting taxes is free. It buys no legitimacy either — a government does not
 * earn lasting consent by charging less for the same thing, and if it did the
 * optimal play would be to oscillate rates to farm it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED IN PHASE 2
 *
 * A proposal used to be three named rates and three named amounts. It is now
 * maps keyed by tax and programme id, because the set of taxes is no longer
 * fixed: a bill can create one (brief §4.3). Everything below is therefore
 * written to iterate over whatever exists rather than over three fields, which
 * is why `taxIncrease` sums across ids instead of naming them.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  MONARCHY_ACTION_COST,
  POLICY_COST_DURATION_DAYS,
  POLICY_LEGITIMACY_COST,
  REPUBLIC_ACTION_COST,
} from './calibration';
import { formatLongDate } from './calendar';
import { upsertModifier } from './modifiers';
import {
  programsInForce,
  setProgramAmount,
  setTaxRate,
  taxesInForce,
} from './taxes';
import type { GameState, TickEffect } from './types';

/**
 * A proposed budget, before it is enacted.
 *
 * Keyed by id, so a proposal covers exactly the taxes and programmes that exist
 * when it is made. An id absent from the map means "leave that one alone",
 * which is what lets a bill's own screen propose a change to one tax without
 * restating the whole budget.
 *
 * Defined here rather than in projection.ts so the dependency runs one way:
 * projection uses policy, never the reverse.
 */
export interface ProposedPolicy {
  /** taxId -> proposed rate, 0–1. */
  rates: Record<string, number>;
  /** programId -> proposed annual amount in dollars. */
  amounts: Record<string, number>;
}

/** The current settings as a proposal, which is what a draft starts from. */
export function currentPolicy(state: GameState): ProposedPolicy {
  const rates: Record<string, number> = {};
  const amounts: Record<string, number> = {};

  for (const tax of taxesInForce(state.policies, state.day)) {
    rates[tax.id] = tax.rate;
  }
  for (const program of programsInForce(state.policies, state.day)) {
    amounts[program.id] = program.annualAmount;
  }

  return { rates, amounts };
}

/** Has anything actually changed? Drives the Enact button's disabled state. */
export function policyDiffers(state: GameState, proposed: ProposedPolicy): boolean {
  for (const tax of taxesInForce(state.policies, state.day)) {
    const rate = proposed.rates[tax.id];
    if (rate !== undefined && rate !== tax.rate) return true;
  }
  for (const program of programsInForce(state.policies, state.day)) {
    const amount = proposed.amounts[program.id];
    if (amount !== undefined && amount !== program.annualAmount) return true;
  }
  return false;
}

/**
 * Aggregate size of a tax INCREASE, ignoring cuts.
 *
 * Rates are summed unweighted across every tax in force. A more elaborate
 * weighting by revenue share would be defensible, but the simpler form is easier
 * for a player to predict, and predictability is worth more here than precision.
 */
export function taxIncrease(state: GameState, proposed: ProposedPolicy): number {
  let increase = 0;
  for (const tax of taxesInForce(state.policies, state.day)) {
    const rate = proposed.rates[tax.id];
    if (rate === undefined) continue;
    increase += Math.max(0, rate - tax.rate);
  }
  return increase;
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

/**
 * A plain-English account of the change, for the chronicle.
 *
 * Names each tax and programme, because with a dynamic set of taxes "the excise
 * was raised" is no longer unambiguous — there may be several.
 */
function describeChange(state: GameState, proposed: ProposedPolicy): string {
  const parts: string[] = [];

  for (const tax of taxesInForce(state.policies, state.day)) {
    const to = proposed.rates[tax.id];
    if (to === undefined || to === tax.rate) continue;
    const verb = to > tax.rate ? 'raised' : 'lowered';
    parts.push(
      `${tax.name} ${verb} from ${(tax.rate * 100).toFixed(1)}% to ${(to * 100).toFixed(1)}%`,
    );
  }

  for (const program of programsInForce(state.policies, state.day)) {
    const to = proposed.amounts[program.id];
    if (to === undefined || to === program.annualAmount) continue;
    parts.push(`${program.name} set to $${Math.round(to).toLocaleString('en-US')}`);
  }

  return parts.length > 0 ? parts.join('. ') + '.' : 'No changes.';
}

export function enactPolicy(
  state: GameState,
  proposed: ProposedPolicy,
): { state: GameState; effects: TickEffect[] } {
  const effects: TickEffect[] = [];
  const cost = policyLegitimacyCost(state, proposed);
  const description = describeChange(state, proposed);

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

  // Apply the proposal to whatever exists. An id in the proposal that names no
  // live tax or programme is ignored rather than creating one: creating a tax is
  // `enactTax`, a deliberately separate act.
  let policies = state.policies;
  for (const [taxId, rate] of Object.entries(proposed.rates)) {
    policies = setTaxRate(policies, taxId, rate);
  }
  for (const [programId, amount] of Object.entries(proposed.amounts)) {
    policies = setProgramAmount(policies, programId, amount);
  }

  const next: GameState = {
    ...state,
    policies,
    activeModifiers,
    log: [
      ...state.log,
      {
        id: `${state.day}:budget:${state.log.length}`,
        day: state.day,
        tier: 'enactment',
        category: 'treasury',
        title: 'The budget is altered',
        body: description,
        relatedEventId: null,
      },
    ],
  };

  return { state: next, effects };
}
