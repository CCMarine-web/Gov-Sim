/**
 * POLITICAL CAPITAL
 *
 * Phase 2 brief §3. Four claims the design makes, each of which a test should
 * be able to falsify:
 *
 *   1. It accrues daily, from the sources the brief names, and it caps.
 *   2. Hoarding is not a strategy — capital accrued into a full reserve is lost,
 *      and the game says how much.
 *   3. Emergency powers raise both accrual and cap, and they END.
 *   4. Neither path is strictly better. The monarchy accrues faster and holds
 *      less; the republic accrues slower and can husband more. If that ever
 *      stops being true the balance is wrong, and the brief calls that a defect.
 */

import { describe, expect, it } from 'vitest';
import { advanceDay } from './advanceDay';
import {
  BASE_CAPITAL_CAP,
  EMERGENCY_POWERS_MULTIPLIER,
  MONARCHY_CAPITAL_CAP_FACTOR,
  START,
} from './calibration';
import { createTestGame } from './createGame';
import {
  accrueCapital,
  administrativeCapacityTarget,
  capitalAccrualTarget,
  capitalCapTarget,
  eliteSupport,
} from './economy/politics';
import { applyEffects } from './effects';
import { censusOfOffices, holderOn, officeExists, recordEndDay } from './offices';
import { canAffordPolicy, currentPolicy, enactPolicy, policyCapitalCost } from './policy';
import { OFFICES } from '@/content/government/cabinet';
import { isoToDay } from './calendar';
import {
  FOUNDING_TAX_IDS,
  type ContentPack,
  type GameState,
} from './types';

const EMPTY: ContentPack = { version: 'test', events: [], bills: [], offices: [], parties: [], stateSeats: [] };
const WITH_OFFICES: ContentPack = {
  version: 'offices',
  events: [],
  bills: [],
  offices: OFFICES,
  parties: [],
  stateSeats: [],
};

function run(state: GameState, days: number, content = EMPTY): GameState {
  let current = state;
  for (let i = 0; i < days; i++) current = advanceDay(current, content).state;
  return current;
}

function withRate(state: GameState, taxId: string, rate: number) {
  const p = currentPolicy(state);
  return { ...p, rates: { ...p.rates, [taxId]: rate } };
}

// ============================================================================
// 1. ACCRUAL
// ============================================================================

describe('political capital accrues daily and caps', () => {
  it('starts with enough to pass one substantial budget', () => {
    const state = createTestGame();
    expect(state.politicalCapital.current).toBe(START.politicalCapital);

    // A meaningful first act must be affordable on inauguration day. A founding
    // government that can do nothing for a month is not a playable position.
    const budget = withRate(state, FOUNDING_TAX_IDS.impost, 0.15);
    expect(canAffordPolicy(state, budget).ok).toBe(true);
  });

  it('derives its rate and ceiling at the founding rather than seeding zero', () => {
    const state = createTestGame();
    expect(state.politicalCapital.accrualPerDay).toBeGreaterThan(0);
    expect(state.politicalCapital.cap).toBeGreaterThan(0);
    expect(state.politicalCapital.accrualPerDay).toBe(
      state.politicalCapital.modelTargets.accrual,
    );
  });

  it('grows every single day, not only on the monthly recompute', () => {
    let state = createTestGame();
    const readings: number[] = [state.politicalCapital.current];

    // Days 2 to 6 of May 1789: no month boundary among them.
    for (let i = 0; i < 6; i++) {
      state = advanceDay(state, EMPTY).state;
      readings.push(state.politicalCapital.current);
    }

    for (let i = 1; i < readings.length; i++) {
      expect(readings[i], `day ${i}`).toBeGreaterThan(readings[i - 1]);
    }
  });

  it('stops at the cap and records what was wasted', () => {
    const state = run(createTestGame(), 900);

    expect(state.politicalCapital.current).toBeLessThanOrEqual(
      state.politicalCapital.cap + 1e-9,
    );

    // A run that never spends anything reaches the ceiling and starts wasting.
    // That is the mechanic working: hoarding is not a strategy (brief §3).
    expect(state.politicalCapital.totalWasted).toBeGreaterThan(0);
  });

  it('never accrues past the cap in one step', () => {
    const result = accrueCapital({ current: 89, accrualPerDay: 10, cap: 90 });
    expect(result.current).toBe(90);
    expect(result.accrued).toBe(1);
    expect(result.wasted).toBe(9);
  });

  it('rises with legitimacy', () => {
    const low = capitalAccrualTarget({
      governmentType: 'republic',
      legitimacy: 30,
      stability: 55,
      popularSupport: 10,
      eliteSupport: 10,
      administrativeCapacity: 50,
    });
    const high = capitalAccrualTarget({
      governmentType: 'republic',
      legitimacy: 80,
      stability: 55,
      popularSupport: 10,
      eliteSupport: 10,
      administrativeCapacity: 50,
    });
    expect(high).toBeGreaterThan(low);
  });

  it('rises with the administration that exists to carry out an order', () => {
    const common = {
      governmentType: 'republic' as const,
      legitimacy: 60,
      stability: 55,
      popularSupport: 10,
      eliteSupport: 10,
    };
    expect(
      capitalAccrualTarget({ ...common, administrativeCapacity: 90 }),
    ).toBeGreaterThan(capitalAccrualTarget({ ...common, administrativeCapacity: 0 }));
  });

  it('never goes negative, however badly the government is doing', () => {
    const target = capitalAccrualTarget({
      governmentType: 'republic',
      legitimacy: 0,
      stability: 0,
      popularSupport: -100,
      eliteSupport: -100,
      administrativeCapacity: 0,
    });
    // A government in collapse gains nothing; it does not owe capital. Negative
    // accrual would trap a player permanently, which is the wrong shape for a
    // game with no game-over (DESIGN.md §10).
    expect(target).toBe(0);
  });
});

