'use client';

/**
 * THE MAP
 *
 * Phase 2 brief §6: "The main view becomes a map of the United States as it
 * currently exists in-game." This replaces the Desk.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE IS AND IS NOT
 *
 * It is a renderer (DESIGN.md Rule 7). Every number and every word on the map
 * comes from `mapView()` in `src/sim/map.ts`; this file turns a bucket index
 * into a design token and draws paths. There is no arithmetic here beyond
 * layout.
 *
 * THREE THINGS IT HAS TO SAY OUT LOUD
 *
 * 1. THE OUTLINES ARE MODERN. Virginia here excludes West Virginia, which did
 *    not exist until 1863. The brief asks for this simplification to be
 *    "documented prominently and visibly in-game" rather than discovered.
 * 2. MOST FIGURES ARE REGIONAL. Four regions, no state-level economy, so states
 *    sharing a region share a colour. Stated in the basis line under the mode.
 * 3. ABSENCE IS DRAWN, NOT SHADED. A cell with no figure gets its own flat fill
 *    and is counted in the legend, because a neutral shade would read as a
 *    middling value and that would be a fabricated one.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo, useState } from 'react';
import { PARTIES } from '@/content';
import { MAP_VIEWBOX, STATE_SHAPES } from '@/content/map/geometry';
import { formatLongDate } from '@/sim/calendar';
import {
  MAP_MODES,
  MAP_MODE_DESCRIPTION,
  MAP_MODE_LABEL,
  mapView,
  type MapCell,
  type MapMode,
} from '@/sim/map';
import type { GameState } from '@/sim/types';

/** Bucket index to fill token, per mode. The sim never knows these exist. */
const FILL: Record<MapMode, readonly string[]> = {
  political: [
    'var(--color-map-state)',
    'var(--color-map-petitioning)',
    'var(--color-map-organized)',
    'var(--color-map-unorganized)',
    'var(--color-map-disputed)',
    'var(--color-map-native)',
    'var(--color-map-foreign)',
  ],
  support: [
    'var(--color-map-div-0)',
    'var(--color-map-div-1)',
    'var(--color-map-div-2)',
    'var(--color-map-div-3)',
    'var(--color-map-div-4)',
    'var(--color-map-div-5)',
  ],
  economic: [
    'var(--color-map-seq-0)',
    'var(--color-map-seq-1)',
    'var(--color-map-seq-2)',
    'var(--color-map-seq-3)',
    'var(--color-map-seq-4)',
    'var(--color-map-seq-5)',
  ],
  party: [
    'var(--color-map-party-0)',
    'var(--color-map-party-1)',
    'var(--color-map-party-2)',
    'var(--color-map-party-3)',
    'var(--color-map-party-divided)',
  ],
};

const NO_DATA = 'var(--color-map-nodata)';

function fillFor(mode: MapMode, bucket: number | null): string {
  if (bucket === null) return NO_DATA;
  const scale = FILL[mode];
  return scale[bucket] ?? NO_DATA;
}

/** Codes are drawn in a fixed order, so the DOM does not reshuffle on a mode change. */
const CODES = STATE_SHAPES.map((s) => s.code);

