'use client';

/**
 * LEGISLATION
 *
 * The heart of the game (Phase 2 brief §4). Bills organised by department, each
 * showing what it does, what it costs in political capital and money, who gains
 * and who loses by it, and — where it cannot be passed — exactly what is in the
 * way.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE THREE THINGS THIS SCREEN OWES THE PLAYER
 *
 *   1. NOTHING IS HIDDEN. Every department is listed even when it has no
 *      content, and every bill is listed even when it is locked. A department
 *      with nothing in it says what would fill it; a locked bill says what would
 *      unlock it, or why nothing ever will. A player should be able to see the
 *      shape of the government they do not yet have.
 *
 *   2. THE HISTORY IS TRUE. Every bill carries a factual note and its sources,
 *      on every tier. A counterfactual needs it more than an enacted bill does,
 *      because the player has to know what they are departing from.
 *
 *   3. THE PRICE IS STATED FIRST. Political capital, treasury cost and the bloc
 *      reactions are all shown before the player commits, never after.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Zero simulation maths lives here. Availability, cost, and the reason a bill is
 * blocked all come from `src/sim/bills.ts`. (DESIGN.md Rule 7)
 */

import { useMemo, useState } from 'react';
import { PHASE_1_CONTENT } from '@/content';
import {
  amendCost,
  billStatus,
  enactedRecord,
  priceOf,
  type BillStatus,
} from '@/sim/bills';
import {
  NO_TACTICS,
  bothChambers,
  partiesOn,
  tacticsCost,
  type BillTactics,
  type WhipCount,
} from '@/sim/congress';
import { formatLongDate, isoToDay } from '@/sim/calendar';
import { amendLegislation, enactLegislation, repealLegislation } from '@/runtime/gameLoop';
import { formatCurrency, formatRate } from '@/lib/format';
import {
  DEPARTMENTS,
  type Bill,
  type BillHistoricity,
  type Department,
  type GameState,
} from '@/sim/types';

/** What a player sees. Ordered as the brief lists them. */
const DEPARTMENT_LABEL: Record<Department, string> = {
  taxation: 'Taxation',
  trade: 'Trade & Tariffs',
  banking: 'Banking & Currency',
  military: 'Military & Naval',
  judiciary: 'Federal Judiciary & Law Enforcement',
  public_works: 'Public Works & Infrastructure',
  land: 'Land & Territory',
  immigration: 'Immigration & Naturalization',
  slavery_civil_rights: 'Slavery & Civil Rights',
  education: 'Education',
  postal: 'Postal & Communications',
  foreign_affairs: 'Foreign Affairs & Treaties',
  agriculture: 'Agriculture',
  labor: 'Labor & Manufactures',
  health_welfare: 'Health & Welfare',
  elections: 'Elections & Suffrage',
  administration: 'Federal Administration',
};

/**
 * Why a department is as thin as it is.
 *
 * Brief §4.1: "Not every category has content in 1790 — empty ones show what
 * unlocks them and when, rather than being hidden." In the event every
 * department has at least one measure, so these render as CONTEXT above the
 * cards rather than as an empty state. That is more useful than the empty state
 * would have been: a department with exactly one bill in it raises the question
 * "is that all?", and this answers it.
 *
 * The fallback below still covers a genuinely empty department, because a later
 * content edit could produce one and silently vanishing is the failure this is
 * here to prevent.
 */
const DEPARTMENT_NOTE: Partial<Record<Department, string>> = {
  education:
    'Federal involvement in education begins and ends with Washington’s ' +
    'proposal for a national university, which Congress never acted on. Public ' +
    'schooling was a state and town matter throughout this period.',
  agriculture:
    'No federal agricultural body existed until the Agricultural Division of ' +
    'the Patent Office in 1839, and no department until 1862. Washington’s ' +
    'proposed board is the only measure of the period.',
  health_welfare:
    'Federal health provision begins with the Marine Hospital Service in 1798, ' +
    'funded by a deduction from seamen’s wages. There was nothing before it.',
  elections:
    'Elections were run by the states. Federal legislation reaches them only ' +
    'through the manner of choosing electors and the line of succession.',
  labor:
    'There is no federal labour law in this period. The only measure touching ' +
    'manufactures is Hamilton’s proposal to subsidise them, which Congress ' +
    'declined.',
  slavery_civil_rights:
    'Congress resolved in 1790 that it had no authority to interfere with ' +
    'slavery in the states, and the Constitution barred it from prohibiting ' +
    'importation before 1808. What remains is the foreign trade, and what was ' +
    'never attempted.',
};

