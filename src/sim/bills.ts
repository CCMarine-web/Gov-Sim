/**
 * BILLS
 *
 * Passing, amending and repealing legislation. Implements Phase 2 brief §4.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT A BILL DOES WHEN IT PASSES
 *
 *   1. It costs political capital (§3) and, once, treasury.
 *   2. It writes its effects into the modifier ledger as `law` modifiers, with
 *      a phase-in ramp, so the breakdown names the statute and shows how much
 *      of it has taken hold.
 *   3. It may CREATE a tax or a spending programme, which then appears in
 *      Treasury as its own line (§4.3). This is the join between item 4 and
 *      item 3, and it is the requirement the author stated most plainly:
 *      "When I pass a new tax in Legislation, it must appear as a new line in
 *      Treasury."
 *   4. Its bloc reactions move regional sentiment, landing wherever each bloc
 *      actually lives on the day it passes (`blocWeights`, ECONOMY.md §7.21).
 *
 * Repealing reverses 1 to 3: the modifiers go (they must, or the ledger keeps
 * applying a law no longer in force), and the tax or programme it created is
 * repealed with it. What does NOT reverse is the bloc reaction: a country does
 * not un-resent a law because it was taken back.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Everything here is pure. No time, no randomness, no mutation of the input.
 */

import {
  BLOC_REACTION_TO_SENTIMENT,
  DECREE_CAPITAL_FACTOR,
  DECREE_GRIEVANCE_PER_OPPOSITION,
  FAILED_BILL_COOLDOWN_DAYS,
  LEGISLATION_GRIEVANCE_PER_OPPOSITION,
} from './calibration';
import { blocWeights, type BlocWeights } from './blocs';
import { strainLoyalty } from './cabinet';
import { isoToDay } from './calendar';
import { describeUnmet, evaluateAll } from './conditions';
import {
  NO_TACTICS,
  addObligation,
  bothChambers,
  cooldownRemaining,
  offCooldown,
  recordDefeat,
  tacticsCost,
  type BillTactics,
  type WhipCount,
} from './congress';
import { accrueGrievance, decreeLegitimacyCost } from './grievance';
import { makeModifierId, removeModifiersFromSource, upsertModifier } from './modifiers';
import { repealTax, defundProgram, upsertTax, upsertProgram } from './taxes';
import { TAX_BASES } from './taxBases';
import type {
  Bill,
  BlocReaction,
  EnactedBill,
  GameState,
  GovernmentType,
  Modifier,
  Party,
  Region,
  TickEffect,
} from './types';

// ============================================================================
// VALIDATION
//
// Structural checks on a bill, without needing a game state. Run over every
// bill by the content test, so a malformed bill fails at build time rather than
// when a player clicks Introduce.
// ============================================================================

