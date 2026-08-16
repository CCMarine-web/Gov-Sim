/**
 * GENERATE THE MAP GEOMETRY
 *
 *   npx tsx scripts/make-map-geometry.mts
 *
 * Writes `src/content/map/geometry.ts`: one SVG path string per state, plus a
 * label point, in a fixed 975×610 viewBox.
 *
 * WHY THIS IS A BUILD STEP AND NOT A RUNTIME DEPENDENCY
 *
 * `us-atlas`, `topojson-client` and `d3-geo` are devDependencies used HERE and
 * nowhere else. The output is a committed TypeScript file of plain strings, so:
 *
 *   - the game ships no map libraries and no runtime projection maths;
 *   - the geometry is diffable in a pull request, like every other piece of
 *     content in this project;
 *   - `src/sim/` and the components stay free of anything that could pull in a
 *     non-deterministic dependency (DESIGN.md Rule 1).
 *
 * WHICH FILE, AND WHY
 *
 * `states-albers-10m.json` is ALREADY PROJECTED — an Albers USA projection with
 * Alaska and Hawaii inset, in a 975×610 box. So there is no projection step
 * here at all: the coordinates come out of TopoJSON ready to draw. Using the
 * unprojected `states-10m.json` would mean shipping a projection, and choosing
 * one, and getting Alaska wrong.
 *
 * THE SIMPLIFICATION, STATED PLAINLY
 *
 * These are MODERN state outlines. The brief calls for it (§6.1) and it is a
 * real inaccuracy: Virginia here excludes West Virginia, which did not exist
 * until 1863; Massachusetts excludes Maine, which was part of it until 1820.
 * The game says so on the map itself rather than leaving a player to discover
 * it. Territory is drawn as merged groups of the modern shapes it later became.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import topology from 'us-atlas/states-albers-10m.json' with { type: 'json' };

/**
 * FIPS state code to postal abbreviation.
 *
 * us-atlas carries the FIPS code as the geometry id and the full name as a
 * property; it does not carry the postal code, and the rest of this project
 * keys states by postal code (`STATE_SEATS`, the region seeds). This is the
 * join, written out rather than derived, because a wrong guess here would
 * silently mis-colour a state.
 */
const FIPS_TO_CODE: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO',
  '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI',
  '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
  '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY',
};

// The path generator needs no projection: the source is pre-projected.
const path = geoPath();

// `feature()` is typed to return either a Feature or a FeatureCollection
// depending on the object handed to it, and TypeScript cannot tell which from a
// JSON import. `states` is a GeometryCollection, so it is the latter.
const collection = feature(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  topology as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (topology as any).objects.states,
) as unknown as FeatureCollection<Geometry, { name: string }>;

interface Shape {
  code: string;
  name: string;
  d: string;
  labelX: number;
  labelY: number;
}

const shapes: Shape[] = [];
const skipped: string[] = [];

for (const f of collection.features) {
  const fips = String(f.id).padStart(2, '0');
  const code = FIPS_TO_CODE[fips];
  if (!code) {
    skipped.push(`${fips} ${f.properties.name}`);
    continue;
  }

  const d = path(f);
  if (!d) {
    skipped.push(`${fips} ${f.properties.name} (no geometry)`);
    continue;
  }

  const [labelX, labelY] = path.centroid(f);
  shapes.push({
    code,
    name: f.properties.name,
    d,
    // Rounded: the extra digits are noise in a 975-wide box and they make the
    // committed file far larger than it needs to be.
    labelX: Math.round(labelX * 10) / 10,
    labelY: Math.round(labelY * 10) / 10,
  });
}

shapes.sort((a, b) => a.code.localeCompare(b.code));

const header = `/**
 * MAP GEOMETRY — GENERATED FILE, DO NOT EDIT BY HAND
 *
 * Written by \`scripts/make-map-geometry.mts\` from the \`us-atlas\` TopoJSON,
 * already projected to Albers USA in a 975×610 box. Regenerate with:
 *
 *   npx tsx scripts/make-map-geometry.mts
 *
 * These are MODERN state outlines, used as the atomic geometry for every year
 * (brief §6.1, DESIGN.md §8.2). That is a real inaccuracy — Virginia here
 * excludes West Virginia, which did not exist until 1863 — and the map says so
 * on screen rather than leaving a player to find out.
 */

export const MAP_VIEWBOX = { width: 975, height: 610 } as const;

export interface StateShape {
  /** Postal code, matching \`STATE_SEATS\` and the region seeds. */
  code: string;
  /** Modern state name, for the label and the detail panel heading. */
  name: string;
  /** SVG path data in the viewBox above. */
  d: string;
  /** Where to put the label: the projected centroid. */
  labelX: number;
  labelY: number;
}

export const STATE_SHAPES: readonly StateShape[] = [
`;

const body = shapes
  .map(
    (s) =>
      `  { code: ${JSON.stringify(s.code)}, name: ${JSON.stringify(s.name)}, labelX: ${s.labelX}, labelY: ${s.labelY}, d: ${JSON.stringify(s.d)} },`,
  )
  .join('\n');

const footer = `
];

/** Look-up by postal code, for colouring a state from simulation data. */
export const SHAPE_BY_CODE: Readonly<Record<string, StateShape>> =
  Object.fromEntries(STATE_SHAPES.map((s) => [s.code, s]));
`;

mkdirSync('src/content/map', { recursive: true });
const out = 'src/content/map/geometry.ts';
writeFileSync(out, header + body + footer, 'utf8');

console.log(`wrote ${out} — ${shapes.length} states`);
if (skipped.length > 0) console.log(`skipped: ${skipped.join(', ')}`);
if (!existsSync(out)) process.exit(1);
