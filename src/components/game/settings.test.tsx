// @vitest-environment jsdom

/**
 * SETTINGS ON SCREEN
 *
 * Phase 2 brief §8. What the panel has to do:
 *
 *   - Offer every skin, and say which one is a stub.
 *   - Switch skins by putting an attribute on the document, not by re-rendering
 *     components with different props.
 *   - Carry a mute toggle and a volume slider per bus, persisted.
 *   - Say, plainly, that the game is currently silent.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { audio } from '@/lib/audio';
import { loadPreferences } from '@/lib/preferences';
import { SettingsPanel } from './SettingsPanel';

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-skin');
  audio._reset();
});

describe('the settings panel', () => {
  it('offers every skin', () => {
    const { container } = render(<SettingsPanel onClose={() => {}} />);

    expect(container.querySelector('[data-skin-option="ledger"]')).not.toBeNull();
    expect(container.querySelector('[data-skin-option="parchment"]')).not.toBeNull();
  });

  it('says which skin is a stub, rather than presenting two finished designs', () => {
    const { container } = render(<SettingsPanel onClose={() => {}} />);
    const stub = container.querySelector('[data-skin-option="parchment"]')!;

    expect(stub.textContent).toContain('working stub');
    expect(stub.textContent).toContain('contrast audit');
  });

  it('switches the skin by an attribute on the document', () => {
    const { container } = render(<SettingsPanel onClose={() => {}} />);

    fireEvent.click(container.querySelector('[data-skin-option="parchment"] input')!);

    /*
      The whole mechanism, in one assertion. Nothing re-rendered with different
      props; one attribute changed and every token in the tree resolves
      differently. That is what makes "no component edits" enforceable.
    */
    expect(document.documentElement.dataset.skin).toBe('parchment');
  });

  it('persists the choice', () => {
    const { container } = render(<SettingsPanel onClose={() => {}} />);
    fireEvent.click(container.querySelector('[data-skin-option="parchment"] input')!);

    expect(loadPreferences().skin).toBe('parchment');
  });
});

describe('the sound controls', () => {
  it('says the game is silent, so a dead control does not read as a bug', () => {
    const { container } = render(<SettingsPanel onClose={() => {}} />);
    expect(container.textContent).toContain('no sounds yet');
  });

  it('carries a slider for every bus', () => {
    const { container } = render(<SettingsPanel onClose={() => {}} />);

    for (const bus of ['master', 'music', 'effects', 'ui']) {
      expect(container.querySelector(`[data-bus="${bus}"]`), bus).not.toBeNull();
    }
  });

  it('moves a volume, and tells the audio bus about it', () => {
    const { container } = render(<SettingsPanel onClose={() => {}} />);
    const slider = container.querySelector('#volume-music') as HTMLInputElement;

    fireEvent.change(slider, { target: { value: '30' } });

    expect(audio.preferences().volume.music).toBeCloseTo(0.3, 6);
    expect(loadPreferences().audio.volume.music).toBeCloseTo(0.3, 6);
  });

  it('mutes, disables the sliders, and says so', () => {
    const { container } = render(<SettingsPanel onClose={() => {}} />);

    fireEvent.click(container.querySelector('[data-testid="mute"]')!);

    expect(audio.preferences().muted).toBe(true);
    expect((container.querySelector('#volume-music') as HTMLInputElement).disabled).toBe(
      true,
    );
    // The word, not only the disabled state.
    expect(container.querySelector('[data-bus="music"]')!.textContent).toContain('Muted');
  });

  it('reads back what was stored', () => {
    const first = render(<SettingsPanel onClose={() => {}} />);
    fireEvent.click(first.container.querySelector('[data-testid="mute"]')!);
    cleanup();

    const { container } = render(<SettingsPanel onClose={() => {}} />);
    expect((container.querySelector('[data-testid="mute"]') as HTMLInputElement).checked).toBe(
      true,
    );
  });
});
