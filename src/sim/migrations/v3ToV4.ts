/**
 * MIGRATION v3 → v4 — bills replace laws, and modifiers learn to phase in
 *
 * Phase 2 queue item 5 made legislation the heart of the game (brief §4). Two
 * shape changes follow from it:
 *
 *   1. `policies.enactedLawIds: string[]` becomes `policies.bills:
 *      EnactedBill[]`. The old form could record only THAT a law had passed —
 *      not when, not at what intensity, and not that it had since been repealed.
 *
 *   2. `Modifier` gains `rampDays`, so a bill's effects can phase in rather than
 *      landing whole on the day it is signed.
 *
 * WHAT THIS HAS TO GET RIGHT
 *
 * `enactedDay: 0` for every carried-forward bill. The old form recorded no
 * enactment day, and there is no way to recover one — so the honest answer is
 * the founding, not the day the save happened to be loaded. Claiming the
 * Judiciary Act was passed in 1794 because that is when the player upgraded
 * would be a fabrication in the game's own record of itself.
 *
 * `sliderValue: null` likewise. A bill passed under v3 had no intensity to set,
 * so the migrated record says it has none. Slider bills carried forward this way
 * behave as if set at the bottom of their range until the player amends them,
 * which is the conservative reading: it never awards an intensity nobody chose.
 *
 * `rampDays: 0` on every existing modifier. They were applied under a build with
 * no phase-in, so they were fully in force; retro-fitting a ramp would weaken
 * effects a player has already been living with.
 */

export function v3ToV4(state: Record<string, unknown>): Record<string, unknown> {
  const policies = (state.policies ?? {}) as Record<string, unknown>;

  const enactedLawIds = Array.isArray(policies.enactedLawIds)
    ? (policies.enactedLawIds as string[])
    : [];

  const bills = enactedLawIds.map((billId) => ({
    billId,
    enactedDay: 0,
    repealedDay: null,
    sliderValue: null,
  }));

  const nextPolicies: Record<string, unknown> = { ...policies, bills };
  // Dropped rather than kept alongside: one fact in two places is the drift the
  // project rules forbid, and the stale copy is the one a future reader trusts.
  delete nextPolicies.enactedLawIds;

  const activeModifiers = Array.isArray(state.activeModifiers)
    ? (state.activeModifiers as Array<Record<string, unknown>>).map((m) => ({
        ...m,
        rampDays: 0,
      }))
    : [];

  return {
    ...state,
    schemaVersion: 4,
    policies: nextPolicies,
    activeModifiers,
  };
}
