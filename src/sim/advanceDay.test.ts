import { describe, expect, it } from 'vitest';
import { advanceDay } from './advanceDay';
import { PHASE_1_END_DAY, isoToDay } from './calendar';
import { createTestGame } from './createGame';
import { computeCustomsRevenue, computeTradeVolume } from './economy/production';
import type { ContentPack, GameState } from './types';

const EMPTY_CONTENT: ContentPack = { version: 'test', events: [], laws: [] };

/** Run the simulation forward `days` days. */
function run(state: GameState, days: number, content = EMPTY_CONTENT): GameState {
  let current = state;
  for (let i = 0; i < days; i++) {
    current = advanceDay(current, content).state;
  }
  return current;
}

/** Recursively collect every value, for structural assertions. */
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

describe('determinism, per DESIGN.md Rule 2', () => {
  /**
   * The single most valuable test in the suite. It catches nondeterminism the
   * moment it is introduced, rather than months later when a save will not
   * reload. Runs the full Phase 1 span twice from an identical seed.
   */
  it('produces identical state over all 4,263 days of Phase 1', () => {
    const a = run(createTestGame(), PHASE_1_END_DAY);
    const b = run(createTestGame(), PHASE_1_END_DAY);
    expect(a).toEqual(b);
  });

  it('reaches the last day of Phase 1 exactly', () => {
    const end = run(createTestGame(), PHASE_1_END_DAY);
    expect(end.day).toBe(PHASE_1_END_DAY);
    expect(end.day).toBe(4262);
  });

  it('resumes identically after a save/load round trip mid-run', () => {
    const start = createTestGame();
    const reference = run(start, 900);

    const halfway = run(start, 400);
    const revived = JSON.parse(JSON.stringify(halfway)) as GameState;
    const resumed = run(revived, 500);

    expect(resumed).toEqual(reference);
  });

  it('does not mutate the state it is given', () => {
    const state = createTestGame();
    const snapshot = JSON.parse(JSON.stringify(state));
    advanceDay(state, EMPTY_CONTENT);
    expect(state).toEqual(snapshot);
  });
});

describe('serialization after a long run, per DESIGN.md Rule 3', () => {
  const end = run(createTestGame(), PHASE_1_END_DAY);

  it('round-trips through JSON losslessly', () => {
    expect(JSON.parse(JSON.stringify(end))).toEqual(end);
  });

  it('contains no undefined, NaN, or non-finite numbers', () => {
    for (const [path, value] of walk(end)) {
      expect(value, `${path} is undefined`).not.toBeUndefined();
      if (typeof value === 'number') {
        expect(Number.isFinite(value), `${path} is ${value}`).toBe(true);
      }
    }
  });

  it('keeps the state a reasonable size for a save', () => {
    const bytes = JSON.stringify(end).length;
    expect(bytes).toBeLessThan(2_000_000);
  });
});

describe('cadence', () => {
  it('records 140 monthly samples across Phase 1, plus the day-0 sample', () => {
    const end = run(createTestGame(), PHASE_1_END_DAY);
    expect(end.series.days).toHaveLength(141);
  });

  it('recomputes the economy only on the first of the month', () => {
    // Day 0 is 30 April 1789, so day 1 is 1 May: the first recompute.
    const state = createTestGame();
    const afterOne = advanceDay(state, EMPTY_CONTENT);
    expect(afterOne.state.lastEconomyRecomputeDay).toBe(1);

    const afterTwo = advanceDay(afterOne.state, EMPTY_CONTENT);
    expect(afterTwo.state.lastEconomyRecomputeDay).toBe(1); // unchanged on the 2nd
  });

  it('accrues treasury every day, not only monthly', () => {
    const state = createTestGame();
    const day1 = advanceDay(state, EMPTY_CONTENT).state;
    const day2 = advanceDay(day1, EMPTY_CONTENT).state;
    expect(day2.treasury.receiptsYTD.customs).toBeGreaterThan(
      day1.treasury.receiptsYTD.customs,
    );
  });

  it('closes the fiscal year on 1 January', () => {
    const state = run(createTestGame(), isoToDay('1790-01-02'));
    expect(state.treasury.lastYearReceipts).toBeGreaterThan(0);
  });
});

