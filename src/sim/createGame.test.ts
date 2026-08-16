import { describe, expect, it } from 'vitest';
import { CENSUS_1790_TOTALS } from '@/content/regions/regions1790';
import { START } from './calibration';
import { createGame, createTestGame, titleFor } from './createGame';
import { computeCustomsRevenue } from './economy/production';
import {
  aggregateRate,
  programsInForce,
  taxesInForce,
  tradeTaxRate,
} from './taxes';
import {
  FOUNDING_TAX_IDS,
  SCHEMA_VERSION,
  type GameState,
} from './types';

/** Recursively collect every value in the state, for structural assertions. */
function walk(value: unknown, path = '$', out: Array<[string, unknown]> = []) {
  out.push([path, value]);
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`, out));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walk(v, `${path}.${k}`, out);
    }
  }
  return out;
}

describe('census figures are reproduced exactly', () => {
  const state = createTestGame();

  it('national population matches the 1790 census total', () => {
    expect(state.nation.population).toBe(CENSUS_1790_TOTALS.population);
    expect(state.nation.population).toBe(3_929_326);
  });

  it('regional populations sum to the national total', () => {
    const summed = state.regions.reduce((s, r) => s + r.population, 0);
    expect(summed).toBe(CENSUS_1790_TOTALS.population);
  });

  it('enslaved population sums to the census total', () => {
    const summed = state.regions.reduce((s, r) => s + r.enslavedPopulation, 0);
    expect(summed).toBe(CENSUS_1790_TOTALS.enslavedPopulation);
    expect(summed).toBe(697_697);
  });

  it('reproduces the regional distribution from the returns', () => {
    const byId = Object.fromEntries(state.regions.map((r) => [r.id, r]));
    expect(byId.new_england.population).toBe(1_009_522);
    expect(byId.mid_atlantic.population).toBe(1_017_726);
    expect(byId.south.population).toBe(1_792_710);
    expect(byId.frontier.population).toBe(109_368);
  });

  it('reproduces the enslaved share of the South, at 35.3%', () => {
    const south = state.regions.find((r) => r.id === 'south');
    expect(south).toBeDefined();
    const share = (south!.enslavedPopulation / south!.population) * 100;
    expect(share).toBeCloseTo(35.3, 1);
  });
});

describe('day-0 economy composes to the verified 1790 figures', () => {
  const state = createTestGame();

  /**
   * The calibration constants were solved so that day-0 output composes to the
   * verified $193M nominal GDP. If a constant is changed without re-solving,
   * this test catches it — which is the point of anchoring to a real figure
   * rather than picking a number that looks plausible.
   */
  it('GDP composes to the verified 1790 figure of $193M', () => {
    expect(state.nation.gdp / 1_000_000).toBeCloseTo(193, 0);
  });

  it('GDP per capita is about $49', () => {
    const perCapita = state.nation.gdp / state.nation.population;
    expect(perCapita).toBeGreaterThan(47);
    expect(perCapita).toBeLessThan(51);
  });

  it('starting debt is the earliest verified Treasury figure', () => {
    expect(state.treasury.debtPrincipal).toBe(71_060_508.5);
  });

  it('customs revenue at the starting tariff is near the real ~$4.4M', () => {
    const customs = computeCustomsRevenue(
      state.nation.tradeVolume,
      tradeTaxRate(state.policies, state.day),
    );
    expect(customs / 1_000_000).toBeGreaterThan(3.8);
    expect(customs / 1_000_000).toBeLessThan(5.0);
  });

  it('treasury starts empty, since the department did not yet exist', () => {
    expect(state.treasury.balance).toBe(0);
  });

  it('levies nothing on spirits or land at the founding', () => {
    // Both instances exist so Treasury has a line for them and an event can
    // raise the rate, but neither is levied: there was no federal excise until
    // March 1791 and no federal direct tax until 1798.
    expect(aggregateRate(state.policies, state.day, 'spirits')).toBe(0);
    expect(aggregateRate(state.policies, state.day, 'land')).toBe(0);
  });

  it('starts with exactly the three founding taxes and three programmes', () => {
    const taxes = taxesInForce(state.policies, state.day);
    expect(taxes.map((t) => t.id).sort()).toEqual(
      [FOUNDING_TAX_IDS.impost, FOUNDING_TAX_IDS.land, FOUNDING_TAX_IDS.spirits].sort(),
    );
    expect(programsInForce(state.policies, state.day)).toHaveLength(3);
  });

  it('attributes no founding tax to a bill, because none was passed', () => {
    for (const tax of state.policies.taxes) {
      expect(tax.createdByBillId, tax.id).toBeNull();
    }
  });

  it('collects the three founding taxes at full efficiency, by design', () => {
    // Their assessed bases were solved against observed revenue, so collection
    // losses are already inside those figures. A second factor would
    // double-count them. (ECONOMY.md §7.8, DECISIONS.md D-018)
    for (const tax of state.policies.taxes) {
      expect(tax.collectionEfficiency, tax.id).toBe(1);
    }
  });

  it('regional output sums to the national totals', () => {
    const ag = state.regions.reduce((s, r) => s + r.agriculturalOutput, 0);
    const man = state.regions.reduce((s, r) => s + r.manufacturingOutput, 0);
    expect(state.nation.agriculturalOutput).toBeCloseTo(ag, 6);
    expect(state.nation.manufacturingOutput).toBeCloseTo(man, 6);
  });

  it('agriculture dominates output in this period', () => {
    expect(state.nation.agriculturalOutput).toBeGreaterThan(
      state.nation.manufacturingOutput * 2,
    );
  });
});

describe('the founding choice produces genuinely different starts', () => {
  const republic = createTestGame({ governmentType: 'republic' });
  const monarchy = createTestGame({
    governmentType: 'monarchy',
    houseName: 'Washington',
  });

  it('assigns the right title', () => {
    expect(titleFor('republic')).toBe('President');
    expect(titleFor('monarchy')).toBe('King');
    expect(republic.ruler.title).toBe('President');
    expect(monarchy.ruler.title).toBe('King');
  });

  it('gives a republic higher starting legitimacy', () => {
    expect(republic.nation.legitimacy).toBe(70);
    expect(monarchy.nation.legitimacy).toBe(50);
    expect(republic.nation.legitimacy).toBeGreaterThan(monarchy.nation.legitimacy);
  });

  it('makes the northern regions hostile to a monarchy', () => {
    for (const id of ['new_england', 'mid_atlantic'] as const) {
      const r = republic.regions.find((x) => x.id === id)!;
      const m = monarchy.regions.find((x) => x.id === id)!;
      expect(m.sentiment).toBeLessThan(r.sentiment);
      expect(m.sentiment).toBeLessThan(0);
    }
  });

  it('makes the South more favourable to a monarchy than to a republic', () => {
    const r = republic.regions.find((x) => x.id === 'south')!;
    const m = monarchy.regions.find((x) => x.id === 'south')!;
    expect(m.sentiment).toBeGreaterThan(r.sentiment);
  });

  it('does not change the economy, only the politics', () => {
    expect(monarchy.nation.gdp).toBe(republic.nation.gdp);
    expect(monarchy.nation.population).toBe(republic.nation.population);
  });
});

describe('regional tax exposure is asymmetric', () => {
  const state = createTestGame();
  const byId = Object.fromEntries(state.regions.map((r) => [r.id, r]));

  it('leaves the frontier far more exposed to excise than anywhere else', () => {
    for (const id of ['new_england', 'mid_atlantic', 'south'] as const) {
      expect(byId.frontier.exciseExposure).toBeGreaterThan(byId[id].exciseExposure * 2);
    }
  });

  it('leaves the frontier barely exposed to the tariff', () => {
    expect(byId.frontier.tariffExposure).toBeLessThan(byId.new_england.tariffExposure);
  });

  it('exposes New England and the South to the tariff', () => {
    expect(byId.new_england.tariffExposure).toBeGreaterThan(1);
    expect(byId.south.tariffExposure).toBeGreaterThan(1);
  });
});

describe('serialization, per DESIGN.md Rule 3', () => {
  const state = createTestGame();

  it('round-trips through JSON losslessly', () => {
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('contains no undefined, NaN, or non-finite numbers', () => {
    for (const [path, value] of walk(state)) {
      expect(value, `${path} is undefined`).not.toBeUndefined();
      if (typeof value === 'number') {
        expect(Number.isFinite(value), `${path} is not finite (${value})`).toBe(true);
      }
    }
  });

  it('contains no Date, Map, Set, or function values', () => {
    for (const [path, value] of walk(state)) {
      expect(value instanceof Date, `${path} is a Date`).toBe(false);
      expect(value instanceof Map, `${path} is a Map`).toBe(false);
      expect(value instanceof Set, `${path} is a Set`).toBe(false);
      expect(typeof value === 'function', `${path} is a function`).toBe(false);
    }
  });

  it('records the current schema version', () => {
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('determinism of creation', () => {
  it('produces identical state for identical options', () => {
    const a = createTestGame();
    const b = createTestGame();
    expect(a).toEqual(b);
  });

  it('takes identifiers as arguments rather than generating them', () => {
    // The engine cannot call Date.now() or generate a uuid, so the caller must
    // supply both. This test documents that contract.
    const state = createGame({
      governmentType: 'republic',
      rulerName: 'A',
      houseName: 'B',
      seed: 1,
      gameId: 'supplied-id',
      createdAtISO: '1789-04-30T00:00:00.000Z',
      contentVersion: 'v1',
    });
    expect(state.gameId).toBe('supplied-id');
    expect(state.createdAtISO).toBe('1789-04-30T00:00:00.000Z');
  });
});

describe('initial bookkeeping', () => {
  const state: GameState = createTestGame();

  it('starts on day 0 with an unused generator', () => {
    expect(state.day).toBe(0);
    expect(state.rng.calls).toBe(0);
    expect(state.rng.seed).toBe(20260815);
  });

  it('starts with an empty ledger and no fired events', () => {
    expect(state.activeModifiers).toEqual([]);
    expect(state.eventState.firedEventIds).toEqual([]);
    expect(state.eventState.pendingDecisions).toEqual([]);
  });

  it('seeds the series with exactly one day-0 sample', () => {
    expect(state.series.days).toEqual([0]);
    expect(state.series.population).toHaveLength(1);
    expect(state.series.gdp).toHaveLength(1);
  });

  it('records the founding in the log', () => {
    expect(state.log).toHaveLength(1);
    expect(state.log[0].day).toBe(0);
    expect(state.log[0].title).toContain('founded');
  });

  it('starts unpaused', () => {
    expect(state.paused).toBe(false);
  });

  it('uses the documented starting tariff', () => {
    expect(aggregateRate(state.policies, state.day, 'imports')).toBe(
      START.tariffRate,
    );
  });
});
