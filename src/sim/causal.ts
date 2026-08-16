/**
 * THE CAUSAL WEB
 *
 * Phase 2 brief §9 item 15: "Causal web view — visualize the modifier ledger as
 * D4's policy network. We already have the graph data; this is mostly
 * rendering, and it may end up the best screen in the game."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO KINDS OF EDGE, AND THE SECOND IS WHY IT IS INTERESTING
 *
 * LEDGER EDGES come from `activeModifiers`. A law, a treaty, an appointment or
 * a crisis pointing at a stat, weighted by what it is contributing TODAY —
 * ramped, so a statute half phased in draws a thinner line than one in full
 * force. This is the graph the brief says we already have.
 *
 * STRUCTURAL EDGES come from `src/content/causalLinks.ts`: how the country
 * transmits an effect once it has one. A tariff suppresses trade, which cuts
 * customs, which widens the deficit, which raises debt service, which crowds out
 * everything else.
 *
 * Ledger edges alone would draw a bipartite fan — sources on one side, stats on
 * the other, no path longer than a single hop. True, and not a web. The
 * structure is what makes it one, and it is what lets the screen answer the
 * question a player actually has: *why is this number moving, and what will it
 * move next.*
 *
 * WHAT THIS MODULE MAY NOT DO
 *
 * It computes no simulation values of its own. Every weight is either a
 * modifier's own ramped contribution or a declared strength from the content
 * file. Nothing here can disagree with the ledger, because everything here is
 * read from it. (DESIGN.md Rule 5, Rule 7)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Pure. Layout is presentation and lives in `src/lib/graphLayout.ts`.
 */

import { CAUSAL_LINKS, type CausalLink } from '@/content/causalLinks';
import { activeFor, effectiveValue, rampFactor } from './modifiers';
import type { GameState, Modifier, ModifierSourceType } from './types';

export type NodeKind = 'stat' | 'source';

export interface CausalNode {
  id: string;
  kind: NodeKind;
  /** What to put on the node. Short, because it goes in a circle. */
  label: string;
  /** The family it belongs to, for grouping: nation, region, treasury, bloc… */
  group: string;
  /** For a source node, what kind of source. */
  sourceType?: ModifierSourceType;
}

export interface CausalEdge {
  from: string;
  to: string;
  /** Ledger edges are what a source is doing; structural are how it travels. */
  kind: 'ledger' | 'structural';
  /** Which way it pushes. */
  sign: 1 | -1 | 'curve';
  /** 0…1, for the drawn weight. */
  strength: number;
  /** The reason, in words. Never a bare number. */
  claim: string;
  /** For a ledger edge: how much of its full value is in force today, 0…1. */
  rampProgress?: number;
}

export interface CausalWeb {
  nodes: CausalNode[];
  edges: CausalEdge[];
}

// ============================================================================
// NAMING
// ============================================================================

/** The family a dotted target belongs to. `region.south.prosperity` → `region`. */
export function groupOf(target: string): string {
  return target.split('.')[0] ?? 'other';
}

/**
 * A short label for a node.
 *
 * `region.south.prosperity` → "south prosperity". Long enough to be
 * unambiguous, short enough to sit in a circle. The full path is in the hover.
 */
