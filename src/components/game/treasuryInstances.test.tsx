// @vitest-environment jsdom

/**
 * TREASURY RENDERS WHATEVER EXISTS
 *
 * Phase 2 brief §4.3, the requirement in the author's own words:
 *
 *   "When I pass a new tax in Legislation, it must appear as a new line in
 *    Treasury."
 *
 * That is a claim about the interface, so it is asserted against the rendered
 * DOM. Every test here works by changing STATE and checking the screen followed —
 * no test touches TreasuryPanel's internals, because the whole point is that the
 * component was not edited to make the new tax appear.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { createTestGame } from '@/sim/createGame';
import { advanceDay } from '@/sim/advanceDay';
import { TAX_BASES } from '@/sim/taxBases';
import { repealTax, upsertTax } from '@/sim/taxes';
import type { ContentPack, GameState } from '@/sim/types';
import { FOUNDING_TAX_IDS } from '@/sim/types';
import { TreasuryPanel } from './TreasuryPanel';

const EMPTY: ContentPack = { version: 'test', events: [], bills: [], offices: [] };

afterEach(cleanup);

function run(state: GameState, days: number): GameState {
  let current = state;
  for (let i = 0; i < days; i++) current = advanceDay(current, EMPTY).state;
  return current;
}

/** Labels of the rate sliders currently on screen. */
function sliderLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('input[type="range"]')]
    .map((input) => {
      const id = input.getAttribute('id') ?? '';
      const label = container.querySelector(`label[for="${CSS.escape(id)}"]`);
      return label?.textContent?.trim() ?? '';
    })
    .filter((text) => text.length > 0);
}

/** Tax names in the revenue attribution table. */
function attributedTaxes(container: HTMLElement): string[] {
  const rows = [...container.querySelectorAll('table tbody tr')];
  return rows
    .map((row) => row.querySelector('td')?.textContent ?? '')
    .filter((text) => text.length > 0);
}

describe('the Treasury screen is driven by the tax array', () => {
  it('shows one slider per founding tax', () => {
    const state = createTestGame();
    const { container } = render(<TreasuryPanel state={state} />);

    const labels = sliderLabels(container);
    expect(labels).toContain('Impost of 1789');
    expect(labels).toContain('Excise on distilled spirits');
    expect(labels).toContain('Direct tax on land');
  });

  /**
   * The requirement itself. A tax that did not exist when this file was written
   * appears on screen because it exists in state.
   */
  it('shows a tax created by a bill, with no component change', () => {
    let state = createTestGame();
    state = {
      ...state,
      policies: upsertTax(state.policies, {
        id: 'tax_carriages_1794',
        name: 'Carriage Duty of 1794',
        createdByBillId: 'bill_carriage_duty_1794',
        base: 'carriages',
        rate: 0.02,
        exemptions: ['Carriages kept for hire or for husbandry'],
        collectionEfficiency: TAX_BASES.carriages.referenceEfficiency,
        enactedDay: state.day,
      }),
    };

    const { container } = render(<TreasuryPanel state={state} />);

    expect(sliderLabels(container)).toContain('Carriage Duty of 1794');
    expect(container.textContent).toContain('4 taxes in force');
    // Its statutory exemption is shown, because a player should be able to read
    // what the law they passed actually says.
    expect(container.textContent).toContain('Carriages kept for hire');
  });

  it('drops the line when a tax is repealed', () => {
    const state = createTestGame();
    const repealed: GameState = {
      ...state,
      policies: repealTax(state.policies, FOUNDING_TAX_IDS.spirits, state.day),
    };

    const { container } = render(<TreasuryPanel state={repealed} />);

    expect(sliderLabels(container)).not.toContain('Excise on distilled spirits');
    expect(container.textContent).toContain('2 taxes in force');
  });

  it('says so plainly when nothing at all is levied', () => {
    const state = createTestGame();
    let policies = state.policies;
    for (const id of Object.values(FOUNDING_TAX_IDS)) {
      policies = repealTax(policies, id, state.day);
    }

    const { container } = render(<TreasuryPanel state={{ ...state, policies }} />);

    expect(container.textContent).toContain('No taxes are levied');

    // The spending sliders are still there — defunding a programme is a separate
    // act from repealing a tax — so this checks that no TAX slider remains.
    const labels = sliderLabels(container);
    expect(labels).not.toContain('Impost of 1789');
    expect(labels).not.toContain('Excise on distilled spirits');
    expect(labels).not.toContain('Direct tax on land');
  });

  it('carries each tax base’s historical context onto the screen', () => {
    const state = createTestGame();
    const { container } = render(<TreasuryPanel state={state} />);

    // Factual context travels with the base, so it cannot be forgotten for a
    // tax added later. (brief §4.4: every bill carries factual context
    // regardless of tier.)
    expect(container.textContent).toContain('Tariff Act of 4 July 1789');
    expect(container.textContent).toContain('1 Stat. 24');
  });
});

