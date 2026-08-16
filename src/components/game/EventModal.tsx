'use client';

/**
 * EVENT MODAL
 *
 * The game is ALREADY paused before this renders. The modal does not request a
 * pause; it is the consequence of one. (DESIGN.md §6.3)
 *
 * Escape does not close it and there is no dismiss control: the only way out is
 * to choose. Focus is trapped.
 *
 * "What actually happened" is always present and visually separated from the
 * narrative, on parchment, so the player always knows which text is fiction
 * and which is history. It is not collapsed by default - it is the educational
 * backbone of the game, not a footnote. (UI.md §5.10)
 */

import { useEffect, useRef } from 'react';
import { evaluateAll, describeUnmet } from '@/sim/conditions';
import { formatLongDate } from '@/sim/calendar';
import type { GameEvent, GameState } from '@/sim/types';
import { answerDecision } from '@/runtime/gameLoop';

export function EventModal({
  event,
  state,
}: {
  event: GameEvent;
  state: GameState;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Trap focus. Escape is deliberately not handled: a decision cannot be
  // dismissed, only answered.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = node.querySelectorAll<HTMLElement>('button:not([disabled])');
    focusables[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !node) return;
      const items = node.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  function choose(optionId: string) {
    // Answering clears the pending decision, which unmounts this modal. The
    // clock stays paused: the player decides when time resumes.
    answerDecision(event.id, optionId);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/70 p-6"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${event.id}-title`}
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-card border-t-2 border-brass-400 bg-ink-700"
      >
        <div className="border-b border-ink-400 px-6 py-4">
          <p className="tabular text-label uppercase tracking-wider text-content-muted">
            {formatLongDate(state.day)}
          </p>
          <h2
            id={`${event.id}-title`}
            className="mt-1 font-serif text-h1 text-content-primary"
          >
            {event.title}
          </h2>
        </div>

        {/* Narrative framing. Serif, evocative, and clearly not the history. */}
        <div className="px-6 py-4">
          <p className="whitespace-pre-line font-serif text-body-serif text-content-primary">
            {event.body}
          </p>
        </div>

        {/* Factual history. On parchment, always visible, never collapsed. */}
        <div className="mx-6 mb-4 rounded-card bg-parchment-100 px-4 py-3">
          <h3 className="text-label uppercase tracking-wider text-brass-700">
            What actually happened
          </h3>
          <p className="mt-1.5 font-serif text-body-serif text-ink-800">
            {event.historicalContext}
          </p>
          {event.sources.length > 0 && (
            <div className="mt-2 border-t border-parchment-300 pt-2">
              <p className="text-label uppercase tracking-wider text-ink-600">
                Sources
              </p>
              <ul className="mt-1 space-y-0.5">
                {event.sources.map((source) => (
                  <li key={source} className="text-small text-ink-600">
                    {source}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-2 px-6 pb-6">
          {event.options.map((option) => {
            const met =
              option.requirements.length === 0 ||
              evaluateAll(option.requirements, state);
            const reasons = met ? [] : describeUnmet(option.requirements, state);

            return (
              <button
                key={option.id}
                type="button"
                disabled={!met}
                onClick={() => choose(option.id)}
                className={`block w-full rounded-card border px-4 py-3 text-left transition-colors ${
                  met
                    ? 'border-ink-400 bg-ink-600 hover:border-brass-400 hover:bg-ink-500'
                    : 'cursor-not-allowed border-ink-400/50 bg-ink-800'
                }`}
              >
                <p
                  className={`text-body ${
                    met ? 'text-content-primary' : 'text-content-disabled'
                  }`}
                >
                  {option.label}
                </p>
                <p
                  className={`mt-0.5 text-small ${
                    met ? 'text-content-secondary' : 'text-content-disabled'
                  }`}
                >
                  {option.description}
                </p>

                {met ? (
                  <ul className="mt-2 space-y-0.5">
                    {option.previewedEffects.map((effect) => (
                      <li key={effect} className="text-small text-content-muted">
                        · {effect}
                      </li>
                    ))}
                  </ul>
                ) : (
                  // A blocked option always states its reason. "Requires the
                  // Funding Act of 1790" is infinitely more useful than a
                  // padlock. (UI.md §5.5)
                  <ul className="mt-2 space-y-0.5">
                    {reasons.map((reason) => (
                      <li key={reason} className="text-small text-oxblood-300">
                        Requires: {reason}
                      </li>
                    ))}
                  </ul>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