// ============================================================================
// 2. THE ADMINISTRATION
// ============================================================================

describe('administrative capacity follows the office record', () => {
  it('is zero on inauguration day, because the departments did not exist', () => {
    const state = createTestGame();
    expect(state.nation.administrativeCapacity).toBe(0);

    // Not an assumption: the executive departments were created months later.
    const day0 = 0;
    for (const office of OFFICES) {
      expect(officeExists(office, day0), office.id).toBe(false);
    }
  });

  it('climbs as the departments are created through 1789', () => {
    const treasury = OFFICES.find((o) => o.id === 'treasury')!;

    // The Treasury Department was created on 2 September 1789.
    expect(officeExists(treasury, isoToDay('1789-09-01'))).toBe(false);
    expect(officeExists(treasury, isoToDay('1789-09-02'))).toBe(true);

    const before = censusOfOffices(OFFICES, isoToDay('1789-07-01'));
    const after = censusOfOffices(OFFICES, isoToDay('1790-01-01'));
    expect(after.created).toBeGreaterThan(before.created);
  });

  it('rises over the first year of a run against the real office record', () => {
    const early = run(createTestGame(), 40, WITH_OFFICES);
    const later = run(createTestGame(), 400, WITH_OFFICES);

    expect(early.nation.administrativeCapacity).toBeLessThan(
      later.nation.administrativeCapacity,
    );
    expect(later.nation.administrativeCapacity).toBeGreaterThan(0);
  });

  it('counts a created but vacant office as existing and unstaffed', () => {
    expect(
      administrativeCapacityTarget({
        officesCreated: 4,
        officesFilled: 2,
        officesTotal: 4,
      }),
    ).toBe(50);
  });

  it('does not treat one filled office out of four as a full government', () => {
    expect(
      administrativeCapacityTarget({
        officesCreated: 1,
        officesFilled: 1,
        officesTotal: 4,
      }),
    ).toBe(25);
  });

  /**
   * The content record ends on 31 December 1800. Uncapped speed carries a
   * player past that in seconds, and reading a day beyond every recorded tenure
   * would find every office vacant — collapsing administrative capacity to zero
   * on 1 January 1801 and taking political capital accrual with it, for no
   * reason the player caused. The content running out is a gap in the content,
   * not an event in the game. (BLOCKERS.md B-005)
   */
  it('holds the administration steady past the end of the office record', () => {
    const end = recordEndDay(OFFICES);
    expect(end).not.toBeNull();

    const atEnd = censusOfOffices(OFFICES, end!);
    const wellPast = censusOfOffices(OFFICES, isoToDay('1810-01-01'));

    expect(wellPast).toEqual(atEnd);
    expect(wellPast.filled).toBeGreaterThan(0);
  });

  it('does not collapse political capital accrual in 1801', () => {
    const inPeriod = run(createTestGame(), 4_000, WITH_OFFICES);
    const wellPast = run(createTestGame(), 4_000 + 1_500, WITH_OFFICES);

    expect(wellPast.nation.administrativeCapacity).toBeCloseTo(
      inPeriod.nation.administrativeCapacity,
      6,
    );
    expect(wellPast.politicalCapital.accrualPerDay).toBeGreaterThan(0);
  });

  it('still reports a genuine mid-record vacancy as a vacancy', () => {
    // The clamp must not turn into "the last holder serves forever". A real gap
    // between appointments inside the record is still a gap.
    const treasury = OFFICES.find((o) => o.id === 'treasury')!;
    expect(holderOn(treasury, isoToDay('1789-09-05'))).toBeNull(); // created 2 Sep, Hamilton from 11 Sep
    expect(holderOn(treasury, isoToDay('1789-09-15'))).not.toBeNull();
  });
});