export function labelFor(target: string): string {
  const parts = target.split('.');
  if (parts.length <= 1) return target;
  return parts
    .slice(1)
    .join(' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase();
}

/**
 * Collapse a per-region or per-bloc target onto its family.
 *
 * `region.south.prosperity` → `region.prosperity`. The structural map is written
 * in these terms because the claim "sentiment follows prosperity" is true of
 * every region and writing it four times would say nothing extra — and a web
 * with four copies of every regional link is unreadable.
 */
export function generalise(target: string): string {
  const parts = target.split('.');
  if (parts.length === 3 && (parts[0] === 'region' || parts[0] === 'bloc')) {
    return parts[0] === 'bloc' ? `${parts[0]}.${parts[1]}` : `${parts[0]}.${parts[2]}`;
  }
  return target;
}

// ============================================================================
// BUILDING THE WEB
// ============================================================================

function sourceNodeId(modifier: Modifier): string {
  return `source:${modifier.sourceType}:${modifier.source}`;
}

/**
 * The whole web for a state.
 *
 * `focus` narrows it: given a node id, only that node, what reaches it, and what
 * it reaches. A web of everything is a hairball, and a hairball answers no
 * question; the focused view is the one that does.
 */
export function causalWeb(state: GameState, focus: string | null = null): CausalWeb {
  const nodes = new Map<string, CausalNode>();
  const edges: CausalEdge[] = [];

  const addStat = (target: string): void => {
    if (nodes.has(target)) return;
    nodes.set(target, {
      id: target,
      kind: 'stat',
      label: labelFor(target),
      group: groupOf(target),
    });
  };

  // --- Structural edges: how the country transmits an effect ---------------
  for (const link of CAUSAL_LINKS) {
    addStat(link.from);
    addStat(link.to);
    edges.push({
      from: link.from,
      to: link.to,
      kind: 'structural',
      sign: link.sign,
      strength: link.strength,
      claim: link.claim,
    });
  }

  // --- Ledger edges: what the statute book is doing right now ---------------
  for (const modifier of state.activeModifiers) {
    if (!activeFor([modifier], modifier.target, state.day).length) continue;

    const to = generalise(modifier.target);
    addStat(to);

    const id = sourceNodeId(modifier);
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        kind: 'source',
        label: modifier.source,
        group: modifier.sourceType,
        sourceType: modifier.sourceType,
      });
    }

    const value = effectiveValue(modifier, state.day);
    edges.push({
      from: id,
      to,
      kind: 'ledger',
      sign: value >= 0 ? 1 : -1,
      /*
        WEIGHT IS WHAT IT IS CONTRIBUTING TODAY, not what it will contribute.
        A percentage modifier of 0.09 and a flat one of 9 are not comparable in
        their own units, so both are mapped onto a 0–1 scale for drawing only —
        the honest numbers are in the stat popover, and the hover here says so.
      */
      strength: Math.min(1, Math.abs(modifier.isPercentage ? value * 4 : value / 20)),
      claim: `${modifier.source} → ${labelFor(modifier.target)}`,
      rampProgress: rampFactor(modifier, state.day),
    });
  }

  if (focus === null) {
    return { nodes: [...nodes.values()], edges };
  }

  // --- Focused: the node, what reaches it, and what it reaches --------------
  const keep = new Set<string>([focus]);
  for (const edge of edges) {
    if (edge.from === focus) keep.add(edge.to);
    if (edge.to === focus) keep.add(edge.from);
  }

  return {
    nodes: [...nodes.values()].filter((n) => keep.has(n.id)),
    edges: edges.filter((e) => keep.has(e.from) && keep.has(e.to)),
  };
}

// ============================================================================
// TRACING
// ============================================================================

export interface CausalPath {
  /** Node ids from cause to effect. */
  nodes: string[];
  /** The claim at each hop, so a path reads as an argument. */
  claims: string[];
  /** The product of the signs. A path with a `curve` in it has no fixed sign. */
  net: 1 | -1 | 'curve';
}

/**
 * Every path from one stat to another, up to `maxHops`.
 *
 * THE POINT OF THE SCREEN. "Why is the deficit widening" is answered by a path,
 * not by a number: tariff → trade → customs → balance, with the claim at each
 * hop. Bounded because the graph has cycles — debt service feeds the balance
 * which feeds the debt — and an unbounded walk would never return.
 *
 * Structural edges only: a ledger edge is a single hop by construction and
 * cannot be part of a chain.
 */
export function tracePaths(
  from: string,
  to: string,
  maxHops = 4,
): CausalPath[] {
  const found: CausalPath[] = [];

  const walk = (
    at: string,
    visited: string[],
    claims: string[],
    signs: Array<1 | -1 | 'curve'>,
  ): void => {
    if (visited.length > maxHops + 1) return;

    if (at === to && visited.length > 1) {
      const curve = signs.includes('curve');
      const net = curve
        ? ('curve' as const)
        : signs.reduce<1 | -1>((a, b) => ((a as number) * (b as number) > 0 ? 1 : -1), 1);
      found.push({ nodes: [...visited], claims: [...claims], net });
      return;
    }

    for (const link of CAUSAL_LINKS) {
      if (link.from !== at) continue;
      // A cycle is real in this model — debt service feeds the balance which
      // feeds the debt — but a path that revisits a node explains nothing.
      if (visited.includes(link.to)) continue;
      walk(link.to, [...visited, link.to], [...claims, link.claim], [...signs, link.sign]);
    }
  };

  walk(from, [from], [], []);

  // Shortest first: the most direct explanation is the most useful one.
  return found.sort((a, b) => a.nodes.length - b.nodes.length);
}

/** What a node directly affects, and what directly affects it. */
export function neighbours(node: string): {
  upstream: CausalLink[];
  downstream: CausalLink[];
} {
  return {
    upstream: CAUSAL_LINKS.filter((l) => l.to === node),
    downstream: CAUSAL_LINKS.filter((l) => l.from === node),
  };
}

/**
 * The sources currently acting on a stat, largest first.
 *
 * Reads the ledger directly rather than the web, so it cannot disagree with the
 * stat popover — the two answer the same question and must give the same answer.
 */
export function actingOn(
  state: GameState,
  target: string,
): Array<{ source: string; sourceType: ModifierSourceType; value: number; isPercentage: boolean }> {
  return activeFor(state.activeModifiers, target, state.day)
    .map((m) => ({
      source: m.source,
      sourceType: m.sourceType,
      value: effectiveValue(m, state.day),
      isPercentage: m.isPercentage,
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}
