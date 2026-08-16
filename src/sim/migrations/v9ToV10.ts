/**
 * MIGRATION v9 → v10 — the cabinet becomes the player's
 *
 * Phase 2 queue item 13 added `GameState.cabinet`: the offices the player has
 * filled themselves, with the loyalty of each appointee.
 *
 * IT STARTS EMPTY, and that is not a loss.
 *
 * `cabinet.appointments` holds only what the PLAYER has done. Every office
 * without an entry falls back to the historical record, which is exactly how a
 * v9 save already behaved — its cabinet was the historical one throughout,
 * because there was no way to appoint anybody. So an empty appointments map
 * reproduces the old behaviour precisely rather than approximating it, and this
 * is the rare migration that is genuinely behaviour-preserving by construction.
 *
 * The alternative — writing the historical holders in as though the player had
 * chosen them — would credit the player with appointments they never made, and
 * would then subject those men to a loyalty they were never at risk of losing.
 */

export function v9ToV10(state: Record<string, unknown>): Record<string, unknown> {
  return {
    ...state,
    schemaVersion: 10,
    cabinet: { appointments: {}, resignations: [] },
  };
}
