/**
 * THE MAP, AS SIMULATION DATA
 *
 * Phase 2 brief §6. The map replaces the Desk as the main view, and this is the
 * part of it that belongs in `src/sim/`: what colour each piece of the country
 * should be, in words and buckets, for a given mode on a given day.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS HERE AND NOT IN THE COMPONENT
 *
 * DESIGN.md Rule 7: the UI is a renderer, and derived simulation numbers come
 * from `src/sim/`. So this module answers "how strongly does Virginia back the
 * government, and what word describes that" and returns a BUCKET INDEX; the
 * component turns a bucket into a design token. Nothing here knows a colour,
 * and nothing there does arithmetic.
 *
 * TWO HONESTY REQUIREMENTS THIS MODULE ENFORCES
 *
 * 1. A cell with no value returns `value: null` and says why. The brief is
 *    explicit: "no quiet interpolation to make a map mode look complete." A
 *    state outside the union has no sentiment toward a government it is not
 *    part of, and the map says so instead of shading it neutral.
 *
 * 2. MOST FIGURES ARE REGIONAL, NOT PER-STATE, and the map admits it. This
 *    model has four regions and no state-level economy. Colouring Virginia and
 *    Georgia identically because they share a region is a simplification; it is
 *    reported in `MapView.basis` and shown on screen. The one genuinely
 *    per-state mode is party, because delegations are per state.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Pure. No React, no DOM, no clock.
 */

import {
  TERRITORY_BY_CODE,
  type TerritoryStatus,
} from '@/content/map/territory';
import { isoToDay } from './calendar';
import { partiesOn, resolveParty, sharesIn } from './congress';
import type { GameState, Party, Region } from './types';

export type MapMode =
  | 'political'
  | 'support'
  | 'economic'
  | 'party'
  | 'population'
  | 'tension'
  | 'compliance';

export const MAP_MODES: readonly MapMode[] = [
  'political',
  'support',
  'economic',
  'party',
  'population',
  'tension',
  'compliance',
];

export const MAP_MODE_LABEL: Record<MapMode, string> = {
  political: 'Political',
  support: 'Support',
  economic: 'Economic',
  party: 'Party',
  population: 'Population',
  tension: 'Sectional strain',
  compliance: 'Compliance',
};

export const MAP_MODE_DESCRIPTION: Record<MapMode, string> = {
  political: 'What each piece of the country is, and who governs it',
  support: 'How strongly each state backs the government',
  economic: 'Output per head, and what the region lives on',
  party: 'Which interest holds each delegation',
  population: 'How many people live where',
  tension: 'How far each region’s interests diverge from the union’s',
  compliance: 'How much of what is assessed is actually remitted',
};

export interface MapCell {
  /** Postal code of the modern outline this colours. */
  code: string;
  /** What it was CALLED on this day. "Southwest Territory", not "Tennessee". */
  name: string;
  status: TerritoryStatus;
  /** The region whose figures this cell borrows, or null if it is outside the union. */
  regionId: string | null;
  /** The mode's number, or null when there is honestly none. */
  value: number | null;
  /** Index into `MapView.legend`, or null for the no-data treatment. */
  bucket: number | null;
  /** The word the colour means. Meaning is never carried by colour alone. */
  label: string;
  /** One line for the hover, saying where the number came from or why there is none. */
  detail: string;
}

export interface LegendEntry {
  /** Bucket index, matching `MapCell.bucket`. */
  bucket: number;
  label: string;
}

export interface MapView {
  mode: MapMode;
  cells: MapCell[];
  legend: LegendEntry[];
  /** What the colouring is actually measuring, stated for the player. */
  basis: string;
  /** How many cells have no value in this mode. Shown, never hidden. */
  withoutData: number;
}

// ============================================================================
// TERRITORY
// ============================================================================

