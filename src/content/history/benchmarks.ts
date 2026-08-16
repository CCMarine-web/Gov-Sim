/**
 * HISTORICAL BENCHMARK DATA — 1789 to 1801
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HARDEST RULE IN THIS PROJECT LIVES HERE.
 *
 * Every figure below is a claim about what really happened, and every one
 * carries a citation. Nothing in this file may be estimated, interpolated,
 * carried forward to fill a hole, or invented to make a chart look complete.
 *
 * Where a figure does not exist in a citable source, the series carries an
 * `unavailable` block naming exactly what is missing and what would fill it,
 * and the interface renders that as an explicit gap. **That gap state is a
 * finished deliverable, not a failure.**
 *
 * Nothing from src/sim/calibration.ts may ever appear here. Those are
 * game-design parameters; these are history. See DESIGN.md §12.2.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type SourceTier = 'primary' | 'secondary';

export interface HistoricalFigure {
  year: number;
  value: number;
  /** Precise citation. Rendered to the player. */
  source: string;
  sourceTier: SourceTier;
  /** ISO date the figure was retrieved. */
  retrieved: string;
  /**
   * True only if the value was derived between known points. Phase 1 uses no
   * interpolation at all, so this is false everywhere; the flag exists because
   * the UI must be able to label such a value visibly if one is ever added.
   */
  isInterpolated: boolean;
  note?: string;
}

export interface UnavailableSeries {
  /** What is missing, in a sentence the player can read. */
  reason: string;
  /** What would fill the gap. Also recorded in docs/BLOCKERS.md. */
  whatWeNeed: string;
}

export interface HistoricalSeries {
  id: string;
  label: string;
  unit: 'people' | 'usd' | 'index' | 'count';
  figures: HistoricalFigure[];
  unavailable?: UnavailableSeries;
}

// ============================================================================
// POPULATION
// ============================================================================

const CENSUS_SOURCE =
  '1790 and 1800 United States Censuses, US Census Bureau';

export const POPULATION: HistoricalSeries = {
  id: 'population',
  label: 'Population',
  unit: 'people',
  figures: [
    {
      year: 1790,
      value: 3_929_326,
      source: CENSUS_SOURCE,
      sourceTier: 'secondary',
      retrieved: '2026-08-15',
      isInterpolated: false,
      note:
        'Sum of the published per-state returns. A figure of 3,929,214 also ' +
        'circulates, most likely a later correction; the per-state table used ' +
        'here sums exactly to this value. Enumerated as of 2 August 1790.',
    },
    {
      year: 1800,
      value: 5_308_483,
      source: CENSUS_SOURCE,
      sourceTier: 'secondary',
      retrieved: '2026-08-15',
      isInterpolated: false,
      note: 'Enumerated as of 4 August 1800.',
    },
  ],
};

// ============================================================================
// NOMINAL GDP
// ============================================================================

const GDP_SOURCE =
  'Louis Johnston and Samuel H. Williamson, "What Was the U.S. GDP Then?", MeasuringWorth';

/** Millions of current dollars, as published. */
const NOMINAL_GDP_MILLIONS: Array<[number, number]> = [
  [1790, 193],
  [1791, 210],
  [1792, 230],
  [1793, 256],
  [1794, 321],
  [1795, 390],
  [1796, 423],
  [1797, 415],
  [1798, 418],
  [1799, 447],
  [1800, 486],
  [1801, 520],
];

export const NOMINAL_GDP: HistoricalSeries = {
  id: 'gdp_nominal',
  label: 'GDP (nominal)',
  unit: 'usd',
  figures: NOMINAL_GDP_MILLIONS.map(([year, millions]) => ({
    year,
    value: millions * 1_000_000,
    source: GDP_SOURCE,
    sourceTier: 'secondary' as const,
    retrieved: '2026-08-15',
    isInterpolated: false,
    note:
      year === 1790
        ? 'The series deliberately includes government output and private services.'
        : undefined,
  })),
};

// ============================================================================
// PRICE INDEX
// ============================================================================

const CPI_SOURCE =
  'Samuel H. Williamson, "The Annual Consumer Price Index for the United States, 1774-Present", MeasuringWorth';

/** Index, average 1982-84 = 100. */
const CPI: Array<[number, number]> = [
  [1789, 8.54],
  [1790, 8.86],
  [1791, 9.1],
  [1792, 9.27],
  [1793, 9.59],
  [1794, 10.64],
  [1795, 12.17],
  [1796, 12.81],
  [1797, 12.33],
  [1798, 11.92],
  [1799, 11.92],
  [1800, 12.17],
  [1801, 12.33],
];