export function validateBill(bill: Bill): string[] {
  const problems: string[] = [];
  const at = (message: string) => problems.push(`${bill.id}: ${message}`);

  if (!bill.name) at('has no name');
  if (!bill.description) at('has no description');

  // The educational spine. Every tier carries factual context — a
  // counterfactual needs it MORE than an enacted bill does, because the player
  // has to know what they are departing from. (brief §4.4)
  if (bill.historicalNote.length < 120) {
    at('historical note is too short to say anything factual');
  }
  if (bill.sources.length === 0) at('cites no sources');

  if (bill.historicity === 'anachronistic' && !bill.lockedBecause) {
    at(
      'is anachronistic but gives no reason. A lock with no explanation teaches ' +
        'the player nothing, which is the one thing a locked bill must not do.',
    );
  }
  if (bill.lockedBecause !== null && bill.lockedBecause.length < 60) {
    at('lock reason is too short to be a real explanation');
  }

  if (bill.hasSlider) {
    if (bill.sliderRange === null) at('has a slider but no range');
    else if (bill.sliderRange[1] <= bill.sliderRange[0]) {
      at('slider range is empty or inverted');
    }
    if (!bill.sliderLabel) at('has a slider but no label for it');
    if (bill.sliderUnit === null) at('has a slider but no unit');
  } else if (bill.sliderRange !== null) {
    at('has a slider range but no slider');
  }

  for (const key of ['introduce', 'repeal', 'raise', 'lower'] as const) {
    if (!Number.isFinite(bill.capitalCost[key]) || bill.capitalCost[key] < 0) {
      at(`capitalCost.${key} must be a non-negative number`);
    }
  }
  if (bill.capitalCost.introduce <= 0 && bill.historicity !== 'anachronistic') {
    at('costs nothing to introduce — no bill is free');
  }

  if (bill.treasuryCost.max < bill.treasuryCost.min) {
    at('treasuryCost.max is below its min');
  }

  if (!Number.isInteger(bill.phaseInDays) || bill.phaseInDays < 0) {
    at('phaseInDays must be a non-negative integer');
  }

  for (const reaction of bill.blocReactions) {
    if (Math.abs(reaction.strength) > 100) {
      at(`bloc reaction for ${reaction.bloc} is outside -100..100`);
    }
    if (!reaction.reason) {
      at(`bloc reaction for ${reaction.bloc} gives no reason`);
    }
  }

  const blocs = bill.blocReactions.map((r) => r.bloc);
  if (new Set(blocs).size !== blocs.length) {
    at('names the same bloc twice');
  }

  return problems;
}

// ============================================================================
// QUERIES
// ============================================================================

export function enactedRecord(state: GameState, billId: string): EnactedBill | null {
  return state.policies.bills.find((b) => b.billId === billId) ?? null;
}

/** Is this bill in force on `day`? */
export function isInForce(state: GameState, billId: string, day = state.day): boolean {
  const record = enactedRecord(state, billId);
  if (!record) return false;
  return record.enactedDay <= day && (record.repealedDay === null || record.repealedDay > day);
}

/** Every bill in force, as records. */
export function billsInForce(state: GameState): EnactedBill[] {
  return state.policies.bills.filter(
    (b) => b.enactedDay <= state.day && (b.repealedDay === null || b.repealedDay > state.day),
  );
}

export type BillStatus =
  | { kind: 'inForce'; record: EnactedBill }
  | { kind: 'repealed'; record: EnactedBill }
  | { kind: 'available' }
  | { kind: 'notYet'; from: string }
  | { kind: 'expired'; until: string }
  | { kind: 'blocked'; reasons: string[] }
  /** Voted down, and not yet reintroducible. Republic only. */
  | { kind: 'onCooldown'; days: number }
  | { kind: 'locked'; because: string };

/**
 * Where a bill stands, and why.
 *
 * Returns a reason in every negative case. A bill the player cannot pass must
 * say what would change that — a locked control with no explanation is the same
 * failure the modifier ledger exists to prevent, applied to actions. (brief §2.2)
 */
export function billStatus(state: GameState, bill: Bill): BillStatus {
  const record = enactedRecord(state, bill.id);
  if (record) {
    const inForce =
      record.enactedDay <= state.day &&
      (record.repealedDay === null || record.repealedDay > state.day);
    return inForce ? { kind: 'inForce', record } : { kind: 'repealed', record };
  }

  // An anachronistic bill is locked whatever else is true. The Constitution
  // does not become satisfiable by waiting.
  if (bill.historicity === 'anachronistic') {
    return {
      kind: 'locked',
      because: bill.lockedBecause ?? 'This is not possible in this period.',
    };
  }

  if (state.day < isoToDay(bill.availableFrom)) {
    return { kind: 'notYet', from: bill.availableFrom };
  }

  if (bill.availableUntil !== null && state.day > isoToDay(bill.availableUntil)) {
    return { kind: 'expired', until: bill.availableUntil };
  }

  if (!evaluateAll(bill.prerequisites, state)) {
    return { kind: 'blocked', reasons: describeUnmet(bill.prerequisites, state) };
  }

  /*
    A bill Congress threw out does not come straight back. Only a republic is
    affected: a crown that decreed something and saw it resisted has no vote to
    have lost. (brief §2.2)
  */
  if (
    state.governmentType === 'republic' &&
    !offCooldown(state.congress, bill.id, state.day)
  ) {
    return {
      kind: 'onCooldown',
      days: cooldownRemaining(state.congress, bill.id, state.day),
    };
  }

  return { kind: 'available' };
}

