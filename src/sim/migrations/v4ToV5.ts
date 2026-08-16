/**
 * MIGRATION v4 → v5 — grievance, unrest, and a ruler who can die
 *
 * Phase 2 queue item 6 added the price of ruling by decree (brief §2.1):
 *
 *   1. `GameState.grievance` — per bloc and per region, plus the unrest
 *      episodes it has produced.
 *   2. `Ruler.reignNumber` and `Ruler.accededDay`, so a succession has
 *      something to count and something to date.
 *
 * WHAT THIS HAS TO GET RIGHT
 *
 * `grievance` starts EMPTY, and that is the only defensible answer. Grievance is
 * a record of things the government did to particular blocs, and a v4 save
 * contains no such record — the mechanic did not exist while that game was
 * played, so nobody was aggrieved by anything. Deriving a starting grievance
 * from, say, current regional sentiment would invent a history of decrees the
 * player never issued, and then hold them to it.
 *
 * `reignNumber: 0` and `accededDay: 0`: every v4 save is still under its founder,
 * because there was no way for a ruler to die. That is not an assumption, it is
 * the only thing that could have happened.
 */

export function v4ToV5(state: Record<string, unknown>): Record<string, unknown> {
  const ruler = (state.ruler ?? {}) as Record<string, unknown>;

  const BLOCS = [
    'planters',
    'merchants',
    'frontier_settlers',
    'artisans',
    'financiers',
    'clergy',
    'seamen',
    'small_farmers',
  ];
  const REGIONS = ['new_england', 'mid_atlantic', 'south', 'frontier'];

  const byBloc: Record<string, number> = {};
  for (const bloc of BLOCS) byBloc[bloc] = 0;

  const byRegion: Record<string, number> = {};
  for (const region of REGIONS) byRegion[region] = 0;

  return {
    ...state,
    schemaVersion: 5,
    ruler: {
      ...ruler,
      // Every v4 save is still under its founder: there was no way for a ruler
      // to die. Not an assumption — the only thing that could have happened.
      reignNumber: 0,
      accededDay: 0,
    },
    grievance: { byBloc, byRegion, episodes: [] },
  };
}
