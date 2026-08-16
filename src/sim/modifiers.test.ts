import { describe, expect, it } from 'vitest';
import {
  activeFor,
  aggregate,
  expireModifiers,
  explainStat,
  isActiveOn,
  makeModifierId,
  modifiedTargets,
  removeModifier,
  removeModifiersFromSource,
  resolveStat,
  upsertModifier,
  upsertModifiers,
} from './modifiers';
import type { Modifier, ModifierSourceType } from './types';

function mod(overrides: Partial<Modifier> = {}): Modifier {
  const sourceType: ModifierSourceType = overrides.sourceType ?? 'law';
  const target = overrides.target ?? 'nation.stability';
  return {
    id: overrides.id ?? makeModifierId(sourceType, 'test', target),
    source: overrides.source ?? 'Test Source',
    sourceType,
    target,
    value: overrides.value ?? 0,
    isPercentage: overrides.isPercentage ?? false,
    startDay: overrides.startDay ?? 0,
    endDay: overrides.endDay === undefined ? null : overrides.endDay,
    rampDays: 0,
  };
}

describe('deterministic ids', () => {
  it('derives the same id from the same source and target', () => {
    expect(makeModifierId('law', 'funding_act_1790', 'nation.stability')).toBe(
      makeModifierId('law', 'funding_act_1790', 'nation.stability'),
    );
  });

  it('distinguishes different targets from the same source', () => {
    expect(makeModifierId('law', 'x', 'a')).not.toBe(makeModifierId('law', 'x', 'b'));
  });

  it('makes re-application idempotent rather than stacking duplicates', () => {
    const first = mod({ id: 'law:whiskey:nation.stability', value: -4 });
    const again = mod({ id: 'law:whiskey:nation.stability', value: -6 });

    let ledger = upsertModifier([], first);
    ledger = upsertModifier(ledger, again);

    expect(ledger).toHaveLength(1);
    expect(ledger[0].value).toBe(-6);
  });
});

describe('activity windows', () => {
  it('treats startDay as inclusive and endDay as exclusive', () => {
    const m = mod({ startDay: 10, endDay: 40 });
    expect(isActiveOn(m, 9)).toBe(false);
    expect(isActiveOn(m, 10)).toBe(true);
    expect(isActiveOn(m, 39)).toBe(true);
    expect(isActiveOn(m, 40)).toBe(false);
  });

  it('runs for exactly the requested number of days', () => {
    const m = mod({ startDay: 10, endDay: 10 + 30 });
    let days = 0;
    for (let day = 0; day < 100; day++) if (isActiveOn(m, day)) days++;
    expect(days).toBe(30);
  });

  it('treats a null endDay as permanent', () => {
    const m = mod({ startDay: 0, endDay: null });
    expect(isActiveOn(m, 0)).toBe(true);
    expect(isActiveOn(m, 4262)).toBe(true);
  });

  it('selects only modifiers matching the target and the day', () => {
    const ledger = [
      mod({ id: 'a', target: 'nation.stability', startDay: 0, endDay: 100 }),
      mod({ id: 'b', target: 'nation.stability', startDay: 200, endDay: null }),
      mod({ id: 'c', target: 'nation.legitimacy', startDay: 0, endDay: null }),
    ];
    expect(activeFor(ledger, 'nation.stability', 50).map((m) => m.id)).toEqual(['a']);
    expect(activeFor(ledger, 'nation.stability', 250).map((m) => m.id)).toEqual(['b']);
  });
});

describe('resolution order', () => {
  it('adds flat modifiers to the base', () => {
    const ledger = [mod({ id: 'a', value: 6 }), mod({ id: 'b', value: -3 })];
    expect(resolveStat('nation.stability', 50, ledger, 0)).toBe(53);
  });

  it('applies percentages AFTER flat modifiers, not before', () => {
    // base 100, flat +20 -> 120, then +50% -> 180.
    // If percentages applied first it would be 100*1.5 + 20 = 170.
    const ledger = [
      mod({ id: 'flat', value: 20 }),
      mod({ id: 'pct', value: 0.5, isPercentage: true }),
    ];
    expect(resolveStat('nation.stability', 100, ledger, 0)).toBe(180);
  });

  it('stacks percentages additively, not multiplicatively', () => {
    // +10% and +15% is +25%, giving 125 — not 1.10 * 1.15 = 126.5.
    const ledger = [
      mod({ id: 'a', value: 0.1, isPercentage: true }),
      mod({ id: 'b', value: 0.15, isPercentage: true }),
    ];
    expect(resolveStat('nation.stability', 100, ledger, 0)).toBe(125);
  });

  it('handles negative percentages', () => {
    const ledger = [mod({ id: 'a', value: -0.25, isPercentage: true })];
    expect(resolveStat('nation.stability', 80, ledger, 0)).toBe(60);
  });

  it('returns the base when nothing applies', () => {
    expect(resolveStat('nation.stability', 55, [], 0)).toBe(55);
  });

  it('ignores modifiers targeting a different stat', () => {
    const ledger = [mod({ id: 'a', target: 'nation.legitimacy', value: 999 })];
    expect(resolveStat('nation.stability', 50, ledger, 0)).toBe(50);
  });
});

