/**
 * WAR — declaring it, and living with it
 *
 * Phase 2 brief §7, queue item 12. The brief is unusually specific here, and
 * this module is built directly against it:
 *
 *   "War declaration is where the two playthroughs diverge hardest. A monarch
 *    declares war by decree. A republic requires a congressional declaration,
 *    which needs public support and a defensible pretext. Model the HOI4-style
 *    threshold gate: aggression without justification tanks legitimacy, invites
 *    foreign hostility, and in a republic can simply be voted down."
 *
 *   "Combat itself is not in this phase. Build declaration, claims, treaties,
 *    and resolution-by-event."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DIVERGENCE, CONCRETELY
 *
 *                            MONARCHY                 REPUBLIC
 *   How it is declared       by decree, at once       by vote of both chambers
 *   What can stop it         nothing                  the House or the Senate
 *   Cost of a weak pretext   legitimacy and grievance the vote simply fails
 *   Cost of a strong one     small                    a majority, and capital
 *
 * A crown can always have its war. What it cannot do is have it cheaply, and
 * what it cannot do at all is be told no. That is the same bargain the rest of
 * the game makes — speed bought with consent — applied to the largest decision
 * in it.
 *
 * A DECLARATION IS A MEASURE, and goes through `whipCount` exactly as a bill
 * does: the same inspectable division, the same reasons per delegation, the
 * same whipping and riders. `Measure` in `congress.ts` exists for this.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Pure. No clock of its own, no randomness.
 */

import {
  CASUS_BELLI,
  CASUS_BELLI_BY_ID,
  fabricatedClaim,
  type CasusBelli,
} from '@/content/diplomacy/casusBelli';
import { POWER_BY_ID } from '@/content/diplomacy/powers';
import {
  FABRICATION_CAPITAL_COST,
  FABRICATED_WAR_LEGITIMACY_COST,
  FABRICATED_WAR_RELATION_COST,
  PEACE_CAPITAL_COST,
  UNJUSTIFIED_WAR_THRESHOLD,
  WAR_DECLARATION_CAPITAL,
  WAR_LEGITIMACY_PER_MISSING_JUSTIFICATION,
  WAR_TRADE_SUPPRESSION,
  WAR_WEARINESS_PER_MONTH,
} from './calibration';
import { isoToDay } from './calendar';
import { NO_TACTICS, bothChambers, type BillTactics } from './congress';
import { hasTreaty, shiftRelation } from './diplomacy';
import { accrueGrievance } from './grievance';
import { blocWeights } from './blocs';
import { makeModifierId, removeModifiersFromSource, upsertModifier } from './modifiers';
import type { GameState, Modifier, Party, WarRecord } from './types';

// ============================================================================
// GROUNDS
// ============================================================================

/**
 * Every ground for war against a power that is available today.
 *
 * A grievance settled by treaty is gone: once Britain has evacuated the posts
 * under the Jay Treaty there is no longer a case about the posts. That is the
 * mechanism by which diplomacy actually prevents wars rather than merely
 * postponing them.
 */
export function availableGrounds(state: GameState, powerId: string): CasusBelli[] {
  const real = CASUS_BELLI.filter((c) => {
    if (c.powerId !== powerId) return false;
    if (state.day < isoToDay(c.availableFrom)) return false;
    if (c.availableUntil !== null && state.day >= isoToDay(c.availableUntil)) return false;
    if (c.settledBy !== null && hasTreaty(state, c.settledBy)) return false;
    return true;
  });

  const power = POWER_BY_ID[powerId];
  // The manufactured option is always last, and always available. A player who
  // has no case can still have a war; the price is what the model is about.
  return [...real, fabricatedClaim(powerId, power?.shortName ?? powerId)];
}

export function groundsById(state: GameState, id: string): CasusBelli | null {
  if (id.startsWith('fabricated:')) {
    const powerId = id.slice('fabricated:'.length);
    const power = POWER_BY_ID[powerId];
    return power ? fabricatedClaim(powerId, power.shortName) : null;
  }
  return CASUS_BELLI_BY_ID[id] ?? null;
}

// ============================================================================
// WHAT A DECLARATION WOULD COST
// ============================================================================

export interface DeclarationCost {
  /** Political capital, on either path. */
  capital: number;
  /**
   * Legitimacy, and this is where the threshold gate bites.
   *
   * Nothing at all for an overwhelming case; heavy below the threshold; heavier
   * still for a fabricated one, which carries its own flat penalty on top.
   */
  legitimacy: number;
  /** How far short of a defensible case this is, 0…1. */
  justificationShortfall: number;
  /** Every other power thinks less of a country that behaves this way. */
  relationPenaltyToOthers: number;
  /** Whether this is the aggression case the brief asks to be punished. */
  unjustified: boolean;
}

