/**
 * THE CAUSAL WEB
 *
 * Phase 2 brief §9 item 15. Four claims a test should be able to falsify:
 *
 *   1. The web is built from the LEDGER and the DECLARED STRUCTURE, and invents
 *      nothing. Every weight is a modifier's own ramped contribution or a
 *      declared strength.
 *   2. It cannot disagree with the stat popover, because both read the same
 *      ledger.
 *   3. A path from cause to effect is traceable and terminates, in a graph that
 *      genuinely has cycles.
 *   4. The structural map is honest: every link names its formula, and no link
 *      exists for a formula that does not.
 */

import { describe, expect, it } from 'vitest';
import { PHASE_1_CONTENT } from '@/content';
import { CAUSAL_LINKS, structuralNodes } from '@/content/causalLinks';
import { advanceDay, resolveDecision } from './advanceDay';
import { enactBill } from './bills';
import {
  actingOn,
  causalWeb,
  generalise,
  groupOf,
  labelFor,
  neighbours,
  tracePaths,
} from './causal';
import { evaluateAll } from './conditions';
import { createTestGame } from './createGame';
import { explainStat } from './modifiers';
import type { Bill, GameState } from './types';

function billById(id: string): Bill {
  return PHASE_1_CONTENT.bills.find((b) => b.id === id)!;
}

function funded(): GameState {
  const base = createTestGame({ governmentType: 'monarchy' });
  return {
    ...base,
    day: 1000,
    politicalCapital: { ...base.politicalCapital, current: 2000, cap: 2000 },
    treasury: { ...base.treasury, balance: 50_000_000 },
  };
}

function run(state: GameState, days: number): GameState {
  let current = state;
  for (let i = 0; i < days; i++) {
    current = advanceDay(current, PHASE_1_CONTENT).state;
    while (current.eventState.pendingDecisions.length > 0) {
      const pending = current.eventState.pendingDecisions[0];
      const event = PHASE_1_CONTENT.events.find((e) => e.id === pending.eventId)!;
      const option =
        event.options.find((o) => evaluateAll(o.requirements, current)) ??
        event.options[0];
      current = resolveDecision(current, PHASE_1_CONTENT, pending.eventId, option.id).state;
    }
  }
  return current;
}

// ============================================================================
// 1. BUILT FROM WHAT EXISTS
// ============================================================================

describe('the web is derived, and invents nothing', () => {
  it('draws every declared structural link', () => {
    const web = causalWeb(createTestGame());
    const structural = web.edges.filter((e) => e.kind === 'structural');

    expect(structural).toHaveLength(CAUSAL_LINKS.length);
    for (const link of CAUSAL_LINKS) {
      expect(
        structural.some((e) => e.from === link.from && e.to === link.to),
        `${link.from} -> ${link.to}`,
      ).toBe(true);
    }
  });

  it('has a node for everything the structure mentions', () => {
    const web = causalWeb(createTestGame());
    const ids = new Set(web.nodes.map((n) => n.id));
    for (const node of structuralNodes()) {
      expect(ids.has(node), node).toBe(true);
    }
  });

  it('adds a ledger edge for every modifier in force', () => {
    const bill = billById('bank_of_the_united_states');
    const state = enactBill({ ...funded(), flags: { assumption_passed: true } }, bill, null)
      .state;

    const web = causalWeb(state);
    const ledger = web.edges.filter((e) => e.kind === 'ledger');

    expect(ledger.length).toBeGreaterThan(0);
    // The source is a node in its own right, pointing at the stats it moves.
    expect(web.nodes.some((n) => n.kind === 'source' && n.label === bill.name)).toBe(true);
  });

  it('carries how much of a phasing-in law is actually in force', () => {
    const bill = billById('bounties_on_manufactures');
    const state = enactBill(funded(), bill, bill.sliderRange![1]).state;

    const onTheDay = causalWeb(state).edges.find(
      (e) => e.kind === 'ledger' && e.claim.startsWith(bill.name),
    );
    const later = causalWeb({ ...state, day: state.day + bill.phaseInDays }).edges.find(
      (e) => e.kind === 'ledger' && e.claim.startsWith(bill.name),
    );

    // A statute half phased in draws a thinner line than one in full force.
    expect(onTheDay!.rampProgress).toBeLessThan(later!.rampProgress!);
  });

  it('gives every edge a claim in words, never a bare number', () => {
    const state = run(funded(), 200);
    for (const edge of causalWeb(state).edges) {
      expect(edge.claim.length, `${edge.from} -> ${edge.to}`).toBeGreaterThan(5);
    }
  });

  it('keeps every strength on a drawable scale', () => {
    const state = run(funded(), 400);
    for (const edge of causalWeb(state).edges) {
      expect(edge.strength).toBeGreaterThanOrEqual(0);
      expect(edge.strength).toBeLessThanOrEqual(1);
      expect(Number.isFinite(edge.strength)).toBe(true);
    }
  });
});

