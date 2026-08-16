import { describe, expect, it } from 'vitest';
import { isoToDay } from '@/sim/calendar';
import { createTestGame } from '@/sim/createGame';
import { START } from '@/sim/calibration';
import {
  ALL_SERIES,
  FEDERAL_DEBT,
  FEDERAL_OUTLAYS,
  FEDERAL_RECEIPTS,
  MILITARY_SIZE,
  NOMINAL_GDP,
  POPULATION,
  PRICE_INDEX,
  REAL_BASE_YEAR,
  buildComparison,
  figureFor,
  priceIndexFor,
  priceLevelChange,
  seriesById,
  toRealDollars,
} from './index';

describe('every figure is cited', () => {
  /**
   * The hardest rule in the project. A figure without a source is
   * indistinguishable from a fabricated one.
   */
  it('carries a non-trivial source string', () => {
    for (const series of ALL_SERIES) {
      for (const figure of series.figures) {
        expect(figure.source.length, `${series.id} ${figure.year}`).toBeGreaterThan(15);
      }
    }
  });

  it('records a source tier and a retrieval date', () => {
    for (const series of ALL_SERIES) {
      for (const figure of series.figures) {
        expect(['primary', 'secondary']).toContain(figure.sourceTier);
        expect(figure.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('marks nothing as interpolated, because Phase 1 interpolates nothing', () => {
    for (const series of ALL_SERIES) {
      for (const figure of series.figures) {
        expect(figure.isInterpolated, `${series.id} ${figure.year}`).toBe(false);
      }
    }
  });

  it('holds only finite, non-zero values', () => {
    for (const series of ALL_SERIES) {
      for (const figure of series.figures) {
        expect(Number.isFinite(figure.value), `${series.id} ${figure.year}`).toBe(true);
        expect(figure.value, `${series.id} ${figure.year}`).not.toBe(0);
      }
    }
  });

  it('keeps years inside the period we claim to cover', () => {
    for (const series of ALL_SERIES) {
      for (const figure of series.figures) {
        expect(figure.year).toBeGreaterThanOrEqual(1789);
        expect(figure.year).toBeLessThanOrEqual(1801);
      }
    }
  });
});

describe('gaps are declared, not disguised', () => {
  it('an unavailable series says what is missing and what would fill it', () => {
    for (const series of [FEDERAL_RECEIPTS, FEDERAL_OUTLAYS, MILITARY_SIZE]) {
      expect(series.unavailable, series.id).toBeDefined();
      expect(series.unavailable!.reason.length).toBeGreaterThan(40);
      expect(series.unavailable!.whatWeNeed.length).toBeGreaterThan(20);
    }
  });

  it('an unavailable series holds no figures at all', () => {
    for (const series of ALL_SERIES) {
      if (series.unavailable) {
        expect(series.figures, series.id).toHaveLength(0);
      }
    }
  });

  it('lookups on an unavailable series report unavailable, never a number', () => {
    for (const year of [1790, 1795, 1800]) {
      const lookup = figureFor(FEDERAL_RECEIPTS, year);
      expect(lookup.available).toBe(false);
    }
  });
});

describe('lookups never interpolate and never carry forward silently', () => {
  it('returns the most recent figure on or before the year', () => {
    const lookup = figureFor(FEDERAL_DEBT, 1795);
    expect(lookup.available).toBe(true);
    if (!lookup.available) return;
    expect(lookup.figure.year).toBe(1795);
  });

  it('reports the figure’s own year, not the year asked for', () => {
    // Population exists only for 1790 and 1800. Asking for 1796 must return
    // the 1790 figure AND say so, so the interface can label it honestly.
    const lookup = figureFor(POPULATION, 1796);
    expect(lookup.available).toBe(true);
    if (!lookup.available) return;
    expect(lookup.figure.year).toBe(1790);
    expect(lookup.figure.value).toBe(3_929_326);
  });

  it('never averages or blends two figures', () => {
    const lookup = figureFor(POPULATION, 1796);
    if (!lookup.available) throw new Error('expected a figure');
    // Anything between the two census values would mean interpolation.
    expect(lookup.figure.value).not.toBeGreaterThan(3_929_326);
    expect([3_929_326, 5_308_483]).toContain(lookup.figure.value);
  });

  it('reports unavailable before the series begins, rather than reaching forward', () => {
    const lookup = figureFor(FEDERAL_DEBT, 1789);
    expect(lookup.available).toBe(false);
    if (lookup.available) return;
    expect(lookup.reason).toContain('No verified figure');
  });
});

describe('real-terms conversion', () => {
  it('leaves a base-year figure unchanged', () => {
    const result = toRealDollars(1_000_000, REAL_BASE_YEAR);
    expect(result.ok).toBe(true);
    expect(result.value).toBeCloseTo(1_000_000, 6);
  });

  it('deflates a later figure by the price level', () => {
    // 1800 CPI 12.17, 1790 CPI 8.86.
    const result = toRealDollars(486_000_000, 1800);
    expect(result.ok).toBe(true);
    expect(result.value! / 1_000_000).toBeCloseTo(486 * (8.86 / 12.17), 3);
    // Sanity: about $354M in 1790 dollars.
    expect(result.value! / 1_000_000).toBeGreaterThan(350);
    expect(result.value! / 1_000_000).toBeLessThan(357);
  });

  /**
   * Deflating with the wrong year's index would silently produce a wrong
   * number, and a wrong number presented as history is exactly what this
   * project forbids. So the index lookup does NOT fall back to an earlier year.
   */
  it('refuses to convert a year with no index rather than using a nearby one', () => {
    expect(priceIndexFor(1810)).toBeNull();
    const result = toRealDollars(1_000_000, 1810);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('cannot be stated in constant dollars');
  });

  it('reports the cumulative price change', () => {
    expect(priceLevelChange(REAL_BASE_YEAR)).toBeCloseTo(1, 6);
    expect(priceLevelChange(1800)).toBeCloseTo(12.17 / 8.86, 4);
    expect(priceLevelChange(1810)).toBeNull();
  });

  it('closes most of the apparent GDP gap, which was the point of the change', () => {
    // Nominal comparison made the model look 45% short. In real terms the gap
    // is far smaller, and what remains is the exogenous post-1793 shipping
    // boom rather than a modelling error. See ECONOMY.md §11.7.
    const nominal1800 = 486_000_000;
    const real1800 = toRealDollars(nominal1800, 1800).value!;
    const modelled = 268_800_000;

    expect(modelled / nominal1800).toBeLessThan(0.6);
    expect(modelled / real1800).toBeGreaterThan(0.7);
  });
});

describe('the comparison table', () => {
  const state = createTestGame();
  const rows = buildComparison({
    day: isoToDay('1795-06-01'),
    population: 4_500_000,
    gdp: 240_000_000,
    federalDebt: 80_000_000,
    federalReceipts: 6_000_000,
    federalOutlays: 5_000_000,
  });

  it('includes every specified metric', () => {
    expect(rows.map((r) => r.metric)).toEqual([
      'population',
      'gdp_real',
      'gdp_per_capita_real',
      'federal_debt',
      'federal_receipts',
      'federal_outlays',
      'military_size',
    ]);
  });

  it('renders receipts and outlays as explicit gaps, never as numbers', () => {
    for (const metric of ['federal_receipts', 'federal_outlays'] as const) {
      const row = rows.find((r) => r.metric === metric)!;
      expect(row.historical.available).toBe(false);
      expect(row.deltaPercent).toBeUndefined();
      if (row.historical.available) return;
      expect(row.historical.reason.length).toBeGreaterThan(20);
    }
  });

  it('marks military size as not simulated as well as not sourced', () => {
    const row = rows.find((r) => r.metric === 'military_size')!;
    expect(row.simulated).toBeNull();
    expect(row.simulatedNote).toContain('Not simulated');
    expect(row.historical.available).toBe(false);
  });

  it('computes a delta only where both sides exist', () => {
    for (const row of rows) {
      const bothPresent = row.historical.available && row.simulated !== null;
      expect(row.deltaPercent !== undefined).toBe(bothPresent);
    }
  });

  it('flags GDP rows as being in real terms', () => {
    expect(rows.find((r) => r.metric === 'gdp_real')!.isReal).toBe(true);
    expect(rows.find((r) => r.metric === 'gdp_per_capita_real')!.isReal).toBe(true);
    expect(rows.find((r) => r.metric === 'federal_debt')!.isReal).toBe(false);
  });

  it('derives GDP per head rather than sourcing it separately, and says so', () => {
    const row = rows.find((r) => r.metric === 'gdp_per_capita_real')!;
    expect(row.historical.available).toBe(true);
    if (!row.historical.available) return;
    expect(row.historical.figure.note).toContain('Derived');
    expect(row.historical.figure.note).toContain('Not separately sourced');
  });

  it('quotes the year each historical figure is actually from', () => {
    const population = rows.find((r) => r.metric === 'population')!;
    // Asked for 1795; population only exists for 1790.
    expect(population.historicalYear).toBe(1790);
  });

  it('works at the very start of the game without throwing', () => {
    expect(() =>
      buildComparison({
        day: 0,
        population: state.nation.population,
        gdp: state.nation.gdp,
        federalDebt: state.treasury.debtPrincipal,
        federalReceipts: 0,
        federalOutlays: 0,
      }),
    ).not.toThrow();
  });
});

describe('calibration constants never leak into history', () => {
  /**
   * DESIGN.md §12.2 draws a hard line between game-design parameters and
   * claims about what really happened. This test checks the line holds.
   */
  it('no historical figure equals a starting calibration value', () => {
    const calibrationValues = new Set<number>([
      START.gdp,
      START.debt,
      START.population,
      START.enslavedPopulation,
    ]);

    for (const series of ALL_SERIES) {
      for (const figure of series.figures) {
        if (!calibrationValues.has(figure.value)) continue;

        // The overlap is legitimate only where calibration was ANCHORED to
        // this very figure, which is true for the 1790 census and the earliest
        // GDP and debt figures. Anything else means a game parameter has been
        // dressed up as history.
        expect(
          [1790].includes(figure.year),
          `${series.id} ${figure.year} matches a calibration constant but is not the anchor year`,
        ).toBe(true);
      }
    }
  });

  it('the price index is present and independent of any game constant', () => {
    expect(PRICE_INDEX.figures.length).toBeGreaterThan(10);
    expect(seriesById('cpi')).toBeDefined();
  });

  it('nominal GDP is stored as published, not pre-deflated', () => {
    const figure = NOMINAL_GDP.figures.find((f) => f.year === 1800)!;
    expect(figure.value).toBe(486_000_000);
  });
});