/**
 * THE POLITICAL CAPITAL GATE (brief §3)
 *
 * Capital is what makes an action possible. The screen has to show the price
 * before the player commits, and when it refuses it has to say why — a control
 * that declines without explanation is the same failure the modifier ledger
 * exists to prevent, applied to actions instead of numbers.
 */
describe('the political capital gate on enacting a budget', () => {
  function withCapital(state: GameState, current: number): GameState {
    return {
      ...state,
      politicalCapital: { ...state.politicalCapital, current, cap: 500 },
    };
  }

  /** Drag a tax slider to a new rate. */
  function setFirstTaxRate(container: HTMLElement, value: number) {
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: String(value) } });
  }

  it('shows no price until something has actually changed', () => {
    const state = createTestGame();
    const { container } = render(<TreasuryPanel state={state} />);
    expect(container.querySelector('[data-testid="capital-cost"]')).toBeNull();
  });

  it('states the price and the reserve once a change is drafted', () => {
    const state = withCapital(createTestGame(), 200);
    const { container } = render(<TreasuryPanel state={state} />);

    setFirstTaxRate(container, 0.2);

    const cost = container.querySelector('[data-testid="capital-cost"]');
    expect(cost).not.toBeNull();
    expect(cost!.textContent).toContain('Political capital');
    expect(cost!.textContent).toContain('200.0');
  });

  it('disables Enact when the government cannot afford it, and says why', () => {
    const state = withCapital(createTestGame(), 1);
    const { container, getByText } = render(<TreasuryPanel state={state} />);

    setFirstTaxRate(container, 0.35);

    const enact = getByText('Enact') as HTMLButtonElement;
    expect(enact.disabled).toBe(true);

    // Actionable, not just a refusal.
    const cost = container.querySelector('[data-testid="capital-cost"]')!;
    expect(cost.textContent).toContain('political capital');
    expect(cost.textContent).toMatch(/day/);
  });

  it('enables Enact once the reserve covers it', () => {
    const state = withCapital(createTestGame(), 400);
    const { container, getByText } = render(<TreasuryPanel state={state} />);

    setFirstTaxRate(container, 0.35);

    expect((getByText('Enact') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('the revenue attribution table', () => {
  it('names the law that created each tax', () => {
    let state = createTestGame();
    state = {
      ...state,
      policies: upsertTax(state.policies, {
        id: 'tax_stamps_1797',
        name: 'Stamp Act of 1797',
        createdByBillId: 'bill_stamp_act_1797',
        base: 'stamps',
        rate: 0.01,
        exemptions: [],
        collectionEfficiency: TAX_BASES.stamps.referenceEfficiency,
        enactedDay: state.day,
      }),
    };

    // Past the first monthly recompute, so the attribution lines exist.
    const after = run(state, 40);
    const { container } = render(<TreasuryPanel state={after} />);

    const rows = attributedTaxes(container);
    expect(rows.some((r) => r.includes('Stamp Act of 1797'))).toBe(true);
    expect(rows.some((r) => r.includes('bill_stamp_act_1797'))).toBe(true);
  });

  it('shows the honest empty state before the first assessment', () => {
    const state = createTestGame();
    const { container } = render(<TreasuryPanel state={state} />);

    expect(container.textContent).toContain('No revenue has been assessed yet');
  });

  it('separates what was not remitted from what could not be collected', () => {
    const after = run(createTestGame(), 40);
    const { container } = render(<TreasuryPanel state={after} />);

    // Two different failures with two different remedies. Collapsing them into
    // one "losses" figure would tell the player nothing actionable.
    expect(container.textContent).toContain('Not remitted');
    expect(container.textContent).toContain('Uncollected');
    expect(container.textContent).toContain('a question of consent');
    expect(container.textContent).toContain('a question of capacity');
  });
});