export function declarationCost(grounds: CasusBelli): DeclarationCost {
  const shortfall = Math.max(
    0,
    (UNJUSTIFIED_WAR_THRESHOLD - grounds.strength) / UNJUSTIFIED_WAR_THRESHOLD,
  );

  const legitimacy =
    shortfall * WAR_LEGITIMACY_PER_MISSING_JUSTIFICATION +
    (grounds.fabricated ? FABRICATED_WAR_LEGITIMACY_COST : 0);

  return {
    capital: WAR_DECLARATION_CAPITAL,
    legitimacy,
    justificationShortfall: shortfall,
    relationPenaltyToOthers: grounds.fabricated
      ? FABRICATED_WAR_RELATION_COST
      : Math.round(shortfall * 12),
    unjustified: grounds.strength < UNJUSTIFIED_WAR_THRESHOLD,
  };
}

/**
 * Fabricating a claim.
 *
 * A separate, earlier expense from the declaration itself, so a player can
 * spend on a pretext and then think better of using it — which is the honest
 * shape of the thing. The capital is spent either way.
 */
export function fabricateClaim(
  state: GameState,
  powerId: string,
): { state: GameState; ok: boolean; reason: string | null } {
  if (state.politicalCapital.current < FABRICATION_CAPITAL_COST) {
    return {
      state,
      ok: false,
      reason: `Not enough political capital: ${FABRICATION_CAPITAL_COST} is needed.`,
    };
  }

  const power = POWER_BY_ID[powerId];

  return {
    state: {
      ...state,
      politicalCapital: {
        ...state.politicalCapital,
        current: state.politicalCapital.current - FABRICATION_CAPITAL_COST,
      },
      flags: { ...state.flags, [`fabricated_claim_${powerId}`]: true },
      log: [
        ...state.log,
        {
          id: `${state.day}:fabricate:${powerId}`,
          day: state.day,
          tier: 'info',
          category: 'system',
          title: `A grievance against ${power?.shortName ?? powerId} is prepared`,
          body:
            'Depositions are taken, an insult is found, and the newspapers are ' +
            'given something to print. It will not bear much weight, and anyone ' +
            'who looks closely will see that.',
          relatedEventId: null,
        },
      ],
    },
    ok: true,
    reason: null,
  };
}

// ============================================================================
// DECLARING
// ============================================================================

export type DeclarationOutcome =
  | { kind: 'declared'; state: GameState; war: WarRecord }
  /** The republic said no. An ordinary outcome, not an error. */
  | { kind: 'votedDown'; state: GameState; forSeats: number; againstSeats: number }
  | { kind: 'refused'; state: GameState; reason: string };

/** The modifiers a war puts on the country while it lasts. */
export function warModifiers(powerId: string, name: string, day: number): Modifier[] {
  return [
    {
      id: makeModifierId('crisis', `war:${powerId}`, 'nation.tradeCapacity'),
      source: `War with ${name}`,
      sourceType: 'crisis',
      target: 'nation.tradeCapacity',
      value: -WAR_TRADE_SUPPRESSION,
      isPercentage: true,
      startDay: day,
      endDay: null,
      // A war closes a trade the day it is declared. There is no phase-in on
      // an embargo or a blockade.
      rampDays: 0,
    },
    {
      id: makeModifierId('crisis', `war:${powerId}`, 'nation.stability'),
      source: `War with ${name}`,
      sourceType: 'crisis',
      target: 'nation.stability',
      value: -8,
      isPercentage: false,
      startDay: day,
      endDay: null,
      rampDays: 0,
    },
  ];
}

/**
 * Declare war. This is the item's centrepiece and the two paths differ entirely.
 *
 * A MONARCHY decrees it. The war happens. What it costs is legitimacy scaled by
 * how poor the case is, plus grievance among the blocs that did not want it —
 * the same currency every other decree is paid in.
 *
 * A REPUBLIC must carry both chambers. The declaration is put to them as a
 * measure with the casus belli's own bloc reactions, so a war the country does
 * not want is a war the country's representatives vote down — at the ordinary
 * price of a defeat. `tactics` is accepted for the same reason a bill accepts
 * it: the player can whip, and the whipping costs.
 */