/** What a piece of the map was on `day`. */
export function statusOn(
  code: string,
  day: number,
): { status: TerritoryStatus; name: string; note: string | null } {
  const record = TERRITORY_BY_CODE[code];
  if (!record) {
    // An outline with no record is unorganised and unclaimed as far as the
    // United States is concerned, which is the honest default rather than an
    // error — and the content test asserts every drawn outline has a record.
    return { status: 'unorganized', name: 'Unorganised territory', note: null };
  }

  let current: { status: TerritoryStatus; name: string; note: string | null } = {
    status: 'unorganized',
    name: 'Unorganized territory',
    note: null,
  };

  for (const entry of record.history) {
    if (day >= isoToDay(entry.from)) {
      current = { status: entry.status, name: entry.name, note: entry.note ?? null };
    }
  }

  return current;
}

/** Is this cell part of the United States on `day`, in a way the model simulates? */
export function isSimulated(status: TerritoryStatus): boolean {
  return status === 'state';
}

export const STATUS_LABEL: Record<TerritoryStatus, string> = {
  state: 'State of the union',
  organized_territory: 'Organised territory',
  unorganized: 'Unorganised',
  petitioning: 'Petitioning for statehood',
  foreign: 'Foreign power',
  disputed: 'Disputed',
  native_nation: 'Sovereign Native nation',
};

/** Fixed order, so the legend never reshuffles as the country grows. */
const STATUS_ORDER: readonly TerritoryStatus[] = [
  'state',
  'petitioning',
  'organized_territory',
  'unorganized',
  'disputed',
  'native_nation',
  'foreign',
];

// ============================================================================
// WHICH REGION A STATE BELONGS TO
// ============================================================================

/**
 * The region a state's figures come from, or null.
 *
 * Null is a real answer, not a failure: Ohio in 1795 is in the Northwest
 * Territory, and this model has no figures for it because it does not simulate
 * territories. Returning a neighbour's numbers would be exactly the quiet
 * interpolation the brief forbids.
 */
export function regionForState(
  state: GameState,
  code: string,
): Region | null {
  for (const region of state.regions) {
    if (region.states.some((s) => s.code === code)) return region;
  }
  return null;
}

// ============================================================================
// BUCKETING
// ============================================================================

/**
 * Which band a value falls in, given ascending thresholds.
 *
 * Bands rather than a continuous ramp, deliberately: a continuous scale on a
 * choropleth is unreadable and invites the eye to see precision that is not
 * there — especially when the underlying figure is regional rather than
 * per-state. Six bands is what a reader can hold. (UI.md §10)
 */
export function bandFor(value: number, thresholds: readonly number[]): number {
  let band = 0;
  for (const threshold of thresholds) {
    if (value >= threshold) band++;
  }
  return band;
}

const SUPPORT_THRESHOLDS = [-50, -20, 0, 20, 50];
const SUPPORT_WORDS = [
  'Hostile',
  'Disaffected',
  'Cool',
  'Content',
  'Warm',
  'Devoted',
];

const ECONOMIC_THRESHOLDS = [30, 45, 55, 70, 85];
const ECONOMIC_WORDS = [
  'Very poor',
  'Poor',
  'Middling',
  'Comfortable',
  'Prosperous',
  'Rich',
];

/** People. Bands chosen so the 1790 states spread across them rather than clumping. */
const POPULATION_THRESHOLDS = [60_000, 150_000, 280_000, 450_000, 700_000];
const POPULATION_WORDS = [
  'Very small',
  'Small',
  'Middling',
  'Large',
  'Very large',
  'The largest in the union',
];

const TENSION_THRESHOLDS = [10, 25, 40, 60, 80];
const TENSION_WORDS = [
  'At ease in the union',
  'Slight strain',
  'Noticeable strain',
  'Serious strain',
  'Severe strain',
  'Barely in the union',
];

