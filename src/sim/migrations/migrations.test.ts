import { describe, expect, it } from 'vitest';
import { createTestGame } from '../createGame';
import { SCHEMA_VERSION } from '../types';
import { MIGRATIONS, migrateToCurrent, parseSave } from './index';

describe('loading a save of the current version', () => {
  it('loads directly, with no migration', () => {
    const state = createTestGame();
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(state)));

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.migratedFrom).toBeNull();
    expect(outcome.state).toEqual(state);
  });

  it('round-trips through a JSON string', () => {
    const state = createTestGame();
    const outcome = parseSave(JSON.stringify(state));

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.state).toEqual(state);
  });
});

describe('refusing rather than crashing', () => {
  /**
   * DESIGN.md Rule 8. Every one of these must produce a readable refusal, not
   * an exception and not a half-loaded state. A save that appears to load and
   * then misbehaves three hours later is far worse than one that declines.
   */

  it('refuses a save from a newer build, naming both versions', () => {
    const state = JSON.parse(JSON.stringify(createTestGame()));
    state.schemaVersion = SCHEMA_VERSION + 5;

    const outcome = migrateToCurrent(state);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;

    expect(outcome.savedVersion).toBe(SCHEMA_VERSION + 5);
    expect(outcome.currentVersion).toBe(SCHEMA_VERSION);
    expect(outcome.reason).toContain(String(SCHEMA_VERSION + 5));
    expect(outcome.reason.toLowerCase()).toContain('newer');
  });

  it('refuses an older save with no registered upgrade path', () => {
    const state = JSON.parse(JSON.stringify(createTestGame()));
    state.schemaVersion = 0;

    const outcome = migrateToCurrent(state);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain('no upgrade path');
  });

  it('refuses something that is not a saved game at all', () => {
    for (const junk of [null, 42, 'hello', [], {}, { schemaVersion: 1 }]) {
      const outcome = migrateToCurrent(junk);
      expect(outcome.ok, JSON.stringify(junk)).toBe(false);
    }
  });

  it('refuses malformed JSON without throwing', () => {
    const outcome = parseSave('{ not json');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain('not valid JSON');
  });

  it('never throws, whatever it is given', () => {
    const inputs: unknown[] = [
      undefined,
      null,
      '',
      '[]',
      '{"schemaVersion":"one"}',
      JSON.stringify({ schemaVersion: 1, day: 'x' }),
    ];
    for (const input of inputs) {
      expect(() =>
        typeof input === 'string' ? parseSave(input) : migrateToCurrent(input),
      ).not.toThrow();
    }
  });

  it('gives every refusal a message written for a person', () => {
    const outcome = migrateToCurrent({ schemaVersion: 99, day: 0, governmentType: 'republic', nation: {}, regions: [] });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    // Not a code, not a stack trace: a sentence.
    expect(outcome.reason.length).toBeGreaterThan(40);
    expect(outcome.reason).toMatch(/[.!]$/);
  });
});

describe('the migration walk', () => {
  /**
   * There are no registered migrations yet, because version 1 is the first
   * released schema. These tests exercise the machinery against temporary
   * registrations so it is known to work before it is first needed for real —
   * which is the only time it can be tested without a real old save.
   */

  it('walks several versions forward in order', () => {
    const calls: number[] = [];
    MIGRATIONS[1] = (s) => {
      calls.push(1);
      return { ...s, schemaVersion: 2, addedInV2: true };
    };
    MIGRATIONS[2] = (s) => {
      calls.push(2);
      return { ...s, schemaVersion: 3, addedInV3: true };
    };

    try {
      const original = { ...JSON.parse(JSON.stringify(createTestGame())), schemaVersion: 1 };
      // Pretend this build reads version 3 by walking manually to it.
      let working: Record<string, unknown> = original;
      let version = 1;
      while (version < 3) {
        working = MIGRATIONS[version](working);
        version = working.schemaVersion as number;
      }

      expect(calls).toEqual([1, 2]);
      expect(working.addedInV2).toBe(true);
      expect(working.addedInV3).toBe(true);
      expect(working.schemaVersion).toBe(3);
    } finally {
      delete MIGRATIONS[1];
      delete MIGRATIONS[2];
    }
  });

  it('refuses a migration that forgets to advance the version, instead of looping forever', () => {
    // A migration that does not bump schemaVersion would otherwise spin the
    // while loop indefinitely and hang the tab.
    MIGRATIONS[0] = (s) => ({ ...s }); // deliberately does not bump

    try {
      const state = { ...JSON.parse(JSON.stringify(createTestGame())), schemaVersion: 0 };
      const outcome = migrateToCurrent(state);

      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.reason).toContain('did not advance');
      expect(outcome.reason).toContain('bug in the game');
    } finally {
      delete MIGRATIONS[0];
    }
  });

  it('reports which version a save was upgraded from', () => {
    MIGRATIONS[0] = (s) => ({ ...s, schemaVersion: SCHEMA_VERSION });

    try {
      const state = { ...JSON.parse(JSON.stringify(createTestGame())), schemaVersion: 0 };
      const outcome = migrateToCurrent(state);

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.migratedFrom).toBe(0);
    } finally {
      delete MIGRATIONS[0];
    }
  });
});

describe('a migrated save is still a valid game state', () => {
  it('survives a full round trip and remains simulable', async () => {
    const { advanceDay } = await import('../advanceDay');
    const state = createTestGame();

    const outcome = parseSave(JSON.stringify(state));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    let resumed = outcome.state;
    for (let i = 0; i < 100; i++) {
      resumed = advanceDay(resumed, { version: 't', events: [], laws: [] }).state;
    }

    expect(resumed.day).toBe(100);
    expect(Number.isFinite(resumed.nation.gdp)).toBe(true);
  });
});
