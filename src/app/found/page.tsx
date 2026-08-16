'use client';

/**
 * FOUNDING SCREEN
 *
 * The government-type choice. It must feel weighty, so it is a two-step
 * commitment: choose a form, then name your ruler and confirm. The choice
 * cannot be changed afterwards, and the screen says so. (UI.md §5.2)
 *
 * The starting figures shown here are read from calibration and the region
 * seed data, not hardcoded in this component. (DESIGN.md Rule 7)
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PHASE_1_CONTENT } from '@/content';
import { REGION_SEEDS } from '@/content/regions/regions1790';
import { START } from '@/sim/calibration';
import type { GovernmentType } from '@/sim/types';
import { startNewGame } from '@/runtime/gameLoop';
import { sentimentWord } from '@/lib/format';

export default function FoundingScreen() {
  const router = useRouter();
  const [choice, setChoice] = useState<GovernmentType | null>(null);
  const [rulerName, setRulerName] = useState('George Washington');
  const [houseName, setHouseName] = useState('Federalist');

  function found() {
    if (!choice) return;

    startNewGame(
      {
        governmentType: choice,
        rulerName: rulerName.trim() || 'Unnamed',
        houseName: houseName.trim() || 'Unnamed',
        // Identifiers are supplied by the caller; the engine may not generate
        // them. (createGame.ts, purity note)
        seed: Math.floor(Math.random() * 2_147_483_647),
        gameId: crypto.randomUUID(),
        createdAtISO: new Date().toISOString(),
        contentVersion: PHASE_1_CONTENT.version,
      },
      PHASE_1_CONTENT,
    );

    router.push('/play');
  }

  return (
    <main className="min-h-screen bg-ink-900 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="text-center">
          <p className="tabular text-label uppercase tracking-wider text-content-muted">
            30 April 1789 · New York
          </p>
          <h1 className="mt-2 font-serif text-display text-content-primary">
            The Constitution is ratified
          </h1>
          <p className="mt-1 font-serif text-body-serif text-content-secondary">
            The office is yours to shape.
          </p>
        </header>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <FoundingCard
            type="monarchy"
            selected={choice === 'monarchy'}
            onSelect={() => setChoice('monarchy')}
          />
          <FoundingCard
            type="republic"
            selected={choice === 'republic'}
            onSelect={() => setChoice('republic')}
          />
        </div>

        <p className="mt-4 text-center text-small text-content-muted">
          Whichever you choose, you remain in power for the whole game.
          Officeholders change around you; you do not.
        </p>

        {choice && (
          <section className="mt-6 rounded-card border border-brass-400/50 bg-ink-700 p-4">
            <h2 className="font-serif text-h2 text-content-primary">
              Confirm the founding
            </h2>
            <p className="mt-1 text-small text-content-secondary">
              You are founding a {choice}. This cannot be changed afterwards.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-label uppercase tracking-wider text-content-muted">
                  {choice === 'monarchy' ? 'Your name as sovereign' : 'Your name'}
                </span>
                <input
                  value={rulerName}
                  onChange={(e) => setRulerName(e.target.value)}
                  className="mt-1 w-full rounded border border-ink-400 bg-ink-800 px-2 py-1.5 text-body text-content-primary"
                />
              </label>
              <label className="block">
                <span className="text-label uppercase tracking-wider text-content-muted">
                  {choice === 'monarchy' ? 'Dynasty' : 'Party'}
                </span>
                <input
                  value={houseName}
                  onChange={(e) => setHouseName(e.target.value)}
                  className="mt-1 w-full rounded border border-ink-400 bg-ink-800 px-2 py-1.5 text-body text-content-primary"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={found}
              className="mt-4 w-full rounded-card border border-brass-400 bg-brass-400 px-4 py-2.5 text-body text-ink-900 transition-colors hover:bg-brass-300"
            >
              Found the Nation
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

function FoundingCard({
  type,
  selected,
  onSelect,
}: {
  type: GovernmentType;
  selected: boolean;
  onSelect: () => void;
}) {
  const isMonarchy = type === 'monarchy';
  const legitimacy = isMonarchy
    ? START.legitimacy.monarchy
    : START.legitimacy.republic;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-card border p-4 text-left transition-colors ${
        selected
          ? 'border-brass-400 bg-ink-600'
          : 'border-ink-400 bg-ink-700 hover:border-brass-400/50'
      }`}
    >
      <h2 className="font-serif text-h1 text-content-primary">
        {isMonarchy ? 'Monarchy' : 'Republic'}
      </h2>
      <p className="mt-1.5 text-body text-content-secondary">
        {isMonarchy
          ? 'You are King. Authority rests in your person and passes to your bloodline.'
          : 'You are President. Authority is granted by consent and must be renewed.'}
      </p>

      <div className="mt-4">
        <p className="text-label uppercase tracking-wider text-content-muted">
          At founding
        </p>
        <div className="mt-1 flex items-baseline justify-between text-small">
          <span className="text-content-secondary">Legitimacy</span>
          <span className="tabular text-content-primary">{legitimacy}</span>
        </div>
        {REGION_SEEDS.map((seed) => {
          const sentiment = isMonarchy
            ? seed.sentimentMonarchy
            : seed.sentimentRepublic;
          return (
            <div
              key={seed.id}
              className="flex items-baseline justify-between text-small"
            >
              <span className="text-content-secondary">{seed.name}</span>
              <span className="text-content-muted">
                <span className="tabular">
                  {sentiment > 0 ? '+' : ''}
                  {sentiment}
                </span>{' '}
                {sentimentWord(sentiment)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <p className="text-label uppercase tracking-wider text-content-muted">
          Over time
        </p>
        <ul className="mt-1 space-y-1 text-small text-content-secondary">
          {isMonarchy ? (
            <>
              <li>· Legitimacy does not decay</li>
              <li>· Unilateral action costs less</li>
              <li>· Mishandled crises cost far more</li>
            </>
          ) : (
            <>
              <li>· Legitimacy decays unless renewed by results</li>
              <li>· Unpopular laws cost more political capital</li>
              <li>· Crises are absorbed more gracefully</li>
            </>
          )}
        </ul>
      </div>

      <div className="mt-4 border-t border-ink-400 pt-2">
        <p className="text-label uppercase tracking-wider text-content-muted">
          Succession
        </p>
        <p className="text-small text-content-secondary">
          {isMonarchy ? 'Your heir inherits.' : 'Elections are held.'}{' '}
          <span className="text-content-muted">(Phase 2)</span>
        </p>
      </div>
    </button>
  );
}