// ============================================================================
// COSTS
// ============================================================================

/** Where a slider sits within its range, 0…1. Flat bills are always 1. */
export function sliderFraction(bill: Bill, sliderValue: number | null): number {
  if (!bill.hasSlider || bill.sliderRange === null || sliderValue === null) return 1;
  const [min, max] = bill.sliderRange;
  if (max <= min) return 1;
  return Math.min(1, Math.max(0, (sliderValue - min) / (max - min)));
}

/**
 * The political capital passing this bill would cost.
 *
 * Introduction is charged in full; the slider adds its raise cost on top, in
 * proportion to how far up the range it starts. A bill introduced at the bottom
 * of its range is a smaller act than the same bill introduced at the top, and
 * should cost less.
 *
 * A CROWN PAYS A FRACTION. A decree needs no votes whipped and no coalition
 * assembled, so it costs `DECREE_CAPITAL_FACTOR` of what carrying the same
 * measure through a legislature costs. That is the monarchy's advantage made
 * concrete (brief §2.1), and its price is `decreeLegitimacyCost` and the
 * grievance below — speed against consent. (docs/DECISIONS.md D-027)
 */
export function introduceCost(
  bill: Bill,
  sliderValue: number | null,
  governmentType: GovernmentType = 'republic',
): number {
  const base =
    bill.capitalCost.introduce +
    bill.capitalCost.raise * sliderFraction(bill, sliderValue);

  return governmentType === 'monarchy' ? base * DECREE_CAPITAL_FACTOR : base;
}

/**
 * Everything passing this bill costs, on this path.
 *
 * Returned together rather than as three separate calls, because the whole
 * point of the two paths is that they trade one cost against another, and a
 * screen showing only one of them would misrepresent the choice.
 */
export interface BillPrice {
  capital: number;
  treasury: number;
  /** Legitimacy spent. Zero on the republican path — a bill is not a decree. */
  legitimacy: number;
  /** Total grievance this will create, across every bloc that loses by it. */
  grievance: number;
  /** True when this is a decree rather than a bill. */
  byDecree: boolean;
}

export function priceOf(
  bill: Bill,
  sliderValue: number | null,
  governmentType: GovernmentType,
): BillPrice {
  const byDecree = governmentType === 'monarchy';

  /*
    A crown spends LEGITIMACY where a legislature spends TIME AND VOTES. The
    republic's legitimacy cost for legislation is zero here — not because
    passing a bill is free, but because its cost is already charged in political
    capital, which is dear precisely because a coalition has to be assembled.
    Charging both would make the republic strictly worse, which the brief calls
    a defect.
  */
  const legitimacy = byDecree ? decreeLegitimacyCost(bill.blocReactions) : 0;

  const rate = byDecree
    ? DECREE_GRIEVANCE_PER_OPPOSITION
    : LEGISLATION_GRIEVANCE_PER_OPPOSITION;
  const grievance = bill.blocReactions.reduce(
    (sum, r) => sum + (r.strength < 0 ? -r.strength * rate : 0),
    0,
  );

  return {
    capital: introduceCost(bill, sliderValue, governmentType),
    treasury: treasuryCost(bill, sliderValue),
    legitimacy,
    grievance,
    byDecree,
  };
}

