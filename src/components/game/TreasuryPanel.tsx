'use client';

/**
 * TREASURY
 *
 * The budget screen. Tax rates left, spending right, live projection below,
 * and an explicit Enact step. (UI.md §5.4)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PROJECTION IS THE REAL ENGINE
 *
 * Dragging a slider clones the state, applies the proposed policy, and runs
 * `advanceDay` forward a year. It is not a simplified revenue formula written
 * for this screen. Two calculations of the same quantity drift apart, and the
 * one on screen — the one the player is deciding from — would be the liar.
 *
 * Because it is the real engine, the projection INCLUDES the lagged sentiment
 * and compliance effects: raise the excise and the projected receipts already
 * account for the frontier refusing to pay. That is the whole point.
 *
 * The forward run is debounced, not simplified.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatLongDate } from '@/sim/calendar';
import { TARIFF_REVENUE_PEAK } from '@/sim/calibration';
import { policyLegitimacyCost } from '@/sim/policy';
import {
  PROJECTION_DAYS,
  comparePolicies,
  policyDiffers,
  projectionBasisKey,
  type PolicyProjection,
  type ProposedPolicy,
} from '@/sim/projection';
import type { GameState } from '@/sim/types';
import { enactBudget } from '@/runtime/gameLoop';
import { complianceWord, formatCurrency, formatRate } from '@/lib/format';

/** Forward-simulating a year on every pixel of drag would be wasteful. */
const DEBOUNCE_MS = 180;

function policyOf(state: GameState): ProposedPolicy {
  return {
    taxRates: { ...state.policies.taxRates },
    spending: { ...state.policies.spending },
  };
}

