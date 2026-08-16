'use client';

/**
 * MAIN PANEL SECTIONS
 *
 * Each section renders into the main panel. Internal panels scroll; the shell
 * stays fixed. (UI.md §4.4)
 *
 * Treasury, History and Government grew large enough to warrant their own
 * files; the rest live here.
 */

import { PHASE_1_CONTENT } from '@/content';
import { formatLongDate } from '@/sim/calendar';
import { RANGES, TAU_MONTHS } from '@/sim/calibration';
import { describeUnmet, evaluateAll } from '@/sim/conditions';
import { explainStat, type StatBreakdown } from '@/sim/modifiers';
import { currentCrises, stateOfTheUnion } from '@/sim/narrative';
import type { GameState, Region } from '@/sim/types';
import {
  complianceWord,
  direction,
  exposureWord,
  formatCurrency,
  formatIndex,
  formatNumber,
  formatPopulation,
  formatRate,
  sentimentWord,
} from '@/lib/format';
import { Stat } from '@/components/primitives/Stat';

// ============================================================================
// SHARED
// ============================================================================

function Panel({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-card border border-ink-400 bg-ink-700 p-3 ${className}`}
    >
      <h3 className="text-label uppercase tracking-wider text-content-muted">
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-small text-content-secondary">{label}</span>
      <span className="tabular text-data-sm text-content-primary">{value}</span>
    </div>
  );
}

// ============================================================================
// DESK
// ============================================================================

export function Desk({ state }: { state: GameState }) {
  const { nation, treasury, series, policies, activeModifiers, day } = state;
  const prev = <T,>(arr: T[]): T => arr[Math.max(0, arr.length - 2)];

  const receipts =
    treasury.annualisedReceipts.customs +
    treasury.annualisedReceipts.excise +
    treasury.annualisedReceipts.land +
    treasury.annualisedReceipts.other;
  const outlays =
    treasury.annualisedOutlays.debtService +
    treasury.annualisedOutlays.military +
    treasury.annualisedOutlays.civil +
    treasury.annualisedOutlays.infrastructure;

  const crises = currentCrises(state);
  const enactedLaws = PHASE_1_CONTENT.laws.filter((l) =>
    policies.enactedLawIds.includes(l.id),
  );

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Panel title="National vitals">
        <Row label="Population" value={formatPopulation(nation.population)} />
        <Row label="Labor force" value={formatPopulation(nation.laborForce)} />
        <Row label="GDP" value={formatCurrency(nation.gdp)} />
        <Row
          label="GDP per head"
          value={`$${(nation.gdp / Math.max(1, nation.population)).toFixed(0)}`}
        />
        <div className="mt-2 flex gap-4 border-t border-ink-400 pt-2">
          <Stat
            label="Stability"
            size="sm"
            value={formatIndex(nation.stability)}
            direction={direction(nation.stability, prev(series.stability))}
            breakdown={explainStat(
              'nation.stability',
              nation.modelTargets.stability,
              activeModifiers,
              day,
              RANGES.percent,
            )}
            lag={{
              target: nation.modelTargets.stability,
              tauMonths: TAU_MONTHS.stability,
            }}
          />
          <Stat
            label="Legitimacy"
            size="sm"
            value={formatIndex(nation.legitimacy)}
            direction={direction(nation.legitimacy, prev(series.legitimacy))}
            breakdown={explainStat(
              'nation.legitimacy',
              nation.legitimacyBase,
              activeModifiers,
              day,
              RANGES.percent,
            )}
          />
          <Stat
            label="Tension"
            size="sm"
            value={formatIndex(nation.sectionalTension)}
            direction={direction(
              nation.sectionalTension,
              prev(series.sectionalTension),
            )}
            favourableWhenRising={false}
            breakdown={explainStat(
              'nation.sectionalTension',
              nation.modelTargets.sectionalTension,
              activeModifiers,
              day,
              RANGES.percent,
            )}
            lag={{
              target: nation.modelTargets.sectionalTension,
              tauMonths: TAU_MONTHS.sentiment,
            }}
          />
        </div>
      </Panel>

      <Panel title="Treasury snapshot">
        <Row label="Balance" value={formatCurrency(treasury.balance)} />
        <Row label="Receipts / yr" value={formatCurrency(receipts)} />
        <Row label="Outlays / yr" value={formatCurrency(outlays)} />
        <div className="mt-1.5 border-t border-ink-400 pt-1.5">
          <Row label="Annual balance" value={formatCurrency(receipts - outlays)} />
          <Row label="National debt" value={formatCurrency(treasury.debtPrincipal)} />
          <Row
            label="Debt service"
            value={formatCurrency(treasury.annualisedOutlays.debtService)}
          />
          <Row label="Credit rating" value={formatIndex(treasury.creditRating)} />
        </div>
      </Panel>

      <Panel title="Current crises">
        {crises.length === 0 ? (
          <p className="text-small text-content-muted">
            No active crises. The republic is quiet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {crises.map((crisis) => (
              <li
                key={crisis}
                className="border-l-2 border-oxblood-400 pl-2 text-small text-oxblood-300"
              >
                {crisis}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Active laws">
        {enactedLaws.length === 0 ? (
          <p className="text-small text-content-muted">
            No laws enacted. The statute book is empty.
          </p>
        ) : (
          <ul className="space-y-1">
            {enactedLaws.map((law) => (
              <li key={law.id} className="text-small text-content-secondary">
                · {law.title}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Taxation">
        <Row label="Tariff (avg.)" value={formatRate(policies.taxRates.tariffAvg)} />
        <Row label="Excise" value={formatRate(policies.taxRates.excise)} />
        <Row label="Land tax" value={formatRate(policies.taxRates.landTax)} />
        <p className="mt-2 text-small text-content-muted">
          Customs revenue peaks at a 25% tariff; beyond that, suppressed trade
          costs more than the rate gains.
        </p>
      </Panel>

      <Panel title="State of the union" className="lg:col-span-3">
        <p className="max-w-prose font-serif text-body-serif text-content-primary">
          {stateOfTheUnion(state)}
        </p>
      </Panel>
    </div>
  );
}

// ============================================================================
// REGIONS
// ============================================================================

export function Regions({ state }: { state: GameState }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {state.regions.map((region) => (
        <RegionCard key={region.id} region={region} state={state} />
      ))}
    </div>
  );
}

function RegionCard({ region, state }: { region: Region; state: GameState }) {
  const enslavedShare = (region.enslavedPopulation / region.population) * 100;

  return (
    <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-h2 text-content-primary">{region.name}</h3>
        <p className="text-small text-content-muted">
          {region.states.map((s) => s.name.split(' (')[0]).join(', ')}
        </p>
      </div>

      <div className="mt-2 space-y-0.5">
        <Row label="Population" value={formatNumber(Math.round(region.population))} />
        {/*
          Enslaved population is shown as demographic and economic fact, with
          its share and context. No control in the interface operates on this
          number. (ECONOMY.md §7.16, UI.md §5.6)
        */}
        <div className="flex items-baseline justify-between gap-3 py-0.5 pl-3">
          <span className="text-small text-content-muted">
            of whom enslaved
          </span>
          <span className="tabular text-data-sm text-content-secondary">
            {formatNumber(Math.round(region.enslavedPopulation))} ({enslavedShare.toFixed(1)}%)
          </span>
        </div>
        <Row label="Labor force" value={formatNumber(Math.round(region.laborForce))} />
      </div>

      {/*
        Each of these carries its full modifier breakdown, so acceptance
        criterion 4 holds on regional stats too and not only on national ones.
        The breakdown is built from the model's pre-modifier target, because
        that is what the ledger actually acts on for a lagged stat.
      */}
      <div className="mt-2 space-y-1.5 border-t border-ink-400 pt-2">
        <Meter
          label="Prosperity"
          value={region.prosperity}
          word=""
          breakdown={explainStat(
            `region.${region.id}.prosperity`,
            region.modelTargets.prosperity,
            state.activeModifiers,
            state.day,
            RANGES.percent,
          )}
          lag={{ target: region.modelTargets.prosperity, tauMonths: TAU_MONTHS.prosperity }}
        />
        <Meter
          label="Sentiment"
          value={region.sentiment}
          word={sentimentWord(region.sentiment)}
          min={-100}
          breakdown={explainStat(
            `region.${region.id}.sentiment`,
            region.modelTargets.sentiment,
            state.activeModifiers,
            state.day,
            RANGES.sentiment,
          )}
          lag={{ target: region.modelTargets.sentiment, tauMonths: TAU_MONTHS.sentiment }}
        />
        <Meter
          label="Compliance"
          value={region.compliance}
          word={complianceWord(region.compliance)}
          breakdown={explainStat(
            `region.${region.id}.compliance`,
            region.modelTargets.compliance,
            state.activeModifiers,
            state.day,
            RANGES.percent,
          )}
          lag={{ target: region.modelTargets.compliance, tauMonths: TAU_MONTHS.compliance }}
        />
      </div>

      <div className="mt-2 border-t border-ink-400 pt-2">
        <p className="text-label uppercase tracking-wider text-content-muted">
          Tax exposure
        </p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          <Exposure label="Tariff" value={region.tariffExposure} />
          <Exposure label="Excise" value={region.exciseExposure} />
          <Exposure label="Land" value={region.landExposure} />
        </div>
      </div>

      <p className="mt-2 text-small text-content-muted">
        {region.dominantIndustry}
      </p>
      <p className="mt-1 text-small text-content-secondary">
        {formatCurrency(region.agriculturalOutput)} agricultural ·{' '}
        {formatCurrency(region.manufacturingOutput)} manufacturing
      </p>
    </section>
  );
}

/**
 * A bar always paired with its numeral and a word, never colour alone.
 * The numeral carries the modifier breakdown when one is supplied.
 */
function Meter({
  label,
  value,
  word,
  min = 0,
  max = 100,
  breakdown,
  lag,
}: {
  label: string;
  value: number;
  word: string;
  min?: number;
  max?: number;
  breakdown?: StatBreakdown;
  lag?: { target: number; tauMonths: number };
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const tone = value >= (max + min) / 2 ? 'bg-verdigris-400' : 'bg-oxblood-400';

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-small text-content-secondary">{label}</span>
        <div className="flex items-baseline gap-1.5">
          <Stat
            label=""
            size="sm"
            value={value.toFixed(0)}
            breakdown={breakdown}
            lag={lag}
            className="!inline-flex"
          />
          {word && <span className="text-small text-content-muted">{word}</span>}
        </div>
      </div>
      <div className="mt-0.5 h-1 w-full rounded bg-ink-500" aria-hidden>
        <div
          className={`h-1 rounded ${tone}`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

function Exposure({ label, value }: { label: string; value: number }) {
  const pips = Math.round(Math.min(5, (value / 2.2) * 5));
  return (
    <div>
      <p className="text-small text-content-secondary">{label}</p>
      <p className="text-small text-content-primary">
        <span aria-hidden className="text-brass-400">
          {'▪'.repeat(Math.max(1, pips))}
        </span>
        <span aria-hidden className="text-ink-400">
          {'▪'.repeat(5 - Math.max(1, pips))}
        </span>{' '}
        <span className="text-content-muted">{exposureWord(value)}</span>
      </p>
    </div>
  );
}

// ============================================================================
// LEGISLATION
// ============================================================================

export function Legislation({ state }: { state: GameState }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {PHASE_1_CONTENT.laws.map((law) => {
        const enacted = state.policies.enactedLawIds.includes(law.id);
        const available = evaluateAll(law.requirements, state);
        const reasons = available ? [] : describeUnmet(law.requirements, state);

        return (
          <section
            key={law.id}
            className={`rounded-card border p-3 ${
              enacted
                ? 'border-brass-400/50 bg-ink-600'
                : available
                  ? 'border-ink-400 bg-ink-700'
                  : 'border-ink-400/60 bg-ink-800'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-serif text-h2 text-content-primary">{law.title}</h3>
              {enacted ? (
                <span className="text-label uppercase tracking-wider text-brass-300">
                  Enacted
                </span>
              ) : (
                !available && (
                  <span className="text-label uppercase tracking-wider text-content-muted">
                    Locked
                  </span>
                )
              )}
            </div>
            <p className="text-label uppercase tracking-wider text-content-muted">
              {law.category}
            </p>

            <p className="mt-2 text-body text-content-secondary">{law.description}</p>

            <Row label="Cost" value={formatCurrency(law.enactmentCost)} />

            {!available && (
              <ul className="mt-2 space-y-0.5">
                {reasons.map((reason) => (
                  <li key={reason} className="text-small text-oxblood-300">
                    Requires: {reason}
                  </li>
                ))}
              </ul>
            )}

            <details className="mt-2">
              <summary className="cursor-pointer text-small text-brass-300">
                Historical context
              </summary>
              <p className="mt-1.5 font-serif text-body-serif text-content-secondary">
                {law.historicalContext}
              </p>
              <ul className="mt-1.5">
                {law.sources.map((source) => (
                  <li key={source} className="text-small text-content-muted">
                    {source}
                  </li>
                ))}
              </ul>
            </details>
          </section>
        );
      })}
    </div>
  );
}

// ============================================================================
// CHRONICLE
// ============================================================================

export function Chronicle({ state }: { state: GameState }) {
  const entries = [...state.log].reverse();

  return (
    <div className="rounded-card border border-ink-400 bg-ink-700">
      {entries.length === 0 ? (
        <p className="p-4 text-small text-content-muted">
          Nothing has happened yet.
        </p>
      ) : (
        <ul className="divide-y divide-ink-400">
          {entries.map((entry) => (
            <li key={entry.id} className="px-4 py-2.5">
              <p className="text-label uppercase tracking-wider text-content-muted">
                <span className="tabular">{formatLongDate(entry.day)}</span>
                {' · '}
                {entry.category}
              </p>
              <p className="mt-0.5 text-body text-content-primary">{entry.title}</p>
              {entry.body && (
                <p
                  className={`mt-0.5 text-small ${
                    entry.tier === 'decision'
                      ? 'text-brass-300'
                      : 'text-content-secondary'
                  }`}
                >
                  {entry.body}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// NOT YET BUILT
// ============================================================================


