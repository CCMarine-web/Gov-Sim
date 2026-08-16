/**
 * OFFICES
 *
 * Reading the historical office record: which departments exist on a given day,
 * and which of them have someone in post.
 *
 * Pure and calendar-driven. Content declares the tenures with real dates and
 * real citations; this module interprets them, which is DESIGN.md Rule 4
 * working normally — adding an office is a content edit.
 *
 * The engine cares because a government cannot execute what it has no one to
 * execute: this feeds administrative capacity, which feeds political capital
 * accrual (ECONOMY.md §7.17).
 */

import { isoToDay } from './calendar';
import type { Office, Tenure } from './types';

/** Has this office been created by `day`? */
export function officeExists(office: Office, day: number): boolean {
  return day >= isoToDay(office.createdOn);
}

/**
 * Who holds this office on `day`, or null for a vacancy.
 *
 * Strict: a holder whose `to` date has passed is gone, and a genuine gap
 * between appointments reads as a vacancy, because it was one. `to: null` means
 * still in post with no recorded end.
 *
 * What this does NOT handle is the day running past the end of the content
 * record entirely — that is a different question with a different answer, and
 * it belongs to `censusOfOffices`.
 */
export function holderOn(office: Office, day: number): Tenure | null {
  for (const tenure of office.tenures) {
    const from = isoToDay(tenure.from);
    if (day < from) continue;
    if (tenure.to === null) return tenure;
    if (day <= isoToDay(tenure.to)) return tenure;
  }
  return null;
}

/**
 * The last day the office record says anything about.
 *
 * Beyond this the content simply stops. That is not the same as every office
 * in the United States falling vacant on 1 January 1801, and the difference
 * matters now that uncapped speed carries a player past the end of the content
 * in seconds (BLOCKERS.md B-005).
 *
 * Returns null when no office has a recorded end — every holder is open-ended,
 * so the record never runs out.
 */
export function recordEndDay(offices: Office[]): number | null {
  let end: number | null = null;

  for (const office of offices) {
    for (const tenure of office.tenures) {
      // An open-ended tenure means the record does not run out for this office,
      // so there is no horizon to clamp to.
      if (tenure.to === null) return null;
      const to = isoToDay(tenure.to);
      if (end === null || to > end) end = to;
    }
  }

  return end;
}

export interface OfficeCensus {
  /** Offices that had been created by this day. */
  created: number;
  /** Of those, how many have someone in post. */
  filled: number;
  /** Offices the content pack describes at all. */
  total: number;
}

/**
 * Count the state of the administration on one day.
 *
 * PAST THE END OF THE RECORD the day is clamped to the last day the content
 * describes, so the census reports the administration as it stood then. The
 * alternative — reading a day past every recorded tenure and finding every
 * office vacant — would collapse administrative capacity to zero on 1 January
 * 1801 and take political capital accrual with it, for no reason the player
 * caused. The content running out is a gap in the content, not an event in the
 * game. (BLOCKERS.md B-005)
 */
export function censusOfOffices(offices: Office[], day: number): OfficeCensus {
  const end = recordEndDay(offices);
  const asAt = end !== null && day > end ? end : day;

  let created = 0;
  let filled = 0;

  for (const office of offices) {
    if (!officeExists(office, asAt)) continue;
    created += 1;
    if (holderOn(office, asAt) !== null) filled += 1;
  }

  return { created, filled, total: offices.length };
}
