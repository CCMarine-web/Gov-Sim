import { describe, expect, it } from 'vitest';
import { advanceDay, resolveDecision } from '../advanceDay';
import { POWERS } from '@/content/diplomacy/powers';
import { OFFICES } from '@/content/government/cabinet';
import { holderOf } from '../cabinet';
import { driftBlocs } from '../blocs';
import { BLOC_MEMBERSHIP_1790 } from '../calibration';
import { createTestGame } from '../createGame';
import { aggregateRate, spendingFor } from '../taxes';
import { SCHEMA_VERSION } from '../types';
import { PHASE_1_CONTENT } from '@/content';
import v1Fixture from './fixtures/v1-republic-day900.json';
import v2Fixture from './fixtures/v2-republic-day900.json';
import v3Fixture from './fixtures/v3-republic-day900.json';
import v4Fixture from './fixtures/v4-republic-day900.json';
import v5Fixture from './fixtures/v5-republic-day900.json';
import v6Fixture from './fixtures/v6-republic-day900.json';
import v7Fixture from './fixtures/v7-republic-day900.json';
import v8Fixture from './fixtures/v8-republic-day900.json';
import v9Fixture from './fixtures/v9-republic-day900.json';
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
    const realTwo = MIGRATIONS[2];
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
      MIGRATIONS[2] = realTwo;
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
describe('the v1 fixture upgrades to the current version without losing anything', () => {
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
      state = advanceDay(state, { version: 't', events: [], bills: [], offices: [], parties: [], stateSeats: [] }).state;
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
      state = advanceDay(state, { version: 't', events: [], bills: [], offices: [], parties: [], stateSeats: [] }).state;
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

/**
 * THE v2 FIXTURE
 *
 * A real save in the version 2 format — taxes already instances, political
 * capital not yet invented. Generated once by `scripts/make-fixture.mts`, which
 * refuses to overwrite an existing fixture for exactly the reason above.
 */
describe('the v2 fixture gains political capital without losing anything', () => {
  const raw = JSON.parse(JSON.stringify(v2Fixture)) as Record<string, unknown>;

  it('is genuinely a v2 save, with none of the v3 fields', () => {
    // If this ever fails the fixture has been regenerated from current code and
    // stopped testing anything.
    expect(raw.schemaVersion).toBe(2);
    expect(raw.politicalCapital).toBeUndefined();
    expect((raw.nation as Record<string, unknown>).administrativeCapacity).toBeUndefined();
  });

  it('loads, reporting that it came from v2', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.migratedFrom).toBe(2);
    expect(outcome.state.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('seeds a usable reserve rather than punishing the player for saving early', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // The mechanic is new, so its absence in the old save was not the player's
    // choice. Seeding at zero would charge them for that. (v2ToV3.ts)
    expect(outcome.state.politicalCapital.current).toBeGreaterThan(0);
    expect(outcome.state.politicalCapital.emergency).toBeNull();
    expect(outcome.state.politicalCapital.totalSpent).toBe(0);
  });

  it('lets the next monthly recompute set the real rate and ceiling', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    let state = outcome.state;
    expect(state.politicalCapital.accrualPerDay).toBe(0);

    for (let i = 0; i < 40; i++) {
      state = advanceDay(state, PHASE_1_CONTENT).state;
    }

    expect(state.politicalCapital.accrualPerDay).toBeGreaterThan(0);
    expect(state.nation.administrativeCapacity).toBeGreaterThan(0);
  });

  it('keeps the taxes and the economy exactly as the v2 save left them', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const state = outcome.state;
    expect(state.day).toBe(raw.day);
    expect(state.policies.taxes).toEqual(
      (raw.policies as Record<string, unknown>).taxes,
    );
    expect(state.nation.gdp).toBe((raw.nation as Record<string, number>).gdp);
    expect(state.treasury.debtPrincipal).toBe(
      (raw.treasury as Record<string, number>).debtPrincipal,
    );
  });
});

/**
 * THE v3 FIXTURE
 *
 * A real save in the version 3 format: bills were a flat list of enacted law
 * ids, and modifiers had no phase-in ramp. Twelve bills had been passed by day
 * 900, so this fixture actually carries the thing the migration has to convert.
 */
