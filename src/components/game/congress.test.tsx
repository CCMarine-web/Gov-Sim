// @vitest-environment jsdom

/**
 * THE REPUBLIC PATH ON SCREEN
 *
 * Phase 2 brief §2.2. The central interface requirement, in the brief's words:
 *
 *   "Vote resolution must be transparent and inspectable. Before committing to
 *    introduce a bill, the player sees a projected whip count broken down by
 *    party and by region, with each bloc's reasoning visible."
 *
 * So these assert the whip count is on the bill card, that opening it shows
 * every delegation with the reasons behind its vote, and that the tools for
 * changing the count are there with their prices on them.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { isoToDay } from '@/sim/calendar';
import { createTestGame } from '@/sim/createGame';
import type { GameState } from '@/sim/types';
import { CongressPanel } from './CongressPanel';
import { LegislationPanel } from './LegislationPanel';

afterEach(cleanup);

function republic(day = isoToDay('1795-01-01'), capital = 900): GameState {
  const base = createTestGame({ governmentType: 'republic' });
  return {
    ...base,
    day,
    flags: { ...base.flags, assumption_passed: true },
    politicalCapital: { ...base.politicalCapital, current: capital, cap: capital },
  };
}

function monarchy(day = isoToDay('1795-01-01')): GameState {
  const base = createTestGame({ governmentType: 'monarchy' });
  return {
    ...base,
    day,
    politicalCapital: { ...base.politicalCapital, current: 900, cap: 900 },
  };
}

function whip(container: HTMLElement, billId: string): HTMLElement | null {
  return container.querySelector(`[data-whip-count="${billId}"]`);
}

describe('the whip count is on the card, before the player commits', () => {
  it('shows a projected division for a republic', () => {
    const { container } = render(<LegislationPanel state={republic()} />);
    const panel = whip(container, 'carriage_duty_1794');

    expect(panel).not.toBeNull();
    expect(panel!.textContent).toContain('Projected division');
    expect(panel!.textContent).toMatch(/Would (pass|fail)/);
  });

  it('breaks the count into House and Senate', () => {
    const { container } = render(<LegislationPanel state={republic()} />);
    const panel = whip(container, 'carriage_duty_1794')!;

    // A bill must carry both, so showing one would be showing half the answer.
    expect(panel.textContent).toContain('House');
    expect(panel.textContent).toContain('Senate');
    expect(panel.textContent).toMatch(/for ·/);
    expect(panel.textContent).toContain('undecided');
  });

  it('shows nothing of the kind to a monarchy, which has no vote', () => {
    const { container } = render(<LegislationPanel state={monarchy()} />);
    expect(whip(container, 'carriage_duty_1794')).toBeNull();
  });

  it('opens to show every delegation and the reasons behind its vote', () => {
    const { container } = render(<LegislationPanel state={republic()} />);
    const panel = whip(container, 'carriage_duty_1794')!;

    const toggle = [...panel.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Show every delegation'),
    )!;
    fireEvent.click(toggle);

    // Grouped by region, because the sectional pattern is the thing worth
    // seeing: a bill that carries the north and loses the south looks quite
    // different from one that splits every region evenly.
    expect(panel.textContent).toContain('new england');
    expect(panel.textContent).toContain('south');
    // A state, a verdict, and reasons.
    expect(panel.textContent).toContain('VA');
    expect(panel.textContent).toMatch(/seats/);
    expect(panel.textContent).toMatch(/sees its people/);
  });
});

describe('the player has tools, and their prices are on them', () => {
  it('offers whipping, riders and promises for each party', () => {
    const { container } = render(<LegislationPanel state={republic()} />);
    const panel = whip(container, 'carriage_duty_1794')!;

    expect(panel.textContent).toContain('Bring them round');
    expect(panel.textContent).toMatch(/Whip Fed\./);
    expect(panel.textContent).toMatch(/Rider for/);
    expect(panel.textContent).toMatch(/Promise/);
  });

  it('states the added cost as soon as a tactic is chosen', () => {
    const { container } = render(<LegislationPanel state={republic()} />);
    const panel = whip(container, 'carriage_duty_1794')!;

    const rider = [...panel.querySelectorAll('button')].find((b) =>
      b.textContent?.startsWith('Rider for'),
    )!;
    fireEvent.click(rider);

    expect(panel.textContent).toContain('political capital');
    // Spent whether the bill carries or not — a player must know that first.
    expect(panel.textContent).toContain('whether the bill carries or not');
  });

  it('warns that a promise comes due later, at more than it cost', () => {
    const { container } = render(<LegislationPanel state={republic()} />);
    const panel = whip(container, 'carriage_duty_1794')!;

    const promise = [...panel.querySelectorAll('button')].find((b) =>
      b.textContent?.startsWith('Promise'),
    )!;
    fireEvent.click(promise);

    expect(panel.textContent).toContain('comes due later');
    expect(panel.textContent).toContain('twice what it cost');
  });

  it('moves the projected count when a tactic is applied', () => {
    const { container } = render(<LegislationPanel state={republic()} />);
    const panel = whip(container, 'carriage_duty_1794')!;

    const before = panel.textContent ?? '';

    const rider = [...panel.querySelectorAll('button')].find((b) =>
      b.textContent?.startsWith('Rider for'),
    )!;
    fireEvent.click(rider);

    expect(panel.textContent).not.toBe(before);
  });
});

describe('the Congress screen', () => {
  it('shows both chambers with their historical seat totals', () => {
    const { container } = render(<CongressPanel state={createTestGame()} />);

    expect(container.querySelector('[data-chamber="house"]')).not.toBeNull();
    expect(container.querySelector('[data-chamber="senate"]')).not.toBeNull();
    // Eleven states had ratified on 30 April 1789: 59 of the 65 seats.
    expect(container.textContent).toContain('59 seats');
    expect(container.textContent).toContain('22 seats');
  });

  it('explains why the Senate does not match the House', () => {
    const { container } = render(<CongressPanel state={createTestGame()} />);
    const note = container.querySelector('[data-testid="senate-classes"]')!;

    // Otherwise a player reads two different party splits off one country and
    // concludes the screen is broken.
    expect(note.textContent).toContain('a third of the Senate');
    expect(note.textContent).toContain('Article I §3');
    // And it belongs to the Senate column, not floating loose.
    expect(container.querySelector('[data-chamber="senate"]')!.contains(note)).toBe(
      true,
    );
  });

  it('says plainly which figures are history and which are a model', () => {
    const { container } = render(<CongressPanel state={createTestGame()} />);

    // The seat counts are cited; the party split is not, and the screen says so
    // rather than letting the player assume otherwise. (DESIGN.md §12.2)
    expect(container.textContent).toContain('Seat counts are historical');
    expect(container.textContent).toContain('The party split is a model');
    expect(container.textContent).toContain('1 Stat. 253');
  });

  it('describes each interest by whose side it takes', () => {
    const { container } = render(<CongressPanel state={createTestGame()} />);

    expect(container.querySelector('[data-party="pro_administration"]')).not.toBeNull();
    expect(container.textContent).toContain('Speaks for the');
    expect(container.textContent).toContain('Set against the');
    // And notes that the early interests were not disciplined parties.
    expect(container.textContent).toContain('members vote their state, not a line');
  });

  it('tells a monarchy why it is looking at a legislature it does not need', () => {
    const { container } = render(<CongressPanel state={monarchy()} />);

    expect(container.textContent).toContain('The legislature you do not need');
    expect(container.textContent).toContain('rule by decree');
    expect(container.textContent).toContain('grievance you are accumulating');
  });

  it('reports the government’s record in the house', () => {
    const clean = render(<CongressPanel state={createTestGame()} />);
    expect(clean.container.textContent).toContain('No bill of yours has yet been voted down');
    cleanup();

    const base = createTestGame();
    const bruised: GameState = {
      ...base,
      congress: { ...base.congress, defeats: 3 },
    };
    const { container } = render(<CongressPanel state={bruised} />);

    expect(container.textContent).toContain('lost 3 divisions');
    expect(container.textContent).toContain('costs more standing than the last');
  });

  it('lists outstanding promises with what they will cost', () => {
    const base = createTestGame();
    const owing: GameState = {
      ...base,
      congress: {
        ...base.congress,
        obligations: [
          {
            id: 'obligation:test',
            party: 'anti_administration',
            forBillId: 'some_bill',
            incurredDay: 10,
            dueDay: 550,
            cost: 16,
            settledDay: null,
          },
        ],
      },
    };

    const { container } = render(<CongressPanel state={owing} />);
    const panel = container.querySelector('[data-testid="obligations"]')!;

    expect(panel.textContent).toContain('Anti-Adm.');
    expect(panel.textContent).toContain('16');
    expect(container.textContent).toContain('what your word is worth');
  });
});
