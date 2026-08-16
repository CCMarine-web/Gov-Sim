/**
 * CONGRESS — SEATS AND PARTIES, 1789 to 1800
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT HERE IS HISTORY AND WHAT IS MODEL
 *
 * The SEAT COUNTS are history. The Constitution fixed the first House at 65 and
 * named each state's share; the Apportionment Act of 1792 set it at 105 from the
 * Third Congress; the Senate is two per state by Article I §3; and the admission
 * dates of Vermont, Kentucky and Tennessee are matters of record. All of it is
 * cited below.
 *
 * The PARTY SPLIT of those seats is a MODEL. Party affiliation in the 1790s was
 * informal — the Congressional Biographical Directory labels the first two
 * Congresses only "Pro-Administration" and "Anti-Administration", because
 * nothing more formal existed — and a state-by-state party breakdown for every
 * Congress is not something this project has sourced. So the split is derived
 * from each region's economic character and its sentiment toward the federal
 * government, and it is a calibration constant rather than a historical claim.
 * `docs/ECONOMY.md` §7.20 says so, `docs/BLOCKERS.md` B-006 records what would
 * improve it, and no screen presents it as a historical figure.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Party, StateSeats } from '@/sim/types';

/**
 * Seats by state, with the dates that changed them.
 *
 * `fromDay` entries are read in order; the last one whose date has passed is in
 * force. Maine is absent because it was a district of Massachusetts until 1820,
 * and the Southwest Territory is absent because a territory sent a non-voting
 * delegate, not members.
 */
export const STATE_SEATS: StateSeats[] = [
  // --- The original eleven, seated in the First Congress ------------------
  { code: 'NH', name: 'New Hampshire', regionId: 'new_england', admittedOn: '1788-06-21', house: [{ from: '1789-03-04', seats: 3 }, { from: '1793-03-04', seats: 4 }] },
  { code: 'MA', name: 'Massachusetts', regionId: 'new_england', admittedOn: '1788-02-06', house: [{ from: '1789-03-04', seats: 8 }, { from: '1793-03-04', seats: 14 }] },
  { code: 'CT', name: 'Connecticut', regionId: 'new_england', admittedOn: '1788-01-09', house: [{ from: '1789-03-04', seats: 5 }, { from: '1793-03-04', seats: 7 }] },
  { code: 'NY', name: 'New York', regionId: 'mid_atlantic', admittedOn: '1788-07-26', house: [{ from: '1789-03-04', seats: 6 }, { from: '1793-03-04', seats: 10 }] },
  { code: 'NJ', name: 'New Jersey', regionId: 'mid_atlantic', admittedOn: '1787-12-18', house: [{ from: '1789-03-04', seats: 4 }, { from: '1793-03-04', seats: 5 }] },
  { code: 'PA', name: 'Pennsylvania', regionId: 'mid_atlantic', admittedOn: '1787-12-12', house: [{ from: '1789-03-04', seats: 8 }, { from: '1793-03-04', seats: 13 }] },
  { code: 'DE', name: 'Delaware', regionId: 'mid_atlantic', admittedOn: '1787-12-07', house: [{ from: '1789-03-04', seats: 1 }] },
  { code: 'MD', name: 'Maryland', regionId: 'south', admittedOn: '1788-04-28', house: [{ from: '1789-03-04', seats: 6 }, { from: '1793-03-04', seats: 8 }] },
  { code: 'VA', name: 'Virginia', regionId: 'south', admittedOn: '1788-06-25', house: [{ from: '1789-03-04', seats: 10 }, { from: '1793-03-04', seats: 19 }] },
  { code: 'SC', name: 'South Carolina', regionId: 'south', admittedOn: '1788-05-23', house: [{ from: '1789-03-04', seats: 5 }, { from: '1793-03-04', seats: 6 }] },
  { code: 'GA', name: 'Georgia', regionId: 'south', admittedOn: '1788-01-02', house: [{ from: '1789-03-04', seats: 3 }, { from: '1793-03-04', seats: 2 }] },

  // --- Ratified after the government had already convened ------------------
  { code: 'NC', name: 'North Carolina', regionId: 'south', admittedOn: '1789-11-21', house: [{ from: '1789-11-21', seats: 5 }, { from: '1793-03-04', seats: 10 }] },
  { code: 'RI', name: 'Rhode Island', regionId: 'new_england', admittedOn: '1790-05-29', house: [{ from: '1790-05-29', seats: 1 }, { from: '1793-03-04', seats: 2 }] },

  // --- Admitted during the period ------------------------------------------
  { code: 'VT', name: 'Vermont', regionId: 'new_england', admittedOn: '1791-03-04', house: [{ from: '1791-03-04', seats: 2 }] },
  { code: 'KY', name: 'Kentucky', regionId: 'frontier', admittedOn: '1792-06-01', house: [{ from: '1792-06-01', seats: 2 }] },
  { code: 'TN', name: 'Tennessee', regionId: 'frontier', admittedOn: '1796-06-01', house: [{ from: '1796-06-01', seats: 1 }] },
];

