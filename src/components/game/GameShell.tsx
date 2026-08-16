'use client';

/**
 * GAME SHELL
 *
 * The persistent three-zone layout. The shell itself NEVER scrolls; internal
 * panels do. (UI.md §4)
 *
 * Also owns the keyboard controls, because they are global rather than
 * belonging to any one section. (UI.md §8)
 */

import { useCallback, useEffect, useState } from 'react';
import { PHASE_1_CONTENT } from '@/content';
import { setSpeed, toggle } from '@/runtime/gameLoop';
import { useGameStore } from '@/store/gameStore';
import { startAutosave, stopAutosave } from '@/lib/saves/autosave';
import { CommandBar } from './CommandBar';
import { ChronicleFeed } from './ChronicleFeed';
import { EventModal } from './EventModal';
import { LeftNav, type SectionId } from './LeftNav';
import { SaveMenu } from './SaveMenu';
import { Chronicle, Desk, Government, Legislation, Regions } from './sections';
import { HistoryPanel } from './HistoryPanel';
import { TreasuryPanel } from './TreasuryPanel';

const SECTION_TITLE: Record<SectionId, string> = {
  desk: 'The Desk',
  treasury: 'Treasury',
  legislation: 'Legislation',
  regions: 'Regions',
  government: 'Government',
  history: 'History',
  chronicle: 'Chronicle',
};

export function GameShell() {
  const snapshot = useGameStore((s) => s.snapshot);
  const [section, setSection] = useState<SectionId>('desk');
  const [savesOpen, setSavesOpen] = useState(false);

  // Autosave subscribes to the store, never to the tick. Idempotent, so Strict
  // Mode's double-invoke does not double-subscribe.
  useEffect(() => {
    startAutosave();
    return () => stopAutosave();
  }, []);

  const pendingId = snapshot?.eventState.pendingDecisions[0]?.eventId ?? null;

  /**
   * The modal's visibility is DERIVED, not stored. A decision cannot be
   * dismissed without answering it (UI.md §5.10), so "is a decision pending"
   * is the whole answer. Holding it in state would mean an effect syncing two
   * sources of truth for one fact.
   */
  const pendingEvent = pendingId
    ? (PHASE_1_CONTENT.events.find((e) => e.id === pendingId) ?? null)
    : null;

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    // Never hijack typing.
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }

    switch (e.key) {
      case ' ':
        e.preventDefault();
        toggle();
        break;
      case '1':
        setSpeed(1);
        break;
      case '2':
        setSpeed(2);
        break;
      case '3':
        setSpeed(5);
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  if (!snapshot) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-body text-content-muted">No game in progress.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink-800">
      <CommandBar />

      <div className="flex min-h-0 flex-1">
        <LeftNav
          active={section}
          onSelect={setSection}
          badges={{ desk: pendingId ? 1 : 0 }}
        />

        <main className="min-w-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex items-baseline justify-between">
            <h1 className="font-serif text-h1 text-content-primary">
              {SECTION_TITLE[section]}
            </h1>
            <button
              type="button"
              onClick={() => setSavesOpen(true)}
              className="rounded-card border border-ink-400 px-3 py-1 text-small text-content-secondary hover:bg-ink-500"
            >
              Saved games
            </button>
          </div>

          {section === 'desk' && <Desk state={snapshot} />}
          {section === 'treasury' && <TreasuryPanel state={snapshot} />}
          {section === 'legislation' && <Legislation state={snapshot} />}
          {section === 'regions' && <Regions state={snapshot} />}
          {section === 'government' && <Government />}
          {section === 'history' && <HistoryPanel state={snapshot} />}
          {section === 'chronicle' && <Chronicle state={snapshot} />}
        </main>

        <ChronicleFeed />
      </div>

      {savesOpen && <SaveMenu onClose={() => setSavesOpen(false)} />}

      {/* Rendered last so a decision always sits above the save menu. */}
      {pendingEvent && <EventModal event={pendingEvent} state={snapshot} />}
    </div>
  );
}