describe('the v3 fixture gains bill records without losing anything', () => {
  const raw = JSON.parse(JSON.stringify(v3Fixture)) as Record<string, unknown>;
  const oldPolicies = raw.policies as Record<string, unknown>;

  it('is genuinely a v3 save, with none of the v4 fields', () => {
    expect(raw.schemaVersion).toBe(3);
    expect(oldPolicies.bills).toBeUndefined();
    expect(Array.isArray(oldPolicies.enactedLawIds)).toBe(true);
    for (const modifier of raw.activeModifiers as Array<Record<string, unknown>>) {
      expect(modifier.rampDays).toBeUndefined();
    }
  });

  it('carries a run with real legislation in it, not an empty one', () => {
    // A fixture from an empty run would test almost nothing.
    expect((oldPolicies.enactedLawIds as string[]).length).toBeGreaterThan(5);
    expect((raw.activeModifiers as unknown[]).length).toBeGreaterThan(5);
  });

  it('turns every enacted law id into a bill record still in force', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const ids = oldPolicies.enactedLawIds as string[];
    expect(outcome.state.policies.bills).toHaveLength(ids.length);

    for (const record of outcome.state.policies.bills) {
      expect(ids).toContain(record.billId);
      expect(record.repealedDay).toBeNull();
      // No enactment day was ever recorded, and there is no way to recover one.
      // The founding is the honest answer; the day the player upgraded would be
      // a fabrication in the game's own record of itself. (v3ToV4.ts)
      expect(record.enactedDay).toBe(0);
      expect(record.sliderValue).toBeNull();
    }
  });

  it('drops the old list rather than keeping a copy that can drift', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const policies = outcome.state.policies as unknown as Record<string, unknown>;
    expect(policies.enactedLawIds).toBeUndefined();
  });

  it('gives every carried-forward modifier a zero ramp, not a retrofitted one', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    for (const modifier of outcome.state.activeModifiers) {
      // They were applied under a build with no phase-in, so they were fully in
      // force. Retro-fitting a ramp would weaken effects the player has already
      // been living with.
      expect(modifier.rampDays, modifier.id).toBe(0);
    }
  });

  it('keeps the taxes, the ledger and the economy as the v3 save left them', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const state = outcome.state;
    expect(state.day).toBe(raw.day);
    expect(state.policies.taxes).toEqual(oldPolicies.taxes);
    expect(state.activeModifiers).toHaveLength(
      (raw.activeModifiers as unknown[]).length,
    );
    expect(state.nation.gdp).toBe((raw.nation as Record<string, number>).gdp);
    expect(state.politicalCapital.current).toBe(
      (raw.politicalCapital as Record<string, number>).current,
    );
  });

  it('runs on from the migrated state without breaking', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    let state = outcome.state;
    for (let i = 0; i < 60; i++) {
      state = advanceDay(state, PHASE_1_CONTENT).state;

      // Answer anything blocking, as a player would. A decision event halts the
      // day it fires (DESIGN.md §6.3), so a loop that ignored them would stall
      // and report the migration as broken when it is the clock behaving.
      while (state.eventState.pendingDecisions.length > 0) {
        const pending = state.eventState.pendingDecisions[0];
        const event = PHASE_1_CONTENT.events.find((e) => e.id === pending.eventId)!;
        state = resolveDecision(
          state,
          PHASE_1_CONTENT,
          pending.eventId,
          event.options[0].id,
        ).state;
      }
    }

    expect(state.day).toBe((raw.day as number) + 60);
    expect(Number.isFinite(state.nation.gdp)).toBe(true);
    expect(Number.isFinite(state.politicalCapital.current)).toBe(true);
  });
});

/**
 * THE v4 FIXTURE
 *
 * A real save in the version 4 format: no grievance, and a ruler who could not
 * die. Twelve bills passed, so the migration has real state to carry forward.
 */
