/**
 * MIGRATION v8 → v9 — wars become a record
 *
 * Phase 2 queue item 12 added `DiplomacyState.wars`. In v8 diplomacy existed
 * but there was no way to declare a war, so `PowerRelation.atWar` was present
 * and always false.
 *
 * The migration is therefore the smallest one in the project: an empty list. A
 * v8 save fought no wars because it could not, and the fields that record them
 * start empty for the same reason grievance did in `v4ToV5`. It is included
 * rather than folded into the previous migration because a save written under
 * v8 is a real save that a real person may hold, and the rule is one function
 * per version with a fixture behind it.
 */

export function v8ToV9(state: Record<string, unknown>): Record<string, unknown> {
  const diplomacy =
    typeof state.diplomacy === 'object' && state.diplomacy !== null
      ? (state.diplomacy as Record<string, unknown>)
      : {};

  return {
    ...state,
    schemaVersion: 9,
    diplomacy: { ...diplomacy, wars: [] },
  };
}
