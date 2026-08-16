// @vitest-environment jsdom

/**
 * THE MONARCHY PATH ON SCREEN
 *
 * Phase 2 brief §2.1. Two things the interface owes a player governing by
 * decree, asserted against the rendered DOM:
 *
 *   1. THE FULL PRICE, BEFORE COMMITTING. A decree is cheap in political
 *      capital and dear in legitimacy and grievance. Showing only the capital
 *      would misrepresent the choice entirely.
 *   2. THE WARNING, BEFORE THE RISING. Grievance is visible on the Regions
 *      screen, by region and by bloc, long before it costs anything — so it
 *      should be impossible to be surprised by a revolt.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { isoToDay } from '@/sim/calendar';
import { createTestGame } from '@/sim/createGame';

/** The founding distribution of the blocs. Grievance lands on regions through it. */
const W = blocWeights(createTestGame());

import { blocWeights } from '@/sim/blocs';
import { emptyGrievance, regionalGrievance, reconcileUnrest } from '@/sim/grievance';
import type { GameState } from '@/sim/types';
import { GovernmentPanel } from './GovernmentPanel';
import { LegislationPanel } from './LegislationPanel';
import { Regions } from './sections';

afterEach(cleanup);

function ready(governmentType: 'monarchy' | 'republic'): GameState {
  const base = createTestGame({ governmentType });
  return {
    ...base,
    day: isoToDay('1798-06-01'),
    politicalCapital: { ...base.politicalCapital, current: 900, cap: 900 },
  };
}

function card(container: HTMLElement, billId: string): HTMLElement {
  return container.querySelector(`[data-bill-id="${billId}"]`) as HTMLElement;
}

describe('a decree states its full price', () => {
  it('shows the legitimacy and grievance a crown will spend', () => {
    const { container } = render(<LegislationPanel state={ready('monarchy')} />);
    const node = card(container, 'direct_tax_1798');

    expect(node.textContent).toContain('Legitimacy');
    expect(node.textContent).toContain('Grievance');
    expect(node.textContent).toContain('No vote is required');
  });

  it('shows neither on the republican path', () => {
    const { container } = render(<LegislationPanel state={ready('republic')} />);
    const node = card(container, 'direct_tax_1798');

    expect(node.textContent).not.toContain('No vote is required');
    expect(node.textContent).toContain('Political capital');
  });

  it('quotes a lower capital price to the crown than to the legislature', () => {
    const asKing = render(<LegislationPanel state={ready('monarchy')} />);
    const kingText = card(asKing.container, 'direct_tax_1798').textContent ?? '';
    cleanup();

    const asPresident = render(<LegislationPanel state={ready('republic')} />);
    const presidentText =
      card(asPresident.container, 'direct_tax_1798').textContent ?? '';

    const capitalOf = (text: string) =>
      Number(text.match(/Political capital\s*([\d.]+)/)?.[1] ?? '0');

    expect(capitalOf(kingText)).toBeGreaterThan(0);
    expect(capitalOf(kingText)).toBeLessThan(capitalOf(presidentText));
  });
});

describe('grievance is visible before it bites', () => {
  function aggrieved(byBloc: Record<string, number>): GameState {
    const base = createTestGame({ governmentType: 'monarchy' });
    return {
      ...base,
      grievance: {
        ...emptyGrievance(),
        byBloc,
        byRegion: regionalGrievance(byBloc, W),
      },
    };
  }

  it('shows nothing at all when nobody resents the government', () => {
    const { container } = render(<Regions state={createTestGame()} />);
    // An always-present zero would train the player to stop looking at it.
    expect(container.querySelector('[data-region-grievance]')).toBeNull();
  });

  it('appears in the region where the aggrieved bloc actually is', () => {
    const { container } = render(<Regions state={aggrieved({ planters: 60 })} />);

    const south = container.querySelector('[data-region-grievance="south"]');
    expect(south).not.toBeNull();
    // And names who is behind it — "the South is unhappy" is much less useful.
    expect(south!.textContent).toContain('planters');
  });

  it('names the severity in words, never by colour alone', () => {
    const base = aggrieved({ planters: 95, small_farmers: 70 });
    const withUnrest: GameState = {
      ...base,
      grievance: reconcileUnrest(base.grievance, base.day, W).grievance,
    };

    const { container } = render(<Regions state={withUnrest} />);
    const south = container.querySelector('[data-region-grievance="south"]')!;

    expect(south.textContent).toMatch(
      /Quiet non-payment|Open defiance|In arms/,
    );
  });
});