describe('the breakdown invariant', () => {
  /**
   * The property acceptance criterion 4 depends on: the breakdown shown in the
   * UI must reconcile exactly to the displayed number. If this fails, the
   * popover is lying.
   */
  it('base + sum of effects + clamp adjustment equals the total', () => {
    const cases: Array<{ base: number; ledger: Modifier[]; clamp?: { min: number; max: number } }> = [
      { base: 50, ledger: [mod({ id: 'a', value: 8 }), mod({ id: 'b', value: -3 })] },
      {
        base: 100,
        ledger: [
          mod({ id: 'a', value: 20 }),
          mod({ id: 'b', value: 0.1, isPercentage: true }),
          mod({ id: 'c', value: 0.15, isPercentage: true }),
        ],
      },
      {
        base: 90,
        ledger: [mod({ id: 'a', value: 40 })],
        clamp: { min: 0, max: 100 },
      },
      {
        base: 10,
        ledger: [mod({ id: 'a', value: -50 })],
        clamp: { min: 0, max: 100 },
      },
      { base: 0, ledger: [] },
    ];

    for (const { base, ledger, clamp } of cases) {
      const breakdown = explainStat('nation.stability', base, ledger, 0, clamp);
      const summed =
        breakdown.base +
        breakdown.contributions.reduce((acc, c) => acc + c.effect, 0) +
        breakdown.clampAdjustment;
      expect(summed).toBeCloseTo(breakdown.total, 10);
    }
  });

  it('reports each modifier’s real contribution in the stat’s own units', () => {
    // base 100, flat +20 -> 120; a +50% modifier contributes 60, not 0.5.
    const breakdown = explainStat(
      'nation.stability',
      100,
      [mod({ id: 'flat', value: 20 }), mod({ id: 'pct', value: 0.5, isPercentage: true })],
      0,
    );
    const pct = breakdown.contributions.find((c) => c.modifierId === 'pct');
    expect(pct?.effect).toBe(60);
    expect(pct?.value).toBe(0.5);
  });

  it('carries source name and type through for display', () => {
    const breakdown = explainStat(
      'nation.stability',
      50,
      [mod({ id: 'a', source: 'Whiskey Tax of 1791', sourceType: 'law', value: -4 })],
      0,
    );
    expect(breakdown.contributions[0].source).toBe('Whiskey Tax of 1791');
    expect(breakdown.contributions[0].sourceType).toBe('law');
  });

  it('excludes inactive modifiers from the breakdown entirely', () => {
    const breakdown = explainStat(
      'nation.stability',
      50,
      [mod({ id: 'expired', value: 10, startDay: 0, endDay: 5 })],
      100,
    );
    expect(breakdown.contributions).toHaveLength(0);
    expect(breakdown.total).toBe(50);
  });
});

describe('clamping', () => {
  it('clamps to the maximum and records the adjustment', () => {
    const breakdown = explainStat(
      'nation.stability',
      90,
      [mod({ id: 'a', value: 40 })],
      0,
      { min: 0, max: 100 },
    );
    expect(breakdown.rawTotal).toBe(130);
    expect(breakdown.total).toBe(100);
    expect(breakdown.clampAdjustment).toBe(-30);
  });

  it('clamps to the minimum and records the adjustment', () => {
    const breakdown = explainStat('nation.stability', 10, [mod({ id: 'a', value: -50 })], 0, {
      min: 0,
      max: 100,
    });
    expect(breakdown.total).toBe(0);
    expect(breakdown.clampAdjustment).toBe(40);
  });

  it('records a zero adjustment when the value is in range', () => {
    const breakdown = explainStat('nation.stability', 50, [mod({ id: 'a', value: 5 })], 0, {
      min: 0,
      max: 100,
    });
    expect(breakdown.clampAdjustment).toBe(0);
  });

  it('does not clamp when no range is given', () => {
    // Treasury balance is deliberately unclamped: going negative is a real
    // game state (it forces emergency borrowing, ECONOMY.md §7.9), not an
    // error to be floored at zero.
    const ledger = [mod({ id: 'a', target: 'treasury.balance', value: -500 })];
    expect(resolveStat('treasury.balance', 0, ledger, 0)).toBe(-500);
  });
});

