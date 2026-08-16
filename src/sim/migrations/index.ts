/**
 * SAVE MIGRATIONS
 *
 * Implements DESIGN.md Rule 8. On load:
 *
 *   same version              load directly
 *   older, path registered    migrate forward step by step, then load
 *   older, no path            refuse cleanly, naming both versions
 *   newer than this build     refuse cleanly, naming both versions
 *
 * Never crash. Never silently load a broken state. A refusal the player can
 * read and act on is a correct outcome; a half-valid state that appears to
 * load and then misbehaves three hours later is not.
 *
 * Each migration is a pure function `vN -> vN+1`. Adding one means writing the
 * function, registering it here, and committing a fixture save of the old
 * version so the migration test covers it.
 */

import { SCHEMA_VERSION, type GameState } from '../types';
import { v1ToV2 } from './v1ToV2';
import { v2ToV3 } from './v2ToV3';

/** A single forward step. Receives and returns loosely-typed state by design:
 *  the shape it migrates FROM no longer has a TypeScript type in this build. */
export type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

/**
 * Registry of forward migrations, keyed by the version they migrate FROM.
 *
 * Each entry must bump `schemaVersion` — the loop below refuses a step that
 * does not, rather than spinning forever.
 */
export const MIGRATIONS: Record<number, Migration> = {
  /** Three tax rates and three spending lines become instances. (brief §4.3) */
  1: v1ToV2,
  /** Political capital and administrative capacity arrive. (brief §3) */
  2: v2ToV3,
};

export type LoadOutcome =
  | { ok: true; state: GameState; migratedFrom: number | null }
  | { ok: false; reason: string; savedVersion: number; currentVersion: number };

/** Is this plausibly a save at all, before we look at versions? */
function looksLikeGameState(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.schemaVersion === 'number' &&
    typeof record.day === 'number' &&
    typeof record.governmentType === 'string' &&
    typeof record.nation === 'object' &&
    Array.isArray(record.regions)
  );
}

/**
 * Bring a loaded save to the current schema version, or explain why it cannot
 * be done.
 *
 * Returns a result rather than throwing, because "this save is too old" is an
 * ordinary situation the interface has to render, not an exceptional one.
 */
export function migrateToCurrent(raw: unknown): LoadOutcome {
  if (!looksLikeGameState(raw)) {
    return {
      ok: false,
      reason:
        'This file does not look like a saved game. It may be corrupted, or it ' +
        'may be a file from a different application.',
      savedVersion: -1,
      currentVersion: SCHEMA_VERSION,
    };
  }

  const savedVersion = raw.schemaVersion as number;

  if (savedVersion === SCHEMA_VERSION) {
    return { ok: true, state: raw as unknown as GameState, migratedFrom: null };
  }

  if (savedVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      reason:
        `This save was made by a newer version of the game (save format ` +
        `${savedVersion}, this build reads ${SCHEMA_VERSION}). Update the game ` +
        `to open it. Loading it now would risk silently discarding whatever the ` +
        `newer version recorded.`,
      savedVersion,
      currentVersion: SCHEMA_VERSION,
    };
  }

  // Older. Walk forward one version at a time.
  let working = raw;
  let version = savedVersion;

  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) {
      return {
        ok: false,
        reason:
          `This save uses format ${version}, and no upgrade path to format ` +
          `${SCHEMA_VERSION} exists. It cannot be opened by this build.`,
        savedVersion,
        currentVersion: SCHEMA_VERSION,
      };
    }

    working = step(working);
    const next = working.schemaVersion;

    // Guard against a migration that forgets to bump the version, which would
    // otherwise spin here forever.
    if (typeof next !== 'number' || next <= version) {
      return {
        ok: false,
        reason:
          `The upgrade step from format ${version} did not advance the save ` +
          `format. This is a bug in the game, not a problem with your save.`,
        savedVersion,
        currentVersion: SCHEMA_VERSION,
      };
    }

    version = next;
  }

  return { ok: true, state: working as unknown as GameState, migratedFrom: savedVersion };
}

/**
 * Parse a JSON string into a validated, current-version GameState.
 * Malformed JSON is reported the same readable way as a version mismatch.
 */
export function parseSave(json: string): LoadOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      ok: false,
      reason: 'This save could not be read — the file is not valid JSON.',
      savedVersion: -1,
      currentVersion: SCHEMA_VERSION,
    };
  }
  return migrateToCurrent(parsed);
}
