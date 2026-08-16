'use client';

/**
 * SETTINGS
 *
 * Phase 2 brief §8: skins, and "volume sliders and a mute toggle to settings
 * now, persisted with other preferences".
 *
 * Everything here is about the PLAYER rather than the game, so nothing on this
 * panel touches `GameState` and nothing is written into a save. It lives in
 * localStorage with the rest of the preferences (`src/lib/preferences.ts`).
 *
 * The sound controls are live and the game is silent. That is stated on the
 * panel rather than left to be discovered — a mute toggle that appears to do
 * nothing reads as a bug, and the honest explanation is short.
 */

import { useState } from 'react';
import { COPY } from '@/content/copy';
import { BUSES, BUS_LABEL, audio, type AudioPreferences, type Bus } from '@/lib/audio';
import {
  loadPreferences,
  savePreferences,
  type Preferences,
} from '@/lib/preferences';
import { SKINS, applySkin, type SkinId } from '@/lib/theme';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  /*
    LAZY INITIAL STATE, and it is safe here in a way it would not be in the
    shell: this panel only ever mounts after a click, so it is always past
    hydration and localStorage is always available. Reading in an effect and
    calling setState would be both slower and a lint error.
  */
  const [prefs, setPrefs] = useState<Preferences>(() => loadPreferences());

  function update(next: Preferences): void {
    setPrefs(next);
    savePreferences(next);
    applySkin(next.skin);
    audio.setPreferences(next.audio);
  }

  function setSkin(skin: SkinId): void {
    update({ ...prefs, skin });
  }

  function setAudio(next: AudioPreferences): void {
    update({ ...prefs, audio: next });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={COPY.settings.title}
      data-testid="settings"
    >
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-card border border-ink-400 bg-ink-700 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-h1 text-content-primary">
            {COPY.settings.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-small text-content-muted hover:text-content-secondary"
          >
            {COPY.shell.close}
          </button>
        </div>

        {/* --- Appearance ------------------------------------------------ */}
        <section className="mt-3 border-t border-ink-400 pt-3">
          <h3 className="text-label uppercase tracking-wider text-content-muted">
            {COPY.settings.appearance}
          </h3>
          <p className="mt-1 max-w-prose text-small text-content-muted">
            {COPY.settings.appearanceNote}
          </p>

          <div className="mt-2 space-y-2">
            {SKINS.map((skin) => (
              <label
                key={skin.id}
                data-skin-option={skin.id}
                className="flex cursor-pointer gap-2 rounded border border-ink-400 p-2 hover:bg-ink-600"
              >
                <input
                  type="radio"
                  name="skin"
                  value={skin.id}
                  checked={prefs.skin === skin.id}
                  onChange={() => setSkin(skin.id)}
                  className="mt-1"
                />
                <span>
                  <span className="text-body text-content-primary">{skin.name}</span>
                  <span className="block text-small text-content-muted">
                    {skin.description}
                  </span>
                  {!skin.complete && (
                    <span className="mt-0.5 block text-small text-oxblood-300">
                      {COPY.settings.incompleteSkin}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* --- Sound ----------------------------------------------------- */}
        <section className="mt-3 border-t border-ink-400 pt-3">
          <h3 className="text-label uppercase tracking-wider text-content-muted">
            {COPY.settings.audio}
          </h3>
          {/*
            Said plainly. A mute toggle that appears to do nothing reads as a
            bug, and the true explanation is one sentence long.
          */}
          <p className="mt-1 max-w-prose text-small text-content-muted">
            {COPY.settings.audioNote}
          </p>

          <label className="mt-2 flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              data-testid="mute"
              checked={prefs.audio.muted}
              onChange={(e) =>
                setAudio({ ...prefs.audio, muted: e.target.checked })
              }
            />
            <span className="text-body text-content-secondary">
              {COPY.settings.mute}
            </span>
          </label>

          <div className="mt-2 space-y-2">
            {BUSES.map((bus: Bus) => (
              <div key={bus} data-bus={bus}>
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor={`volume-${bus}`}
                    className="text-small text-content-secondary"
                  >
                    {BUS_LABEL[bus]}
                  </label>
                  <span className="tabular text-small text-content-muted">
                    {prefs.audio.muted
                      ? COPY.settings.muted
                      : `${Math.round(prefs.audio.volume[bus] * 100)}%`}
                  </span>
                </div>
                <input
                  id={`volume-${bus}`}
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(prefs.audio.volume[bus] * 100)}
                  disabled={prefs.audio.muted}
                  onChange={(e) =>
                    setAudio({
                      ...prefs.audio,
                      volume: {
                        ...prefs.audio.volume,
                        [bus]: Number(e.target.value) / 100,
                      },
                    })
                  }
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
