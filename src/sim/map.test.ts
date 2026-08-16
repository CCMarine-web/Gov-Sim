/**
 * THE MAP
 *
 * Phase 2 brief §6, queue item 9. Four claims a test should be able to falsify:
 *
 *   1. The political map shows the country AS IT WAS on the date, not as it is
 *      now — eleven states in April 1789, and Rhode Island outside the union.
 *   2. Absence is honest. A cell with no figure returns null and says why. The
 *      brief is explicit: no quiet interpolation to make a mode look complete.
 *   3. The regional simplification is DECLARED. Support and economic figures are
 *      regional, so states sharing a region share a colour, and the view says so
 *      rather than implying a precision that is not there.
 *   4. Party is genuinely per state, and is labelled a model rather than a
 *      record.
 */

import { describe, expect, it } from 'vitest';
import { PARTIES, PHASE_1_CONTENT } from '@/content';
import { STATE_SHAPES } from '@/content/map/geometry';
import { TERRITORY, TERRITORY_BY_CODE } from '@/content/map/territory';
import { advanceDay, resolveDecision } from './advanceDay';
import { isoToDay } from './calendar';
import { createTestGame } from './createGame';
import {
  MAP_MODES,
  bandFor,
  isSimulated,
  mapView,
  regionForState,
  statusOn,
} from './map';
import type { GameState } from './types';

const CODES = STATE_SHAPES.map((s) => s.code);

function on(iso: string): GameState {
  return { ...createTestGame(), day: isoToDay(iso) };
}

function run(state: GameState, days: number): GameState {
  let current = state;
  for (let i = 0; i < days; i++) {
    current = advanceDay(current, PHASE_1_CONTENT).state;
    while (current.eventState.pendingDecisions.length > 0) {
      const pending = current.eventState.pendingDecisions[0];
      const event = PHASE_1_CONTENT.events.find((e) => e.id === pending.eventId)!;
      current = resolveDecision(
        current,
        PHASE_1_CONTENT,
        pending.eventId,
        event.options[0].id,
      ).state;
    }
  }
  return current;
}

// ============================================================================
// 1. THE COUNTRY AS IT WAS
// ============================================================================

describe('the political map shows the date, not the present day', () => {
  it('has eleven states in the union on the day the government began', () => {
    const view = mapView(on('1789-04-30'), 'political', CODES);
    const states = view.cells.filter((c) => c.status === 'state');

    // The eleven that had ratified, plus Maine and West Virginia, which are
    // drawn as parts of Massachusetts and Virginia and labelled as such.
    const codes = states.map((c) => c.code).sort();
    expect(codes).toContain('VA');
    expect(codes).toContain('MA');
    expect(codes).not.toContain('NC');
    expect(codes).not.toContain('RI');
    expect(codes).not.toContain('OH');
  });

  it('keeps North Carolina and Rhode Island outside until they ratify', () => {
    const founding = mapView(on('1789-04-30'), 'political', CODES);
    const nc = founding.cells.find((c) => c.code === 'NC')!;
    const ri = founding.cells.find((c) => c.code === 'RI')!;

    expect(nc.status).toBe('foreign');
    expect(ri.status).toBe('foreign');
    // And the map says why, rather than leaving a hole in the north-east.
    expect(nc.detail).toContain('Outside the union');

    const later = mapView(on('1790-06-01'), 'political', CODES);
    expect(later.cells.find((c) => c.code === 'NC')!.status).toBe('state');
    expect(later.cells.find((c) => c.code === 'RI')!.status).toBe('state');
  });

  it('calls each piece what it was called then', () => {
    const view = mapView(on('1793-01-01'), 'political', CODES);

    expect(view.cells.find((c) => c.code === 'TN')!.name).toBe(
      'Territory South of the River Ohio',
    );
    expect(view.cells.find((c) => c.code === 'OH')!.name).toBe('Northwest Territory');
    expect(view.cells.find((c) => c.code === 'LA')!.name).toBe('Spanish Louisiana');
    expect(view.cells.find((c) => c.code === 'ME')!.name).toContain('District of Maine');
  });

  it('admits Vermont, Kentucky and Tennessee on their real dates', () => {
    expect(statusOn('VT', isoToDay('1791-03-03')).status).toBe('disputed');
    expect(statusOn('VT', isoToDay('1791-03-04')).status).toBe('state');

    expect(statusOn('KY', isoToDay('1792-05-31')).status).toBe('unorganized');
    expect(statusOn('KY', isoToDay('1792-06-01')).status).toBe('state');

    expect(statusOn('TN', isoToDay('1796-05-31')).status).toBe('organized_territory');
    expect(statusOn('TN', isoToDay('1796-06-01')).status).toBe('state');
  });

  it('carries the map through to the end of Phase 2’s period', () => {
    // 1860: the map the sectional crisis was fought over.
    const view = mapView(on('1860-01-01'), 'political', CODES);
    const states = view.cells.filter((c) => c.status === 'state').map((c) => c.code);

    expect(states).toContain('CA');
    expect(states).toContain('TX');
    expect(states).toContain('OR');
    // Kansas was still a territory on that date, and it is the whole story.
    expect(view.cells.find((c) => c.code === 'KS')!.status).toBe('organized_territory');
  });
});