// ============================================================================
// 3. SPENDING
// ============================================================================

describe('spending political capital', () => {
  it('charges for a budget change and deducts it', () => {
    const state = createTestGame();
    const budget = withRate(state, FOUNDING_TAX_IDS.impost, 0.15);
    const cost = policyCapitalCost(state, budget);

    expect(cost).toBeGreaterThan(0);

    const after = enactPolicy(state, budget).state;
    expect(after.politicalCapital.current).toBeCloseTo(
      state.politicalCapital.current - cost,
      6,
    );
    expect(after.politicalCapital.totalSpent).toBeCloseTo(cost, 6);
  });

  it('charges for a cut as well as a rise', () => {
    const state = createTestGame();
    // Legitimacy is charged only on rises (D-001), but capital is charged both
    // ways: lowering a tax still takes a bill through. Together they close the
    // door on rate-oscillation as a strategy.
    const cut = withRate(state, FOUNDING_TAX_IDS.impost, 0.05);
    expect(policyCapitalCost(state, cut)).toBeGreaterThan(0);
  });

  it('charges nothing for a proposal that changes nothing', () => {
    const state = createTestGame();
    expect(policyCapitalCost(state, currentPolicy(state))).toBe(0);
  });

  it('refuses an unaffordable change, and says how long the wait is', () => {
    const state = createTestGame();
    const huge = withRate(state, FOUNDING_TAX_IDS.impost, 0.4);

    const verdict = canAffordPolicy(state, huge);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('political capital');
    // The reason has to be actionable, not just a refusal.
    expect(verdict.reason).toMatch(/day/);
    expect(() => enactPolicy(state, huge)).toThrow(/political capital/);
  });

  it('lets the same change through once enough has accrued', () => {
    const state = createTestGame();
    const change = withRate(state, FOUNDING_TAX_IDS.impost, 0.4);
    expect(canAffordPolicy(state, change).ok).toBe(false);

    const later = run(state, 400);
    expect(canAffordPolicy(later, withRate(later, FOUNDING_TAX_IDS.impost, 0.4)).ok)
      .toBe(true);
  });
});

// ============================================================================
// 4. EMERGENCY POWERS
// ============================================================================

