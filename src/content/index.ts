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
import { LAWS_1790S } from './laws/laws1790s';

export const CONTENT_VERSION = '1790s.1';

export const PHASE_1_CONTENT: ContentPack = {
  version: CONTENT_VERSION,
  events: EVENTS_1790S,
  laws: LAWS_1790S,
};

export { EVENTS_1790S, LAWS_1790S };
export { REGION_SEEDS, CENSUS_1790_TOTALS } from './regions/regions1790';
