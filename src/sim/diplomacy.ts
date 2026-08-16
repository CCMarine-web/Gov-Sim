/**
 * DIPLOMACY
 *
 * Phase 2 brief §7. Foreign powers as modelled entities, the relations we have
 * with them, and the treaties that change what our economy can do.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE REQUIREMENT THAT SHAPES THE WHOLE MODULE
 *
 *   "Trade agreements feed the real economy — trade volume, customs revenue,
 *    and regional prosperity. They must flow through the same model, not a
 *    parallel one."
 *
 * So a trade agreement does not have a trade-agreement effect. It writes
 * MODIFIERS into the same ledger a bill writes into, against the same targets
 * (`nation.tradeCapacity`, `region.*.prosperity`), with the same phase-in ramp.
 * The Treasury cannot tell a treaty from a tariff, and that is the point: there
 * is one economy and everything argues with it on equal terms.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHAT LIVES WHERE
 *
 *   `src/content/diplomacy/powers.ts`    who they are — content, cited
 *   `src/content/diplomacy/treaties.ts`  what can be signed — content, cited
 *   this file                            what the state of things is, and the
 *                                        rules for changing it
 *
 * Pure. No clock, no randomness of its own.
 */

import { POWER_BY_ID, POWERS, type ForeignPower, type RulerTerm } from '@/content/diplomacy/powers';
import {
  TREATIES,
  TREATY_BY_ID,
  type TreatyTemplate,
} from '@/content/diplomacy/treaties';
import {
  DIPLOMATIC_DECAY_PER_MONTH,
  ENVOY_CAPITAL_COST,
  ENVOY_RELATION_GAIN,
  RELATION_RANGE,
  TREATY_BREACH_RELATION_COST,
  TREATY_BREACH_LEGITIMACY_COST,
} from './calibration';
import { isoToDay } from './calendar';
import { makeModifierId, removeModifiersFromSource, upsertModifier } from './modifiers';
import type { DiplomacyState, GameState, Modifier, PowerRelation, TreatyRecord } from './types';

// ============================================================================
// SEEDING
// ============================================================================

export function seedDiplomacy(): DiplomacyState {
  const relations: Record<string, PowerRelation> = {};
  for (const power of POWERS) {
    relations[power.id] = {
      powerId: power.id,
      /*
        The relations of 1789 are not neutral and should not start neutral.
        Britain still holds the northwestern forts; France is owed both money
        and gratitude; Algiers is taking American ships. Each starting value is
        reasoned beside the power in the content file.
      */
      relation: power.startingRelation,
      atWar: false,
      lastEnvoyDay: null,
    };
  }

  return { relations, treaties: [], tributeDue: [] };
}

// ============================================================================
// QUERIES
// ============================================================================

export function relationWith(state: GameState, powerId: string): number {
  return state.diplomacy.relations[powerId]?.relation ?? 0;
}

/** Who governs a power on `day`, from its dated ruler list. */
export function rulerOn(power: ForeignPower, day: number): RulerTerm | null {
  let current: RulerTerm | null = null;
  for (const term of power.rulers) {
    if (day >= isoToDay(term.from)) current = term;
  }
  return current;
}

/** Plain words for a relation, so it is never a bare number or a colour. */
export function relationWord(relation: number): string {
  if (relation <= -70) return 'Hostile';
  if (relation <= -35) return 'Unfriendly';
  if (relation <= -10) return 'Cool';
  if (relation < 10) return 'Correct';
  if (relation < 40) return 'Cordial';
  if (relation < 70) return 'Friendly';
  return 'Allied in all but name';
}

/** Treaties in force with a power on `day`. */
export function treatiesInForce(state: GameState, powerId?: string): TreatyRecord[] {
  return state.diplomacy.treaties.filter(
    (t) =>
      t.signedDay <= state.day &&
      (t.endedDay === null || t.endedDay > state.day) &&
      (powerId === undefined || t.powerId === powerId),
  );
}

export function hasTreaty(state: GameState, treatyId: string): boolean {
  return treatiesInForce(state).some((t) => t.treatyId === treatyId);
}

