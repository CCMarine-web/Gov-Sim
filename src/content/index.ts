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
import { LAWS_1790S } from './laws/laws1790s';
import { OFFICES } from './government/cabinet';

export const CONTENT_VERSION = '1790s.3';

const ALL_EVENTS = [...EVENTS_1790S, ...EVENTS_1790S_ADDITIONAL];

export const PHASE_1_CONTENT: ContentPack = {
  version: CONTENT_VERSION,
  events: ALL_EVENTS,
  laws: LAWS_1790S,
  /*
    The offices are read by the ENGINE, not only by the Government screen: how
    much of the administration exists and is staffed drives political capital
    accrual (ECONOMY.md §7.17). They moved into the content pack in Phase 2
    item 4 for that reason.
  */
  offices: OFFICES,
};

export { EVENTS_1790S, EVENTS_1790S_ADDITIONAL, LAWS_1790S, OFFICES };
export { REGION_SEEDS, CENSUS_1790_TOTALS } from './regions/regions1790';
