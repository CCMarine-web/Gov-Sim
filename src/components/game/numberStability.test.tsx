// @vitest-environment jsdom

/**
 * NUMBER STABILITY — the regression test for the flicker.
 *
 * Phase 2 brief §0.1: numbers visibly flickered and dropped out while the clock
 * ran. That was reported by eye and could not be reproduced by any test, which
 * is exactly the failure this file exists to close.
 *
 * It drives the REAL game loop against a REAL DOM under a controlled clock and
 * asserts three things a player would notice:
 *
 *   1. No value ever drops out — never empty, never "NaN", never "undefined".
 *   2. Commits stay within the 4/second publication budget, at every speed,
 *      including uncapped.
 *   3. Displayed values change only when the published state changes, and never
 *      oscillate between two values within a single publication.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { PHASE_1_CONTENT } from '@/content';
import * as loop from '@/runtime/gameLoop';
import { useGameStore } from '@/store/gameStore';
import { CommandBar } from './CommandBar';
import { TreasuryPanel } from './TreasuryPanel';
import {
  createRenderCounter,
  installFakeClock,
  readStats,
  type FakeClock,
} from './testHarness';

let clock: FakeClock | null = null;

afterEach(() => {
  cleanup();
  loop.destroy();
  clock?.restore();
  clock = null;
  vi.useRealTimers();
});

function startGame(): void {
  loop.startNewGame(
    {
      governmentType: 'republic',
      rulerName: 'George Washington',
      houseName: 'No Party',
      seed: 12345,
      gameId: 'stability-test',
      createdAtISO: '1789-04-30T00:00:00.000Z',
      contentVersion: PHASE_1_CONTENT.version,
    },
    PHASE_1_CONTENT,
  );
}

describe('displayed numbers under a running clock', () => {
  it('never renders an empty, NaN or undefined value', () => {
    clock = installFakeClock();
    startGame();

    const { container } = render(<CommandBar />);
    loop.setSpeed(2);
    loop.start();

    const seen: Array<Record<string, string>> = [];
    for (let i = 0; i < 240; i++) {
      clock.advance(16);
      seen.push(readStats(container));
    }

    expect(seen.length).toBeGreaterThan(0);

    for (const frame of seen) {
      // The command bar renders seven stats — Treasury, Debt, Capital,
      // Stability, Legitimacy, Population, GDP. A frame missing any of them is
      // a number that dropped out. The count is asserted rather than a subset
      // checked, so a stat losing its label (and colliding on the empty key)
      // fails here rather than passing quietly.
      expect(Object.keys(frame).length).toBe(7);
      for (const [label, value] of Object.entries(frame)) {
        expect(value, `${label} was blank`).not.toBe('');
        expect(value, `${label} showed NaN`).not.toMatch(/NaN/);
        expect(value, `${label} showed undefined`).not.toMatch(/undefined/);
        expect(value, `${label} showed Infinity`).not.toMatch(/Infinity/);
      }
    }
  });

  it('commits no more often than the publication throttle allows', () => {
    clock = installFakeClock();
    startGame();

    const counter = createRenderCounter('command-bar');
    render(
      <counter.Wrapper>
        <CommandBar />
      </counter.Wrapper>,
    );

    loop.setSpeed(2);
    loop.start();
    counter.reset();

    // Four seconds of wall time at 60fps: 240 frames, ~8 in-game days.
    clock.advance(4_000, 16);

    // The ceiling is 4 publications per second. Each publication may cost more
    // than one commit (the store is written twice: snapshot, then clock), so
    // the budget is stated per publication rather than per commit.
    const publications = Math.ceil(4_000 / loop.PUBLISH_INTERVAL_MS);
    expect(counter.count()).toBeLessThanOrEqual(publications * 2);
  });

  it('holds the publication ceiling at the uncapped top speed', () => {
    clock = installFakeClock();
    startGame();

    const counter = createRenderCounter('uncapped');
    render(
      <counter.Wrapper>
        <CommandBar />
      </counter.Wrapper>,
    );

    loop.setSpeed(5);
    loop.start();
    counter.reset();

    clock.advance(4_000, 16);

    const publications = Math.ceil(4_000 / loop.PUBLISH_INTERVAL_MS);
    expect(counter.count()).toBeLessThanOrEqual(publications * 2);
  });

  it('changes a displayed value only when the published snapshot changes', () => {
    clock = installFakeClock();
    startGame();

    const { container } = render(<CommandBar />);
    loop.setSpeed(2);
    loop.start();

    /*
      The invariant is against the PUBLISHED snapshot, not the authoritative
      state. The loop deliberately runs ahead of what the UI has been told
      (DESIGN.md §6.2), so a display catching up one frame after the engine
      moved is correct behaviour, not flicker. What would be flicker is a
      rendered value changing while the snapshot the UI was given stood still —
      that is a render that is not a pure function of its input.
    */
    let lastSnapshot = useGameStore.getState().snapshot;
    let lastValues = '';
    let changesWithoutAPublish = 0;

    for (let i = 0; i < 300; i++) {
      clock.advance(16);
      const snapshot = useGameStore.getState().snapshot;
      const values = JSON.stringify(readStats(container));

      if (snapshot === lastSnapshot && lastValues !== '' && values !== lastValues) {
        changesWithoutAPublish += 1;
      }
      lastSnapshot = snapshot;
      lastValues = values;
    }

    expect(changesWithoutAPublish).toBe(0);
  });
});

