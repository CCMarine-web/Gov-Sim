/**
 * HISTORICAL BENCHMARK LOOKUP
 *
 * Reading the data in `benchmarks.ts`, and the one derivation the History view
 * needs: converting nominal figures to constant 1790 dollars.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NO INTERPOLATION. NO CARRY-FORWARD ACROSS GAPS.
 *
 * `figureFor` returns the most recent figure ON OR BEFORE a year, and always
 * reports which year it actually came from, so the interface can say "Federal
 * debt, 1 January 1793" rather than implying the number is current. That is a
 * quotation, not an estimate.
 *
 * Where no figure exists at or before the requested year, the answer is
 * "unavailable". It is never the next figure, never an average, never zero.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { yearOf } from '@/sim/calendar';
import {
  ALL_SERIES,
  PRICE_INDEX,
  REAL_BASE_YEAR,
  type HistoricalFigure,
  type HistoricalSeries,
} from './benchmarks';

export * from './benchmarks';

export type Lookup =
  | { available: true; figure: HistoricalFigure }
  | { available: false; reason: string; whatWeNeed: string };

const NO_FIGURE_YET =
  'No verified figure exists at or before this date in the sources we have.';

/**
 * The most recent figure on or before `year`.
 *
 * Returns the figure with its own year attached, never adjusted toward the
 * requested one.
 */
export function figureFor(series: HistoricalSeries, year: number): Lookup {
  if (series.unavailable) {
    return {
      available: false,
      reason: series.unavailable.reason,
      whatWeNeed: series.unavailable.whatWeNeed,
    };
  }

  const candidates = series.figures.filter((f) => f.year <= year);
  if (candidates.length === 0) {
    return {
      available: false,
      reason: NO_FIGURE_YET,
      whatWeNeed:
        series.figures.length > 0
          ? `The series begins in ${series.figures[0].year}.`
          : 'No figures are recorded for this series at all.',
    };
  }

  // Sorted ascending by construction, but do not rely on that.
  const latest = candidates.reduce((best, f) => (f.year > best.year ? f : best));
  return { available: true, figure: latest };
}

/** Look up a series by id. */
export function seriesById(id: string): HistoricalSeries | undefined {
  return ALL_SERIES.find((s) => s.id === id);
}

// ============================================================================
// REAL TERMS
// ============================================================================

/**
 * The price index for a year, or null.
 *
 * Unlike `figureFor`, this does NOT fall back to an earlier year. Deflating a
 * 1799 figure with an 1795 index would silently produce a wrong number, and a
 * wrong number presented as history is exactly what this project forbids.
 */
export function priceIndexFor(year: number): number | null {
  const exact = PRICE_INDEX.figures.find((f) => f.year === year);
  return exact ? exact.value : null;
}

export interface RealConversion {
  ok: boolean;
  /** Value in constant REAL_BASE_YEAR dollars. */
  value?: number;
  reason?: string;
}

/**
 * Convert a nominal figure from `year` into constant 1790 dollars.
 *
 * This implements the decision recorded in ECONOMY.md §11.7: the simulation has
 * no price level, so it is effectively a constant-dollar series, and comparing
 * it against a nominal benchmark reports inflation as though it were the
 * player's failure. Converting the benchmark makes the comparison like for
 * like.
 *
 * The conversion is a DERIVATION and the interface must label it as one. The
 * data file keeps the sourced nominal figures exactly as published.
 */
export function toRealDollars(nominalValue: number, year: number): RealConversion {
  const index = priceIndexFor(year);
  const base = priceIndexFor(REAL_BASE_YEAR);

  if (index === null || base === null) {
    return {
      ok: false,
      reason: `No verified price index for ${index === null ? year : REAL_BASE_YEAR}, so this figure cannot be stated in constant dollars.`,
    };
  }

  return { ok: true, value: nominalValue * (base / index) };
}

/** Cumulative price change since the base year, as a readable multiple. */
export function priceLevelChange(year: number): number | null {
  const index = priceIndexFor(year);
  const base = priceIndexFor(REAL_BASE_YEAR);
  if (index === null || base === null) return null;
  return index / base;
}

// ============================================================================
// COMPARISON ROWS
// ============================================================================

export type MetricId =
  | 'population'
  | 'gdp_real'
  | 'gdp_per_capita_real'
  | 'federal_debt'
  | 'federal_receipts'
  | 'federal_outlays'
  | 'military_size';

export interface ComparisonRow {
  metric: MetricId;
  label: string;
  /** What the player's run shows. Null when Phase 1 does not simulate it. */
  simulated: number | null;
  simulatedNote?: string;
  /** The historical figure, when one exists. */
  historical: Lookup;
  /** The year the historical figure is actually from. */
  historicalYear?: number;
  /** Percentage difference, only when both sides exist. */
  deltaPercent?: number;
  /** True where both figures are in constant 1790 dollars. */
  isReal: boolean;
  unit: 'people' | 'usd' | 'count';
}