export function MapPanel({ state }: { state: GameState }) {
  const [mode, setMode] = useState<MapMode>('political');
  const [selected, setSelected] = useState<string | null>(null);

  // Recomputed when the published snapshot changes, not on every render — the
  // map runs over fifty cells and this is the main view. (D-011)
  const view = useMemo(
    () => mapView(state, mode, CODES, PARTIES),
    [state, mode],
  );

  const byCode = useMemo(
    () => new Map(view.cells.map((c) => [c.code, c])),
    [view],
  );

  const active = selected ? (byCode.get(selected) ?? null) : null;

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_320px]" data-testid="map">
      <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
        {/* --- Mode control. HOI4 puts it in a corner; so do we. ----------- */}
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Map mode">
          {MAP_MODES.map((m) => (
            <button
              key={m}
              type="button"
              data-map-mode={m}
              aria-pressed={m === mode}
              title={MAP_MODE_DESCRIPTION[m]}
              onClick={() => setMode(m)}
              className={`rounded px-2 py-1 text-small transition-colors ${
                m === mode
                  ? 'bg-brass-400 text-ink-900'
                  : 'bg-ink-600 text-content-secondary hover:bg-ink-500'
              }`}
            >
              {MAP_MODE_LABEL[m]}
            </button>
          ))}
          <span className="ml-auto tabular text-small text-content-muted">
            {formatLongDate(state.day)}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
          className="mt-2 h-auto w-full"
          role="img"
          aria-label={`Map of the United States, ${MAP_MODE_LABEL[mode].toLowerCase()} mode`}
        >
          {STATE_SHAPES.map((shape) => {
            const cell = byCode.get(shape.code);
            const isSelected = shape.code === selected;
            return (
              <path
                key={shape.code}
                d={shape.d}
                data-map-cell={shape.code}
                data-bucket={cell?.bucket ?? 'none'}
                fill={fillFor(mode, cell?.bucket ?? null)}
                stroke={
                  isSelected ? 'var(--color-brass-focus)' : 'var(--color-map-border)'
                }
                strokeWidth={isSelected ? 2.5 : 0.75}
                className="cursor-pointer"
                onClick={() => setSelected(isSelected ? null : shape.code)}
              >
                {/* A title element is the accessible hover for an SVG shape,
                    and it is what a screen reader announces. */}
                <title>{`${cell?.name ?? shape.name} — ${cell?.label ?? 'No figure'}`}</title>
              </path>
            );
          })}
        </svg>

        {/* --- The simplification, stated on the map itself. (brief §6.1) --- */}
        <p className="mt-1 text-small text-content-muted" data-testid="map-caveat">
          Outlines are modern state boundaries used as a drawing convenience.
          They are not the borders of {formatLongDate(state.day)} — Virginia here
          excludes West Virginia, which did not exist until 1863, and
          Massachusetts excludes the District of Maine. The labels and statuses
          are the real ones for the date.
        </p>
      </section>

      <div className="space-y-3">
        <Legend view={view} mode={mode} />
        {active ? (
          <CellDetail cell={active} onClose={() => setSelected(null)} />
        ) : (
          <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
            <p className="text-small text-content-muted">
              Click any state or territory to see what it was on this date.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function Legend({ view, mode }: { view: ReturnType<typeof mapView>; mode: MapMode }) {
  return (
    <section
      className="rounded-card border border-ink-400 bg-ink-700 p-3"
      data-testid="map-legend"
    >
      <h3 className="text-label uppercase tracking-wider text-content-muted">
        {MAP_MODE_LABEL[mode]}
      </h3>

      <ul className="mt-2 space-y-1">
        {view.legend.map((entry) => (
          <li key={entry.bucket} className="flex items-center gap-2 text-small">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 shrink-0 rounded-sm border border-ink-400"
              style={{ background: fillFor(mode, entry.bucket) }}
            />
            {/* The word is the legend. The swatch is decoration beside it, so
                nothing here depends on telling two colours apart. (UI.md §10) */}
            <span className="text-content-secondary">{entry.label}</span>
          </li>
        ))}

        {view.withoutData > 0 && (
          <li
            className="flex items-center gap-2 border-t border-ink-400 pt-1 text-small"
            data-testid="map-nodata"
          >
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 shrink-0 rounded-sm border border-ink-400"
              style={{ background: NO_DATA }}
            />
            <span className="text-content-muted">
              No figure — <span className="tabular">{view.withoutData}</span>{' '}
              {view.withoutData === 1 ? 'area' : 'areas'}
            </span>
          </li>
        )}
      </ul>

      <p className="mt-2 border-t border-ink-400 pt-2 text-small text-content-muted">
        {view.basis}
      </p>
    </section>
  );
}

function CellDetail({ cell, onClose }: { cell: MapCell; onClose: () => void }) {
  return (
    <section
      className="rounded-card border border-ink-400 bg-ink-700 p-3"
      data-testid="map-detail"
      data-detail-code={cell.code}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-h2 text-content-primary">{cell.name}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-small text-content-muted hover:text-content-secondary"
        >
          Close
        </button>
      </div>

      <p className="mt-1 text-small text-content-secondary">{cell.label}</p>
      <p className="mt-2 text-small text-content-muted">{cell.detail}</p>

      {cell.value !== null && (
        <p className="mt-2 border-t border-ink-400 pt-2 tabular text-data-sm text-content-primary">
          {cell.value.toFixed(0)}
        </p>
      )}
    </section>
  );
}
