/**
 * THE UNCAPPED TOP SPEED
 *
 * Brief §0.2 asked for 5x to run as fast as the machine can process, the way
 * HOI4's top speed does, and then said: "Verify the render throttle still holds
 * at uncapped speed — that's exactly where it will break, and a test should
 * assert the ceiling."
 *
 * This file is that assertion. It drives the real loop with a controllable
 * clock and a real `requestAnimationFrame` queue, with no DOM and no React —
 * the uncapped path is runtime behaviour, and it should be provable without
 * rendering anything.
 *
 * THE CLOCK MODEL
 * The interesting property of the uncapped frame is that it is bounded by wall
 * time rather than by a day count, so a test that freezes the clock does not
 * exercise it at all. Instead `now()` advances by a fixed cost on every call,
 * which models a machine that takes that long to simulate a day. Setting the
 * cost sets the simulated machine speed.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { PHASE_1_CONTENT } from '@/content';
import type { ContentPack } from '@/sim/types';
import { useGameStore } from '@/store/gameStore';
import {
  PUBLISH_INTERVAL_MS,
  UNCAPPED_FRAME_BUDGET_MS,
  UNCAPPED_MAX_DAYS_PER_FRAME,
  destroy,
  getGameState,
  isRunning,
  setSpeed,
  start,
  startNewGame,
} from './gameLoop';
import { msPerDayAt } from './speeds';

/**
 * No events. A `pausesGame` event would halt the loop, which is correct
 * behaviour and separately tested — but it would stop this file measuring the
 * thing it is here to measure.
 */
const NO_EVENTS: ContentPack = { version: 'uncapped-test', events: [], bills: [], offices: [], parties: [], stateSeats: [] };

const NEW_GAME = {
  governmentType: 'republic' as const,
  rulerName: 'George Washington',
  houseName: 'Federalist',
  seed: 20260816,
  gameId: 'uncapped-test',
  createdAtISO: '1789-04-30T00:00:00.000Z',
  contentVersion: NO_EVENTS.version,
};

interface Harness {
  /** Deliver `count` frames, returning the wall time they consumed. */
  frames: (count: number) => number;
  nowMs: () => number;
  restore: () => void;
}

/**
 * @param costPerNowCallMs How much wall time each `now()` call represents. The
 *   uncapped frame calls it once per simulated day, so this is effectively
 *   "how long this machine takes to simulate one day".
 */
function installClock(costPerNowCallMs: number): Harness {
  let clock = 1_000;
  let nextId = 1;
  const pending = new Map<number, (t: number) => void>();

  const realPerformance = globalThis.performance;
  const realRaf = globalThis.requestAnimationFrame;
  const realCancel = globalThis.cancelAnimationFrame;

  Object.defineProperty(globalThis, 'performance', {
    configurable: true,
    writable: true,
    value: {
      ...realPerformance,
      now: () => {
        clock += costPerNowCallMs;
        return clock;
      },
    },
  });

  globalThis.requestAnimationFrame = ((cb: (t: number) => void): number => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  }) as typeof globalThis.requestAnimationFrame;

  globalThis.cancelAnimationFrame = ((id: number): void => {
    pending.delete(id);
  }) as typeof globalThis.cancelAnimationFrame;

  return {
    nowMs: () => clock,
    frames(count: number): number {
      const before = clock;
      for (let i = 0; i < count; i++) {
        // A real display leaves a gap between frames. 16ms at 60Hz.
        clock += 16;
        const due = [...pending.values()];
        pending.clear();
        for (const cb of due) cb(clock);
      }
      return clock - before;
    },
    restore() {
      Object.defineProperty(globalThis, 'performance', {
        configurable: true,
        writable: true,
        value: realPerformance,
      });
      globalThis.requestAnimationFrame = realRaf;
      globalThis.cancelAnimationFrame = realCancel;
    },
  };
}

let harness: Harness | null = null;

afterEach(() => {
  destroy();
  harness?.restore();
  harness = null;
});

