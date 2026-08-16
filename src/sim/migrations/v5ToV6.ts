/**
 * MIGRATION v5 → v6 — Congress arrives
 *
 * Phase 2 queue item 7 added `GameState.congress`: the delegations, their party
 * shares, the cooldowns on defeated bills, the obligations from log-rolling, and
 * the count of divisions the government has lost.
 *
 * WHAT THIS HAS TO GET RIGHT
 *
 * The legislature has to be SEATED FOR THE DAY THE SAVE IS ON, not for day zero.
 * A save at 1796 must load into the Fourth Congress with Vermont, Kentucky and
 * Tennessee in it and with the Federalists and Democratic-Republicans in
 * existence — seating the First Congress would put eleven states and two
 * informal interests into a country that by then had sixteen states and two
 * parties.
 *
 * So the migration derives the Congress number from the date, and builds the
 * delegations from the same seat record and the same sentiment the running game
 * uses. It is not a guess: every input is present in the save.
 *
 * Cooldowns, obligations and defeats all start empty, and that is the only
 * defensible answer. A v5 save contains no record of votes, because there were
 * no votes — every bill in it passed by the player's own hand. Inventing a
 * legislative history would be inventing defeats the player never suffered.
 *
 * For the same reason the Senate starts matching the House. Two thirds of a
 * real Senate is the class elected at a previous election (ECONOMY.md §7.20),
 * and a v5 save has no previous election in it. The two chambers diverge from
 * the next election onward. A one-time loss of nuance in a migrated save beats
 * a fabricated one.
 */

import { PARTIES, STATE_SEATS } from '@/content/government/congress';
import { dayToDate } from '../calendar';
import { seatCongress } from '../congress';

/**
 * Which Congress is sitting on `day`.
 *
 * The First convened on 4 March 1789 and each sits two years, so the number is
 * how many two-year terms have begun since. Computed rather than stored,
 * because a date is the only thing a v5 save has to go on.
 */
function congressNumberFor(day: number): number {
  const date = dayToDate(day);
  // Terms begin on 4 March of odd years: 1789, 1791, 1793…
  const yearsSince =
    date.year - 1789 - (date.month < 3 || (date.month === 3 && date.day < 4) ? 1 : 0);
  return Math.max(1, Math.floor(yearsSince / 2) + 1);
}

export function v5ToV6(state: Record<string, unknown>): Record<string, unknown> {
  const day = typeof state.day === 'number' ? state.day : 0;

  const regions = Array.isArray(state.regions)
    ? (state.regions as Array<Record<string, unknown>>)
    : [];

  const sentimentByRegion: Record<string, number> = {};
  for (const region of regions) {
    if (typeof region.id === 'string' && typeof region.sentiment === 'number') {
      sentimentByRegion[region.id] = region.sentiment;
    }
  }

  return {
    ...state,
    schemaVersion: 6,
    congress: seatCongress({
      day,
      number: congressNumberFor(day),
      stateSeats: STATE_SEATS,
      parties: PARTIES,
      sentimentByRegion,
      // No previous Congress: cooldowns, obligations and defeats all start
      // empty, because a v5 save records no votes — there were none to record.
    }),
  };
}
