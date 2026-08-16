/**
 * THEMING, ASSETS AND AUDIO
 *
 * Phase 2 brief §8, queue item 14. Five claims a test should be able to
 * falsify:
 *
 *   1. There are no hardcoded hex values or arbitrary Tailwind values left in
 *      components. This is asserted against the SOURCE, because it is the one
 *      requirement that decays silently as new code is written.
 *   2. The skin mechanism is real: two skins, applied by an attribute, with the
 *      stub honestly labelled.
 *   3. Every asset resolves through the manifest to a placeholder that carries
 *      its own key and is the right size.
 *   4. The audio bus is silent but not inert — it resolves cues, respects mute
 *      and the faders, and runs real crossfades.
 *   5. Preferences persist, and survive being corrupted.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COPY, allCopy } from '@/content/copy';
import { assets } from './assets';
import { CROSSFADE_MS, DEFAULT_AUDIO, audio, gainFor, _setClock } from './audio';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from './preferences';
import { DEFAULT_SKIN, SKINS, SKIN_BY_ID, isSkinId } from './theme';

// ============================================================================
// 1. THE AUDIT, ENFORCED
// ============================================================================

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) out.push(path);
  }
  return out;
}

describe('no component hardcodes a colour or a dimension', () => {
  const files = sourceFiles(join(process.cwd(), 'src', 'components'));

  it('finds components to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('has no hex colours in any component', () => {
    /*
      ASSERTED AGAINST THE SOURCE, deliberately. "Zero hardcoded hex values" is
      the one requirement in item 14 that decays silently: nothing breaks when
      somebody writes `stroke="#C9A227"`, it just quietly stops being skinnable.
      A test is the only thing that keeps it true.
    */
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const [i, line] of source.split('\n').entries()) {
        if (/#[0-9a-fA-F]{3,8}\b/.test(line)) {
          offenders.push(`${file}:${i + 1} ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has no arbitrary Tailwind values in any component', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const [i, line] of source.split('\n').entries()) {
        // `bg-[#fff]`, `w-[320px]`, `min-w-[42rem]` — anything that puts a
        // value in a class rather than in a token.
        if (/\b(?:bg|text|border|w|h|min-w|min-h|max-w|max-h|p|m|gap|rounded)-\[[^\]]+\]/.test(line)) {
          offenders.push(`${file}:${i + 1} ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('declares every layout dimension as a token', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');
    for (const token of [
      '--size-nav',
      '--size-feed',
      '--size-portrait-w',
      '--size-portrait-h',
      '--size-seal',
      '--size-banner-h',
    ]) {
      expect(css, token).toContain(token);
    }
  });
});

// ============================================================================
// 2. SKINS
// ============================================================================

describe('the skin mechanism is real rather than theoretical', () => {
  it('ships two skins, one of them honestly labelled a stub', () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(2);
    expect(SKIN_BY_ID[DEFAULT_SKIN].complete).toBe(true);
    // The brief asks for a stub so the mechanism is exercised. A stub that
    // claimed to be finished would be worse than none.
    expect(SKINS.some((s) => !s.complete)).toBe(true);
  });

  it('says of the incomplete one that it has not been contrast-audited', () => {
    const stub = SKINS.find((s) => !s.complete)!;
    expect(stub.description).toContain('contrast audit');
  });

  it('validates a skin id rather than trusting one', () => {
    expect(isSkinId('ledger')).toBe(true);
    expect(isSkinId('parchment')).toBe(true);
    expect(isSkinId('chartreuse')).toBe(false);
    expect(isSkinId(null)).toBe(false);
  });

  it('defines overrides in CSS, where a component cannot reach them', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');

    /*
      The requirement is "a future art-driven skin should require no component
      edits". A component that reads a theme OBJECT can always be written to
      branch on it; one that only emits `className="bg-ink-700"` physically
      cannot. So the switching has to live in CSS, and this asserts it does.
    */
    expect(css).toContain("[data-skin='parchment']");
    expect(css).toContain('--color-ink-800');
  });

  it('overrides the ground entirely in the stub, which is the harshest test', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');
    const block = css.slice(css.indexOf("[data-skin='parchment']"));

    // If anything in the interface quietly assumes a dark ground, inverting it
    // is what surfaces that.
    expect(block).toContain('--color-content-primary');
    expect(block).toContain('--color-ink-700');
  });
});

// ============================================================================
// 3. THE ASSET REGISTRY
// ============================================================================

describe('every asset resolves through the manifest', () => {
  it('returns a placeholder for everything, because there is no art yet', () => {
    for (const kind of ['portrait', 'seal', 'texture', 'banner', 'icon'] as const) {
      for (const key of assets.keys(kind)) {
        const asset = assets[kind](key);
        expect(asset.isPlaceholder, `${kind}/${key}`).toBe(true);
        expect(asset.src, `${kind}/${key}`).toContain('data:image/svg+xml');
      }
    }
  });

  it('labels each placeholder with its own key', () => {
    // So a screenshot of the game says exactly which asset is missing and what
    // to call the file that replaces it.
    const asset = assets.portrait('hamilton');
    expect(decodeURIComponent(asset.src)).toContain('portrait/hamilton');
  });

  it('gives every asset the size the layout reserves for it', () => {
    const portrait = assets.portrait('washington');
    expect(portrait.width).toBe(96);
    expect(portrait.height).toBe(120);

    const seal = assets.seal('national');
    expect(seal.width).toBe(64);
    expect(seal.height).toBe(64);
  });

  it('gives every asset alt text, or an explicit empty for decoration', () => {
    for (const kind of ['portrait', 'seal'] as const) {
      for (const key of assets.keys(kind)) {
        // A portrait or a seal is never decorative: a screen reader has to be
        // able to say whose face it is.
        expect(assets[kind](key).alt.length, `${kind}/${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('shows a visible plate for an unknown key rather than throwing', () => {
    const missing = assets.portrait('nobody-by-that-name');

    // A missing portrait must not take down the Government screen, and a silent
    // empty box would hide the mistake.
    expect(missing.isPlaceholder).toBe(true);
    expect(missing.alt).toContain('Missing asset');
  });

  it('can list what an artist still has to deliver', () => {
    const outstanding = assets.outstanding();
    expect(outstanding.length).toBeGreaterThan(10);
    expect(outstanding.every((o) => o.entry.src === null)).toBe(true);
  });
});

// ============================================================================
// 4. THE AUDIO BUS
// ============================================================================

describe('the audio bus is silent but not inert', () => {
  let clock = 0;

  beforeEach(() => {
    audio._reset();
    clock = 0;
    _setClock(() => clock);
  });

  afterEach(() => {
    audio._reset();
  });

  it('resolves a known cue and records what would have been heard', () => {
    expect(audio.play('event.crisis')).toBe(true);

    const history = audio.history();
    expect(history).toHaveLength(1);
    expect(history[0].key).toBe('event.crisis');
    expect(history[0].bus).toBe('effects');
    expect(history[0].gain).toBeGreaterThan(0);
  });

  it('ignores an unknown cue rather than throwing', () => {
    // A missing sound must never take down a screen.
    expect(audio.play('event.nothing-like-this')).toBe(false);
    expect(audio.history()).toHaveLength(0);
  });

  it('applies both faders, and mute overrides everything', () => {
    audio.setVolume('master', 0.5);
    audio.setVolume('effects', 0.4);
    expect(gainFor('effects')).toBeCloseTo(0.2, 6);

    audio.setMuted(true);
    expect(gainFor('effects')).toBe(0);

    audio.play('event.crisis');
    expect(audio.history()[0].gain).toBe(0);
  });

  it('clamps a volume rather than trusting it', () => {
    audio.setVolume('music', 4);
    expect(audio.preferences().volume.music).toBe(1);
    audio.setVolume('music', -2);
    expect(audio.preferences().volume.music).toBe(0);
  });

  it('crossfades on a real clock rather than switching instantly', () => {
    audio.music.setLayer('peace');
    clock += 5000;
    audio.music.setLayer('war');

    expect(audio.music.current()).toBe('war');
    expect(audio.music.isCrossfading()).toBe(true);
    expect(audio.music.fadingFrom()).toBe('peace');
    expect(audio.music.fadeProgress()).toBeCloseTo(0, 6);

    clock += CROSSFADE_MS / 2;
    expect(audio.music.fadeProgress()).toBeCloseTo(0.5, 6);

    clock += CROSSFADE_MS;
    expect(audio.music.fadeProgress()).toBe(1);
    expect(audio.music.isCrossfading()).toBe(false);
  });

  it('does not restart a layer that is already playing', () => {
    audio.music.setLayer('war');
    clock += 500;
    audio.music.setLayer('war');

    // The score must not jump because the country entered the same state twice.
    expect(audio.music.fadeProgress()).toBeCloseTo(500 / CROSSFADE_MS, 6);
  });

  it('knows every cue and layer, so the documentation cannot drift', () => {
    const cues = audio.cues();
    expect(cues.length).toBeGreaterThan(5);
    for (const cue of cues) {
      expect(cue.note.length, cue.key).toBeGreaterThan(10);
      // Nothing has a file yet, and the registry says so rather than pretending.
      expect(cue.hasFile, cue.key).toBe(false);
    }

    const layers = audio.layers();
    expect(layers.map((l) => l.layer)).toContain('war');
    expect(layers.every((l) => l.note.length > 5)).toBe(true);
  });
});

// ============================================================================
// 5. PREFERENCES
// ============================================================================

describe('preferences persist, and survive being wrong', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    // A minimal localStorage. The real one is not available in a node
    // environment, and the point of the test is the read/validate path.
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('round-trips', () => {
    const prefs = {
      skin: 'parchment' as const,
      audio: { muted: true, volume: { ...DEFAULT_AUDIO.volume, music: 0.25 } },
    };
    savePreferences(prefs);

    const read = loadPreferences();
    expect(read.skin).toBe('parchment');
    expect(read.audio.muted).toBe(true);
    expect(read.audio.volume.music).toBe(0.25);
  });

  it('falls back per field rather than wholesale', () => {
    // One bad volume must not cost the player their skin choice.
    store.set(
      'govsim.preferences',
      JSON.stringify({ skin: 'parchment', audio: { muted: false, volume: { music: 'loud' } } }),
    );

    const read = loadPreferences();
    expect(read.skin).toBe('parchment');
    expect(read.audio.volume.music).toBe(DEFAULT_AUDIO.volume.music);
  });

  it('rejects a skin that does not exist', () => {
    store.set('govsim.preferences', JSON.stringify({ skin: 'chartreuse' }));
    expect(loadPreferences().skin).toBe(DEFAULT_SKIN);
  });

  it('survives corrupt JSON', () => {
    store.set('govsim.preferences', '{not json at all');
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('clamps a volume read from storage', () => {
    store.set(
      'govsim.preferences',
      JSON.stringify({ audio: { muted: false, volume: { master: 9 } } }),
    );
    expect(loadPreferences().audio.volume.master).toBe(1);
  });
});

// ============================================================================
// COPY
// ============================================================================

describe('interface copy lives in a content file', () => {
  it('has no empty strings', () => {
    for (const line of allCopy()) {
      expect(line.trim().length).toBeGreaterThan(0);
    }
  });

  it('names every section the nav can reach', () => {
    for (const key of Object.keys(COPY.nav)) {
      expect(COPY.section[key as keyof typeof COPY.section], key).toBeDefined();
    }
  });

  it('says on the settings panel that the game is silent', () => {
    // A mute toggle that appears to do nothing reads as a bug.
    expect(COPY.settings.audioNote).toContain('no sounds yet');
  });
});