const COMPLIANCE_THRESHOLDS = [40, 60, 75, 88, 96];
const COMPLIANCE_WORDS = [
  'Federal law does not run here',
  'Widely evaded',
  'Poor',
  'Patchy',
  'Good',
  'Nearly complete',
];

// ============================================================================
// THE VIEW
// ============================================================================

/**
 * Everything the map needs to draw one mode.
 *
 * `codes` is the list of outlines the map can draw — passed in rather than
 * imported, so this module never depends on the generated geometry and stays
 * testable without it.
 */
export function mapView(
  state: GameState,
  mode: MapMode,
  codes: readonly string[],
  parties: readonly Party[] = [],
): MapView {
  switch (mode) {
    case 'political':
      return politicalView(state, codes);
    case 'support':
      return supportView(state, codes);
    case 'economic':
      return economicView(state, codes);
    case 'party':
      return partyView(state, codes, parties);
    case 'population':
      return populationView(state, codes);
    case 'tension':
      return tensionView(state, codes);
    case 'compliance':
      return complianceView(state, codes);
  }
}

function politicalView(state: GameState, codes: readonly string[]): MapView {
  const cells: MapCell[] = codes.map((code) => {
    const { status, name, note } = statusOn(code, state.day);
    const region = isSimulated(status) ? regionForState(state, code) : null;

    return {
      code,
      name,
      status,
      regionId: region?.id ?? null,
      value: null,
      bucket: STATUS_ORDER.indexOf(status),
      label: STATUS_LABEL[status],
      detail: note ?? STATUS_LABEL[status],
    };
  });

  return {
    mode: 'political',
    cells,
    legend: STATUS_ORDER.map((status, i) => ({
      bucket: i,
      label: STATUS_LABEL[status],
    })),
    basis:
      'What each piece of the country was on this date, from the sourced record ' +
      'in src/content/map/territory.ts. Outlines are modern; the labels are not.',
    withoutData: 0,
  };
}

function supportView(state: GameState, codes: readonly string[]): MapView {
  let withoutData = 0;

  const cells: MapCell[] = codes.map((code) => {
    const { status, name } = statusOn(code, state.day);
    const region = isSimulated(status) ? regionForState(state, code) : null;

    if (!region) {
      withoutData++;
      return {
        code,
        name,
        status,
        regionId: null,
        value: null,
        bucket: null,
        label: 'No figure',
        detail:
          status === 'state'
            ? 'In the union, but outside the four regions this model simulates.'
            : `${STATUS_LABEL[status]} — it has no sentiment toward a government it is not part of.`,
      };
    }

    const band = bandFor(region.sentiment, SUPPORT_THRESHOLDS);
    return {
      code,
      name,
      status,
      regionId: region.id,
      value: region.sentiment,
      bucket: band,
      label: SUPPORT_WORDS[band],
      detail: `${region.name}: ${region.sentiment.toFixed(0)} — a regional figure, not ${name}’s own.`,
    };
  });

  return {
    mode: 'support',
    cells,
    legend: SUPPORT_WORDS.map((label, i) => ({ bucket: i, label })),
    basis:
      'Regional sentiment toward the federal government, −100 to +100. This model ' +
      'has four regions and no state-level sentiment, so every state in a region ' +
      'is the same colour.',
    withoutData,
  };
}

function economicView(state: GameState, codes: readonly string[]): MapView {
  let withoutData = 0;

  const cells: MapCell[] = codes.map((code) => {
    const { status, name } = statusOn(code, state.day);
    const region = isSimulated(status) ? regionForState(state, code) : null;

    if (!region) {
      withoutData++;
      return {
        code,
        name,
        status,
        regionId: null,
        value: null,
        bucket: null,
        label: 'No figure',
        detail: `${STATUS_LABEL[status]} — this model measures no economy outside the union.`,
      };
    }

    const band = bandFor(region.prosperity, ECONOMIC_THRESHOLDS);
    return {
      code,
      name,
      status,
      regionId: region.id,
      value: region.prosperity,
      bucket: band,
      label: ECONOMIC_WORDS[band],
      detail: `${region.name}: prosperity ${region.prosperity.toFixed(0)}, on ${region.dominantIndustry.toLowerCase()}.`,
    };
  });

  return {
    mode: 'economic',
    cells,
    legend: ECONOMIC_WORDS.map((label, i) => ({ bucket: i, label })),
    basis:
      'Regional prosperity, an index of output per head against the founding ' +
      'baseline. Regional, not per-state, for the same reason as support.',
    withoutData,
  };
}

