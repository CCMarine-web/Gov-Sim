'use client';

/**
 * CHRONICLE FEED
 *
 * Reverse-chronological account of what is happening. Two visual tiers that
 * are deliberately unlike each other (UI.md §4.3):
 *
 *   INFORMATIONAL     muted, no border, not interactive
 *   DECISION REQUIRED parchment ground, brass left border, clickable, and
 *                     persistent until resolved - it does not scroll away
 *
 * An ARIA live region so new entries are announced; decision entries are
 * alerts, because they block the game.
 */

import { formatLongDate } from '@/sim/calendar';
import type { LogEntry } from '@/sim/types';
import { useGameStore } from '@/store/gameStore';

export function ChronicleFeed() {
  const snapshot = useGameStore((s) => s.snapshot);
  if (!snapshot) return null;

  const entries = [...snapshot.log].reverse().slice(0, 60);
  const pending = snapshot.eventState.pendingDecisions[0] ?? null;

  return (
    <aside
      className="flex w-[320px] shrink-0 flex-col border-l border-ink-400 bg-ink-800"
      aria-label="Chronicle"
    >
      <h2 className="border-b border-ink-400 px-3 py-2 text-label uppercase tracking-wider text-content-muted">
        Chronicle
      </h2>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/*
          Not a button: a pending decision always has its modal open on top,
          because it cannot be dismissed without being answered. This is the
          persistent alert tier, and it stays until resolved.
        */}
        {pending && (
          <div
            role="alert"
            className="border-l-[3px] border-brass-400 bg-parchment-100 px-3 py-2.5"
          >
            <p className="text-label uppercase tracking-wider text-brass-700">
              Decision required
            </p>
            <p className="mt-0.5 font-serif text-body-serif text-ink-800">
              {pendingTitle(snapshot.log, pending.eventId)}
            </p>
            <p className="mt-1 text-small text-ink-600">
              The clock is stopped until you answer.
            </p>
          </div>
        )}

        <div aria-live="polite" className="divide-y divide-ink-400/50">
          {entries.map((entry) => (
            <FeedEntry key={entry.id} entry={entry} />
          ))}
        </div>

        {entries.length === 0 && (
          <p className="px-3 py-4 text-small text-content-muted">
            Nothing has happened yet.
          </p>
        )}
      </div>
    </aside>
  );
}

function pendingTitle(log: LogEntry[], eventId: string): string {
  const match = log.find((l) => l.relatedEventId === eventId);
  return match?.title ?? 'A decision awaits you';
}

function FeedEntry({ entry }: { entry: LogEntry }) {
  const isDecision = entry.tier === 'decision';
  const isCrisis = entry.tier === 'crisis';

  return (
    <article className="px-3 py-2">
      <p className="text-label uppercase tracking-wider text-content-muted">
        <span className="tabular">{formatLongDate(entry.day)}</span>
        {' · '}
        {entry.category}
      </p>
      <p
        className={`mt-0.5 text-body ${
          isCrisis ? 'text-oxblood-300' : 'text-content-secondary'
        }`}
      >
        {entry.title}
      </p>
      {entry.body && (
        <p
          className={`mt-0.5 text-small ${
            isDecision ? 'text-brass-300' : 'text-content-muted'
          }`}
        >
          {entry.body}
        </p>
      )}
    </article>
  );
}
