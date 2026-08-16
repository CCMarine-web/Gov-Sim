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

import { TREATY_BY_ID } from '@/content/diplomacy/treaties';
import { advanceDay, resolveDecision } from '@/sim/advanceDay';
import { amendBill, enactBill, repealBill } from '@/sim/bills';
import { breachTreaty, sendEnvoy, signTreaty } from '@/sim/diplomacy';
import {
  declareWar,
  fabricateClaim,
  makePeace,
  type DeclarationOutcome,
} from '@/sim/war';
import { NO_TACTICS, type BillTactics } from '@/sim/congress';
import { createGame, type NewGameOptions } from '@/sim/createGame';
import { enactPolicy } from '@/sim/policy';
import type { ProposedPolicy } from '@/sim/projection';
import type { ContentPack, GameState, TickEffect } from '@/sim/types';
import { useGameStore } from '@/store/gameStore';
import { isUncapped, msPerDayAt, type Speed } from './speeds';

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
export const PUBLISH_INTERVAL_MS = 250;

/** Exported so the frame-cap claim can be asserted rather than assumed. */
export const MAX_DAYS_PER_FRAME_EXPORTED = 10;

/**
 * UNCAPPED SPEED — how much wall time one frame may spend simulating.
 *
 * At the top speed the accumulator is bypassed and the loop simulates days
 * continuously until this budget is spent, then yields. 8ms is half a 60Hz
 * frame, which leaves the browser room to paint and keeps the tab responsive
 * while still handing the engine everything the machine will give it.
 * (DESIGN.md §6.3, docs/DECISIONS.md D-016)
 */
export const UNCAPPED_FRAME_BUDGET_MS = 8;

/**
 * A backstop on the uncapped frame, NOT a cap on speed.
 *
 * A loop bounded only by wall-clock time never terminates if the clock does not
 * advance — which is precisely the situation under a controllable test clock,
 * and would also be the situation if `performance.now()` were ever coarsened
 * for fingerprinting resistance. 400 days per frame is roughly 24,000 days per
 * second at 60Hz, several times faster than any real machine reaches, so this
 * never binds during play. It exists so that a stopped clock cannot hang the
 * tab.
 */
export const UNCAPPED_MAX_DAYS_PER_FRAME = 400;

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

export { msPerDayAt, isUncapped } from './speeds';

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

/**
 * Simulate one day.
 *
 * Returns true if the loop must halt on this day: a `pausesGame` event fired
 * and the player has to answer it. Halting happens ON that day, and publishes
 * immediately rather than waiting for the throttle, so a decision can never be
 * missed because the clock was running fast. (DESIGN.md §6.3)
 */
function stepOneDay(): boolean {
  const result = advanceDay(loop.game!, loop.content!);
  loop.game = result.state;
  loop.pendingEffects.push(...result.effects);

  if (result.pauseRequested) {
    loop.running = false;
    loop.accumulatorMs = 0;
    publish(true);
    loop.rafId = null;
    return true;
  }
  return false;
}

/**
 * The capped path: an accumulator drained into whole days at a fixed rate.
 *
 * Returns true if the loop halted.
 */
function runCappedFrame(deltaMs: number): boolean {
  loop.accumulatorMs += deltaMs;

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
    if (stepOneDay()) return true;
  }
  return false;
}

/**
 * The uncapped path: simulate until the frame's wall-clock budget is spent.
 *
 * There is no rate here and no accumulator, because there is no target rate to
 * keep — the point of the top speed is that in-game time runs as fast as the
 * machine will carry it, the way HOI4's does. What bounds the frame is real
 * time: spend at most `UNCAPPED_FRAME_BUDGET_MS` simulating, then yield so the
 * browser can paint and handle input.
 *
 * Returns true if the loop halted.
 */
function runUncappedFrame(): boolean {
  const deadline = now() + UNCAPPED_FRAME_BUDGET_MS;

  for (let days = 0; days < UNCAPPED_MAX_DAYS_PER_FRAME; days++) {
    if (stepOneDay()) return true;
    if (now() >= deadline) break;
  }

  // Nothing is accumulated at this speed, so nothing can be owed when the
  // player drops back down to a capped one.
  loop.accumulatorMs = 0;
  return false;
}