/** The treasury cost, interpolated across the slider range. */
export function treasuryCost(bill: Bill, sliderValue: number | null): number {
  const fraction = sliderFraction(bill, sliderValue);
  return (
    bill.treasuryCost.min +
    (bill.treasuryCost.max - bill.treasuryCost.min) * fraction
  );
}

/** The capital cost of amending a bill already in force. */
export function amendCost(
  bill: Bill,
  fromValue: number | null,
  toValue: number | null,
): number {
  if (!bill.hasSlider) return 0;
  const from = sliderFraction(bill, fromValue);
  const to = sliderFraction(bill, toValue);
  const delta = to - from;
  if (delta === 0) return 0;
  return delta > 0
    ? bill.capitalCost.raise * delta
    : bill.capitalCost.lower * -delta;
}

// ============================================================================
// APPLYING A BILL'S EFFECTS
// ============================================================================

/**
 * Turn a bill's effect templates into ledger modifiers.
 *
 * `law` modifiers, with a deterministic id derived from the bill, so passing
 * the same bill twice replaces rather than stacks (Rule 5) and repealing it can
 * find every one of them again by prefix.
 */
export function billModifiers(
  bill: Bill,
  sliderValue: number | null,
  day: number,
): Modifier[] {
  const fraction = sliderFraction(bill, sliderValue);

  return bill.effects.map((template) => ({
    id: makeModifierId('law', bill.id, template.target),
    source: bill.name,
    sourceType: 'law' as const,
    target: template.target,
    value: template.scalesWithSlider ? template.value * fraction : template.value,
    isPercentage: template.isPercentage,
    startDay: day,
    endDay: template.durationDays === null ? null : day + template.durationDays,
    rampDays: bill.phaseInDays,
  }));
}

/**
 * How a bill's bloc reactions land on the regions.
 *
 * A bloc's reaction moves a region's sentiment in proportion to how much of
 * that bloc lives there — so passing a bill the planters hate angers the South,
 * and one the seamen hate angers New England.
 *
 * The weights come from `blocWeights(state)` (ECONOMY.md §7.21) and are
 * therefore CURRENT: they are derived from where people are today, not from a
 * table written in 1790. A country whose workshops have filled for a decade
 * reacts to a tariff differently from the one that passed the first one, which
 * is the point of making membership move at all.
 */
export function blocSentimentShifts(
  reactions: readonly BlocReaction[],
  regions: readonly Region[],
  weights: BlocWeights,
): Record<string, number> {
  const shifts: Record<string, number> = {};
  for (const region of regions) shifts[region.id] = 0;

  for (const reaction of reactions) {
    const row = weights[reaction.bloc] ?? {};
    for (const region of regions) {
      const weight = row[region.id] ?? 0;
      shifts[region.id] +=
        reaction.strength * weight * BLOC_REACTION_TO_SENTIMENT;
    }
  }

  return shifts;
}

// ============================================================================
// ENACTING
// ============================================================================

export interface BillOutcome {
  state: GameState;
  effects: TickEffect[];
}

/**
 * Pass a bill.
 *
 * Throws rather than silently declining if the bill is not available or cannot
 * be afforded: the interface is expected to have checked `billStatus` and
 * `canAffordBill` and disabled the control with the reason shown. Reaching here
 * regardless means a caller skipped the gate, which is a bug worth surfacing
 * immediately rather than a state worth entering.
 */
