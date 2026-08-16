import { describe, expect, it } from 'vitest';
import { advanceDay } from '../advanceDay';
import { createTestGame } from '../createGame';
import { aggregateRate, spendingFor } from '../taxes';
import { SCHEMA_VERSION } from '../types';
import v1Fixture from './fixtures/v1-republic-day900.json';
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
  it('walks several versions forward in order', () => {
    const calls: number[] = [];

    // Save and restore rather than delete: MIGRATIONS[1] is now a REAL
    // registered migration (v1 -> v2), and deleting it in a `finally` would
    // silently disarm the upgrade path for every test that ran afterwards.
    const realOne = MIGRATIONS[1];

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
      MIGRATIONS[1] = realOne;
      delete MIGRATIONS[2];
    }
  });

  it('registers a real path from every released version to the current one', () => {
    // The registry has to be complete, or a player's save from an earlier build
    // is simply refused. This walks the chain rather than trusting it.
    for (let version = 1; version < SCHEMA_VERSION; version++) {
      expect(MIGRATIONS[version], `no migration registered from v${version}`).toBeTypeOf(
        'function',
      );
    }
  });
});

/**
 * THE v1 FIXTURE
 *
 * `fixtures/v1-republic-day900.json` is a real save in the version 1 format,
 * generated once by `scripts/make-v1-fixture.mts` and committed. It is never
 * regenerated: a fixture rebuilt from current code would restate the new format
 * rather than record the old one, and the test would pass by construction.
 *
 * It is taken at day 900 — 16 October 1791 — deliberately, so the whiskey excise
 * of March 1791 has already been enacted and the fixture carries a non-zero
 * excise rate. A fixture with three zero rates would have proved almost nothing.
 */
describe('the v1 fixture upgrades to v2 without losing anything', () => {
  const raw = JSON.parse(JSON.stringify(v1Fixture)) as Record<string, unknown>;

  it('loads, and reports the version it came from', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.migratedFrom).toBe(1);
    expect(outcome.state.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('carries the three tax rates across as three instances, unchanged', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const state = outcome.state;
    const old = (raw.policies as Record<string, Record<string, number>>).taxRates;

    expect(aggregateRate(state.policies, state.day, 'imports')).toBe(old.tariffAvg);
    expect(aggregateRate(state.policies, state.day, 'spirits')).toBe(old.excise);
    expect(aggregateRate(state.policies, state.day, 'land')).toBe(old.landTax);

    // The fixture is worth having precisely because this is not zero.
    expect(old.excise).toBeGreaterThan(0);
  });

  it('carries the three spending lines across as three programmes, unchanged', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const state = outcome.state;
    const old = (raw.policies as Record<string, Record<string, number>>).spending;

    expect(spendingFor(state.policies, state.day, 'military')).toBe(old.military);
    expect(spendingFor(state.policies, state.day, 'civil')).toBe(old.civil);
    expect(spendingFor(state.policies, state.day, 'infrastructure')).toBe(
      old.infrastructure,
    );
  });

  it('drops the old fields rather than keeping a copy that can drift', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const policies = outcome.state.policies as unknown as Record<string, unknown>;
    expect(policies.taxRates).toBeUndefined();
    expect(policies.spending).toBeUndefined();
  });

  it('preserves everything the migration is not about', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const state = outcome.state;
    expect(state.day).toBe(raw.day);
    expect(state.treasury.debtPrincipal).toBe(
      (raw.treasury as Record<string, number>).debtPrincipal,
    );
    expect(state.nation.gdp).toBe((raw.nation as Record<string, number>).gdp);
    expect(state.log.length).toBe((raw.log as unknown[]).length);
    expect(state.activeModifiers.length).toBe((raw.activeModifiers as unknown[]).length);
    expect(state.policies.cumulativeInfrastructure).toBe(
      (raw.policies as Record<string, number>).cumulativeInfrastructure,
    );
  });

  /**
   * THE BEHAVIOUR-PRESERVATION CLAIM.
   *
   * A migrated v1 save must produce the same economy it would have produced
   * under v1. The three founding instances reproduce the three old formulas
   * arithmetically, so a year of simulation from the migrated state should land
   * on the same receipts the old rates would have generated.
   *
   * Asserted against the fixture's OWN recorded run rates rather than against a
   * recomputed expectation, so this catches a drift in either direction.
   */
  it('runs on from the migrated state with the same revenue as before', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    let state = outcome.state;
    for (let i = 0; i < 40; i++) {
      state = advanceDay(state, { version: 't', events: [], laws: [] }).state;
    }

    const before = (raw.treasury as Record<string, Record<string, number>>)
      .annualisedReceipts;
    const after = state.treasury.annualisedReceipts;

    // Within 2%: a month of ordinary drift in compliance and trade capacity
    // moves these a little, and that drift is the model working. A structural
    // regression would move them by far more than that.
    for (const key of ['customs', 'excise', 'land', 'other'] as const) {
      const delta = Math.abs(after[key] - before[key]);
      const scale = Math.max(1, Math.abs(before[key]));
      expect(delta / scale, `${key} moved ${((delta / scale) * 100).toFixed(2)}%`)
        .toBeLessThan(0.02);
    }
  });

  it('rebuilds the attribution lines on the next monthly recompute', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // Empty immediately after migration, because fabricating them would claim
    // to attribute revenue that was never attributed when it was collected.
    expect(outcome.state.treasury.receiptLines).toEqual([]);

    let state = outcome.state;
    for (let i = 0; i < 40; i++) {
      state = advanceDay(state, { version: 't', events: [], laws: [] }).state;
    }

    expect(state.treasury.receiptLines).toHaveLength(3);
    for (const line of state.treasury.receiptLines) {
      expect(line.name.length).toBeGreaterThan(0);
    }
  });

  it('produces a state with no undefined, NaN or non-finite value', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const walk = (value: unknown, path: string): void => {
      expect(value, `${path} is undefined`).not.toBeUndefined();
      if (typeof value === 'number') {
        expect(Number.isFinite(value), `${path} is ${value}`).toBe(true);
      } else if (Array.isArray(value)) {
        value.forEach((v, i) => walk(v, `${path}[${i}]`));
      } else if (value !== null && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
      }
    };

    walk(outcome.state, '$');
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
