/**
 * REGION SEED DATA — 1790
 *
 * The four Phase 1 regions and their constituent states, with population
 * figures from the First Census.
 *
 * WHY STATES ARE LISTED AT ALL
 * The simulation operates at the REGION level in Phase 1; there is no
 * per-state maths. These entries exist so that Phase 2's map can attach
 * geometry to entities that already exist rather than introducing them.
 * Cheap now, a rewrite later. (DESIGN.md §8.1)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOURCE
 * 1790 United States Census, per US Census Bureau returns.
 * Retrieved 2026-08-15 from https://en.wikipedia.org/wiki/1790_United_States_census
 *
 * sourceTier: SECONDARY — pending confirmation against a census.gov primary
 * document. Two national totals circulate for the 1790 census: 3,929,326 (the
 * sum of the published per-state returns, used here) and 3,929,214. The
 * 112-person difference most likely reflects a later correction. The per-state
 * table below is internally consistent and sums exactly to 3,929,326 and
 * 697,697, which is why it is what we use — but the discrepancy is real and
 * recorded in ECONOMY.md §2.1 rather than smoothed over.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HISTORICAL NOTES AFFECTING REGION ASSIGNMENT
 *  - Vermont was an independent republic until 4 March 1791; the census
 *    enumerated it separately.
 *  - Maine was the District of Maine, part of Massachusetts, until 1820, but
 *    was enumerated separately.
 *  - Kentucky was part of Virginia until 1 June 1792.
 *  - The Southwest Territory became Tennessee on 1 June 1796.
 *
 * Region membership is therefore static for Phase 1. Phase 2's map will need
 * these transitions as real boundary changes.
 */

import type { RegionId, StateEntry } from '@/sim/types';

export interface RegionSeed {
  id: RegionId;
  name: string;
  states: StateEntry[];
  dominantIndustry: string;
  /** 0–100 index at day 0. */
  prosperity: number;
  /** −100…+100 toward the federal government, for a republic. */
  sentimentRepublic: number;
  /** Anti-monarchical feeling ran strong in the north in 1789. */
  sentimentMonarchy: number;
  /**
   * How heavily each tax falls on this region given its economy.
   * The mechanism that makes one national policy produce four different
   * political reactions. (ECONOMY.md §7.12)
   */
  tariffExposure: number;
  exciseExposure: number;
  landExposure: number;
}

export const REGION_SEEDS: readonly RegionSeed[] = [
  {
    id: 'new_england',
    name: 'New England',
    dominantIndustry: 'Shipping, fishing, and nascent manufacturing',
    prosperity: 55,
    sentimentRepublic: 20,
    sentimentMonarchy: -25,
    // Merchants and shipowners bear the tariff directly — but they also
    // receive its protection, which is why the exposure is high rather than
    // extreme.
    tariffExposure: 1.3,
    exciseExposure: 0.4,
    landExposure: 0.8,
    states: [
      { code: 'VT', name: 'Vermont', population1790: 85_539, enslavedPopulation1790: 16 },
      { code: 'NH', name: 'New Hampshire', population1790: 141_885, enslavedPopulation1790: 158 },
      { code: 'ME', name: 'Maine (District of Massachusetts)', population1790: 96_540, enslavedPopulation1790: 0 },
      { code: 'MA', name: 'Massachusetts', population1790: 378_787, enslavedPopulation1790: 0 },
      { code: 'RI', name: 'Rhode Island', population1790: 68_825, enslavedPopulation1790: 948 },
      { code: 'CT', name: 'Connecticut', population1790: 237_946, enslavedPopulation1790: 2_764 },
    ],
  },
  {
    id: 'mid_atlantic',
    name: 'Mid-Atlantic',
    dominantIndustry: 'Mixed farming, milling, and commerce',
    prosperity: 58,
    sentimentRepublic: 25,
    sentimentMonarchy: -20,
    tariffExposure: 1.0,
    exciseExposure: 0.7,
    landExposure: 1.0,
    states: [
      { code: 'NY', name: 'New York', population1790: 340_120, enslavedPopulation1790: 21_324 },
      { code: 'NJ', name: 'New Jersey', population1790: 184_139, enslavedPopulation1790: 11_423 },
      { code: 'PA', name: 'Pennsylvania', population1790: 434_373, enslavedPopulation1790: 3_737 },
      { code: 'DE', name: 'Delaware', population1790: 59_094, enslavedPopulation1790: 8_887 },
    ],
  },
  {
    id: 'south',
    name: 'The South',
    dominantIndustry: 'Staple-crop plantation agriculture',
    prosperity: 52,
    sentimentRepublic: 5,
    sentimentMonarchy: 10,
    // Exports staples and imports manufactures, so it bears the tariff without
    // receiving the protection. This asymmetry is the origin of sectional
    // conflict over the tariff, and the model produces it rather than
    // asserting it.
    tariffExposure: 1.2,
    exciseExposure: 0.3,
    landExposure: 1.1,
    states: [
      { code: 'MD', name: 'Maryland', population1790: 319_728, enslavedPopulation1790: 103_036 },
      { code: 'VA', name: 'Virginia', population1790: 747_610, enslavedPopulation1790: 292_627 },
      { code: 'NC', name: 'North Carolina', population1790: 393_751, enslavedPopulation1790: 100_572 },
      { code: 'SC', name: 'South Carolina', population1790: 249_073, enslavedPopulation1790: 107_094 },
      { code: 'GA', name: 'Georgia', population1790: 82_548, enslavedPopulation1790: 29_264 },
    ],
  },
  {
    id: 'frontier',
    name: 'The Frontier',
    dominantIndustry: 'Subsistence farming and distilling',
    prosperity: 40,
    sentimentRepublic: -10,
    sentimentMonarchy: -5,
    // 2.2 excise exposure is the Whiskey Rebellion waiting to happen. Whiskey
    // was the only form in which a bulk grain crop could profitably cross the
    // mountains to market, so an excise on spirits was, to a frontier farmer,
    // a tax on the act of selling anything at all.
    tariffExposure: 0.4,
    exciseExposure: 2.2,
    landExposure: 1.3,
    states: [
      { code: 'KY', name: 'Kentucky', population1790: 73_677, enslavedPopulation1790: 12_430 },
      { code: 'SW', name: 'Southwest Territory', population1790: 35_691, enslavedPopulation1790: 3_417 },
    ],
  },
] as const;

/** Verified national totals. Regional sums must equal these exactly. */
export const CENSUS_1790_TOTALS = {
  population: 3_929_326,
  enslavedPopulation: 697_697,
  source: '1790 United States Census, US Census Bureau',
  sourceTier: 'secondary' as const,
  retrieved: '2026-08-15',
};

/** Total population of a region seed, summed from its states. */
export function seedPopulation(seed: RegionSeed): number {
  return seed.states.reduce((sum, s) => sum + s.population1790, 0);
}

/** Total enslaved population of a region seed, summed from its states. */
export function seedEnslavedPopulation(seed: RegionSeed): number {
  return seed.states.reduce((sum, s) => sum + s.enslavedPopulation1790, 0);
}