/**
 * A state's people today.
 *
 * THE ONLY PER-STATE DEMOGRAPHY THIS MODEL HAS, and it is half history and half
 * model, so it says which half is which. The 1790 census figures are real and
 * cited (`src/content/regions/regions1790.ts`); the growth applied to them is
 * the REGION'S, because the simulation has no state-level demography.
 *
 * So Virginia and Georgia differ here — the census says they did — but they
 * grow at the same rate, which is a stated simplification rather than a claim
 * about differential migration.
 */
export function statePopulation(region: Region, code: string): number | null {
  const entry = region.states.find((s) => s.code === code);
  if (!entry) return null;

  const censusTotal = region.states.reduce((sum, s) => sum + s.population1790, 0);
  if (censusTotal <= 0) return entry.population1790;

  return entry.population1790 * (region.population / censusTotal);
}

/**
 * How far a region's interests have diverged from the union's.
 *
 * THE MODE THE BRIEF ASKS THE MOST OF: "the map mode that should make the
 * coming Civil War legible decades in advance." Three terms, each a real
 * simulated quantity, each pulling in the direction the history actually went:
 *
 *   1. THE ENSLAVED SHARE. Not a proxy for the conflict — it IS the axis of it.
 *      A region a third of whose people are held in bondage has an interest
 *      that cannot be reconciled with one where almost none are, and every
 *      compromise from 1787 to 1860 was an attempt to postpone that.
 *   2. DIVERGENCE OF SENTIMENT from the national mean. A region that feels
 *      differently about the federal government from everyone else is a region
 *      pulling away, whichever direction it is pulling in — so this is an
 *      absolute distance, not a signed one.
 *   3. GRIEVANCE. What the government has actually done to the people here.
 *
 * This is a DERIVED PRESENTATION MEASURE, not a stored stat and not a
 * historical figure: it is computed from simulated values for the purpose of
 * colouring a map, and `MapView.basis` says so on screen. (ECONOMY.md §7.22)
 */
export function sectionalStrain(state: GameState, region: Region): number {
  const enslavedShare = region.enslavedPopulation / Math.max(1, region.population);

  const meanSentiment =
    state.regions.reduce((sum, r) => sum + r.sentiment, 0) /
    Math.max(1, state.regions.length);
  const divergence = Math.abs(region.sentiment - meanSentiment);

  const grievance = state.grievance.byRegion[region.id] ?? 0;

  const raw = enslavedShare * 130 + divergence * 0.55 + grievance * 0.45;
  return Math.max(0, Math.min(100, raw));
}

function populationView(state: GameState, codes: readonly string[]): MapView {
  let withoutData = 0;

  const cells: MapCell[] = codes.map((code) => {
    const { status, name } = statusOn(code, state.day);
    const region = isSimulated(status) ? regionForState(state, code) : null;
    const people = region ? statePopulation(region, code) : null;

    if (!region || people === null) {
      withoutData++;
      return {
        code,
        name,
        status,
        regionId: region?.id ?? null,
        value: null,
        bucket: null,
        label: 'No figure',
        detail:
          status === 'state'
            ? 'In the union, but no census figure exists for it in this model.'
            : `${STATUS_LABEL[status]} — the census did not count it.`,
      };
    }

    const band = bandFor(people, POPULATION_THRESHOLDS);
    return {
      code,
      name,
      status,
      regionId: region.id,
      value: people,
      bucket: band,
      label: POPULATION_WORDS[band],
      detail: `${Math.round(people).toLocaleString('en-US')} people — the 1790 census figure, grown at ${region.name}’s rate.`,
    };
  });

  return {
    mode: 'population',
    cells,
    legend: POPULATION_WORDS.map((label, i) => ({ bucket: i, label })),
    basis:
      'Half history, half model, and the halves are separable: the 1790 census ' +
      'figures are real and cited, and the growth applied to them is the ' +
      'REGION’S, because this model has no state-level demography.',
    withoutData,
  };
}