describe('the v4 fixture gains grievance without inventing any', () => {
  const raw = JSON.parse(JSON.stringify(v4Fixture)) as Record<string, unknown>;

  it('is genuinely a v4 save, with none of the v5 fields', () => {
    expect(raw.schemaVersion).toBe(4);
    expect(raw.grievance).toBeUndefined();
    expect((raw.ruler as Record<string, unknown>).reignNumber).toBeUndefined();
  });

  it('starts the country with nothing held against it', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    /*
      Grievance is a record of things the government did to particular blocs,
      and a v4 save contains no such record. Deriving a starting grievance from,
      say, current regional sentiment would invent a history of decrees the
      player never issued and then hold them to it. (v4ToV5.ts)
    */
    for (const level of Object.values(outcome.state.grievance.byBloc)) {
      expect(level).toBe(0);
    }
    for (const level of Object.values(outcome.state.grievance.byRegion)) {
      expect(level).toBe(0);
    }
    expect(outcome.state.grievance.episodes).toEqual([]);
  });

  it('records the ruler as the founder, which is the only thing they can be', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // Every v4 save is still under its founder: there was no way for a ruler to
    // die. Not an assumption — the only thing that could have happened.
    expect(outcome.state.ruler.reignNumber).toBe(0);
    expect(outcome.state.ruler.accededDay).toBe(0);
    expect(outcome.state.ruler.name).toBe(
      (raw.ruler as Record<string, string>).name,
    );
  });

  it('keeps the bills, taxes and ledger the v4 save left', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const old = raw.policies as Record<string, unknown>;
    expect(outcome.state.policies.bills).toEqual(old.bills);
    expect(outcome.state.policies.taxes).toEqual(old.taxes);
    expect(outcome.state.activeModifiers).toEqual(raw.activeModifiers);
  });

  it('runs on without breaking', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    let state = outcome.state;
    for (let i = 0; i < 60; i++) {
      state = advanceDay(state, PHASE_1_CONTENT).state;
      while (state.eventState.pendingDecisions.length > 0) {
        const pending = state.eventState.pendingDecisions[0];
        const event = PHASE_1_CONTENT.events.find((e) => e.id === pending.eventId)!;
        state = resolveDecision(
          state,
          PHASE_1_CONTENT,
          pending.eventId,
          event.options[0].id,
        ).state;
      }
    }

    expect(state.day).toBe((raw.day as number) + 60);
    expect(Number.isFinite(state.nation.gdp)).toBe(true);
  });
});

/**
 * THE v5 FIXTURE
 *
 * A real save in the version 5 format, at day 900 — 16 October 1791, inside the
 * Second Congress. There was no legislature in v5, so the migration has to build
 * one, and it has to build the RIGHT one: seated for the day the save is on, not
 * for day zero.
 */
describe('the v5 fixture gains a Congress seated for its own date', () => {
  const raw = JSON.parse(JSON.stringify(v5Fixture)) as Record<string, unknown>;

  it('is genuinely a v5 save, with no Congress in it', () => {
    expect(raw.schemaVersion).toBe(5);
    expect(raw.congress).toBeUndefined();
    // And it carries real state for the migration to preserve.
    expect((raw.policies as Record<string, unknown[]>).bills.length).toBeGreaterThan(5);
  });

  it('seats the Congress that was actually sitting on the save’s date', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // Day 900 is 16 October 1791: the Second Congress, which convened on
    // 4 March 1791. Seating the First would put the country back two years.
    expect(outcome.state.congress.number).toBe(2);
    expect(outcome.state.congress.delegations.length).toBeGreaterThan(10);
  });

  it('includes the states admitted by that date, and not the ones after it', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const codes = outcome.state.congress.delegations.map((d) => d.stateCode);
    // Vermont was admitted 4 March 1791, before this save's date.
    expect(codes).toContain('VT');
    // Kentucky in June 1792 and Tennessee in 1796 were not.
    expect(codes).not.toContain('KY');
    expect(codes).not.toContain('TN');
  });

  it('seats the interests of 1791, not the parties of 1793', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const shares = Object.keys(outcome.state.congress.delegations[0].share);
    expect(shares).toContain('pro_administration');
    expect(shares).not.toContain('federalist');
  });

  it('starts with no votes lost and no promises made', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // A v5 save records no votes, because there were none — every bill in it
    // passed by the player's own hand. Inventing a legislative history would be
    // inventing defeats the player never suffered.
    expect(outcome.state.congress.defeats).toBe(0);
    expect(outcome.state.congress.cooldowns).toEqual({});
    expect(outcome.state.congress.obligations).toEqual([]);
  });

  it('keeps everything the migration is not about', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.state.day).toBe(raw.day);
    expect(outcome.state.policies.bills).toEqual(
      (raw.policies as Record<string, unknown>).bills,
    );
    expect(outcome.state.grievance).toEqual(raw.grievance);
    expect(outcome.state.ruler).toEqual(raw.ruler);
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
      resumed = advanceDay(resumed, { version: 't', events: [], bills: [], offices: [], parties: [], stateSeats: [] }).state;
    }

    expect(resumed.day).toBe(100);
    expect(Number.isFinite(resumed.nation.gdp)).toBe(true);
  });
});