export const PRICE_INDEX: HistoricalSeries = {
  id: 'cpi',
  label: 'Consumer price index',
  unit: 'index',
  figures: CPI.map(([year, value]) => ({
    year,
    value,
    source: CPI_SOURCE,
    sourceTier: 'secondary' as const,
    retrieved: '2026-08-15',
    isInterpolated: false,
    note: year === 1789 ? 'Average 1982-84 = 100.' : undefined,
  })),
};

/** The base year all real figures are expressed in. */
export const REAL_BASE_YEAR = 1790;

// ============================================================================
// FEDERAL DEBT
// ============================================================================

const DEBT_SOURCE =
  'US Department of the Treasury, Fiscal Data, "Historical Debt Outstanding"';

/** Total public debt outstanding as of 1 January of each year. */
const DEBT_BY_YEAR: Array<[number, number]> = [
  [1790, 71_060_508.5],
  [1791, 75_463_476.52],
  [1792, 77_227_924.66],
  [1793, 80_358_634.04],
  [1794, 78_427_404.77],
  [1795, 80_747_587.39],
  [1796, 83_762_172.07],
  [1797, 82_064_479.33],
  [1798, 79_228_529.12],
  [1799, 78_408_669.77],
  [1800, 82_976_294.35],
  [1801, 83_038_050.8],
];

export const FEDERAL_DEBT: HistoricalSeries = {
  id: 'federal_debt',
  label: 'Federal debt',
  unit: 'usd',
  figures: DEBT_BY_YEAR.map(([year, value]) => ({
    year,
    value,
    source: DEBT_SOURCE,
    sourceTier: 'primary' as const,
    retrieved: '2026-08-15',
    isInterpolated: false,
    note:
      year === 1791
        ? 'The rise from 1790 reflects the assumption of state debts under the Funding Act.'
        : year === 1790
          ? 'Figures are as of 1 January. Between 1789 and 1842 the federal fiscal year began in January.'
          : undefined,
  })),
};

// ============================================================================
// THE GAPS
// ============================================================================

/**
 * Federal receipts and outlays.
 *
 * Deliberately empty. The brief's suggested source does not cover this period
 * annually — OMB Historical Tables Table 1.1 reports 1789-1849 as a single
 * aggregated row and begins annual reporting in 1901. Four further sources were
 * checked and are recorded in docs/BLOCKERS.md B-001.
 *
 * The correct output is the gap, not a guess.
 */
const RECEIPTS_OUTLAYS_GAP: UnavailableSeries = {
  reason:
    'No accessible source publishes annual federal receipts or outlays for ' +
    '1789-1800. OMB Historical Table 1.1 aggregates the whole period 1789-1849 ' +
    'into a single figure and only begins annual reporting in 1901.',
  whatWeNeed:
    'Historical Statistics of the United States, Colonial Times to 1970, ' +
    'series Y 335-338. It exists only as a scanned PDF and needs text ' +
    'extraction tooling, or manual transcription of twelve years of two columns.',
};

export const FEDERAL_RECEIPTS: HistoricalSeries = {
  id: 'federal_receipts',
  label: 'Federal receipts',
  unit: 'usd',
  figures: [],
  unavailable: RECEIPTS_OUTLAYS_GAP,
};

export const FEDERAL_OUTLAYS: HistoricalSeries = {
  id: 'federal_outlays',
  label: 'Federal outlays',
  unit: 'usd',
  figures: [],
  unavailable: RECEIPTS_OUTLAYS_GAP,
};

export const MILITARY_SIZE: HistoricalSeries = {
  id: 'military_size',
  label: 'Military size',
  unit: 'count',
  figures: [],
  unavailable: {
    reason:
      'Not yet researched. Phase 1 has no military system, so the simulation ' +
      'produces no figure to compare against either.',
    whatWeNeed:
      'Army and Navy strength returns for 1789-1800. Deferred until the ' +
      'military system arrives in Phase 3.',
  },
};

// ============================================================================
// REGISTRY
// ============================================================================

export const ALL_SERIES: HistoricalSeries[] = [
  POPULATION,
  NOMINAL_GDP,
  FEDERAL_DEBT,
  FEDERAL_RECEIPTS,
  FEDERAL_OUTLAYS,
  MILITARY_SIZE,
  PRICE_INDEX,
];
