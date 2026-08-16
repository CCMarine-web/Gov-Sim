'use client';

/**
 * SAVE MENU
 *
 * Four slots — one rolling autosave and three named — plus the sign-in path.
 *
 * The panel is honest about where data actually lives. When Supabase is not
 * configured, or the player is signed out, it says plainly that saves are in
 * this browser only rather than implying a sync that is not happening.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '@/components/primitives/useFocusTrap';
import { formatLongDate } from '@/sim/calendar';
import { getGameState, loadGame as adoptGame } from '@/runtime/gameLoop';
import { PHASE_1_CONTENT } from '@/content';
import { cloudUnavailableReason, isSupabaseConfigured } from '@/lib/supabase/config';
import { getBrowserSupabase } from '@/lib/supabase/client';
import {
  AUTOSAVE_SLOT,
  NAMED_SLOTS,
  deleteSave,
  listSaves,
  loadGame,
  saveGame,
  syncLocalToCloud,
  type SaveMeta,
} from '@/lib/saves';

type Status = { tone: 'ok' | 'warn' | 'error'; text: string } | null;

export function SaveMenu({ onClose }: { onClose: () => void }) {
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [storedIn, setStoredIn] = useState<'local' | 'cloud'>('local');
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [email, setEmail] = useState('');
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const result = await listSaves();
    setSaves(result.saves);
    setStoredIn(result.storedIn);
    setNotice(result.notice);

    const supabase = getBrowserSupabase();
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      setSignedInAs(data.user?.email ?? null);
    }
  }, []);

  /**
   * Initial load.
   *
   * setState lives inside the promise callback, and the fetch is cancellable —
   * closing the menu mid-request must not write state into an unmounted
   * component. The lint rule that flagged the first version was pointing at
   * exactly that missing cancellation.
   */
  useEffect(() => {
    let cancelled = false;

    void listSaves().then(async (result) => {
      if (cancelled) return;
      setSaves(result.saves);
      setStoredIn(result.storedIn);
      setNotice(result.notice);

      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!cancelled) setSignedInAs(data.user?.email ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Unlike the event modal, this one closes on Escape: nothing here is
  // blocking, so trapping the player inside it would be gratuitous.
  useFocusTrap(dialogRef, { onEscape: onClose });

  async function doSave(slot: number) {
    const state = getGameState();
    if (!state) return;
    setBusy(true);
    const name = slot === AUTOSAVE_SLOT ? 'Autosave' : `Save ${slot}`;
    const outcome = await saveGame(slot, name, state);
    setBusy(false);

    setStatus(
      outcome.ok
        ? {
            tone: outcome.degradedReason ? 'warn' : 'ok',
            text:
              outcome.message ??
              `Saved to ${outcome.storedIn === 'cloud' ? 'the cloud' : 'this browser'}.`,
          }
        : { tone: 'error', text: outcome.message ?? 'Could not save.' },
    );
    await refresh();
  }

  async function doLoad(slot: number) {
    setBusy(true);
    const result = await loadGame(slot);
    setBusy(false);

    if (!result.ok || !result.state) {
      // A refusal is shown verbatim: the migration layer writes these to be
      // read by a person. (DESIGN.md Rule 8)
      setStatus({ tone: 'error', text: result.reason ?? 'Could not load that save.' });
      return;
    }

    adoptGame(result.state, PHASE_1_CONTENT);
    setStatus({
      tone: 'ok',
      text:
        result.migratedFrom != null
          ? `Loaded, and upgraded from save format ${result.migratedFrom}.`
          : 'Loaded.',
    });
    onClose();
  }

  async function doDelete(slot: number) {
    setBusy(true);
    await deleteSave(slot);
    setBusy(false);
    setStatus({ tone: 'ok', text: 'Save deleted.' });
    await refresh();
  }

  async function signIn() {
    const supabase = getBrowserSupabase();
    if (!supabase || !email.trim()) return;

    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);

    setStatus(
      error
        ? { tone: 'error', text: error.message }
        : { tone: 'ok', text: 'Check your email for a sign-in link.' },
    );
  }

  async function signOut() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setSignedInAs(null);
    await refresh();
    setStatus({ tone: 'ok', text: 'Signed out. Saves are now local to this browser.' });
  }

  async function sync() {
    setBusy(true);
    const { uploaded, failed } = await syncLocalToCloud();
    setBusy(false);
    setStatus({
      tone: failed > 0 ? 'warn' : 'ok',
      text: `Uploaded ${uploaded} save${uploaded === 1 ? '' : 's'}${failed > 0 ? `, ${failed} failed` : ''}.`,
    });
    await refresh();
  }

  const bySlot = (slot: number) => saves.find((s) => s.slot === slot);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-ink-900/70 p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-menu-title"
        className="max-h-full w-full max-w-xl overflow-y-auto rounded-card border-t-2 border-brass-400 bg-ink-700"
      >
        <div className="flex items-baseline justify-between border-b border-ink-400 px-5 py-3">
          <h2 id="save-menu-title" className="font-serif text-h1 text-content-primary">
            Saved Games
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-small text-content-secondary hover:text-content-primary"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-small text-content-muted">
            Storing in{' '}
            <span className="text-content-secondary">
              {storedIn === 'cloud' ? 'your account' : 'this browser'}
            </span>
            {signedInAs && <> · signed in as {signedInAs}</>}
          </p>
          {notice && <p className="mt-1 text-small text-brass-300">{notice}</p>}

          <div className="mt-3 space-y-2">
            <SlotRow
              label="Autosave"
              meta={bySlot(AUTOSAVE_SLOT)}
              busy={busy}
              onLoad={() => doLoad(AUTOSAVE_SLOT)}
              onDelete={() => doDelete(AUTOSAVE_SLOT)}
            />
            {NAMED_SLOTS.map((slot) => (
              <SlotRow
                key={slot}
                label={`Slot ${slot}`}
                meta={bySlot(slot)}
                busy={busy}
                onSave={() => doSave(slot)}
                onLoad={() => doLoad(slot)}
                onDelete={() => doDelete(slot)}
              />
            ))}
          </div>

          {status && (
            <p
              className={`mt-3 text-small ${
                status.tone === 'error'
                  ? 'text-oxblood-300'
                  : status.tone === 'warn'
                    ? 'text-brass-300'
                    : 'text-verdigris-400'
              }`}
              role="status"
            >
              {status.text}
            </p>
          )}
        </div>

        {/* --- Account ------------------------------------------------ */}
        <div className="border-t border-ink-400 px-5 py-4">
          <h3 className="text-label uppercase tracking-wider text-content-muted">
            Account
          </h3>

          {!isSupabaseConfigured() ? (
            <p className="mt-1.5 max-w-prose text-small text-content-secondary">
              {cloudUnavailableReason()}
            </p>
          ) : signedInAs ? (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={sync}
                disabled={busy}
                className="rounded-card border border-ink-400 px-3 py-1.5 text-small text-content-secondary hover:bg-ink-500"
              >
                Sync this browser&apos;s saves up
              </button>
              <button
                type="button"
                onClick={signOut}
                disabled={busy}
                className="rounded-card border border-ink-400 px-3 py-1.5 text-small text-content-secondary hover:bg-ink-500"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <p className="text-small text-content-secondary">
                Sign in to keep your games across devices. We send a link — no
                password.
              </p>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 rounded border border-ink-400 bg-ink-800 px-2 py-1.5 text-body text-content-primary"
                />
                <button
                  type="button"
                  onClick={signIn}
                  disabled={busy || !email.trim()}
                  className="rounded-card border border-brass-400 px-3 py-1.5 text-small text-brass-300 hover:bg-brass-400 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-400 disabled:text-content-disabled"
                >
                  Send link
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SlotRow({
  label,
  meta,
  busy,
  onSave,
  onLoad,
  onDelete,
}: {
  label: string;
  meta: SaveMeta | undefined;
  busy: boolean;
  onSave?: () => void;
  onLoad: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-ink-400 bg-ink-600 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-body text-content-primary">{label}</p>
        {meta ? (
          <p className="text-small text-content-muted">
            <span className="tabular">{formatLongDate(meta.inGameDay)}</span>
            {' · '}
            {meta.rulerName}
            {' · '}
            {meta.governmentType}
            {' · saved '}
            <span className="tabular">
              {new Date(meta.updatedAt).toLocaleString()}
            </span>
          </p>
        ) : (
          <p className="text-small text-content-muted">Empty</p>
        )}
      </div>

      {onSave && (
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="rounded border border-ink-400 px-2 py-1 text-small text-content-secondary hover:bg-ink-500"
        >
          Save
        </button>
      )}
      <button
        type="button"
        onClick={onLoad}
        disabled={busy || !meta}
        className="rounded border border-ink-400 px-2 py-1 text-small text-content-secondary hover:bg-ink-500 disabled:cursor-not-allowed disabled:text-content-disabled"
      >
        Load
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy || !meta}
        className="rounded border border-ink-400 px-2 py-1 text-small text-content-muted hover:text-oxblood-300 disabled:cursor-not-allowed disabled:text-content-disabled"
      >
        Delete
      </button>
    </div>
  );
}
