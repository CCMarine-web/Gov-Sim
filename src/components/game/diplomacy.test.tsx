// @vitest-environment jsdom

/**
 * THE DIPLOMACY SCREEN
 *
 * Phase 2 brief §7, queue item 11. What the interface has to get right:
 *
 *   - A panel per power with government, ruler, strength and relationship.
 *   - **Honest gaps.** "Real 1790s figures where sourced, honest gaps where
 *     not — the same data-integrity rule applies to foreign nations as to our
 *     own." A missing population is a stated gap, never a dash that reads as
 *     zero and never a quietly omitted row.
 *   - Native nations presented as polities, on the same terms as Britain.
 *   - Every treaty says where it stands and why, and what it would cost.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { TREATY_BY_ID } from '@/content/diplomacy/treaties';
import { isoToDay } from '@/sim/calendar';
import { createTestGame } from '@/sim/createGame';
import { signTreaty } from '@/sim/diplomacy';
import type { GameState } from '@/sim/types';
import { DiplomacyPanel } from './DiplomacyPanel';

afterEach(cleanup);

function funded(day = isoToDay('1795-01-01')): GameState {
  const base = createTestGame();
  return {
    ...base,
    day,
    politicalCapital: { ...base.politicalCapital, current: 1000, cap: 1000 },
    treasury: { ...base.treasury, balance: 20_000_000 },
  };
}

describe('a panel per power', () => {
  it('lists the European powers, the Barbary states and the Native nations', () => {
    const { container } = render(<DiplomacyPanel state={funded()} />);

    expect(container.querySelector('[data-power-group="european"]')).not.toBeNull();
    expect(container.querySelector('[data-power-group="barbary"]')).not.toBeNull();
    expect(
      container.querySelector('[data-power-group="native_nation"]'),
    ).not.toBeNull();

    expect(container.querySelector('[data-power="britain"]')).not.toBeNull();
    expect(container.querySelector('[data-power="northwest_confederacy"]')).not.toBeNull();
  });

  it('names the government of the day, not a fixed one', () => {
    const early = render(<DiplomacyPanel state={funded(isoToDay('1791-01-01'))} />);
    expect(early.container.querySelector('[data-power="france"]')!.textContent).toContain(
      'Louis XVI',
    );
    cleanup();

    const late = render(<DiplomacyPanel state={funded(isoToDay('1800-01-01'))} />);
    expect(late.container.querySelector('[data-power="france"]')!.textContent).toContain(
      'Napoleon',
    );
  });

  it('pairs a relation with a word, never a bare number', () => {
    const { container } = render(<DiplomacyPanel state={funded()} />);
    const algiers = container.querySelector('[data-power="algiers"]')!;

    expect(algiers.textContent).toMatch(/Hostile|Unfriendly/);
  });

  it('says that strength is a model rather than a record', () => {
    const { container } = render(<DiplomacyPanel state={funded()} />);
    const britain = container.querySelector('[data-power="britain"]')!;

    expect(britain.textContent).toContain('Strength is a model');
  });
});

describe('gaps are drawn as gaps', () => {
  it('states why there is no population figure, rather than showing a dash', () => {
    const { container } = render(<DiplomacyPanel state={funded()} />);
    const gap = container.querySelector('[data-testid="gap-cherokee"]')!;

    expect(gap).not.toBeNull();
    expect(gap.textContent).toContain('no verified figure');
    // The reason is the point: a dash could be read as zero.
    expect(gap.textContent).toContain('vary widely');
  });

  it('shows a sourced figure in the steel reserved for historical data', () => {
    const { container } = render(<DiplomacyPanel state={funded()} />);
    const figures = container.querySelector('[data-testid="figures-britain"]')!;

    expect(figures.textContent).toContain('1801');
    expect(figures.innerHTML).toContain('steel');
  });

  it('says plainly why the Native nations are mostly unavailable', () => {
    const { container } = render(<DiplomacyPanel state={funded()} />);
    const group = container.querySelector('[data-power-group="native_nation"]')!;

    expect(group.textContent).toContain('nobody counted');
    expect(group.textContent).toContain('not obstacles on a map');
  });
});

describe('what each power wants, and what was done', () => {
  it('opens to show interests, context and sources', () => {
    const { container } = render(<DiplomacyPanel state={funded()} />);
    const card = container.querySelector('[data-power="northwest_confederacy"]')!;

    fireEvent.click(card.querySelector('button')!);
    const detail = container.querySelector(
      '[data-testid="detail-northwest_confederacy"]',
    )!;

    expect(detail.textContent).toContain('Ohio River');
    // The record here is ugly and the game does not launder it.
    expect(detail.textContent).toContain('St Clair');
    expect(detail.textContent).toContain('Treaty of Greenville');
  });
});

describe('treaties', () => {
  it('says where each stands and why it cannot be signed', () => {
    const { container } = render(<DiplomacyPanel state={funded()} />);
    const card = container.querySelector('[data-power="britain"]')!;
    fireEvent.click(card.querySelector('button')!);

    const commercial = container.querySelector(
      '[data-treaty="commercial_treaty_britain"]',
    )!;
    // A greyed-out control with no reason teaches the player nothing.
    expect(commercial.textContent).toContain('Relations are too poor');
  });

  it('offers a signable treaty with its full price on the button', () => {
    const { container } = render(<DiplomacyPanel state={funded()} />);
    const card = container.querySelector('[data-power="algiers"]')!;
    fireEvent.click(card.querySelector('button')!);

    const button = container.querySelector('[data-sign="treaty_with_algiers"]')!;
    expect(button.textContent).toContain('capital');
    // The tribute is the point of that treaty and must not be hidden.
    expect(button.textContent).toContain('a year thereafter');
  });

  it('calls the handler when a treaty is concluded', () => {
    const onSign = vi.fn();
    const { container } = render(<DiplomacyPanel state={funded()} onSign={onSign} />);
    fireEvent.click(
      container.querySelector('[data-power="spain"]')!.querySelector('button')!,
    );

    fireEvent.click(container.querySelector('[data-sign="pinckney_treaty"]')!);
    expect(onSign).toHaveBeenCalledWith('pinckney_treaty');
  });

  it('reports treaties already in force', () => {
    const signed = signTreaty(funded(), TREATY_BY_ID.pinckney_treaty).state;
    const { container } = render(<DiplomacyPanel state={signed} />);

    expect(container.querySelector('[data-testid="inforce-spain"]')!.textContent).toContain(
      '1 treaty in force',
    );
  });

  it('shows what tribute now costs the country every year', () => {
    const signed = signTreaty(funded(), TREATY_BY_ID.treaty_with_algiers).state;
    const { container } = render(<DiplomacyPanel state={signed} />);

    const total = container.querySelector('[data-testid="tribute-total"]')!;
    expect(total.textContent).toContain('a year');
    expect(total.textContent).toContain('civil list');
  });

  it('says nothing about tribute when none is owed', () => {
    const { container } = render(<DiplomacyPanel state={funded()} />);
    expect(container.querySelector('[data-testid="tribute-total"]')).toBeNull();
  });
});

describe('sending a minister', () => {
  it('states its price and calls the handler', () => {
    const onEnvoy = vi.fn();
    const { container } = render(<DiplomacyPanel state={funded()} onEnvoy={onEnvoy} />);
    fireEvent.click(
      container.querySelector('[data-power="britain"]')!.querySelector('button')!,
    );

    const button = container.querySelector('[data-envoy="britain"]')!;
    expect(button.textContent).toContain('political capital');

    fireEvent.click(button);
    expect(onEnvoy).toHaveBeenCalledWith('britain');
  });

  it('is disabled when there is no capital for it', () => {
    const base = funded();
    const broke: GameState = {
      ...base,
      politicalCapital: { ...base.politicalCapital, current: 0 },
    };

    const { container } = render(<DiplomacyPanel state={broke} />);
    fireEvent.click(
      container.querySelector('[data-power="britain"]')!.querySelector('button')!,
    );

    expect(
      container.querySelector('[data-envoy="britain"]')!.hasAttribute('disabled'),
    ).toBe(true);
  });
});