export function declareWar(
  state: GameState,
  powerId: string,
  groundsId: string,
  parties: readonly Party[],
  tactics: BillTactics = NO_TACTICS,
): DeclarationOutcome {
  const relation = state.diplomacy.relations[powerId];
  if (!relation) {
    return { kind: 'refused', state, reason: 'No such power.' };
  }
  if (relation.atWar) {
    return { kind: 'refused', state, reason: 'Already at war with them.' };
  }

  const grounds = groundsById(state, groundsId);
  if (!grounds || grounds.powerId !== powerId) {
    return { kind: 'refused', state, reason: 'No such grounds against this power.' };
  }

  const cost = declarationCost(grounds);
  if (state.politicalCapital.current < cost.capital) {
    return {
      kind: 'refused',
      state,
      reason: `Not enough political capital: ${cost.capital} is needed.`,
    };
  }

  const power = POWER_BY_ID[powerId];
  const name = power?.shortName ?? powerId;

  // --- The republic has to be asked ----------------------------------------
  if (state.governmentType === 'republic') {
    const division = bothChambers(state, grounds, parties, tactics);
    if (!division.passes) {
      const blocking = !division.house.passes ? division.house : division.senate;
      return {
        kind: 'votedDown',
        forSeats: blocking.for,
        againstSeats: blocking.against,
        state: {
          ...state,
          politicalCapital: {
            ...state.politicalCapital,
            current: state.politicalCapital.current - cost.capital,
          },
          log: [
            ...state.log,
            {
              id: `${state.day}:war-refused:${powerId}`,
              day: state.day,
              tier: 'enactment',
              category: 'system',
              title: `Congress declines to declare war on ${name}`,
              body:
                `The ${blocking.chamber === 'house' ? 'House' : 'Senate'} divided ` +
                `${blocking.for.toFixed(0)} to ${blocking.against.toFixed(0)} against. ` +
                'The grievance stands, and so does the peace.',
              relatedEventId: null,
            },
          ],
        },
      };
    }
  }

  // --- It is declared -------------------------------------------------------
  const war: WarRecord = {
    powerId,
    groundsId,
    declaredDay: state.day,
    endedDay: null,
    fabricated: grounds.fabricated,
    justification: grounds.strength,
    weariness: 0,
    outcome: null,
  };

  let modifiers = state.activeModifiers;
  for (const modifier of warModifiers(powerId, name, state.day)) {
    modifiers = upsertModifier(modifiers, modifier);
  }

  // Every other power thinks less of a country that goes to war this way, and
  // a fabricated pretext is noticed by all of them.
  let diplomacy = shiftRelation(state.diplomacy, powerId, -60);
  if (cost.relationPenaltyToOthers > 0) {
    for (const otherId of Object.keys(diplomacy.relations)) {
      if (otherId === powerId) continue;
      diplomacy = shiftRelation(diplomacy, otherId, -cost.relationPenaltyToOthers);
    }
  }

  diplomacy = {
    ...diplomacy,
    relations: {
      ...diplomacy.relations,
      [powerId]: { ...diplomacy.relations[powerId], atWar: true },
    },
    wars: [...diplomacy.wars, war],
  };

  /*
    THE BLOCS THAT DID NOT WANT THIS REMEMBER IT. A declaration is a measure
    like any other and accrues grievance through the same path, at the decree
    rate on the monarchical path and the legislative rate on the republican —
    because a war voted for is a war the objectors were part of losing.
  */
  const grievance = accrueGrievance(
    state.grievance,
    grounds.blocReactions,
    state.governmentType,
    blocWeights(state),
  );

  return {
    kind: 'declared',
    war,
    state: {
      ...state,
      politicalCapital: {
        ...state.politicalCapital,
        current: state.politicalCapital.current - cost.capital,
      },
      nation: {
        ...state.nation,
        legitimacyBase: state.nation.legitimacyBase - cost.legitimacy,
      },
      activeModifiers: modifiers,
      diplomacy,
      grievance,
      log: [
        ...state.log,
        {
          id: `${state.day}:war:${powerId}`,
          day: state.day,
          tier: 'crisis',
          category: 'system',
          title: `War is declared on ${name}`,
          body:
            `${grounds.claim} ` +
            (grounds.fabricated
              ? 'The grounds will not bear examination, and they will be examined.'
              : cost.unjustified
                ? 'The case is thin, and the country knows it.'
                : 'The case is a good one and is generally accepted.'),
          relatedEventId: null,
        },
      ],
    },
  };
}

// ============================================================================
// LIVING WITH IT, AND ENDING IT
// ============================================================================

export function warWith(state: GameState, powerId: string): WarRecord | null {
  return (
    state.diplomacy.wars.find((w) => w.powerId === powerId && w.endedDay === null) ??
    null
  );
}

export function activeWars(state: GameState): WarRecord[] {
  return state.diplomacy.wars.filter((w) => w.endedDay === null);
}

/**
 * A month of war.
 *
 * Weariness rises, and it rises FASTER the worse the case was. A war the
 * country believes in is endured; a war it does not is resented from the first
 * month. This is the only place the justification keeps acting after the
 * declaration, and it is what stops a bad war from being a one-off payment.
 */
