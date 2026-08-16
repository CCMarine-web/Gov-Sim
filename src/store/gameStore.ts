/**
 * GAME STORE
 *
 * A deliberately thin Zustand store holding a PUBLISHED SNAPSHOT of simulation
 * state, plus clock status.
 *
 * WHAT THIS IS NOT
 * This is not where the game lives. The authoritative `GameState` is owned by
 * src/runtime/gameLoop.ts in a plain module variable with no subscribers. If
 * the engine wrote directly to this store, every simulated day would notify
 * every subscriber and re-render the entire dense UI — at 5x speed that is a
 * re-render storm. (DESIGN.md §6.2)
 *
 * The loop publishes here at most four times a second regardless of simulation
 * speed. Components subscribe with narrow selectors, so the date ticking does
 * not re-render the Treasury panel.
 *
 * This module imports nothing from the runtime, so there is no import cycle:
 * the loop knows about the store, the store knows nothing about the loop.
 */

import { create } from 'zustand';
import type { GameState, TickEffect } from '@/sim/types';

/** 1x, 2x, 5x. Keyboard 1/2/3 map to these. (UI.md §8) */
export type Speed = 1 | 2 | 5;

export interface ClockStatus {
  running: boolean;
  speed: Speed;
  /**
   * True when the clock is halted by an unresolved decision, as opposed to the
   * player having pressed pause. The command bar shows a distinct
   * "PAUSED - DECISION REQUIRED" state for this. (UI.md §4.1)
   */
  blockedByDecision: boolean;
  /** True when the loop auto-paused because the tab was hidden. */
  pausedByVisibility: boolean;
}

export interface GameStoreState {
  /** null before a game is started or loaded. */
  snapshot: GameState | null;
  clock: ClockStatus;
  /** Effects from the most recent publish, for transient UI feedback. */
  recentEffects: TickEffect[];
  /** Bumped on every publish; lets components detect a fresh frame cheaply. */
  publishCount: number;

  // --- Internal. Called by the runtime only. -------------------------------
  _publish: (snapshot: GameState, effects: TickEffect[]) => void;
  _setClock: (clock: Partial<ClockStatus>) => void;
  _reset: () => void;
}

const INITIAL_CLOCK: ClockStatus = {
  running: false,
  speed: 1,
  blockedByDecision: false,
  pausedByVisibility: false,
};

export const useGameStore = create<GameStoreState>((set) => ({
  snapshot: null,
  clock: INITIAL_CLOCK,
  recentEffects: [],
  publishCount: 0,

  _publish: (snapshot, effects) =>
    set((prev) => ({
      snapshot,
      recentEffects: effects,
      publishCount: prev.publishCount + 1,
    })),

  _setClock: (clock) =>
    set((prev) => ({ clock: { ...prev.clock, ...clock } })),

  _reset: () =>
    set({
      snapshot: null,
      clock: INITIAL_CLOCK,
      recentEffects: [],
      publishCount: 0,
    }),
}));

// ============================================================================
// SELECTORS
//
// Narrow selectors keep re-renders scoped. A component that only needs the day
// number must not re-render because the treasury balance changed.
// ============================================================================

export const selectDay = (s: GameStoreState): number => s.snapshot?.day ?? 0;

export const selectClock = (s: GameStoreState): ClockStatus => s.clock;

export const selectHasGame = (s: GameStoreState): boolean => s.snapshot !== null;

export const selectNation = (s: GameStoreState) => s.snapshot?.nation ?? null;

export const selectTreasury = (s: GameStoreState) => s.snapshot?.treasury ?? null;

export const selectRegions = (s: GameStoreState) => s.snapshot?.regions ?? null;

export const selectRuler = (s: GameStoreState) => s.snapshot?.ruler ?? null;

export const selectPendingDecision = (s: GameStoreState): string | null =>
  s.snapshot?.eventState.pendingDecisions[0]?.eventId ?? null;

export const selectModifiers = (s: GameStoreState) =>
  s.snapshot?.activeModifiers ?? [];

/** Most recent chronicle entries, newest first. */
export const selectRecentLog = (count: number) => (s: GameStoreState) =>
  s.snapshot ? [...s.snapshot.log].slice(-count).reverse() : [];
