/**
 * SAVE MANAGER
 *
 * Chooses a backend and exposes one API to the interface.
 *
 * Rules:
 *   - Cloud is used only when Supabase is configured AND the player is signed
 *     in. Otherwise local.
 *   - A cloud write that fails falls back to local, and says so. A network
 *     hiccup must never destroy a run in progress.
 *   - Loading always goes through the migration path, so an older save is
 *     upgraded or refused readably — never crashed on, never half-loaded.
 */

import { dayToIso, formatLongDate } from '@/sim/calendar';
import type { GameState } from '@/sim/types';
import { cloudUnavailableReason, isSupabaseConfigured } from '@/lib/supabase/config';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { cloudSaveStore } from './cloudStore';
import { localSaveStore } from './localStore';
import {
  AUTOSAVE_SLOT,
  type LoadResult,
  type SaveMeta,
  type SaveStore,
} from './types';

export * from './types';
export { localSaveStore } from './localStore';
export { cloudSaveStore } from './cloudStore';

export interface SaveOutcome {
  ok: boolean;
  /** Which backend actually took the write. */
  storedIn: 'local' | 'cloud';
  /** Set when the cloud was attempted and failed, so local took it instead. */
  degradedReason?: string;
  message?: string;
}

/** Is the player signed in? Returns false when Supabase is not configured. */
export async function isSignedIn(): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  return data.user !== null;
}

/** The backend that should be used right now. */
export async function activeStore(): Promise<SaveStore> {
  if (isSupabaseConfigured() && (await isSignedIn())) return cloudSaveStore;
  return localSaveStore;
}

/**
 * Write a save.
 *
 * Tries the cloud when it is available, and falls back to local on any failure
 * rather than losing the write. The returned outcome says exactly where the
 * data ended up so the interface can tell the truth about it.
 */
export async function saveGame(
  slot: number,
  name: string,
  state: GameState,
): Promise<SaveOutcome> {
  const store = await activeStore();

  if (store.kind === 'cloud') {
    try {
      await store.save(slot, name, state);
      return { ok: true, storedIn: 'cloud' };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error.';
      try {
        await localSaveStore.save(slot, name, state);
        return {
          ok: true,
          storedIn: 'local',
          degradedReason: reason,
          message:
            'Saved to this browser. The cloud save failed, so this game is not synced yet.',
        };
      } catch (localError) {
        return {
          ok: false,
          storedIn: 'local',
          message: localError instanceof Error ? localError.message : 'Could not save.',
        };
      }
    }
  }

  try {
    await localSaveStore.save(slot, name, state);
    return { ok: true, storedIn: 'local' };
  } catch (error) {
    return {
      ok: false,
      storedIn: 'local',
      message: error instanceof Error ? error.message : 'Could not save.',
    };
  }
}

/**
 * Read a save.
 *
 * Falls back to the local copy if the cloud has nothing in that slot, which is
 * the ordinary case for a player who has been playing signed out.
 */
export async function loadGame(slot: number): Promise<LoadResult> {
  const store = await activeStore();
  const result = await store.load(slot);

  if (!result.ok && store.kind === 'cloud') {
    const local = await localSaveStore.load(slot);
    if (local.ok) return local;
  }

  return result;
}

/** List saves from the active backend, merged with local ones it does not have. */
export async function listSaves(): Promise<{
  saves: SaveMeta[];
  storedIn: 'local' | 'cloud';
  notice: string | null;
}> {
  const store = await activeStore();
  const primary = await store.list();

  if (store.kind === 'local') {
    return { saves: primary, storedIn: 'local', notice: cloudUnavailableReason() };
  }

  const local = await localSaveStore.list();
  const slotsInCloud = new Set(primary.map((s) => s.slot));
  const localOnly = local.filter((s) => !slotsInCloud.has(s.slot));

  return {
    saves: [...primary, ...localOnly].sort((a, b) => a.slot - b.slot),
    storedIn: 'cloud',
    notice:
      localOnly.length > 0
        ? `${localOnly.length} save${localOnly.length === 1 ? '' : 's'} exist only in this browser. Sync to upload.`
        : null,
  };
}

export async function deleteSave(slot: number): Promise<void> {
  const store = await activeStore();
  await store.remove(slot);
  // Always clear the local copy too, or a deleted cloud save reappears from
  // the fallback on the next load.
  await localSaveStore.remove(slot);
}

/**
 * Copy every local save up to the cloud. Run after signing in.
 *
 * Local wins on conflict, because the player has just been playing locally and
 * that is the newer work. Returns how many were uploaded.
 */
export async function syncLocalToCloud(): Promise<{ uploaded: number; failed: number }> {
  if (!isSupabaseConfigured() || !(await isSignedIn())) {
    return { uploaded: 0, failed: 0 };
  }

  const local = await localSaveStore.exportAll();
  let uploaded = 0;
  let failed = 0;

  for (const { meta, state } of local) {
    try {
      await cloudSaveStore.save(meta.slot, meta.name, state);
      uploaded++;
    } catch {
      failed++;
    }
  }

  return { uploaded, failed };
}

/** A human label for a save row. */
export function describeSave(meta: SaveMeta): string {
  return `${meta.rulerName} · ${formatLongDate(meta.inGameDay)}`;
}

/** Default name for the rolling autosave slot. */
export function autosaveName(state: GameState): string {
  return `Autosave · ${dayToIso(state.day)}`;
}

export { AUTOSAVE_SLOT };
