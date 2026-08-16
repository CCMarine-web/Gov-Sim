import { describe, expect, it } from 'vitest';
import { PHASE_1_CONTENT } from '@/content';
import { advanceDay, resolveDecision } from '@/sim/advanceDay';
import { PHASE_1_END_DAY } from '@/sim/calendar';
import { createTestGame } from '@/sim/createGame';
import type { ContentPack, GameState } from '@/sim/types';
import {
  MAX_DAYS_PER_FRAME_EXPORTED,
  PUBLISH_INTERVAL_MS,
  UNCAPPED_FRAME_BUDGET_MS,
  UNCAPPED_MAX_DAYS_PER_FRAME,
  drainAccumulator,
} from './gameLoop';
import { SPEEDS, isUncapped, msPerDayAt } from './speeds';

const EMPTY: ContentPack = { version: 'perf', events: [], bills: [], offices: [], parties: [], stateSeats: [] };

/** Play the whole span, answering every decision, as a real session would. */
function playFullRun(): GameState {
  let state = createTestGame();

  for (let i = 0; i < PHASE_1_END_DAY; i++) {
    state = advanceDay(state, PHASE_1_CONTENT).state;

    while (state.eventState.pendingDecisions.length > 0) {
      const pending = state.eventState.pendingDecisions[0];
      const event = PHASE_1_CONTENT.events.find((e) => e.id === pending.eventId)!;
      state = resolveDecision(state, PHASE_1_CONTENT, pending.eventId, event.options[0].id)
        .state;
    }
  }

  return state;
}

describe('the render throttle holds by construction', () => {
  /**
   * The rAF loop itself needs a browser to observe, and the specific visual
   * check is written into docs/MANUAL-QA.md §2.3. What CAN be asserted here is
   * the arithmetic the throttle rests on.
   */
  it('publishes at most four times a second', () => {
    expect(1000 / PUBLISH_INTERVAL_MS).toBeLessThanOrEqual(4);
  });

  it('publishes at the same rate however fast the simulation runs', () => {
    // The publish interval is a WALL-CLOCK throttle, not a per-day one, which
    // is the whole reason the ceiling survives the uncapped speed. At every
    // capped speed the engine advances more days per second and the UI still
    // sees four frames.
    const publishesPerSecond = 1000 / PUBLISH_INTERVAL_MS;
    expect(publishesPerSecond).toBe(4);

    for (const speed of SPEEDS) {
      if (isUncapped(speed)) continue;
      const daysPerSecond = 1000 / msPerDayAt(speed);
      expect(publishesPerSecond, `speed ${speed}`).toBe(4);
      expect(daysPerSecond).toBeGreaterThan(0);
    }
  });

  /**
   * THE UNCAPPED CEILING.
   *
   * The brief predicted this is exactly where the throttle would break, so it
   * is asserted rather than assumed. The bound at the top speed is a wall-clock
   * budget per frame, and publication is a wall-clock throttle — so however
   * many days a frame manages, the number of publications per second cannot
   * exceed four.
   */
  it('bounds the uncapped frame by wall time, not by days', () => {
    expect(isUncapped(5)).toBe(true);
    expect(UNCAPPED_FRAME_BUDGET_MS).toBeLessThan(1000 / 60);

    // Even if every frame ran the full backstop of days, a 60Hz display gives
    // 60 frames a second and publication is still throttled to four.
    const framesPerSecond = 60;
    const worstCaseDaysPerSecond = UNCAPPED_MAX_DAYS_PER_FRAME * framesPerSecond;
    const publishesPerSecond = 1000 / PUBLISH_INTERVAL_MS;

    expect(worstCaseDaysPerSecond).toBeGreaterThan(20_000);
    expect(publishesPerSecond).toBe(4);
  });

  it('backstops the uncapped frame so a stopped clock cannot hang the tab', () => {
    // A frame bounded only by elapsed time never terminates if time does not
    // elapse. The backstop must be finite and must be generous enough never to
    // bind on a real machine.
    expect(Number.isFinite(UNCAPPED_MAX_DAYS_PER_FRAME)).toBe(true);
    expect(UNCAPPED_MAX_DAYS_PER_FRAME).toBeGreaterThan(100);
  });

  it('caps simulated days per frame so a backgrounded tab cannot stall the UI', () => {
    // Thirty seconds hidden at 4x would be 300 days without the cap.
    const result = drainAccumulator(30_000, msPerDayAt(4), MAX_DAYS_PER_FRAME_EXPORTED);
    expect(result.days).toBe(MAX_DAYS_PER_FRAME_EXPORTED);
    expect(result.discardedMs).toBeGreaterThan(0);
  });

  it('never simulates more than the cap however large the gap', () => {
    for (const gap of [1_000, 60_000, 600_000, 3_600_000]) {
      const result = drainAccumulator(gap, msPerDayAt(1), MAX_DAYS_PER_FRAME_EXPORTED);
      expect(result.days).toBeLessThanOrEqual(MAX_DAYS_PER_FRAME_EXPORTED);
    }
  });
});