/**
 * THE v6 FIXTURE
 *
 * A real save in the version 6 format, at day 900 — 16 October 1791. Blocs were
 * a static table in v6 and could not move, so the migration has to give the save
 * a country that CAN change, without inventing a decade of change it never had.
 * (DECISIONS.md D-035)
 */
describe('the v6 fixture gains a country that can change', () => {
  const raw = JSON.parse(JSON.stringify(v6Fixture)) as Record<string, unknown>;

  it('is genuinely a v6 save, with no bloc state in it', () => {
    expect(raw.schemaVersion).toBe(6);
    expect(raw.blocs).toBeUndefined();
    // And it carries a Congress, so v6 is what it says it is.
    expect(raw.congress).toBeDefined();
  });

  it('seeds the founding shares rather than inventing a history', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    /*
      A v6 save records no bloc movement, because blocs could not move. Deriving
      shares from the save's current economy would invent occupational change the
      player never caused and then present it as their record — the same
      reasoning that seeds grievance empty in v4ToV5.
    */
    for (const region of outcome.state.regions) {
      const seeded = BLOC_MEMBERSHIP_1790[region.id];
      expect(outcome.state.blocs.membership[region.id], region.id).toEqual(seeded);
    }
  });

  it('measures the future against the save’s own economy, not against 1789', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    /*
      The denominators must be the save's CURRENT economy. Measuring a 1791 save
      against 1789 figures it does not contain is impossible; measuring it
      against itself declares its present to be its baseline, so it behaves like
      a game begun on its own date. The observable consequence is that nothing
      lurches on the first tick after loading.
    */
    for (const region of outcome.state.regions) {
      const base = outcome.state.blocs.baseDrivers[region.id];
      expect(base, region.id).toBeDefined();
      expect(base.tradePerHead).toBeCloseTo(region.tradeVolume / region.population, 9);
      expect(base.population).toBeCloseTo(region.population, 6);
      // Every driver has to be usable as a denominator.
      for (const value of Object.values(base)) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it('does not lurch on the first month after loading', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const before = JSON.parse(JSON.stringify(outcome.state.blocs.membership));
    const drifted = driftBlocs(outcome.state);

    for (const regionId of Object.keys(before)) {
      for (const bloc of Object.keys(before[regionId])) {
        // The save's present is its baseline, so the first drift has nothing to
        // move toward and moves nowhere.
        expect(drifted.membership[regionId][bloc], `${regionId}/${bloc}`).toBeCloseTo(
          before[regionId][bloc],
          9,
        );
      }
    }
  });

  it('keeps everything the migration is not about', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.state.day).toBe(raw.day);
    expect(outcome.state.congress).toEqual(raw.congress);
    expect(outcome.state.grievance).toEqual(raw.grievance);
  });
});

/**
 * THE v7 FIXTURE
 *
 * A real save in the version 7 format, at day 900 — 16 October 1791. There was
 * no diplomacy in v7 at all, so the migration has to give the save a world, and
 * it has to give it the RIGHT one: the world of 1789, with nothing signed.
 * (DECISIONS.md D-044)
 */
