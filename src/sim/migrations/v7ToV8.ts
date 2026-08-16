/**
 * MIGRATION v7 → v8 — the world outside
 *
 * Phase 2 queue item 11 added `GameState.diplomacy`: relations with every
 * foreign power, the treaties in force, and the tribute they cost.
 *
 * WHAT THIS HAS TO GET RIGHT
 *
 * Relations start at each power's 1789 BASELINE, and no treaty is in force.
 *
 * That is the only defensible answer, and it is the same one `v4ToV5` gave for
 * grievance and `v6ToV7` gave for blocs. A v7 save contains no record of
 * diplomacy, because there was none to record — the player never sent an envoy
 * and never signed anything. Deriving a relation from, say, the state's current
 * legitimacy would invent a diplomatic history the player never made and then
 * hold them to it; awarding the treaties that were historically signed by the
 * save's date would be worse still, crediting the player with achievements they
 * had no opportunity to attempt.
 *
 * The consequence is honest rather than merely convenient: a save from 1798
 * resumes with Britain still cool and the Jay Treaty unsigned, which is a
 * country that took a different path — not a broken one.
 */

import { seedDiplomacy } from '../diplomacy';

export function v7ToV8(state: Record<string, unknown>): Record<string, unknown> {
  return {
    ...state,
    schemaVersion: 8,
    diplomacy: seedDiplomacy(),
  };
}