export function enactBill(
  state: GameState,
  bill: Bill,
  sliderValue: number | null = null,
  parties: readonly Party[] = [],
  tactics: BillTactics = NO_TACTICS,
): BillOutcome {
  const status = billStatus(state, bill);
  if (status.kind !== 'available' && status.kind !== 'repealed') {
    throw new Error(
      `enactBill: "${bill.id}" is not available (${status.kind}). ` +
        'Check billStatus before calling.',
    );
  }

  const price = priceOf(bill, sliderValue, state.governmentType);
  const tacticsPrice = state.governmentType === 'republic' ? tacticsCost(tactics) : 0;
  const totalCapital = price.capital + tacticsPrice;

  if (totalCapital > state.politicalCapital.current) {
    throw new Error(
      `enactBill: "${bill.id}" needs ${totalCapital.toFixed(1)} political capital ` +
        `and the government has ${state.politicalCapital.current.toFixed(1)}.`,
    );
  }

  /*
    ────────────────────────────────────────────────────────────────────────
    THE VOTE. This is where the two paths finally diverge in the way the brief
    describes: a crown enacts what it wants, and a president has to carry both
    chambers. Everything above this point is identical on both paths; nothing
    below it is.

    The capital and the tactics are spent WHETHER OR NOT the bill passes. A
    government that whips hard and loses has still whipped hard — refunding the
    attempt would make trying free, and make failure costless. (brief §2.2)
    ────────────────────────────────────────────────────────────────────────
  */
  if (state.governmentType === 'republic' && parties.length > 0) {
    const result = bothChambers(state, bill, parties, tactics);
    if (!result.passes) {
      return defeat(state, bill, result, totalCapital);
    }
  }

  const effects: TickEffect[] = [];
  const day = state.day;
  const capital = totalCapital;
  const money = price.treasury;

  // --- The ledger ----------------------------------------------------------
  let activeModifiers = state.activeModifiers;
  for (const modifier of billModifiers(bill, sliderValue, day)) {
    activeModifiers = upsertModifier(activeModifiers, modifier);
  }

  // --- The record ----------------------------------------------------------
  const record: EnactedBill = {
    billId: bill.id,
    enactedDay: day,
    repealedDay: null,
    sliderValue: bill.hasSlider ? sliderValue : null,
  };

  const existing = state.policies.bills.findIndex((b) => b.billId === bill.id);
  const bills =
    existing === -1
      ? [...state.policies.bills, record]
      : state.policies.bills.map((b, i) => (i === existing ? record : b));

  let policies = { ...state.policies, bills };

  // --- Instances the bill creates (brief §4.3) -----------------------------
  if (bill.createsTax) {
    const template = bill.createsTax;
    policies = upsertTax(policies, {
      id: template.taxId,
      name: template.name,
      // The bill that created it, so every dollar it raises is attributable.
      createdByBillId: bill.id,
      base: template.base,
      rate:
        bill.hasSlider && bill.sliderUnit === 'rate' && sliderValue !== null
          ? sliderValue
          : template.rate,
      exemptions: [...template.exemptions],
      collectionEfficiency:
        template.collectionEfficiency ?? TAX_BASES[template.base].referenceEfficiency,
      enactedDay: day,
      repealedDay: null,
    });

    effects.push({
      kind: 'taxEnacted',
      day,
      description: `${bill.name} lays a duty on ${TAX_BASES[template.base].label.toLowerCase()}`,
      refs: [template.taxId, bill.id],
    });
  }

  if (bill.createsProgram) {
    const template = bill.createsProgram;
    policies = upsertProgram(policies, {
      id: template.programId,
      name: template.name,
      createdByBillId: bill.id,
      category: template.category,
      annualAmount:
        bill.hasSlider && bill.sliderUnit === 'dollars' && sliderValue !== null
          ? sliderValue
          : template.annualAmount,
      enactedDay: day,
      repealedDay: null,
    });

    effects.push({
      kind: 'programFunded',
      day,
      description: `${bill.name} funds ${template.name}`,
      refs: [template.programId, bill.id],
    });
  }

  // --- Bloc reactions ------------------------------------------------------
  const shifts = blocSentimentShifts(bill.blocReactions, state.regions, blocWeights(state));
  const regions = state.regions.map((region) => ({
    ...region,
    // Applied to the BASE sentiment, not the current value, because a lagged
    // stat's equilibrium is what a permanent political fact should move. The
    // stored value then drifts there over the usual six months. Applying it to
    // the current value would produce a jump the model would immediately undo.
    baseSentiment: clampSentiment(region.baseSentiment + (shifts[region.id] ?? 0)),
  }));

  effects.push({
    kind: 'billEnacted',
    day,
    description: price.byDecree ? `${bill.name} decreed` : `${bill.name} passes`,
    refs: [bill.id],
  });

  /*
    GRIEVANCE. The bloc reactions are recorded as resentment as well as as a
    sentiment shift, and the RATE depends on the path: a decree is imposed and
    the losers had no opportunity to be heard, so the whole of their opposition
    becomes resentment. A bill argued through and voted on is a bill the losers
    were part of losing. (brief §2.1, ECONOMY.md §7.19)
  */
  const grievance = accrueGrievance(
    state.grievance,
    bill.blocReactions,
    state.governmentType,
    blocWeights(state),
  );

  /*
    THE MEN WHO SERVE THE GOVERNMENT FEEL IT TOO. (brief §5)

    An officer’s loyalty falls when the government carries measures HIS people
    hate, through the same bloc affinities the bloc reactions are written in.
    Jefferson did not resign over a personality; he resigned after four years of
    losing arguments about things the small farmers and the planters could not
    stomach. (ECONOMY.md §7.25)
  */
  const cabinet = strainLoyalty(state.cabinet, bill.blocReactions);

  /*
    A log-roll's votes arrive now and its price arrives later. The obligation is
    recorded here and settled by the tick when it comes due — in capital if the
    government has any, in standing if it does not.
  */
  let congress = state.congress;
  if (state.governmentType === 'republic' && tactics.logRoll !== null) {
    congress = addObligation(congress, tactics.logRoll, bill.id, day);
  }
  // Whipping is spent on the vote it bought, win or lose.
  congress = { ...congress, whipped: {} };

  return {
    state: {
      ...state,
      policies,
      regions,
      grievance,
      cabinet,
      congress,
      activeModifiers,
      treasury: { ...state.treasury, balance: state.treasury.balance - money },
      politicalCapital: {
        ...state.politicalCapital,
        current: state.politicalCapital.current - capital,
        totalSpent: state.politicalCapital.totalSpent + capital,
      },
      nation: {
        ...state.nation,
        // Charged against the BASE: legitimacy is cumulative rather than
        // target-seeking (ECONOMY.md §7.15), so charging the resolved value
        // would be undone by the next monthly recompute.
        legitimacyBase: Math.max(0, state.nation.legitimacyBase - price.legitimacy),
      },
      log: [
        ...state.log,
        {
          id: `${day}:bill:${bill.id}`,
          day,
          tier: 'enactment',
          category: 'legislation',
          title: price.byDecree ? `${bill.name}, by decree` : bill.name,
          body: describeEnactment(bill, sliderValue, price),
          relatedEventId: null,
        },
      ],
    },
    effects,
  };
}