describe('the tariff curve behaves as claimed (ECONOMY.md §7.5)', () => {
  const capacity = 46_581_344;

  it('raising the tariff from 5% to 20% INCREASES customs revenue', () => {
    const low = computeCustomsRevenue(computeTradeVolume(capacity, 0.05), 0.05);
    const high = computeCustomsRevenue(computeTradeVolume(capacity, 0.2), 0.2);
    expect(high).toBeGreaterThan(low);
  });

  it('raising the tariff from 25% to 40% DECREASES customs revenue', () => {
    const peak = computeCustomsRevenue(computeTradeVolume(capacity, 0.25), 0.25);
    const punitive = computeCustomsRevenue(computeTradeVolume(capacity, 0.4), 0.4);
    expect(punitive).toBeLessThan(peak);
  });

  it('peaks at 25%, as the design brief specifies', () => {
    let bestRate = 0;
    let bestRevenue = -Infinity;
    for (let rate = 0; rate <= 0.6001; rate += 0.005) {
      const revenue = computeCustomsRevenue(computeTradeVolume(capacity, rate), rate);
      if (revenue > bestRevenue) {
        bestRevenue = revenue;
        bestRate = rate;
      }
    }
    expect(bestRate).toBeCloseTo(0.25, 2);
  });
});

describe('the excise compliance loop (ECONOMY.md §7.7)', () => {
  /**
   * The Whiskey Rebellion, mechanically. Raising the excise should anger the
   * frontier specifically, and its compliance should fall in consequence.
   */
  it('a heavy excise lowers frontier sentiment more than any other region', () => {
    const base = run(createTestGame(), 365);

    const taxed = createTestGame();
    taxed.policies.taxRates.excise = 0.25;
    const after = run(taxed, 365);

    const frontierDrop =
      base.regions.find((r) => r.id === 'frontier')!.sentiment -
      after.regions.find((r) => r.id === 'frontier')!.sentiment;

    for (const id of ['new_england', 'mid_atlantic', 'south'] as const) {
      const otherDrop =
        base.regions.find((r) => r.id === id)!.sentiment -
        after.regions.find((r) => r.id === id)!.sentiment;
      expect(frontierDrop).toBeGreaterThan(otherDrop);
    }
  });

  it('falling frontier sentiment drags frontier compliance down with it', () => {
    const base = run(createTestGame(), 730);

    const taxed = createTestGame();
    taxed.policies.taxRates.excise = 0.25;
    const after = run(taxed, 730);

    const baseCompliance = base.regions.find((r) => r.id === 'frontier')!.compliance;
    const afterCompliance = after.regions.find((r) => r.id === 'frontier')!.compliance;
    expect(afterCompliance).toBeLessThan(baseCompliance);
  });
});

describe('the founding choice diverges over time (ECONOMY.md §7.15)', () => {
  it('a republic left alone loses legitimacy', () => {
    const start = createTestGame({ governmentType: 'republic' });
    const after = run(start, 730);
    expect(after.nation.legitimacy).toBeLessThan(start.nation.legitimacy);
  });

  /**
   * A monarchy has no DECAY TERM, which is not the same as being immune to
   * outcomes. It still converts prosperity into legitimacy (at a reduced rate),
   * so a monarchy presiding over slowly worsening conditions loses a little
   * legitimacy — which is correct, and is the behaviour we want. The design
   * claim is comparative, so the test is comparative.
   */
  it('a monarchy loses far less legitimacy than a republic over the same span', () => {
    const republicStart = createTestGame({ governmentType: 'republic' });
    const monarchyStart = createTestGame({ governmentType: 'monarchy' });

    const republicLoss =
      republicStart.nation.legitimacy - run(republicStart, 730).nation.legitimacy;
    const monarchyLoss =
      monarchyStart.nation.legitimacy - run(monarchyStart, 730).nation.legitimacy;

    expect(republicLoss).toBeGreaterThan(1);
    expect(monarchyLoss).toBeLessThan(1);
    expect(republicLoss).toBeGreaterThan(monarchyLoss * 5);
  });

  it('a monarchy suffers no decay term, so any drift is outcome-driven only', () => {
    const start = createTestGame({ governmentType: 'monarchy' });
    const after = run(start, 730);
    // Bounded well below the republic's ~4.3 point decay over two years.
    expect(start.nation.legitimacy - after.nation.legitimacy).toBeLessThan(0.5);
  });
});

