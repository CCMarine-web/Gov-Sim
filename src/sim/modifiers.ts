/**
 * THE MODIFIER LEDGER
 *
 * Implements DESIGN.md Rule 5: nothing mutates a stat directly. Every change
 * flows through a `Modifier`, so the interface can always show exactly which
 * sources are pushing a number up or down and by how much.
 *
 * This is simultaneously the best feature in the game and the only way the
 * economy will ever be debuggable.
 *
 * RESOLUTION ORDER — fixed, and the same everywhere
 *
 *     base
 *       → add all flat modifiers
 *       → apply percentage modifiers
 *       → clamp to the stat's range
 *
 * Percentages are ADDITIVE with each other, not multiplicative: +10% and +15%
 * is +25%, not +26.5%. Multiplicative stacking is more "realistic" and far
 * harder for a player to reason about, and a player who cannot predict the
 * effect of their own decisions is not playing a strategy game.
 *
 * THE INVARIANT
 * For any resolved stat:
 *
 *     base + Σ(contribution.effect) + clampAdjustment === total
 *
 * The breakdown shown in the UI must reconcile exactly to the displayed
 * number. `explainStat` returns the same arithmetic the UI renders, and a test
 * asserts the invariant — so a breakdown that does not add up is a failing
 * test, not a bug report.
 */

import type { Modifier, ModifierSourceType } from './types';

/**
 * Build a deterministic modifier id.
 *
 * Derived from source and target rather than generated, so re-applying the
 * same source is idempotent — a law re-evaluated on a later tick replaces its
 * modifier instead of stacking a second copy. Duplicates become impossible by
 * construction rather than by discipline.
 */
export function makeModifierId(
  sourceType: ModifierSourceType,
  sourceId: string,
  target: string,
): string {
  return `${sourceType}:${sourceId}:${target}`;
}

/**
 * Is this modifier in force on the given day?
 *
 * `startDay` is inclusive, `endDay` is EXCLUSIVE. A modifier created on day 10
 * with a duration of 30 days runs days 10 through 39 and expires on day 40,
 * which keeps duration arithmetic honest: `endDay = startDay + durationDays`.
 * `endDay: null` means permanent.
 */
export function isActiveOn(modifier: Modifier, day: number): boolean {
  if (day < modifier.startDay) return false;
  return modifier.endDay === null || day < modifier.endDay;
}

/** Every modifier in force on `day` that targets `target`. */
export function activeFor(
  modifiers: readonly Modifier[],
  target: string,
  day: number,
): Modifier[] {
  return modifiers.filter((m) => m.target === target && isActiveOn(m, day));
}

// ============================================================================
// RESOLUTION
// ============================================================================

export interface StatContribution {
  modifierId: string;
  source: string;
  sourceType: ModifierSourceType;
  /** The modifier's declared value: a flat amount, or a rate like 0.1 for +10%. */
  value: number;
  isPercentage: boolean;
  /** What this modifier actually added to the total, in the stat's own units. */
  effect: number;
}

export interface StatBreakdown {
  target: string;
  base: number;
  contributions: StatContribution[];
  /** Sum of flat modifiers. */
  flatTotal: number;
  /** Sum of percentage rates, e.g. 0.25 for a net +25%. */
  percentageTotal: number;
  /** Value before clamping. */
  rawTotal: number;
  /**
   * Adjustment applied by clamping, so the breakdown still reconciles.
   * Zero when the value was in range. The UI surfaces this as an explicit
   * line rather than letting the arithmetic silently fail to add up.
   */
  clampAdjustment: number;
  /** The displayed value. */
  total: number;
}

export interface ClampRange {
  min: number;
  max: number;
}

/**
 * Resolve a stat and explain it in full.
 *
 * Returns everything the UI needs for the hover popover (UI.md §7), and the
 * arithmetic it returns is the arithmetic that produced `total`.
 */
export function explainStat(
  target: string,
  base: number,
  modifiers: readonly Modifier[],
  day: number,
  clamp?: ClampRange,
): StatBreakdown {
  const applicable = activeFor(modifiers, target, day);

  let flatTotal = 0;
  let percentageTotal = 0;

  for (const modifier of applicable) {
    if (modifier.isPercentage) {
      percentageTotal += modifier.value;
    } else {
      flatTotal += modifier.value;
    }
  }

  const afterFlat = base + flatTotal;
  const rawTotal = afterFlat * (1 + percentageTotal);

  // Each modifier's real contribution, in the stat's own units. Percentage
  // modifiers act on the post-flat subtotal, which is why they are computed
  // after the flat pass rather than during it.
  const contributions: StatContribution[] = applicable.map((modifier) => ({
    modifierId: modifier.id,
    source: modifier.source,
    sourceType: modifier.sourceType,
    value: modifier.value,
    isPercentage: modifier.isPercentage,
    effect: modifier.isPercentage ? afterFlat * modifier.value : modifier.value,
  }));

  const total = clamp
    ? Math.min(clamp.max, Math.max(clamp.min, rawTotal))
    : rawTotal;

  return {
    target,
    base,
    contributions,
    flatTotal,
    percentageTotal,
    rawTotal,
    clampAdjustment: total - rawTotal,
    total,
  };
}