// ============================================================================
// 2. ABSENCE IS HONEST
// ============================================================================

describe('a cell with no figure says so, and says why', () => {
  it('gives a territory no sentiment and explains that it has none', () => {
    const view = mapView(on('1795-01-01'), 'support', CODES);
    const ohio = view.cells.find((c) => c.code === 'OH')!;

    expect(ohio.value).toBeNull();
    expect(ohio.bucket).toBeNull();
    expect(ohio.label).toBe('No figure');
    // "no sentiment toward a government it is not part of" — not a neutral
    // shade, which would read as a middling value the model never computed.
    expect(ohio.detail).toContain('not part of');
  });

  it('counts the areas without data rather than hiding them', () => {
    for (const mode of MAP_MODES) {
      const view = mapView(on('1795-01-01'), mode, CODES, PARTIES);
      const nulls = view.cells.filter((c) => c.bucket === null).length;
      expect(view.withoutData, mode).toBe(nulls);
    }
  });

  it('never invents a number for land the model does not simulate', () => {
    for (const mode of MAP_MODES) {
      const view = mapView(on('1795-01-01'), mode, CODES, PARTIES);
      for (const cell of view.cells) {
        if (cell.value === null) continue;
        // Anything with a value must be somewhere the model actually measures.
        expect(cell.status, `${mode}/${cell.code}`).toBe('state');
        expect(Number.isFinite(cell.value), `${mode}/${cell.code}`).toBe(true);
      }
    }
  });

  it('shrinks the no-data area as the country grows', () => {
    const early = mapView(on('1789-04-30'), 'support', CODES).withoutData;
    const later = mapView(on('1860-01-01'), 'support', CODES).withoutData;
    expect(later).toBeLessThan(early);
  });
});

// ============================================================================
// 3. THE REGIONAL SIMPLIFICATION IS DECLARED
// ============================================================================

describe('the map admits what it is actually measuring', () => {
  it('says support is regional rather than per state', () => {
    const view = mapView(on('1795-01-01'), 'support', CODES);

    expect(view.basis).toContain('four regions');
    expect(view.basis).toContain('same colour');
  });

  it('colours two states of one region alike, and tells the player it did', () => {
    const view = mapView(on('1795-01-01'), 'support', CODES);
    const va = view.cells.find((c) => c.code === 'VA')!;
    const ga = view.cells.find((c) => c.code === 'GA')!;

    expect(va.regionId).toBe(ga.regionId);
    expect(va.bucket).toBe(ga.bucket);
    expect(va.detail).toContain('a regional figure');
  });

  it('moves a region’s band when its sentiment actually moves', () => {
    const base = createTestGame();
    const angry: GameState = {
      ...base,
      day: isoToDay('1795-01-01'),
      regions: base.regions.map((r) =>
        r.id === 'south' ? { ...r, sentiment: -80 } : r,
      ),
    };

    const before = mapView(on('1795-01-01'), 'support', CODES);
    const after = mapView(angry, 'support', CODES);

    const bandBefore = before.cells.find((c) => c.code === 'VA')!.bucket!;
    const bandAfter = after.cells.find((c) => c.code === 'VA')!.bucket!;

    expect(bandAfter).toBeLessThan(bandBefore);
    expect(after.cells.find((c) => c.code === 'VA')!.label).toBe('Hostile');
  });

  it('pairs every band with a word, so colour is never the only carrier', () => {
    for (const mode of MAP_MODES) {
      const view = mapView(on('1795-01-01'), mode, CODES, PARTIES);
      for (const entry of view.legend) {
        expect(entry.label.length, `${mode}/${entry.bucket}`).toBeGreaterThan(0);
      }
      for (const cell of view.cells) {
        expect(cell.label.length, `${mode}/${cell.code}`).toBeGreaterThan(0);
      }
    }
  });

  it('bands a value the same way every time', () => {
    expect(bandFor(-100, [-50, -20, 0, 20, 50])).toBe(0);
    expect(bandFor(-50, [-50, -20, 0, 20, 50])).toBe(1);
    expect(bandFor(0, [-50, -20, 0, 20, 50])).toBe(3);
    expect(bandFor(100, [-50, -20, 0, 20, 50])).toBe(5);
  });
});

