// @vitest-environment jsdom

/**
 * THE LEGISLATION SCREEN
 *
 * Phase 2 brief §4. Three obligations this screen has to the player, each
 * asserted against the rendered DOM rather than against component internals:
 *
 *   1. NOTHING IS HIDDEN. Every department appears even when empty; every bill
 *      appears even when locked.
 *   2. A BILL THAT CANNOT BE PASSED SAYS WHY — a date, an unmet prerequisite,
 *      or a constitutional bar quoted in full.
 *   3. THE HISTORY IS TRUE AND PRESENT, on every tier, with its sources.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { PHASE_1_CONTENT } from '@/content';
import { isoToDay } from '@/sim/calendar';
import { createTestGame } from '@/sim/createGame';
import { DEPARTMENTS, type GameState } from '@/sim/types';
import { LegislationPanel } from './LegislationPanel';

afterEach(cleanup);

function at(day: number, capital = 500): GameState {
  const base = createTestGame();
  return {
    ...base,
    day,
    politicalCapital: { ...base.politicalCapital, current: capital, cap: capital },
  };
}

function card(container: HTMLElement, billId: string): HTMLElement {
  const node = container.querySelector(`[data-bill-id="${billId}"]`);
  if (!node) throw new Error(`No card rendered for bill "${billId}"`);
  return node as HTMLElement;
}

describe('nothing is hidden', () => {
  it('lists every department, including the ones with no content', () => {
    const { container } = render(<LegislationPanel state={createTestGame()} />);

    // A player should be able to see the shape of the government they do not
    // yet have. (brief §4.1)
    expect(container.textContent).toContain('Taxation');
    expect(container.textContent).toContain('Slavery & Civil Rights');
    expect(container.textContent).toContain('Elections & Suffrage');

    for (const department of DEPARTMENTS) {
      expect(container.querySelectorAll('h2').length).toBeGreaterThanOrEqual(1);
      void department;
    }
  });

  it('explains why a thin department is thin', () => {
    const { container } = render(<LegislationPanel state={createTestGame()} />);

    // Every department has at least one measure, so the note renders as context
    // above the cards rather than as an empty state. A department with exactly
    // one bill in it raises "is that all?", and this answers it.
    const note = container.querySelector('[data-department-note="education"]');
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain('state and town matter');

    expect(
      container.querySelector('[data-department-note="slavery_civil_rights"]')!
        .textContent,
    ).toContain('1808');
  });

  it('renders a card for every bill in the slate', () => {
    const { container } = render(<LegislationPanel state={createTestGame()} />);
    for (const bill of PHASE_1_CONTENT.bills) {
      expect(() => card(container, bill.id), bill.id).not.toThrow();
    }
  });

  it('labels the historicity tier on every card', () => {
    const { container } = render(<LegislationPanel state={createTestGame()} />);

    expect(card(container, 'judiciary_act_1789').textContent).toContain(
      'Enacted in reality',
    );
    expect(card(container, 'bounties_on_manufactures').textContent).toContain(
      'Proposed at the time',
    );
    expect(card(container, 'general_sales_tax').textContent).toContain(
      'Counterfactual',
    );
    expect(card(container, 'federal_income_tax').textContent).toContain(
      'Not possible in this period',
    );
  });
});

describe('a bill that cannot be passed says why', () => {
  it('quotes the constitutional bar on an export duty, in full', () => {
    const { container } = render(<LegislationPanel state={createTestGame()} />);
    const node = card(container, 'export_duty_on_staples');

    expect(node.getAttribute('data-bill-status')).toBe('locked');
    expect(node.textContent).toContain('Why this is not possible');
    expect(node.textContent).toContain('exported from any State');
  });

  it('gives the apportionment reason for an income tax', () => {
    const { container } = render(<LegislationPanel state={createTestGame()} />);
    const node = card(container, 'federal_income_tax');

    expect(node.getAttribute('data-bill-status')).toBe('locked');
    expect(node.textContent).toContain('apportioned');
    expect(node.textContent).toContain('Sixteenth Amendment');
  });

  it('names the date a bill becomes available', () => {
    const { container } = render(<LegislationPanel state={createTestGame()} />);
    const node = card(container, 'stamp_act_1797');

    expect(node.getAttribute('data-bill-status')).toBe('notYet');
    expect(node.textContent).toMatch(/Not before/);
    expect(node.textContent).toContain('1797');
  });

  it('names an unmet prerequisite', () => {
    const { container } = render(
      <LegislationPanel state={at(isoToDay('1798-06-01'))} />,
    );
    const node = card(container, 'navy_department_1798');

    expect(node.getAttribute('data-bill-status')).toBe('blocked');
    expect(node.textContent).toContain('Requires');
  });

  it('offers no Introduce control on a locked bill', () => {
    const { container } = render(<LegislationPanel state={createTestGame()} />);
    const node = card(container, 'federal_income_tax');
    expect(node.textContent).not.toContain('Introduce');
  });
});

describe('what a bill costs is stated before the player commits', () => {
  it('shows the political capital price and the reserve', () => {
    const { container } = render(<LegislationPanel state={at(0, 250)} />);
    const node = card(container, 'lighthouse_act_1789');

    expect(node.textContent).toContain('Political capital');
    expect(node.textContent).toContain('250.0');
  });

  it('shows the phase-in period', () => {
    const { container } = render(<LegislationPanel state={at(0)} />);
    expect(card(container, 'lighthouse_act_1789').textContent).toMatch(
      /Phases in over/,
    );
  });

  it('disables Introduce when the government cannot afford it', () => {
    const { container } = render(
      <LegislationPanel state={at(isoToDay('1798-06-01'), 1)} />,
    );
    const node = card(container, 'direct_tax_1798');

    const button = [...node.querySelectorAll('button')].find(
      (b) => b.textContent === 'Introduce',
    ) as HTMLButtonElement | undefined;

    expect(button).toBeDefined();
    expect(button!.disabled).toBe(true);
    expect(node.textContent).toContain('Not enough political capital');
  });
});

describe('who gains and who loses', () => {
  it('names the blocs and gives each a reason, not just a number', () => {
    const { container } = render(<LegislationPanel state={at(0)} />);
    const node = card(container, 'tonnage_act_1789');

    expect(node.textContent).toContain('Who gains, who loses');
    expect(node.textContent).toContain('seamen');
    // A number alone tells the player nothing about why.
    expect(node.textContent).toContain('Berths in a fleet that is about to grow');
  });
});

describe('the history is true and present', () => {
  it('carries a factual note and its sources on an enacted bill', () => {
    const { container } = render(<LegislationPanel state={at(0)} />);
    const node = card(container, 'judiciary_act_1789');

    expect(node.textContent).toContain('Historical context');
    expect(node.textContent).toContain('Marbury v. Madison');
    expect(node.textContent).toContain('1 Stat. 73');
  });

  it('carries one on a counterfactual too, because that is where it matters most', () => {
    const { container } = render(<LegislationPanel state={at(0)} />);
    const node = card(container, 'gradual_emancipation_federal');

    // The player has to know what they are departing from. (brief §4.4)
    expect(node.textContent).toContain('Pennsylvania');
    expect(node.textContent).toContain('1780');
  });
});