// ============================================================================
// 2. IT CANNOT DISAGREE WITH THE POPOVER
// ============================================================================

describe('the web and the stat popover give the same answer', () => {
  it('lists exactly the sources the ledger says are acting', () => {
    const bill = billById('bank_of_the_united_states');
    const state = enactBill({ ...funded(), flags: { assumption_passed: true } }, bill, null)
      .state;

    const fromWeb = actingOn(state, 'nation.stability').map((s) => s.source).sort();
    const fromLedger = explainStat(
      'nation.stability',
      50,
      state.activeModifiers,
      state.day,
    )
      .contributions.map((c) => c.source)
      .sort();

    /*
      Both read `activeFor` on the same ledger. If these ever diverge, one of
      the two screens is lying about the same number, which is the exact failure
      the ledger rule exists to prevent.
    */
    expect(fromWeb).toEqual(fromLedger);
  });

  it('reports the ramped value, like the popover does', () => {
    const bill = billById('bounties_on_manufactures');
    const state = enactBill(funded(), bill, bill.sliderRange![1]).state;
    const mid = { ...state, day: state.day + Math.floor(bill.phaseInDays / 2) };

    const web = actingOn(mid, 'nation.sectionalTension');
    const popover = explainStat(
      'nation.sectionalTension',
      20,
      mid.activeModifiers,
      mid.day,
    );

    const fromWeb = web.find((s) => s.source === bill.name)!;
    const fromPopover = popover.contributions.find((c) => c.source === bill.name)!;
    expect(fromWeb.value).toBeCloseTo(fromPopover.value, 9);
  });

  it('says nothing is acting when nothing is', () => {
    expect(actingOn(createTestGame(), 'bloc.artisans.new_england')).toEqual([]);
  });
});

// ============================================================================
// 3. PATHS
// ============================================================================

describe('a chain of causes can be traced, and terminates', () => {
  it('finds the fiscal spine from a tariff to the balance', () => {
    const paths = tracePaths('policy.tariffRate', 'treasury.balance');

    expect(paths.length).toBeGreaterThan(0);
    const direct = paths[0];
    expect(direct.nodes[0]).toBe('policy.tariffRate');
    expect(direct.nodes[direct.nodes.length - 1]).toBe('treasury.balance');
    // Every hop carries the claim behind it, so the path reads as an argument.
    expect(direct.claims).toHaveLength(direct.nodes.length - 1);
  });

  it('returns the shortest explanation first', () => {
    const paths = tracePaths('policy.tariffRate', 'treasury.balance');
    for (let i = 1; i < paths.length; i++) {
      expect(paths[i].nodes.length).toBeGreaterThanOrEqual(paths[i - 1].nodes.length);
    }
  });

  it('terminates in a graph that genuinely has cycles', () => {
    /*
      Debt service feeds the balance, which is borrowed against, which raises
      the debt, which raises the service. A real loop, and an unbounded walk
      would never return from it — so the walk refuses to revisit a node.

      That is also why tracing balance BACK to balance finds nothing: a path
      that returns to where it started explains nothing, and the guard that
      makes the search terminate is the same one that rules it out. Both
      properties are asserted here because they are the same property.
    */
    const throughTheLoop = tracePaths('treasury.customs', 'treasury.debtService', 5);
    expect(throughTheLoop.length).toBeGreaterThan(0);

    for (const path of throughTheLoop) {
      expect(new Set(path.nodes).size).toBe(path.nodes.length);
      expect(path.nodes.length).toBeLessThanOrEqual(6);
    }

    expect(tracePaths('treasury.balance', 'treasury.balance', 4)).toEqual([]);
  });

  it('multiplies the signs, and refuses to when a link turns', () => {
    // grievance lowers compliance, compliance raises customs: net negative.
    const grievance = tracePaths('grievance.byRegion', 'treasury.customs');
    expect(grievance.length).toBeGreaterThan(0);
    expect(grievance[0].net).toBe(-1);

    // The tariff's own effect on trade is not monotonic, so nothing downstream
    // of it has a fixed sign, and the model says so rather than picking one.
    const tariff = tracePaths('policy.tariffRate', 'treasury.customs');
    expect(tariff[0].net).toBe('curve');
  });

  it('finds no path where the model declares none', () => {
    expect(tracePaths('cabinet.competence', 'bloc.planters')).toEqual([]);
  });

  it('knows what is directly upstream and downstream of a node', () => {
    const around = neighbours('treasury.balance');
    expect(around.upstream.some((l) => l.from === 'treasury.customs')).toBe(true);
    expect(around.downstream.some((l) => l.to === 'treasury.debtPrincipal')).toBe(true);
  });
});