function clampSentiment(value: number): number {
  return Math.min(100, Math.max(-100, value));
}

/**
 * The bill was voted down.
 *
 * The capital is gone, the cooldown starts, and the government's standing takes
 * a knock that GROWS with the number of defeats — the third bill a government
 * loses says something the first did not. (brief §2.2)
 *
 * A defeat is an ordinary outcome, not an error, so it returns a state like any
 * other rather than throwing. The chronicle records which chamber refused it and
 * by how much, because "it failed" is not something a player can act on.
 */
function defeat(
  state: GameState,
  bill: Bill,
  result: { house: WhipCount; senate: WhipCount },
  capitalSpent: number,
): BillOutcome {
  const day = state.day;
  const { congress, legitimacyCost } = recordDefeat(state.congress, bill.id, day);

  const blocking = !result.house.passes ? result.house : result.senate;
  const chamber = blocking.chamber === 'house' ? 'the House' : 'the Senate';

  return {
    state: {
      ...state,
      congress,
      politicalCapital: {
        ...state.politicalCapital,
        current: state.politicalCapital.current - capitalSpent,
        totalSpent: state.politicalCapital.totalSpent + capitalSpent,
      },
      nation: {
        ...state.nation,
        legitimacyBase: Math.max(0, state.nation.legitimacyBase - legitimacyCost),
      },
      log: [
        ...state.log,
        {
          id: `${day}:defeated:${bill.id}`,
          day,
          tier: 'decision',
          category: 'legislation',
          title: `${bill.name} is defeated`,
          body:
            `${chamber} divided ${blocking.for.toFixed(0)} for and ` +
            `${blocking.against.toFixed(0)} against, with ` +
            `${blocking.undecided.toFixed(0)} abstaining. The measure falls. ` +
            `It cannot be brought again for ${FAILED_BILL_COOLDOWN_DAYS} days, and ` +
            `the government has now lost ${congress.defeats} ` +
            `${congress.defeats === 1 ? 'division' : 'divisions'}.`,
          relatedEventId: null,
        },
      ],
    },
    effects: [
      {
        kind: 'billDefeated',
        day,
        description: `${bill.name} defeated in ${chamber}`,
        refs: [bill.id],
      },
    ],
  };
}