describe('uncapped speed', () => {
  it('simulates far more days per second than the fastest capped speed', () => {
    // 0.05ms per day models a machine doing roughly 20,000 days a second.
    harness = installClock(0.05);
    startNewGame(NEW_GAME, NO_EVENTS);
    setSpeed(5);
    start();

    const elapsedMs = harness.frames(60);
    const day = getGameState()!.day;

    const daysPerSecond = day / (elapsedMs / 1000);
    const fastestCapped = 1000 / msPerDayAt(4);

    expect(day).toBeGreaterThan(100);
    expect(
      daysPerSecond,
      `uncapped managed ${daysPerSecond.toFixed(0)} days/sec against ${fastestCapped} at 4x`,
    ).toBeGreaterThan(fastestCapped * 5);
  });

  /**
   * THE CEILING. This is the assertion the brief asked for.
   *
   * However many days a frame manages, publication is throttled by wall clock,
   * so the UI can never be notified more than four times a second.
   */
  it('still publishes no more than four times a second', () => {
    harness = installClock(0.05);

    let publishes = 0;
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (s.snapshot !== prev.snapshot) publishes += 1;
    });

    startNewGame(NEW_GAME, NO_EVENTS);
    setSpeed(5);
    start();

    publishes = 0;
    const elapsedMs = harness.frames(300);
    unsubscribe();

    const seconds = elapsedMs / 1000;
    const perSecond = publishes / seconds;
    const ceiling = 1000 / PUBLISH_INTERVAL_MS;

    expect(getGameState()!.day).toBeGreaterThan(1_000);
    expect(
      perSecond,
      `${publishes} publishes over ${seconds.toFixed(2)}s = ${perSecond.toFixed(2)}/sec`,
    ).toBeLessThanOrEqual(ceiling + 0.001);
  });

  it('yields the frame once its wall-clock budget is spent', () => {
    // 0.5ms per day: the 8ms budget should buy roughly sixteen days, nowhere
    // near the 400-day backstop.
    harness = installClock(0.5);
    startNewGame(NEW_GAME, NO_EVENTS);
    setSpeed(5);
    start();

    const before = getGameState()!.day;
    harness.frames(1);
    const daysThisFrame = getGameState()!.day - before;

    const expected = UNCAPPED_FRAME_BUDGET_MS / 0.5;
    expect(daysThisFrame).toBeGreaterThan(0);
    expect(daysThisFrame).toBeLessThanOrEqual(expected + 1);
    expect(daysThisFrame).toBeLessThan(UNCAPPED_MAX_DAYS_PER_FRAME);
  });

  /**
   * A frame bounded only by elapsed time never terminates if time does not
   * elapse. That is not hypothetical: it is the situation under a frozen test
   * clock, and would also be the situation if `performance.now()` were
   * coarsened for fingerprinting resistance. The backstop is what stops a
   * stopped clock hanging the tab.
   */
  it('falls back to the day backstop when the clock does not advance at all', () => {
    harness = installClock(0);
    startNewGame(NEW_GAME, NO_EVENTS);
    setSpeed(5);
    start();

    const before = getGameState()!.day;
    harness.frames(1);

    expect(getGameState()!.day - before).toBe(UNCAPPED_MAX_DAYS_PER_FRAME);
  });

  /**
   * THE THING MOST LIKELY TO BREAK.
   *
   * At the capped speeds a frame simulates at most ten days, so a decision
   * event is never more than ten days from being noticed. Uncapped, a single
   * frame can simulate hundreds. If the halt were checked per frame rather than
   * per day, the game would blow straight past a decision the player had to
   * make — and it would do so silently.
   */
  it('halts on the exact day a decision fires, however many days a frame runs', () => {
    harness = installClock(0);
    startNewGame({ ...NEW_GAME, contentVersion: PHASE_1_CONTENT.version }, PHASE_1_CONTENT);
    setSpeed(5);
    start();

    // One frame at a stopped clock runs the full 400-day backstop unless
    // something stops it. Something should stop it.
    harness.frames(1);

    const state = getGameState()!;
    expect(state.eventState.pendingDecisions).toHaveLength(1);

    const pending = state.eventState.pendingDecisions[0];
    expect(state.day).toBe(pending.firedOnDay);
    expect(state.day).toBeLessThan(UNCAPPED_MAX_DAYS_PER_FRAME);

    // The clock is stopped and stays stopped until the player answers.
    expect(isRunning()).toBe(false);

    // And the pending decision reached the store, so the modal can appear —
    // the halt publishes immediately rather than waiting for the throttle.
    expect(
      useGameStore.getState().snapshot!.eventState.pendingDecisions,
    ).toHaveLength(1);
  });

  it('returns to a fixed rate when the player drops back to a capped speed', () => {
    harness = installClock(0.05);
    startNewGame(NEW_GAME, NO_EVENTS);
    setSpeed(5);
    start();
    harness.frames(10);

    const afterUncapped = getGameState()!.day;
    expect(afterUncapped).toBeGreaterThan(50);

    setSpeed(1);
    // 1x is 600ms per day, so ten 16ms frames is 160ms — not even one day.
    harness.frames(10);
    const afterCapped = getGameState()!.day;

    expect(afterCapped - afterUncapped).toBeLessThanOrEqual(1);
  });
});
