/**
 * THE AUDIO BUS
 *
 * Phase 2 brief §8:
 *
 *   "Audio bus abstraction with no assets. Build `audio.play('event.crisis')`,
 *    `audio.music.setLayer('war')` with crossfade support, as a silent no-op
 *    implementation. Add volume sliders and a mute toggle to settings now,
 *    persisted with other preferences. When we have music, we register files in
 *    a manifest and nothing else changes."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A SILENT IMPLEMENTATION THAT IS NOT A STUB
 *
 * There are no audio files, so nothing here makes a sound. What it DOES do is
 * everything else: it resolves a cue key against a manifest, respects mute and
 * the per-bus volumes, tracks the current music layer, and runs crossfades on a
 * real clock so a layer change takes the time it will take.
 *
 * That distinction is the point. A stub that returns immediately would let the
 * interface develop a dependency on audio being instantaneous — a crisis handler
 * that plays a cue and then assumes the transition is done. When the files
 * arrive, that assumption breaks and the fix is in the callers, which is
 * precisely the "surgery" the brief is trying to avoid.
 *
 * So the state machine is real and only the output is missing. `history` records
 * every cue that would have played, which is how the tests assert behaviour that
 * has no observable effect yet.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type Bus = 'master' | 'music' | 'effects' | 'ui';

/** Music layers, HOI4-style: the score follows the state of the country. */
export type MusicLayer = 'menu' | 'peace' | 'tension' | 'war' | 'crisis';

export interface AudioPreferences {
  muted: boolean;
  /** 0…1 per bus. `master` multiplies the others. */
  volume: Record<Bus, number>;
}

export const DEFAULT_AUDIO: AudioPreferences = {
  muted: false,
  volume: { master: 0.7, music: 0.6, effects: 0.8, ui: 0.5 },
};

export const BUSES: readonly Bus[] = ['master', 'music', 'effects', 'ui'];

export const BUS_LABEL: Record<Bus, string> = {
  master: 'Overall',
  music: 'Music',
  effects: 'Events',
  ui: 'Interface',
};

/**
 * THE CUE MANIFEST.
 *
 * Logical key to file, exactly as the asset registry does it, and every `src` is
 * null until there is a file. Adding audio is editing this object; no caller
 * changes.
 */
interface Cue {
  bus: Exclude<Bus, 'master'>;
  src: string | null;
  /** What this cue is for, so a composer knows what they are writing. */
  note: string;
}

const CUES: Record<string, Cue> = {
  'event.crisis': {
    bus: 'effects',
    src: null,
    note: 'A crisis-tier event opens. Short, low, not a sting.',
  },
  'event.decision': { bus: 'effects', src: null, note: 'A decision the player must answer.' },
  'event.enactment': { bus: 'effects', src: null, note: 'A bill carries, or a treaty is signed.' },
  'event.defeat': { bus: 'effects', src: null, note: 'Congress votes the government down.' },
  'event.war': { bus: 'effects', src: null, note: 'War is declared.' },
  'ui.click': { bus: 'ui', src: null, note: 'A control is pressed. Nearly inaudible.' },
  'ui.panel': { bus: 'ui', src: null, note: 'A panel opens.' },
  'ui.error': { bus: 'ui', src: null, note: 'An action was refused.' },
  'clock.pause': { bus: 'ui', src: null, note: 'The clock stops.' },
  'clock.resume': { bus: 'ui', src: null, note: 'The clock starts.' },
};

const LAYERS: Record<MusicLayer, { src: string | null; note: string }> = {
  menu: { src: null, note: 'Title and founding screens.' },
  peace: { src: null, note: 'The default. Ordinary governing.' },
  tension: { src: null, note: 'Sectional strain rising, or unrest running.' },
  war: { src: null, note: 'A war is on.' },
  crisis: { src: null, note: 'Legitimacy collapsing, or an armed rising.' },
};

/** Milliseconds a music layer takes to cross into another. */
export const CROSSFADE_MS = 2400;

export interface CuePlayed {
  key: string;
  bus: Bus;
  /** The volume it would have played at, after mute and both faders. */
  gain: number;
  /** Wall-clock ms, from the injected clock. */
  at: number;
}

