/**
 * THE GAME LOOP
 *
 * The only mutable owner of simulation state, and the bridge between the pure
 * engine and React. Implements DESIGN.md §6.
 *
 * THE SHAPE OF THE PROBLEM
 * Three things run at different rates and must not be coupled:
 *
 *   simulation    1-5 in-game days per second, set by the speed control
 *   UI publish    at most 4 times per second, ALWAYS
 *   browser paint whatever the display does, typically 60Hz
 *
 * Putting `GameState` in Zustand couples all three: every simulated day writes
 * to the store, notifies subscribers, and re-renders a dense information UI. At
 * 5x that is a re-render storm.
 *
 * So the authoritative state lives HERE, in a plain module variable with no
 * subscribers, and is published to the store on a throttle.
 *
 * WHY A MODULE SINGLETON
 * There is exactly one game running at a time, and the loop must survive React
 * remounts — including Strict Mode's deliberate double-invocation in
 * development. Starting an already-running loop is a no-op.
 */

import { advanceDay, resolveDecision } from '@/sim/advanceDay';
import { createGame, type NewGameOptions } from '@/sim/createGame';
import type { ContentPack, GameState, TickEffect } from '@/sim/types';
import { useGameStore, type Speed } from '@/store/gameStore';

/**
 * Never simulate more than this many days in a single frame.
 *
 * If the tab is backgrounded for thirty seconds we do NOT simulate 150 days on
 * the first frame back. That would freeze the tab and, worse, silently
 * fast-forward past a decision the player should have seen. Excess accumulated
 * time is discarded: in-game time may fall behind real time, but the
 * simulation never skips a day. (DESIGN.md §6.3)
 */
const MAX_DAYS_PER_FRAME = 10;

/** The UI is published at most four times a second, at any speed. */
const PUBLISH_INTERVAL_MS = 250;

/** 1x is one in-game day per real second. */
const MS_PER_DAY_AT_1X = 1000;

// ============================================================================
// PURE HELPERS (testable without a DOM)
// ============================================================================

export interface DrainResult {
  /** Whole days to simulate this frame. */
  days: number;
  /** Time left over, carried into the next frame. */
  remainderMs: number;
  /** Time thrown away by the frame cap, if any. */
  discardedMs: number;
}

/**
 * Drain whole days out of an accumulator.
 *
 * An accumulator rather than a naive interval, because `requestAnimationFrame`
 * fires at display rate and frames get dropped. Accumulating elapsed time and
 * draining whole days keeps in-game time proportional to real time even when
 * the frame rate is uneven.
 */
export function drainAccumulator(
  accumulatedMs: number,
  msPerDay: number,
  maxDays = MAX_DAYS_PER_FRAME,
): DrainResult {
  if (msPerDay <= 0) {
    throw new Error('msPerDay must be positive');
  }

  const wanted = Math.floor(accumulatedMs / msPerDay);
  const days = Math.min(wanted, maxDays);
  const remainderMs = accumulatedMs - wanted * msPerDay;
  const discardedMs = (wanted - days) * msPerDay;

  return { days, remainderMs, discardedMs };
}

/** Real milliseconds per in-game day at a given speed. */
export function msPerDayAt(speed: Speed): number {
  return MS_PER_DAY_AT_1X / speed;
}

// ============================================================================
// LOOP STATE
// ============================================================================

interface LoopState {
  /** The authoritative game state. Deliberately NOT in Zustand. */
  game: GameState | null;
  content: ContentPack | null;
  running: boolean;
  speed: Speed;
  rafId: number | null;
  lastFrameMs: number | null;
  accumulatorMs: number;
  lastPublishMs: number;
  /** Effects gathered since the last publish. */
  pendingEffects: TickEffect[];
  visibilityBound: boolean;
  pausedByVisibility: boolean;
}

const loop: LoopState = {
  game: null,
  content: null,
  running: false,
  speed: 1,
  rafId: null,
  lastFrameMs: null,
  accumulatorMs: 0,
  lastPublishMs: 0,
  pendingEffects: [],
  visibilityBound: false,
  pausedByVisibility: false,
};

const now = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

// ============================================================================
// PUBLISHING
// ============================================================================

function publish(force = false): void {
  if (!loop.game) return;

  const elapsed = now() - loop.lastPublishMs;
  if (!force && elapsed < PUBLISH_INTERVAL_MS) return;

  loop.lastPublishMs = now();

  const effects = loop.pendingEffects;
  loop.pendingEffects = [];

  useGameStore.getState()._publish(loop.game, effects);
  syncClock();
}

function syncClock(): void {
  useGameStore.getState()._setClock({
    running: loop.running,
    speed: loop.speed,
    blockedByDecision:
      (loop.game?.eventState.pendingDecisions.length ?? 0) > 0,
    pausedByVisibility: loop.pausedByVisibility,
  });
}

// ============================================================================
// THE FRAME
// ============================================================================

