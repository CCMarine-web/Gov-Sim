'use client';

/**
 * KEYBOARD REFERENCE
 *
 * Opened with `?`. UI.md §8 requires a shortcut reference to exist; without
 * one the shortcuts are only discoverable by being told about them, which
 * makes them useless to exactly the people who most need them.
 */

import { useRef } from 'react';
import { useFocusTrap } from '@/components/primitives/useFocusTrap';

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: 'Space', action: 'Pause or resume the clock' },
  { keys: '1', action: 'Speed 1x — one in-game day per second' },
  { keys: '2', action: 'Speed 2x' },
  { keys: '3', action: 'Speed 5x' },
  { keys: '?', action: 'Open this reference' },
  { keys: 'Esc', action: 'Close an overlay' },
  { keys: 'Tab', action: 'Move through the interface in reading order' },
];

export function KeyboardHelp({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, { onEscape: onClose });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink-900/70 p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-help-title"
        className="w-full max-w-md rounded-card border-t-2 border-brass-400 bg-ink-700"
      >
        <div className="flex items-baseline justify-between border-b border-ink-400 px-5 py-3">
          <h2 id="keyboard-help-title" className="font-serif text-h1 text-content-primary">
            Keyboard
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-small text-content-secondary hover:text-content-primary"
          >
            Close
          </button>
        </div>

        <dl className="px-5 py-4">
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={keys} className="flex items-baseline gap-3 py-1">
              <dt className="w-16 shrink-0">
                <kbd className="rounded border border-ink-400 bg-ink-600 px-1.5 py-0.5 text-small text-content-primary">
                  {keys}
                </kbd>
              </dt>
              <dd className="text-body text-content-secondary">{action}</dd>
            </div>
          ))}
        </dl>

        <p className="border-t border-ink-400 px-5 py-3 text-small text-content-muted">
          Shortcuts are suppressed while you are typing in a field. An event
          awaiting a decision cannot be dismissed with Escape — it has to be
          answered.
        </p>
      </div>
    </div>
  );
}
