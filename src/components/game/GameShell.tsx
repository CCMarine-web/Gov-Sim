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
import {
  appointOfficer,
  concludeTreaty,
  declare,
  fabricate,
  seekPeace,
  sendMinister,
  setSpeed,
  toggle,
} from '@/runtime/gameLoop';
import { SPEEDS } from '@/runtime/speeds';
import { useGameStore } from '@/store/gameStore';
import { startAutosave, stopAutosave } from '@/lib/saves/autosave';
import { CommandBar } from './CommandBar';
import { ChronicleFeed, usePendingCount } from './ChronicleFeed';
import { KeyboardHelp } from './KeyboardHelp';
import { EventModal } from './EventModal';
import { LeftNav, type SectionId } from './LeftNav';
import { SaveMenu } from './SaveMenu';
import { SettingsPanel } from './SettingsPanel';
import { COPY } from '@/content/copy';
import { loadPreferences } from '@/lib/preferences';
import { applySkin } from '@/lib/theme';
import { audio } from '@/lib/audio';
import { Chronicle, Desk, Regions } from './sections';
import { MapPanel } from './MapPanel';
import { LegislationPanel } from './LegislationPanel';
import { CongressPanel } from './CongressPanel';
import { DiplomacyPanel } from './DiplomacyPanel';
import { GovernmentPanel } from './GovernmentPanel';
import { HistoryPanel } from './HistoryPanel';
import { TreasuryPanel } from './TreasuryPanel';

const SECTION_TITLE: Record<SectionId, string> = COPY.section;

export function GameShell() {
  const snapshot = useGameStore((s) => s.snapshot);
  const [section, setSection] = useState<SectionId>('map');
  const [savesOpen, setSavesOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  /*
    THE SKIN IS APPLIED ON MOUNT, not during render. localStorage does not
    exist on the server, and a first paint that differs from the second is a
    hydration mismatch. (brief §8)
  */
  useEffect(() => {
    const prefs = loadPreferences();
    applySkin(prefs.skin);
    audio.setPreferences(prefs.audio);
  }, []);
  const pendingCount = usePendingCount();

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

    // Keys 1-5 map straight onto the five speeds. Derived from the table
    // rather than switched on by hand, so adding or removing a speed cannot
    // leave a key pointing at nothing. (D-016)
    const asSpeed = SPEEDS.find((s) => String(s) === e.key);
    if (asSpeed !== undefined) {
      setSpeed(asSpeed);
      return;
    }

    switch (e.key) {
      case ' ':
        e.preventDefault();
        toggle();
        break;
      case '?':
        setHelpOpen(true);
        break;
      case 'Escape':
        // The event modal handles its own Escape by refusing it; these are the
        // dismissible overlays.
        setHelpOpen(false);
        setSavesOpen(false);
        setFeedOpen(false);
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
          badges={{ map: pendingId ? 1 : 0 }}
        />

        <main className="min-w-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex items-baseline justify-between">
            <h1 className="font-serif text-h1 text-content-primary">
              {SECTION_TITLE[section]}
            </h1>
            <div className="flex items-center gap-2">
              {/* Only reachable below 1280px, where the feed is collapsed. */}
              <button
                type="button"
                onClick={() => setFeedOpen(true)}
                aria-label={
                  pendingCount > 0
                    ? `Open chronicle, ${pendingCount} decision${pendingCount === 1 ? '' : 's'} awaiting you`
                    : 'Open chronicle'
                }
                className="flex items-center gap-1.5 rounded-card border border-ink-400 px-3 py-1 text-small text-content-secondary hover:bg-ink-500 xl:hidden"
              >
                {COPY.shell.chronicle}
                {pendingCount > 0 && (
                  <span
                    aria-hidden
                    className="rounded bg-brass-400 px-1 text-small text-ink-900"
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSavesOpen(true)}
                className="rounded-card border border-ink-400 px-3 py-1 text-small text-content-secondary hover:bg-ink-500"
              >
                {COPY.shell.savedGames}
              </button>
              <button
                type="button"
                data-testid="open-settings"
                onClick={() => setSettingsOpen(true)}
                className="rounded-card border border-ink-400 px-3 py-1 text-small text-content-secondary hover:bg-ink-500"
              >
                {COPY.shell.settings}
              </button>
            </div>
          </div>

          {/*
            THE MAP IS THE MAIN VIEW (brief §6). The Desk's panels were not
            thrown away with it — vitals, crises and the statute book still
            matter, and the chronicle badge points here — so they sit beneath
            the map as the summary they always were.
          */}
          {section === 'map' && (
            <div className="space-y-3">
              <MapPanel state={snapshot} />
              <Desk state={snapshot} />
            </div>
          )}
          {section === 'treasury' && <TreasuryPanel state={snapshot} />}
          {section === 'legislation' && <LegislationPanel state={snapshot} />}
          {section === 'congress' && <CongressPanel state={snapshot} />}
          {section === 'diplomacy' && (
            <DiplomacyPanel
              state={snapshot}
              onEnvoy={sendMinister}
              onSign={concludeTreaty}
              onDeclare={declare}
              onFabricate={fabricate}
              onPeace={seekPeace}
            />
          )}
          {section === 'regions' && <Regions state={snapshot} />}
          {section === 'government' && (
            <GovernmentPanel state={snapshot} onAppoint={appointOfficer} />
          )}
          {section === 'history' && <HistoryPanel state={snapshot} />}
          {section === 'chronicle' && <Chronicle state={snapshot} />}
        </main>

        {/* Fixed right zone at 1280px and above. */}
        <ChronicleFeed variant="column" />
      </div>

      {/*
        Below 1280px the feed collapses to a drawer (UI.md §11). It is not
        simply hidden: a decision entry is persistent and must stay reachable
        at every width, which is what the badge on the toggle is for.
      */}
      {feedOpen && (
        <div className="fixed inset-0 z-[90] flex justify-end xl:hidden">
          <button
            type="button"
            aria-label="Close chronicle"
            onClick={() => setFeedOpen(false)}
            className="flex-1 bg-ink-900/60"
          />
          <ChronicleFeed variant="drawer" onClose={() => setFeedOpen(false)} />
        </div>
      )}

      {savesOpen && <SaveMenu onClose={() => setSavesOpen(false)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {helpOpen && <KeyboardHelp onClose={() => setHelpOpen(false)} />}

      {/* Rendered last so a decision always sits above the save menu. */}
      {pendingEvent && <EventModal event={pendingEvent} state={snapshot} />}
    </div>
  );
}
