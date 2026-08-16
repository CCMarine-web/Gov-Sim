/**
 * GRAPH LAYOUT
 *
 * Where the causal web's nodes go on screen. Presentation only, which is why it
 * is in `src/lib/` and not in `src/sim/` — the graph is simulation-derived, the
 * arrangement of it is not. (DESIGN.md Rule 7)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DETERMINISTIC, AND NOT FORCE-DIRECTED
 *
 * The obvious answer for a causal web is a force simulation. It is the wrong one
 * here, for three reasons:
 *
 *   1. IT MOVES. The web is redrawn every time the published snapshot changes —
 *      four times a second while the clock runs — and a force layout would
 *      re-settle each time. A screen whose nodes wander while the player reads
 *      it is unusable, and it is the same failure item 1 spent a day fixing on
 *      the command bar.
 *   2. IT IS NOT REPRODUCIBLE. Two players looking at the same state would see
 *      different pictures, and a screenshot could not be compared with anything.
 *   3. IT NEEDS A LIBRARY, or a hand-rolled physics loop on the main thread,
 *      for a screen that should cost nothing to draw.
 *
 * So: a layered radial layout. Nodes are grouped by family — treasury, nation,
 * region, bloc, and the sources — each family gets an arc of the circle, and
 * within an arc nodes are placed in sorted order. **The same state always draws
 * the same picture**, no animation settles, and it costs one pass over the
 * nodes.
 *
 * The cost is that edges cross more than a force layout would let them. That is
 * the right trade for a screen whose job is to be read rather than admired.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { CausalNode } from '@/sim/causal';

export interface Placed extends CausalNode {
  x: number;
  y: number;
}

export interface LayoutBox {
  width: number;
  height: number;
}

export const LAYOUT: LayoutBox = { width: 900, height: 640 };

/**
 * Which ring a family sits on.
 *
 * The fiscal spine is innermost because it is what most questions end at, the
 * political and social layers sit around it, and the SOURCES — laws, treaties,
 * appointments — are outermost, pointing inward. That reads correctly: the
 * statute book acts on the country from outside it.
 */
const RING: Record<string, number> = {
  treasury: 0,
  nation: 1,
  policy: 1,
  politicalCapital: 1,
  region: 2,
  grievance: 2,
  bloc: 3,
  cabinet: 3,
  // Everything else — the ledger sources — on the outside.
};

const OUTER_RING = 4;
const RING_RADIUS = [90, 175, 255, 320, 385];

/** A stable order, so the same set of nodes always lands in the same places. */
function sortKey(node: CausalNode): string {
  return `${node.group}:${node.id}`;
}

/**
 * Place every node.
 *
 * Grouped onto rings, then spread evenly around each ring in sorted order. The
 * whole function is a pure map from a node list to coordinates: give it the same
 * list and it gives the same picture, every time.
 */
export function layout(nodes: readonly CausalNode[], box: LayoutBox = LAYOUT): Placed[] {
  const cx = box.width / 2;
  const cy = box.height / 2;

  const byRing = new Map<number, CausalNode[]>();
  for (const node of nodes) {
    const ring = node.kind === 'source' ? OUTER_RING : (RING[node.group] ?? OUTER_RING);
    const list = byRing.get(ring) ?? [];
    list.push(node);
    byRing.set(ring, list);
  }

  const placed: Placed[] = [];

  for (const [ring, list] of [...byRing.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const radius = RING_RADIUS[Math.min(ring, RING_RADIUS.length - 1)];

    sorted.forEach((node, i) => {
      /*
        Offset each ring by half a step relative to the one inside it, so nodes
        do not line up radially and hide each other's edges. A small thing that
        makes the difference between a readable web and a spoked wheel.
      */
      const step = (Math.PI * 2) / Math.max(1, sorted.length);
      const angle = i * step + (ring % 2 === 0 ? 0 : step / 2) - Math.PI / 2;

      placed.push({
        ...node,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    });
  }

  return placed;
}

/**
 * A gentle arc between two points.
 *
 * Curved rather than straight because in a radial layout many edges are nearly
 * collinear, and two straight lines on the same bearing are one line. The bow is
 * proportional to the distance, so short edges stay nearly straight.
 */
export function edgePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;

  // Perpendicular offset at the midpoint, one eighth of the span.
  const mx = (from.x + to.x) / 2 + (-dy / distance) * (distance / 8);
  const my = (from.y + to.y) / 2 + (dx / distance) * (distance / 8);

  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}
