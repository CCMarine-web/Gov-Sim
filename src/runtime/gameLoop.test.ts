import { beforeEach, describe, expect, it } from 'vitest';
import { PHASE_1_CONTENT } from '@/content';
import { useGameStore } from '@/store/gameStore';
import {
  answerDecision,
  destroy,
  drainAccumulator,
  getGameState,
  isRunning,
  loadGame,
  msPerDayAt,
  pause,
  setSpeed,
  start,
  startNewGame,
  stepForTesting,
  toggle,
} from './gameLoop';
import {
  SPEEDS,
  SPEED_TABLE,
  isUncapped,
  realMinutesFor,
} from './speeds';

const NEW_GAME = {
  governmentType: 'republic' as const,
  rulerName: 'George Washington',
  houseName: 'Federalist',
  seed: 20260815,
  gameId: 'loop-test',
  createdAtISO: '1789-04-30T00:00:00.000Z',
  contentVersion: PHASE_1_CONTENT.version,
};

beforeEach(() => {
  destroy();
});

describe('the accumulator', () => {
  it('drains whole days and carries the remainder', () => {
    // 2,500ms at 1,000ms/day is two whole days with 500ms carried forward.
    expect(drainAccumulator(2_500, 1_000)).toEqual({
      days: 2,
      remainderMs: 500,
      discardedMs: 0,
    });
  });

  it('yields no days when less than one day has accumulated', () => {
    expect(drainAccumulator(999, 1_000)).toEqual({
      days: 0,
      remainderMs: 999,
      discardedMs: 0,
    });
  });

  it('keeps in-game time proportional to real time across uneven frames', () => {
    // Simulate a second of wall clock delivered in ragged chunks.
    let acc = 0;
    let total = 0;
    for (const delta of [16, 33, 8, 120, 4, 50, 200, 300, 269]) {
      acc += delta;
      const result = drainAccumulator(acc, 1_000);
      acc = result.remainderMs;
      total += result.days;
    }
    expect(total).toBe(1); // 1,000ms elapsed at 1x = exactly one day
  });

  /**
   * If the tab is backgrounded we must NOT simulate the whole gap on the first
   * frame back. That would freeze the tab and silently fast-forward past a
   * decision the player should have seen. In-game time is allowed to fall
   * behind; the simulation is never allowed to skip a day.
   */
  it('caps days per frame and reports what it discarded', () => {
    const result = drainAccumulator(30_000, 1_000, 10);
    expect(result.days).toBe(10);
    expect(result.discardedMs).toBe(20_000);
    expect(result.remainderMs).toBe(0);
  });

  it('rejects a non-positive day length rather than dividing by zero', () => {
    expect(() => drainAccumulator(1_000, 0)).toThrow(/positive/);
  });
});

/**
 * THE SPEED TABLE
 *
 * These assertions pin `src/runtime/speeds.ts` to the table published in
 * docs/DECISIONS.md D-016. They are the reason the five speeds cannot drift
 * apart from their documentation, and the reason a rebalance has to be a
 * deliberate act rather than something that happens by accident.
 */