export type TreatyStatus =
  | { kind: 'inForce'; record: TreatyRecord }
  | { kind: 'ended'; record: TreatyRecord }
  | { kind: 'available' }
  | { kind: 'notYet'; from: string }
  | { kind: 'tooLate'; until: string }
  | { kind: 'atWar' }
  | { kind: 'relationTooLow'; needed: number; have: number }
  | { kind: 'blocked'; reasons: string[] };

/**
 * Whether a treaty can be signed, and if not, WHY.
 *
 * The same contract `billStatus` has: a control the player cannot use must say
 * what would change that. A greyed-out treaty with no reason teaches nothing.
 */
export function treatyStatus(state: GameState, treaty: TreatyTemplate): TreatyStatus {
  const record = state.diplomacy.treaties.find((t) => t.treatyId === treaty.id);
  if (record) {
    const inForce =
      record.signedDay <= state.day &&
      (record.endedDay === null || record.endedDay > state.day);
    return inForce ? { kind: 'inForce', record } : { kind: 'ended', record };
  }

  if (state.day < isoToDay(treaty.availableFrom)) {
    return { kind: 'notYet', from: treaty.availableFrom };
  }
  if (treaty.availableUntil !== null && state.day >= isoToDay(treaty.availableUntil)) {
    return { kind: 'tooLate', until: treaty.availableUntil };
  }

  const relation = state.diplomacy.relations[treaty.powerId];
  if (relation?.atWar) return { kind: 'atWar' };

  if (relation && relation.relation < treaty.minimumRelation) {
    return {
      kind: 'relationTooLow',
      needed: treaty.minimumRelation,
      have: relation.relation,
    };
  }

  const unmet = treaty.requiresTreaties.filter((id) => !hasTreaty(state, id));
  if (unmet.length > 0) {
    return {
      kind: 'blocked',
      reasons: unmet.map((id) => `${TREATY_BY_ID[id]?.name ?? id} must be in force first`),
    };
  }

  return { kind: 'available' };
}

// ============================================================================
// ACTIONS
// ============================================================================

function clampRelation(value: number): number {
  return Math.max(RELATION_RANGE.min, Math.min(RELATION_RANGE.max, value));
}

/**
 * Shift a relation, and keep it in range.
 *
 * Exported because events and treaties both need it, and two code paths that
 * both nudge a number are two code paths that eventually disagree about its
 * bounds.
 */
export function shiftRelation(
  diplomacy: DiplomacyState,
  powerId: string,
  delta: number,
): DiplomacyState {
  const current = diplomacy.relations[powerId];
  if (!current) return diplomacy;

  return {
    ...diplomacy,
    relations: {
      ...diplomacy.relations,
      [powerId]: { ...current, relation: clampRelation(current.relation + delta) },
    },
  };
}

/**
 * Send an envoy: spend political capital to improve a relation.
 *
 * Deliberately weak and deliberately repeatable. Diplomacy in this period was
 * slow and incremental, and a single mission that transformed a relationship
 * would make the treaty prerequisites meaningless — the player would simply buy
 * their way to any threshold in one action. The cost is real capital, so it
 * competes with legislation for the same reserve.
 */
export function sendEnvoy(
  state: GameState,
  powerId: string,
): { state: GameState; ok: boolean; reason: string | null } {
  const relation = state.diplomacy.relations[powerId];
  if (!relation) return { state, ok: false, reason: 'No such power.' };
  if (relation.atWar) {
    return { state, ok: false, reason: 'There is a war on. Envoys come later.' };
  }
  if (state.politicalCapital.current < ENVOY_CAPITAL_COST) {
    return {
      state,
      ok: false,
      reason: `Not enough political capital: ${ENVOY_CAPITAL_COST} is needed.`,
    };
  }

  const power = POWER_BY_ID[powerId];
  const diplomacy = shiftRelation(state.diplomacy, powerId, ENVOY_RELATION_GAIN);

  return {
    state: {
      ...state,
      politicalCapital: {
        ...state.politicalCapital,
        current: state.politicalCapital.current - ENVOY_CAPITAL_COST,
      },
      diplomacy: {
        ...diplomacy,
        relations: {
          ...diplomacy.relations,
          [powerId]: { ...diplomacy.relations[powerId], lastEnvoyDay: state.day },
        },
      },
      log: [
        ...state.log,
        {
          id: `${state.day}:envoy:${powerId}`,
          day: state.day,
          tier: 'info',
          category: 'system',
          title: `A minister is sent to ${power?.shortName ?? powerId}`,
          body:
            'Instructions, a passage, and a year of patience. Relations improve a ' +
            'little, which is all a single mission has ever done.',
          relatedEventId: null,
        },
      ],
    },
    ok: true,
    reason: null,
  };
}