const HISTORICITY_LABEL: Record<BillHistoricity, string> = {
  enacted: 'Enacted in reality',
  proposed: 'Proposed at the time',
  counterfactual: 'Counterfactual',
  anachronistic: 'Not possible in this period',
};

const HISTORICITY_CLASS: Record<BillHistoricity, string> = {
  // Steel is reserved for historical data (UI.md §9), and "this really happened"
  // is exactly that claim.
  enacted: 'text-steel-400',
  proposed: 'text-content-secondary',
  counterfactual: 'text-brass-300',
  anachronistic: 'text-oxblood-300',
};

export function LegislationPanel({ state }: { state: GameState }) {
  const [openDepartment, setOpenDepartment] = useState<Department | 'all'>('all');

  const byDepartment = useMemo(() => {
    const map = new Map<Department, Bill[]>();
    for (const department of DEPARTMENTS) map.set(department, []);
    for (const bill of PHASE_1_CONTENT.bills) {
      map.get(bill.category)?.push(bill);
    }
    return map;
  }, []);

  const shown = openDepartment === 'all' ? DEPARTMENTS : [openDepartment];

  return (
    <div className="space-y-3">
      <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-label uppercase tracking-wider text-content-muted">
            Department
          </span>
          <DepartmentChip
            label="All"
            count={PHASE_1_CONTENT.bills.length}
            active={openDepartment === 'all'}
            onClick={() => setOpenDepartment('all')}
          />
          {DEPARTMENTS.map((department) => (
            <DepartmentChip
              key={department}
              label={DEPARTMENT_LABEL[department]}
              count={byDepartment.get(department)?.length ?? 0}
              active={openDepartment === department}
              onClick={() => setOpenDepartment(department)}
            />
          ))}
        </div>
      </section>

      {shown.map((department) => {
        const bills = byDepartment.get(department) ?? [];
        return (
          <section key={department} className="space-y-2">
            <h2 className="font-serif text-h2 text-content-primary">
              {DEPARTMENT_LABEL[department]}
            </h2>

            {DEPARTMENT_NOTE[department] && (
              <p
                data-department-note={department}
                className="max-w-prose text-small text-content-muted"
              >
                {DEPARTMENT_NOTE[department]}
              </p>
            )}

            {bills.length === 0 ? (
              <p className="max-w-prose rounded-card border border-ink-400/60 bg-ink-800 p-3 text-small text-content-muted">
                Nothing in this department is within reach in this period.
              </p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {bills.map((bill) => (
                  <BillCard key={bill.id} bill={bill} state={state} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function DepartmentChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded border px-2 py-0.5 text-small transition-colors ${
        active
          ? 'border-brass-400 bg-brass-400 text-ink-900'
          : 'border-ink-400 text-content-secondary hover:bg-ink-500'
      }`}
    >
      {label} <span className="tabular opacity-70">{count}</span>
    </button>
  );
}

// ============================================================================
// ONE BILL
// ============================================================================

function BillCard({ bill, state }: { bill: Bill; state: GameState }) {
  const status = billStatus(state, bill);
  const record = enactedRecord(state, bill.id);
  const inForce = status.kind === 'inForce';

  const [draft, setDraft] = useState<number>(
    () => record?.sliderValue ?? bill.sliderRange?.[0] ?? 0,
  );

  /** What the player has bought for this vote. Reset when the bill is enacted. */
  const [tactics, setTactics] = useState<BillTactics>(NO_TACTICS);
  const isRepublic = state.governmentType === 'republic';

  const price = priceOf(bill, bill.hasSlider ? draft : null, state.governmentType);
  const capital = inForce
    ? amendCost(bill, record?.sliderValue ?? null, draft)
    : price.capital;
  const money = inForce ? 0 : price.treasury;

  const affordable = capital <= state.politicalCapital.current;
  const actionable = status.kind === 'available' || status.kind === 'repealed';
  const amendable = inForce && bill.hasSlider && draft !== record?.sliderValue;

  return (
    <section
      data-bill-id={bill.id}
      data-bill-status={status.kind}
      className={`rounded-card border p-3 ${
        inForce
          ? 'border-brass-400/50 bg-ink-600'
          : actionable
            ? 'border-ink-400 bg-ink-700'
            : 'border-ink-400/60 bg-ink-800'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-serif text-h2 text-content-primary">{bill.name}</h3>
        <StatusBadge status={status} />
      </div>

      {/* The historicity tier is stated on every card, on every tier. A player
          must always know whether they are doing history or departing from it. */}
      <p className={`text-label uppercase tracking-wider ${HISTORICITY_CLASS[bill.historicity]}`}>
        {HISTORICITY_LABEL[bill.historicity]}
      </p>

      <p className="mt-2 text-body text-content-secondary">{bill.description}</p>

      {/* --- Why it cannot be passed ---------------------------------------- */}
      {status.kind === 'locked' && (
        <div className="mt-2 rounded border-l-2 border-oxblood-400 bg-ink-900/40 p-2">
          <p className="text-label uppercase tracking-wider text-oxblood-300">
            Why this is not possible
          </p>
          <p className="mt-1 max-w-prose text-small text-content-secondary">
            {status.because}
          </p>
        </div>
      )}

      {status.kind === 'blocked' && (
        <ul className="mt-2 space-y-0.5">
          {status.reasons.map((reason) => (
            <li key={reason} className="text-small text-oxblood-300">
              Requires: {reason}
            </li>
          ))}
        </ul>
      )}

      {status.kind === 'notYet' && (
        <p className="mt-2 text-small text-content-muted">
          Not before {formatLongDate(isoToDay(status.from))}.
        </p>
      )}

      {status.kind === 'expired' && (
        <p className="mt-2 text-small text-content-muted">
          No longer available after {formatLongDate(isoToDay(status.until))}.
        </p>
      )}

      {/* --- The slider ----------------------------------------------------- */}
      {bill.hasSlider && bill.sliderRange && status.kind !== 'locked' && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <label
              className="text-small text-content-secondary"
              htmlFor={`bill-${bill.id}`}
            >
              {bill.sliderLabel}
            </label>
            <span className="tabular text-data-sm text-content-primary">
              {bill.sliderUnit === 'rate'
                ? formatRate(draft)
                : formatCurrency(draft)}
            </span>
          </div>
          <input
            id={`bill-${bill.id}`}
            type="range"
            min={bill.sliderRange[0]}
            max={bill.sliderRange[1]}
            step={
              bill.sliderUnit === 'rate'
                ? (bill.sliderRange[1] - bill.sliderRange[0]) / 100
                : Math.max(1, Math.round((bill.sliderRange[1] - bill.sliderRange[0]) / 100))
            }
            value={draft}
            onChange={(e) => setDraft(Number(e.target.value))}
            className="mt-1 w-full accent-brass-400"
          />
        </div>
      )}

      {/* --- Can it pass? --------------------------------------------------- */}
      {isRepublic && actionable && (
        <WhipCountPanel
          bill={bill}
          state={state}
          draft={bill.hasSlider ? draft : null}
          tactics={tactics}
          onTactics={setTactics}
        />
      )}

      {/* --- Who gains and who loses ---------------------------------------- */}
      {bill.blocReactions.length > 0 && (
        <div className="mt-3 border-t border-ink-400 pt-2">
          <p className="text-label uppercase tracking-wider text-content-muted">
            Who gains, who loses
          </p>
          <ul className="mt-1 space-y-0.5">
            {[...bill.blocReactions]
              .sort((a, b) => b.strength - a.strength)
              .map((reaction) => (
                <li key={reaction.bloc} className="flex gap-2 text-small">
                  <span
                    className={`w-8 shrink-0 tabular text-right ${
                      reaction.strength >= 0 ? 'text-verdigris-400' : 'text-oxblood-300'
                    }`}
                  >
                    {reaction.strength >= 0 ? '+' : ''}
                    {reaction.strength}
                  </span>
                  <span className="text-content-secondary">
                    <span className="capitalize text-content-primary">
                      {reaction.bloc.replace(/_/g, ' ')}
                    </span>
                    {' — '}
                    {reaction.reason}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* --- The price ------------------------------------------------------ */}
      {status.kind !== 'locked' && (
        <div className="mt-3 border-t border-ink-400 pt-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-small">
            <span className={affordable ? 'text-content-secondary' : 'text-oxblood-300'}>
              Political capital{' '}
              <span className="tabular">{capital.toFixed(1)}</span> of{' '}
              <span className="tabular">
                {state.politicalCapital.current.toFixed(1)}
              </span>
            </span>
            {money > 0 && (
              <span className="text-content-secondary">
                Treasury <span className="tabular">{formatCurrency(money)}</span>
              </span>
            )}
            {/*
              THE CROWN'S SIDE OF THE BARGAIN, stated before the player commits.
              A decree is cheap in capital and dear in legitimacy and grievance,
              and showing only the capital would misrepresent the choice
              entirely. (brief §2.1)
            */}
            {price.byDecree && !inForce && (
              <>
                <span className="text-oxblood-300">
                  Legitimacy{' '}
                  <span className="tabular">−{price.legitimacy.toFixed(1)}</span>
                </span>
                <span className="text-oxblood-300">
                  Grievance{' '}
                  <span className="tabular">+{price.grievance.toFixed(0)}</span>
                </span>
              </>
            )}
            {bill.phaseInDays > 0 && (
              <span className="text-content-muted">
                Phases in over{' '}
                <span className="tabular">{bill.phaseInDays}</span> days
              </span>
            )}
          </div>

          {price.byDecree && !inForce && (
            <p className="mt-1 text-small text-content-muted">
              By decree. No vote is required, and none is sought — which is why
              it costs a fraction of the capital and rather more of everything
              else.
            </p>
          )}

          {inForce && record && (
            <p className="mt-1 text-small text-content-muted">
              In force since {formatLongDate(record.enactedDay)}.
            </p>
          )}
        </div>
      )}

      {/* --- Actions -------------------------------------------------------- */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {actionable && (
          <button
            type="button"
            disabled={!affordable}
            onClick={() => enactLegislation(bill.id, bill.hasSlider ? draft : null)}
            className={`rounded-card border px-3 py-1.5 text-body transition-colors ${
              affordable
                ? 'border-brass-400 bg-brass-400 text-ink-900 hover:bg-brass-300'
                : 'cursor-not-allowed border-ink-400 text-content-disabled'
            }`}
          >
            {status.kind === 'repealed' ? 'Re-enact' : 'Introduce'}
          </button>
        )}

        {amendable && (
          <button
            type="button"
            disabled={!affordable}
            onClick={() => amendLegislation(bill.id, draft)}
            className={`rounded-card border px-3 py-1.5 text-body ${
              affordable
                ? 'border-brass-400 text-brass-300 hover:bg-ink-500'
                : 'cursor-not-allowed border-ink-400 text-content-disabled'
            }`}
          >
            Amend
          </button>
        )}

        {inForce && bill.repealable && (
          <button
            type="button"
            disabled={bill.capitalCost.repeal > state.politicalCapital.current}
            onClick={() => repealLegislation(bill.id)}
            className={`rounded-card border px-3 py-1.5 text-body ${
              bill.capitalCost.repeal <= state.politicalCapital.current
                ? 'border-oxblood-400 text-oxblood-300 hover:bg-ink-500'
                : 'cursor-not-allowed border-ink-400 text-content-disabled'
            }`}
          >
            Repeal ({bill.capitalCost.repeal.toFixed(0)})
          </button>
        )}

        {inForce && !bill.repealable && (
          <span className="text-small text-content-muted">
            Not repealable — the government it created cannot simply be dissolved.
          </span>
        )}

        {!affordable && actionable && (
          <span className="text-small text-oxblood-300">
            Not enough political capital.
          </span>
        )}
      </div>

      {/* --- The history ---------------------------------------------------- */}
      <details className="mt-2">
        <summary className="cursor-pointer text-small text-brass-300">
          Historical context
        </summary>
        <p className="mt-1.5 max-w-prose font-serif text-body-serif text-content-secondary">
          {bill.historicalNote}
        </p>
        <ul className="mt-1.5">
          {bill.sources.map((source) => (
            <li key={source} className="text-small text-content-muted">
              {source}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

/**
 * THE WHIP COUNT.
 *
 * Brief §2.2: "Before committing to introduce a bill, the player sees a
 * projected whip count broken down by party and by region, with each bloc's
 * reasoning visible. Same modifier-ledger honesty as everything else."
 *
 * So this shows the count, then the breakdown by party, then the breakdown by
 * region, and every delegation's reasons are inspectable — and those reasons SUM
 * to the inclination that produced its vote, exactly as a stat popover's
 * contributions sum to the stat. A whip count the player could not interrogate
 * would be the ledger rule broken in a new place.
 */
function WhipCountPanel({
  bill,
  state,
  draft,
  tactics,
  onTactics,
}: {
  bill: Bill;
  state: GameState;
  draft: number | null;
  tactics: BillTactics;
  onTactics: (t: BillTactics) => void;
}) {
  const [open, setOpen] = useState(false);

  const result = useMemo(
    () => bothChambers(state, bill, PHASE_1_CONTENT.parties, tactics),
    [state, bill, tactics],
  );

  const parties = partiesOn(PHASE_1_CONTENT.parties, state.day);
  const extraCost = tacticsCost(tactics);
  void draft;

  return (
    <div
      data-whip-count={bill.id}
      className="mt-3 rounded border border-ink-400 bg-ink-800/50 p-2"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-label uppercase tracking-wider text-content-muted">
          Projected division
        </span>
        <span
          className={`text-small ${result.passes ? 'text-verdigris-400' : 'text-oxblood-300'}`}
        >
          {result.passes ? 'Would pass' : 'Would fail'}
        </span>
      </div>

      <div className="mt-1 space-y-1">
        <ChamberBar label="House" count={result.house} />
        <ChamberBar label="Senate" count={result.senate} />
      </div>

      {/* --- What the player can do about it -------------------------------- */}
      <div className="mt-2 border-t border-ink-400 pt-2">
        <p className="text-label uppercase tracking-wider text-content-muted">
          Bring them round
        </p>

        <div className="mt-1 flex flex-wrap gap-1.5">
          {parties.map((party) => {
            const whipped = tactics.whip[party.id] ?? 0;
            return (
              <button
                key={party.id}
                type="button"
                onClick={() =>
                  onTactics({
                    ...tactics,
                    whip: { ...tactics.whip, [party.id]: whipped + 10 },
                  })
                }
                className="rounded border border-ink-400 px-2 py-0.5 text-small text-content-secondary hover:bg-ink-500"
              >
                Whip {party.shortName}
                {whipped > 0 && (
                  <span className="tabular ml-1 text-brass-300">+{whipped}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {parties.map((party) => (
            <button
              key={`rider-${party.id}`}
              type="button"
              aria-pressed={tactics.rider === party.id}
              onClick={() =>
                onTactics({
                  ...tactics,
                  rider: tactics.rider === party.id ? null : party.id,
                })
              }
              className={`rounded border px-2 py-0.5 text-small ${
                tactics.rider === party.id
                  ? 'border-brass-400 bg-brass-400 text-ink-900'
                  : 'border-ink-400 text-content-secondary hover:bg-ink-500'
              }`}
            >
              Rider for {party.shortName}
            </button>
          ))}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {parties.map((party) => (
            <button
              key={`roll-${party.id}`}
              type="button"
              aria-pressed={tactics.logRoll === party.id}
              onClick={() =>
                onTactics({
                  ...tactics,
                  logRoll: tactics.logRoll === party.id ? null : party.id,
                })
              }
              className={`rounded border px-2 py-0.5 text-small ${
                tactics.logRoll === party.id
                  ? 'border-brass-400 bg-brass-400 text-ink-900'
                  : 'border-ink-400 text-content-secondary hover:bg-ink-500'
              }`}
            >
              Promise {party.shortName}
            </button>
          ))}
        </div>

        {extraCost > 0 && (
          <p className="mt-1 text-small text-content-secondary">
            These tactics add{' '}
            <span className="tabular">{extraCost.toFixed(1)}</span> political
            capital, spent whether the bill carries or not.
            {tactics.logRoll !== null &&
              ' A promise comes due later, at twice what it cost.'}
          </p>
        )}

        {extraCost > 0 && (
          <button
            type="button"
            onClick={() => onTactics(NO_TACTICS)}
            className="mt-1 text-small text-content-muted underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* --- The working ---------------------------------------------------- */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2 text-small text-brass-300"
      >
        {open ? 'Hide the count' : 'Show every delegation and why'}
      </button>

      {open && <WhipBreakdown count={result.house} />}
    </div>
  );
}

function ChamberBar({ label, count }: { label: string; count: WhipCount }) {
  const total = count.for + count.against + count.undecided;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <div>
      <div className="flex items-baseline justify-between text-small">
        <span className="text-content-secondary">{label}</span>
        <span className="text-content-muted">
          <span className="tabular text-verdigris-400">{count.for.toFixed(0)}</span>{' '}
          for ·{' '}
          <span className="tabular text-oxblood-300">{count.against.toFixed(0)}</span>{' '}
          against ·{' '}
          <span className="tabular">{count.undecided.toFixed(0)}</span> undecided
        </span>
      </div>
      {/* Paired with the numerals above, never colour alone. (UI.md §10) */}
      <div className="mt-0.5 flex h-1 w-full overflow-hidden rounded bg-ink-500" aria-hidden>
        <div className="h-1 bg-verdigris-400" style={{ width: `${pct(count.for)}%` }} />
        <div className="h-1 bg-ink-400" style={{ width: `${pct(count.undecided)}%` }} />
        <div className="h-1 bg-oxblood-400" style={{ width: `${pct(count.against)}%` }} />
      </div>
    </div>
  );
}

/**
 * Every delegation, grouped by region, with the reasons that produced its vote.
 *
 * By region rather than alphabetically, because the sectional pattern is the
 * thing worth seeing: a bill that carries New England and loses the South looks
 * quite different from one that splits every region evenly, and only one of them
 * is a warning.
 */
function WhipBreakdown({ count }: { count: WhipCount }) {
  const byRegion = new Map<string, typeof count.votes>();
  for (const vote of count.votes) {
    const list = byRegion.get(vote.regionId) ?? [];
    list.push(vote);
    byRegion.set(vote.regionId, list);
  }

  return (
    <div className="mt-2 space-y-2">
      {[...byRegion.entries()].map(([regionId, votes]) => (
        <div key={regionId}>
          <p className="text-label uppercase tracking-wider text-content-muted">
            {regionId.replace(/_/g, ' ')}
          </p>
          <ul className="mt-0.5 space-y-1">
            {votes
              .sort((a, b) => b.seats - a.seats)
              .map((vote) => (
                <li key={`${vote.stateCode}-${vote.party}`} className="text-small">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={
                        vote.verdict === 'for'
                          ? 'text-verdigris-400'
                          : vote.verdict === 'against'
                            ? 'text-oxblood-300'
                            : 'text-content-muted'
                      }
                    >
                      {vote.verdict === 'for'
                        ? 'For'
                        : vote.verdict === 'against'
                          ? 'Against'
                          : 'Undecided'}
                    </span>
                    <span className="text-content-primary">{vote.stateCode}</span>
                    <span className="tabular text-content-muted">
                      {vote.seats.toFixed(1)} seats
                    </span>
                  </div>
                  <ul className="ml-4">
                    {vote.reasons.map((reason, i) => (
                      <li key={i} className="text-small text-content-muted">
                        <span
                          className={`tabular ${
                            reason.effect >= 0 ? 'text-verdigris-400' : 'text-oxblood-300'
                          }`}
                        >
                          {reason.effect >= 0 ? '+' : ''}
                          {reason.effect.toFixed(1)}
                        </span>{' '}
                        {reason.text}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: BillStatus }) {
  switch (status.kind) {
    case 'inForce':
      return (
        <span className="text-label uppercase tracking-wider text-brass-300">
          In force
        </span>
      );
    case 'repealed':
      return (
        <span className="text-label uppercase tracking-wider text-content-muted">
          Repealed
        </span>
      );
    case 'locked':
      return (
        <span className="text-label uppercase tracking-wider text-oxblood-300">
          Locked
        </span>
      );
    case 'blocked':
    case 'notYet':
    case 'expired':
      return (
        <span className="text-label uppercase tracking-wider text-content-muted">
          Unavailable
        </span>
      );
    case 'available':
      return null;
  }
}