describe('the speed table', () => {
  it('offers exactly five speeds, in order', () => {
    expect(SPEEDS).toEqual([1, 2, 3, 4, 5]);
  });

  it('puts 3x at five days a second — what Phase 1 shipped as 5x', () => {
    expect(msPerDayAt(3)).toBe(200);
    expect(SPEED_TABLE[3].daysPerSecond).toBe(5);
  });

  it('scales 1x and 2x proportionally below 3x', () => {
    expect(msPerDayAt(1)).toBe(600);
    expect(msPerDayAt(2)).toBe(300);

    // 1 : 2 : 3 exactly, in days per second. A control labelled 2x really does
    // run twice as fast as 1x.
    const rate = (s: 1 | 2 | 3) => 1000 / msPerDayAt(s);
    expect(rate(2)).toBeCloseTo(rate(1) * 2, 10);
    expect(rate(3)).toBeCloseTo(rate(1) * 3, 10);
  });

  it('makes 4x meaningfully faster than 3x, not marginally', () => {
    expect(msPerDayAt(4)).toBe(100);
    expect(1000 / msPerDayAt(4)).toBe(2 * (1000 / msPerDayAt(3)));
  });

  it('leaves 5x uncapped, with no rate at all', () => {
    expect(isUncapped(5)).toBe(true);
    expect(SPEED_TABLE[5].msPerDay).toBeNull();
    expect(SPEED_TABLE[5].daysPerSecond).toBeNull();

    // Asking a rate question about a rate-less speed is a bug in the caller,
    // and must not return a quiet 0 or Infinity to be divided by later.
    expect(() => msPerDayAt(5)).toThrow(/uncapped/);
  });

  it('is uncapped at 5x and only at 5x', () => {
    for (const speed of SPEEDS) {
      expect(isUncapped(speed)).toBe(speed === 5);
    }
  });

  it('means a full Phase 1 run takes about 43 minutes at 1x', () => {
    const minutes = realMinutesFor(1, 4_263)!;
    expect(minutes).toBeGreaterThan(42);
    expect(minutes).toBeLessThan(44);

    // ...and about a quarter of an hour at 3x, the new mid-setting.
    expect(realMinutesFor(3, 4_263)!).toBeCloseTo(14.21, 1);

    // Uncapped has no answer, because it depends on the machine.
    expect(realMinutesFor(5, 4_263)).toBeNull();
  });

  it('gives every speed a label and a description for the UI to render', () => {
    for (const speed of SPEEDS) {
      expect(SPEED_TABLE[speed].label).toBe(`${speed}x`);
      expect(SPEED_TABLE[speed].description.length).toBeGreaterThan(0);
    }
  });
});

describe('the store is a published snapshot, not the source of truth', () => {
  it('starts empty', () => {
    expect(useGameStore.getState().snapshot).toBeNull();
  });

  it('publishes immediately when a game is created', () => {
    startNewGame(NEW_GAME, PHASE_1_CONTENT);
    const snapshot = useGameStore.getState().snapshot;
    expect(snapshot).not.toBeNull();
    expect(snapshot!.day).toBe(0);
    expect(snapshot!.ruler.name).toBe('George Washington');
  });

  it('does not start the clock on its own', () => {
    startNewGame(NEW_GAME, PHASE_1_CONTENT);
    expect(isRunning()).toBe(false);
    expect(useGameStore.getState().clock.running).toBe(false);
  });

  it('publishes the advanced state after stepping', () => {
    startNewGame(NEW_GAME, PHASE_1_CONTENT);
    stepForTesting(10);
    expect(useGameStore.getState().snapshot!.day).toBe(10);
    expect(getGameState()!.day).toBe(10);
  });

  it('clears everything on destroy', () => {
    startNewGame(NEW_GAME, PHASE_1_CONTENT);
    destroy();
    expect(getGameState()).toBeNull();
    expect(useGameStore.getState().snapshot).toBeNull();
  });
});

describe('clock control', () => {
  beforeEach(() => {
    startNewGame(NEW_GAME, PHASE_1_CONTENT);
  });

  it('toggles between running and paused', () => {
    expect(isRunning()).toBe(false);
    toggle();
    expect(isRunning()).toBe(true);
    toggle();
    expect(isRunning()).toBe(false);
  });

  it('is idempotent: starting twice does not double-start', () => {
    start();
    start();
    expect(isRunning()).toBe(true);
    pause();
    expect(isRunning()).toBe(false);
  });

  it('pausing when already paused is harmless', () => {
    pause();
    pause();
    expect(isRunning()).toBe(false);
  });

  it('records speed changes in the store', () => {
    setSpeed(5);
    expect(useGameStore.getState().clock.speed).toBe(5);
    setSpeed(2);
    expect(useGameStore.getState().clock.speed).toBe(2);
  });
});