// ============================================================================
// THE TREASURY PROJECTION — the defect this file was written for
// ============================================================================

/** Mirrors how GameShell feeds the panel: straight from the published store. */
function LiveTreasury() {
  const snapshot = useGameStore((s) => s.snapshot);
  if (!snapshot) return null;
  return <TreasuryPanel state={snapshot} />;
}

/** Every projection figure currently on screen, in DOM order. */
function readProjection(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-projection-value]')].map((n) =>
    (n.textContent ?? '').trim(),
  );
}

describe('the Treasury projection under a running clock', () => {
  /**
   * The regression test for D-011.
   *
   * Before the fix this failed on the very first publish: the projection was
   * keyed on the identity of the published state object, which changes four
   * times a second, so every figure blanked to an em-dash and returned 180ms
   * later, four times a second, for as long as the clock ran.
   */
  it('never blanks a figure while the clock runs', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    clock = installFakeClock();
    startGame();

    const { container } = render(<LiveTreasury />);

    // Let the first projection land before the clock starts, the same way a
    // player arrives on the screen before pressing play.
    act(() => { vi.advanceTimersByTime(500); });

    const initial = readProjection(container);
    expect(initial.length).toBeGreaterThan(0);
    expect(initial).not.toContain('—');

    loop.setSpeed(5);
    loop.start();

    const blankFrames: number[] = [];
    for (let i = 0; i < 600; i++) {
      clock.advance(16);
      act(() => { vi.advanceTimersByTime(16); });

      const values = readProjection(container);
      if (values.length !== initial.length || values.includes('—')) {
        blankFrames.push(i);
      }
    }

    expect(
      blankFrames.length,
      `projection figures blanked on ${blankFrames.length} of 600 frames`,
    ).toBe(0);
  });

  /**
   * The other half of the same defect: the cost.
   *
   * Each recompute is two 365-day forward simulations. Doing that on every
   * publish is 2,920 simulated days per second of wall time, on the main
   * thread — which is what made the game feel broken quite apart from the
   * flicker.
   */
  it('recomputes only when the projection basis actually changes', async () => {
    const projection = await import('@/sim/projection');
    const spy = vi.spyOn(projection, 'comparePolicies');

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    clock = installFakeClock();
    startGame();

    const { container } = render(<LiveTreasury />);
    act(() => { vi.advanceTimersByTime(500); });
    expect(readProjection(container).length).toBeGreaterThan(0);

    spy.mockClear();
    loop.setSpeed(5);
    loop.start();

    // Ten seconds of wall time at 5 days/second: fifty in-game days, so at most
    // two month boundaries and therefore at most a handful of legitimate
    // re-bases. Forty publications happen in the same span.
    for (let i = 0; i < 600; i++) {
      clock.advance(16);
      act(() => { vi.advanceTimersByTime(16); });
    }

    expect(
      spy.mock.calls.length,
      'the projection re-simulated far more often than its basis changed',
    ).toBeLessThanOrEqual(4);

    spy.mockRestore();
  });
});