describe('ledger maintenance', () => {
  it('expires modifiers whose end day has arrived', () => {
    const ledger = [
      mod({ id: 'permanent', endDay: null }),
      mod({ id: 'running', startDay: 0, endDay: 100 }),
      mod({ id: 'done', startDay: 0, endDay: 50 }),
    ];
    const { active, expired } = expireModifiers(ledger, 50);
    expect(active.map((m) => m.id).sort()).toEqual(['permanent', 'running']);
    expect(expired.map((m) => m.id)).toEqual(['done']);
  });

  it('retains modifiers that have not started yet', () => {
    const { active } = expireModifiers([mod({ id: 'future', startDay: 500, endDay: 600 })], 10);
    expect(active).toHaveLength(1);
  });

  it('does not mutate the input array', () => {
    const ledger = [mod({ id: 'a', endDay: 10 })];
    const snapshot = [...ledger];
    expireModifiers(ledger, 50);
    upsertModifier(ledger, mod({ id: 'b' }));
    removeModifier(ledger, 'a');
    expect(ledger).toEqual(snapshot);
  });

  it('removes every modifier from a repealed source', () => {
    const ledger = [
      mod({ id: makeModifierId('law', 'whiskey', 'nation.stability') }),
      mod({ id: makeModifierId('law', 'whiskey', 'region.frontier.sentiment') }),
      mod({ id: makeModifierId('law', 'funding', 'nation.legitimacy') }),
    ];
    const after = removeModifiersFromSource(ledger, 'law', 'whiskey');
    expect(after).toHaveLength(1);
    expect(after[0].id).toContain('funding');
  });

  it('does not remove a source whose id is a prefix of another', () => {
    const ledger = [
      mod({ id: makeModifierId('law', 'tariff', 'a') }),
      mod({ id: makeModifierId('law', 'tariff_reform', 'b') }),
    ];
    expect(removeModifiersFromSource(ledger, 'law', 'tariff')).toHaveLength(1);
  });

  it('upserts many modifiers at once', () => {
    const ledger = upsertModifiers(
      [mod({ id: 'a', value: 1 })],
      [mod({ id: 'a', value: 99 }), mod({ id: 'b', value: 2 })],
    );
    expect(ledger).toHaveLength(2);
    expect(ledger.find((m) => m.id === 'a')?.value).toBe(99);
  });

  it('lists modified targets, sorted and deduplicated', () => {
    const ledger = [
      mod({ id: '1', target: 'nation.stability' }),
      mod({ id: '2', target: 'nation.legitimacy' }),
      mod({ id: '3', target: 'nation.stability' }),
    ];
    expect(modifiedTargets(ledger)).toEqual(['nation.legitimacy', 'nation.stability']);
  });
});

describe('aggregation', () => {
  it('collapses several flat modifiers from one source into one', () => {
    const ledger = [
      mod({ id: 'a', sourceType: 'law', value: -2 }),
      mod({ id: 'b', sourceType: 'law', value: -1 }),
      mod({ id: 'c', sourceType: 'law', value: -1 }),
    ];
    const result = aggregate(ledger, 'law', 'whiskey', 'Whiskey Tax of 1791', 'nation.stability', 0, null);
    expect(result?.value).toBe(-4);
    expect(result?.id).toBe('law:whiskey:nation.stability');
    expect(result?.source).toBe('Whiskey Tax of 1791');
  });

  it('returns null when there is nothing to aggregate', () => {
    expect(aggregate([], 'law', 'x', 'X', 'nation.stability', 0, null)).toBeNull();
  });

  it('refuses to combine flat and percentage modifiers', () => {
    const ledger = [
      mod({ id: 'a', sourceType: 'law', value: 5 }),
      mod({ id: 'b', sourceType: 'law', value: 0.1, isPercentage: true }),
    ];
    expect(() =>
      aggregate(ledger, 'law', 'x', 'X', 'nation.stability', 0, null),
    ).toThrow(/mixed flat and percentage/);
  });
});

describe('serialization', () => {
  it('modifiers round-trip through JSON losslessly, per DESIGN.md Rule 3', () => {
    const ledger = [
      mod({ id: 'a', value: -4.5, endDay: null }),
      mod({ id: 'b', value: 0.125, isPercentage: true, startDay: 10, endDay: 400 }),
    ];
    expect(JSON.parse(JSON.stringify(ledger))).toEqual(ledger);
  });

  it('produces no NaN or Infinity from ordinary resolution', () => {
    const breakdown = explainStat(
      'nation.gdp',
      193_000_000,
      [mod({ id: 'a', value: 0.05, isPercentage: true })],
      0,
    );
    expect(Number.isFinite(breakdown.total)).toBe(true);
    for (const c of breakdown.contributions) expect(Number.isFinite(c.effect)).toBe(true);
  });
});
