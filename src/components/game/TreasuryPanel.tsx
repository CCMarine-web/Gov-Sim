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
import { PHASE_1_CONTENT } from '@/content';
import { formatLongDate } from '@/sim/calendar';
import { TARIFF_REVENUE_PEAK } from '@/sim/calibration';
import { canAffordPolicy, policyLegitimacyCost } from '@/sim/policy';
import {
  PROJECTION_DAYS,
  comparePolicies,
  currentPolicy,
  policyDiffers,
  projectionBasisKey,
  type PolicyProjection,
  type ProposedPolicy,
} from '@/sim/projection';
import { TAX_BASES } from '@/sim/taxBases';
import { programsInForce, taxesInForce } from '@/sim/taxes';
import type { GameState, SpendingCategory, TaxInstance } from '@/sim/types';
import { enactBudget } from '@/runtime/gameLoop';
import { complianceWord, formatCurrency, formatRate } from '@/lib/format';

/** Forward-simulating a year on every pixel of drag would be wasteful. */
const DEBOUNCE_MS = 180;

/**
 * Slider ceilings, by the receipt bucket a tax rolls into.
 *
 * Per bucket rather than per tax, so a bill that creates a new excise gets a
 * sensible ceiling without anyone editing this component. The ceilings are
 * presentation — how far the control travels — not simulation limits: the engine
 * will compute any rate up to 100%, and the tariff curve turning over at 25% is
 * a fact of the model rather than a bound imposed here. (UI.md §5.4)
 */
const RATE_CEILING: Record<'customs' | 'excise' | 'land' | 'other', number> = {
  customs: 0.4,
  excise: 0.3,
  land: 0.1,
  other: 0.2,
};

/** Spending slider ceilings, by category. Same reasoning as RATE_CEILING. */
const PROGRAM_CEILING: Record<SpendingCategory, number> = {
  military: 3_000_000,
  civil: 2_000_000,
  infrastructure: 2_000_000,
};