describe('permanent modifiers do not compound (regression)', () => {
  /**
   * Legitimacy is cumulative rather than target-seeking, so its base and its
   * resolved value are stored separately. Folding the resolved value back into
   * the base would re-add every permanent modifier on every monthly recompute:
   * a single +8 would silently become +8 per month. A played run reached a
   * legitimacy of 94.7 before this was caught.
   */
  it('a permanent legitimacy modifier contributes once, not once per month', () => {
    const state = createTestGame();
    state.activeModifiers = [
      {
        id: 'event:test:nation.legitimacy',
        source: 'Test',
        sourceType: 'event',
        target: 'nation.legitimacy',
        value: 8,
        isPercentage: false,
        startDay: 0,
        endDay: null,
      },
    ];

    const afterOneMonth = run(state, 32);
    const afterTwoYears = run(state, 730);

    // The modifier's contribution is +8 in both cases. Any growth beyond the
    // republic's own decay would mean it is being re-applied.
    const oneMonthGap = afterOneMonth.nation.legitimacy - afterOneMonth.nation.legitimacyBase;
    const twoYearGap = afterTwoYears.nation.legitimacy - afterTwoYears.nation.legitimacyBase;

    expect(oneMonthGap).toBeCloseTo(8, 6);
    expect(twoYearGap).toBeCloseTo(8, 6);
  });

  it('an expiring legitimacy modifier stops contributing when it lapses', () => {
    const state = createTestGame();
    state.activeModifiers = [
      {
        id: 'event:temp:nation.legitimacy',
        source: 'Temporary',
        sourceType: 'event',
        target: 'nation.legitimacy',
        value: 10,
        isPercentage: false,
        startDay: 0,
        endDay: 200,
      },
    ];

    const during = run(state, 100);
    const after = run(state, 400);

    expect(during.nation.legitimacy - during.nation.legitimacyBase).toBeCloseTo(10, 6);
    expect(after.nation.legitimacy - after.nation.legitimacyBase).toBeCloseTo(0, 6);
    expect(after.activeModifiers).toHaveLength(0);
  });
});

describe('effects propagate over months, not instantly (ECONOMY.md §7.1)', () => {
  it('no policy change produces its full effect within a single month', () => {
    const taxed = createTestGame();
    taxed.policies.taxRates.excise = 0.3;

    const afterOneMonth = run(taxed, 31);
    const afterTwoYears = run(taxed, 730);

    const frontierOne = afterOneMonth.regions.find((r) => r.id === 'frontier')!;
    const frontierTwo = afterTwoYears.regions.find((r) => r.id === 'frontier')!;

    // The two-year figure must be materially further from the start than the
    // one-month figure: the response is lagged, not instantaneous.
    const startSentiment = taxed.regions.find((r) => r.id === 'frontier')!.sentiment;
    expect(Math.abs(frontierOne.sentiment - startSentiment)).toBeLessThan(
      Math.abs(frontierTwo.sentiment - startSentiment),
    );
  });
});

