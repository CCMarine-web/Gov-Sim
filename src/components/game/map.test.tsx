// @vitest-environment jsdom

/**
 * THE MAP ON SCREEN
 *
 * Phase 2 brief §6, queue item 9. What the interface has to get right:
 *
 *   - The map is the main view, and every mode is one click away.
 *   - The modern-outline simplification is stated ON THE MAP, because the brief
 *     asks for it to be "documented prominently and visibly in-game" rather
 *     than discovered.
 *   - Nothing means anything by colour alone: every band has a word beside it.
 *   - Clicking a state says what that state actually was on the date.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { isoToDay } from '@/sim/calendar';
import { createTestGame } from '@/sim/createGame';
import type { GameState } from '@/sim/types';
import { MapPanel } from './MapPanel';

afterEach(cleanup);

function on(iso: string): GameState {
  return { ...createTestGame(), day: isoToDay(iso) };
}

describe('the map draws the country', () => {
  it('draws every state outline', () => {
    const { container } = render(<MapPanel state={createTestGame()} />);
    const cells = container.querySelectorAll('[data-map-cell]');

    // Fifty states plus the District of Columbia.
    expect(cells.length).toBe(51);
    expect(container.querySelector('[data-map-cell="VA"]')).not.toBeNull();
  });

  it('offers the four modes the brief asks for', () => {
    const { container } = render(<MapPanel state={createTestGame()} />);

    for (const mode of ['political', 'support', 'economic', 'party']) {
      expect(container.querySelector(`[data-map-mode="${mode}"]`), mode).not.toBeNull();
    }
  });

  it('starts on the political map, and says which is active', () => {
    const { container } = render(<MapPanel state={createTestGame()} />);
    const political = container.querySelector('[data-map-mode="political"]')!;

    // aria-pressed rather than a colour, so the active mode is announced.
    expect(political.getAttribute('aria-pressed')).toBe('true');
    expect(
      container.querySelector('[data-map-mode="support"]')!.getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('recolours when the mode changes', () => {
    const { container } = render(<MapPanel state={on('1795-01-01')} />);
    const before = container.querySelector('[data-map-cell="VA"]')!.getAttribute('fill');

    fireEvent.click(container.querySelector('[data-map-mode="support"]')!);

    const after = container.querySelector('[data-map-cell="VA"]')!.getAttribute('fill');
    expect(after).not.toBe(before);
  });
});

describe('the map states its own inaccuracy', () => {
  it('says the outlines are modern, on the map itself', () => {
    const { container } = render(<MapPanel state={createTestGame()} />);
    const caveat = container.querySelector('[data-testid="map-caveat"]')!;

    // The brief: "Document this simplification prominently and visibly in-game.
    // It's a real inaccuracy and I'd rather it be stated than discovered."
    expect(caveat.textContent).toContain('modern state boundaries');
    expect(caveat.textContent).toContain('West Virginia');
    expect(caveat.textContent).toContain('District of Maine');
  });

  it('says what each mode is actually measuring', () => {
    const { container } = render(<MapPanel state={on('1795-01-01')} />);
    fireEvent.click(container.querySelector('[data-map-mode="support"]')!);

    const legend = container.querySelector('[data-testid="map-legend"]')!;
    expect(legend.textContent).toContain('four regions');
  });

  it('counts the areas it has no figure for', () => {
    const { container } = render(<MapPanel state={on('1795-01-01')} />);
    fireEvent.click(container.querySelector('[data-map-mode="support"]')!);

    const nodata = container.querySelector('[data-testid="map-nodata"]')!;
    expect(nodata.textContent).toContain('No figure');
  });
});

describe('nothing is carried by colour alone', () => {
  it('gives every legend band a word', () => {
    const { container } = render(<MapPanel state={on('1795-01-01')} />);

    for (const mode of ['political', 'support', 'economic', 'party']) {
      fireEvent.click(container.querySelector(`[data-map-mode="${mode}"]`)!);
      const legend = container.querySelector('[data-testid="map-legend"]')!;
      const items = legend.querySelectorAll('li');

      expect(items.length, mode).toBeGreaterThan(1);
      for (const item of items) {
        expect(item.textContent?.trim().length, mode).toBeGreaterThan(2);
      }
    }
  });

  it('gives every shape a title a screen reader can announce', () => {
    const { container } = render(<MapPanel state={on('1795-01-01')} />);
    const va = container.querySelector('[data-map-cell="VA"]')!;

    expect(va.querySelector('title')?.textContent).toContain('Virginia');
  });
});

describe('clicking a state says what it was', () => {
  it('opens a detail panel with the name it had on the date', () => {
    const { container } = render(<MapPanel state={on('1793-01-01')} />);

    fireEvent.click(container.querySelector('[data-map-cell="OH"]')!);
    const detail = container.querySelector('[data-testid="map-detail"]')!;

    expect(detail.getAttribute('data-detail-code')).toBe('OH');
    expect(detail.textContent).toContain('Northwest Territory');
  });

  it('explains a state that is outside the union rather than leaving a blank', () => {
    const { container } = render(<MapPanel state={on('1789-04-30')} />);

    fireEvent.click(container.querySelector('[data-map-cell="RI"]')!);
    const detail = container.querySelector('[data-testid="map-detail"]')!;

    expect(detail.textContent).toContain('Outside the union');
  });

  it('closes again', () => {
    const { container } = render(<MapPanel state={createTestGame()} />);

    fireEvent.click(container.querySelector('[data-map-cell="VA"]')!);
    expect(container.querySelector('[data-testid="map-detail"]')).not.toBeNull();

    fireEvent.click(container.querySelector('[data-map-cell="VA"]')!);
    expect(container.querySelector('[data-testid="map-detail"]')).toBeNull();
  });

  it('prompts rather than showing an empty panel', () => {
    const { container } = render(<MapPanel state={createTestGame()} />);
    expect(container.textContent).toContain('Click any state or territory');
  });
});
