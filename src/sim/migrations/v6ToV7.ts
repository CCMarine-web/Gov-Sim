/**
 * MIGRATION v6 → v7 — the country becomes something that can change
 *
 * Phase 2 queue item 8 added `GameState.blocs`: overlapping, graduated bloc
 * membership per region, and the day-0 economy every later target is measured
 * against. Until v7 a bloc was a row in a static table and could not move.
 *
 * WHAT THIS HAS TO GET RIGHT
 *
 * There are two candidate answers and only one is defensible.
 *
 *   (a) SEED THE FOUNDING SHARES. Every save resumes with the country made of
 *       the same people it was made of in 1789.
 *   (b) DERIVE SHARES FROM THE SAVE'S CURRENT ECONOMY, as if the drift had been
 *       running all along.
 *
 * (b) is tempting and wrong. It would invent a decade of occupational change
 * the player never caused and then present it as their record — a save whose
 * whole legislative history is three tariffs would load into a country of
 * artisans it never made. The same reasoning that seeds grievance empty in
 * v4ToV5 applies here: a v6 save contains no record of blocs moving, because
 * they could not move. (a) it is.
 *
 * THE DENOMINATORS ARE THE HARDER HALF, and this is where the migration earns
 * its keep. Every driver in the model is a ratio to its founding value. A v6
 * save from 1798 has an economy that has grown for nine years, so measuring it
 * against TODAY'S figures would read as "nothing has changed" and freeze the
 * model — while measuring it against the real 1789 figures, which the save does
 * not contain, is impossible.
 *
 * So the denominators are the save's own current economy, and the shares are the
 * founding ones. In effect the save's present is declared to be its baseline:
 * the country is what it is, and it changes from here. That is a deliberate,
 * documented choice rather than an accident of ordering, and it means a migrated
 * save behaves like a new game started in 1798 rather than like one that has
 * been quietly running a model it never had.
 */

import { BLOC_MEMBERSHIP_1790 } from '../calibration';

interface Regionish {
  id?: unknown;
  population?: unknown;
  enslavedPopulation?: unknown;
  tradeVolume?: unknown;
  manufacturingOutput?: unknown;
  agriculturalOutput?: unknown;
  prosperity?: unknown;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function v6ToV7(state: Record<string, unknown>): Record<string, unknown> {
  const regions = Array.isArray(state.regions) ? (state.regions as Regionish[]) : [];

  const membership: Record<string, Record<string, number>> = {};
  const baseDrivers: Record<string, Record<string, number>> = {};

  for (const region of regions) {
    if (typeof region.id !== 'string') continue;

    membership[region.id] = { ...(BLOC_MEMBERSHIP_1790[region.id] ?? {}) };

    const head = Math.max(1, num(region.population, 1));
    baseDrivers[region.id] = {
      tradePerHead: num(region.tradeVolume, 0) / head,
      manufacturingPerHead: num(region.manufacturingOutput, 0) / head,
      agriculturePerHead: num(region.agriculturalOutput, 0) / head,
      enslavedShare: num(region.enslavedPopulation, 0) / head,
      prosperity: Math.max(1, num(region.prosperity, 50)),
      population: head,
    };
  }

  return {
    ...state,
    schemaVersion: 7,
    blocs: {
      membership,
      baseDrivers,
      // The drift has not run in this save because it could not. Dating it to
      // the save's own day means the first drift happens on the next 1st of the
      // month, exactly as it would in a game that had always had the model.
      lastDriftDay: typeof state.day === 'number' ? state.day : 0,
    },
  };
}