function tensionView(state: GameState, codes: readonly string[]): MapView {
  let withoutData = 0;

  const cells: MapCell[] = codes.map((code) => {
    const { status, name } = statusOn(code, state.day);
    const region = isSimulated(status) ? regionForState(state, code) : null;

    if (!region) {
      withoutData++;
      return {
        code,
        name,
        status,
        regionId: null,
        value: null,
        bucket: null,
        label: 'No figure',
        detail: `${STATUS_LABEL[status]} — it is not in the union to be strained by it.`,
      };
    }

    const strain = sectionalStrain(state, region);
    const band = bandFor(strain, TENSION_THRESHOLDS);
    const enslaved = region.enslavedPopulation / Math.max(1, region.population);

    return {
      code,
      name,
      status,
      regionId: region.id,
      value: strain,
      bucket: band,
      label: TENSION_WORDS[band],
      detail:
        `${region.name}: ${(enslaved * 100).toFixed(0)}% of its people are enslaved, ` +
        `sentiment ${region.sentiment.toFixed(0)}, grievance ${(state.grievance.byRegion[region.id] ?? 0).toFixed(0)}.`,
    };
  });

  return {
    mode: 'tension',
    cells,
    legend: TENSION_WORDS.map((label, i) => ({ bucket: i, label })),
    basis:
      'A derived measure, not a stored stat and not a historical figure: the ' +
      'enslaved share of a region’s people, how far its sentiment has diverged ' +
      'from the union’s, and what the government has done to it. The first term ' +
      'is the axis the conflict was actually fought on.',
    withoutData,
  };
}

function complianceView(state: GameState, codes: readonly string[]): MapView {
  let withoutData = 0;

  const cells: MapCell[] = codes.map((code) => {
    const { status, name } = statusOn(code, state.day);
    const region = isSimulated(status) ? regionForState(state, code) : null;

    if (!region) {
      withoutData++;
      return {
        code,
        name,
        status,
        regionId: null,
        value: null,
        bucket: null,
        label: 'No figure',
        detail: `${STATUS_LABEL[status]} — nothing is assessed here to be remitted.`,
      };
    }

    const band = bandFor(region.compliance, COMPLIANCE_THRESHOLDS);
    const episode = state.grievance.episodes.find(
      (e) => e.regionId === region.id && e.endedDay === null,
    );

    return {
      code,
      name,
      status,
      regionId: region.id,
      value: region.compliance,
      bucket: band,
      label: COMPLIANCE_WORDS[band],
      detail: episode
        ? `${region.name}: ${region.compliance.toFixed(0)}% remitted, and ${episode.severity} is running.`
        : `${region.name}: ${region.compliance.toFixed(0)}% of what is assessed is actually remitted.`,
    };
  });

  return {
    mode: 'compliance',
    cells,
    legend: COMPLIANCE_WORDS.map((label, i) => ({ bucket: i, label })),
    basis:
      'The share of assessed federal revenue a region actually remits. This is ' +
      'where a collapse of legitimacy becomes a collapse of receipts, so it is ' +
      'the map on which rebellion is visible before it happens.',
    withoutData,
  };
}

