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
import { PARTIES } from '@/content';
import { TREATY_BY_ID } from '@/content/diplomacy/treaties';
import { isoToDay } from '@/sim/calendar';
import { createTestGame } from '@/sim/createGame';
import { signTreaty } from '@/sim/diplomacy';
import { declareWar } from '@/sim/war';
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

// ============================================================================
// QUEUE ITEM 12 — WAR ON SCREEN
// ============================================================================

describe('the grounds for war are laid out before anything is committed', () => {
  it('lists every ground with how good a case it makes', () => {
    const { container } = render(<DiplomacyPanel state={funded()} />);
    fireEvent.click(
      container.querySelector('[data-power="britain"]')!.querySelector('button')!,
    );

    const grounds = container.querySelector('[data-testid="grounds-britain"]')!;
    expect(grounds.querySelector('[data-grounds="impressment"]')).not.toBeNull();
    expect(grounds.textContent).toContain('case 70/100');
  });

  it('states the full price of a declaration, before it is made', () => {
    const { container } = render(<DiplomacyPanel state={funded()} />);
    fireEvent.click(
      container.querySelector('[data-power="britain"]')!.querySelector('button')!,
    );

    const fabricated = container.querySelector(
      '[data-grounds="fabricated:britain"]',
    )!;
    expect(fabricated.textContent).toContain('Manufactured');
    expect(fabricated.textContent).toContain('legitimacy');
    // "Invites foreign hostility" has to be on the label, not a surprise.
    expect(fabricated.textContent).toContain('every other power thinks less of us');
  });

  it('says which path the player is on, because they are different acts', () => {
    const monarchy = createTestGame({ governmentType: 'monarchy' });
    const crown = render(
      <DiplomacyPanel
        state={{
          ...monarchy,
          day: isoToDay('1795-01-01'),
          politicalCapital: { ...monarchy.politicalCapital, current: 1000, cap: 1000 },
        }}
      />,
    );
    fireEvent.click(
      crown.container.querySelector('[data-power="spain"]')!.querySelector('button')!,
    );
    expect(
      crown.container.querySelector('[data-testid="grounds-spain"]')!.textContent,
    ).toContain('The crown declares');
    expect(
      crown.container.querySelector('[data-declare="mississippi_closed"]')!.textContent,
    ).toContain('Declare war');
    cleanup();

    const base = createTestGame({ governmentType: 'republic' });
    const republic: GameState = {
      ...base,
      day: isoToDay('1795-01-01'),
      politicalCapital: { ...base.politicalCapital, current: 1000, cap: 1000 },
    };
    const { container } = render(<DiplomacyPanel state={republic} />);
    fireEvent.click(
      container.querySelector('[data-power="spain"]')!.querySelector('button')!,
    );

    expect(
      container.querySelector('[data-testid="grounds-spain"]')!.textContent,
    ).toContain('must carry both chambers');
    expect(
      container.querySelector('[data-declare="mississippi_closed"]')!.textContent,
    ).toContain('Put it to Congress');
  });

  it('calls the handler with the power and the grounds', () => {
    const onDeclare = vi.fn();
    const { container } = render(
      <DiplomacyPanel state={funded()} onDeclare={onDeclare} />,
    );
    fireEvent.click(
      container.querySelector('[data-power="spain"]')!.querySelector('button')!,
    );
    fireEvent.click(container.querySelector('[data-declare="mississippi_closed"]')!);

    expect(onDeclare).toHaveBeenCalledWith('spain', 'mississippi_closed');
  });

  it('offers to prepare a pretext, at its own price', () => {
    const onFabricate = vi.fn();
    const { container } = render(
      <DiplomacyPanel state={funded()} onFabricate={onFabricate} />,
    );
    fireEvent.click(
      container.querySelector('[data-power="spain"]')!.querySelector('button')!,
    );

    const button = container.querySelector('[data-fabricate="spain"]')!;
    expect(button.textContent).toContain('capital');
    fireEvent.click(button);
    expect(onFabricate).toHaveBeenCalledWith('spain');
  });

  it('drops a ground once the grievance behind it is settled', () => {
    const settled = signTreaty(funded(), TREATY_BY_ID.pinckney_treaty).state;
    const { container } = render(<DiplomacyPanel state={settled} />);
    fireEvent.click(
      container.querySelector('[data-power="spain"]')!.querySelector('button')!,
    );

    expect(container.querySelector('[data-grounds="mississippi_closed"]')).toBeNull();
    // The manufactured option remains, because it always does.
    expect(container.querySelector('[data-grounds="fabricated:spain"]')).not.toBeNull();
  });
});

describe('a war on screen', () => {
  function atWar(): GameState {
    const outcome = declareWar(funded(), 'britain', 'impressment', PARTIES);
    if (outcome.kind !== 'declared') throw new Error('expected a declaration');
    return outcome.state;
  }

  it('replaces the grounds with the war, and says how tired the country is', () => {
    const { container } = render(<DiplomacyPanel state={atWar()} />);
    fireEvent.click(
      container.querySelector('[data-power="britain"]')!.querySelector('button')!,
    );

    const war = container.querySelector('[data-testid="war-britain"]')!;
    expect(war.textContent).toContain('At war since');
    expect(war.textContent).toContain('Weariness');
    expect(container.querySelector('[data-testid="grounds-britain"]')).toBeNull();
  });

  it('says what peace would look like today, before it is sought', () => {
    const { container } = render(<DiplomacyPanel state={atWar()} />);
    fireEvent.click(
      container.querySelector('[data-power="britain"]')!.querySelector('button')!,
    );

    expect(container.querySelector('[data-testid="war-britain"]')!.textContent).toMatch(
      /on our terms|nobody would call a victory|on theirs/,
    );
  });

  it('calls the handler when peace is sought', () => {
    const onPeace = vi.fn();
    const { container } = render(
      <DiplomacyPanel state={atWar()} onPeace={onPeace} />,
    );
    fireEvent.click(
      container.querySelector('[data-power="britain"]')!.querySelector('button')!,
    );

    fireEvent.click(container.querySelector('[data-peace="britain"]')!);
    expect(onPeace).toHaveBeenCalledWith('britain');
  });
});
