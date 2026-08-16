/**
 * EFFECTS
 *
 * Applies the declarative effect grammar from DESIGN.md §7.3.
 *
 * Effects are the only way content changes state. An event option or a law
 * carries a list of `EffectSpec` values, and this module interprets them. That
 * indirection is what makes Rule 4 true: adding a historical event means
 * editing a content file, never engine logic.
 *
 * Everything here is pure. `applyEffect` returns a new state; it never mutates
 * the one it is given.
 */

import { removeModifiersFromSource, upsertModifier } from './modifiers';
import type {
  EffectSpec,
  GameState,
  LogEntry,
  Modifier,
  TickEffect,
} from './types';

export interface EffectContext {
  /** The day the effect is being applied. */
  day: number;
  /** Stable identifier of the originating law or event. */
  sourceId: string;
  /** Human-readable origin, shown in the modifier breakdown. */
  sourceName: string;
}

export interface EffectResult {
  state: GameState;
  tickEffects: TickEffect[];
}

/**
 * Build a deterministic log entry id.
 *
 * Derived from day, source, and the current log length rather than generated,
 * because the engine may not call `Math.random()` and two runs of the same
 * seed must produce byte-identical state. (DESIGN.md Rule 2)
 */
function logId(state: GameState, sourceId: string): string {
  return `${state.day}:${sourceId}:${state.log.length}`;
}

function appendLog(state: GameState, entry: LogEntry): GameState {
  return { ...state, log: [...state.log, entry] };
}

function clampSentiment(value: number): number {
  return Math.min(100, Math.max(-100, value));
}

/**
 * Apply a single effect.
 *
 * Returns the new state plus any tick effects worth surfacing in the feed or
 * asserting on in tests.
 */
export function applyEffect(
  state: GameState,
  effect: EffectSpec,
  context: EffectContext,
): EffectResult {
  const tickEffects: TickEffect[] = [];

  switch (effect.kind) {
    case 'modifier': {
      const modifier: Modifier = {
        id: `${effect.sourceType}:${context.sourceId}:${effect.target}`,
        source: effect.source || context.sourceName,
        sourceType: effect.sourceType,
        target: effect.target,
        value: effect.value,
        isPercentage: effect.isPercentage,
        startDay: context.day,
        endDay:
          effect.durationDays === null
            ? null
            : context.day + effect.durationDays,
      };

      tickEffects.push({
        kind: 'modifierApplied',
        day: context.day,
        description: `${modifier.source}: ${effect.target} ${
          effect.value >= 0 ? '+' : ''
        }${effect.isPercentage ? `${effect.value * 100}%` : effect.value}`,
        refs: [modifier.id],
      });

      return {
        state: {
          ...state,
          activeModifiers: upsertModifier(state.activeModifiers, modifier),
        },
        tickEffects,
      };
    }

    case 'treasuryDelta': {
      return {
        state: {
          ...state,
          treasury: {
            ...state.treasury,
            balance: state.treasury.balance + effect.amount,
          },
        },
        tickEffects,
      };
    }

    case 'regionSentiment': {
      const targets =
        effect.regionId === 'all'
          ? state.regions.map((r) => r.id)
          : [effect.regionId];

      const regions = state.regions.map((region) =>
        targets.includes(region.id)
          ? { ...region, sentiment: clampSentiment(region.sentiment + effect.delta) }
          : region,
      );

      return { state: { ...state, regions }, tickEffects };
    }

    case 'setFlag': {
      return {
        state: { ...state, flags: { ...state.flags, [effect.key]: effect.value } },
        tickEffects,
      };
    }

    case 'scheduleEvent': {
      return {
        state: {
          ...state,
          eventState: {
            ...state.eventState,
            scheduledEvents: [
              ...state.eventState.scheduledEvents,
              { eventId: effect.eventId, fireOnDay: context.day + effect.inDays },
            ],
          },
        },
        tickEffects,
      };
    }

    case 'unlockLaw': {
      // Unlocking is expressed as a flag so that a law's `requirements` can
      // reference it through the ordinary condition grammar, rather than the
      // engine needing a separate notion of "unlocked".
      return {
        state: {
          ...state,
          flags: { ...state.flags, [`law_unlocked:${effect.lawId}`]: true },
        },
        tickEffects,
      };
    }

    case 'repealLaw': {
      const enactedLawIds = state.policies.enactedLawIds.filter(
        (id) => id !== effect.lawId,
      );

      // A repealed law's permanent modifiers must go with it, or the ledger
      // keeps applying effects from a law no longer in force.
      const activeModifiers = removeModifiersFromSource(
        state.activeModifiers,
        'law',
        effect.lawId,
      );

      return {
        state: {
          ...state,
          policies: { ...state.policies, enactedLawIds },
          activeModifiers,
        },
        tickEffects,
      };
    }

    case 'setTaxRate': {
      return {
        state: {
          ...state,
          policies: {
            ...state.policies,
            taxRates: { ...state.policies.taxRates, [effect.tax]: effect.value },
          },
        },
        tickEffects,
      };
    }

    case 'log': {
      return {
        state: appendLog(state, {
          id: logId(state, context.sourceId),
          day: context.day,
          tier: effect.tier,
          category: effect.category,
          title: effect.title,
          body: effect.body,
          relatedEventId: null,
        }),
        tickEffects,
      };
    }
  }
}

