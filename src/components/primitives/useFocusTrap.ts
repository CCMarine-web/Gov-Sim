'use client';

/**
 * FOCUS TRAP
 *
 * Keeps keyboard focus inside a dialog while it is open, and restores focus to
 * whatever was focused before when it closes.
 *
 * Without this, tabbing out of a modal lands on the page behind it — which for
 * a sighted mouse user is invisible and for a keyboard or screen reader user
 * makes the modal effectively a trap in the other direction: they cannot tell
 * where they are or how to get back.
 *
 * `onEscape` is optional on purpose. The event modal deliberately does not
 * close on Escape, because a decision cannot be dismissed without answering it
 * (UI.md §5.10). The save menu does close.
 */

import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  options: { onEscape?: () => void } = {},
): void {
  const { onEscape } = options;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first thing inside, so keyboard users start in the dialog
    // rather than wherever they happened to be on the page behind it.
    const initial = node.querySelectorAll<HTMLElement>(FOCUSABLE);
    initial[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (!node) return;

      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }

      if (event.key !== 'Tab') return;

      // Re-query each time: the contents can change while the dialog is open.
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [ref, onEscape]);
}
