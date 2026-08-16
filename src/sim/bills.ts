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
 *   4. Its bloc reactions move regional sentiment through a documented
 *      weighting, until queue item 8 replaces that with the real bloc model.
 *
 * Repealing reverses 1 to 3: the modifiers go (they must, or the ledger keeps
 * applying a law no longer in force), and the tax or programme it created is
 * repealed with it. What does NOT reverse is the bloc reaction: a country does
 * not un-resent a law because it was taken back.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Everything here is pure. No time, no randomness, no mutation of the input.
 */

import { BLOC_REGION_WEIGHTS, BLOC_REACTION_TO_SENTIMENT } from './calibration';
import { isoToDay } from './calendar';
import { describeUnmet, evaluateAll } from './conditions';
import { makeModifierId, removeModifiersFromSource, upsertModifier } from './modifiers';
import { repealTax, defundProgram, upsertTax, upsertProgram } from './taxes';
import { TAX_BASES } from './taxBases';
import type {
  Bill,
  BlocReaction,
  EnactedBill,
  GameState,
  Modifier,
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
 */
export function introduceCost(bill: Bill, sliderValue: number | null): number {
  return (
    bill.capitalCost.introduce +
    bill.capitalCost.raise * sliderFraction(bill, sliderValue)
  );
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
 * INTERIM, AND SAID SO. Queue item 8 builds overlapping, fluid bloc membership;
 * until it does, each bloc is distributed across the regions by a documented
 * weighting (`BLOC_REGION_WEIGHTS`, ECONOMY.md §7.18) and its reaction moves
 * that region's sentiment in proportion.
 *
 * This is a real mechanic rather than a placeholder — passing a bill the
 * planters hate really does anger the South today — and item 8 replaces the
 * weighting without touching the content, which is the whole reason bills
 * declare bloc reactions now rather than later.
 */
export function blocSentimentShifts(
  reactions: readonly BlocReaction[],
  regions: readonly Region[],
): Record<string, number> {
  const shifts: Record<string, number> = {};
  for (const region of regions) shifts[region.id] = 0;

  for (const reaction of reactions) {
    const weights = BLOC_REGION_WEIGHTS[reaction.bloc];
    for (const region of regions) {
      const weight = weights[region.id] ?? 0;
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
): BillOutcome {
  const status = billStatus(state, bill);
  if (status.kind !== 'available' && status.kind !== 'repealed') {
    throw new Error(
      `enactBill: "${bill.id}" is not available (${status.kind}). ` +
        'Check billStatus before calling.',
    );
  }

  const capital = introduceCost(bill, sliderValue);
  if (capital > state.politicalCapital.current) {
    throw new Error(
      `enactBill: "${bill.id}" needs ${capital.toFixed(1)} political capital ` +
        `and the government has ${state.politicalCapital.current.toFixed(1)}.`,
    );
  }

  const effects: TickEffect[] = [];
  const day = state.day;
  const money = treasuryCost(bill, sliderValue);

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
  const shifts = blocSentimentShifts(bill.blocReactions, state.regions);
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
    description: `${bill.name} passes`,
    refs: [bill.id],
  });

  return {
    state: {
      ...state,
      policies,
      regions,
      activeModifiers,
      treasury: { ...state.treasury, balance: state.treasury.balance - money },
      politicalCapital: {
        ...state.politicalCapital,
        current: state.politicalCapital.current - capital,
        totalSpent: state.politicalCapital.totalSpent + capital,
      },
      log: [
        ...state.log,
        {
          id: `${day}:bill:${bill.id}`,
          day,
          tier: 'enactment',
          category: 'legislation',
          title: bill.name,
          body: describeEnactment(bill, sliderValue, capital, money),
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

function describeEnactment(
  bill: Bill,
  sliderValue: number | null,
  capital: number,
  money: number,
): string {
  const parts: string[] = [];

  if (bill.hasSlider && sliderValue !== null) {
    parts.push(
      bill.sliderUnit === 'rate'
        ? `Set at ${(sliderValue * 100).toFixed(1)}%`
        : `Funded at $${Math.round(sliderValue).toLocaleString('en-US')}`,
    );
  }

  parts.push(`Cost ${capital.toFixed(1)} political capital`);
  if (money > 0) {
    parts.push(`and $${Math.round(money).toLocaleString('en-US')}`);
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
