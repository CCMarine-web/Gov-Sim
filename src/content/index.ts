/**
 * THE CONTENT PACK
 *
 * Everything the engine reads that is not state. Pure data, no functions.
 * `advanceDay(state, content)` is a function of exactly these two inputs.
 *
 * Bumping `CONTENT_VERSION` records that content changed. Saves store the
 * version they were created under, so a save can report which content it
 * expects even when the schema itself has not moved.
 */

import type { ContentPack } from '@/sim/types';
import { EVENTS_1790S } from './events/events1790s';
import { EVENTS_1790S_ADDITIONAL } from './events/events1790sAdditional';
import { BILLS_1790S } from './bills';
import { OFFICES } from './government/cabinet';
import { PARTIES, STATE_SEATS } from './government/congress';

export const CONTENT_VERSION = '1790s.4';

const ALL_EVENTS = [...EVENTS_1790S, ...EVENTS_1790S_ADDITIONAL];

export const PHASE_1_CONTENT: ContentPack = {
  version: CONTENT_VERSION,
  events: ALL_EVENTS,
  bills: BILLS_1790S,
  /*
    The offices are read by the ENGINE, not only by the Government screen: how
    much of the administration exists and is staffed drives political capital
    accrual (ECONOMY.md §7.17). They moved into the content pack in Phase 2
    item 4 for that reason.
  */
  offices: OFFICES,
  /* The legislature the republic has to carry. (brief §2.2) */
  parties: PARTIES,
  stateSeats: STATE_SEATS,
};

export { EVENTS_1790S, EVENTS_1790S_ADDITIONAL, BILLS_1790S, OFFICES, PARTIES, STATE_SEATS };
export { REGION_SEEDS, CENSUS_1790_TOTALS } from './regions/regions1790';