/** Apply several effects in order, threading state through each. */
export function applyEffects(
  state: GameState,
  effects: readonly EffectSpec[],
  context: EffectContext,
): EffectResult {
  let current = state;
  const all: TickEffect[] = [];

  for (const effect of effects) {
    const result = applyEffect(current, effect, context);
    current = result.state;
    all.push(...result.tickEffects);
  }

  return { state: current, tickEffects: all };
}

// ============================================================================
// VALIDATION
// ============================================================================

const KNOWN_EFFECT_KINDS = new Set([
  'modifier',
  'treasuryDelta',
  'regionSentiment',
  'setFlag',
  'scheduleEvent',
  'unlockLaw',
  'repealLaw',
  'setTaxRate',
  'log',
]);

/**
 * Structural check on an effect, without needing a game state.
 * Run over every content file by the content validation test, so a malformed
 * effect fails at build time rather than mid-game.
 */
export function validateEffect(effect: EffectSpec, path = 'root'): string[] {
  const problems: string[] = [];

  if (!KNOWN_EFFECT_KINDS.has(effect.kind)) {
    problems.push(`${path}: unknown effect kind "${effect.kind}"`);
    return problems;
  }

  switch (effect.kind) {
    case 'modifier':
      if (!Number.isFinite(effect.value)) {
        problems.push(`${path}: modifier value must be a finite number`);
      }
      if (effect.durationDays !== null && effect.durationDays <= 0) {
        problems.push(
          `${path}: durationDays must be positive or null (null means permanent)`,
        );
      }
      if (!effect.target) {
        problems.push(`${path}: modifier has no target`);
      }
      break;

    case 'treasuryDelta':
      if (!Number.isFinite(effect.amount)) {
        problems.push(`${path}: treasuryDelta amount must be a finite number`);
      }
      break;

    case 'regionSentiment':
      if (!Number.isFinite(effect.delta)) {
        problems.push(`${path}: regionSentiment delta must be a finite number`);
      }
      break;

    case 'scheduleEvent':
      if (!Number.isInteger(effect.inDays) || effect.inDays < 0) {
        problems.push(`${path}: scheduleEvent inDays must be a non-negative integer`);
      }
      break;

    case 'setTaxRate':
      if (!Number.isFinite(effect.value) || effect.value < 0 || effect.value > 1) {
        problems.push(
          `${path}: setTaxRate value must be a rate between 0 and 1 ` +
            `(received ${effect.value}) — 10% is 0.1, not 10`,
        );
      }
      break;
  }

  return problems;
}
