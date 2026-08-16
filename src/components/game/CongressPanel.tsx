'use client';

/**
 * CONGRESS
 *
 * Who sits in the legislature the government has to carry, and what the
 * government has spent and promised getting things through it. (brief §2.2)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS HISTORY HERE AND WHAT IS MODEL
 *
 * The seat counts are history: the Constitution's original allocation, the
 * Apportionment Act of 1792, two senators per state, and the real admission
 * dates. The PARTY SPLIT of those seats is a model derived from each region's
 * economic character and its sentiment toward the government, and the screen
 * says so rather than letting the player assume otherwise. Steel is reserved for
 * historical figures (UI.md §9), so the seat totals may use it and the party
 * shares may not.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PHASE_1_CONTENT } from '@/content';
import { formatLongDate } from '@/sim/calendar';
import { partiesOn, seatsByParty, totalSeats } from '@/sim/congress';
import { SEAT_SOURCES } from '@/content/government/congress';
import type { GameState, PartyId } from '@/sim/types';

export function CongressPanel({ state }: { state: GameState }) {
  const parties = partiesOn(PHASE_1_CONTENT.parties, state.day);
  const byId = new Map(parties.map((p) => [p.id, p]));
  const totals = totalSeats(state.congress);
  const isRepublic = state.governmentType === 'republic';

  const outstanding = state.congress.obligations.filter((o) => o.settledDay === null);

  return (
    <div className="space-y-3">
      {/* --- What Congress means on this path -------------------------------- */}
      <section
        className={`rounded-card border p-3 ${
          isRepublic ? 'border-ink-400 bg-ink-700' : 'border-brass-400/40 bg-ink-600'
        }`}
      >
        <h3 className="text-label uppercase tracking-wider text-content-muted">
          {isRepublic ? 'The legislature you must carry' : 'The legislature you do not need'}
        </h3>
        <p className="mt-1 max-w-prose text-body text-content-secondary">
          {isRepublic
            ? 'Every bill must pass both chambers. The projected division is shown ' +
              'on each bill before you commit to it, with every delegation’s ' +
              'reasoning, so a defeat should never be a surprise.'
            : 'You rule by decree, and Congress does not vote on what you do. It is ' +
              'shown because these are still the interests of the country, and ' +
              'the men who would have objected are the men whose grievance you ' +
              'are accumulating.'}
        </p>
      </section>

      {/* --- Composition ----------------------------------------------------- */}
      <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-label uppercase tracking-wider text-content-muted">
            The {ordinal(state.congress.number)} Congress
          </h3>
          <span className="text-small text-content-muted">
            convened {formatLongDate(state.congress.convenedDay)}
          </span>
        </div>

        <div className="mt-2 grid gap-3 lg:grid-cols-2">
          {(['house', 'senate'] as const).map((chamber) => {
            const seats = seatsByParty(state.congress, chamber, parties);
            const total = chamber === 'house' ? totals.house : totals.senate;

            return (
              <div key={chamber} data-chamber={chamber}>
                <div className="flex items-baseline justify-between">
                  <span className="text-body text-content-primary">
                    {chamber === 'house' ? 'House of Representatives' : 'Senate'}
                  </span>
                  {/* Seat totals ARE history: steel is permitted. (UI.md §9) */}
                  <span className="tabular text-data-sm text-steel-400">
                    {total} seats
                  </span>
                </div>

                <ul className="mt-1 space-y-0.5">
                  {Object.entries(seats)
                    .sort((a, b) => b[1] - a[1])
                    .map(([partyId, count]) => (
                      <li
                        key={partyId}
                        className="flex items-baseline justify-between text-small"
                      >
                        <span className="text-content-secondary">
                          {byId.get(partyId as PartyId)?.name ?? partyId}
                        </span>
                        <span className="tabular text-content-primary">
                          {count.toFixed(0)}{' '}
                          <span className="text-content-muted">
                            ({((count / Math.max(1, total)) * 100).toFixed(0)}%)
                          </span>
                        </span>
                      </li>
                    ))}
                </ul>

                {chamber === 'senate' && (
                  <p
                    className="mt-1.5 text-small text-content-muted"
                    data-testid="senate-classes"
                  >
                    Only a third of the Senate faces election at a time
                    (Article I §3), so it lags the House by up to six years.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-3 max-w-prose border-t border-ink-400 pt-2 text-small text-content-muted">
          <strong className="font-normal text-content-secondary">
            Seat counts are historical.
          </strong>{' '}
          The Constitution allotted the first 65 House seats by name; the
          Apportionment Act of 1792 raised the House to 105 from the Third
          Congress; the Senate is two per state.{' '}
          <strong className="font-normal text-content-secondary">
            The party split is a model
          </strong>{' '}
          — derived from each region’s economy and its sentiment toward the
          government, not from a sourced roll call. It is never presented as a
          historical figure.
        </p>
        <ul className="mt-1">
          {SEAT_SOURCES.map((source) => (
            <li key={source} className="text-small text-content-muted">
              {source}
            </li>
          ))}
        </ul>
      </section>

      {/* --- The parties ------------------------------------------------------ */}
      <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
        <h3 className="text-label uppercase tracking-wider text-content-muted">
          The interests
        </h3>

        <div className="mt-2 grid gap-3 lg:grid-cols-2">
          {parties.map((party) => (
            <div key={party.id} data-party={party.id}>
              <p className="font-serif text-h2 text-content-primary">{party.name}</p>
              <p className="text-small text-content-muted">
                Discipline{' '}
                <span className="tabular">{(party.discipline * 100).toFixed(0)}%</span>
                {party.discipline < 0.5 && ' — members vote their state, not a line'}
              </p>

              {/* Whose side it takes, which is what a party IS in this model. */}
              <ul className="mt-1 space-y-0.5">
                {Object.entries(party.blocAffinity)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([bloc, affinity]) => (
                    <li key={bloc} className="text-small text-verdigris-400">
                      Speaks for the {bloc.replace(/_/g, ' ')}{' '}
                      <span className="tabular text-content-muted">
                        {affinity.toFixed(2)}
                      </span>
                    </li>
                  ))}
                {Object.entries(party.blocAffinity)
                  .sort((a, b) => a[1] - b[1])
                  .slice(0, 2)
                  .map(([bloc, affinity]) => (
                    <li key={bloc} className="text-small text-oxblood-300">
                      Set against the {bloc.replace(/_/g, ' ')}{' '}
                      <span className="tabular text-content-muted">
                        {affinity.toFixed(2)}
                      </span>
                    </li>
                  ))}
              </ul>

              <details className="mt-1.5">
                <summary className="cursor-pointer text-small text-brass-300">
                  Historical context
                </summary>
                <p className="mt-1 max-w-prose font-serif text-body-serif text-content-secondary">
                  {party.historicalNote}
                </p>
                <ul className="mt-1">
                  {party.sources.map((source) => (
                    <li key={source} className="text-small text-content-muted">
                      {source}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </div>
      </section>

      {/* --- The government's record ------------------------------------------ */}
      <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
        <h3 className="text-label uppercase tracking-wider text-content-muted">
          The government’s standing in the house
        </h3>

        <p className="mt-1 text-body text-content-secondary">
          {state.congress.defeats === 0
            ? 'No bill of yours has yet been voted down.'
            : `You have lost ${state.congress.defeats} ` +
              `${state.congress.defeats === 1 ? 'division' : 'divisions'}. ` +
              'Each one costs more standing than the last.'}
        </p>

        {Object.keys(state.congress.cooldowns).length > 0 && (
          <div className="mt-2">
            <p className="text-label uppercase tracking-wider text-content-muted">
              Cannot be brought again yet
            </p>
            <ul className="mt-0.5">
              {Object.entries(state.congress.cooldowns)
                .filter(([, until]) => until > state.day)
                .map(([billId, until]) => {
                  const bill = PHASE_1_CONTENT.bills.find((b) => b.id === billId);
                  return (
                    <li key={billId} className="text-small text-oxblood-300">
                      {bill?.name ?? billId} — {until - state.day} days
                    </li>
                  );
                })}
            </ul>
          </div>
        )}

        {outstanding.length > 0 && (
          <div className="mt-2" data-testid="obligations">
            <p className="text-label uppercase tracking-wider text-content-muted">
              Promises outstanding
            </p>
            <ul className="mt-0.5">
              {outstanding.map((obligation) => (
                <li key={obligation.id} className="text-small text-brass-300">
                  {byId.get(obligation.party)?.shortName ?? obligation.party} — due{' '}
                  {formatLongDate(obligation.dueDay)}, at{' '}
                  <span className="tabular">{obligation.cost.toFixed(0)}</span>{' '}
                  political capital
                </li>
              ))}
            </ul>
            <p className="mt-1 max-w-prose text-small text-content-muted">
              A promise called in when the Treasury of goodwill is empty costs
              standing instead, and everyone learns what your word is worth.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function ordinal(n: number): string {
  const words = [
    '',
    'First',
    'Second',
    'Third',
    'Fourth',
    'Fifth',
    'Sixth',
    'Seventh',
    'Eighth',
    'Ninth',
    'Tenth',
  ];
  return words[n] ?? `${n}th`;
}
