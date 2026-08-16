/**
 * THE BILL SLATE — 1789 to 1800
 *
 * Legislation the player may introduce, as distinct from events, which arrive
 * on their own schedule and demand an answer.
 *
 * Split across three files by subject rather than kept in one: the slate will
 * keep growing through Phase 2 and beyond, and one file of four thousand lines
 * is not reviewable.
 *
 *   fiscal.ts      taxation, trade and tariffs, banking and currency
 *   government.ts  military, judiciary, administration, posts, public works
 *   society.ts     land, immigration, slavery, education, health, agriculture,
 *                  labour, foreign affairs
 *
 * A test asserts the slate meets the brief's floor — at least 25 bills, across
 * at least six departments, with all four historicity tiers represented — so
 * that shrinking it is a deliberate act rather than an accident.
 */

import type { Bill } from '@/sim/types';
import { FISCAL_BILLS } from './fiscal';
import { GOVERNMENT_BILLS } from './government';
import { SOCIETY_BILLS } from './society';

export const BILLS_1790S: Bill[] = [
  ...FISCAL_BILLS,
  ...GOVERNMENT_BILLS,
  ...SOCIETY_BILLS,
];

export { FISCAL_BILLS, GOVERNMENT_BILLS, SOCIETY_BILLS };