/** Turn a lookup plus a simulated value into a renderable row. */
function buildRow(params: {
  metric: MetricId;
  label: string;
  simulated: number | null;
  simulatedNote?: string;
  series: HistoricalSeries;
  year: number;
  unit: 'people' | 'usd' | 'count';
  deflate?: boolean;
}): ComparisonRow {
  const lookup = figureFor(params.series, params.year);

  let historical = lookup;
  let historicalYear: number | undefined;

  if (lookup.available) {
    historicalYear = lookup.figure.year;

    if (params.deflate) {
      const real = toRealDollars(lookup.figure.value, lookup.figure.year);
      historical = real.ok
        ? { available: true, figure: { ...lookup.figure, value: real.value! } }
        : {
            available: false,
            reason: real.reason!,
            whatWeNeed: 'A verified price index for that year.',
          };
    }
  }

  const row: ComparisonRow = {
    metric: params.metric,
    label: params.label,
    simulated: params.simulated,
    simulatedNote: params.simulatedNote,
    historical,
    historicalYear,
    isReal: params.deflate === true,
    unit: params.unit,
  };

  if (historical.available && params.simulated !== null && historical.figure.value !== 0) {
    row.deltaPercent =
      ((params.simulated - historical.figure.value) / historical.figure.value) * 100;
  }

  return row;
}

export interface ComparisonInput {
  day: number;
  population: number;
  gdp: number;
  federalDebt: number;
  federalReceipts: number;
  federalOutlays: number;
}

/**
 * Build every row of the comparison table for a given in-game day.
 *
 * GDP rows are deflated to constant 1790 dollars. The simulation has no price
 * level, so its output is already in constant terms; deflating the benchmark
 * is what makes the two comparable.
 */
export function buildComparison(input: ComparisonInput): ComparisonRow[] {
  const year = yearOf(input.day);
  const populationSeries = seriesById('population')!;
  const gdpSeries = seriesById('gdp_nominal')!;
  const debtSeries = seriesById('federal_debt')!;
  const receiptsSeries = seriesById('federal_receipts')!;
  const outlaysSeries = seriesById('federal_outlays')!;
  const militarySeries = seriesById('military_size')!;

  const rows: ComparisonRow[] = [
    buildRow({
      metric: 'population',
      label: 'Population',
      simulated: input.population,
      series: populationSeries,
      year,
      unit: 'people',
    }),
    buildRow({
      metric: 'gdp_real',
      label: 'GDP',
      simulated: input.gdp,
      series: gdpSeries,
      year,
      unit: 'usd',
      deflate: true,
    }),
    buildRow({
      metric: 'federal_debt',
      label: 'Federal debt',
      simulated: input.federalDebt,
      series: debtSeries,
      year,
      unit: 'usd',
    }),
    buildRow({
      metric: 'federal_receipts',
      label: 'Federal receipts',
      simulated: input.federalReceipts,
      series: receiptsSeries,
      year,
      unit: 'usd',
    }),
    buildRow({
      metric: 'federal_outlays',
      label: 'Federal outlays',
      simulated: input.federalOutlays,
      series: outlaysSeries,
      year,
      unit: 'usd',
    }),
    buildRow({
      metric: 'military_size',
      label: 'Military size',
      simulated: null,
      simulatedNote: 'Not simulated in Phase 1.',
      series: militarySeries,
      year,
      unit: 'count',
    }),
  ];

  // GDP per capita, derived from two rows above rather than sourced separately.
  const gdpRow = rows[1];
  const populationRow = rows[0];
  const perCapitaSimulated =
    input.population > 0 ? input.gdp / input.population : null;

  let perCapitaHistorical: Lookup;
  if (gdpRow.historical.available && populationRow.historical.available) {
    perCapitaHistorical = {
      available: true,
      figure: {
        ...gdpRow.historical.figure,
        value:
          gdpRow.historical.figure.value / populationRow.historical.figure.value,
        note:
          `Derived from GDP (${gdpRow.historical.figure.year}) and population ` +
          `(${populationRow.historical.figure.year}). Not separately sourced.`,
      },
    };
  } else {
    perCapitaHistorical = {
      available: false,
      reason: 'Requires both a GDP figure and a population figure for this date.',
      whatWeNeed: 'Whichever of the two is missing above.',
    };
  }

  const perCapitaRow: ComparisonRow = {
    metric: 'gdp_per_capita_real',
    label: 'GDP per head',
    simulated: perCapitaSimulated,
    historical: perCapitaHistorical,
    historicalYear: gdpRow.historicalYear,
    isReal: true,
    unit: 'usd',
  };

  if (
    perCapitaHistorical.available &&
    perCapitaSimulated !== null &&
    perCapitaHistorical.figure.value !== 0
  ) {
    perCapitaRow.deltaPercent =
      ((perCapitaSimulated - perCapitaHistorical.figure.value) /
        perCapitaHistorical.figure.value) *
      100;
  }

  rows.splice(2, 0, perCapitaRow);
  return rows;
}
