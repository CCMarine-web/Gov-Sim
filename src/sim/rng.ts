/**
 * SEEDED PSEUDO-RANDOM NUMBER GENERATOR
 *
 * `Math.random()` is banned everywhere in src/sim/ (DESIGN.md Rule 2). It
 * cannot be seeded, so a save could never be replayed to an identical result
 * and a reported bug could never be reproduced.
 *
 * THE INTERFACE IS PURE
 * Every function here takes an `RngState` and returns a NEW one alongside its
 * value. Nothing mutates. That means randomness composes with the rest of the
 * engine, which is also pure, and it means you cannot accidentally consume a
 * random number twice or draw one without the state recording it.
 *
 *     const { value, rng } = nextFloat(state.rng);
 *     // `state.rng` is unchanged; `rng` is the advanced state.
 *
 * WHY THE STATE IS STORED, NOT JUST THE SEED
 * DESIGN.md §13 specifies `seed` and `rngCalls`. Reconstructing the generator
 * from those alone means re-advancing it `rngCalls` times on every load, which
 * is O(n) and grows through a run. We store `state` as well, so resuming is
 * O(1). `seed` is retained for provenance and to reproduce a run from scratch;
 * `calls` is retained as an audit counter the determinism test asserts on.
 *
 * THE ALGORITHM
 * mulberry32. A 32-bit-state generator with good statistical properties for
 * game use, a period of 2^32, and — importantly — it is a handful of integer
 * operations, so it is fast and trivially portable. It is NOT cryptographically
 * secure and must never be used for anything security-related.
 */

export interface RngState {
  /** The original seed. Immutable for the life of a game. */
  readonly seed: number;
  /** Current internal state. A 32-bit integer. */
  readonly state: number;
  /** How many values have been drawn. Audit counter. */
  readonly calls: number;
}

/**
 * Create a generator from a seed.
 *
 * The seed is coerced to a 32-bit integer so that a save round-tripped through
 * JSON produces byte-identical behaviour — a fractional or out-of-range seed
 * would otherwise behave differently after serialization.
 */
export function createRng(seed: number): RngState {
  const normalized = Math.trunc(seed) | 0;
  return { seed: normalized, state: normalized, calls: 0 };
}

/** One step of mulberry32. Pure: state in, state and value out. */
function step(state: number): { nextState: number; value: number } {
  const a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { nextState: a, value };
}

/** Draw a float in [0, 1). */
export function nextFloat(rng: RngState): { value: number; rng: RngState } {
  const { nextState, value } = step(rng.state);
  return {
    value,
    rng: { seed: rng.seed, state: nextState, calls: rng.calls + 1 },
  };
}

/**
 * Draw an integer in [min, max], inclusive at both ends.
 *
 * Inclusive because game code almost always wants "a number from 1 to 6", and
 * an exclusive upper bound is the more common source of off-by-one bugs.
 */
export function nextInt(
  rng: RngState,
  min: number,
  max: number,
): { value: number; rng: RngState } {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error(`nextInt requires integer bounds, received ${min}..${max}`);
  }
  if (max < min) {
    throw new Error(`nextInt requires max >= min, received ${min}..${max}`);
  }
  const { value, rng: advanced } = nextFloat(rng);
  return { value: min + Math.floor(value * (max - min + 1)), rng: advanced };
}

/** Draw a float in [min, max). */
export function nextRange(
  rng: RngState,
  min: number,
  max: number,
): { value: number; rng: RngState } {
  const { value, rng: advanced } = nextFloat(rng);
  return { value: min + value * (max - min), rng: advanced };
}

/**
 * Return true with the given probability (0..1).
 * `chance(rng, 0)` is never true; `chance(rng, 1)` is always true.
 */
export function chance(
  rng: RngState,
  probability: number,
): { value: boolean; rng: RngState } {
  const { value, rng: advanced } = nextFloat(rng);
  return { value: value < probability, rng: advanced };
}

/**
 * Pick one element of a non-empty array.
 * Throws on an empty array rather than returning undefined, because a silent
 * undefined would propagate into game state and surface much later.
 */
export function pick<T>(
  rng: RngState,
  items: readonly T[],
): { value: T; rng: RngState } {
  if (items.length === 0) {
    throw new Error('pick() called with an empty array');
  }
  const { value: index, rng: advanced } = nextInt(rng, 0, items.length - 1);
  return { value: items[index], rng: advanced };
}

/**
 * Return a shuffled copy of an array. Fisher–Yates.
 * Does not mutate the input, consistent with the rest of the engine.
 */
export function shuffle<T>(
  rng: RngState,
  items: readonly T[],
): { value: T[]; rng: RngState } {
  const result = [...items];
  let current = rng;

  for (let i = result.length - 1; i > 0; i--) {
    const { value: j, rng: advanced } = nextInt(current, 0, i);
    current = advanced;
    [result[i], result[j]] = [result[j], result[i]];
  }

  return { value: result, rng: current };
}