export function accrueWeariness(state: GameState): GameState {
  if (state.diplomacy.wars.every((w) => w.endedDay !== null)) return state;

  const wars = state.diplomacy.wars.map((war) => {
    if (war.endedDay !== null) return war;
    const conviction = war.justification / 100;
    const rate = WAR_WEARINESS_PER_MONTH * (2 - conviction);
    return { ...war, weariness: Math.min(100, war.weariness + rate) };
  });

  return { ...state, diplomacy: { ...state.diplomacy, wars } };
}

export type PeaceTerms = 'victory' | 'settlement' | 'concession';

/**
 * What peace with this power would look like today.
 *
 * DETERMINISTIC, and computed from things the player can see: how strong the
 * enemy is, how long it has gone on, and how much of the country's patience is
 * left. There is no combat in this phase (brief §7), so there is nothing to
 * roll — and a die roll here would be worse than nothing, because the player
 * would have no way to reason about whether to fight on.
 */
export function peaceOnOffer(state: GameState, powerId: string): PeaceTerms {
  const war = warWith(state, powerId);
  if (!war) return 'settlement';

  const power = POWER_BY_ID[powerId];
  const enemy = Math.max(1, (power?.landStrength ?? 30) + (power?.navalStrength ?? 0) / 2);

  // Ours: what the country can bring, which in this period is not much and is
  // mostly a question of whether it is still willing.
  const ours =
    state.nation.stability * 0.5 +
    state.nation.legitimacy * 0.3 +
    (100 - war.weariness) * 0.4;

  const ratio = ours / enemy;
  if (ratio > 1.8) return 'victory';
  if (ratio > 0.9) return 'settlement';
  return 'concession';
}

const PEACE_EFFECT: Record<PeaceTerms, { legitimacy: number; stability: number }> = {
  // Winning is worth a great deal to a government's standing, and this is the
  // one route by which a war improves anything.
  victory: { legitimacy: 12, stability: 6 },
  settlement: { legitimacy: 0, stability: 2 },
  concession: { legitimacy: -14, stability: -4 },
};

const PEACE_WORD: Record<PeaceTerms, string> = {
  victory: 'on our terms',
  settlement: 'on terms nobody calls a victory',
  concession: 'on theirs',
};

/**
 * Make peace.
 *
 * "Resolution-by-event" (brief §7): there is no campaign to fight, so a war
 * ends when the government decides to end it, on the terms its position can
 * command. The war modifiers come out of the ledger, weariness stops, and the
 * relation recovers part of what the declaration cost.
 */
export function makePeace(
  state: GameState,
  powerId: string,
): { state: GameState; ok: boolean; reason: string | null; terms: PeaceTerms | null } {
  const war = warWith(state, powerId);
  if (!war) {
    return { state, ok: false, reason: 'There is no war with them.', terms: null };
  }
  if (state.politicalCapital.current < PEACE_CAPITAL_COST) {
    return {
      state,
      ok: false,
      reason: `Not enough political capital: ${PEACE_CAPITAL_COST} is needed.`,
      terms: null,
    };
  }

  const terms = peaceOnOffer(state, powerId);
  const effect = PEACE_EFFECT[terms];
  const power = POWER_BY_ID[powerId];
  const name = power?.shortName ?? powerId;

  const diplomacy = shiftRelation(
    {
      ...state.diplomacy,
      relations: {
        ...state.diplomacy.relations,
        [powerId]: { ...state.diplomacy.relations[powerId], atWar: false },
      },
      wars: state.diplomacy.wars.map((w) =>
        w.powerId === powerId && w.endedDay === null
          ? { ...w, endedDay: state.day, outcome: terms }
          : w,
      ),
    },
    powerId,
    35,
  );

  return {
    ok: true,
    reason: null,
    terms,
    state: {
      ...state,
      politicalCapital: {
        ...state.politicalCapital,
        current: state.politicalCapital.current - PEACE_CAPITAL_COST,
      },
      nation: {
        ...state.nation,
        legitimacyBase: state.nation.legitimacyBase + effect.legitimacy,
        stability: Math.max(0, Math.min(100, state.nation.stability + effect.stability)),
      },
      activeModifiers: removeModifiersFromSource(
        state.activeModifiers,
        'crisis',
        `war:${powerId}`,
      ),
      diplomacy,
      log: [
        ...state.log,
        {
          id: `${state.day}:peace:${powerId}`,
          day: state.day,
          tier: 'enactment',
          category: 'system',
          title: `Peace with ${name}`,
          body:
            `The war is over, ${PEACE_WORD[terms]}. ` +
            (terms === 'concession'
              ? 'What was demanded at the outset was not obtained, and everyone can count.'
              : terms === 'victory'
                ? 'The government has what it asked for, and its standing with it.'
                : 'Nothing is settled that was not settled before, and the cost stands.'),
          relatedEventId: null,
        },
      ],
    },
  };
}
