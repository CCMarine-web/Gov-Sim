'use client';

/**
 * TITLE SCREEN
 *
 * Minimal and atmospheric. (UI.md §5.1)
 *
 * The guest-play notice is persistent but quiet, and states the actual
 * consequence rather than nagging: you can play right now, and cloud save is
 * what an account buys you. (DESIGN.md §11.2)
 */

import Link from 'next/link';

export default function TitleScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 px-6">
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-card border border-brass-400/40 text-brass-400"
          aria-hidden
        >
          <span className="font-serif text-display">US</span>
        </div>

        <h1 className="mt-6 font-serif text-display text-content-primary">
          The American Experiment
        </h1>
        <p className="mt-1 font-serif text-body-serif text-content-secondary">
          a government simulator
        </p>

        <nav className="mt-10 flex flex-col gap-2" aria-label="Main menu">
          <Link
            href="/found"
            className="rounded-card border border-brass-400 px-4 py-2.5 text-body text-brass-300 transition-colors hover:bg-brass-400 hover:text-ink-900"
          >
            New Game
          </Link>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-card border border-ink-400 px-4 py-2.5 text-body text-content-disabled"
          >
            Continue
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-card border border-ink-400 px-4 py-2.5 text-body text-content-disabled"
          >
            Load Game
          </button>
        </nav>

        <div className="mt-8 border-t border-ink-400 pt-4">
          <p className="text-small text-content-muted">
            Playing as a guest. Saved games are not yet persisted — cloud save
            arrives with accounts.
          </p>
        </div>
      </div>
    </main>
  );
}