describe('the succession outlook is stated, and it is the player’s doing', () => {
  it('says the succession is settled while the dynasty is secure', () => {
    const { container } = render(
      <GovernmentPanel state={createTestGame({ governmentType: 'monarchy' })} />,
    );
    const outlook = container.querySelector('[data-testid="succession-outlook"]')!;

    expect(outlook.textContent).toContain('settled');
    expect(outlook.textContent).toContain('without argument');
  });

  it('warns when the crown has spent its standing', () => {
    const base = createTestGame({ governmentType: 'monarchy' });
    const spent: GameState = { ...base, ruler: { ...base.ruler, heirName: null } };

    const { container } = render(<GovernmentPanel state={spent} />);
    const outlook = container.querySelector('[data-testid="succession-outlook"]')!;

    // The warning has to say what would follow, not merely that something is
    // wrong.
    expect(outlook.textContent).toContain('crisis rather than a transfer');
  });

  it('shows the republic a different account entirely', () => {
    const { container } = render(
      <GovernmentPanel state={createTestGame({ governmentType: 'republic' })} />,
    );

    expect(container.querySelector('[data-testid="succession-outlook"]')).toBeNull();
    expect(container.textContent).toContain('Elections are held');
  });

  it('counts predecessors once the crown has passed', () => {
    const base = createTestGame({ governmentType: 'monarchy' });
    const successor: GameState = {
      ...base,
      ruler: { ...base.ruler, name: 'A Second King', reignNumber: 1, accededDay: 900 },
    };

    const { container } = render(<GovernmentPanel state={successor} />);
    expect(container.textContent).toContain('1 predecessor');
    expect(container.textContent).toContain('A Second King');
  });
});

describe('unrest reaches the crisis list, named and explained', () => {
  it('names the region and the bloc behind a rising', async () => {
    const { currentCrises } = await import('@/sim/narrative');

    const base = createTestGame({ governmentType: 'monarchy' });
    const byBloc = { planters: 100, small_farmers: 90 };
    const state: GameState = {
      ...base,
      grievance: reconcileUnrest(
        { ...emptyGrievance(), byBloc, byRegion: regionalGrievance(byBloc, W) },
        base.day,
        W,
      ).grievance,
    };

    const crises = currentCrises(state);
    expect(crises.some((c) => c.includes('South'))).toBe(true);
    // A player who can see only that the South is unhappy cannot tell whether
    // to conciliate the planters or the small farmers.
    expect(crises.some((c) => c.includes('planters') || c.includes('small farmers')))
      .toBe(true);
  });

  it('keeps ordinary grievance out of the crisis list', async () => {
    const { currentCrises } = await import('@/sim/narrative');

    // Real but mild: below every unrest threshold, so no episode opens.
    const base = createTestGame({ governmentType: 'monarchy' });
    const byBloc = { planters: 20 };
    const grieved: GameState = {
      ...base,
      grievance: { ...emptyGrievance(), byBloc, byRegion: regionalGrievance(byBloc, W) },
    };

    // A crisis list that included every complaint would stop being a crisis
    // list. Mild grievance belongs on the Regions screen, as a warning.
    expect(grieved.grievance.byRegion.south).toBeGreaterThan(0);
    expect(currentCrises(grieved)).toEqual(currentCrises(base));
  });
});

/**
 * WHO LIVES HERE — the bloc panel on the Regions screen
 *
 * Phase 2 brief §1, queue item 8. The requirement is that blocs "grow and
 * shrink in response to policy, not just get happier or angrier", and that is
 * only real if the player can watch it happen.
 */
describe('the Regions screen says who a region is made of', () => {
  it('lists the blocs with their shares', () => {
    const { container } = render(<Regions state={createTestGame()} />);
    const panel = container.querySelector('[data-region-blocs="south"]')!;

    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain('Who lives here');
    expect(panel.querySelector('[data-bloc="planters"]')).not.toBeNull();
    expect(panel.querySelector('[data-bloc="small_farmers"]')).not.toBeNull();
  });

  it('explains why the shares do not add up to a hundred', () => {
    const { container } = render(<Regions state={createTestGame()} />);
    const note = container.querySelector('[data-testid="bloc-note-frontier"]')!;

    // People belong to more than one at once. Without saying so, the first
    // thing a careful player does is add the column up and conclude the screen
    // is broken.
    expect(note.textContent).toContain('more than one of these at once');
  });

  it('says plainly that a third of the South belonged to none of them', () => {
    const { container } = render(<Regions state={createTestGame()} />);
    const note = container.querySelector('[data-testid="bloc-note-south"]')!;

    // The model does not round the enslaved into a bloc to make a column tidy.
    expect(note.textContent).toContain('enslaved');
    expect(note.textContent).toContain('no political interest at all');
    // And New England, where the figure is negligible, is not told the same.
    const quiet = container.querySelector('[data-testid="bloc-note-new_england"]')!;
    expect(quiet.textContent).not.toContain('enslaved');
  });

  it('marks a bloc that is growing with a word, never colour alone', () => {
    const base = createTestGame();
    const grown: GameState = {
      ...base,
      blocs: {
        ...base.blocs,
        membership: {
          ...base.blocs.membership,
          mid_atlantic: {
            ...base.blocs.membership.mid_atlantic,
            artisans: base.blocs.membership.mid_atlantic.artisans * 1.4,
          },
        },
      },
    };

    const { container } = render(<Regions state={grown} />);
    const change = container.querySelector('[data-bloc-change="artisans"]')!;

    expect(change).not.toBeNull();
    expect(change.textContent).toContain('growing');
    expect(change.textContent).toContain('since 1789');
  });

  it('says nothing about movement in a country that has not moved', () => {
    const { container } = render(<Regions state={createTestGame()} />);
    // An always-present "unchanged" would train the player to stop looking.
    expect(container.querySelector('[data-bloc-change]')).toBeNull();
  });
});
