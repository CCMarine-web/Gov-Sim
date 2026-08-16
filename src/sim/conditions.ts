/**
 * CONDITIONS
 *
 * Evaluates the declarative trigger grammar from DESIGN.md §7.2.
 *
 * WHY DATA RATHER THAN CALLBACKS
 * It is tempting to let an event carry `trigger: (state) => boolean`. That
 * would be shorter to write and would break three things at once: content
 * would stop being serializable, trigger logic would live in src/content/
 * instead of the engine, and — the one players would actually feel — a locked
 * law could no longer explain *why* it is locked. A function can be called but
 * not read. A data structure can be both.
 *
 * That last point is the whole reason `describe()` exists. "Requires the
 * Funding Act of 1790" is generated from the same structure that gates the
 * law, so the explanation cannot drift from the rule. (UI.md §5.5)
 */

import { formatLongDate, isoToDay } from './calendar';
import type { ComparisonOp, Condition, GameState, RegionId } from './types';

// ============================================================================
// PATH RESOLUTION
// ============================================================================

/**
 * Read a numeric stat by dotted path, e.g. "nation.stability".
 *
 * Throws on an unknown or non-numeric path rather than returning undefined.
 * A typo in a content file should fail loudly at validation time, not silently
 * evaluate to `undefined < 50` — which is `false`, and would mean an event
 * simply never fires, with no error anywhere.
 */
export function readStatPath(state: GameState, path: string): number {
  const segments = path.split('.');
  let current: unknown = state;

  for (const segment of segments) {
    if (current === null || typeof current !== 'object') {
      throw new Error(`Cannot read "${path}": "${segment}" is not an object`);
    }
    current = (current as Record<string, unknown>)[segment];
  }

  if (typeof current !== 'number' || !Number.isFinite(current)) {
    throw new Error(
      `Stat path "${path}" did not resolve to a finite number (got ${String(current)}). ` +
        'Check the path against src/sim/types.ts.',
    );
  }

  return current;
}

/** Read a numeric field from a named region, e.g. ("frontier", "sentiment"). */
export function readRegionPath(
  state: GameState,
  regionId: RegionId,
  path: string,
): number {
  const region = state.regions.find((r) => r.id === regionId);
  if (!region) {
    throw new Error(`Unknown region "${regionId}"`);
  }

  const value = (region as unknown as Record<string, unknown>)[path];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `Region path "${regionId}.${path}" did not resolve to a finite number ` +
        `(got ${String(value)}).`,
    );
  }

  return value;
}

function compare(left: number, op: ComparisonOp, right: number): boolean {
  switch (op) {
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    case '==':
      return left === right;
  }
}

// ============================================================================
// EVALUATION
// ============================================================================

/** Does this condition hold in the current state? */
export function evaluate(condition: Condition, state: GameState): boolean {
  switch (condition.kind) {
    case 'dateOnOrAfter':
      return state.day >= isoToDay(condition.date);

    case 'dateBefore':
      return state.day < isoToDay(condition.date);

    case 'stat':
      return compare(
        readStatPath(state, condition.path),
        condition.op,
        condition.value,
      );

    case 'regionStat':
      return compare(
        readRegionPath(state, condition.regionId, condition.path),
        condition.op,
        condition.value,
      );

    case 'flag':
      return state.flags[condition.key] === condition.equals;

    case 'lawEnacted':
      return state.policies.enactedLawIds.includes(condition.lawId);

    case 'eventFired':
      return state.eventState.firedEventIds.includes(condition.eventId);

    case 'optionChosen':
      return state.eventState.chosenOptions[condition.eventId] === condition.optionId;

    case 'governmentType':
      return state.governmentType === condition.is;

    case 'not':
      return !evaluate(condition.of, state);

    case 'all':
      return condition.of.every((c) => evaluate(c, state));

    case 'any':
      return condition.of.some((c) => evaluate(c, state));
  }
}

/** Do all of these conditions hold? An empty list is trivially satisfied. */
export function evaluateAll(
  conditions: readonly Condition[],
  state: GameState,
): boolean {
  return conditions.every((c) => evaluate(c, state));
}

// ============================================================================
// EXPLANATION
// ============================================================================

