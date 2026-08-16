// @vitest-environment jsdom

/**
 * THE MAP ON SCREEN
 *
 * Phase 2 brief §6, queue items 9 and 10. What the interface has to get right:
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

  it('offers the four modes item 9 required', () => {
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

// ============================================================================
// QUEUE ITEM 10 — THE REST OF THE MODES, AND THE DETAIL PANEL
// ============================================================================

describe('the remaining map modes', () => {
  it('offers all seven', () => {
    const { container } = render(<MapPanel state={createTestGame()} />);

    for (const mode of [
      'political',
      'support',
      'economic',
      'party',
      'population',
      'tension',
      'compliance',
    ]) {
      expect(container.querySelector(`[data-map-mode="${mode}"]`), mode).not.toBeNull();
    }
  });

  it('colours two states of one region differently on the population map', () => {
    const { container } = render(<MapPanel state={on('1795-01-01')} />);
    fireEvent.click(container.querySelector('[data-map-mode="population"]')!);

    const va = container.querySelector('[data-map-cell="VA"]')!.getAttribute('fill');
    const ga = container.querySelector('[data-map-cell="GA"]')!.getAttribute('fill');

    // The 1790 census says Virginia and Georgia were not the same size, so the
    // one map that can show it should.
    expect(va).not.toBe(ga);
  });

  it('says on the strain map that the measure is derived, not historical', () => {
    const { container } = render(<MapPanel state={on('1795-01-01')} />);
    fireEvent.click(container.querySelector('[data-map-mode="tension"]')!);

    const legend = container.querySelector('[data-testid="map-legend"]')!;
    expect(legend.textContent).toContain('derived measure');
    expect(legend.textContent).toContain('enslaved share');
  });

  it('names the compliance bands in words a player can act on', () => {
    const { container } = render(<MapPanel state={on('1795-01-01')} />);
    fireEvent.click(container.querySelector('[data-map-mode="compliance"]')!);

    const legend = container.querySelector('[data-testid="map-legend"]')!;
    expect(legend.textContent).toContain('Federal law does not run here');
    expect(legend.textContent).toContain('Nearly complete');
  });
});

describe('the state detail panel', () => {
  it('shows the region figures, the delegation and the census record', () => {
    const { container } = render(<MapPanel state={on('1795-01-01')} />);
    fireEvent.click(container.querySelector('[data-map-cell="VA"]')!);

    const detail = container.querySelector('[data-testid="map-detail"]')!;
    expect(detail.querySelector('[data-testid="detail-figures"]')).not.toBeNull();
    expect(detail.querySelector('[data-testid="detail-delegation"]')).not.toBeNull();

    expect(detail.textContent).toContain('Prosperity');
    expect(detail.textContent).toContain('Sentiment');
    expect(detail.textContent).toContain('Sectional strain');
  });

  it('presents the census figures as history, in the steel reserved for it', () => {
    const { container } = render(<MapPanel state={on('1795-01-01')} />);
    fireEvent.click(container.querySelector('[data-map-cell="VA"]')!);

    const census = container.querySelector('[data-testid="detail-census"]')!;
    // steel-* is reserved for historical/benchmark data. (UI.md §9)
    expect(census.className).toContain('steel');
    expect(census.textContent).toContain('1790 census');
    expect(census.textContent).toContain('were enslaved');
  });

  it('says what it does not track, rather than leaving rows out', () => {
    const { container } = render(<MapPanel state={on('1795-01-01')} />);
    fireEvent.click(container.querySelector('[data-map-cell="VA"]')!);

    const missing = container.querySelector('[data-testid="detail-not-tracked"]')!;
    // The brief asks for notable figures. There is no roster of members here,
    // and a plausible name would be a fabricated one — so the panel says so.
    expect(missing.textContent).toContain('Not tracked');
    expect(missing.textContent).toContain('roster of members');
  });

  it('says none rather than zero for a place outside the union', () => {
    const { container } = render(<MapPanel state={on('1795-01-01')} />);
    fireEvent.click(container.querySelector('[data-map-cell="LA"]')!);

    const detail = container.querySelector('[data-testid="map-detail"]')!;
    expect(detail.textContent).toContain('Spanish Louisiana');
    expect(detail.textContent).toContain('not zero, none');
    expect(detail.querySelector('[data-testid="detail-figures"]')).toBeNull();
  });

  it('shows a running episode of unrest where there is one', () => {
    const base = createTestGame();
    const risen: GameState = {
      ...base,
      grievance: {
        ...base.grievance,
        byRegion: { ...base.grievance.byRegion, south: 62 },
        episodes: [
          {
            id: 'unrest:south:1',
            regionId: 'south',
            severity: 'defiance',
            drivenBy: 'planters',
            startedDay: 1,
            endedDay: null,
          },
        ],
      },
    };

    const { container } = render(<MapPanel state={risen} />);
    fireEvent.click(container.querySelector('[data-map-cell="VA"]')!);

    const grievance = container.querySelector('[data-testid="detail-grievance"]')!;
    expect(grievance.textContent).toContain('defiance');
    expect(grievance.textContent).toContain('planters');
  });

  it('cites the record behind the status', () => {
    const { container } = render(<MapPanel state={on('1793-01-01')} />);
    fireEvent.click(container.querySelector('[data-map-cell="TN"]')!);

    const detail = container.querySelector('[data-testid="map-detail"]')!;
    expect(detail.textContent).toContain('Territory South of the River Ohio');
    expect(detail.textContent).toContain('26 May 1790');
  });
});
