/**
 * SAVE STORAGE — the interface
 *
 * One interface, two implementations: browser localStorage and Supabase.
 *
 * The split exists so the game stays fully playable while logged out, and so a
 * missing cloud credential degrades to "saves are local only" rather than
 * "saving is broken". Nothing above this interface knows which backend it is
 * talking to.
 */

import type { GameState } from '@/sim/types';

/** 0 is the rolling autosave. 1-3 are the player's named slots. */
export const AUTOSAVE_SLOT = 0;
export const NAMED_SLOTS = [1, 2, 3] as const;
export const ALL_SLOTS = [AUTOSAVE_SLOT, ...NAMED_SLOTS] as const;

/**
 * What the load screen needs to render a list, without deserialising every
 * full save. Denormalised from the state at the moment of writing.
 */
export interface SaveMeta {
  slot: number;
  name: string;
  schemaVersion: number;
  contentVersion: string;
  rulerName: string;
  governmentType: string;
  inGameDay: number;
  /** ISO date within the game, for display. */
  inGameDate: string;
  /** Real-world time the save was written, ISO 8601. */
  updatedAt: string;
}

export interface LoadResult {
  ok: boolean;
  state?: GameState;
  /** Set when ok is false. Written to be shown to the player verbatim. */
  reason?: string;
  /** Set when an older save was upgraded on load. */
  migratedFrom?: number | null;
}

export interface SaveStore {
  readonly kind: 'local' | 'cloud';
  /** Whether this backend is usable right now. */
  isAvailable(): boolean;
  list(): Promise<SaveMeta[]>;
  save(slot: number, name: string, state: GameState): Promise<void>;
  load(slot: number): Promise<LoadResult>;
  remove(slot: number): Promise<void>;
}

/** Build the display metadata for a state about to be written. */
export function metaFor(
  slot: number,
  name: string,
  state: GameState,
  nowISO: string,
): SaveMeta {
  return {
    slot,
    name,
    schemaVersion: state.schemaVersion,
    contentVersion: state.contentVersion,
    rulerName: state.ruler.name,
    governmentType: state.governmentType,
    inGameDay: state.day,
    inGameDate: '', // filled by the caller, which has the calendar
    updatedAt: nowISO,
  };
}
