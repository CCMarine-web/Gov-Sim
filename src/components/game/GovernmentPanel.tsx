'use client';

/**
 * GOVERNMENT
 *
 * The office, succession, the legitimacy breakdown, and the cabinet.
 * (UI.md §5.7)
 *
 * This is the screen where the monarchy/republic divergence should feel most
 * concrete. Nobody actually leaves office in the Phase 1 window, so the
 * divergence is expressed in what each path SAYS about how it would end, and
 * in how legitimacy behaves — which is visible right here in the breakdown:
 * a republic carries a standing decay line that a monarchy simply does not.
 */

import { HISTORICAL_ADMINISTRATIONS, OFFICES, type Tenure } from '@/content/government/cabinet';
import { formatLongDate, isoToDay, yearOf } from '@/sim/calendar';
import { RANGES, REPUBLIC_DECAY_PER_MONTH } from '@/sim/calibration';
import { explainStat } from '@/sim/modifiers';
import type { GameState } from '@/sim/types';
import { formatIndex } from '@/lib/format';

export function GovernmentPanel({ state }: { state: GameState }) {
  const isMonarchy = state.governmentType === 'monarchy';
  const age = yearOf(state.day) - state.ruler.birthYear;

  const breakdown = explainStat(
    'nation.legitimacy',
    state.nation.legitimacyBase,
    state.activeModifiers,
    state.day,
    RANGES.percent,
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        {/* --- The office ---------------------------------------------- */}
        <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
          <h3 className="text-label uppercase tracking-wider text-content-muted">
            The office
          </h3>

          <p className="mt-2 font-serif text-h1 text-content-primary">
            {state.ruler.name}
          </p>
          <p className="text-body text-content-secondary">
            {state.ruler.title} · {state.ruler.houseName}
          </p>
          <p className="mt-1 text-small text-content-muted">
            Age <span className="tabular">{age}</span> · in office since{' '}
            <span className="tabular">{formatLongDate(0)}</span>
          </p>

          <div className="mt-3 border-t border-ink-400 pt-2">
            <h4 className="text-label uppercase tracking-wider text-content-muted">
              Succession
            </h4>
            <p className="mt-1 text-body text-content-secondary">
              {isMonarchy
                ? 'The crown passes to your heir. Your bloodline continues the office.'
                : 'Elections are held, and the administration changes hands.'}
            </p>
            <p className="mt-1 text-small text-content-muted">
              Not simulated in Phase 1 — nobody leaves office before 1801.
              Arrives in Phase 2.
            </p>

            {/*
              The core of pillar 2, stated where it is most likely to be
              questioned: the player is not the officeholder.
            */}
            <p className="mt-2 rounded border border-brass-400/40 bg-ink-600 px-2 py-1.5 text-small text-brass-300">
              Whatever happens to the office, you remain. Officeholders change
              around you; you do not.
            </p>
          </div>
        </section>

        {/* --- Legitimacy ---------------------------------------------- */}
        <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-label uppercase tracking-wider text-content-muted">
              Legitimacy
            </h3>
            <span className="tabular text-data-lg text-content-primary">
              {formatIndex(state.nation.legitimacy)}
            </span>
          </div>

          {/*
            The modifier ledger given a permanent home rather than only a hover
            popover. It is important enough to be readable without discovering
            that stats are hoverable. (UI.md §5.7)
          */}
          <dl className="mt-2 space-y-1">
            <div className="flex justify-between text-small">
              <dt className="text-content-secondary">Accumulated base</dt>
              <dd className="tabular text-content-secondary">
                {breakdown.base.toFixed(1)}
              </dd>
            </div>

            {breakdown.contributions.map((c) => (
              <div key={c.modifierId} className="flex justify-between gap-2 text-small">
                <dt className="min-w-0 flex-1 truncate text-content-secondary">
                  <span className="text-content-muted">{c.sourceType}</span> {c.source}
                </dt>
                <dd
                  className={`tabular shrink-0 ${
                    c.effect >= 0 ? 'text-verdigris-400' : 'text-oxblood-300'
                  }`}
                >
                  {c.effect >= 0 ? '+' : ''}
                  {c.effect.toFixed(1)}
                </dd>
              </div>
            ))}

            {breakdown.contributions.length === 0 && (
              <p className="text-small text-content-muted">
                No modifiers currently apply.
              </p>
            )}

            {Math.abs(breakdown.clampAdjustment) > 0.001 && (
              <div className="flex justify-between text-small">
                <dt className="text-content-muted">Clamped to range</dt>
                <dd className="tabular text-content-muted">
                  {breakdown.clampAdjustment >= 0 ? '+' : ''}
                  {breakdown.clampAdjustment.toFixed(1)}
                </dd>
              </div>
            )}

            <div className="flex justify-between border-t border-ink-400 pt-1 text-small">
              <dt className="text-content-primary">Total</dt>
              <dd className="tabular text-content-primary">
                {breakdown.total.toFixed(1)}
              </dd>
            </div>
          </dl>

          {/* The founding choice, made legible. */}
          <div className="mt-3 border-t border-ink-400 pt-2">
            <h4 className="text-label uppercase tracking-wider text-content-muted">
              How your legitimacy behaves
            </h4>
            {isMonarchy ? (
              <ul className="mt-1 space-y-0.5 text-small text-content-secondary">
                <li>· Does not decay. The crown persists by right.</li>
                <li>· Converts prosperity into consent less efficiently.</li>
                <li>· A mishandled crisis costs considerably more.</li>
                <li>· Acting against opinion is cheaper than for a republic.</li>
              </ul>
            ) : (
              <ul className="mt-1 space-y-0.5 text-small text-content-secondary">
                <li>
                  ·{' '}
                  <span className="text-oxblood-300">
                    Decays {REPUBLIC_DECAY_PER_MONTH.toFixed(2)} each month
                  </span>{' '}
                  unless renewed by results.
                </li>
                <li>· Prosperity restores it at full rate.</li>
                <li>· Crises are absorbed more gracefully than a crown absorbs them.</li>
                <li>· Acting against opinion costs more political capital.</li>
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* --- Cabinet --------------------------------------------------- */}
      <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
        <h3 className="text-label uppercase tracking-wider text-content-muted">
          Cabinet
        </h3>

        <div className="mt-2 divide-y divide-ink-400">
          {OFFICES.map((office) => {
            const holder = holderOn(office.tenures, state.day);
            return (
              <div key={office.id} className="py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-body text-content-primary">{office.title}</p>
                  {holder ? (
                    <p className="text-body text-content-secondary">
                      {holder.name}
                      <span className="ml-2 text-small text-content-muted">
                        since <span className="tabular">{formatLongDate(isoToDay(holder.from))}</span>
                      </span>
                    </p>
                  ) : (
                    <p className="text-small text-content-muted">
                      {state.day < isoToDay(office.createdOn)
                        ? `Department not yet created — established ${formatLongDate(isoToDay(office.createdOn))}`
                        : 'Vacant'}
                    </p>
                  )}
                </div>
                {holder?.note && (
                  <p className="mt-0.5 max-w-prose text-small text-content-muted">
                    {holder.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/*
          Stated plainly rather than left for the player to discover: the
          cabinet follows history and does not answer to them yet.
        */}
        <p className="mt-2 max-w-prose border-t border-ink-400 pt-2 text-small text-content-muted">
          Cabinet tenures follow the historical record and have no mechanical
          effect in Phase 1. They do not respond to your decisions — in a run
          that diverges sharply from history these appointments will still turn
          over on their real schedule. Appointments become yours to make in
          Phase 2.
        </p>
      </section>

      {/* --- The office around you ------------------------------------- */}
      <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
        <h3 className="text-label uppercase tracking-wider text-content-muted">
          The presidency, historically
        </h3>
        <p className="mt-1 max-w-prose text-small text-content-secondary">
          In the real 1790s the office changed hands once. You do not — that is
          the premise of the game. Shown for comparison.
        </p>

        <div className="mt-2 space-y-1.5">
          {HISTORICAL_ADMINISTRATIONS.map((admin) => {
            const current =
              state.day >= isoToDay(admin.from) &&
              (admin.to === null || state.day < isoToDay(admin.to));
            return (
              <div
                key={admin.name}
                className={`rounded border px-2 py-1.5 ${
                  current ? 'border-steel-400/50 bg-ink-600' : 'border-ink-400'
                }`}
              >
                <p className="text-body text-steel-400">
                  {admin.name}
                  {current && (
                    <span className="ml-2 text-small text-content-muted">
                      in office on this date, historically
                    </span>
                  )}
                </p>
                <p className="text-small text-content-muted">
                  <span className="tabular">
                    {formatLongDate(isoToDay(admin.from))}
                  </span>
                  {admin.to && (
                    <>
                      {' to '}
                      <span className="tabular">
                        {formatLongDate(isoToDay(admin.to))}
                      </span>
                    </>
                  )}
                  {admin.note && <> · {admin.note}</>}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** Who held an office on a given day, or null. */
function holderOn(tenures: Tenure[], day: number): Tenure | null {
  for (const tenure of tenures) {
    const from = isoToDay(tenure.from);
    const to = tenure.to === null ? Infinity : isoToDay(tenure.to);
    if (day >= from && day <= to) return tenure;
  }
  return null;
}