/**
 * Which interest holds each delegation.
 *
 * THE ONE GENUINELY PER-STATE MODE, because delegations are per state: Virginia
 * and Georgia can be different colours here and cannot be anywhere else. It is
 * also the one that is explicitly a model rather than a record — the seat counts
 * are history, the party split is not (BLOCKERS.md B-006), and the legend says
 * so.
 */
function partyView(
  state: GameState,
  codes: readonly string[],
  parties: readonly Party[],
): MapView {
  const live = partiesOn(parties, state.day);
  const byCode = new Map(state.congress.delegations.map((d) => [d.stateCode, d]));

  // A stable legend: whichever parties exist today, in their content order,
  // then a band for a delegation too evenly split to call.
  const legend: LegendEntry[] = live.map((p, i) => ({ bucket: i, label: p.name }));
  legend.push({ bucket: live.length, label: 'Evenly divided' });

  let withoutData = 0;

  const cells: MapCell[] = codes.map((code) => {
    const { status, name } = statusOn(code, state.day);
    const delegation = byCode.get(code);

    if (!delegation || delegation.houseSeats === 0) {
      withoutData++;
      return {
        code,
        name,
        status,
        regionId: null,
        value: null,
        bucket: null,
        label: 'No delegation',
        detail:
          status === 'state'
            ? 'In the union, but sends no members in this model.'
            : `${STATUS_LABEL[status]} — it sends nobody to Congress.`,
      };
    }

    // Resolved forward, so a delegation seated as Pro-Administration still
    // counts once that interest has become the Federalists.
    const byParty: Record<string, number> = {};
    for (const [recordedId, share] of Object.entries(sharesIn(delegation, 'house'))) {
      const party = resolveParty(recordedId, live);
      if (!party) continue;
      byParty[party.id] = (byParty[party.id] ?? 0) + share;
    }

    const ranked = live
      .map((p) => ({ party: p, share: byParty[p.id] ?? 0 }))
      .sort((a, b) => b.share - a.share);

    const leader = ranked[0];
    const runnerUp = ranked[1];
    const margin = leader.share - (runnerUp?.share ?? 0);

    // Under six points is not a majority anyone would claim on a map.
    const divided = margin < 0.06;
    const bucket = divided ? live.length : live.indexOf(leader.party);

    return {
      code,
      name,
      status,
      regionId: delegation.regionId,
      value: leader.share * 100,
      bucket,
      label: divided ? 'Evenly divided' : leader.party.name,
      detail: divided
        ? `${name}: ${ranked.map((r) => `${r.party.shortName} ${(r.share * 100).toFixed(0)}%`).join(', ')} — too close to call.`
        : `${name}: ${leader.party.shortName} ${(leader.share * 100).toFixed(0)}% of ${delegation.houseSeats} seats.`,
    };
  });

  return {
    mode: 'party',
    cells,
    legend,
    basis:
      'Which interest holds each delegation. The SEAT COUNTS are historical and ' +
      'cited; the party split is a model derived from each region’s economy and ' +
      'its sentiment — not a record of how any state actually voted.',
    withoutData,
  };
}

// ============================================================================
// THE STATE DETAIL PANEL (brief §6.2)
// ============================================================================

/**
 * "Clicking a state opens a detail panel: population, economy, sentiment,
 *  delegation, active grievances, notable figures."
 *
 * Five of those six exist in the model and are returned here. The sixth —
 * NOTABLE FIGURES — does not: this project has cabinet officers and their
 * tenures, which are national, and no roster of who represented which state.
 * Rather than fill the slot with a plausible name, `notableFigures` returns what
 * IS known and `whatIsNotTracked` says what is not. Inventing a delegate would
 * be the one rule with no exceptions, broken for a subheading.
 */
export interface StateDetail {
  code: string;
  /** What it was called on this day. */
  name: string;
  /** The modern name of the outline, when it differs from what it was called. */
  modernName: string;
  status: TerritoryStatus;
  statusLabel: string;
  /** Why the simple answer would mislead, where there is such a reason. */
  note: string | null;
  sources: readonly string[];