/**
 * The modifiers a treaty puts into the ledger.
 *
 * Identical in kind to `billModifiers`: same ledger, same targets, same ramp.
 * A treaty that opened trade through a private channel would be a second
 * economy, and the brief forbids exactly that.
 */
export function treatyModifiers(treaty: TreatyTemplate, signedDay: number): Modifier[] {
  return treaty.effects.map((effect) => ({
    id: makeModifierId('treaty', treaty.id, effect.target),
    source: treaty.name,
    sourceType: 'treaty',
    target: effect.target,
    value: effect.value,
    isPercentage: effect.isPercentage,
    startDay: signedDay,
    endDay: effect.durationDays === null ? null : signedDay + effect.durationDays,
    // A treaty takes effect at the pace of ships and customs houses, like a
    // statute takes effect at the pace of collectors.
    rampDays: treaty.phaseInDays,
  }));
}

export function signTreaty(
  state: GameState,
  treaty: TreatyTemplate,
): { state: GameState; ok: boolean; reason: string | null } {
  const status = treatyStatus(state, treaty);
  if (status.kind !== 'available') {
    return { state, ok: false, reason: describeTreatyStatus(status) };
  }
  if (state.politicalCapital.current < treaty.capitalCost) {
    return {
      state,
      ok: false,
      reason: `Not enough political capital: ${treaty.capitalCost} is needed.`,
    };
  }
  if (state.treasury.balance < treaty.treasuryCost) {
    return {
      state,
      ok: false,
      reason: `The treasury cannot meet the ${treaty.treasuryCost.toLocaleString('en-US')} dollars this costs.`,
    };
  }

  let modifiers = state.activeModifiers;
  for (const modifier of treatyModifiers(treaty, state.day)) {
    modifiers = upsertModifier(modifiers, modifier);
  }

  const record: TreatyRecord = {
    treatyId: treaty.id,
    powerId: treaty.powerId,
    signedDay: state.day,
    endedDay: null,
    breached: false,
  };

  let diplomacy = shiftRelation(state.diplomacy, treaty.powerId, treaty.relationEffect);
  for (const [otherId, delta] of Object.entries(treaty.relationEffectOnOthers)) {
    diplomacy = shiftRelation(diplomacy, otherId, delta);
  }

  const power = POWER_BY_ID[treaty.powerId];

  return {
    state: {
      ...state,
      politicalCapital: {
        ...state.politicalCapital,
        current: state.politicalCapital.current - treaty.capitalCost,
      },
      treasury: {
        ...state.treasury,
        balance: state.treasury.balance - treaty.treasuryCost,
      },
      activeModifiers: modifiers,
      diplomacy: {
        ...diplomacy,
        treaties: [...diplomacy.treaties, record],
        tributeDue:
          treaty.annualTribute > 0
            ? [
                ...diplomacy.tributeDue,
                {
                  powerId: treaty.powerId,
                  treatyId: treaty.id,
                  annualAmount: treaty.annualTribute,
                },
              ]
            : diplomacy.tributeDue,
      },
      log: [
        ...state.log,
        {
          id: `${state.day}:treaty:${treaty.id}`,
          day: state.day,
          tier: 'enactment',
          category: 'system',
          title: treaty.name,
          body: `${treaty.description} Concluded with ${power?.name ?? treaty.powerId}.`,
          relatedEventId: null,
        },
      ],
    },
    ok: true,
    reason: null,
  };
}

/**
 * Break a treaty.
 *
 * The effects come out of the ledger, because a ledger that kept applying a
 * treaty no longer in force would be lying. What does NOT come out is the
 * memory: the relation falls hard, and legitimacy falls too, because a
 * government that does not keep its word is a government whose word is worth
 * less — at home as well as abroad.
 */