/**
 * Resolve a stat to its value.
 * Thin wrapper over `explainStat` so the number and its explanation can never
 * be computed by two different code paths and disagree.
 */
export function resolveStat(
  target: string,
  base: number,
  modifiers: readonly Modifier[],
  day: number,
  clamp?: ClampRange,
): number {
  return explainStat(target, base, modifiers, day, clamp).total;
}

// ============================================================================
// LEDGER MAINTENANCE (DESIGN.md Rule 5, "ledger hygiene")
// ============================================================================

/**
 * Add or replace a modifier. Idempotent on `id`.
 *
 * Returns a new array; never mutates the input, consistent with the rest of
 * the engine.
 */
export function upsertModifier(
  modifiers: readonly Modifier[],
  modifier: Modifier,
): Modifier[] {
  const index = modifiers.findIndex((m) => m.id === modifier.id);
  if (index === -1) return [...modifiers, modifier];

  const next = [...modifiers];
  next[index] = modifier;
  return next;
}

/** Add or replace several modifiers at once. */
export function upsertModifiers(
  modifiers: readonly Modifier[],
  incoming: readonly Modifier[],
): Modifier[] {
  return incoming.reduce<Modifier[]>(
    (acc, modifier) => upsertModifier(acc, modifier),
    [...modifiers],
  );
}

/**
 * Remove every modifier originating from a given source.
 * Used when a law is repealed: its permanent modifiers must go with it, or the
 * ledger accumulates effects from laws that are no longer in force.
 */
export function removeModifiersFromSource(
  modifiers: readonly Modifier[],
  sourceType: ModifierSourceType,
  sourceId: string,
): Modifier[] {
  const prefix = `${sourceType}:${sourceId}:`;
  return modifiers.filter((m) => !m.id.startsWith(prefix));
}

/** Remove a single modifier by id. */
export function removeModifier(
  modifiers: readonly Modifier[],
  id: string,
): Modifier[] {
  return modifiers.filter((m) => m.id !== id);
}

/**
 * Drop modifiers that have expired as of `day`.
 *
 * Called every tick. Expired modifiers leave `activeModifiers` so the ledger
 * does not accumulate thousands of dead entries across 4,263 days; their
 * historical record survives in the log, so nothing is lost.
 *
 * Returns both halves so the caller can emit a `modifierExpired` tick effect
 * for anything that just lapsed.
 */
export function expireModifiers(
  modifiers: readonly Modifier[],
  day: number,
): { active: Modifier[]; expired: Modifier[] } {
  const active: Modifier[] = [];
  const expired: Modifier[] = [];

  for (const modifier of modifiers) {
    // Not-yet-started modifiers are retained: they are scheduled, not dead.
    if (modifier.endDay !== null && day >= modifier.endDay) {
      expired.push(modifier);
    } else {
      active.push(modifier);
    }
  }

  return { active, expired };
}

/**
 * Collapse several modifiers from one source onto one target into a single
 * aggregated modifier.
 *
 * A source emits one modifier per target rather than many small ones, so the
 * player's breakdown reads "Whiskey Tax of 1791  −4" instead of six separate
 * lines all naming the same law. (DESIGN.md Rule 5, ledger hygiene)
 */
export function aggregate(
  modifiers: readonly Modifier[],
  sourceType: ModifierSourceType,
  sourceId: string,
  source: string,
  target: string,
  startDay: number,
  endDay: number | null,
): Modifier | null {
  const relevant = modifiers.filter(
    (m) => m.target === target && m.sourceType === sourceType,
  );
  if (relevant.length === 0) return null;

  // Flat and percentage modifiers are not commensurable, so a source emitting
  // both onto one target cannot be collapsed into a single number.
  const anyPercentage = relevant.some((m) => m.isPercentage);
  const anyFlat = relevant.some((m) => !m.isPercentage);
  if (anyPercentage && anyFlat) {
    throw new Error(
      `Cannot aggregate mixed flat and percentage modifiers for ` +
        `${sourceType}:${sourceId} on "${target}". Emit them onto separate ` +
        `targets or keep them separate.`,
    );
  }

  return {
    id: makeModifierId(sourceType, sourceId, target),
    source,
    sourceType,
    target,
    value: relevant.reduce((sum, m) => sum + m.value, 0),
    isPercentage: anyPercentage,
    startDay,
    endDay,
  };
}

/** Every distinct target currently carrying at least one modifier. */
export function modifiedTargets(modifiers: readonly Modifier[]): string[] {
  return [...new Set(modifiers.map((m) => m.target))].sort();
}
