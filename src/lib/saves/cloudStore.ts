/**
 * CLOUD SAVE STORE
 *
 * Talks to /api/saves. Same interface as the local store, so nothing above
 * knows which is in use.
 *
 * Every failure path returns a readable `reason` rather than throwing. A
 * network hiccup while saving must not destroy a run in progress — the caller
 * falls back to local storage and tells the player their game is safe but not
 * synced.
 */

import { dayToIso } from '@/sim/calendar';
import { migrateToCurrent } from '@/sim/migrations';
import type { GameState } from '@/sim/types';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { LoadResult, SaveMeta, SaveStore } from './types';

async function readMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

export class CloudSaveStore implements SaveStore {
  readonly kind = 'cloud' as const;

  isAvailable(): boolean {
    return isSupabaseConfigured();
  }

  async list(): Promise<SaveMeta[]> {
    const response = await fetch('/api/saves', { cache: 'no-store' });
    if (!response.ok) return [];

    const body = (await response.json()) as { saves?: SaveMeta[] };
    return (body.saves ?? []).map((save) => ({
      ...save,
      updatedAt: String(save.updatedAt),
    }));
  }

  async save(slot: number, name: string, state: GameState): Promise<void> {
    const response = await fetch('/api/saves', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot,
        name,
        inGameDate: dayToIso(state.day),
        state,
      }),
    });

    if (!response.ok) {
      throw new Error(await readMessage(response, 'Could not write your save.'));
    }
  }

  async load(slot: number): Promise<LoadResult> {
    const response = await fetch(`/api/saves/${slot}`, { cache: 'no-store' });

    if (!response.ok) {
      return {
        ok: false,
        reason: await readMessage(response, 'Could not read that save.'),
      };
    }

    const body = (await response.json()) as { state?: unknown };

    // The same migration path the local store uses. A save written by an older
    // build is upgraded, or refused with a readable explanation.
    const outcome = migrateToCurrent(body.state);
    if (!outcome.ok) {
      return { ok: false, reason: outcome.reason };
    }

    return { ok: true, state: outcome.state, migratedFrom: outcome.migratedFrom };
  }

  async remove(slot: number): Promise<void> {
    const response = await fetch(`/api/saves/${slot}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(await readMessage(response, 'Could not delete that save.'));
    }
  }
}

export const cloudSaveStore = new CloudSaveStore();
