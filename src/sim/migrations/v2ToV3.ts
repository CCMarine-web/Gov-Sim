/**
 * MIGRATION v2 → v3 — political capital arrives
 *
 * Phase 2 queue item 4 added `GameState.politicalCapital` and
 * `NationStats.administrativeCapacity`. A v2 save has neither.
 *
 * WHAT THIS HAS TO GET RIGHT
 *
 * The new fields have to be seeded to something defensible, because a save is
 * resumed mid-run and there is no "correct" prior value to recover — political
 * capital did not exist while that game was played, so no amount of it was
 * earned or spent.
 *
 * The choice made here: seed the STOCK generously, at the base cap, and leave
 * the rate and cap at their defaults for the next monthly recompute to set
 * properly. Seeding at zero would punish a player for having saved before a
 * feature existed, which is the wrong way round — the mechanic is new, so its
 * absence was not their choice. Seeding at the cap is the forgiving reading and
 * costs nothing: the cap will reassert itself within a month, and hoarding is
 * already prevented by the cap rather than by the starting value.
 *
 * `administrativeCapacity` is seeded to zero rather than guessed, because it is
 * computed from the office record on the first of the month and any value put
 * here would be overwritten within thirty-one days by the correct one. A guess
 * that is about to be replaced is worse than a zero that is about to be
 * replaced, because someone might believe the guess.
 *
 * Lifetime totals start at zero and say so: they are a record of this feature's
 * use, and this game has not used it yet.
 */

import { BASE_CAPITAL_CAP } from '../calibration';

export function v2ToV3(state: Record<string, unknown>): Record<string, unknown> {
  const nation = (state.nation ?? {}) as Record<string, unknown>;

  return {
    ...state,
    schemaVersion: 3,
    nation: {
      ...nation,
      administrativeCapacity: 0,
    },
    politicalCapital: {
      current: BASE_CAPITAL_CAP,
      modelTargets: { accrual: 0, cap: BASE_CAPITAL_CAP },
      accrualPerDay: 0,
      cap: BASE_CAPITAL_CAP,
      emergency: null,
      totalAccrued: 0,
      totalSpent: 0,
      totalWasted: 0,
    },
  };
}
