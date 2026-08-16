/**
 * COMPONENT TEST HARNESS
 *
 * Drives the real game loop against a real DOM under a controlled clock, so
 * that "the numbers flicker" becomes something a test can assert rather than
 * something only a human watching the screen can see.
 *
 * WHY A FAKE CLOCK AND A FAKE rAF
 * The loop's whole design is about time: a `requestAnimationFrame` accumulator
 * feeding a 250ms publication throttle (DESIGN.md §6.2). Testing it against the
 * real clock would be flaky and slow. Here the clock is a variable and frames
 * are pumped by hand, so a test can say "advance 4 seconds of wall time in 16ms
 * frames" and get exactly that, deterministically.
 *
 * This file is test infrastructure. It is not imported by the application.
 */

import { Profiler, type ReactNode } from 'react';
import { act } from '@testing-library/react';

// ============================================================================
// CLOCK AND FRAMES
// ============================================================================

export interface FakeClock {
  /** Current fake wall-clock time in ms. */
  nowMs: () => number;
  /**
   * Advance the clock by `ms`, delivering frames every `frameMs`.
   * Returns the number of frames delivered.
   */
  advance: (ms: number, frameMs?: number) => number;
  restore: () => void;
}

type FrameCallback = (t: number) => void;

/**
 * Install a controllable `performance.now` and `requestAnimationFrame`.
 *
 * Both are installed on `globalThis`, which is what the loop reads.
 */
export function installFakeClock(startMs = 1_000): FakeClock {
  let clock = startMs;
  let nextId = 1;
  const pending = new Map<number, FrameCallback>();

  const realPerformance = globalThis.performance;
  const realRaf = globalThis.requestAnimationFrame;
  const realCancel = globalThis.cancelAnimationFrame;

  Object.defineProperty(globalThis, 'performance', {
    configurable: true,
    writable: true,
    value: { ...realPerformance, now: () => clock },
  });

  globalThis.requestAnimationFrame = ((cb: FrameCallback): number => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  }) as typeof globalThis.requestAnimationFrame;

  globalThis.cancelAnimationFrame = ((id: number): void => {
    pending.delete(id);
  }) as typeof globalThis.cancelAnimationFrame;

  return {
    nowMs: () => clock,
    advance(ms: number, frameMs = 16): number {
      const frames = Math.max(1, Math.round(ms / frameMs));
      for (let i = 0; i < frames; i++) {
        clock += frameMs;
        // Snapshot and clear: a callback that re-registers must run on the
        // NEXT pumped frame, not recurse inside this one.
        const due = [...pending.entries()];
        pending.clear();
        act(() => {
          for (const [, cb] of due) cb(clock);
        });
      }
      return frames;
    },
    restore() {
      Object.defineProperty(globalThis, 'performance', {
        configurable: true,
        writable: true,
        value: realPerformance,
      });
      globalThis.requestAnimationFrame = realRaf;
      globalThis.cancelAnimationFrame = realCancel;
    },
  };
}

// ============================================================================
// RENDER COUNTING
// ============================================================================

export interface RenderCounter {
  /** Commits React actually performed for the wrapped subtree. */
  count: () => number;
  reset: () => void;
  Wrapper: (props: { children: ReactNode }) => ReactNode;
}

/**
 * Count React commits for a subtree.
 *
 * `Profiler` fires once per COMMIT, which is the thing that matters: a commit
 * is what can repaint, and therefore what can be seen to flicker. Counting
 * function invocations instead would over-report, because React may render a
 * component without committing.
 */
export function createRenderCounter(id = 'probe'): RenderCounter {
  let commits = 0;

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Profiler id={id} onRender={() => { commits += 1; }}>
        {children}
      </Profiler>
    );
  }

  return {
    count: () => commits,
    reset: () => { commits = 0; },
    Wrapper,
  };
}

// ============================================================================
// READING NUMBERS OFF THE SCREEN
// ============================================================================

/**
 * Every value rendered through `<Stat>`, keyed by its label.
 *
 * Reads the DOM the way a player reads the screen: if a number is missing,
 * blank, or has been replaced by a placeholder, it shows up here as such
 * rather than being papered over by reading component state instead.
 */
export function readStats(container: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of container.querySelectorAll('[data-stat-label]')) {
    const label = node.getAttribute('data-stat-label') ?? '';
    out[label] = (node.getAttribute('data-stat-value') ?? '').trim();
  }
  return out;
}