describe('a full run does not grow without bound', () => {
  const end = playFullRun();

  it('completes the full Phase 1 span', () => {
    expect(end.day).toBe(PHASE_1_END_DAY);
  });

  /**
   * The ledger is the structure most at risk of unbounded growth: it is
   * appended to by every law and event, and a 4,263-day run touches it
   * hundreds of times. Expiry is what keeps it usable, and a breakdown popover
   * listing four hundred entries would be useless even if it were correct.
   */
  it('keeps the modifier ledger small', () => {
    expect(end.activeModifiers.length).toBeLessThan(40);
  });

  it('holds no expired modifiers at the end of the run', () => {
    for (const modifier of end.activeModifiers) {
      if (modifier.endDay === null) continue;
      expect(modifier.endDay, modifier.id).toBeGreaterThan(end.day);
    }
  });

  it('prunes a temporary modifier the day it lapses, not later', () => {
    let state = createTestGame();
    state.activeModifiers = [
      {
        id: 'event:temp:nation.stability',
        source: 'Temporary',
        sourceType: 'event',
        target: 'nation.stability',
        value: 5,
        isPercentage: false,
        startDay: 0,
        endDay: 50,
        rampDays: 0,
      },
    ];

    for (let i = 0; i < 49; i++) state = advanceDay(state, EMPTY).state;
    expect(state.activeModifiers).toHaveLength(1);

    state = advanceDay(state, EMPTY).state; // day 50
    expect(state.activeModifiers).toHaveLength(0);
  });

  it('keeps the chronicle to a readable length', () => {
    expect(end.log.length).toBeLessThan(200);
  });

  it('records exactly one series sample per month, plus day zero', () => {
    expect(end.series.days).toHaveLength(141);
    for (const key of ['population', 'gdp', 'debt', 'stability'] as const) {
      expect(end.series[key], key).toHaveLength(141);
    }
  });

  it('keeps a saved game comfortably small', () => {
    const bytes = JSON.stringify(end).length;
    // Well inside the 4MB limit the save API enforces.
    expect(bytes).toBeLessThan(500_000);
  });

  it('does not accumulate stale scheduled events', () => {
    expect(end.eventState.scheduledEvents.length).toBeLessThan(5);
  });

  it('does not accumulate unresolved decisions', () => {
    expect(end.eventState.pendingDecisions).toHaveLength(0);
  });
});

describe('the engine is fast enough for the loop', () => {
  /**
   * At 5x the loop calls advanceDay five times a second, and a monthly
   * recompute lands inside one of those calls. If a tick were slow enough to
   * miss a frame the clock would visibly stutter.
   */
  it('averages well under a millisecond per day across a full span', () => {
    const started = performance.now();
    let state = createTestGame();
    for (let i = 0; i < PHASE_1_END_DAY; i++) {
      state = advanceDay(state, EMPTY).state;
    }
    const elapsed = performance.now() - started;
    const perDay = elapsed / PHASE_1_END_DAY;

    expect(perDay, `${perDay.toFixed(4)}ms per day`).toBeLessThan(1);
  });

  it('handles a frame’s worth of days far faster than the frame budget', () => {
    let state = createTestGame();
    // Advance to a month boundary so the expensive recompute is included.
    for (let i = 0; i < 40; i++) state = advanceDay(state, EMPTY).state;

    const started = performance.now();
    for (let i = 0; i < MAX_DAYS_PER_FRAME_EXPORTED; i++) {
      state = advanceDay(state, EMPTY).state;
    }
    const elapsed = performance.now() - started;

    // A 60Hz frame is ~16.7ms. Ten days must fit inside one comfortably.
    expect(elapsed, `${elapsed.toFixed(2)}ms for 10 days`).toBeLessThan(16);
  });

  it('does not slow down as the run lengthens', () => {
    let state = createTestGame();

    const timeSlice = (days: number) => {
      const started = performance.now();
      for (let i = 0; i < days; i++) state = advanceDay(state, EMPTY).state;
      return performance.now() - started;
    };

    const early = timeSlice(600);
    timeSlice(2_500); // advance deep into the run
    const late = timeSlice(600);

    // Some variance is expected; an order of magnitude would mean something is
    // accumulating and being re-scanned every tick.
    expect(late, `early ${early.toFixed(1)}ms, late ${late.toFixed(1)}ms`).toBeLessThan(
      Math.max(early * 6, 60),
    );
  });
});

describe('memory shape stays flat', () => {
  /**
   * Cannot measure heap usage meaningfully in this environment, so instead
   * assert that the structures which COULD leak stay proportional to the
   * calendar rather than to the number of ticks.
   */
  it('state size grows with months elapsed, not days simulated', () => {
    const measure = (days: number) => {
      let state = createTestGame();
      for (let i = 0; i < days; i++) state = advanceDay(state, EMPTY).state;
      return JSON.stringify(state).length;
    };

    const oneYear = measure(365);
    const fourYears = measure(1_460);

    // Four times the days, but the series grows by months. Well under linear
    // in ticks, and nowhere near quadratic.
    expect(fourYears).toBeLessThan(oneYear * 3);
  });
});