describe('emergency powers', () => {
  function grant(state: GameState, durationDays = 100): GameState {
    return applyEffects(
      state,
      [{ kind: 'grantEmergencyPowers', reason: 'a rebellion', durationDays }],
      { day: state.day, sourceId: 'test_crisis', sourceName: 'Test crisis' },
    ).state;
  }

  it('raises both the accrual rate and the cap', () => {
    const before = run(createTestGame(), 40);
    const after = grant(before);

    expect(after.politicalCapital.accrualPerDay).toBeGreaterThan(
      before.politicalCapital.accrualPerDay,
    );
    expect(after.politicalCapital.cap).toBeGreaterThan(before.politicalCapital.cap);
    expect(after.politicalCapital.cap / before.politicalCapital.cap).toBeCloseTo(
      EMERGENCY_POWERS_MULTIPLIER,
      4,
    );
  });

  it('takes effect immediately rather than at the next monthly recompute', () => {
    // Powers granted in answer to a rebellion that then do nothing for three
    // weeks would be worthless exactly when they are needed.
    const before = run(createTestGame(), 40);
    const after = grant(before);
    expect(after.politicalCapital.accrualPerDay).toBeGreaterThan(
      before.politicalCapital.accrualPerDay,
    );
  });

  it('lapses on schedule, and says so in the chronicle', () => {
    const granted = grant(run(createTestGame(), 40), 60);
    expect(granted.politicalCapital.emergency).not.toBeNull();

    const during = run(granted, 30);
    expect(during.politicalCapital.emergency).not.toBeNull();

    const after = run(granted, 61);
    expect(after.politicalCapital.emergency).toBeNull();

    const entry = after.log.find((l) => l.title === 'Emergency powers lapse');
    expect(entry).toBeDefined();
    expect(entry!.body).toContain('a rebellion');
  });

  it('claws the stock back to the ordinary ceiling when they lapse', () => {
    // Holding crisis-sized reserves after the crisis has passed is exactly the
    // hoarding the cap exists to prevent.
    const granted = grant(run(createTestGame(), 40), 60);
    const hoarded = run(granted, 59);
    const after = run(hoarded, 2);

    expect(after.politicalCapital.current).toBeLessThanOrEqual(
      after.politicalCapital.cap + 1e-9,
    );
  });

  it('is granted by the Whiskey Rebellion, as the Militia Act required', async () => {
    const { PHASE_1_CONTENT } = await import('@/content');
    const event = PHASE_1_CONTENT.events.find((e) => e.id === 'whiskey_rebellion_1794')!;
    const militia = event.options.find((o) => o.id === 'march_the_militia')!;

    expect(
      militia.effects.some((e) => e.kind === 'grantEmergencyPowers'),
    ).toBe(true);
  });
});

// ============================================================================
// 5. THE TWO PATHS, AND WHETHER EITHER IS STRICTLY BETTER
// ============================================================================

describe('neither government type is strictly better', () => {
  it('gives the crown a lower ceiling than the republic', () => {
    const republic = capitalCapTarget({ governmentType: 'republic', legitimacy: 60 });
    const monarchy = capitalCapTarget({ governmentType: 'monarchy', legitimacy: 60 });

    expect(monarchy).toBeLessThan(republic);
    expect(monarchy / republic).toBeCloseTo(MONARCHY_CAPITAL_CAP_FACTOR, 6);
  });

  it('draws the crown’s support from a narrower, wealthier base', () => {
    const regions = [
      { sentiment: 60, prosperity: 80 }, // rich and content
      { sentiment: -60, prosperity: 10 }, // poor and hostile
    ];

    const mean = (60 + -60) / 2;
    // A crown hears from the regions with money in them. That is the source of
    // its stability, and the reason it falls over suddenly when they turn.
    expect(eliteSupport(regions)).toBeGreaterThan(mean);
  });

  it('leaves each path with a real disadvantage, not just a different flavour', () => {
    const republic = createTestGame({ governmentType: 'republic' });
    const monarchy = createTestGame({ governmentType: 'monarchy' });

    const r = run(republic, 400);
    const m = run(monarchy, 400);

    // The republic's higher legitimacy buys it a bigger reserve; the crown's
    // cheaper action (D-001) is its compensation. If the monarchy ever held
    // MORE capital as well as acting more cheaply, it would be strictly better,
    // which the brief calls a defect and would be right to.
    expect(m.politicalCapital.cap).toBeLessThan(r.politicalCapital.cap);
  });

  it('keeps the base cap where the calibration says it is', () => {
    expect(capitalCapTarget({ governmentType: 'republic', legitimacy: 50 })).toBe(
      BASE_CAPITAL_CAP,
    );
  });
});
