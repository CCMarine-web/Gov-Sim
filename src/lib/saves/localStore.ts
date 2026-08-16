/**
 * LOCAL SAVE STORE
 *
 * Browser localStorage. The fallback that keeps the game fully playable while
 * logged out, or when cloud credentials are not configured.
 *
 * Deliberately synchronous underneath but async at the interface, so the cloud
 * store is a drop-in replacement and callers never branch on which is active.
 */

import { dayToIso } from '@/sim/calendar';
import { parseSave } from '@/sim/migrations';
import type { GameState } from '@/sim/types';
import {
  ALL_SLOTS,
  type LoadResult,
  type SaveMeta,
  type SaveStore,
} from './types';

const KEY_PREFIX = 'govsim.save.';
const META_KEY = 'govsim.saves.index';

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    // Touch it: Safari private mode throws on access rather than on write.
    window.localStorage.getItem('govsim.probe');
    return window.localStorage;
  } catch {
    return null;
  }
}

function readIndex(): SaveMeta[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(META_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SaveMeta[]) : [];
  } catch {
    // A corrupt index must not make the game unopenable. The saves themselves
    // are keyed independently and survive.
    return [];
  }
}

function writeIndex(entries: SaveMeta[]): void {
  storage()?.setItem(META_KEY, JSON.stringify(entries));
}

export class LocalSaveStore implements SaveStore {
  readonly kind = 'local' as const;

  isAvailable(): boolean {
    return storage() !== null;
  }

  async list(): Promise<SaveMeta[]> {
    return readIndex().sort((a, b) => a.slot - b.slot);
  }

  async save(slot: number, name: string, state: GameState): Promise<void> {
    const store = storage();
    if (!store) throw new Error('Local storage is unavailable in this browser.');

    const meta: SaveMeta = {
      slot,
      name,
      schemaVersion: state.schemaVersion,
      contentVersion: state.contentVersion,
      rulerName: state.ruler.name,
      governmentType: state.governmentType,
      inGameDay: state.day,
      inGameDate: dayToIso(state.day),
      updatedAt: new Date().toISOString(),
    };

    try {
      store.setItem(`${KEY_PREFIX}${slot}`, JSON.stringify(state));
    } catch (error) {
      // Quota exceeded is the realistic failure. Say so plainly rather than
      // letting an opaque DOMException reach the player.
      throw new Error(
        'Could not write the save — browser storage is full. Delete a save and try again. ' +
          `(${error instanceof Error ? error.name : 'unknown error'})`,
      );
    }

    const index = readIndex().filter((m) => m.slot !== slot);
    writeIndex([...index, meta]);
  }

  async load(slot: number): Promise<LoadResult> {
    const store = storage();
    if (!store) {
      return { ok: false, reason: 'Local storage is unavailable in this browser.' };
    }

    const raw = store.getItem(`${KEY_PREFIX}${slot}`);
    if (!raw) {
      return { ok: false, reason: 'That save slot is empty.' };
    }

    const outcome = parseSave(raw);
    if (!outcome.ok) {
      return { ok: false, reason: outcome.reason };
    }

    return { ok: true, state: outcome.state, migratedFrom: outcome.migratedFrom };
  }

  async remove(slot: number): Promise<void> {
    storage()?.removeItem(`${KEY_PREFIX}${slot}`);
    writeIndex(readIndex().filter((m) => m.slot !== slot));
  }

  /** Every slot currently holding data. Used when syncing local saves upward. */
  async exportAll(): Promise<Array<{ meta: SaveMeta; state: GameState }>> {
    const out: Array<{ meta: SaveMeta; state: GameState }> = [];
    const index = readIndex();

    for (const slot of ALL_SLOTS) {
      const meta = index.find((m) => m.slot === slot);
      if (!meta) continue;
      const result = await this.load(slot);
      if (result.ok && result.state) out.push({ meta, state: result.state });
    }

    return out;
  }
}

export const localSaveStore = new LocalSaveStore();
