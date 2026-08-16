'use client';

/**
 * COMMAND BAR
 *
 * Always visible, fixed at 64px. Seal, ruler, date, clock controls, and the
 * headline stats. (UI.md §4.1)
 *
 * The clock and the date never collapse at any width: if the player cannot see
 * what time it is or whether it is running, nothing else on screen means much.
 */

import { formatLongDate } from '@/sim/calendar';
import { RANGES, TAU_MONTHS } from '@/sim/calibration';
import { explainStat } from '@/sim/modifiers';
import { pause, setSpeed, start } from '@/runtime/gameLoop';
import { SPEEDS, SPEED_TABLE } from '@/runtime/speeds';
import { useGameStore, selectClock } from '@/store/gameStore';
import {
  direction,
  formatCurrency,
  formatIndex,
  formatPopulation,
} from '@/lib/format';
import { Stat } from '@/components/primitives/Stat';

export function CommandBar() {
  const snapshot = useGameStore((s) => s.snapshot);
  const clock = useGameStore(selectClock);

  if (!snapshot) return null;

  const { nation, treasury, ruler, series, day, activeModifiers } = snapshot;

  // Compare against the previous monthly sample for direction arrows.
  const prev = <T,>(arr: T[]): T => arr[Math.max(0, arr.length - 2)];

  return (
    <header
      className="flex h-16 shrink-0 items-center gap-4 border-b border-ink-400 bg-ink-900 px-4"
      aria-label="Command bar"
    >
      {/* Seal placeholder. A commissioned mark replaces this; a monogram plate
          reads better than an empty frame in the meantime. (UI.md §13) */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card border border-brass-400/40 text-brass-400"
        aria-hidden
      >
        <span className="font-serif text-h2">US</span>
      </div>

      <div className="min-w-0 shrink-0">
        <p className="truncate text-body text-content-primary">{ruler.name}</p>
        <p className="truncate text-small text-content-muted">
          {ruler.title} · {ruler.houseName}
        </p>
      </div>

      <div className="shrink-0 border-l border-ink-400 pl-4">
        <p className="tabular text-body text-content-primary">
          {formatLongDate(day)}
        </p>
        <ClockControls clock={clock} />
      </div>

      {/*
        NOT `overflow-x-auto`. It used to be, and it caused two problems.

        A scrollbar inside a 64px bar appears and disappears as the rendered
        values change length, so the whole row jumped while the clock ran. And
        an overflow container clips absolutely-positioned children, which meant
        every modifier breakdown opened from here — acceptance criterion 4 —
        was being cut off.

        Instead the stats shrink-wrap into reserved slots and the row wraps
        rather than scrolling. (DECISIONS.md D-014)
      */}
      <div className="ml-auto flex min-w-0 items-center gap-5">
        <Stat
          className="stat-slot"
          label="Treasury"
          value={formatCurrency(treasury.balance)}
          direction={direction(
            treasury.balance,
            prev(series.treasuryBalance),
            1000,
          )}
          size="md"
        />
        <Stat
          className="stat-slot"
          label="Debt"
          value={formatCurrency(treasury.debtPrincipal)}
          direction={direction(treasury.debtPrincipal, prev(series.debt), 1000)}
          favourableWhenRising={false}
          size="md"
        />
        <Stat
          className="stat-slot"
          label="Stability"
          value={formatIndex(nation.stability)}
          direction={direction(nation.stability, prev(series.stability))}
          size="md"
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
          className="stat-slot"
          label="Legitimacy"
          value={formatIndex(nation.legitimacy)}
          direction={direction(nation.legitimacy, prev(series.legitimacy))}
          size="md"
          breakdown={explainStat(
            'nation.legitimacy',
            nation.legitimacyBase,
            activeModifiers,
            day,
            RANGES.percent,
          )}
        />
        <Stat
          className="stat-slot"
          label="Population"
          value={formatPopulation(nation.population)}
          direction={direction(nation.population, prev(series.population), 100)}
          size="md"
        />
        <Stat
          className="stat-slot"
          label="GDP"
          value={formatCurrency(nation.gdp)}
          direction={direction(nation.gdp, prev(series.gdp), 10_000)}
          size="md"
        />
      </div>
    </header>
  );
}

function ClockControls({
  clock,
}: {
  clock: ReturnType<typeof selectClock>;
}) {
  const blocked = clock.blockedByDecision;

  return (
    <div className="mt-0.5 flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => (clock.running ? pause() : start())}
        disabled={blocked}
        aria-pressed={clock.running}
        aria-label={clock.running ? 'Pause' : 'Resume'}
        className={`rounded border px-1.5 text-small ${
          blocked
            ? 'cursor-not-allowed border-oxblood-400 text-oxblood-300'
            : 'border-ink-400 text-content-secondary hover:bg-ink-500'
        }`}
      >
        {clock.running ? '❚❚' : '▶'}
      </button>

      {/* Buttons, labels and descriptions all come from the one speed table.
          Nothing about the speeds is written down twice. (D-016) */}
      {SPEEDS.map((speed) => {
        const setting = SPEED_TABLE[speed];
        return (
          <button
            key={speed}
            type="button"
            onClick={() => setSpeed(speed)}
            aria-pressed={clock.speed === speed}
            aria-label={`Speed ${setting.label} — ${setting.description}`}
            title={setting.description}
            className={`tabular rounded px-1 text-small ${
              clock.speed === speed
                ? 'border-b-2 border-brass-400 text-brass-300'
                : 'text-content-muted hover:text-content-secondary'
            }`}
          >
            {setting.label}
          </button>
        );
      })}

      {/* The player must always be able to see WHY they are paused. */}
      {blocked && (
        <span className="ml-1 text-label uppercase tracking-wider text-oxblood-300">
          Decision required
        </span>
      )}
      {!blocked && clock.pausedByVisibility && (
        <span className="ml-1 text-label uppercase tracking-wider text-content-muted">
          Paused (tab hidden)
        </span>
      )}
    </div>
  );
}