function describeEnactment(
  bill: Bill,
  sliderValue: number | null,
  price: BillPrice,
): string {
  const parts: string[] = [];

  if (bill.hasSlider && sliderValue !== null) {
    parts.push(
      bill.sliderUnit === 'rate'
        ? `Set at ${(sliderValue * 100).toFixed(1)}%`
        : `Funded at $${Math.round(sliderValue).toLocaleString('en-US')}`,
    );
  }

  if (price.byDecree) {
    parts.push('Enacted by the crown alone, without a vote');
  }

  parts.push(`Cost ${price.capital.toFixed(1)} political capital`);
  if (price.legitimacy > 0) {
    parts.push(`and ${price.legitimacy.toFixed(1)} legitimacy`);
  }
  if (price.treasury > 0) {
    parts.push(`and $${Math.round(price.treasury).toLocaleString('en-US')}`);
  }
  if (bill.phaseInDays > 0) {
    parts.push(`Effects phase in over ${bill.phaseInDays} days`);
  }

  return parts.join('. ') + '.';
}

// ============================================================================
// AMENDING AND REPEALING
// ============================================================================

/** Move a bill's slider. Costs capital in proportion to the movement. */
export function amendBill(
  state: GameState,
  bill: Bill,
  sliderValue: number,
): BillOutcome {
  const record = enactedRecord(state, bill.id);
  if (!record || record.repealedDay !== null) {
    throw new Error(`amendBill: "${bill.id}" is not in force.`);
  }
  if (!bill.hasSlider) {
    throw new Error(`amendBill: "${bill.id}" has no slider to move.`);
  }

  const capital = amendCost(bill, record.sliderValue, sliderValue);
  if (capital > state.politicalCapital.current) {
    throw new Error(
      `amendBill: needs ${capital.toFixed(1)} political capital and the ` +
        `government has ${state.politicalCapital.current.toFixed(1)}.`,
    );
  }

  const day = state.day;

  let activeModifiers = state.activeModifiers;
  for (const modifier of billModifiers(bill, sliderValue, day)) {
    /*
      The amended modifier keeps the ORIGINAL enactment as its start day, so
      amending does not restart the phase-in. A law already in force whose rate
      is adjusted is not a new law, and making the country re-absorb it from
      nothing would be wrong.
    */
    activeModifiers = upsertModifier(activeModifiers, {
      ...modifier,
      startDay: record.enactedDay,
    });
  }

  let policies = {
    ...state.policies,
    bills: state.policies.bills.map((b) =>
      b.billId === bill.id ? { ...b, sliderValue } : b,
    ),
  };

  // A slider bill that created a tax moves that tax's rate with it — otherwise
  // the Treasury line and the Legislation slider would disagree.
  if (bill.createsTax && bill.sliderUnit === 'rate') {
    const tax = policies.taxes.find((t) => t.id === bill.createsTax!.taxId);
    if (tax) {
      policies = {
        ...policies,
        taxes: policies.taxes.map((t) =>
          t.id === tax.id ? { ...t, rate: sliderValue } : t,
        ),
      };
    }
  }

  if (bill.createsProgram && bill.sliderUnit === 'dollars') {
    policies = {
      ...policies,
      programs: policies.programs.map((p) =>
        p.id === bill.createsProgram!.programId
          ? { ...p, annualAmount: sliderValue }
          : p,
      ),
    };
  }

  return {
    state: {
      ...state,
      policies,
      activeModifiers,
      politicalCapital: {
        ...state.politicalCapital,
        current: state.politicalCapital.current - capital,
        totalSpent: state.politicalCapital.totalSpent + capital,
      },
      log: [
        ...state.log,
        {
          id: `${day}:amend:${bill.id}`,
          day,
          tier: 'enactment',
          category: 'legislation',
          title: `${bill.name} amended`,
          body:
            bill.sliderUnit === 'rate'
              ? `Set to ${(sliderValue * 100).toFixed(1)}%. Cost ${capital.toFixed(1)} political capital.`
              : `Set to $${Math.round(sliderValue).toLocaleString('en-US')}. Cost ${capital.toFixed(1)} political capital.`,
          relatedEventId: null,
        },
      ],
    },
    effects: [
      {
        kind: 'billAmended',
        day,
        description: `${bill.name} amended`,
        refs: [bill.id],
      },
    ],
  };
}

