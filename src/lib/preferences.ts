/**
 * PREFERENCES
 *
 * Phase 2 brief §8: volume sliders and a mute toggle "persisted with other
 * preferences". This is "with other preferences" — the one place a setting that
 * is about the PLAYER rather than about the GAME is stored.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT IN `GameState`
 *
 * DESIGN.md Rule 3: `GameState` is the simulation, and it round-trips through
 * JSON into a save slot. A skin choice and a music volume are neither
 * simulation nor save: they belong to the person at the keyboard, not to the
 * republic they are governing. Putting them in `GameState` would mean loading a
 * save could change the interface, and sharing one would carry someone else's
 * volume settings.
 *
 * So: localStorage, same defensive posture as the save store — Safari private
 * mode throws on access rather than on write, and a corrupt value must never
 * make the game unopenable.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { DEFAULT_AUDIO, type AudioPreferences } from './audio';
import { DEFAULT_SKIN, isSkinId, type SkinId } from './theme';

export interface Preferences {
  skin: SkinId;
  audio: AudioPreferences;
}

export const DEFAULT_PREFERENCES: Preferences = {
  skin: DEFAULT_SKIN,
  audio: DEFAULT_AUDIO,
};

const KEY = 'govsim.preferences';

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    window.localStorage.getItem('govsim.probe');
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Read, defensively.
 *
 * Every field is validated rather than trusted. A hand-edited or
 * version-mismatched value falls back to the default for that field alone —
 * one bad volume must not cost the player their skin choice.
 */
export function loadPreferences(): Preferences {
  const store = storage();
  if (!store) return DEFAULT_PREFERENCES;

  try {
    const raw = store.getItem(KEY);
    if (!raw) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<Preferences>;
    const audio = parsed.audio ?? DEFAULT_AUDIO;

    const volume = { ...DEFAULT_AUDIO.volume };
    for (const bus of Object.keys(volume) as Array<keyof typeof volume>) {
      const value = audio.volume?.[bus];
      if (typeof value === 'number' && Number.isFinite(value)) {
        volume[bus] = Math.max(0, Math.min(1, value));
      }
    }

    return {
      skin: isSkinId(parsed.skin) ? parsed.skin : DEFAULT_SKIN,
      audio: { muted: audio.muted === true, volume },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: Preferences): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Quota, or private mode. A preference that will not persist is a small
    // annoyance; an exception here would be a broken settings panel.
  }
}