export function TreasuryPanel({ state }: { state: GameState }) {
  const [draft, setDraft] = useState<ProposedPolicy>(() => currentPolicy(state));

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
          ...comparePolicies(from, draft, PHASE_1_CONTENT),
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

  /**
   * Whether the government can afford to act, and why not if it cannot.
   *
   * The reason is computed in `src/sim/` rather than here (Rule 7), and it is a
   * sentence rather than a boolean, because a control that refuses without
   * saying why is the same failure the modifier ledger exists to prevent —
   * applied to actions instead of numbers. (brief §2.2)
   */
  const affordability = useMemo(
    () => canAffordPolicy(state, draft),
    [state, draft],
  );

  function setRate(taxId: string, value: number) {
    setDraft((d) => ({ ...d, rates: { ...d.rates, [taxId]: value } }));
  }

  function setAmount(programId: string, value: number) {
    setDraft((d) => ({ ...d, amounts: { ...d.amounts, [programId]: value } }));
  }

  /** Both gates. `enactPolicy` throws if the second is skipped, deliberately. */
  const canEnact = dirty && affordability.ok;

  function enact() {
    if (!canEnact) return;
    enactBudget(draft);
  }

  /*
    TREASURY RENDERS WHATEVER EXISTS.

    These two lists come from state, not from this file. Three hard-coded tax
    rows and three hard-coded spending rows are what brief §4.3 replaced: when a
    bill creates a tax, its line appears here with no component edit, and when a
    tax is repealed the line goes. The slider ceilings and the notes come from
    the tax's own BASE, so a new base brings its own presentation with it.
  */
  const taxes = taxesInForce(state.policies, state.day);
  const programs = programsInForce(state.policies, state.day);

  /** Net revenue this tax is projected to raise, from the attribution lines. */
  const projectedFor = (taxId: string): number | undefined =>
    projection?.proposed.revenueByTax[taxId];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        {/* --- Taxation ----------------------------------------------- */}
        <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-label uppercase tracking-wider text-content-muted">
              Taxation
            </h3>
            <span className="text-small text-content-muted">
              <span className="tabular">{taxes.length}</span>{' '}
              {taxes.length === 1 ? 'tax' : 'taxes'} in force
            </span>
          </div>

          <div className="mt-3 space-y-4">
            {taxes.length === 0 && (
              <p className="text-small text-content-muted">
                No taxes are levied. The Treasury has no revenue of its own.
              </p>
            )}

            {taxes.map((tax) => (
              <TaxSlider
                key={tax.id}
                tax={tax}
                value={draft.rates[tax.id] ?? tax.rate}
                onChange={(v) => setRate(tax.id, v)}
                revenue={projectedFor(tax.id)}
                extraNote={
                  tax.base === 'spirits'
                    ? frontierNote(state, projection?.proposed)
                    : undefined
                }
              />
            ))}
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

            {programs.map((program) => (
              <MoneySlider
                key={program.id}
                label={program.name}
                value={draft.amounts[program.id] ?? program.annualAmount}
                committed={program.annualAmount}
                max={PROGRAM_CEILING[program.category]}
                onChange={(v) => setAmount(program.id, v)}
              />
            ))}
          </div>
        </section>
      </div>

      {/* --- Where the money comes from -------------------------------- */}
      <RevenueAttribution state={state} />

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

        {/* The price of acting, stated before the player commits. */}
        {dirty && (
          <p
            className={`mt-2 text-small ${
              affordability.ok ? 'text-content-secondary' : 'text-oxblood-300'
            }`}
            data-testid="capital-cost"
          >
            Political capital:{' '}
            <span className="tabular">{affordability.cost.toFixed(1)}</span> of{' '}
            <span className="tabular">{affordability.available.toFixed(1)}</span>{' '}
            available.
            {affordability.reason && ` ${affordability.reason}`}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 border-t border-ink-400 pt-3">
          <button
            type="button"
            onClick={enact}
            disabled={!canEnact}
            title={affordability.reason ?? undefined}
            className={`rounded-card border px-4 py-2 text-body transition-colors ${
              canEnact
                ? 'border-brass-400 bg-brass-400 text-ink-900 hover:bg-brass-300'
                : 'cursor-not-allowed border-ink-400 text-content-disabled'
            }`}
          >
            Enact
          </button>
          <button
            type="button"
            onClick={() => setDraft(currentPolicy(state))}
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

/**
 * REVENUE ATTRIBUTION
 *
 * Brief §4.3: every dollar is attributable to the law that raised it. This is
 * the screen that makes that true — one row per tax in force, showing what it
 * assessed, what could not be collected, what was not remitted, and what
 * actually arrived, summing visibly to the headline receipts figure.
 *
 * The same honesty contract as the modifier popover, applied to money: if the
 * arithmetic on screen did not reconcile to the total, this panel would be
 * lying. (docs/DECISIONS.md D-019)
 */
function RevenueAttribution({ state }: { state: GameState }) {
  const lines = state.treasury.receiptLines;
  const receipts = state.treasury.annualisedReceipts;
  const other = receipts.other;
  const total = receipts.customs + receipts.excise + receipts.land + other;

  return (
    <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-label uppercase tracking-wider text-content-muted">
          Where the revenue comes from
        </h3>
        <span className="text-small text-content-muted">annual run rate</span>
      </div>

      {lines.length === 0 ? (
        <p className="mt-2 text-small text-content-muted">
          No revenue has been assessed yet. The first assessment falls on the
          first of the month.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table
            className="w-full border-collapse text-small"
            style={{ minWidth: 'var(--size-table-treasury)' }}
          >
            <thead>
              <tr className="border-b border-ink-400 text-left">
                <th className="py-1 pr-3 font-normal text-content-secondary">Tax</th>
                <th className="py-1 pr-3 text-right font-normal text-content-secondary">
                  Rate
                </th>
                <th className="py-1 pr-3 text-right font-normal text-content-secondary">
                  Assessed
                </th>
                <th className="py-1 pr-3 text-right font-normal text-content-secondary">
                  Not remitted
                </th>
                <th className="py-1 pr-3 text-right font-normal text-content-secondary">
                  Uncollected
                </th>
                <th className="py-1 text-right font-normal text-content-primary">
                  Received
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.taxId} className="border-b border-ink-400/40">
                  <td className="py-1 pr-3 text-content-primary">
                    {line.name}
                    <span className="ml-1.5 text-content-muted">
                      · {TAX_BASES[line.base].label.toLowerCase()}
                    </span>
                    {/* Which law produced this money. The whole point. */}
                    {line.createdByBillId && (
                      <span className="ml-1.5 text-content-muted">
                        · by {line.createdByBillId}
                      </span>
                    )}
                  </td>
                  <td className="tabular py-1 pr-3 text-right text-content-secondary">
                    {formatRate(line.rate)}
                  </td>
                  <td className="tabular py-1 pr-3 text-right text-content-secondary">
                    {formatCurrency(line.gross)}
                  </td>
                  <td className="tabular py-1 pr-3 text-right text-oxblood-300">
                    {line.lostToNonCompliance > 0
                      ? `−${formatCurrency(line.lostToNonCompliance)}`
                      : '—'}
                  </td>
                  <td className="tabular py-1 pr-3 text-right text-oxblood-300">
                    {line.lostToCollection > 0
                      ? `−${formatCurrency(line.lostToCollection)}`
                      : '—'}
                  </td>
                  <td className="tabular py-1 text-right text-content-primary">
                    {formatCurrency(line.net)}
                  </td>
                </tr>
              ))}

              {/* Receipts that belong to no tax: the post office, patents, land
                  sales. Shown rather than folded into a total, so the column
                  still adds up on screen. */}
              <tr className="border-b border-ink-400/40">
                <td className="py-1 pr-3 text-content-secondary">
                  Fees, posts and land sales
                  <span className="ml-1.5 text-content-muted">· not a tax</span>
                </td>
                <td className="py-1 pr-3" />
                <td className="py-1 pr-3" />
                <td className="py-1 pr-3" />
                <td className="py-1 pr-3" />
                <td className="tabular py-1 text-right text-content-secondary">
                  {formatCurrency(other)}
                </td>
              </tr>

              <tr>
                <td className="py-1 pr-3 text-content-primary">Total receipts</td>
                <td className="py-1 pr-3" />
                <td className="py-1 pr-3" />
                <td className="py-1 pr-3" />
                <td className="py-1 pr-3" />
                <td className="tabular py-1 text-right text-content-primary">
                  {formatCurrency(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 max-w-prose text-small text-content-muted">
        <strong className="font-normal text-content-secondary">Not remitted</strong> is
        revenue a region assessed but did not pay — a question of consent.{' '}
        <strong className="font-normal text-content-secondary">Uncollected</strong> is
        revenue the administration could not reach — a question of capacity. They
        have different causes and different remedies, so they are shown apart.
      </p>
    </section>
  );
}

/**
 * One tax, with its rate, its projected yield, and its own history.
 *
 * Everything presentational comes from the tax and its base rather than from a
 * hard-coded row: the ceiling, the revenue-peak mark, the historicity label and
 * the note. That is what lets a bill add a tax without anyone editing this file.
 */
function TaxSlider({
  tax,
  value,
  onChange,
  revenue,
  extraNote,
}: {
  tax: TaxInstance;
  value: number;
  onChange: (v: number) => void;
  revenue?: number;
  extraNote?: string;
}) {
  const definition = TAX_BASES[tax.base];
  const trade = definition.assessment === 'trade';

  return (
    <div>
      <RateSlider
        label={tax.name}
        value={value}
        committed={tax.rate}
        max={RATE_CEILING[definition.bucket]}
        onChange={onChange}
        revenue={revenue}
        /* The revenue peak only means anything for a tax that suppresses the
           thing it taxes. A land tax has no peak: land does not go away. */
        markAt={trade && definition.suppressesItsOwnBase ? TARIFF_REVENUE_PEAK : undefined}
        markLabel="revenue peak"
        note={
          value > TARIFF_REVENUE_PEAK && trade && definition.suppressesItsOwnBase
            ? 'Above the peak: suppressed trade now costs more than the rate gains.'
            : extraNote
        }
      />

      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 text-small text-content-muted">
        <span>{definition.description}</span>
        {tax.collectionEfficiency < 1 && (
          <span>
            Collectable:{' '}
            <span className="tabular">{formatRate(tax.collectionEfficiency, 0)}</span>
          </span>
        )}
      </div>

      {tax.exemptions.length > 0 && (
        <ul className="mt-0.5">
          {tax.exemptions.map((exemption) => (
            <li key={exemption} className="text-small text-content-muted">
              Exempt: {exemption}
            </li>
          ))}
        </ul>
      )}

      <details className="mt-1">
        <summary className="cursor-pointer text-small text-brass-300">
          Historical context
        </summary>
        <p className="mt-1 max-w-prose font-serif text-body-serif text-content-secondary">
          {definition.historicalNote}
        </p>
        <ul className="mt-1">
          {definition.sources.map((source) => (
            <li key={source} className="text-small text-content-muted">
              {source}
            </li>
          ))}
        </ul>
      </details>
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