describe('the null run lands near real history (ECONOMY.md §10)', () => {
  /**
   * Start a game, change no policy, advance to 31 December 1800. The result
   * should land in the NEIGHBOURHOOD of real history. Tolerances are
   * deliberately wide: the goal is a model that reaches roughly the right
   * region of outcome space unattended, not one overfitted to replay history
   * exactly, which would violate design pillar 3.
   */
  const end = run(createTestGame(), PHASE_1_END_DAY);

  it('population lands within 10% of the verified 1800 census', () => {
    const verified = 5_308_483;
    const ratio = end.nation.population / verified;
    expect(ratio, `population was ${Math.round(end.nation.population)}`).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);
  });

  /**
   * KNOWN GAP - NOMINAL VERSUS REAL. See ECONOMY.md §11.7.
   *
   * The model reaches roughly $268M against a verified 1800 figure of $486M.
   * This is NOT simply a mis-tuned constant. The model has no price level, so
   * it is effectively a constant-dollar series, while the MeasuringWorth
   * benchmark is nominal. The decomposition:
   *
   *   Real 1790 GDP per capita        $49.12
   *   Real 1800 GDP per capita        $91.55   (+6.42%/yr nominal)
   *   Our model, 1800                 ~$49     (flat)
   *
   * Actual REAL per-capita growth in the 1790s was close to zero. Almost all
   * of that 6.42% was price inflation plus the exogenous shipping boom from
   * the European wars after 1793, which the model cannot produce because it
   * has no diplomacy system and no content loaded in this test.
   *
   * So the honest assertion is about per-capita stability, which is what the
   * model actually claims, rather than a nominal total it is structurally
   * unable to reach. Resolving the comparison properly needs a decision on
   * whether to add a price level or to compare in real terms - flagged in
   * ECONOMY.md §11.7 rather than papered over with a wider tolerance.
   */
  it('holds GDP per capita roughly stable, consistent with real 1790s growth', () => {
    const start = createTestGame();
    const startPerCapita = start.nation.gdp / start.nation.population;
    const endPerCapita = end.nation.gdp / end.nation.population;

    expect(endPerCapita / startPerCapita).toBeGreaterThan(0.9);
    expect(endPerCapita / startPerCapita).toBeLessThan(1.2);
  });

  it('grows GDP substantially in absolute terms', () => {
    const start = createTestGame();
    expect(end.nation.gdp).toBeGreaterThan(start.nation.gdp * 1.3);
  });

  it('documents the known nominal-versus-real gap against 1800', () => {
    // Pinned deliberately. If this ratio moves, either the model changed or
    // the gap was addressed - both warrant re-reading ECONOMY.md §11.7.
    const ratio = end.nation.gdp / 486_000_000;
    expect(ratio, `GDP was ${Math.round(end.nation.gdp)}`).toBeGreaterThan(0.45);
    expect(ratio).toBeLessThan(0.7);
  });

  it('keeps stability and legitimacy inside their ranges throughout', () => {
    expect(end.nation.stability).toBeGreaterThanOrEqual(0);
    expect(end.nation.stability).toBeLessThanOrEqual(100);
    expect(end.nation.legitimacy).toBeGreaterThanOrEqual(0);
    expect(end.nation.legitimacy).toBeLessThanOrEqual(100);
  });

  it('keeps every regional sentiment inside its range', () => {
    for (const region of end.regions) {
      expect(region.sentiment, region.id).toBeGreaterThanOrEqual(-100);
      expect(region.sentiment, region.id).toBeLessThanOrEqual(100);
      expect(region.compliance, region.id).toBeGreaterThanOrEqual(0);
      expect(region.compliance, region.id).toBeLessThanOrEqual(100);
    }
  });
});

describe('performance', () => {
  it('runs the full Phase 1 span quickly enough for tests and replay', () => {
    const started = performance.now();
    run(createTestGame(), PHASE_1_END_DAY);
    const elapsed = performance.now() - started;
    expect(elapsed, `took ${Math.round(elapsed)}ms`).toBeLessThan(10_000);
  });
});
