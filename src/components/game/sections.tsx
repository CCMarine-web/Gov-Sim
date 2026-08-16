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
import { explainStat, type StatBreakdown } from '@/sim/modifiers';
import { currentCrises, stateOfTheUnion } from '@/sim/narrative';
import { taxesInForce } from '@/sim/taxes';
import { useMemo, useState } from 'react';
import type { GameState, LogCategory, LogTier, Region } from '@/sim/types';
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
  // Bills currently in force, by name. Repealed bills stay in the record but
  // are not 'active', which is why this filters on the day rather than on
  // membership of a list.
  const enactedBills = state.policies.bills
    .filter(
      (b) => b.enactedDay <= day && (b.repealedDay === null || b.repealedDay > day),
    )
    .map((b) => PHASE_1_CONTENT.bills.find((bill) => bill.id === b.billId))
    .filter((bill): bill is NonNullable<typeof bill> => bill !== undefined);

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
        {enactedBills.length === 0 ? (
          <p className="text-small text-content-muted">
            No laws enacted. The statute book is empty.
          </p>
        ) : (
          <ul className="space-y-1">
            {enactedBills.map((bill) => (
              <li key={bill.id} className="text-small text-content-secondary">
                · {bill.name}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* One row per tax in force, from state — not three fixed rows. A tax
          created by a bill appears here with no edit to this file. (brief §4.3) */}
      <Panel title="Taxation">
        {taxesInForce(policies, day).map((tax) => (
          <Row key={tax.id} label={tax.name} value={formatRate(tax.rate)} />
        ))}
        {taxesInForce(policies, day).length === 0 && (
          <p className="text-small text-content-muted">
            No taxes are levied.
          </p>
        )}
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
// CHRONICLE
// ============================================================================

const CATEGORIES: Array<LogCategory | 'all'> = [
  'all',
  'treasury',
  'legislation',
  'region',
  'event',
  'system',
];

const TIERS: Array<LogTier | 'all'> = ['all', 'decision', 'enactment', 'crisis', 'info'];

export function Chronicle({ state }: { state: GameState }) {
  const [category, setCategory] = useState<LogCategory | 'all'>('all');
  const [tier, setTier] = useState<LogTier | 'all'>('all');
  const [query, setQuery] = useState('');

  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return [...state.log]
      .reverse()
      .filter((entry) => category === 'all' || entry.category === category)
      .filter((entry) => tier === 'all' || entry.tier === tier)
      .filter(
        (entry) =>
          needle === '' ||
          entry.title.toLowerCase().includes(needle) ||
          entry.body.toLowerCase().includes(needle),
      );
  }, [state.log, category, tier, query]);

  const filtering = category !== 'all' || tier !== 'all' || query.trim() !== '';

  return (
    <div className="space-y-3">
      <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-label uppercase tracking-wider text-content-muted">
            Category
          </span>
          {CATEGORIES.map((value) => (
            <FilterChip
              key={value}
              label={value === 'all' ? 'All' : value}
              active={category === value}
              onClick={() => setCategory(value)}
            />
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-label uppercase tracking-wider text-content-muted">
            Kind
          </span>
          {TIERS.map((value) => (
            <FilterChip
              key={value}
              label={value === 'all' ? 'All' : value}
              active={tier === value}
              onClick={() => setTier(value)}
            />
          ))}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <label htmlFor="chronicle-search" className="sr-only">
            Search the chronicle
          </label>
          <input
            id="chronicle-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles and entries…"
            className="flex-1 rounded border border-ink-400 bg-ink-800 px-2 py-1.5 text-body text-content-primary"
          />
          {filtering && (
            <button
              type="button"
              onClick={() => {
                setCategory('all');
                setTier('all');
                setQuery('');
              }}
              className="rounded border border-ink-400 px-2 py-1.5 text-small text-content-secondary hover:bg-ink-500"
            >
              Clear
            </button>
          )}
        </div>

        <p className="mt-2 text-small text-content-muted" role="status">
          Showing <span className="tabular">{entries.length}</span> of{' '}
          <span className="tabular">{state.log.length}</span> entries
        </p>
      </section>

      <div className="rounded-card border border-ink-400 bg-ink-700">
        {entries.length === 0 ? (
          /* Two different empty states: nothing has happened, versus nothing
             matches. Telling them apart saves the player wondering whether the
             chronicle is broken. */
          <p className="p-4 text-small text-content-muted">
            {state.log.length === 0
              ? 'Nothing has happened yet.'
              : 'No entries match these filters.'}
          </p>
        ) : (
          <ul className="divide-y divide-ink-400">
            {entries.map((entry) => (
              <li key={entry.id} className="px-4 py-2.5">
                <p className="text-label uppercase tracking-wider text-content-muted">
                  <span className="tabular">{formatLongDate(entry.day)}</span>
                  {' · '}
                  {entry.category}
                  {entry.tier !== 'info' && (
                    <>
                      {' · '}
                      <span
                        className={
                          entry.tier === 'crisis'
                            ? 'text-oxblood-300'
                            : entry.tier === 'decision'
                              ? 'text-brass-300'
                              : 'text-content-muted'
                        }
                      >
                        {entry.tier}
                      </span>
                    </>
                  )}
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
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded border px-2 py-0.5 text-small capitalize transition-colors ${
        active
          ? 'border-brass-400 bg-brass-400 text-ink-900'
          : 'border-ink-400 text-content-secondary hover:bg-ink-500'
      }`}
    >
      {label}
    </button>
  );
}

// ============================================================================
// NOT YET BUILT
// ============================================================================