export const SEAT_SOURCES = [
  'U.S. Const. art. I, § 2, cl. 3 (the original allocation of 65 House seats)',
  'U.S. Const. art. I, § 3, cl. 1 (two senators per state)',
  'Apportionment Act of 1792, 1 Stat. 253 (14 April 1792) — 105 seats from the Third Congress',
  'US House of Representatives, "Party Divisions of the House of Representatives, 1789 to Present"',
];

/**
 * THE PARTIES.
 *
 * A party here is defined by WHOSE INTERESTS IT SERVES — its `blocAffinity` —
 * rather than by a list of positions on issue axes. That is a deliberate
 * modelling choice and `docs/DECISIONS.md` D-030 argues it: a party in this
 * period was a coalition of interests before it was a programme, the bills
 * already declare which interests they help and harm, and encoding a party the
 * same way means a new bill needs no new field and cannot be silently
 * mis-positioned.
 *
 * `historicalNote` is factual and carries sources, like every other content
 * type in this project.
 */
export const PARTIES: Party[] = [
  {
    id: 'pro_administration',
    name: 'The Pro-Administration interest',
    shortName: 'Pro-Adm.',
    activeFrom: '1789-03-04',
    activeUntil: '1793-03-04',
    discipline: 0.45,
    blocAffinity: {
      financiers: 0.9,
      merchants: 0.8,
      artisans: 0.35,
      seamen: 0.3,
      clergy: 0.2,
      planters: -0.2,
      small_farmers: -0.35,
      frontier_settlers: -0.4,
    },
    historicalNote:
      'There were no formal parties in the First and Second Congresses. Members ' +
      'divided over Hamilton’s programme — assumption, funding, the Bank, the ' +
      'excise — and the Congressional Biographical Directory labels them only ' +
      '"Pro-Administration" and "Anti-Administration" for exactly that reason. ' +
      'Discipline was correspondingly weak: members voted their state and their ' +
      'interest far more reliably than they voted a line.',
    sources: [
      'Biographical Directory of the United States Congress, 1st and 2nd Congresses',
    ],
  },
  {
    id: 'anti_administration',
    name: 'The Anti-Administration interest',
    shortName: 'Anti-Adm.',
    activeFrom: '1789-03-04',
    activeUntil: '1793-03-04',
    discipline: 0.4,
    blocAffinity: {
      planters: 0.85,
      small_farmers: 0.8,
      frontier_settlers: 0.6,
      clergy: 0.1,
      seamen: -0.1,
      artisans: -0.2,
      merchants: -0.6,
      financiers: -0.9,
    },
    historicalNote:
      'Madison led the opposition to assumption and to the Bank from within the ' +
      'House, arguing that Congress held only enumerated powers and that the ' +
      'funding system enriched speculators at the expense of the original ' +
      'holders of the debt. It was an interest rather than an organisation: no ' +
      'whips, no caucus, and no name its members used of themselves.',
    sources: [
      'Biographical Directory of the United States Congress, 1st and 2nd Congresses',
      'Annals of Congress, 1st Cong., 2nd Sess. (February 1790)',
    ],
  },
  {
    id: 'federalist',
    name: 'The Federalist Party',
    shortName: 'Fed.',
    activeFrom: '1793-03-04',
    activeUntil: null,
    discipline: 0.68,
    blocAffinity: {
      financiers: 0.95,
      merchants: 0.85,
      artisans: 0.4,
      seamen: 0.35,
      clergy: 0.45,
      planters: -0.25,
      small_farmers: -0.45,
      frontier_settlers: -0.5,
    },
    historicalNote:
      'By the Third Congress the divisions of the first two had hardened into ' +
      'something recognisably a party: for federal power, for the funding system ' +
      'and the Bank, for commerce, and for accommodation with Britain. It held ' +
      'the presidency until 1801 and never won it again. Its strength was New ' +
      'England and the commercial towns.',
    sources: [
      'Biographical Directory of the United States Congress, 3rd Congress onward',
      'Jay Treaty debates, Annals of Congress, 4th Cong., 1st Sess. (1796)',
    ],
  },
  {
    id: 'democratic_republican',
    name: 'The Democratic-Republican Party',
    shortName: 'Dem.-Rep.',
    activeFrom: '1793-03-04',
    activeUntil: null,
    discipline: 0.62,
    blocAffinity: {
      planters: 0.9,
      small_farmers: 0.85,
      frontier_settlers: 0.7,
      clergy: 0.05,
      seamen: -0.05,
      artisans: -0.1,
      merchants: -0.65,
      financiers: -0.95,
    },
    historicalNote:
      'Organised out of the anti-administration interest from 1792, around ' +
      'Jefferson and Madison and the Democratic-Republican societies that ' +
      'multiplied after 1793. For states’ rights, for agriculture, against the ' +
      'funding system, and sympathetic to France. Its strength was the South and ' +
      'the west, and it took the presidency in 1801.',
    sources: [
      'Biographical Directory of the United States Congress, 3rd Congress onward',
      'National Gazette (Philip Freneau, ed.), 1791-1793',
    ],
  },
];

/** The day the informal interests become organised parties. */
export const PARTY_FORMATION_DATE = '1793-03-04';