export function breachTreaty(
  state: GameState,
  treatyId: string,
): { state: GameState; ok: boolean; reason: string | null } {
  const record = state.diplomacy.treaties.find(
    (t) => t.treatyId === treatyId && t.endedDay === null,
  );
  if (!record) return { state, ok: false, reason: 'No such treaty is in force.' };

  const treaty = TREATY_BY_ID[treatyId];
  const power = POWER_BY_ID[record.powerId];

  const diplomacy = shiftRelation(
    {
      ...state.diplomacy,
      treaties: state.diplomacy.treaties.map((t) =>
        t.treatyId === treatyId && t.endedDay === null
          ? { ...t, endedDay: state.day, breached: true }
          : t,
      ),
      tributeDue: state.diplomacy.tributeDue.filter((t) => t.treatyId !== treatyId),
    },
    record.powerId,
    -TREATY_BREACH_RELATION_COST,
  );

  return {
    state: {
      ...state,
      activeModifiers: removeModifiersFromSource(
        state.activeModifiers,
        'treaty',
        treatyId,
      ),
      nation: {
        ...state.nation,
        legitimacyBase: state.nation.legitimacyBase - TREATY_BREACH_LEGITIMACY_COST,
      },
      diplomacy,
      log: [
        ...state.log,
        {
          id: `${state.day}:breach:${treatyId}`,
          day: state.day,
          tier: 'enactment',
          category: 'system',
          title: `${treaty?.name ?? treatyId} is repudiated`,
          body:
            `The engagement with ${power?.name ?? record.powerId} is at an end, and ` +
            'not by agreement. What it bought goes with it, and so does some of ' +
            'what the government’s word was worth.',
          relatedEventId: null,
        },
      ],
    },
    ok: true,
    reason: null,
  };
}

// ============================================================================
// THE MONTHLY TICK
// ============================================================================

/**
 * Relations drift back toward where they started.
 *
 * Not toward zero — toward each power's own baseline, because the reasons
 * Britain was cool and France warm in 1789 did not go away because a minister
 * had a good year. A government that stops working at a relationship loses what
 * it bought, which is what makes the envoy a recurring cost rather than a
 * purchase.
 */
export function decayRelations(diplomacy: DiplomacyState): DiplomacyState {
  const relations: Record<string, PowerRelation> = {};

  for (const [id, current] of Object.entries(diplomacy.relations)) {
    const baseline = POWER_BY_ID[id]?.startingRelation ?? 0;
    const gap = baseline - current.relation;
    relations[id] = {
      ...current,
      relation: clampRelation(current.relation + gap * DIPLOMATIC_DECAY_PER_MONTH),
    };
  }

  return { ...diplomacy, relations };
}

/** What tribute costs the treasury this year, in total. */
export function annualTribute(state: GameState): number {
  return state.diplomacy.tributeDue.reduce((sum, t) => sum + t.annualAmount, 0);
}

// ============================================================================
// EXPLANATION
// ============================================================================

export function describeTreatyStatus(status: TreatyStatus): string {
  switch (status.kind) {
    case 'inForce':
      return 'In force.';
    case 'ended':
      return status.record.breached ? 'Repudiated.' : 'No longer in force.';
    case 'available':
      return 'Can be concluded.';
    case 'notYet':
      return `Not before ${status.from}.`;
    case 'tooLate':
      return `The moment for this passed in ${status.until}.`;
    case 'atWar':
      return 'There is a war on. Nothing is signed until it ends.';
    case 'relationTooLow':
      return `Relations are too poor: ${status.needed} is needed and they stand at ${status.have.toFixed(0)}.`;
    case 'blocked':
      return status.reasons.join('; ');
  }
}

/** Every treaty with a power, with where each stands. For the panel. */
export function treatiesFor(
  state: GameState,
  powerId: string,
): Array<{ treaty: TreatyTemplate; status: TreatyStatus }> {
  return TREATIES.filter((t) => t.powerId === powerId).map((treaty) => ({
    treaty,
    status: treatyStatus(state, treaty),
  }));
}
