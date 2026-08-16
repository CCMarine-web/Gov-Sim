import { describe, expect, it } from 'vitest';
import {
  type RngState,
  chance,
  createRng,
  nextFloat,
  nextInt,
  nextRange,
  pick,
  shuffle,
} from './rng';

/** Draw `count` floats, returning the values and the final state. */
function draw(rng: RngState, count: number): { values: number[]; rng: RngState } {
  const values: number[] = [];
  let current = rng;
  for (let i = 0; i < count; i++) {
    const result = nextFloat(current);
    values.push(result.value);
    current = result.rng;
  }
  return { values, rng: current };
}

describe('determinism', () => {
  it('the same seed produces the same sequence', () => {
    const a = draw(createRng(12345), 500).values;
    const b = draw(createRng(12345), 500).values;
    expect(a).toEqual(b);
  });

  it('different seeds produce different sequences', () => {
    const a = draw(createRng(1), 100).values;
    const b = draw(createRng(2), 100).values;
    expect(a).not.toEqual(b);
  });

  it('normalises the seed so a fractional seed cannot behave differently', () => {
    expect(createRng(42.9).seed).toBe(42);
    expect(draw(createRng(42.9), 20).values).toEqual(draw(createRng(42), 20).values);
  });
});

describe('serialization and resume', () => {
  /**
   * The property that actually matters for saves: stopping mid-run,
   * round-tripping the state through JSON, and resuming must continue the
   * identical sequence. If this fails, a loaded save diverges from the run
   * that produced it.
   */
  it('resumes an identical sequence after a JSON round trip', () => {
    const start = createRng(9876);

    // Reference: 300 draws in one go.
    const reference = draw(start, 300).values;

    // Interrupted: 120 draws, serialize, deserialize, then 180 more.
    const first = draw(start, 120);
    const revived = JSON.parse(JSON.stringify(first.rng)) as RngState;
    const second = draw(revived, 180);

    expect([...first.values, ...second.values]).toEqual(reference);
  });

  it('survives a JSON round trip losslessly', () => {
    const rng = draw(createRng(7), 50).rng;
    expect(JSON.parse(JSON.stringify(rng))).toEqual(rng);
  });

  it('holds only JSON-safe integers, per DESIGN.md Rule 3', () => {
    const rng = draw(createRng(-99999), 250).rng;
    for (const value of [rng.seed, rng.state, rng.calls]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe('purity', () => {
  it('does not mutate the state passed in', () => {
    const original = createRng(555);
    const snapshot = { ...original };
    nextFloat(original);
    nextInt(original, 1, 10);
    shuffle(original, [1, 2, 3, 4, 5]);
    expect(original).toEqual(snapshot);
  });

  it('drawing from the same state twice yields the same value', () => {
    const rng = createRng(31337);
    expect(nextFloat(rng).value).toBe(nextFloat(rng).value);
  });
});

describe('the call counter', () => {
  it('increments once per draw', () => {
    expect(draw(createRng(1), 0).rng.calls).toBe(0);
    expect(draw(createRng(1), 1).rng.calls).toBe(1);
    expect(draw(createRng(1), 1000).rng.calls).toBe(1000);
  });

  it('counts draws made through every helper', () => {
    let rng = createRng(2024);
    rng = nextInt(rng, 1, 6).rng;
    rng = nextRange(rng, 0, 10).rng;
    rng = chance(rng, 0.5).rng;
    rng = pick(rng, ['a', 'b', 'c']).rng;
    expect(rng.calls).toBe(4);
  });

  it('shuffle consumes exactly n-1 draws', () => {
    const rng = shuffle(createRng(5), [1, 2, 3, 4, 5, 6]).rng;
    expect(rng.calls).toBe(5);
  });
});

describe('output ranges', () => {
  it('nextFloat stays within [0, 1)', () => {
    const { values } = draw(createRng(4242), 20_000);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('nextInt is inclusive at both ends and never escapes them', () => {
    let rng = createRng(808);
    const seen = new Set<number>();
    for (let i = 0; i < 20_000; i++) {
      const result = nextInt(rng, 1, 6);
      rng = result.rng;
      expect(result.value).toBeGreaterThanOrEqual(1);
      expect(result.value).toBeLessThanOrEqual(6);
      expect(Number.isInteger(result.value)).toBe(true);
      seen.add(result.value);
    }
    // All six faces should appear over 20,000 rolls.
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('nextInt handles a single-value range', () => {
    expect(nextInt(createRng(1), 5, 5).value).toBe(5);
  });

  it('rejects invalid bounds rather than producing nonsense', () => {
    expect(() => nextInt(createRng(1), 10, 1)).toThrow(/max >= min/);
    expect(() => nextInt(createRng(1), 1.5, 3)).toThrow(/integer bounds/);
  });

  it('chance respects its extremes exactly', () => {
    let rng = createRng(1234);
    for (let i = 0; i < 500; i++) {
      const never = chance(rng, 0);
      const always = chance(rng, 1);
      expect(never.value).toBe(false);
      expect(always.value).toBe(true);
      rng = never.rng;
    }
  });
});

describe('distribution sanity', () => {
  /**
   * Not a rigorous statistical test — just enough to catch a generator that is
   * badly biased or stuck, which would silently distort every probabilistic
   * event in the game.
   */
  it('nextFloat has roughly uniform mean and spread', () => {
    const { values } = draw(createRng(20260815), 50_000);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });

  it('fills all buckets roughly evenly', () => {
    const buckets = new Array<number>(10).fill(0);
    const { values } = draw(createRng(6060), 50_000);
    for (const value of values) buckets[Math.floor(value * 10)]++;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(4_000); // expected 5,000
      expect(count).toBeLessThan(6_000);
    }
  });

  it('does not repeat a value within a short window', () => {
    const { values } = draw(createRng(99), 2_000);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('collection helpers', () => {
  it('pick only ever returns a member of the array', () => {
    const items = ['monarchy', 'republic'] as const;
    let rng = createRng(17);
    for (let i = 0; i < 200; i++) {
      const result = pick(rng, items);
      rng = result.rng;
      expect(items).toContain(result.value);
    }
  });

  it('pick throws on an empty array rather than returning undefined', () => {
    expect(() => pick(createRng(1), [])).toThrow(/empty array/);
  });

  it('shuffle preserves every element and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const frozen = [...input];
    const { value } = shuffle(createRng(31), input);
    expect(input).toEqual(frozen);
    expect([...value].sort((a, b) => a - b)).toEqual(frozen);
  });

  it('shuffle is deterministic for a given seed', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(shuffle(createRng(77), input).value).toEqual(
      shuffle(createRng(77), input).value,
    );
  });
});

describe('no forbidden APIs', () => {
  it('does not call Math.random', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('Math.random() is banned in src/sim/ (DESIGN.md Rule 2)');
    };
    try {
      let rng = createRng(1);
      for (let i = 0; i < 100; i++) rng = nextFloat(rng).rng;
      rng = shuffle(rng, [1, 2, 3]).rng;
      expect(rng.calls).toBe(102);
    } finally {
      Math.random = original;
    }
  });
});