/**
 * Repeal a bill.
 *
 * Its modifiers go — they must, or the ledger keeps applying a law no longer in
 * force — and any tax or programme it created goes with them.
 *
 * What does NOT reverse is the bloc reaction. A country does not un-resent a law
 * because it was taken back, and a repeal that refunded the political damage
 * would make passing an unpopular bill temporarily free.
 */
export function repealBill(state: GameState, bill: Bill): BillOutcome {
  const record = enactedRecord(state, bill.id);
  if (!record || record.repealedDay !== null) {
    throw new Error(`repealBill: "${bill.id}" is not in force.`);
  }
  if (!bill.repealable) {
    throw new Error(`repealBill: "${bill.id}" is not repealable.`);
  }

  const capital = bill.capitalCost.repeal;
  if (capital > state.politicalCapital.current) {
    throw new Error(
      `repealBill: needs ${capital.toFixed(1)} political capital and the ` +
        `government has ${state.politicalCapital.current.toFixed(1)}.`,
    );
  }

  const day = state.day;

  let policies = {
    ...state.policies,
    bills: state.policies.bills.map((b) =>
      b.billId === bill.id ? { ...b, repealedDay: day } : b,
    ),
  };

  if (bill.createsTax) {
    policies = repealTax(policies, bill.createsTax.taxId, day);
  }
  if (bill.createsProgram) {
    policies = defundProgram(policies, bill.createsProgram.programId, day);
  }

  return {
    state: {
      ...state,
      policies,
      activeModifiers: removeModifiersFromSource(state.activeModifiers, 'law', bill.id),
      politicalCapital: {
        ...state.politicalCapital,
        current: state.politicalCapital.current - capital,
        totalSpent: state.politicalCapital.totalSpent + capital,
      },
      log: [
        ...state.log,
        {
          id: `${day}:repeal:${bill.id}`,
          day,
          tier: 'enactment',
          category: 'legislation',
          title: `${bill.name} repealed`,
          body: `Cost ${capital.toFixed(1)} political capital. Its effects are withdrawn; the resentment it caused is not.`,
          relatedEventId: null,
        },
      ],
    },
    effects: [
      { kind: 'billRepealed', day, description: `${bill.name} repealed`, refs: [bill.id] },
    ],
  };
}