interface AudioState {
  prefs: AudioPreferences;
  layer: MusicLayer | null;
  /** The layer being faded out, while a crossfade is running. */
  fadingFrom: MusicLayer | null;
  fadeStartedAt: number | null;
  history: CuePlayed[];
}

const state: AudioState = {
  prefs: { ...DEFAULT_AUDIO, volume: { ...DEFAULT_AUDIO.volume } },
  layer: null,
  fadingFrom: null,
  fadeStartedAt: null,
  history: [],
};

/**
 * The clock, injectable.
 *
 * Crossfades are time-based, and a test that had to wait 2.4 real seconds to
 * assert one is a test nobody runs. Same reasoning as the game loop's clock.
 */
let clock: () => number = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

export function _setClock(fn: () => number): void {
  clock = fn;
}

/** The gain a cue on this bus would play at. Zero when muted. */
export function gainFor(bus: Exclude<Bus, 'master'>): number {
  if (state.prefs.muted) return 0;
  return state.prefs.volume.master * state.prefs.volume[bus];
}

export const audio = {
  /**
   * Play a cue.
   *
   * Silent, but not inert: it resolves the key, applies the faders, and records
   * what would have been heard. An unknown key is ignored rather than thrown —
   * a missing sound must never take down a screen — and returns false so a
   * caller that cares can tell.
   */
  play(key: string): boolean {
    const cue = CUES[key];
    if (!cue) return false;

    const gain = gainFor(cue.bus);
    state.history.push({ key, bus: cue.bus, gain, at: clock() });
    // When there are files, this is where one is triggered at `gain`. Nothing
    // above this line changes.
    return true;
  },

  music: {
    /**
     * Change the layer, with a crossfade.
     *
     * Setting the layer that is already playing is a no-op rather than a
     * restart — the score should not jump because the country entered the same
     * state twice.
     */
    setLayer(layer: MusicLayer): void {
      if (state.layer === layer) return;
      state.fadingFrom = state.layer;
      state.layer = layer;
      state.fadeStartedAt = clock();
    },

    current(): MusicLayer | null {
      return state.layer;
    },

    /** 0…1 through the current crossfade, or 1 when none is running. */
    fadeProgress(): number {
      if (state.fadeStartedAt === null) return 1;
      const elapsed = clock() - state.fadeStartedAt;
      return Math.max(0, Math.min(1, elapsed / CROSSFADE_MS));
    },

    isCrossfading(): boolean {
      return state.fadingFrom !== null && this.fadeProgress() < 1;
    },

    /** What is fading out, while it still is. */
    fadingFrom(): MusicLayer | null {
      return this.isCrossfading() ? state.fadingFrom : null;
    },

    stop(): void {
      state.layer = null;
      state.fadingFrom = null;
      state.fadeStartedAt = null;
    },
  },

  // --- Preferences ---------------------------------------------------------

  preferences(): AudioPreferences {
    return { ...state.prefs, volume: { ...state.prefs.volume } };
  },

  setPreferences(prefs: AudioPreferences): void {
    state.prefs = { ...prefs, volume: { ...prefs.volume } };
  },

  setVolume(bus: Bus, value: number): void {
    state.prefs.volume[bus] = Math.max(0, Math.min(1, value));
  },

  setMuted(muted: boolean): void {
    state.prefs.muted = muted;
  },

  // --- For tests and the settings panel ------------------------------------

  /** Every cue key, with what it is for. Drives the documentation. */
  cues(): Array<{ key: string; bus: Bus; note: string; hasFile: boolean }> {
    return Object.entries(CUES).map(([key, cue]) => ({
      key,
      bus: cue.bus,
      note: cue.note,
      hasFile: cue.src !== null,
    }));
  },

  layers(): Array<{ layer: MusicLayer; note: string; hasFile: boolean }> {
    return (Object.keys(LAYERS) as MusicLayer[]).map((layer) => ({
      layer,
      note: LAYERS[layer].note,
      hasFile: LAYERS[layer].src !== null,
    }));
  },

  /** What would have been heard. The only observable output while silent. */
  history(): CuePlayed[] {
    return [...state.history];
  },

  _reset(): void {
    state.prefs = { ...DEFAULT_AUDIO, volume: { ...DEFAULT_AUDIO.volume } };
    state.layer = null;
    state.fadingFrom = null;
    state.fadeStartedAt = null;
    state.history = [];
  },
};
