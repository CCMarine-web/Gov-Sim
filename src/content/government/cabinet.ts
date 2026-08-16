/**
 * CABINET AND OFFICEHOLDERS — 1789 to 1800
 *
 * Historical flavour. In Phase 1 the cabinet has no mechanical effect
 * (UI.md §5.7); the panel exists so Phase 2 has somewhere to put appointments.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AN HONEST LIMITATION, STATED ON SCREEN
 *
 * These tenures follow the real historical record and do NOT respond to the
 * player's choices. In a run that diverges sharply from history, the cabinet
 * will still turn over on its historical schedule. That is a simplification,
 * and the Government screen says so rather than letting the player assume the
 * appointments are theirs.
 *
 * Making the cabinet responsive is a Phase 2 job, alongside succession.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Dates verified 2026-08-15. Sources listed on each office.
 */

export interface Tenure {
  name: string;
  /** ISO date the holder took office. */
  from: string;
  /** ISO date they left, or null if still in office at the end of Phase 1. */
  to: string | null;
  note?: string;
}

export interface Office {
  id: string;
  title: string;
  /** Shown when no holder is in office — the department did not yet exist. */
  createdOn: string;
  tenures: Tenure[];
  sources: string[];
}

const CABINET_SOURCES = [
  'US Senate, "First Cabinet Confirmation"',
  'Mount Vernon Ladies’ Association, "Cabinet Members"',
];

export const OFFICES: Office[] = [
  {
    id: 'treasury',
    title: 'Secretary of the Treasury',
    createdOn: '1789-09-02',
    sources: CABINET_SOURCES,
    tenures: [
      {
        name: 'Alexander Hamilton',
        from: '1789-09-11',
        to: '1795-01-31',
        note:
          'Architect of assumption, the funding system, the Bank, and the ' +
          'whiskey excise. Nearly every fiscal decision in this period is his.',
      },
      { name: 'Oliver Wolcott Jr.', from: '1795-02-02', to: '1800-12-31' },
    ],
  },
  {
    id: 'state',
    title: 'Secretary of State',
    createdOn: '1789-07-27',
    sources: CABINET_SOURCES,
    tenures: [
      {
        name: 'Thomas Jefferson',
        from: '1790-03-22',
        to: '1793-12-31',
        note:
          'Opposed the Bank as unconstitutional and favoured France over ' +
          'Britain. His disagreements with Hamilton became the first party split.',
      },
      { name: 'Edmund Randolph', from: '1794-01-02', to: '1795-08-20' },
      { name: 'Timothy Pickering', from: '1795-08-20', to: '1800-05-12' },
    ],
  },
  {
    id: 'war',
    title: 'Secretary of War',
    createdOn: '1789-08-07',
    sources: CABINET_SOURCES,
    tenures: [
      { name: 'Henry Knox', from: '1789-09-12', to: '1794-12-31' },
      { name: 'Timothy Pickering', from: '1795-01-02', to: '1796-02-05' },
      { name: 'James McHenry', from: '1796-02-06', to: '1800-05-31' },
    ],
  },
  {
    id: 'attorney_general',
    title: 'Attorney General',
    createdOn: '1789-09-24',
    sources: CABINET_SOURCES,
    tenures: [
      {
        name: 'Edmund Randolph',
        from: '1789-09-26',
        to: '1794-01-26',
        note:
          'The only man to hold two of these offices in this period. He took ' +
          'the State Department on 2 January 1794 while remaining Attorney ' +
          'General until the 26th, so for 24 days he held both.',
      },
      { name: 'William Bradford', from: '1794-01-27', to: '1795-08-23' },
      { name: 'Charles Lee', from: '1795-12-10', to: '1800-12-31' },
    ],
  },
];

/**
 * The historical presidency, for the Government screen's note about how the
 * real office turned over while the player did not.
 */
export const HISTORICAL_ADMINISTRATIONS: Tenure[] = [
  {
    name: 'George Washington',
    from: '1789-04-30',
    to: '1797-03-04',
    note: 'Declined a third term, setting the two-term precedent.',
  },
  {
    name: 'John Adams',
    from: '1797-03-04',
    to: '1801-03-04',
    note: 'The first transfer of the office between two people.',
  },
];