const OP_WORDS: Record<ComparisonOp, string> = {
  '<': 'below',
  '<=': 'at most',
  '>': 'above',
  '>=': 'at least',
  '==': 'exactly',
};

/** Turn a dotted path into readable words: "nation.stability" -> "stability". */
function humanisePath(path: string): string {
  const last = path.split('.').pop() ?? path;
  return last
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase();
}

function humaniseRegion(regionId: RegionId): string {
  switch (regionId) {
    case 'new_england':
      return 'New England';
    case 'mid_atlantic':
      return 'the Mid-Atlantic';
    case 'south':
      return 'the South';
    case 'frontier':
      return 'the Frontier';
  }
}

/**
 * Render a condition as plain English.
 *
 * This is what a locked law shows the player. It is generated from the same
 * structure that gates the law, so the explanation and the rule cannot drift
 * apart. (UI.md §5.5)
 */
export function describe(condition: Condition): string {
  switch (condition.kind) {
    case 'dateOnOrAfter':
      return `On or after ${formatLongDate(isoToDay(condition.date))}`;

    case 'dateBefore':
      return `Before ${formatLongDate(isoToDay(condition.date))}`;

    case 'stat':
      return `${humanisePath(condition.path)} is ${OP_WORDS[condition.op]} ${condition.value}`;

    case 'regionStat':
      return `${humanisePath(condition.path)} in ${humaniseRegion(condition.regionId)} is ${OP_WORDS[condition.op]} ${condition.value}`;

    case 'flag':
      return `${humanisePath(condition.key)} is ${String(condition.equals)}`;

    case 'lawEnacted':
      return `The law "${condition.lawId}" has been enacted`;

    case 'eventFired':
      return `The event "${condition.eventId}" has occurred`;

    case 'optionChosen':
      return `You chose "${condition.optionId}" during "${condition.eventId}"`;

    case 'governmentType':
      return `Your government is a ${condition.is}`;

    case 'not':
      return `Not: ${describe(condition.of)}`;

    case 'all':
      return condition.of.map(describe).join(' and ');

    case 'any':
      return condition.of.map(describe).join(' or ');
  }
}

/**
 * The conditions that are NOT currently satisfied, in plain English.
 *
 * Exactly what the "why is this locked" panel renders. Returning only the
 * unmet ones matters: listing every requirement including the satisfied ones
 * makes the player hunt for the blocker.
 */
export function describeUnmet(
  conditions: readonly Condition[],
  state: GameState,
): string[] {
  return conditions.filter((c) => !evaluate(c, state)).map(describe);
}

// ============================================================================
// VALIDATION
// ============================================================================

const KNOWN_KINDS = new Set([
  'dateOnOrAfter',
  'dateBefore',
  'stat',
  'regionStat',
  'flag',
  'lawEnacted',
  'eventFired',
  'optionChosen',
  'governmentType',
  'not',
  'all',
  'any',
]);

/**
 * Check a condition tree for structural problems without needing a game state.
 *
 * Run over every content file at build and test time, so a malformed condition
 * is caught by the content validation test (DESIGN.md §15) rather than by a
 * player whose event mysteriously never fires.
 */
export function validateCondition(condition: Condition, path = 'root'): string[] {
  const problems: string[] = [];

  if (!KNOWN_KINDS.has(condition.kind)) {
    problems.push(`${path}: unknown condition kind "${condition.kind}"`);
    return problems;
  }

  switch (condition.kind) {
    case 'dateOnOrAfter':
    case 'dateBefore':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(condition.date)) {
        problems.push(
          `${path}: date "${condition.date}" must be zero-padded ISO (YYYY-MM-DD)`,
        );
      }
      break;

    case 'stat':
    case 'regionStat':
      if (!Number.isFinite(condition.value)) {
        problems.push(`${path}: comparison value must be a finite number`);
      }
      break;

    case 'not':
      problems.push(...validateCondition(condition.of, `${path}.of`));
      break;

    case 'all':
    case 'any':
      if (condition.of.length === 0) {
        problems.push(
          `${path}: "${condition.kind}" has no sub-conditions, which is ` +
            'almost certainly a mistake (it evaluates to a constant)',
        );
      }
      condition.of.forEach((sub, i) => {
        problems.push(...validateCondition(sub, `${path}.of[${i}]`));
      });
      break;
  }

  return problems;
}