  region: { id: string; name: string; dominantIndustry: string } | null;

  /** Every figure is null when the model has none. Nothing here is a guess. */
  population: number | null;
  enslavedPopulation1790: number | null;
  censusPopulation1790: number | null;
  prosperity: number | null;
  sentiment: number | null;
  compliance: number | null;
  sectionalStrain: number | null;

  delegation: {
    houseSeats: number;
    senateSeats: number;
    /** Party name to share of the delegation, resolved to the parties of today. */
    byParty: Array<{ party: string; share: number }>;
  } | null;

  grievance: {
    level: number;
    /** The bloc most responsible, in plain words, or null when there is none. */
    principal: string | null;
    /** A running episode, or null. */
    episode: { severity: string; startedDay: number } | null;
  } | null;

  /** Stated plainly, so an empty row is never mistaken for a zero. */
  whatIsNotTracked: string[];
}

export function stateDetail(
  state: GameState,
  code: string,
  parties: readonly Party[] = [],
): StateDetail {
  const { status, name, note } = statusOn(code, state.day);
  const record = TERRITORY_BY_CODE[code];
  const region = isSimulated(status) ? regionForState(state, code) : null;
  const entry = region?.states.find((s) => s.code === code) ?? null;

  const live = partiesOn(parties, state.day);
  const seated = state.congress.delegations.find((d) => d.stateCode === code) ?? null;

  let delegation: StateDetail['delegation'] = null;
  if (seated) {
    const byParty: Record<string, number> = {};
    for (const [recordedId, share] of Object.entries(sharesIn(seated, 'house'))) {
      const party = resolveParty(recordedId, live);
      if (!party) continue;
      byParty[party.name] = (byParty[party.name] ?? 0) + share;
    }
    delegation = {
      houseSeats: seated.houseSeats,
      senateSeats: seated.senateSeats,
      byParty: Object.entries(byParty)
        .map(([party, share]) => ({ party, share }))
        .sort((a, b) => b.share - a.share),
    };
  }

  let grievance: StateDetail['grievance'] = null;
  if (region) {
    const level = state.grievance.byRegion[region.id] ?? 0;
    const episode =
      state.grievance.episodes.find(
        (e) => e.regionId === region.id && e.endedDay === null,
      ) ?? null;

    if (level >= 1 || episode) {
      grievance = {
        level,
        principal: episode ? episode.drivenBy.replace(/_/g, ' ') : null,
        episode: episode
          ? { severity: episode.severity, startedDay: episode.startedDay }
          : null,
      };
    } else {
      grievance = { level, principal: null, episode: null };
    }
  }

  const notTracked: string[] = [];
  // Written as facts about the MODEL, not apologies. A player who knows what is
  // not simulated can tell a gap from a zero.
  notTracked.push('Who represented this state. The model has no roster of members.');
  if (region) {
    notTracked.push(
      'Its own economy. Output, prosperity and sentiment are regional figures ' +
        `shared with the rest of ${region.name}.`,
    );
  }
  notTracked.push('Roads, ports and garrisons. Nothing is tracked by state.');

  return {
    code,
    name,
    modernName: record ? code : code,
    status,
    statusLabel: STATUS_LABEL[status],
    note,
    sources: record?.sources ?? [],
    region: region
      ? { id: region.id, name: region.name, dominantIndustry: region.dominantIndustry }
      : null,
    population: region ? statePopulation(region, code) : null,
    enslavedPopulation1790: entry?.enslavedPopulation1790 ?? null,
    censusPopulation1790: entry?.population1790 ?? null,
    prosperity: region?.prosperity ?? null,
    sentiment: region?.sentiment ?? null,
    compliance: region?.compliance ?? null,
    sectionalStrain: region ? sectionalStrain(state, region) : null,
    delegation,
    grievance,
    whatIsNotTracked: notTracked,
  };
}