export function TreasuryPanel({ state }: { state: GameState }) {
  const [draft, setDraft] = useState<ProposedPolicy>(() => policyOf(state));

  /**
   * The projection is stored WITH the inputs it was computed from.
   *
   * That makes "are we still computing" a derived fact — the stored result
   * either matches the current draft and basis or it does not — rather than a
   * second piece of state needing an effect to keep it in sync.
   *
   * `forBasis` is a projectionBasisKey, NOT the state object. Keying on the
   * state object meant re-simulating 730 days four times a second and blanking
   * every figure in between, which was the flicker reported in Phase 2 brief
   * §0.1. What makes a projection stale is a simulation question, so it is
   * answered in src/sim/. (DECISIONS.md D-011, D-012)
   */
  const [result, setResult] = useState<{
    forDraft: ProposedPolicy;
    forBasis: string;
    asAtDay: number;
    current: PolicyProjection;
    proposed: PolicyProjection;
  } | null>(null);

  const basis = projectionBasisKey(state);
  const fresh = result?.forDraft === draft && result?.forBasis === basis;

  /**
   * STALE-WHILE-REVALIDATE. The last projection stays on screen while a new one
   * computes, and the screen states the date it was computed from. A figure a
   * few weeks old that says so is better than an em-dash, and far better than
   * an em-dash that flashes four times a second.
   */
  const projection = result;
  const computing = !fresh;

  const dirty = policyDiffers(state, draft);

  /**
   * The latest state, without making it an effect dependency.
   *
   * The recompute effect must NOT re-run on every publish: its cleanup would
   * cancel the pending debounce every 250ms and the projection would never
   * settle. But when the debounce does fire it should simulate from the
   * freshest state available, not the one captured when it was scheduled.
   */
  const latestState = useRef(state);
  useEffect(() => {
    latestState.current = state;
  });

  /** Only the first computation is immediate; later ones absorb slider drags. */
  const computedOnce = useRef(false);

  useEffect(() => {
    const timer = setTimeout(
      () => {
        const from = latestState.current;
        computedOnce.current = true;
        // setState happens inside the timeout callback, not synchronously in
        // the effect body.
        setResult({
          forDraft: draft,
          forBasis: projectionBasisKey(from),
          asAtDay: from.day,
          ...comparePolicies(from, draft),
        });
      },
      computedOnce.current ? DEBOUNCE_MS : 0,
    );

    return () => clearTimeout(timer);
  }, [basis, draft]);

  const legitimacyCost = useMemo(
    () => policyLegitimacyCost(state, draft),
    [state, draft],
  );

  function setTax(key: keyof ProposedPolicy['taxRates'], value: number) {
    setDraft((d) => ({ ...d, taxRates: { ...d.taxRates, [key]: value } }));
  }

  function setSpend(key: keyof ProposedPolicy['spending'], value: number) {
    setDraft((d) => ({ ...d, spending: { ...d.spending, [key]: value } }));
  }

  function enact() {
    if (!dirty) return;
    enactBudget(draft);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        {/* --- Taxation ----------------------------------------------- */}
        <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
          <h3 className="text-label uppercase tracking-wider text-content-muted">
            Taxation
          </h3>

          <div className="mt-3 space-y-4">
            <RateSlider
              label="Tariff (average ad valorem)"
              value={draft.taxRates.tariffAvg}
              committed={state.policies.taxRates.tariffAvg}
              max={0.4}
              onChange={(v) => setTax('tariffAvg', v)}
              markAt={TARIFF_REVENUE_PEAK}
              markLabel="revenue peak"
              revenue={projection?.proposed.receipts.customs}
              note={
                draft.taxRates.tariffAvg > TARIFF_REVENUE_PEAK
                  ? 'Above the peak: suppressed trade now costs more than the rate gains.'
                  : undefined
              }
            />

            <RateSlider
              label="Excise (distilled spirits)"
              value={draft.taxRates.excise}
              committed={state.policies.taxRates.excise}
              max={0.3}
              onChange={(v) => setTax('excise', v)}
              revenue={projection?.proposed.receipts.excise}
              note={frontierNote(state, projection?.proposed)}
            />

            <RateSlider
              label="Land tax"
              value={draft.taxRates.landTax}
              committed={state.policies.taxRates.landTax}
              max={0.1}
              onChange={(v) => setTax('landTax', v)}
              revenue={projection?.proposed.receipts.land}
              note={
                draft.taxRates.landTax > 0
                  ? 'A direct tax is resented in every region at once, not just one.'
                  : undefined
              }
            />
          </div>
        </section>

        {/* --- Spending ----------------------------------------------- */}
        <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
          <h3 className="text-label uppercase tracking-wider text-content-muted">
            Spending
          </h3>

          <div className="mt-3 space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-body text-content-primary">Debt service</span>
                <span className="tabular text-data-sm text-content-primary">
                  {formatCurrency(state.treasury.annualisedOutlays.debtService)}
                </span>
              </div>
              <p className="text-small text-content-muted">
                Non-discretionary. Computed before anything else can be spent.
              </p>
            </div>

            <MoneySlider
              label="Military"
              value={draft.spending.military}
              committed={state.policies.spending.military}
              max={3_000_000}
              onChange={(v) => setSpend('military', v)}
            />
            <MoneySlider
              label="Civil administration"
              value={draft.spending.civil}
              committed={state.policies.spending.civil}
              max={2_000_000}
              onChange={(v) => setSpend('civil', v)}
            />
            <MoneySlider
              label="Infrastructure"
              value={draft.spending.infrastructure}
              committed={state.policies.spending.infrastructure}
              max={2_000_000}
              onChange={(v) => setSpend('infrastructure', v)}
              note="Compounds slowly and with diminishing returns."
            />
          </div>
        </section>
      </div>

      {/* --- Projection ----------------------------------------------- */}
      <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-label uppercase tracking-wider text-content-muted">
            Projection
          </h3>
          {/*
            The figures below are never blanked while a new run computes, so
            this line has to carry the honesty instead: it names the in-game
            date the projection was simulated from, which may be up to a month
            behind the clock. (DECISIONS.md D-012)
          */}
          <span className="text-small text-content-muted">
            {projection
              ? `${PROJECTION_DAYS} days forward from ${formatLongDate(projection.asAtDay)}`
              : 'simulating…'}
            {computing && projection && (
              <span className="ml-1.5 text-content-disabled">· recomputing</span>
            )}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-3">
          <div />
          <p className="text-label uppercase tracking-wider text-content-secondary">
            Current policy
          </p>
          <p className="text-label uppercase tracking-wider text-brass-300">
            Projected
          </p>

          <ProjectionRow
            label="Receipts"
            current={projection?.current.totalReceipts}
            proposed={projection?.proposed.totalReceipts}
          />
          <ProjectionRow
            label="Outlays"
            current={projection?.current.totalOutlays}
            proposed={projection?.proposed.totalOutlays}
          />
          <ProjectionRow
            label="Annual balance"
            current={projection?.current.annualBalance}
            proposed={projection?.proposed.annualBalance}
            emphasise
          />
          <ProjectionRow
            label="National debt"
            current={projection?.current.debtPrincipal}
            proposed={projection?.proposed.debtPrincipal}
            favourableWhenRising={false}
          />
          <ProjectionRow
            label="Credit rating"
            current={projection?.current.creditRating}
            proposed={projection?.proposed.creditRating}
            format={(v) => v.toFixed(0)}
          />
        </div>

        <p className="mt-3 max-w-prose text-small text-content-muted">
          Both columns are simulated forward over the same {PROJECTION_DAYS} days
          using the game&apos;s own engine, so they are directly comparable. The
          projection therefore already includes lagged sentiment and compliance
          effects — if a rate rise makes a region stop paying, the figures above
          reflect it.
        </p>

        {legitimacyCost > 0 && (
          <p className="mt-2 text-small text-oxblood-300">
            Enacting this tax rise will cost {legitimacyCost.toFixed(1)} legitimacy
            {state.governmentType === 'monarchy'
              ? ' — a crown may act with less consent than a republic.'
              : ' — a republic must carry the country with it.'}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 border-t border-ink-400 pt-3">
          <button
            type="button"
            onClick={enact}
            disabled={!dirty}
            className={`rounded-card border px-4 py-2 text-body transition-colors ${
              dirty
                ? 'border-brass-400 bg-brass-400 text-ink-900 hover:bg-brass-300'
                : 'cursor-not-allowed border-ink-400 text-content-disabled'
            }`}
          >
            Enact
          </button>
          <button
            type="button"
            onClick={() => setDraft(policyOf(state))}
            disabled={!dirty}
            className={`rounded-card border px-3 py-2 text-body ${
              dirty
                ? 'border-ink-400 text-content-secondary hover:bg-ink-500'
                : 'cursor-not-allowed border-ink-400/50 text-content-disabled'
            }`}
          >
            Revert
          </button>
          {!dirty && (
            <span className="text-small text-content-muted">
              No changes to enact.
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

function frontierNote(
  state: GameState,
  proposed: PolicyProjection | undefined,
): string | undefined {
  const frontier = state.regions.find((r) => r.id === 'frontier');
  if (!frontier) return undefined;
  const projected = proposed?.regionCompliance.frontier ?? frontier.compliance;
  return `Frontier compliance ${projected.toFixed(0)} — ${complianceWord(projected)}.`;
}

function ProjectionRow({
  label,
  current,
  proposed,
  format = formatCurrency,
  emphasise = false,
  favourableWhenRising = true,
}: {
  label: string;
  current: number | undefined;
  proposed: number | undefined;
  format?: (v: number) => string;
  emphasise?: boolean;
  favourableWhenRising?: boolean;
}) {
  const delta =
    current !== undefined && proposed !== undefined ? proposed - current : undefined;
  const better =
    delta === undefined || Math.abs(delta) < 0.5
      ? null
      : favourableWhenRising
        ? delta > 0
        : delta < 0;

  return (
    <>
      <p
        className={`text-small ${emphasise ? 'text-content-primary' : 'text-content-secondary'}`}
      >
        {label}
      </p>
      {/* data-projection-value: read by numberStability.test.tsx, which asserts
          these figures never blank while the clock runs. (DECISIONS.md D-011) */}
      <p
        data-projection-value={label}
        className="tabular text-data-sm text-content-primary"
      >
        {current === undefined ? '—' : format(current)}
      </p>
      <p
        data-projection-value={label}
        className={`tabular text-data-sm ${
          better === null
            ? 'text-brass-300'
            : better
              ? 'text-verdigris-400'
              : 'text-oxblood-300'
        }`}
      >
        {proposed === undefined ? '—' : format(proposed)}
        {delta !== undefined && Math.abs(delta) >= 0.5 && (
          <span className="ml-1 text-small">
            {better ? '▲' : '▼'}
            <span className="sr-only">
              {better ? 'better than current' : 'worse than current'}
            </span>
          </span>
        )}
      </p>
    </>
  );
}

function RateSlider({
  label,
  value,
  committed,
  max,
  onChange,
  revenue,
  note,
  markAt,
  markLabel,
}: {
  label: string;
  value: number;
  committed: number;
  max: number;
  onChange: (v: number) => void;
  revenue?: number;
  note?: string;
  markAt?: number;
  markLabel?: string;
}) {
  const changed = value !== committed;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-body text-content-primary" htmlFor={`rate-${label}`}>
          {label}
        </label>
        <span
          className={`tabular text-data-sm ${changed ? 'text-brass-300' : 'text-content-primary'}`}
        >
          {formatRate(value)}
          {changed && (
            <span className="ml-1.5 text-small text-content-muted">
              (now {formatRate(committed)})
            </span>
          )}
        </span>
      </div>

      <div className="relative mt-1">
        <input
          id={`rate-${label}`}
          type="range"
          min={0}
          max={max}
          step={0.005}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-brass-400"
        />
        {markAt !== undefined && markAt <= max && (
          <div
            className="pointer-events-none absolute top-0 h-full border-l border-brass-400/60"
            style={{ left: `${(markAt / max) * 100}%` }}
            aria-hidden
          />
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-small text-content-muted">
          {markAt !== undefined && markLabel
            ? `${markLabel} at ${formatRate(markAt, 0)}`
            : `0% to ${formatRate(max, 0)}`}
        </span>
        {revenue !== undefined && (
          <span className="tabular text-small text-content-secondary">
            {formatCurrency(revenue)} / yr
          </span>
        )}
      </div>

      {note && <p className="mt-0.5 text-small text-oxblood-300">{note}</p>}
    </div>
  );
}

function MoneySlider({
  label,
  value,
  committed,
  max,
  onChange,
  note,
}: {
  label: string;
  value: number;
  committed: number;
  max: number;
  onChange: (v: number) => void;
  note?: string;
}) {
  const changed = value !== committed;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-body text-content-primary" htmlFor={`spend-${label}`}>
          {label}
        </label>
        <span
          className={`tabular text-data-sm ${changed ? 'text-brass-300' : 'text-content-primary'}`}
        >
          {formatCurrency(value)}
          {changed && (
            <span className="ml-1.5 text-small text-content-muted">
              (now {formatCurrency(committed)})
            </span>
          )}
        </span>
      </div>
      <input
        id={`spend-${label}`}
        type="range"
        min={0}
        max={max}
        step={10_000}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-brass-400"
      />
      {note && <p className="text-small text-content-muted">{note}</p>}
    </div>
  );
}