describe('decisions block time', () => {
  it('halts on the day a decision event fires', () => {
    startNewGame(NEW_GAME, PHASE_1_CONTENT);
    start();
    expect(isRunning()).toBe(true);

    // The first event triggers on 20 June 1790.
    stepForTesting(500);

    const snapshot = useGameStore.getState().snapshot!;
    expect(snapshot.eventState.pendingDecisions.length).toBeGreaterThan(0);
    expect(isRunning()).toBe(false);
  });

  it('reports the blocked state distinctly from a manual pause', () => {
    startNewGame(NEW_GAME, PHASE_1_CONTENT);
    stepForTesting(500);
    expect(useGameStore.getState().clock.blockedByDecision).toBe(true);
  });

  it('refuses to start while a decision is unanswered', () => {
    startNewGame(NEW_GAME, PHASE_1_CONTENT);
    stepForTesting(500);
    start();
    expect(isRunning()).toBe(false);
  });

  it('advances no further while blocked, however many steps are requested', () => {
    startNewGame(NEW_GAME, PHASE_1_CONTENT);
    stepForTesting(500);
    const blockedDay = getGameState()!.day;
    stepForTesting(100);
    expect(getGameState()!.day).toBe(blockedDay);
  });

  it('resumes only after the decision is answered, and stays paused', () => {
    startNewGame(NEW_GAME, PHASE_1_CONTENT);
    stepForTesting(500);

    const pending = getGameState()!.eventState.pendingDecisions[0];
    const event = PHASE_1_CONTENT.events.find((e) => e.id === pending.eventId)!;
    answerDecision(pending.eventId, event.options[0].id);

    expect(useGameStore.getState().snapshot!.eventState.pendingDecisions).toHaveLength(0);
    expect(useGameStore.getState().clock.blockedByDecision).toBe(false);
    // The player decides when time restarts, not the game.
    expect(isRunning()).toBe(false);

    start();
    expect(isRunning()).toBe(true);
  });

  it('records the choice in the published snapshot', () => {
    startNewGame(NEW_GAME, PHASE_1_CONTENT);
    stepForTesting(500);
    const pending = getGameState()!.eventState.pendingDecisions[0];
    const event = PHASE_1_CONTENT.events.find((e) => e.id === pending.eventId)!;

    answerDecision(pending.eventId, event.options[0].id);

    const chosen = useGameStore.getState().snapshot!.eventState.chosenOptions;
    expect(chosen[pending.eventId]).toBe(event.options[0].id);
  });
});

describe('loading a save', () => {
  it('adopts a state and publishes it without starting the clock', () => {
    startNewGame(NEW_GAME, PHASE_1_CONTENT);
    stepForTesting(100);
    const saved = JSON.parse(JSON.stringify(getGameState()));

    destroy();
    expect(useGameStore.getState().snapshot).toBeNull();

    loadGame(saved, PHASE_1_CONTENT);
    expect(useGameStore.getState().snapshot!.day).toBe(100);
    expect(isRunning()).toBe(false);
  });

  it('continues identically from a loaded save', () => {
    startNewGame(NEW_GAME, PHASE_1_CONTENT);
    stepForTesting(200);
    const reference = JSON.parse(JSON.stringify(getGameState()));

    destroy();
    startNewGame(NEW_GAME, PHASE_1_CONTENT);
    stepForTesting(100);
    const halfway = JSON.parse(JSON.stringify(getGameState()));

    destroy();
    loadGame(halfway, PHASE_1_CONTENT);
    stepForTesting(100);

    expect(getGameState()).toEqual(reference);
  });
});

describe('the engine state is not the store state', () => {
  /**
   * The store must never be the authoritative holder. If it were, every
   * simulated day would notify every subscriber, which at 5x is a re-render
   * storm across a dense UI. (DESIGN.md §6.2)
   */
  it('publishes a snapshot the store cannot use to mutate the engine', () => {
    startNewGame(NEW_GAME, PHASE_1_CONTENT);
    stepForTesting(5);

    const published = useGameStore.getState().snapshot!;
    const authoritative = getGameState()!;

    // Same content at this instant...
    expect(published.day).toBe(authoritative.day);

    // ...but advancing the engine does not retroactively change the snapshot
    // the UI already rendered.
    stepForTesting(5);
    expect(published.day).toBe(5);
    expect(getGameState()!.day).toBe(10);
  });
});