// ============================================================================
// FOCUS, AND THE HAIRBALL PROBLEM
// ============================================================================

describe('the focused view is smaller than the whole', () => {
  it('narrows to a node and its neighbourhood', () => {
    const state = run(funded(), 300);
    const everything = causalWeb(state, null);
    const focused = causalWeb(state, 'treasury.balance');

    expect(focused.nodes.length).toBeLessThan(everything.nodes.length);
    expect(focused.nodes.some((n) => n.id === 'treasury.balance')).toBe(true);
    // Every edge kept has both ends kept, or the picture would have dangling
    // lines going nowhere.
    const ids = new Set(focused.nodes.map((n) => n.id));
    for (const edge of focused.edges) {
      expect(ids.has(edge.from) && ids.has(edge.to)).toBe(true);
    }
  });

  it('keeps both what reaches a node and what it reaches', () => {
    const focused = causalWeb(createTestGame(), 'treasury.balance');
    const ids = new Set(focused.nodes.map((n) => n.id));

    expect(ids.has('treasury.customs')).toBe(true); // upstream
    expect(ids.has('treasury.debtPrincipal')).toBe(true); // downstream
  });
});

// ============================================================================
// NAMING
// ============================================================================

describe('nodes are named readably', () => {
  it('groups a target by its family', () => {
    expect(groupOf('region.south.prosperity')).toBe('region');
    expect(groupOf('nation.stability')).toBe('nation');
  });

  it('shortens a dotted path to something that fits in a circle', () => {
    expect(labelFor('region.south.prosperity')).toBe('south prosperity');
    expect(labelFor('nation.tradeCapacity')).toBe('trade capacity');
  });

  it('collapses per-region and per-bloc targets onto their family', () => {
    /*
      "Sentiment follows prosperity" is true of every region, and a web with
      four copies of every regional link is unreadable.
    */
    expect(generalise('region.south.prosperity')).toBe('region.prosperity');
    expect(generalise('bloc.artisans.new_england')).toBe('bloc.artisans');
    expect(generalise('nation.stability')).toBe('nation.stability');
  });
});

// ============================================================================
// 4. THE STRUCTURAL MAP IS HONEST
// ============================================================================

describe('every declared link names the formula behind it', () => {
  it('cites a source file and an ECONOMY.md section for each', () => {
    for (const link of CAUSAL_LINKS) {
      const where = `${link.from} -> ${link.to}`;
      expect(link.source.length, where).toBeGreaterThan(10);
      expect(link.source, where).toContain('ECONOMY.md');
    }
  });

  it('states a claim in plain English for each', () => {
    for (const link of CAUSAL_LINKS) {
      const where = `${link.from} -> ${link.to}`;
      expect(link.claim.length, where).toBeGreaterThan(30);
      // A claim is a sentence, not a label.
      expect(link.claim, where).toMatch(/[.]$/);
    }
  });

  it('keeps every strength usable as a drawn weight', () => {
    for (const link of CAUSAL_LINKS) {
      expect(link.strength).toBeGreaterThan(0);
      expect(link.strength).toBeLessThanOrEqual(1);
    }
  });

  it('declares no duplicate edges', () => {
    const seen = new Set<string>();
    for (const link of CAUSAL_LINKS) {
      const key = `${link.from}->${link.to}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  it('has no node that is only ever an effect and never anything else', () => {
    // Not a hard rule — some things genuinely end a chain — but a node with no
    // edges at all would be a typo, and this catches it.
    for (const node of structuralNodes()) {
      const around = neighbours(node);
      expect(
        around.upstream.length + around.downstream.length,
        node,
      ).toBeGreaterThan(0);
    }
  });
});
