'use client';

/**
 * THE CAUSAL WEB
 *
 * Phase 2 brief §9 item 15: "Visualize the modifier ledger as D4's policy
 * network. We already have the graph data; this is mostly rendering, and it may
 * end up the best screen in the game."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT WOULD MAKE IT THE BEST SCREEN, AND WHAT WOULD MAKE IT THE WORST
 *
 * The failure mode of every causal-web screen ever built is the hairball: two
 * hundred nodes, a thousand crossing edges, beautiful in a screenshot and
 * useless in play. It answers no question because it answers all of them at
 * once.
 *
 * So this screen is built around ONE question — *why is this number moving, and
 * what will it move next* — and everything follows from that:
 *
 *   - It opens FOCUSED, on the treasury balance, not on everything.
 *   - Clicking a node re-focuses. The web is always one node and its
 *     neighbourhood, never the whole graph.
 *   - Every edge carries its causal claim in words, from the same sentence the
 *     formula's comment uses. Hovering an edge tells you WHY, not how much.
 *   - The trace panel walks a full path — tariff → trade → customs → balance —
 *     with the claim at each hop, so a chain of causes reads as an argument.
 *
 * The whole-graph view exists and is one click away, and it is honestly labelled
 * as the thing you look at once.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A renderer (Rule 7). Every node, edge, weight and word comes from
 * `src/sim/causal.ts`; the arrangement comes from `src/lib/graphLayout.ts`.
 */

import { useMemo, useState } from 'react';
import { LAYOUT, edgePath, layout } from '@/lib/graphLayout';
import {
  actingOn,
  causalWeb,
  labelFor,
  neighbours,
  tracePaths,
} from '@/sim/causal';
import type { GameState } from '@/sim/types';

/** Group to token. The sim knows no colours; this is the only place they meet. */
const GROUP_FILL: Record<string, string> = {
  treasury: 'var(--color-brass-400)',
  nation: 'var(--color-brass-300)',
  policy: 'var(--color-brass-700)',
  politicalCapital: 'var(--color-brass-700)',
  region: 'var(--color-verdigris-400)',
  grievance: 'var(--color-oxblood-400)',
  bloc: 'var(--color-map-party-0)',
  cabinet: 'var(--color-map-seq-3)',
  law: 'var(--color-map-seq-2)',
  treaty: 'var(--color-map-party-2)',
  appointment: 'var(--color-map-seq-4)',
  event: 'var(--color-map-div-2)',
  crisis: 'var(--color-oxblood-300)',
  policyMod: 'var(--color-brass-700)',
  structural: 'var(--color-ink-500)',
};

const FALLBACK_FILL = 'var(--color-ink-500)';

/** The node a player most often wants first: why is the money moving. */
const DEFAULT_FOCUS = 'treasury.balance';

