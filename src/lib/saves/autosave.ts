/**
 * AUTOSAVE
 *
 * Writes the rolling autosave slot on a sensible cadence.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NEVER ON THE TICK PATH
 *
 * `advanceDay` must stay pure and fast — at 5x it runs several times a second,
 * and a serialize-plus-network-write inside it would stall the simulation and
 * couple the engine to storage, breaking DESIGN.md Rule 1.
 *
 * So autosave subscribes to the STORE, which is already throttled to at most
 * four publishes a second, and writes at most once per interval from there.
 * The engine has no idea this exists.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { yearOf } from '@/sim/calendar';
import { dayToDate } from '@/sim/calendar';
import type { GameState } from '@/sim/types';
import { useGameStore } from '@/store/gameStore';
import { AUTOSAVE_SLOT, autosaveName, saveGame } from './index';

/** Never write more often than this, however fast the game is running. */
const MIN_INTERVAL_MS = 60_000;

interface AutosaveState {
  unsubscribe: (() => void) | null;
  lastWriteMs: number;
  lastMonthKey: string | null;
  inFlight: boolean;
}

const autosave: AutosaveState = {
  unsubscribe: null,
  lastWriteMs: 0,
  lastMonthKey: null,
  inFlight: false,
};

const now = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

/** "1791-03" — the in-game month, which is the natural save cadence. */
function monthKey(state: GameState): string {
  const date = dayToDate(state.day);
  return `${date.year}-${String(date.month).padStart(2, '0')}`;
}

async function write(state: GameState): Promise<void> {
  if (autosave.inFlight) return;
  autosave.inFlight = true;

  try {
    await saveGame(AUTOSAVE_SLOT, autosaveName(state), state);
    autosave.lastWriteMs = now();
  } catch {
    // A failed autosave must never interrupt play. The manual save path
    // surfaces errors; this one stays quiet and tries again next month.
  } finally {
    autosave.inFlight = false;
  }
}

/**
 * Begin autosaving. Idempotent — calling twice does not double-subscribe,
 * which matters under React Strict Mode.
 */
export function startAutosave(): void {
  if (autosave.unsubscribe) return;
  if (typeof window === 'undefined') return;

  autosave.unsubscribe = useGameStore.subscribe((store, previous) => {
    const state = store.snapshot;
    if (!state) return;
    if (store.snapshot === previous.snapshot) return;

    const key = monthKey(state);

    // First observation just establishes the baseline; it does not write.
    if (autosave.lastMonthKey === null) {
      autosave.lastMonthKey = key;
      return;
    }

    if (key === autosave.lastMonthKey) return;
    autosave.lastMonthKey = key;

    // The in-game month turned over. Respect the real-time floor as well, so
    // 5x play does not write twelve times a minute.
    if (now() - autosave.lastWriteMs < MIN_INTERVAL_MS) return;

    void write(state);
  });
}

export function stopAutosave(): void {
  autosave.unsubscribe?.();
  autosave.unsubscribe = null;
  autosave.lastMonthKey = null;
  autosave.lastWriteMs = 0;
}

/** Force a write now, ignoring both cadence rules. Used on pause and on exit. */
export async function autosaveNow(): Promise<void> {
  const state = useGameStore.getState().snapshot;
  if (!state) return;
  autosave.lastMonthKey = monthKey(state);
  await write(state);
}

/** Exposed for tests and diagnostics. */
export function autosaveStatus(): { active: boolean; lastMonth: string | null; year: number | null } {
  const snapshot = useGameStore.getState().snapshot;
  return {
    active: autosave.unsubscribe !== null,
    lastMonth: autosave.lastMonthKey,
    year: snapshot ? yearOf(snapshot.day) : null,
  };
}
