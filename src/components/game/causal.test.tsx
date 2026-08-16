// @vitest-environment jsdom

/**
 * THE CAUSAL WEB ON SCREEN
 *
 * Phase 2 brief §9 item 15. The failure mode of every causal-web screen ever
 * built is the hairball — beautiful in a screenshot, useless in play, answering
 * no question because it answers all of them at once. So the tests are mostly
 * about what the screen REFUSES to show.
 *
 *   - It opens focused, not on everything.
 *   - Clicking a node re-focuses rather than expanding.
 *   - Every edge carries its claim in words.
 *   - A path reads as an argument, with the reason at each hop.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { PHASE_1_CONTENT } from '@/content';
import { enactBill } from '@/sim/bills';
import { causalWeb } from '@/sim/causal';
import { createTestGame } from '@/sim/createGame';
import type { GameState } from '@/sim/types';
import { CausalPanel } from './CausalPanel';

afterEach(cleanup);

function funded(): GameState {
  const base = createTestGame({ governmentType: 'monarchy' });
  return {
    ...base,
    day: 1000,
    politicalCapital: { ...base.politicalCapital, current: 2000, cap: 2000 },
    treasury: { ...base.treasury, balance: 50_000_000 },
    flags: { ...base.flags, assumption_passed: true },
  };
}

describe('the web opens focused, not as a hairball', () => {
  it('starts on the treasury balance', () => {
    const { container } = render(<CausalPanel state={funded()} />);

    expect(container.querySelector('[data-node="treasury.balance"]')).not.toBeNull();
    // Focused means fewer nodes than the whole graph, which is the entire point.
    const shown = container.querySelectorAll('[data-node]').length;
    expect(shown).toBeLessThan(causalWeb(funded(), null).nodes.length);
  });

  it('shows everything only when asked, and says what that is for', () => {
    const { container } = render(<CausalPanel state={funded()} />);
    const focused = container.querySelectorAll('[data-node]').length;

    fireEvent.click(container.querySelector('[data-testid="show-all"]')!);

    expect(container.querySelectorAll('[data-node]').length).toBeGreaterThan(focused);
    expect(container.textContent).toContain('worth looking at once');
  });

  it('re-focuses when a node is clicked', () => {
    const { container } = render(<CausalPanel state={funded()} />);

    fireEvent.click(
      container.querySelector('[data-node="treasury.customs"] circle')!,
    );

    expect(container.querySelector('[data-testid="causes"]')!.textContent).toContain(
      'customs',
    );
  });

  it('walks upstream and downstream by clicking', () => {
    const { container } = render(<CausalPanel state={funded()} />);

    fireEvent.click(container.querySelector('[data-downstream="treasury.debtPrincipal"]')!);
    expect(container.querySelector('[data-testid="causes"]')!.textContent).toContain(
      'debt principal',
    );
  });
});

describe('every line has a reason behind it', () => {
  it('gives each edge its claim as a title', () => {
    const { container } = render(<CausalPanel state={funded()} />);
    const edge = container.querySelector('[data-edge]')!;

    // An edge with only a weight would be a number with no argument behind it.
    expect(edge.querySelector('title')!.textContent!.length).toBeGreaterThan(10);
  });

  it('names what each link means in words, not only by colour', () => {
    const { container } = render(<CausalPanel state={funded()} />);
    const effects = container.querySelector('[data-testid="effects"]')!;

    expect(effects.textContent).toMatch(
      /more of one, more of the other|more of one, less of the other|not in one direction/,
    );
  });

  it('explains the two kinds of line in the legend', () => {
    const { container } = render(<CausalPanel state={funded()} />);

    expect(container.textContent).toContain('how the country transmits');
    expect(container.textContent).toContain('what the statute book is doing');
  });
});

describe('what is acting right now', () => {
  it('lists the sources currently on the focused stat', () => {
    const bill = PHASE_1_CONTENT.bills.find((b) => b.id === 'bank_of_the_united_states')!;
    const state = enactBill(funded(), bill, null).state;

    const { container } = render(<CausalPanel state={state} />);
    // The focused view shows one neighbourhood, so reach the rest through the
    // whole-graph view — which is what a player does too.
    fireEvent.click(container.querySelector('[data-testid="show-all"]')!);
    fireEvent.click(container.querySelector('[data-node="nation.stability"] circle')!);

    const acting = container.querySelector('[data-testid="acting-now"]')!;
    expect(acting.textContent).toContain(bill.name);
  });

  it('says so plainly when nothing is acting', () => {
    const { container } = render(<CausalPanel state={createTestGame()} />);
    fireEvent.click(container.querySelector('[data-testid="show-all"]')!);
    // Cabinet competence is where a chain STARTS: nothing in the model causes
    // it, and on day 0 no statute is acting on it either.
    fireEvent.click(container.querySelector('[data-node="cabinet.competence"] circle')!);

    expect(container.querySelector('[data-testid="causes"]')!.textContent).toContain(
      'That is an answer rather than a gap',
    );
  });
});

describe('tracing a chain', () => {
  it('reads as an argument, with the reason at each hop', () => {
    const { container } = render(<CausalPanel state={funded()} />);

    fireEvent.click(container.querySelector('[data-trace="treasury.debtPrincipal"]')!);
    const trace = container.querySelector('[data-testid="trace"]')!;

    expect(trace.textContent).toContain('→');
    expect(trace.textContent).toContain('Net effect');
    // The claims are numbered, so the chain reads in order.
    expect(trace.querySelectorAll('ol li').length).toBeGreaterThan(0);
  });

  it('says when a path has no fixed direction', () => {
    const { container } = render(<CausalPanel state={funded()} />);

    fireEvent.click(container.querySelector('[data-testid="show-all"]')!);
    fireEvent.click(container.querySelector('[data-node="policy.tariffRate"] circle')!);
    fireEvent.click(container.querySelector('[data-trace="nation.tradeVolume"]')!);

    // The tariff curve turns at 25%, so nothing downstream has a fixed sign and
    // the screen refuses to claim one.
    expect(container.querySelector('[data-testid="trace"]')!.textContent).toContain(
      'not in one direction',
    );
  });
});

describe('the layout does not wander', () => {
  it('draws the same picture for the same state', () => {
    const state = funded();
    const first = render(<CausalPanel state={state} />);
    const a = first.container.querySelector('[data-node="treasury.balance"] circle')!;
    const position = [a.getAttribute('cx'), a.getAttribute('cy')];
    cleanup();

    const second = render(<CausalPanel state={state} />);
    const b = second.container.querySelector('[data-node="treasury.balance"] circle')!;

    /*
      Deterministic layout, not force-directed. The web is redrawn whenever the
      published snapshot changes — four times a second while the clock runs —
      and a settling force layout would make it unreadable.
    */
    expect([b.getAttribute('cx'), b.getAttribute('cy')]).toEqual(position);
  });
});