export function CausalPanel({ state }: { state: GameState }) {
  const [focus, setFocus] = useState<string | null>(DEFAULT_FOCUS);
  const [traceTo, setTraceTo] = useState<string | null>(null);

  const web = useMemo(() => causalWeb(state, focus), [state, focus]);
  const placed = useMemo(() => layout(web.nodes), [web.nodes]);
  const byId = useMemo(() => new Map(placed.map((p) => [p.id, p])), [placed]);

  const around = focus ? neighbours(focus) : { upstream: [], downstream: [] };
  const sources = focus ? actingOn(state, focus) : [];
  const paths = focus && traceTo ? tracePaths(focus, traceTo) : [];

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_340px]" data-testid="causal">
      <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-label uppercase tracking-wider text-content-muted">
            {focus ? labelFor(focus) : 'The whole web'}
          </h3>
          <div className="flex gap-1">
            <button
              type="button"
              data-testid="focus-default"
              onClick={() => {
                setFocus(DEFAULT_FOCUS);
                setTraceTo(null);
              }}
              className="rounded border border-ink-400 px-2 py-1 text-small text-content-secondary hover:bg-ink-500"
            >
              The treasury
            </button>
            <button
              type="button"
              data-testid="show-all"
              aria-pressed={focus === null}
              onClick={() => {
                setFocus(null);
                setTraceTo(null);
              }}
              className={`rounded px-2 py-1 text-small ${
                focus === null
                  ? 'bg-brass-400 text-ink-900'
                  : 'border border-ink-400 text-content-secondary hover:bg-ink-500'
              }`}
            >
              Everything at once
            </button>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
          className="mt-2 h-auto w-full"
          role="img"
          aria-label="The causal web"
        >
          {/* Edges under nodes, so a node is never obscured by a line. */}
          {web.edges.map((edge, i) => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            if (!from || !to) return null;

            return (
              <path
                key={`${edge.from}->${edge.to}-${i}`}
                d={edgePath(from, to)}
                fill="none"
                data-edge={`${edge.from}->${edge.to}`}
                stroke={
                  edge.sign === 'curve'
                    ? 'var(--color-brass-300)'
                    : edge.sign > 0
                      ? 'var(--color-verdigris-400)'
                      : 'var(--color-oxblood-400)'
                }
                strokeWidth={0.6 + edge.strength * 2.2}
                strokeDasharray={edge.kind === 'ledger' ? '4 3' : undefined}
                opacity={0.55}
              >
                {/* The claim, in words. An edge that only had a weight would be
                    a number with no argument behind it. */}
                <title>{edge.claim}</title>
              </path>
            );
          })}

          {placed.map((node) => {
            const isFocus = node.id === focus;
            return (
              <g key={node.id} data-node={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isFocus ? 13 : node.kind === 'source' ? 7 : 9}
                  fill={GROUP_FILL[node.group] ?? FALLBACK_FILL}
                  stroke={
                    isFocus ? 'var(--color-brass-focus)' : 'var(--color-ink-900)'
                  }
                  strokeWidth={isFocus ? 3 : 1}
                  className="cursor-pointer"
                  onClick={() => {
                    setFocus(node.id);
                    setTraceTo(null);
                  }}
                >
                  <title>{node.id}</title>
                </circle>
                <text
                  x={node.x}
                  y={node.y + (isFocus ? 26 : 20)}
                  textAnchor="middle"
                  fontSize={isFocus ? 12 : 10}
                  fill="var(--color-content-secondary)"
                  className="pointer-events-none"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-small text-content-muted">
          {/* Every visual distinction gets a word. (UI.md §10) */}
          <span>Solid — how the country transmits an effect</span>
          <span>Dashed — what the statute book is doing now</span>
          <span>Thicker — stronger</span>
        </div>
      </section>

      <div className="space-y-3">
        {focus ? (
          <>
            <section
              className="rounded-card border border-ink-400 bg-ink-700 p-3"
              data-testid="causes"
            >
              <h3 className="text-label uppercase tracking-wider text-content-muted">
                What moves {labelFor(focus)}
              </h3>

              {around.upstream.length === 0 && sources.length === 0 && (
                <p className="mt-1 text-small text-content-muted">
                  Nothing is acting on this today, and the model declares no cause
                  for it. That is an answer rather than a gap.
                </p>
              )}

              {sources.length > 0 && (
                <ul className="mt-1 space-y-0.5" data-testid="acting-now">
                  {sources.map((s) => (
                    <li
                      key={`${s.sourceType}:${s.source}`}
                      className="flex items-baseline justify-between gap-2 text-small"
                    >
                      <span className="min-w-0 flex-1 truncate text-content-secondary">
                        <span className="text-content-muted">{s.sourceType}</span>{' '}
                        {s.source}
                      </span>
                      <span
                        className={`tabular shrink-0 ${
                          s.value >= 0 ? 'text-verdigris-400' : 'text-oxblood-300'
                        }`}
                      >
                        {s.value >= 0 ? '+' : ''}
                        {s.isPercentage
                          ? `${(s.value * 100).toFixed(1)}%`
                          : s.value.toFixed(1)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {around.upstream.map((link) => (
                <button
                  key={link.from}
                  type="button"
                  data-upstream={link.from}
                  onClick={() => setFocus(link.from)}
                  className="mt-1.5 block w-full text-left"
                >
                  <span className="text-small text-brass-300">
                    {labelFor(link.from)} →
                  </span>
                  <span className="block max-w-prose text-small text-content-muted">
                    {link.claim}
                  </span>
                </button>
              ))}
            </section>

            <section
              className="rounded-card border border-ink-400 bg-ink-700 p-3"
              data-testid="effects"
            >
              <h3 className="text-label uppercase tracking-wider text-content-muted">
                What {labelFor(focus)} moves next
              </h3>

              {around.downstream.length === 0 && (
                <p className="mt-1 text-small text-content-muted">
                  Nothing downstream. This is where a chain of causes ends.
                </p>
              )}

              {around.downstream.map((link) => (
                <div key={link.to} className="mt-1.5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <button
                      type="button"
                      data-downstream={link.to}
                      onClick={() => setFocus(link.to)}
                      className="text-small text-brass-300"
                    >
                      → {labelFor(link.to)}
                    </button>
                    <span className="text-small text-content-muted">
                      {link.sign === 'curve'
                        ? 'not in one direction'
                        : link.sign > 0
                          ? 'more of one, more of the other'
                          : 'more of one, less of the other'}
                    </span>
                  </div>
                  <p className="max-w-prose text-small text-content-muted">
                    {link.claim}
                  </p>
                  <button
                    type="button"
                    data-trace={link.to}
                    onClick={() => setTraceTo(link.to)}
                    className="text-small text-content-secondary underline decoration-dotted"
                  >
                    Follow it further
                  </button>
                </div>
              ))}
            </section>
          </>
        ) : (
          <section className="rounded-card border border-ink-400 bg-ink-700 p-3">
            <p className="max-w-prose text-small text-content-muted">
              Every declared cause in the model, and everything the statute book is
              doing today, at once. It is worth looking at once. Click any node to
              ask a question of it instead — that is the view that answers
              anything.
            </p>
          </section>
        )}

        {paths.length > 0 && (
          <section
            className="rounded-card border border-ink-400 bg-ink-700 p-3"
            data-testid="trace"
          >
            <h3 className="text-label uppercase tracking-wider text-content-muted">
              {labelFor(focus!)} → {labelFor(traceTo!)}
            </h3>

            {paths.slice(0, 3).map((path, i) => (
              <div key={i} className="mt-2 border-t border-ink-400 pt-2 first:border-0">
                <p className="text-small text-content-secondary">
                  {path.nodes.map((n) => labelFor(n)).join(' → ')}
                </p>
                <p className="text-small text-content-muted">
                  Net effect:{' '}
                  {path.net === 'curve'
                    ? 'not in one direction — a link on this path turns'
                    : path.net > 0
                      ? 'more of the first gives more of the last'
                      : 'more of the first gives less of the last'}
                </p>
                <ol className="mt-1 space-y-1">
                  {path.claims.map((claim, j) => (
                    <li key={j} className="max-w-prose text-small text-content-muted">
                      {j + 1}. {claim}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