function frame(): void {
  if (!loop.running || !loop.game || !loop.content) {
    loop.rafId = null;
    return;
  }

  const t = now();
  const delta = loop.lastFrameMs === null ? 0 : t - loop.lastFrameMs;
  loop.lastFrameMs = t;

  const halted = isUncapped(loop.speed)
    ? runUncappedFrame()
    : runCappedFrame(delta);

  if (halted) return;

  // Publication is throttled by WALL CLOCK, not by days simulated, which is
  // why the ceiling of four per second holds unchanged at the uncapped speed.
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

/**
 * Enact a proposed tax and spending policy, then publish immediately.
 *
 * Deliberately a discrete action rather than something a slider does: no
 * policy change may happen from a stray drag. (UI.md §5.4)
 */
export function enactBudget(proposed: ProposedPolicy): void {
  if (!loop.game) return;
  const result = enactPolicy(loop.game, proposed);
  loop.game = result.state;
  loop.pendingEffects.push(...result.effects);
  publish(true);
}

// ============================================================================
// LEGISLATION (Phase 2 brief §4)
//
// The loop is the only mutable owner of state, so every player action against a
// bill goes through here. Each looks up the bill in the CONTENT PACK rather than
// taking one as an argument, so a component can never pass a bill the engine
// does not have.
// ============================================================================

function findBill(billId: string) {
  const bill = loop.content?.bills.find((b) => b.id === billId);
  if (!bill) {
    throw new Error(`No bill with id "${billId}" in the content pack.`);
  }
  return bill;
}

/**
 * Introduce a bill.
 *
 * On the republican path this is a request, not an instruction: the bill goes to
 * both chambers and may be voted down, which is an ordinary outcome and returns
 * a state like any other. On the monarchical path it is a decree and passes.
 * (brief §2.1, §2.2)
 */
export function enactLegislation(
  billId: string,
  sliderValue: number | null,
  tactics: BillTactics = NO_TACTICS,
): void {
  if (!loop.game || !loop.content) return;
  const result = enactBill(
    loop.game,
    findBill(billId),
    sliderValue,
    loop.content.parties,
    tactics,
  );
  loop.game = result.state;
  loop.pendingEffects.push(...result.effects);
  publish(true);
}

export function amendLegislation(billId: string, sliderValue: number): void {
  if (!loop.game || !loop.content) return;
  const result = amendBill(loop.game, findBill(billId), sliderValue);
  loop.game = result.state;
  loop.pendingEffects.push(...result.effects);
  publish(true);
}

export function repealLegislation(billId: string): void {
  if (!loop.game || !loop.content) return;
  const result = repealBill(loop.game, findBill(billId));
  loop.game = result.state;
  loop.pendingEffects.push(...result.effects);
  publish(true);
}

/**
 * Send a minister to a foreign power. (brief §7)
 *
 * Silently does nothing when it cannot be afforded, exactly as the legislation
 * actions do: the panel already disables the control and states the price, and
 * a second refusal path here would be a second source of truth about what is
 * possible.
 */
export function sendMinister(powerId: string): void {
  if (!loop.game) return;
  const result = sendEnvoy(loop.game, powerId);
  if (!result.ok) return;
  loop.game = result.state;
  publish(true);
}

/** Conclude a treaty. */
export function concludeTreaty(treatyId: string): void {
  if (!loop.game) return;
  const treaty = TREATY_BY_ID[treatyId];
  if (!treaty) return;
  const result = signTreaty(loop.game, treaty);
  if (!result.ok) return;
  loop.game = result.state;
  publish(true);
}

/** Repudiate one. It costs relations, and it costs standing at home. */
export function repudiateTreaty(treatyId: string): void {
  if (!loop.game) return;
  const result = breachTreaty(loop.game, treatyId);
  if (!result.ok) return;
  loop.game = result.state;
  publish(true);
}

/**
 * Declare war. (brief §7, queue item 12)
 *
 * Returns the outcome rather than swallowing it, because on the republican path
 * "voted down" is an ordinary result the interface has to be able to report —
 * it is not a failure to declare, it is Congress declining.
 */
export function declare(
  powerId: string,
  groundsId: string,
  tactics: BillTactics = NO_TACTICS,
): DeclarationOutcome | null {
  if (!loop.game || !loop.content) return null;
  const outcome = declareWar(loop.game, powerId, groundsId, loop.content.parties, tactics);
  if (outcome.kind !== 'refused') {
    loop.game = outcome.state;
    publish(true);
  }
  return outcome;
}

/** Prepare a pretext. The capital is spent whether it is ever used or not. */
export function fabricate(powerId: string): void {
  if (!loop.game) return;
  const result = fabricateClaim(loop.game, powerId);
  if (!result.ok) return;
  loop.game = result.state;
  publish(true);
}

/** End a war, on whatever terms the country's position can command. */
export function seekPeace(powerId: string): void {
  if (!loop.game) return;
  const result = makePeace(loop.game, powerId);
  if (!result.ok) return;
  loop.game = result.state;
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
