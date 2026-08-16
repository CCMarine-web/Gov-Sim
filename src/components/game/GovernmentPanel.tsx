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

import { HISTORICAL_ADMINISTRATIONS, OFFICES } from '@/content/government/cabinet';
import { candidatesFor } from '@/content/government/candidates';
import {
  appointmentStatus,
  cabinetCompetence,
  competenceWord,
  describeAppointmentStatus,
  holderOf,
  loyaltyWord,
} from '@/sim/cabinet';
import { APPOINTMENT_CAPITAL_COST } from '@/sim/calibration';
import { useState } from 'react';
import { formatLongDate, isoToDay, yearOf } from '@/sim/calendar';
import { RANGES, REPUBLIC_DECAY_PER_MONTH } from '@/sim/calibration';
import { explainStat } from '@/sim/modifiers';
import type { GameState } from '@/sim/types';
import { formatIndex } from '@/lib/format';

export function GovernmentPanel({
  state,
  onAppoint,
}: {
  state: GameState;
  /** Appoint someone to an office. Omitted where the panel is only rendered. */
  onAppoint?: (officeId: string, candidateId: string) => void;
}) {
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
            <span className="tabular">{formatLongDate(state.ruler.accededDay)}</span>
            {state.ruler.reignNumber > 0 && (
              <>
                {' · '}
                <span className="tabular">{state.ruler.reignNumber}</span>
                {state.ruler.reignNumber === 1 ? ' predecessor' : ' predecessors'}
              </>
            )}
          </p>

          <div className="mt-3 border-t border-ink-400 pt-2">
            <h4 className="text-label uppercase tracking-wider text-content-muted">
              Succession
            </h4>

            {isMonarchy ? (
              <>
                <p className="mt-1 text-body text-content-secondary">
                  The crown passes on your death. An heir inherits the crown, not
                  the standing — every transfer costs legitimacy.
                </p>

                {/*
                  Whether the next succession is orderly is a consequence of how
                  the country has been governed, so the screen says which it
                  currently is. That is the whole reason the mechanic is
                  conditional. (DECISIONS.md D-028)
                */}
                <p
                  data-testid="succession-outlook"
                  className={`mt-1.5 rounded border-l-2 px-2 py-1.5 text-small ${
                    state.ruler.heirName
                      ? 'border-ink-400 text-content-secondary'
                      : 'border-oxblood-400 text-oxblood-300'
                  }`}
                >
                  {state.ruler.heirName
                    ? `The succession is settled: ${state.ruler.heirName}. ` +
                      'Should you die, the crown passes without argument.'
                    : 'No successor is beyond argument. Your standing has fallen ' +
                      'far enough that the question of who comes next is worth ' +
                      'disputing, and your death would be a crisis rather than a ' +
                      'transfer.'}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-body text-content-secondary">
                  Elections are held, and the administration changes hands.
                </p>
                <p className="mt-1 text-small text-content-muted">
                  Congress and elections arrive with queue item 7. A president
                  does not die in office in this model — that is the crown&rsquo;s
                  risk, and its price.
                </p>
              </>
            )}

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
      <CabinetSection state={state} onAppoint={onAppoint} />

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


/**
 * THE CABINET (brief §5, queue item 13)
 *
 * Until this item the cabinet was a list of names with a note saying it had no
 * mechanical effect. It has one now, and the panel has to carry three things
 * the old list did not:
 *
 *   1. WHOSE APPOINTMENT IT IS. A player who appoints nobody gets the cabinet
 *      history gave them, and the panel says which is which — otherwise a
 *      player would believe they had chosen Hamilton.
 *   2. COMPETENCE AND LOYALTY, in words as well as numbers, with the fact that
 *      the ratings are a MODEL stated plainly. Nobody rated Hamilton out of a
 *      hundred, and a screen implying otherwise would be the project's hardest
 *      rule broken against a real person.
 *   3. WHAT IT WOULD COST, and on the republican path, that the Senate has to
 *      concur and can refuse.
 */
function CabinetSection({
  state,
  onAppoint,
}: {
  state: GameState;
  onAppoint?: (officeId: string, candidateId: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const republic = state.governmentType === 'republic';
  const mean = cabinetCompetence(state, OFFICES);

  return (
    <section
      className="rounded-card border border-ink-400 bg-ink-700 p-3"
      data-testid="cabinet"
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-label uppercase tracking-wider text-content-muted">
          Cabinet
        </h3>
        {mean !== null && (
          <span className="text-small text-content-secondary">
            {competenceWord(mean)}{' '}
            <span className="tabular text-content-muted">({mean.toFixed(0)})</span>
          </span>
        )}
      </div>

      <div className="mt-2 divide-y divide-ink-400">
        {OFFICES.map((office) => {
          const holder = holderOf(state, office);
          const exists = state.day >= isoToDay(office.createdOn);
          const candidates = candidatesFor(office.id);

          return (
            <div key={office.id} className="py-2" data-office={office.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-body text-content-primary">{office.title}</p>
                {holder ? (
                  <p className="text-body text-content-secondary">
                    {holder.name}
                    <span className="ml-2 text-small text-content-muted">
                      {holder.appointed ? 'your appointment' : 'as history had it'}
                    </span>
                  </p>
                ) : (
                  <p className="text-small text-content-muted">
                    {exists
                      ? 'Vacant'
                      : `Department not yet created — established ${formatLongDate(isoToDay(office.createdOn))}`}
                  </p>
                )}
              </div>

              {holder && (
                <div className="mt-1 flex flex-wrap gap-4" data-holder={office.id}>
                  <span className="text-small text-content-secondary">
                    Competence: {competenceWord(holder.competence)}{' '}
                    <span className="tabular text-content-muted">
                      ({holder.competence.toFixed(0)})
                    </span>
                  </span>
                  <span
                    className={`text-small ${
                      holder.loyalty < 40 ? 'text-oxblood-300' : 'text-content-secondary'
                    }`}
                  >
                    Loyalty: {loyaltyWord(holder.loyalty)}{' '}
                    <span className="tabular text-content-muted">
                      ({holder.loyalty.toFixed(0)})
                    </span>
                  </span>
                </div>
              )}

              {holder?.candidate && (
                <p className="mt-0.5 max-w-prose text-small text-content-muted">
                  {holder.candidate.note}
                </p>
              )}

              {exists && candidates.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setOpen(open === office.id ? null : office.id)}
                    aria-expanded={open === office.id}
                    className="mt-1 text-small text-brass-300 hover:text-brass-focus"
                  >
                    {open === office.id ? 'Close' : 'Consider someone else'}
                  </button>

                  {open === office.id && (
                    <ul className="mt-1 space-y-2" data-candidates={office.id}>
                      {candidates.map((candidate) => {
                        const status = appointmentStatus(state, office, candidate);
                        return (
                          <li key={candidate.id} data-candidate={candidate.id}>
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="text-small text-content-primary">
                                {candidate.name}
                              </span>
                              <span className="text-small text-content-muted">
                                {competenceWord(candidate.competence)} ·{' '}
                                {loyaltyWord(candidate.loyalty)}
                              </span>
                            </div>
                            <p className="max-w-prose text-small text-content-muted">
                              {candidate.note}
                            </p>
                            {status.kind === 'available' ? (
                              <button
                                type="button"
                                data-appoint={candidate.id}
                                disabled={
                                  state.politicalCapital.current <
                                  APPOINTMENT_CAPITAL_COST
                                }
                                onClick={() => onAppoint?.(office.id, candidate.id)}
                                className="mt-0.5 rounded border border-ink-400 px-2 py-1 text-small text-content-secondary hover:bg-ink-500 disabled:cursor-not-allowed disabled:text-content-disabled"
                              >
                                Appoint — {APPOINTMENT_CAPITAL_COST} capital
                                {republic && ', subject to the Senate'}
                              </button>
                            ) : (
                              <p className="text-small text-content-muted">
                                {describeAppointmentStatus(status)}
                              </p>
                            )}
                            <p className="text-small text-steel-400">
                              {candidate.sources.join('; ')}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/*
        THE RATINGS ARE A MODEL, and the screen says so on its face. The
        biographies are cited history; the numbers beside them are not, and
        nobody rated Hamilton out of a hundred. (DESIGN.md §12.2)
      */}
      <p
        className="mt-2 max-w-prose border-t border-ink-400 pt-2 text-small text-content-muted"
        data-testid="cabinet-note"
      >
        The biographies are history and are cited. The competence and loyalty
        ratings are a model — nobody rated these men out of a hundred — reasoned
        from what each did in office, and they are not a verdict on anybody.
        {republic
          ? ' Appointments require the Senate to concur, and it can refuse.'
          : ' The crown appoints, and nobody concurs.'}
      </p>

      {state.cabinet.resignations.length > 0 && (
        <p className="mt-1 text-small text-oxblood-300" data-testid="resignations">
          {state.cabinet.resignations.length}{' '}
          {state.cabinet.resignations.length === 1 ? 'officer has' : 'officers have'}{' '}
          resigned from this government.
        </p>
      )}
    </section>
  );
}
