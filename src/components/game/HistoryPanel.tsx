'use client';

/**
 * HISTORY — the comparison view
 *
 * Your America against the real one, for any date in the run. (UI.md §5.5)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULES THIS SCREEN EXISTS TO HONOUR
 *
 * 1. A row with no verified figure renders an explicit unavailable state
 *    naming what is missing and what would fill it. Never blank, never zero,
 *    never a dash standing in for a number.
 *
 * 2. Simulated and historical are distinguished by colour AND line style AND
 *    marker AND text label — four channels, so the distinction survives
 *    greyscale, colour blindness, and a screen reader.
 *
 * 3. Every historical figure shows the date it is actually from. With annual
 *    data the value shown is rarely from today, and implying otherwise would
 *    be a quiet lie.
 *
 * 4. No interpolation. Where the historical series has a gap — population,
 *    which exists only per decennial census — the chart plots the points it
 *    has and draws no line between them.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useMemo, useState } from 'react';
import {
  ALL_SERIES,
  REAL_BASE_YEAR,
  buildComparison,
  priceLevelChange,
  seriesById,
  toRealDollars,
  type ComparisonRow,
  type HistoricalSeries,
} from '@/content/history';
import { formatLongDate, yearOf } from '@/sim/calendar';
import type { GameState } from '@/sim/types';
import { formatCurrency, formatNumber } from '@/lib/format';

export function HistoryPanel({ state }: { state: GameState }) {
  const [scrubDay, setScrubDay] = useState(state.day);
  const day = Math.min(scrubDay, state.day);

  // Simulated values at the scrubbed date, read from the monthly series.
  const atDay = useMemo(() => readSeriesAt(state, day), [state, day]);

  const rows = useMemo(
    () =>
      buildComparison({
        day,
        population: atDay.population,
        gdp: atDay.gdp,
        federalDebt: atDay.debt,
        federalReceipts: atDay.receipts,
        federalOutlays: atDay.outlays,
      }),
    [day, atDay],
  );

  const priceChange = priceLevelChange(yearOf(day));

  return (
    <div className="space-y-3">
      {/* --- Scrubber ------------------------------------------------- */}
      <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-label uppercase tracking-wider text-content-muted">
            Comparison
          </h3>
          <p className="tabular text-body text-content-primary">
            {formatLongDate(day)}
          </p>
        </div>

        <label className="mt-2 block">
          <span className="sr-only">Review an earlier date</span>
          <input
            type="range"
            min={0}
            max={state.day}
            value={day}
            onChange={(e) => setScrubDay(Number(e.target.value))}
            className="w-full accent-brass-400"
          />
        </label>
        <div className="flex justify-between text-small text-content-muted">
          <span>30 April 1789</span>
          {day < state.day && (
            <button
              type="button"
              onClick={() => setScrubDay(state.day)}
              className="text-brass-300 hover:text-brass-400"
            >
              Return to today
            </button>
          )}
          <span className="tabular">{formatLongDate(state.day)}</span>
        </div>
      </section>

      {/* --- Legend --------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-4 rounded-card border border-ink-400 bg-ink-700 px-3 py-2">
        <span className="flex items-center gap-1.5 text-small text-content-secondary">
          <span aria-hidden className="text-brass-400">
            ▪
          </span>
          <svg width="24" height="6" aria-hidden>
            <line x1="0" y1="3" x2="24" y2="3" stroke="var(--color-brass-400)" strokeWidth="2" />
          </svg>
          Your America <span className="text-content-muted">(simulated)</span>
        </span>
        <span className="flex items-center gap-1.5 text-small text-content-secondary">
          <span aria-hidden className="text-steel-400">
            ▫
          </span>
          <svg width="24" height="6" aria-hidden>
            <line
              x1="0"
              y1="3"
              x2="24"
              y2="3"
              stroke="var(--color-steel-400)"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </svg>
          Historical America <span className="text-content-muted">(recorded)</span>
        </span>
      </div>

      {/* --- Rows ----------------------------------------------------- */}
      <div className="overflow-x-auto rounded-card border border-ink-400 bg-ink-700">
        <table
          className="w-full"
          style={{ minWidth: 'var(--size-table-history)' }}
        >
          <thead>
            <tr className="border-b border-ink-400 text-left">
              <th className="px-3 py-2 text-label uppercase tracking-wider text-content-muted">
                Metric
              </th>
              <th className="px-3 py-2 text-label uppercase tracking-wider text-brass-300">
                Your America
              </th>
              <th className="px-3 py-2 text-label uppercase tracking-wider text-steel-400">
                Historical America
              </th>
              <th className="px-3 py-2 text-label uppercase tracking-wider text-content-muted">
                Difference
              </th>
              <th className="px-3 py-2 text-label uppercase tracking-wider text-content-muted">
                Trajectory
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-400">
            {rows.map((row) => (
              <ComparisonTableRow key={row.metric} row={row} state={state} day={day} />
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Basis note ----------------------------------------------- */}
      <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
        <h3 className="text-label uppercase tracking-wider text-content-muted">
          How these figures are compared
        </h3>
        <p className="mt-1.5 max-w-prose text-small text-content-secondary">
          GDP figures on both sides are stated in <strong>constant {REAL_BASE_YEAR} dollars</strong>.
          The simulation has no price level, so its output is already in constant
          terms; the historical figures are published in current dollars and are
          deflated here using a sourced price index. Comparing them without that
          conversion would report inflation as though it were your government&apos;s
          failure.
          {priceChange !== null && (
            <>
              {' '}
              Prices in {yearOf(day)} stood at{' '}
              <span className="tabular">{priceChange.toFixed(2)}×</span> their {REAL_BASE_YEAR} level.
            </>
          )}
        </p>
        <p className="mt-1.5 text-small text-content-muted">
          Deflation is a derivation, not a published figure. The underlying data
          files hold the nominal values exactly as their sources printed them.
        </p>
      </section>

      {/* --- Sources -------------------------------------------------- */}
      <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
        <h3 className="text-label uppercase tracking-wider text-content-muted">
          Sources
        </h3>
        <ul className="mt-1.5 space-y-1">
          {uniqueSources().map((source) => (
            <li key={source} className="text-small text-content-secondary">
              {source}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ============================================================================

function ComparisonTableRow({
  row,
  state,
  day,
}: {
  row: ComparisonRow;
  state: GameState;
  day: number;
}) {
  const format = (value: number) =>
    row.unit === 'usd'
      ? formatCurrency(value)
      : row.unit === 'people'
        ? formatNumber(Math.round(value))
        : formatNumber(Math.round(value));

  return (
    <tr className="align-top">
      <td className="px-3 py-2.5">
        <p className="text-body text-content-primary">{row.label}</p>
        {row.isReal && (
          <p className="text-small text-content-muted">
            constant {REAL_BASE_YEAR} dollars
          </p>
        )}
      </td>

      {/* Your America */}
      <td className="px-3 py-2.5">
        {row.simulated === null ? (
          <p className="text-small text-content-muted">
            {row.simulatedNote ?? 'Not simulated.'}
          </p>
        ) : (
          <p className="tabular text-data-sm text-brass-300">
            <span aria-hidden className="mr-1">
              ▪
            </span>
            {format(row.simulated)}
            <span className="sr-only"> (simulated)</span>
          </p>
        )}
      </td>

      {/* Historical America */}
      <td className="px-3 py-2.5">
        {row.historical.available ? (
          <>
            <p className="tabular text-data-sm text-steel-400">
              <span aria-hidden className="mr-1">
                ▫
              </span>
              {format(row.historical.figure.value)}
              <span className="sr-only"> (historical)</span>
            </p>
            <p className="text-small text-content-muted">
              figure from {row.historical.figure.year}
              {row.historical.figure.isInterpolated && (
                <span className="ml-1 text-brass-300">· estimated</span>
              )}
            </p>
            <details className="mt-0.5">
              <summary className="cursor-pointer text-small text-content-muted hover:text-content-secondary">
                source
              </summary>
              <p className="mt-1 max-w-xs text-small text-content-secondary">
                {row.historical.figure.source}
              </p>
              {row.historical.figure.note && (
                <p className="mt-1 max-w-xs text-small text-content-muted">
                  {row.historical.figure.note}
                </p>
              )}
            </details>
          </>
        ) : (
          /*
            The gap state. This is a finished deliverable, not a placeholder:
            showing a guess here would be the most serious defect this project
            can have.
          */
          <div className="rounded border border-dashed border-oxblood-400/60 px-2 py-1.5">
            <p className="text-label uppercase tracking-wider text-oxblood-300">
              No verified data
            </p>
            <p className="mt-0.5 max-w-xs text-small text-content-secondary">
              {row.historical.reason}
            </p>
            <p className="mt-1 max-w-xs text-small text-content-muted">
              Needed: {row.historical.whatWeNeed}
            </p>
          </div>
        )}
      </td>

      {/* Delta */}
      <td className="px-3 py-2.5">
        {row.deltaPercent === undefined ? (
          <span className="text-small text-content-muted">—</span>
        ) : (
          <span
            className={`tabular text-data-sm ${
              Math.abs(row.deltaPercent) < 1
                ? 'text-content-secondary'
                : row.deltaPercent > 0
                  ? 'text-verdigris-400'
                  : 'text-oxblood-300'
            }`}
          >
            {row.deltaPercent > 0 ? '+' : ''}
            {row.deltaPercent.toFixed(1)}%
            <span className="sr-only">
              {row.deltaPercent > 0 ? ' above' : ' below'} the historical figure
            </span>
          </span>
        )}
      </td>

      {/* Trajectory */}
      <td className="px-3 py-2.5">
        <TrajectoryChart row={row} state={state} day={day} />
      </td>
    </tr>
  );
}

// ============================================================================
// TRAJECTORY
// ============================================================================

const CHART_W = 160;
const CHART_H = 40;

/**
 * Dual-line chart: simulated solid brass, historical dashed steel.
 *
 * The historical line is drawn only between CONSECUTIVE years that both have
 * figures. Population exists only for 1790 and 1800, so it renders as two open
 * markers with no line joining them — which is the honest picture of a
 * decennial census, and the alternative would be inventing nine years of data.
 */
function TrajectoryChart({
  row,
  state,
  day,
}: {
  row: ComparisonRow;
  state: GameState;
  day: number;
}) {
  const series = historicalSeriesFor(row.metric);

  const simPoints = useMemo(() => {
    const out: Array<{ day: number; value: number }> = [];
    const values = simSeriesFor(state, row.metric);
    if (!values) return out;

    for (let i = 0; i < state.series.days.length; i++) {
      if (state.series.days[i] > day) break;
      out.push({ day: state.series.days[i], value: values[i] });
    }
    return out;
  }, [state, row.metric, day]);

  const histPoints = useMemo(() => {
    if (!series || series.unavailable) return [];
    const currentYear = yearOf(day);

    return series.figures
      .filter((f) => f.year <= currentYear)
      .map((f) => {
        const value = row.isReal
          ? toRealDollars(f.value, f.year)
          : { ok: true as const, value: f.value };
        return value.ok && value.value !== undefined
          ? { year: f.year, value: value.value }
          : null;
      })
      .filter((p): p is { year: number; value: number } => p !== null);
  }, [series, day, row.isReal]);

  if (simPoints.length < 2 && histPoints.length === 0) {
    return <span className="text-small text-content-muted">—</span>;
  }

  const allValues = [
    ...simPoints.map((p) => p.value),
    ...histPoints.map((p) => p.value),
  ];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const startYear = 1789;
  const endYear = Math.max(yearOf(day), startYear + 1);
  const yearSpan = endYear - startYear || 1;

  const x = (year: number) => ((year - startYear) / yearSpan) * CHART_W;
  const y = (value: number) => CHART_H - ((value - min) / range) * CHART_H;

  const simPath = simPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(yearOf(p.day)).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(' ');

  // Only join historical points that are in consecutive years.
  const histSegments: string[] = [];
  for (let i = 1; i < histPoints.length; i++) {
    const a = histPoints[i - 1];
    const b = histPoints[i];
    if (b.year - a.year !== 1) continue;
    histSegments.push(
      `M ${x(a.year).toFixed(1)} ${y(a.value).toFixed(1)} L ${x(b.year).toFixed(1)} ${y(b.value).toFixed(1)}`,
    );
  }

  const hasGaps =
    histPoints.length > 1 &&
    histSegments.length < histPoints.length - 1;

  return (
    <div>
      <svg
        width={CHART_W}
        height={CHART_H}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label={`Trajectory of ${row.label} from 1789 to ${endYear}. Simulated shown solid, historical dashed.`}
      >
        {histSegments.map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="var(--color-steel-400)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        ))}
        {histPoints.map((p) => (
          <circle
            key={p.year}
            cx={x(p.year)}
            cy={y(p.value)}
            r="2"
            fill="none"
            stroke="var(--color-steel-400)"
            strokeWidth="1.2"
          />
        ))}
        {simPath && (
          <path d={simPath} fill="none" stroke="var(--color-brass-400)" strokeWidth="1.5" />
        )}
      </svg>
      {hasGaps && (
        <p className="text-small text-content-muted">
          gaps: no annual data
        </p>
      )}
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function historicalSeriesFor(metric: ComparisonRow['metric']): HistoricalSeries | undefined {
  switch (metric) {
    case 'population':
      return seriesById('population');
    case 'gdp_real':
    case 'gdp_per_capita_real':
      return seriesById('gdp_nominal');
    case 'federal_debt':
      return seriesById('federal_debt');
    case 'federal_receipts':
      return seriesById('federal_receipts');
    case 'federal_outlays':
      return seriesById('federal_outlays');
    default:
      return undefined;
  }
}

function simSeriesFor(state: GameState, metric: ComparisonRow['metric']): number[] | null {
  switch (metric) {
    case 'population':
      return state.series.population;
    case 'gdp_real':
      return state.series.gdp;
    case 'federal_debt':
      return state.series.debt;
    case 'federal_receipts':
      return state.series.receipts;
    case 'federal_outlays':
      return state.series.outlays;
    default:
      return null;
  }
}

/** Read the simulated values at (or just before) a given day. */
function readSeriesAt(state: GameState, day: number) {
  const { series } = state;
  let index = 0;
  for (let i = 0; i < series.days.length; i++) {
    if (series.days[i] <= day) index = i;
    else break;
  }

  return {
    population: series.population[index],
    gdp: series.gdp[index],
    debt: series.debt[index],
    receipts: series.receipts[index],
    outlays: series.outlays[index],
  };
}

function uniqueSources(): string[] {
  const sources = new Set<string>();
  for (const series of ALL_SERIES) {
    for (const figure of series.figures) sources.add(figure.source);
  }
  return [...sources].sort();
}