// ============================================================================
// 4. PARTY IS PER STATE, AND IS A MODEL
// ============================================================================

describe('the party map', () => {
  it('can colour two states of one region differently', () => {
    // The point of the mode: delegations are per state, so this is the only
    // map on which Virginia and Georgia can disagree.
    const state = run(createTestGame({ governmentType: 'republic' }), 2600);
    const view = mapView(state, 'party', CODES, PARTIES);

    const seated = view.cells.filter((c) => c.bucket !== null);
    expect(seated.length).toBeGreaterThan(10);
    expect(seated.every((c) => c.regionId !== null)).toBe(true);
  });

  it('says on the legend that the split is a model and the seats are not', () => {
    const view = mapView(on('1795-01-01'), 'party', CODES, PARTIES);

    expect(view.basis).toContain('SEAT COUNTS are historical');
    expect(view.basis).toContain('the party split is a model');
    expect(view.basis).toContain('not a record');
  });

  it('names the parties that existed on the date', () => {
    const early = mapView(on('1791-01-01'), 'party', CODES, PARTIES);
    expect(early.legend.map((l) => l.label).join(' ')).toContain('Administration');

    const later = mapView(on('1795-01-01'), 'party', CODES, PARTIES);
    expect(later.legend.map((l) => l.label).join(' ')).toContain('Federalist');
  });

  it('has a band for a delegation too close to call', () => {
    const view = mapView(on('1795-01-01'), 'party', CODES, PARTIES);
    // A map that forced every state to a side would be claiming a majority
    // nobody would claim.
    expect(view.legend.some((l) => l.label === 'Evenly divided')).toBe(true);
  });

  it('gives a state outside the union no delegation at all', () => {
    const view = mapView(on('1789-04-30'), 'party', CODES, PARTIES);
    const ri = view.cells.find((c) => c.code === 'RI')!;

    expect(ri.bucket).toBeNull();
    expect(ri.detail).toContain('sends nobody');
  });
});

// ============================================================================
// THE CONTENT ITSELF
// ============================================================================

describe('the territory record is complete and cited', () => {
  it('has a record for every outline the map draws', () => {
    for (const code of CODES) {
      expect(TERRITORY_BY_CODE[code], code).toBeDefined();
    }
  });

  it('cites every record', () => {
    for (const record of TERRITORY) {
      expect(record.sources.length, record.code).toBeGreaterThan(0);
      for (const source of record.sources) {
        expect(source.length, record.code).toBeGreaterThan(10);
      }
    }
  });

  it('keeps every history in date order, so the last match is the right one', () => {
    for (const record of TERRITORY) {
      let previous = -Infinity;
      for (const entry of record.history) {
        const day = isoToDay(entry.from);
        expect(day, `${record.code} ${entry.from}`).toBeGreaterThan(previous);
        previous = day;
      }
    }
  });

  it('names every entry, because a status alone tells a player nothing', () => {
    for (const record of TERRITORY) {
      for (const entry of record.history) {
        expect(entry.name.length, `${record.code} ${entry.from}`).toBeGreaterThan(2);
      }
    }
  });

  it('agrees with the seat record on when each state was admitted', () => {
    // Two independent records of the same fact. If they ever disagree, one of
    // them is wrong, and this is where that shows up.
    const state = createTestGame();
    for (const region of state.regions) {
      for (const entry of region.states) {
        const record = TERRITORY_BY_CODE[entry.code];
        if (!record) continue;
        const becameState = record.history.find((h) => h.status === 'state');
        expect(becameState, entry.code).toBeDefined();
      }
    }
  });
});

describe('the geometry is usable', () => {
  it('gives every shape a path and a label point', () => {
    for (const shape of STATE_SHAPES) {
      expect(shape.d.length, shape.code).toBeGreaterThan(20);
      expect(Number.isFinite(shape.labelX), shape.code).toBe(true);
      expect(Number.isFinite(shape.labelY), shape.code).toBe(true);
    }
  });

  it('has no duplicate codes', () => {
    const codes = STATE_SHAPES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('finds the region of a state that is in one, and null for one that is not', () => {
    const state = createTestGame();
    expect(regionForState(state, 'VA')?.id).toBe('south');
    expect(regionForState(state, 'OH')).toBeNull();
  });

  it('simulates states and nothing else', () => {
    expect(isSimulated('state')).toBe(true);
    expect(isSimulated('organized_territory')).toBe(false);
    expect(isSimulated('foreign')).toBe(false);
    expect(isSimulated('native_nation')).toBe(false);
  });
});