function frame(): void {
  if (!loop.running || !loop.game || !loop.content) {
    loop.rafId = null;
    return;
  }

  const t = now();
  const delta = loop.lastFrameMs === null ? 0 : t - loop.lastFrameMs;
  loop.lastFrameMs = t;
  loop.accumulatorMs += delta;

  const { days, remainderMs, discardedMs } = drainAccumulator(
    loop.accumulatorMs,
    msPerDayAt(loop.speed),
  );
  loop.accumulatorMs = remainderMs;

  if (discardedMs > 0) {
    // Surfaced rather than swallowed: falling behind is a real condition and
    // should be visible when debugging performance.
    console.warn(
      `[gameLoop] discarded ${Math.round(discardedMs)}ms of accumulated time ` +
        `(frame cap of ${MAX_DAYS_PER_FRAME} days). In-game time has fallen behind.`,
    );
  }

  for (let i = 0; i < days; i++) {
    const result = advanceDay(loop.game, loop.content);
    loop.game = result.state;
    loop.pendingEffects.push(...result.effects);

    if (result.pauseRequested) {
      // Halt ON the day the decision fired, and publish immediately so the
      // modal appears without waiting for the throttle. A decision must never
      // be missed because the game was running at 5x. (DESIGN.md §6.3)
      loop.running = false;
      loop.accumulatorMs = 0;
      publish(true);
      loop.rafId = null;
      return;
    }
  }

  publish();
  loop.rafId = requestAnimationFrame(frame);
}

function startRaf(): void {
  if (loop.rafId !== null) return;
  if (typeof requestAnimationFrame === 'undefined') return;
  loop.lastFrameMs = null;
  loop.rafId = requestAnimationFrame(frame);
}

function stopRaf(): void {
  if (loop.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(loop.rafId);
  }
  loop.rafId = null;
  loop.lastFrameMs = null;
}

// ============================================================================
// VISIBILITY
// ============================================================================

/**
 * Auto-pause when the tab is hidden.
 *
 * `requestAnimationFrame` is throttled or halted in background tabs, so time
 * would silently stop anyway. Pausing explicitly is honest, and it avoids the
 * "came back to find the treasury empty" failure. On return the game stays
 * paused until the player resumes: the clock restarts when they say so.
 */
function bindVisibility(): void {
  if (loop.visibilityBound || typeof document === 'undefined') return;
  loop.visibilityBound = true;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && loop.running) {
      loop.pausedByVisibility = true;
      pause();
    }
  });
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function startNewGame(
  options: NewGameOptions,
  content: ContentPack,
): GameState {
  stopRaf();
  loop.game = createGame(options);
  loop.content = content;
  loop.running = false;
  loop.speed = 1;
  loop.accumulatorMs = 0;
  loop.pendingEffects = [];
  loop.lastPublishMs = 0;
  loop.pausedByVisibility = false;
  bindVisibility();
  publish(true);
  return loop.game;
}

/** Adopt an already-constructed state, e.g. one loaded from a save. */
export function loadGame(state: GameState, content: ContentPack): void {
  stopRaf();
  loop.game = state;
  loop.content = content;
  loop.running = false;
  loop.accumulatorMs = 0;
  loop.pendingEffects = [];
  loop.lastPublishMs = 0;
  loop.pausedByVisibility = false;
  bindVisibility();
  publish(true);
}

export function start(): void {
  if (!loop.game || !loop.content) return;
  // A pending decision blocks time entirely; the player must answer first.
  if (loop.game.eventState.pendingDecisions.length > 0) {
    syncClock();
    return;
  }
  if (loop.running) return;

  loop.running = true;
  loop.pausedByVisibility = false;
  loop.accumulatorMs = 0;
  startRaf();
  publish(true);
}

export function pause(): void {
  if (!loop.running) {
    syncClock();
    return;
  }
  loop.running = false;
  stopRaf();
  publish(true);
}

export function toggle(): void {
  if (loop.running) pause();
  else start();
}

export function setSpeed(speed: Speed): void {
  loop.speed = speed;
  // Reset the accumulator so a speed change does not immediately dump a burst
  // of days accumulated at the previous rate.
  loop.accumulatorMs = 0;
  syncClock();
}

/**
 * Answer a pending decision, then publish immediately.
 * The clock stays paused afterwards: the player decides when time resumes.
 */
export function answerDecision(eventId: string, optionId: string): void {
  if (!loop.game || !loop.content) return;

  const result = resolveDecision(loop.game, loop.content, eventId, optionId);
  loop.game = result.state;
  loop.pendingEffects.push(...result.effects);
  publish(true);
}

/** The authoritative state, for saving. */
export function getGameState(): GameState | null {
  return loop.game;
}

export function isRunning(): boolean {
  return loop.running;
}

/** Tear the loop down. Used on unmount and between games. */
export function destroy(): void {
  stopRaf();
  loop.game = null;
  loop.content = null;
  loop.running = false;
  loop.accumulatorMs = 0;
  loop.pendingEffects = [];
  loop.pausedByVisibility = false;
  useGameStore.getState()._reset();
}

/** Test seam: advance deterministically without a DOM or a clock. */
export function stepForTesting(days: number): void {
  if (!loop.game || !loop.content) return;
  for (let i = 0; i < days; i++) {
    const result = advanceDay(loop.game, loop.content);
    loop.game = result.state;
    loop.pendingEffects.push(...result.effects);
    if (result.pauseRequested) {
      loop.running = false;
      break;
    }
  }
  publish(true);
}
