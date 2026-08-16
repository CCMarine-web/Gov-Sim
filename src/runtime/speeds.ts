/**
 * THE SPEED TABLE
 *
 * The one place clock speeds are defined. Everything else — the loop, the
 * command bar buttons, the keyboard shortcuts, the help sheet — reads from
 * here. Before this file existed the three rates were a formula in the loop
 * plus four independent hard-coded lists that nothing forced to agree.
 *
 * WHY THIS LIVES IN /src/runtime/ AND NOT /src/sim/
 * The simulation has no concept of real time at all. `advanceDay` moves the
 * game on by one day and has no opinion about how long that took (DESIGN.md
 * Rule 1 and Rule 2 — no `Date.now()`, no wall clock, anywhere in the engine).
 * Speeds are a property of the loop that drives the engine, so they belong to
 * the runtime.
 *
 * THE SHAPE OF THE TABLE
 * The authoritative number is `msPerDay`, the real milliseconds one in-game day
 * should take. The loop consumes it directly, and expressing it as an interval
 * rather than a rate keeps the values exact in floating point. `daysPerSecond`
 * is its reciprocal, carried alongside for display and documentation so nobody
 * has to do the division in their head and get it wrong.
 *
 * `msPerDay: null` means UNCAPPED — see `SPEED_UNCAPPED` below.
 */

/** The five clock settings. Also the keyboard keys 1 through 5. */
export type Speed = 1 | 2 | 3 | 4 | 5;

export interface SpeedSetting {
  /** Real milliseconds per in-game day. `null` means uncapped. */
  msPerDay: number | null;
  /** In-game days per real second. `null` means uncapped. */
  daysPerSecond: number | null;
  /** What the button says. */
  label: string;
  /** Shown in the keyboard help and on hover. */
  description: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TABLE
 *
 *   Control   ms/day    days/second   full Phase 1 run (4,263 days)
 *   1x          600         1.67        43 minutes
 *   2x          300         3.33        21 minutes
 *   3x          200         5           14 minutes
 *   4x          100        10            7 minutes
 *   5x       uncapped    unbounded      seconds
 *
 * 3x at 200ms/day is deliberately identical to what Phase 1 shipped as 5x.
 * 600 : 300 : 200 puts the day rates of 1x, 2x and 3x in an exact 1 : 2 : 3
 * ratio, so a control labelled 2x really does run twice as fast as 1x. 4x
 * doubles 3x rather than nudging it — a speed step should be a change you can
 * feel. (docs/DECISIONS.md D-016)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const SPEED_TABLE: Record<Speed, SpeedSetting> = {
  1: {
    msPerDay: 600,
    daysPerSecond: 1000 / 600,
    label: '1x',
    description: 'Slow — about one and two-thirds days a second',
  },
  2: {
    msPerDay: 300,
    daysPerSecond: 1000 / 300,
    label: '2x',
    description: 'Twice 1x — about three and a third days a second',
  },
  3: {
    msPerDay: 200,
    daysPerSecond: 5,
    label: '3x',
    description: 'Five days a second',
  },
  4: {
    msPerDay: 100,
    daysPerSecond: 10,
    label: '4x',
    description: 'Ten days a second',
  },
  5: {
    msPerDay: null,
    daysPerSecond: null,
    label: '5x',
    description: 'Uncapped — as fast as this machine can simulate',
  },
};

/** In control order, for rendering the speed buttons and iterating in tests. */
export const SPEEDS: Speed[] = [1, 2, 3, 4, 5];

/** The uncapped setting, named so the check reads as intent rather than trivia. */
export const SPEED_UNCAPPED: Speed = 5;

export function isUncapped(speed: Speed): boolean {
  return SPEED_TABLE[speed].msPerDay === null;
}

/**
 * Real milliseconds per in-game day at a given speed.
 *
 * Throws for the uncapped setting rather than returning 0 or Infinity: a caller
 * that asks a rate question about a rate-less speed has a bug, and dividing by
 * the answer would produce a silent Infinity rather than a visible error.
 */
export function msPerDayAt(speed: Speed): number {
  const ms = SPEED_TABLE[speed].msPerDay;
  if (ms === null) {
    throw new Error(
      `Speed ${speed} is uncapped and has no fixed ms-per-day. ` +
        'Check isUncapped(speed) before asking.',
    );
  }
  return ms;
}

/**
 * How long a run of `days` in-game days takes in real minutes at this speed.
 * Used by the tests that pin the table's headline consequences, and by the
 * keyboard help.
 */
export function realMinutesFor(speed: Speed, days: number): number | null {
  if (isUncapped(speed)) return null;
  return (days * msPerDayAt(speed)) / 1000 / 60;
}
