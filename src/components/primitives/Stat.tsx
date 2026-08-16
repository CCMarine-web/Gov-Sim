'use client';

/**
 * STAT
 *
 * The most important component in the application.
 *
 * Every number in the game renders through this. It does two jobs that must
 * never be forgotten per call site, so they are enforced here:
 *
 *   1. TABULAR NUMERALS. With a ticking clock, proportional numerals cause
 *      visible width jitter as digits change. Non-negotiable. (UI.md §2.2)
 *
 *   2. THE MODIFIER BREAKDOWN. Hovering, tapping, or focusing any stat reveals
 *      every contributing modifier with its source and magnitude, summing
 *      VISIBLY to the displayed total. This is acceptance criterion 4, and the
 *      arithmetic shown is the arithmetic that produced the number - both come
 *      from `explainStat`, so they cannot disagree. (UI.md §7)
 *
 * Meaning is never carried by colour alone: direction is an arrow plus a word
 * plus a colour, and the word is what a screen reader announces.
 */

import { useId, useState } from 'react';
import type { StatBreakdown } from '@/sim/modifiers';
import {
  type Direction,
  directionClass,
  directionGlyph,
  directionLabel,
} from '@/lib/format';

export interface StatProps {
  label: string;
  /** Pre-formatted display value. */
  value: string;
  direction?: Direction;
  /** False for stats where rising is bad, such as debt. */
  favourableWhenRising?: boolean;
  breakdown?: StatBreakdown;
  /** Where a lagged stat is heading, and how long it takes to get there. */
  lag?: { target: number; tauMonths: number };
  /** Formats numbers inside the breakdown popover. */
  formatContribution?: (value: number) => string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<StatProps['size']>, string> = {
  sm: 'text-data-sm',
  md: 'text-data-md',
  lg: 'text-data-lg',
};

const SOURCE_LABEL: Record<string, string> = {
  law: 'law',
  event: 'event',
  policy: 'policy',
  structural: 'structural',
  crisis: 'crisis',
};

export function Stat({
  label,
  value,
  direction,
  favourableWhenRising = true,
  breakdown,
  lag,
  formatContribution = (v) => (v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1)),
  size = 'md',
  className = '',
}: StatProps) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const interactive = breakdown !== undefined;

  const arrow = direction ? directionGlyph(direction) : null;
  const arrowClass = direction
    ? directionClass(direction, favourableWhenRising)
    : '';

  return (
    <div
      className={`relative inline-flex flex-col ${className}`}
      /*
        Test hooks. Number stability is asserted by reading these off the DOM
        (see numberStability.test.tsx), which is the same thing the player's eye
        does — a value that has dropped out reads as empty here rather than
        being papered over by inspecting component state instead.
      */
      data-stat-label={label}
      data-stat-value={value}
      onMouseEnter={() => interactive && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Omitted entirely when empty — an empty label element would take up
          space and be announced as a blank by a screen reader. Callers that
          supply no label render their own alongside. */}
      {label && (
        <span className="text-label uppercase tracking-wider text-content-muted">
          {label}
        </span>
      )}

      <button
        type="button"
        disabled={!interactive}
        aria-describedby={open ? popoverId : undefined}
        aria-expanded={interactive ? open : undefined}
        onFocus={() => interactive && setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => interactive && setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        className={`tabular flex items-baseline gap-1.5 text-left ${SIZE_CLASS[size]} text-content-primary ${
          interactive ? 'cursor-help' : 'cursor-default'
        }`}
      >
        <span>{value}</span>
        {arrow && (
          <span className={`text-small ${arrowClass}`} aria-hidden>
            {arrow}
          </span>
        )}
        {direction && <span className="sr-only">{directionLabel(direction)}</span>}
      </button>

      {open && breakdown && (
        <div
          id={popoverId}
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-1 w-72 rounded-card border border-ink-400 bg-ink-700 p-3 shadow-none"
        >
          <div className="flex items-baseline justify-between border-b border-ink-400 pb-1.5">
            <span className="text-label uppercase tracking-wider text-content-secondary">
              {label}
            </span>
            <span className="tabular text-data-sm text-content-primary">
              {formatContribution(breakdown.total).replace('+', '')}
            </span>
          </div>

          <dl className="mt-1.5 space-y-1">
            <div className="flex justify-between text-small">
              <dt className="text-content-secondary">Base</dt>
              <dd className="tabular text-content-secondary">
                {breakdown.base.toFixed(1)}
              </dd>
            </div>

            {breakdown.contributions.map((c) => (
              <div key={c.modifierId} className="flex justify-between gap-2 text-small">
                <dt className="min-w-0 flex-1 truncate text-content-secondary">
                  <span className="text-content-muted">
                    {SOURCE_LABEL[c.sourceType] ?? c.sourceType}
                  </span>{' '}
                  {c.source}
                  {c.isPercentage && (
                    <span className="text-content-muted"> ({formatContribution(c.value * 100)}%)</span>
                  )}
                </dt>
                <dd
                  className={`tabular shrink-0 ${
                    c.effect >= 0 ? 'text-verdigris-400' : 'text-oxblood-300'
                  }`}
                >
                  {formatContribution(c.effect)}
                </dd>
              </div>
            ))}

            {breakdown.contributions.length === 0 && (
              <div className="text-small text-content-muted">
                No modifiers currently apply.
              </div>
            )}

            {/*
              Clamping is shown as an explicit line rather than silently
              breaking the sum. If the arithmetic on screen did not reconcile
              to the total, the popover would be lying. (UI.md §7)
            */}
            {Math.abs(breakdown.clampAdjustment) > 0.001 && (
              <div className="flex justify-between text-small">
                <dt className="text-content-muted">Clamped to range</dt>
                <dd className="tabular text-content-muted">
                  {formatContribution(breakdown.clampAdjustment)}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-1.5 flex justify-between border-t border-ink-400 pt-1.5 text-small">
            <span className="text-content-primary">Total</span>
            <span className="tabular text-content-primary">
              {breakdown.total.toFixed(1)}
            </span>
          </div>

          {lag && (
            <p className="mt-2 text-small text-content-muted">
              Moving toward {lag.target.toFixed(1)} · about {lag.tauMonths} month
              {lag.tauMonths === 1 ? '' : 's'} to register
            </p>
          )}
        </div>
      )}
    </div>
  );
}
