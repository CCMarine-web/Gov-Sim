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

import { EMERGENCY_POWERS_MULTIPLIER } from './calibration';
import { removeModifiersFromSource, upsertModifier } from './modifiers';
import { TAX_BASES, TAX_BASE_IDS, isBaseAvailable } from './taxBases';
import {
  defundProgram,
  findProgram,
  findTax,
  repealTax,
  setTaxRate,
  upsertProgram,
  upsertTax,
} from './taxes';
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
        // Events take effect at once. A treaty signed is a treaty signed; it is
        // BILLS that phase in, because a statute needs officers to carry it out.
        rampDays: 0,
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

    case 'unlockBill': {
      // Unlocking is expressed as a flag so that a bill's `prerequisites` can
      // reference it through the ordinary condition grammar, rather than the
      // engine needing a separate notion of "unlocked".
      return {
        state: {
          ...state,
          flags: { ...state.flags, [`bill_unlocked:${effect.billId}`]: true },
        },
        tickEffects,
      };
    }

    case 'repealBill': {
      // Marks the bill repealed rather than deleting the record, so the run
      // keeps an account of what was passed and when. The tax or programme the
      // bill created is NOT withdrawn here: content repealing a bill through
      // this effect is doing so as a narrative consequence, and repealBill() in
      // bills.ts is the full player-initiated path.
      const bills = state.policies.bills.map((b) =>
        b.billId === effect.billId && b.repealedDay === null
          ? { ...b, repealedDay: context.day }
          : b,
      );

      // A repealed bill's permanent modifiers must go with it, or the ledger
      // keeps applying effects from a law no longer in force.
      const activeModifiers = removeModifiersFromSource(
        state.activeModifiers,
        'law',
        effect.billId,
      );

      return {
        state: {
          ...state,
          policies: { ...state.policies, bills },
          activeModifiers,
        },
        tickEffects,
      };
    }

    // ------------------------------------------------------------------------
    // TAXES AND SPENDING AS INSTANCES (brief §4.3)
    //
    // `setTaxRate` moves a tax that already exists. `enactTax` brings one into
    // being, which is the effect that lets a law create a Treasury line. They
    // are separate on purpose: a rate change and a new statute are different
    // political acts and should read differently in the chronicle.
    // ------------------------------------------------------------------------

    case 'setTaxRate': {
      const tax = findTax(state.policies, effect.taxId);
      if (!tax) {
        // Silently ignoring this would leave a content author wondering why
        // their event did nothing. Content validation catches unknown ids
        // structurally; this is the runtime backstop.
        throw new Error(
          `setTaxRate: no tax with id "${effect.taxId}". ` +
            `Existing: ${state.policies.taxes.map((t) => t.id).join(', ')}`,
        );
      }
      if (tax.repealedDay !== null) {
        // Setting a rate on a repealed tax would look like it worked and raise
        // nothing, which is the worst kind of content bug: silent.
        throw new Error(
          `setTaxRate: "${effect.taxId}" was repealed on day ${tax.repealedDay}. ` +
            'Use enactTax to bring it back, which records a new enactment date.',
        );
      }

      return {
        state: {
          ...state,
          policies: setTaxRate(state.policies, effect.taxId, effect.value),
        },
        tickEffects: [
          ...tickEffects,
          {
            kind: 'taxChanged',
            day: context.day,
            description:
              `${tax.name} set to ${(effect.value * 100).toFixed(1)}% ` +
              `(was ${(tax.rate * 100).toFixed(1)}%)`,
            refs: [effect.taxId],
          },
        ],
      };
    }

    case 'enactTax': {
      const definition = TAX_BASES[effect.base];
      const existing = findTax(state.policies, effect.taxId);

      return {
        state: {
          ...state,
          policies: upsertTax(state.policies, {
            id: effect.taxId,
            name: effect.name,
            // The law that created it, so every dollar it raises is
            // attributable by name. (brief §4.3)
            createdByBillId: context.sourceId,
            base: effect.base,
            rate: effect.rate,
            exemptions: [...effect.exemptions],
            collectionEfficiency:
              effect.collectionEfficiency ?? definition.referenceEfficiency,
            enactedDay: context.day,
            // Re-enacting a repealed tax revives it, which is what "the excise
            // is reimposed" should mean.
            repealedDay: null,
          }),
        },
        tickEffects: [
          ...tickEffects,
          {
            kind: 'taxEnacted',
            day: context.day,
            description: existing
              ? `${effect.name} reimposed at ${(effect.rate * 100).toFixed(1)}%`
              : `${effect.name} laid on ${definition.label.toLowerCase()} at ${(effect.rate * 100).toFixed(1)}%`,
            refs: [effect.taxId],
          },
        ],
      };
    }

    case 'repealTax': {
      const tax = findTax(state.policies, effect.taxId);
      if (!tax) {
        throw new Error(`repealTax: no tax with id "${effect.taxId}"`);
      }

      return {
        state: {
          ...state,
          policies: repealTax(state.policies, effect.taxId, context.day),
        },
        tickEffects: [
          ...tickEffects,
          {
            kind: 'taxRepealed',
            day: context.day,
            description: `${tax.name} repealed`,
            refs: [effect.taxId],
          },
        ],
      };
    }

    case 'fundProgram': {
      return {
        state: {
          ...state,
          policies: upsertProgram(state.policies, {
            id: effect.programId,
            name: effect.name,
            createdByBillId: context.sourceId,
            category: effect.category,
            annualAmount: effect.annualAmount,
            enactedDay: context.day,
            repealedDay: null,
          }),
        },
        tickEffects: [
          ...tickEffects,
          {
            kind: 'programFunded',
            day: context.day,
            description:
              `${effect.name} funded at ` +
              `$${Math.round(effect.annualAmount).toLocaleString('en-US')} a year`,
            refs: [effect.programId],
          },
        ],
      };
    }

    case 'defundProgram': {
      const program = findProgram(state.policies, effect.programId);
      if (!program) {
        throw new Error(`defundProgram: no programme with id "${effect.programId}"`);
      }

      return {
        state: {
          ...state,
          policies: defundProgram(state.policies, effect.programId, context.day),
        },
        tickEffects: [
          ...tickEffects,
          {
            kind: 'programDefunded',
            day: context.day,
            description: `${program.name} defunded`,
            refs: [effect.programId],
          },
        ],
      };
    }

    case 'grantEmergencyPowers': {
      const multiplier = effect.multiplier ?? EMERGENCY_POWERS_MULTIPLIER;

      return {
        state: {
          ...state,
          politicalCapital: {
            ...state.politicalCapital,
            emergency: {
              reason: effect.reason,
              grantedDay: context.day,
              endsDay: context.day + effect.durationDays,
              multiplier,
            },
            /*
              Applied to the live rate and cap immediately rather than waiting
              for the next monthly recompute. Emergency powers granted in
              response to a rebellion that then do nothing for three weeks would
              be worthless exactly when they are needed.
            */
            accrualPerDay: state.politicalCapital.modelTargets.accrual * multiplier,
            cap: state.politicalCapital.modelTargets.cap * multiplier,
          },
        },
        tickEffects: [
          ...tickEffects,
          {
            kind: 'emergencyPowersGranted',
            day: context.day,
            description:
              `Emergency powers granted for ${effect.reason}, ` +
              `for ${effect.durationDays} days`,
            refs: [context.sourceId],
          },
        ],
      };
    }

    case 'politicalCapitalDelta': {
      const pc = state.politicalCapital;
      // Clamped at both ends: never negative, never above the cap. A player
      // cannot be pushed into debt they can only wait out, and a grant cannot
      // route around the ceiling.
      const next = Math.min(pc.cap, Math.max(0, pc.current + effect.amount));
      const actual = next - pc.current;

      return {
        state: {
          ...state,
          politicalCapital: {
            ...pc,
            current: next,
            totalSpent: pc.totalSpent + Math.max(0, -actual),
            totalAccrued: pc.totalAccrued + Math.max(0, actual),
          },
        },
        tickEffects: [
          ...tickEffects,
          {
            kind: 'capitalSpent',
            day: context.day,
            description: `${effect.reason}: ${actual >= 0 ? '+' : ''}${actual.toFixed(1)} political capital`,
            refs: [context.sourceId],
          },
        ],
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
  'unlockBill',
  'repealBill',
  'setTaxRate',
  'enactTax',
  'repealTax',
  'fundProgram',
  'defundProgram',
  'grantEmergencyPowers',
  'politicalCapitalDelta',
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
      if (!effect.taxId) {
        problems.push(`${path}: setTaxRate has no taxId`);
      }
      break;

    case 'enactTax':
      if (!effect.taxId) {
        problems.push(`${path}: enactTax has no taxId`);
      }
      if (!effect.name) {
        problems.push(`${path}: enactTax has no name — Treasury would render a blank row`);
      }
      if (!(effect.base in TAX_BASES)) {
        problems.push(
          `${path}: enactTax names unknown base "${effect.base}". ` +
            `Known: ${TAX_BASE_IDS.join(', ')}`,
        );
      } else if (!isBaseAvailable(effect.base)) {
        // Content must not be able to route around a constitutional bar. If a
        // base is prohibited, no law may levy on it — that is the whole point of
        // marking it prohibited rather than merely discouraged.
        problems.push(
          `${path}: enactTax levies on "${effect.base}", which is prohibited: ` +
            `${TAX_BASES[effect.base].prohibitedBecause}`,
        );
      }
      if (!Number.isFinite(effect.rate) || effect.rate < 0 || effect.rate > 1) {
        problems.push(
          `${path}: enactTax rate must be between 0 and 1 (received ${effect.rate})`,
        );
      }
      if (
        effect.collectionEfficiency !== undefined &&
        (effect.collectionEfficiency <= 0 || effect.collectionEfficiency > 1)
      ) {
        problems.push(
          `${path}: enactTax collectionEfficiency must be in (0, 1] ` +
            `(received ${effect.collectionEfficiency})`,
        );
      }
      break;

    case 'repealTax':
      if (!effect.taxId) problems.push(`${path}: repealTax has no taxId`);
      break;

    case 'fundProgram':
      if (!effect.programId) problems.push(`${path}: fundProgram has no programId`);
      if (!effect.name) problems.push(`${path}: fundProgram has no name`);
      if (!Number.isFinite(effect.annualAmount) || effect.annualAmount < 0) {
        problems.push(`${path}: fundProgram annualAmount must be non-negative`);
      }
      break;

    case 'defundProgram':
      if (!effect.programId) problems.push(`${path}: defundProgram has no programId`);
      break;

    case 'grantEmergencyPowers':
      if (!effect.reason) {
        problems.push(
          `${path}: grantEmergencyPowers has no reason — the chronicle would ` +
            'have to tell the player their government has extraordinary powers ' +
            'for no stated cause',
        );
      }
      if (!Number.isInteger(effect.durationDays) || effect.durationDays <= 0) {
        problems.push(
          `${path}: grantEmergencyPowers durationDays must be a positive integer. ` +
            'Powers with no end are not emergency powers.',
        );
      }
      if (effect.multiplier !== undefined && effect.multiplier <= 1) {
        problems.push(
          `${path}: grantEmergencyPowers multiplier must exceed 1 ` +
            `(received ${effect.multiplier})`,
        );
      }
      break;

    case 'politicalCapitalDelta':
      if (!Number.isFinite(effect.amount)) {
        problems.push(`${path}: politicalCapitalDelta amount must be finite`);
      }
      if (!effect.reason) {
        problems.push(`${path}: politicalCapitalDelta has no reason`);
      }
      break;
  }

  return problems;
}
