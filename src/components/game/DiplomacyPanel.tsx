'use client';

/**
 * DIPLOMACY
 *
 * Phase 2 brief §7. A panel per foreign power: government, ruler, population,
 * strength, relationship, treaties.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE THING THIS SCREEN MUST NOT DO
 *
 *   "Real 1790s figures where sourced, honest gaps where not — the same
 *    data-integrity rule applies to foreign nations as to our own."
 *
 * Most of the populations in this file's data are null, and several of the
 * nulls are for Native nations whom nobody counted. So the panel renders a gap
 * as a GAP, with the reason, in the same treatment the History view uses for a
 * missing benchmark year. It never shows a dash that could be read as zero, and
 * it never quietly omits the row.
 *
 * Naval and land strength are CALIBRATION values, not history, and are labelled
 * as a model — the same distinction the Congress screen draws between seat
 * counts and party splits.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo, useState } from 'react';
import { POWERS, type ForeignPower, type PowerCategory } from '@/content/diplomacy/powers';
import { formatLongDate } from '@/sim/calendar';
import {
  describeTreatyStatus,
  relationWord,
  rulerOn,
  treatiesFor,
  treatiesInForce,
  annualTribute,
} from '@/sim/diplomacy';
import {
  ENVOY_CAPITAL_COST,
  FABRICATION_CAPITAL_COST,
  PEACE_CAPITAL_COST,
  UNJUSTIFIED_WAR_THRESHOLD,
} from '@/sim/calibration';
import {
  availableGrounds,
  declarationCost,
  peaceOnOffer,
  warWith,
} from '@/sim/war';
import { formatCurrency } from '@/lib/format';
import type { GameState } from '@/sim/types';

const CATEGORY_LABEL: Record<PowerCategory, string> = {
  european: 'The European powers',
  barbary: 'The Barbary states',
  native_nation: 'Sovereign Native nations',
};

const CATEGORY_ORDER: readonly PowerCategory[] = [
  'european',
  'barbary',
  'native_nation',
];

const CATEGORY_NOTE: Record<PowerCategory, string> = {
  european:
    'The powers whose wars, markets and navies set the limits of what the ' +
    'United States could do in this period.',
  barbary:
    'Algiers, Tunis and Tripoli took American merchant ships and ransomed their ' +
    'crews. Morocco did not, and its treaty of 1786 held throughout.',
  native_nation:
    'Sovereign polities with their own diplomacy, their own war aims and their ' +
    'own treaties with the United States — not obstacles on a map. Several of ' +
    'the figures below are unavailable because nobody counted, and a plausible ' +
    'number would be an invented one.',
};

export function DiplomacyPanel({
  state,
  onEnvoy,
  onSign,
  onDeclare,
  onFabricate,
  onPeace,
}: {
  state: GameState;
  onEnvoy?: (powerId: string) => void;
  onSign?: (treatyId: string) => void;
  onDeclare?: (powerId: string, groundsId: string) => void;
  onFabricate?: (powerId: string) => void;
  onPeace?: (powerId: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const byCategory = useMemo(() => {
    const groups: Record<string, ForeignPower[]> = {};
    for (const power of POWERS) {
      (groups[power.category] ??= []).push(power);
    }
    return groups;
  }, []);

  const tribute = annualTribute(state);

  return (
    <div className="space-y-3" data-testid="diplomacy">
      {tribute > 0 && (
        <section
          className="rounded-card border border-ink-400 bg-ink-700 p-3"
          data-testid="tribute-total"
        >
          <p className="text-small text-content-secondary">
            Tribute and annuities now cost{' '}
            <span className="tabular text-content-primary">
              {formatCurrency(tribute)}
            </span>{' '}
            a year, and it is paid out of the civil list like any other charge on
            the Treasury.
          </p>
        </section>
      )}

      {CATEGORY_ORDER.map((category) => (
        <section key={category} data-power-group={category}>
          <h3 className="text-label uppercase tracking-wider text-content-muted">
            {CATEGORY_LABEL[category]}
          </h3>
          <p className="mt-0.5 max-w-prose text-small text-content-muted">
            {CATEGORY_NOTE[category]}
          </p>

          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {(byCategory[category] ?? []).map((power) => (
              <PowerCard
                key={power.id}
                power={power}
                state={state}
                open={open === power.id}
                onToggle={() => setOpen(open === power.id ? null : power.id)}
                onEnvoy={onEnvoy}
                onSign={onSign}
                onDeclare={onDeclare}
                onFabricate={onFabricate}
                onPeace={onPeace}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PowerCard({
  power,
  state,
  open,
  onToggle,
  onEnvoy,
  onSign,
  onDeclare,
  onFabricate,
  onPeace,
}: {
  power: ForeignPower;
  state: GameState;
  open: boolean;
  onToggle: () => void;
  onEnvoy?: (powerId: string) => void;
  onSign?: (treatyId: string) => void;
  onDeclare?: (powerId: string, groundsId: string) => void;
  onFabricate?: (powerId: string) => void;
  onPeace?: (powerId: string) => void;
}) {
  const relation = state.diplomacy.relations[power.id];
  const value = relation?.relation ?? 0;
  const ruler = rulerOn(power, state.day);
  const inForce = treatiesInForce(state, power.id);
  const treaties = treatiesFor(state, power.id);

  const affordable = state.politicalCapital.current >= ENVOY_CAPITAL_COST;

  return (
    <article
      data-power={power.id}
      className="rounded-card border border-ink-400 bg-ink-700 p-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-h2 text-content-primary">{power.name}</h4>
        {/* The word carries the meaning; the number is beside it, never instead. */}
        <span className="text-small text-content-secondary">
          {relationWord(value)}{' '}
          <span className="tabular text-content-muted">({value.toFixed(0)})</span>
        </span>
      </div>

      {ruler ? (
        <p className="mt-0.5 text-small text-content-secondary">
          {ruler.title} {ruler.name}
          {ruler.note && <span className="text-content-muted"> — {ruler.note}</span>}
        </p>
      ) : (
        <p className="mt-0.5 text-small text-content-muted">
          No government of record on this date.
        </p>
      )}

      {/* --- Figures, with the gaps drawn as gaps ------------------------ */}
      <div className="mt-2 border-t border-ink-400 pt-2" data-testid={`figures-${power.id}`}>
        {power.population ? (
          <div className="flex items-baseline justify-between py-0.5">
            <span className="text-small text-content-secondary">Population</span>
            {/* Steel is reserved for real historical figures. (UI.md §9) */}
            <span className="tabular text-data-sm text-steel-400">
              {power.population.value.toLocaleString('en-US')}{' '}
              <span className="text-small">({power.population.asOf})</span>
            </span>
          </div>
        ) : (
          <div className="py-0.5" data-testid={`gap-${power.id}`}>
            <div className="flex items-baseline justify-between">
              <span className="text-small text-content-secondary">Population</span>
              <span className="text-small text-content-muted">no verified figure</span>
            </div>
            <p className="mt-0.5 text-small text-content-muted">
              {power.populationGap}
            </p>
          </div>
        )}

        <div className="flex items-baseline justify-between py-0.5">
          <span className="text-small text-content-secondary">
            Strength at sea / on land
          </span>
          <span className="tabular text-data-sm text-content-primary">
            {power.navalStrength} / {power.landStrength}
          </span>
        </div>
        <p className="text-small text-content-muted">
          Strength is a model, not a record — nobody published a comparable index
          in 1790.
        </p>
      </div>

      {inForce.length > 0 && (
        <p className="mt-2 text-small text-verdigris-300" data-testid={`inforce-${power.id}`}>
          {inForce.length} {inForce.length === 1 ? 'treaty' : 'treaties'} in force.
        </p>
      )}

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="mt-2 text-small text-brass-300 hover:text-brass-focus"
      >
        {open ? 'Close' : 'Interests, context and treaties'}
      </button>

      {open && (
        <div className="mt-2 border-t border-ink-400 pt-2" data-testid={`detail-${power.id}`}>
          <p className="text-label uppercase tracking-wider text-content-muted">
            What they want
          </p>
          <ul className="mt-1 space-y-0.5">
            {power.interests.map((interest) => (
              <li key={interest} className="text-small text-content-secondary">
                · {interest}
              </li>
            ))}
          </ul>

          <p className="mt-2 max-w-prose text-small text-content-secondary">
            {power.context}
          </p>

          <p className="mt-1 text-small text-steel-400">{power.sources.join('; ')}</p>

          {/* --- Actions ------------------------------------------------- */}
          <div className="mt-2 border-t border-ink-400 pt-2">
            <button
              type="button"
              disabled={!affordable || relation?.atWar}
              onClick={() => onEnvoy?.(power.id)}
              data-envoy={power.id}
              className="rounded border border-ink-400 px-2 py-1 text-small text-content-secondary hover:bg-ink-500 disabled:cursor-not-allowed disabled:text-content-disabled"
            >
              Send a minister — {ENVOY_CAPITAL_COST} political capital
            </button>
            {relation?.lastEnvoyDay !== null && relation?.lastEnvoyDay !== undefined && (
              <p className="mt-0.5 text-small text-content-muted">
                Last mission {formatLongDate(relation.lastEnvoyDay)}.
              </p>
            )}
          </div>

          {/* --- War ----------------------------------------------------- */}
          <WarBlock
            power={power}
            state={state}
            onDeclare={onDeclare}
            onFabricate={onFabricate}
            onPeace={onPeace}
          />

          {/* --- Treaties ------------------------------------------------ */}
          <div className="mt-2 border-t border-ink-400 pt-2">
            <p className="text-label uppercase tracking-wider text-content-muted">
              Treaties
            </p>
            <ul className="mt-1 space-y-2">
              {treaties.map(({ treaty, status }) => (
                <li key={treaty.id} data-treaty={treaty.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-small text-content-primary">
                      {treaty.name}
                    </span>
                    <span className="text-small text-content-muted">
                      {treaty.historicity === 'enacted'
                        ? `Concluded ${treaty.historicalDate}`
                        : treaty.historicity === 'proposed'
                          ? 'Sought, never concluded'
                          : 'Never advanced'}
                    </span>
                  </div>
                  <p className="text-small text-content-secondary">
                    {treaty.description}
                  </p>
                  {/* The reason is always stated, never a bare disabled control. */}
                  <p className="text-small text-content-muted">
                    {describeTreatyStatus(status)}
                  </p>
                  {status.kind === 'available' && (
                    <button
                      type="button"
                      data-sign={treaty.id}
                      onClick={() => onSign?.(treaty.id)}
                      className="mt-0.5 rounded border border-ink-400 px-2 py-1 text-small text-content-secondary hover:bg-ink-500"
                    >
                      Conclude — {treaty.capitalCost} capital
                      {treaty.treasuryCost > 0 &&
                        `, ${formatCurrency(treaty.treasuryCost)}`}
                      {treaty.annualTribute > 0 &&
                        `, and ${formatCurrency(treaty.annualTribute)} a year thereafter`}
                    </button>
                  )}
                  <p className="mt-0.5 max-w-prose text-small text-content-muted">
                    {treaty.historicalNote}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}

/**
 * WAR — the declaration, and the price on it
 *
 * Phase 2 brief §7, queue item 12. What this block has to make visible BEFORE
 * the player commits:
 *
 *   1. Every ground available, with how good a case it makes.
 *   2. What each would cost — capital always, legitimacy in proportion to how
 *      thin the case is, and the standing of the country with every other power.
 *   3. Which path the player is on. A crown declares; a republic asks. The
 *      button says which, because they are different acts.
 *
 * A manufactured claim is offered last and is labelled for what it is. A player
 * who takes it should be able to see the whole bill first.
 */
function WarBlock({
  power,
  state,
  onDeclare,
  onFabricate,
  onPeace,
}: {
  power: ForeignPower;
  state: GameState;
  onDeclare?: (powerId: string, groundsId: string) => void;
  onFabricate?: (powerId: string) => void;
  onPeace?: (powerId: string) => void;
}) {
  const war = warWith(state, power.id);

  if (war) {
    const terms = peaceOnOffer(state, power.id);
    return (
      <div
        className="mt-2 border-t border-oxblood-400 pt-2"
        data-testid={`war-${power.id}`}
      >
        <p className="text-label uppercase tracking-wider text-oxblood-300">
          At war since {formatLongDate(war.declaredDay)}
        </p>
        <div className="flex items-baseline justify-between py-0.5">
          <span className="text-small text-content-secondary">Weariness</span>
          <span className="tabular text-data-sm text-content-primary">
            {war.weariness.toFixed(0)}
          </span>
        </div>
        {war.fabricated && (
          <p className="text-small text-oxblood-300">
            Begun on a manufactured grievance, and the country knows it.
          </p>
        )}
        <p className="mt-0.5 text-small text-content-muted">
          Peace today would come{' '}
          {terms === 'victory'
            ? 'on our terms'
            : terms === 'settlement'
              ? 'on terms nobody would call a victory'
              : 'on theirs'}
          .
        </p>
        <button
          type="button"
          data-peace={power.id}
          disabled={state.politicalCapital.current < PEACE_CAPITAL_COST}
          onClick={() => onPeace?.(power.id)}
          className="mt-1 rounded border border-ink-400 px-2 py-1 text-small text-content-secondary hover:bg-ink-500 disabled:cursor-not-allowed disabled:text-content-disabled"
        >
          Seek peace — {PEACE_CAPITAL_COST} political capital
        </button>
      </div>
    );
  }

  const grounds = availableGrounds(state, power.id);
  const republic = state.governmentType === 'republic';

  return (
    <div className="mt-2 border-t border-ink-400 pt-2" data-testid={`grounds-${power.id}`}>
      <p className="text-label uppercase tracking-wider text-content-muted">
        Grounds for war
      </p>
      {/*
        The path is stated, not implied. A crown declares and a republic asks,
        and those are different acts with different failure modes.
      */}
      <p className="text-small text-content-muted">
        {republic
          ? 'A declaration must carry both chambers. It can be voted down.'
          : 'The crown declares. Nothing can refuse it — only the country can remember it.'}
      </p>

      <ul className="mt-1 space-y-2">
        {grounds.map((ground) => {
          const cost = declarationCost(ground);
          return (
            <li key={ground.id} data-grounds={ground.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-small text-content-primary">{ground.name}</span>
                <span className="tabular text-small text-content-muted">
                  case {ground.strength}/100
                </span>
              </div>
              <p className="text-small text-content-secondary">{ground.claim}</p>

              <p className="text-small text-content-muted">
                {ground.fabricated
                  ? 'Manufactured. It will not bear examination.'
                  : cost.unjustified
                    ? `Thin — a defensible case needs ${UNJUSTIFIED_WAR_THRESHOLD}.`
                    : 'A defensible case.'}{' '}
                Costs {cost.capital} capital
                {cost.legitimacy > 0.5 &&
                  ` and about ${cost.legitimacy.toFixed(0)} legitimacy`}
                {cost.relationPenaltyToOthers > 0 &&
                  `, and every other power thinks less of us for it`}
                .
              </p>

              {ground.fabricated ? (
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <button
                    type="button"
                    data-fabricate={power.id}
                    disabled={state.politicalCapital.current < FABRICATION_CAPITAL_COST}
                    onClick={() => onFabricate?.(power.id)}
                    className="rounded border border-ink-400 px-2 py-1 text-small text-content-secondary hover:bg-ink-500 disabled:cursor-not-allowed disabled:text-content-disabled"
                  >
                    Prepare the grievance — {FABRICATION_CAPITAL_COST} capital
                  </button>
                  <button
                    type="button"
                    data-declare={ground.id}
                    disabled={state.politicalCapital.current < cost.capital}
                    onClick={() => onDeclare?.(power.id, ground.id)}
                    className="rounded border border-oxblood-400 px-2 py-1 text-small text-oxblood-300 hover:bg-ink-500 disabled:cursor-not-allowed disabled:text-content-disabled"
                  >
                    {republic ? 'Put it to Congress' : 'Declare war'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  data-declare={ground.id}
                  disabled={state.politicalCapital.current < cost.capital}
                  onClick={() => onDeclare?.(power.id, ground.id)}
                  className="mt-0.5 rounded border border-oxblood-400 px-2 py-1 text-small text-oxblood-300 hover:bg-ink-500 disabled:cursor-not-allowed disabled:text-content-disabled"
                >
                  {republic ? 'Put it to Congress' : 'Declare war'}
                </button>
              )}

              <p className="mt-0.5 max-w-prose text-small text-content-muted">
                {ground.historicalNote}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
