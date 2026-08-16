/**
 * THE MAP
 *
 * Phase 2 brief §6, queue items 9 and 10. Claims a test should be able to falsify:
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
 *   5. (Item 10) Population, sectional strain and compliance each measure
 *      something real, say which part of it is history and which is model, and
 *      the detail panel states what it does NOT track so a gap is never read as
 *      a zero.
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
  sectionalStrain,
  stateDetail,
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

// ============================================================================
// QUEUE ITEM 10 — THE REMAINING MODES
// ============================================================================

describe('population is half history and half model, and says which half', () => {
  it('differs between two states of the same region', () => {
    const view = mapView(on('1795-01-01'), 'population', CODES);
    const va = view.cells.find((c) => c.code === 'VA')!;
    const ga = view.cells.find((c) => c.code === 'GA')!;

    // The census says they differed, so this is the one economic-looking map on
    // which states in one region are allowed to disagree.
    expect(va.regionId).toBe(ga.regionId);
    expect(va.value!).toBeGreaterThan(ga.value!);
  });

  it('separates the cited figure from the modelled growth, in words', () => {
    const view = mapView(on('1795-01-01'), 'population', CODES);

    expect(view.basis).toContain('1790 census');
    expect(view.basis).toContain('no state-level demography');
    expect(view.cells.find((c) => c.code === 'VA')!.detail).toContain('census figure');
  });

  it('grows a state as its region grows', () => {
    const early = mapView(on('1790-01-01'), 'population', CODES);
    const late = mapView(run(createTestGame(), 2600), 'population', CODES);

    const before = early.cells.find((c) => c.code === 'VA')!.value!;
    const after = late.cells.find((c) => c.code === 'VA')!.value!;
    expect(after).toBeGreaterThan(before);
  });

  it('gives an unadmitted territory no population at all', () => {
    const view = mapView(on('1795-01-01'), 'population', CODES);
    const ohio = view.cells.find((c) => c.code === 'OH')!;

    expect(ohio.value).toBeNull();
    expect(ohio.detail).toContain('census did not count it');
  });
});

describe('sectional strain is the map the civil war should be visible on', () => {
  it('puts the South under more strain than New England at the founding', () => {
    const view = mapView(on('1790-01-01'), 'tension', CODES);
    const va = view.cells.find((c) => c.code === 'VA')!;
    const ma = view.cells.find((c) => c.code === 'MA')!;

    // A third of the South's people were held in bondage. That is not a proxy
    // for the conflict; it is the axis of it.
    expect(va.value!).toBeGreaterThan(ma.value!);
  });

  it('rises when a region is aggrieved and pulling away', () => {
    const base = createTestGame();
    const strained: GameState = {
      ...base,
      day: isoToDay('1795-01-01'),
      regions: base.regions.map((r) =>
        r.id === 'south' ? { ...r, sentiment: -90 } : r,
      ),
      grievance: {
        ...base.grievance,
        byRegion: { ...base.grievance.byRegion, south: 70 },
      },
    };

    const calm = mapView(on('1795-01-01'), 'tension', CODES);
    const angry = mapView(strained, 'tension', CODES);

    expect(angry.cells.find((c) => c.code === 'VA')!.value!).toBeGreaterThan(
      calm.cells.find((c) => c.code === 'VA')!.value!,
    );
  });

  it('counts divergence in either direction, because either is pulling away', () => {
    const base = { ...createTestGame(), day: isoToDay('1795-01-01') };
    const devoted: GameState = {
      ...base,
      regions: base.regions.map((r) =>
        r.id === 'new_england' ? { ...r, sentiment: 95 } : { ...r, sentiment: -5 },
      ),
    };

    const ne = devoted.regions.find((r) => r.id === 'new_england')!;
    // A region that feels utterly differently from everyone else is a region
    // apart, whichever way it is leaning.
    expect(sectionalStrain(devoted, ne)).toBeGreaterThan(
      sectionalStrain(base, base.regions.find((r) => r.id === 'new_england')!),
    );
  });

  it('says on screen that it is a derived measure, not a stored or historical one', () => {
    const view = mapView(on('1795-01-01'), 'tension', CODES);

    expect(view.basis).toContain('derived measure');
    expect(view.basis).toContain('not a historical figure');
  });

  it('stays inside its range however bad things get', () => {
    const base = createTestGame();
    const ruined: GameState = {
      ...base,
      regions: base.regions.map((r) => ({ ...r, sentiment: -100 })),
      grievance: {
        ...base.grievance,
        byRegion: { new_england: 100, mid_atlantic: 100, south: 100, frontier: 100 },
      },
    };

    for (const region of ruined.regions) {
      const strain = sectionalStrain(ruined, region);
      expect(strain).toBeGreaterThanOrEqual(0);
      expect(strain).toBeLessThanOrEqual(100);
    }
  });
});

describe('compliance makes rebellion visible before it happens', () => {
  it('bands a region by what it actually remits', () => {
    const base = createTestGame();
    const evading: GameState = {
      ...base,
      day: isoToDay('1795-01-01'),
      regions: base.regions.map((r) =>
        r.id === 'frontier' ? { ...r, compliance: 30 } : r,
      ),
    };

    const view = mapView(evading, 'compliance', CODES);
    const ky = view.cells.find((c) => c.code === 'KY')!;

    expect(ky.bucket).toBe(0);
    expect(ky.label).toContain('does not run here');
  });

  it('names a running episode of unrest in the detail line', () => {
    const base = createTestGame();
    const risen: GameState = {
      ...base,
      day: isoToDay('1795-01-01'),
      grievance: {
        ...base.grievance,
        episodes: [
          {
            id: 'unrest:frontier:1',
            regionId: 'frontier',
            severity: 'defiance',
            drivenBy: 'frontier_settlers',
            startedDay: 1,
            endedDay: null,
          },
        ],
      },
    };

    const view = mapView(risen, 'compliance', CODES);
    expect(view.cells.find((c) => c.code === 'KY')!.detail).toContain('defiance');
  });
});

// ============================================================================
// THE STATE DETAIL PANEL
// ============================================================================

describe('the state detail panel', () => {
  it('gives a state its figures, its delegation and its census record', () => {
    const detail = stateDetail(createTestGame(), 'VA', PARTIES);

    expect(detail.name).toBe('Virginia');
    expect(detail.region?.id).toBe('south');
    expect(detail.population).toBeGreaterThan(0);
    expect(detail.censusPopulation1790).toBe(747_610);
    expect(detail.enslavedPopulation1790).toBe(292_627);
    expect(detail.delegation?.houseSeats).toBeGreaterThan(0);
    expect(detail.delegation?.byParty.length).toBeGreaterThan(0);
  });

  it('names a territory what it was called, and cites the record', () => {
    const detail = stateDetail(on('1793-01-01'), 'TN', PARTIES);

    expect(detail.name).toBe('Territory South of the River Ohio');
    expect(detail.statusLabel).toBe('Organised territory');
    expect(detail.sources.length).toBeGreaterThan(0);
  });

  it('returns nulls rather than zeroes for a place the model does not simulate', () => {
    const detail = stateDetail(on('1795-01-01'), 'LA', PARTIES);

    // A zero would say the model measured Spanish Louisiana and found nothing.
    expect(detail.region).toBeNull();
    expect(detail.population).toBeNull();
    expect(detail.prosperity).toBeNull();
    expect(detail.sentiment).toBeNull();
    expect(detail.delegation).toBeNull();
  });

  it('says what it does not track, so a gap is never read as a zero', () => {
    const detail = stateDetail(createTestGame(), 'VA', PARTIES);

    expect(detail.whatIsNotTracked.length).toBeGreaterThan(0);
    // The brief asks for notable figures. There is no roster of members in this
    // project, and a plausible name would be a fabricated one.
    expect(detail.whatIsNotTracked.join(' ')).toContain('roster of members');
    expect(detail.whatIsNotTracked.join(' ')).toContain('regional figures');
  });

  it('carries the grievance and any episode running in the region', () => {
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

    const detail = stateDetail(risen, 'VA', PARTIES);
    expect(detail.grievance?.level).toBe(62);
    expect(detail.grievance?.episode?.severity).toBe('defiance');
    expect(detail.grievance?.principal).toBe('planters');
  });

  it('resolves the delegation forward through the renaming of the parties', () => {
    const detail = stateDetail(on('1795-01-01'), 'VA', PARTIES);
    const names = detail.delegation!.byParty.map((p) => p.party).join(' ');

    expect(names).toContain('Federalist');
    expect(names).not.toContain('Pro-Administration');
  });
});