describe('the v7 fixture gains a world it has not yet acted in', () => {
  const raw = JSON.parse(JSON.stringify(v7Fixture)) as Record<string, unknown>;

  it('is genuinely a v7 save, with no diplomacy in it', () => {
    expect(raw.schemaVersion).toBe(7);
    expect(raw.diplomacy).toBeUndefined();
    // And it carries bloc state, so v7 is what it says it is.
    expect(raw.blocs).toBeDefined();
  });

  it('starts every relation at its 1789 baseline', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    for (const power of POWERS) {
      expect(
        outcome.state.diplomacy.relations[power.id].relation,
        power.id,
      ).toBe(power.startingRelation);
    }
  });

  it('signs nothing on the player’s behalf', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    /*
      A v7 save from 1791 has no diplomatic history because it could not have
      one. Awarding it the treaties that were historically signed by its date
      would credit the player with achievements they never had the opportunity
      to attempt — worse than inventing a relation, because it is inventing an
      accomplishment.
    */
    expect(outcome.state.diplomacy.treaties).toEqual([]);
    expect(outcome.state.diplomacy.tributeDue).toEqual([]);
  });

  it('keeps everything the migration is not about', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.state.day).toBe(raw.day);
    expect(outcome.state.blocs).toEqual(raw.blocs);
    expect(outcome.state.congress).toEqual(raw.congress);
    expect(outcome.state.grievance).toEqual(raw.grievance);
  });

  it('produces a state that still simulates', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    let state = outcome.state;
    for (let i = 0; i < 40; i++) {
      state = advanceDay(state, PHASE_1_CONTENT).state;
      while (state.eventState.pendingDecisions.length > 0) {
        const pending = state.eventState.pendingDecisions[0];
        const event = PHASE_1_CONTENT.events.find((e) => e.id === pending.eventId)!;
        state = resolveDecision(
          state,
          PHASE_1_CONTENT,
          pending.eventId,
          event.options[0].id,
        ).state;
      }
    }

    expect(Number.isFinite(state.nation.gdp)).toBe(true);
    expect(Object.keys(state.diplomacy.relations).length).toBe(POWERS.length);
  });
});

/**
 * THE v8 FIXTURE
 *
 * A real save in the version 8 format, at day 900. Diplomacy existed in v8 but
 * no war could be declared, so `wars` did not exist. The smallest migration in
 * the project, and it is still a migration: a save written under v8 is a real
 * save that a real person may hold.
 */
describe('the v8 fixture gains a record of wars it never fought', () => {
  const raw = JSON.parse(JSON.stringify(v8Fixture)) as Record<string, unknown>;

  it('is genuinely a v8 save, with diplomacy but no wars', () => {
    expect(raw.schemaVersion).toBe(8);
    const diplomacy = raw.diplomacy as Record<string, unknown>;
    expect(diplomacy).toBeDefined();
    expect(diplomacy.wars).toBeUndefined();
    expect(diplomacy.relations).toBeDefined();
  });

  it('starts with no wars, because it could not have had any', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.state.diplomacy.wars).toEqual([]);
    for (const relation of Object.values(outcome.state.diplomacy.relations)) {
      expect(relation.atWar).toBe(false);
    }
  });

  it('keeps the relations and treaties it already had', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const before = raw.diplomacy as Record<string, unknown>;
    expect(outcome.state.diplomacy.relations).toEqual(before.relations);
    expect(outcome.state.diplomacy.treaties).toEqual(before.treaties);
    expect(outcome.state.diplomacy.tributeDue).toEqual(before.tributeDue);
  });
});

/**
 * THE v9 FIXTURE
 *
 * A real save in the version 9 format, at day 900. The cabinet was the
 * historical one in v9 and could not be appointed, so `cabinet` did not exist.
 *
 * This is the rare migration that is behaviour-preserving BY CONSTRUCTION:
 * `appointments` holds only what the player has done, and every office without
 * an entry falls back to the historical record — which is exactly how a v9 save
 * already behaved. (DECISIONS.md D-050)
 */
describe('the v9 fixture keeps the cabinet history gave it', () => {
  const raw = JSON.parse(JSON.stringify(v9Fixture)) as Record<string, unknown>;

  it('is genuinely a v9 save, with no cabinet state', () => {
    expect(raw.schemaVersion).toBe(9);
    expect(raw.cabinet).toBeUndefined();
    // And it carries the war record, so v9 is what it says it is.
    expect((raw.diplomacy as Record<string, unknown>).wars).toBeDefined();
  });

  it('adds an empty cabinet, which is the same cabinet it had', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.state.cabinet.appointments).toEqual({});
    expect(outcome.state.cabinet.resignations).toEqual([]);
  });

  it('still has the historical officers in post', () => {
    const outcome = migrateToCurrent(JSON.parse(JSON.stringify(raw)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    /*
      Day 900 is 16 October 1791: Hamilton at the Treasury. An empty
      appointments map does not mean an empty government — the fallback is what
      makes this migration lossless rather than merely small.
    */
    const treasury = OFFICES.find((o) => o.id === 'treasury')!;
    const holder = holderOf(outcome.state, treasury);

    expect(holder).not.toBeNull();
    expect(holder!.name).toBe('Alexander Hamilton');
    expect(holder!.appointed).toBe(false);
  });
});
