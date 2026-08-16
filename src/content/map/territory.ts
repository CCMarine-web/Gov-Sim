/**
 * TERRITORY — what each piece of the map was, and when it changed
 *
 * Phase 2 brief §6.1. The geometry is modern state outlines (see
 * `geometry.ts`); this is the record of what those outlines actually WERE on a
 * given day, so the political map shows 1789 rather than 1959.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS BENCHMARK DATA, NOT CALIBRATION (DESIGN.md §12.2)
 *
 * Every date here is a claim about what really happened, so every record cites
 * its source and nothing is interpolated. Where the answer is genuinely
 * complicated — the Southwest Territory, the Yazoo strip, the Oregon Country —
 * the record says so in `note` rather than picking the tidier of two truths.
 *
 * Dates are the day the status took effect. Admission dates are the ones
 * conventionally recorded for each state; territorial dates are the day the
 * organic act took effect.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ORDER MATTERS. `history` is in date order and the LAST entry whose date has
 * passed is in force. A record with no entry on or before the current day is
 * unorganized and unclaimed as far as the United States is concerned, which for
 * most of this map in 1789 is the honest answer.
 */

export type TerritoryStatus =
  /** In the union, with representation. */
  | 'state'
  /** Under a territorial government created by act of Congress. */
  | 'organized_territory'
  /** Claimed by the United States, no territorial government. */
  | 'unorganized'
  /** Has applied for admission and is awaiting an act of Congress. */
  | 'petitioning'
  /** Held by another sovereign power. */
  | 'foreign'
  /** Claimed by more than one power, with no settlement. */
  | 'disputed'
  /** The land of a sovereign Native nation. */
  | 'native_nation';

export interface TerritoryEntry {
  /** ISO date the status took effect. */
  from: string;
  status: TerritoryStatus;
  /** What it was CALLED then. "Southwest Territory", not "Tennessee". */
  name: string;
  /** Where the simple answer would be misleading. Shown in the detail panel. */
  note?: string;
}

export interface TerritoryRecord {
  /** Postal code of the modern shape this describes. */
  code: string;
  history: TerritoryEntry[];
  sources: string[];
}

const STATUTES = 'United States Statutes at Large';
const ORDINANCE =
  'An Ordinance for the Government of the Territory of the United States North-West of the River Ohio (13 July 1787)';

/**
 * THE ELEVEN THAT HAD RATIFIED when the government began, plus the two that
 * had not.
 *
 * The Constitution took effect between the ratifying states on 4 March 1789.
 * North Carolina and Rhode Island were outside it until they ratified — which
 * is a real political fact and not a technicality, and the map shows it.
 */
export const TERRITORY: readonly TerritoryRecord[] = [
  // ==========================================================================
  // THE ORIGINAL THIRTEEN
  // ==========================================================================
  {
    code: 'DE',
    history: [{ from: '1789-03-04', status: 'state', name: 'Delaware' }],
    sources: ['Ratified the Constitution 7 December 1787'],
  },
  {
    code: 'PA',
    history: [{ from: '1789-03-04', status: 'state', name: 'Pennsylvania' }],
    sources: ['Ratified 12 December 1787'],
  },
  {
    code: 'NJ',
    history: [{ from: '1789-03-04', status: 'state', name: 'New Jersey' }],
    sources: ['Ratified 18 December 1787'],
  },
  {
    code: 'GA',
    history: [
      {
        from: '1789-03-04',
        status: 'state',
        name: 'Georgia',
        note:
          'Georgia also claimed the land west to the Mississippi. It ceded those ' +
          'claims to the United States in 1802, after the Yazoo land sales.',
      },
    ],
    sources: ['Ratified 2 January 1788'],
  },
  {
    code: 'CT',
    history: [{ from: '1789-03-04', status: 'state', name: 'Connecticut' }],
    sources: ['Ratified 9 January 1788'],
  },
  {
    code: 'MA',
    history: [
      {
        from: '1789-03-04',
        status: 'state',
        name: 'Massachusetts',
        note:
          'The District of Maine was part of Massachusetts until 1820, so the ' +
          'modern outline understates the state by about half its area.',
      },
    ],
    sources: ['Ratified 6 February 1788'],
  },
  {
    code: 'MD',
    history: [{ from: '1789-03-04', status: 'state', name: 'Maryland' }],
    sources: ['Ratified 28 April 1788'],
  },
  {
    code: 'SC',
    history: [{ from: '1789-03-04', status: 'state', name: 'South Carolina' }],
    sources: ['Ratified 23 May 1788'],
  },
  {
    code: 'NH',
    history: [{ from: '1789-03-04', status: 'state', name: 'New Hampshire' }],
    sources: ['Ratified 21 June 1788 — the ninth state, which put the Constitution into effect'],
  },
  {
    code: 'VA',
    history: [
      {
        from: '1789-03-04',
        status: 'state',
        name: 'Virginia',
        note:
          'The modern outline excludes West Virginia, which was not separated ' +
          'until 1863, and excludes Kentucky, which Virginia held until 1792.',
      },
    ],
    sources: ['Ratified 25 June 1788'],
  },
  {
    code: 'NY',
    history: [{ from: '1789-03-04', status: 'state', name: 'New York' }],
    sources: ['Ratified 26 July 1788'],
  },
  {
    code: 'NC',
    history: [
      {
        from: '1789-03-04',
        status: 'foreign',
        name: 'State of North Carolina',
        note:
          'Outside the union at the founding. North Carolina rejected the ' +
          'Constitution at Hillsborough in 1788 and did not ratify until the ' +
          'Bill of Rights had been proposed.',
      },
      { from: '1789-11-21', status: 'state', name: 'North Carolina' },
    ],
    sources: ['Ratified 21 November 1789'],
  },
  {
    code: 'RI',
    history: [
      {
        from: '1789-03-04',
        status: 'foreign',
        name: 'State of Rhode Island and Providence Plantations',
        note:
          'Outside the union at the founding, and the last of the thirteen to ' +
          'come in — by two votes, and under the threat of being treated as a ' +
          'foreign state for customs purposes.',
      },
      { from: '1790-05-29', status: 'state', name: 'Rhode Island' },
    ],
    sources: ['Ratified 29 May 1790'],
  },

  // ==========================================================================
  // ADMITTED IN THE FIRST DECADE
  // ==========================================================================
  {
    code: 'VT',
    history: [
      {
        from: '1789-03-04',
        status: 'disputed',
        name: 'Vermont Republic',
        note:
          'Governing itself since 1777 and claimed by New York. It was admitted ' +
          'once New York gave up the claim, which is why it came in first.',
      },
      { from: '1791-03-04', status: 'state', name: 'Vermont' },
    ],
    sources: ['Act of 18 February 1791; admitted 4 March 1791'],
  },
  {
    code: 'KY',
    history: [
      {
        from: '1789-03-04',
        status: 'unorganized',
        name: 'Kentucky District, Virginia',
        note: 'Part of Virginia, and separated with Virginia’s consent.',
      },
      { from: '1792-06-01', status: 'state', name: 'Kentucky' },
    ],
    sources: ['Act of 4 February 1791; admitted 1 June 1792'],
  },
  {
    code: 'TN',
    history: [
      {
        from: '1790-05-26',
        status: 'organized_territory',
        name: 'Territory South of the River Ohio',
        note:
          'Ceded by North Carolina in 1789 and organized in 1790. Usually called ' +
          'the Southwest Territory.',
      },
      { from: '1796-06-01', status: 'state', name: 'Tennessee' },
    ],
    sources: [`${STATUTES}, Act of 26 May 1790; admitted 1 June 1796`],
  },

  // ==========================================================================
  // THE NORTHWEST TERRITORY, and what became of it
  // ==========================================================================
  {
    code: 'OH',
    history: [
      { from: '1789-03-04', status: 'organized_territory', name: 'Northwest Territory' },
      { from: '1803-03-01', status: 'state', name: 'Ohio' },
    ],
    sources: [ORDINANCE, 'Admitted 1 March 1803'],
  },
  {
    code: 'IN',
    history: [
      { from: '1789-03-04', status: 'organized_territory', name: 'Northwest Territory' },
      { from: '1800-07-04', status: 'organized_territory', name: 'Indiana Territory' },
      { from: '1816-12-11', status: 'state', name: 'Indiana' },
    ],
    sources: [ORDINANCE, 'Act of 7 May 1800; admitted 11 December 1816'],
  },
  {
    code: 'IL',
    history: [
      { from: '1789-03-04', status: 'organized_territory', name: 'Northwest Territory' },
      { from: '1800-07-04', status: 'organized_territory', name: 'Indiana Territory' },
      { from: '1809-03-01', status: 'organized_territory', name: 'Illinois Territory' },
      { from: '1818-12-03', status: 'state', name: 'Illinois' },
    ],
    sources: [ORDINANCE, 'Act of 3 February 1809; admitted 3 December 1818'],
  },
  {
    code: 'MI',
    history: [
      { from: '1789-03-04', status: 'organized_territory', name: 'Northwest Territory' },
      { from: '1805-06-30', status: 'organized_territory', name: 'Michigan Territory' },
      { from: '1837-01-26', status: 'state', name: 'Michigan' },
    ],
    sources: [ORDINANCE, 'Act of 11 January 1805; admitted 26 January 1837'],
  },
  {
    code: 'WI',
    history: [
      { from: '1789-03-04', status: 'organized_territory', name: 'Northwest Territory' },
      { from: '1836-07-04', status: 'organized_territory', name: 'Wisconsin Territory' },
      { from: '1848-05-29', status: 'state', name: 'Wisconsin' },
    ],
    sources: [ORDINANCE, 'Act of 20 April 1836; admitted 29 May 1848'],
  },
  {
    code: 'MN',
    history: [
      {
        from: '1789-03-04',
        status: 'unorganized',
        name: 'Unorganized territory',
        note:
          'Split between the Northwest Territory east of the Mississippi and ' +
          'Spanish Louisiana west of it. Neither had any government here.',
      },
      { from: '1849-03-03', status: 'organized_territory', name: 'Minnesota Territory' },
      { from: '1858-05-11', status: 'state', name: 'Minnesota' },
    ],
    sources: ['Act of 3 March 1849; admitted 11 May 1858'],
  },

  // ==========================================================================
  // THE SOUTHWEST, and the Spanish border question
  // ==========================================================================
  {
    code: 'MS',
    history: [
      {
        from: '1789-03-04',
        status: 'disputed',
        name: 'Disputed with Spain',
        note:
          'Claimed by the United States, by Georgia, and by Spain, which held ' +
          'Natchez until Pinckney’s Treaty of 1795 fixed the border at the 31st ' +
          'parallel — and even then Spain did not withdraw until 1798.',
      },
      { from: '1798-04-07', status: 'organized_territory', name: 'Mississippi Territory' },
      { from: '1817-12-10', status: 'state', name: 'Mississippi' },
    ],
    sources: [
      'Treaty of San Lorenzo (Pinckney’s Treaty), 27 October 1795',
      'Act of 7 April 1798; admitted 10 December 1817',
    ],
  },
  {
    code: 'AL',
    history: [
      {
        from: '1789-03-04',
        status: 'disputed',
        name: 'Disputed with Spain',
        note: 'Same dispute as Mississippi, and the same settlement.',
      },
      { from: '1798-04-07', status: 'organized_territory', name: 'Mississippi Territory' },
      { from: '1817-03-03', status: 'organized_territory', name: 'Alabama Territory' },
      { from: '1819-12-14', status: 'state', name: 'Alabama' },
    ],
    sources: [
      'Act of 7 April 1798',
      'Act of 3 March 1817; admitted 14 December 1819',
    ],
  },

  // ==========================================================================
  // MAINE — a district, then a state, as part of a bargain
  // ==========================================================================
  {
    code: 'ME',
    history: [
      {
        from: '1789-03-04',
        status: 'state',
        name: 'District of Maine, Massachusetts',
        note:
          'Governed as part of Massachusetts, with no separate representation. ' +
          'It was admitted in 1820 as the free half of the Missouri Compromise.',
      },
      { from: '1820-03-15', status: 'state', name: 'Maine' },
    ],
    sources: ['Act of 3 March 1820 (Missouri Compromise); admitted 15 March 1820'],
  },

  // ==========================================================================
  // LOUISIANA — foreign until 1803
  // ==========================================================================
  {
    code: 'LA',
    history: [
      {
        from: '1789-03-04',
        status: 'foreign',
        name: 'Spanish Louisiana',
        note:
          'Spain held New Orleans, and with it the outlet of the whole western ' +
          'river system — which is the single largest fact in frontier politics ' +
          'in this period. Retroceded to France in 1800 and sold in 1803.',
      },
      { from: '1803-12-20', status: 'unorganized', name: 'Louisiana Purchase' },
      { from: '1804-10-01', status: 'organized_territory', name: 'Territory of Orleans' },
      { from: '1812-04-30', status: 'state', name: 'Louisiana' },
    ],
    sources: [
      'Third Treaty of San Ildefonso, 1 October 1800',
      'Louisiana Purchase Treaty, 30 April 1803; transfer at New Orleans 20 December 1803',
      'Admitted 30 April 1812',
    ],
  },
  {
    code: 'MO',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish Louisiana' },
      { from: '1803-12-20', status: 'unorganized', name: 'Louisiana Purchase' },
      { from: '1812-06-04', status: 'organized_territory', name: 'Missouri Territory' },
      {
        from: '1821-08-10',
        status: 'state',
        name: 'Missouri',
        note:
          'Admitted as a slave state alongside Maine, under the compromise that ' +
          'barred slavery north of 36°30′ in the rest of the Purchase.',
      },
    ],
    sources: ['Act of 4 June 1812; admitted 10 August 1821'],
  },
  {
    code: 'AR',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish Louisiana' },
      { from: '1803-12-20', status: 'unorganized', name: 'Louisiana Purchase' },
      { from: '1819-07-04', status: 'organized_territory', name: 'Arkansas Territory' },
      { from: '1836-06-15', status: 'state', name: 'Arkansas' },
    ],
    sources: ['Act of 2 March 1819; admitted 15 June 1836'],
  },
  {
    code: 'IA',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish Louisiana' },
      { from: '1803-12-20', status: 'unorganized', name: 'Louisiana Purchase' },
      { from: '1838-07-04', status: 'organized_territory', name: 'Iowa Territory' },
      { from: '1846-12-28', status: 'state', name: 'Iowa' },
    ],
    sources: ['Act of 12 June 1838; admitted 28 December 1846'],
  },
  {
    code: 'NE',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish Louisiana' },
      { from: '1803-12-20', status: 'unorganized', name: 'Louisiana Purchase' },
      {
        from: '1854-05-30',
        status: 'organized_territory',
        name: 'Nebraska Territory',
        note:
          'Organized by the Kansas–Nebraska Act, which repealed the Missouri ' +
          'Compromise line and left the question to the settlers.',
      },
    ],
    sources: ['Kansas–Nebraska Act, 30 May 1854'],
  },
  {
    code: 'KS',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish Louisiana' },
      { from: '1803-12-20', status: 'unorganized', name: 'Louisiana Purchase' },
      {
        from: '1854-05-30',
        status: 'organized_territory',
        name: 'Kansas Territory',
        note:
          'The territory the compromise broke on. Rival governments, a sacked ' +
          'town and a disputed constitution, all before statehood.',
      },
      { from: '1861-01-29', status: 'state', name: 'Kansas' },
    ],
    sources: ['Kansas–Nebraska Act, 30 May 1854; admitted 29 January 1861'],
  },
  {
    code: 'SD',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish Louisiana' },
      { from: '1803-12-20', status: 'unorganized', name: 'Louisiana Purchase' },
      { from: '1861-03-02', status: 'organized_territory', name: 'Dakota Territory' },
    ],
    sources: ['Act of 2 March 1861'],
  },
  {
    code: 'ND',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish Louisiana' },
      { from: '1803-12-20', status: 'unorganized', name: 'Louisiana Purchase' },
      { from: '1861-03-02', status: 'organized_territory', name: 'Dakota Territory' },
    ],
    sources: ['Act of 2 March 1861'],
  },
  {
    code: 'OK',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish Louisiana' },
      { from: '1803-12-20', status: 'unorganized', name: 'Louisiana Purchase' },
      {
        from: '1834-06-30',
        status: 'native_nation',
        name: 'Indian Territory',
        note:
          'Set aside for nations removed from east of the Mississippi under the ' +
          'Indian Removal Act of 1830. The removals were carried out by force ' +
          'and at enormous cost in life.',
      },
    ],
    sources: [
      'Indian Removal Act, 28 May 1830',
      'Indian Intercourse Act, 30 June 1834',
    ],
  },
  {
    code: 'MT',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish Louisiana' },
      { from: '1803-12-20', status: 'unorganized', name: 'Louisiana Purchase' },
    ],
    sources: ['Montana Territory was not organized until 1864, beyond this period'],
  },
  {
    code: 'WY',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish Louisiana' },
      { from: '1803-12-20', status: 'unorganized', name: 'Louisiana Purchase' },
    ],
    sources: ['Wyoming Territory was not organized until 1868, beyond this period'],
  },

  // ==========================================================================
  // FLORIDA — Spanish, then bought
  // ==========================================================================
  {
    code: 'FL',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish Florida' },
      {
        from: '1821-07-17',
        status: 'unorganized',
        name: 'Florida',
        note: 'Ceded by Spain under the Adams–Onís Treaty; possession taken in 1821.',
      },
      { from: '1822-03-30', status: 'organized_territory', name: 'Florida Territory' },
      { from: '1845-03-03', status: 'state', name: 'Florida' },
    ],
    sources: [
      'Adams–Onís Treaty, signed 22 February 1819, ratifications exchanged 22 February 1821',
      'Act of 30 March 1822; admitted 3 March 1845',
    ],
  },

  // ==========================================================================
  // THE SOUTHWEST AND THE PACIFIC — Spanish, then Mexican, then ceded
  // ==========================================================================
  {
    code: 'TX',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish Texas' },
      { from: '1821-09-27', status: 'foreign', name: 'Mexico' },
      { from: '1836-03-02', status: 'foreign', name: 'Republic of Texas' },
      { from: '1845-12-29', status: 'state', name: 'Texas' },
    ],
    sources: [
      'Mexican independence, 27 September 1821',
      'Texas Declaration of Independence, 2 March 1836',
      'Joint resolution of annexation, 1 March 1845; admitted 29 December 1845',
    ],
  },
  {
    code: 'CA',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish California' },
      { from: '1821-09-27', status: 'foreign', name: 'Mexico' },
      { from: '1848-02-02', status: 'unorganized', name: 'Mexican Cession' },
      {
        from: '1850-09-09',
        status: 'state',
        name: 'California',
        note:
          'Admitted free, without ever being a territory — the piece of the ' +
          'Compromise of 1850 that broke the balance in the Senate for good.',
      },
    ],
    sources: [
      'Treaty of Guadalupe Hidalgo, 2 February 1848',
      'Admitted 9 September 1850',
    ],
  },
  {
    code: 'NM',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish New Mexico' },
      { from: '1821-09-27', status: 'foreign', name: 'Mexico' },
      { from: '1848-02-02', status: 'unorganized', name: 'Mexican Cession' },
      { from: '1850-09-09', status: 'organized_territory', name: 'New Mexico Territory' },
    ],
    sources: ['Treaty of Guadalupe Hidalgo, 2 February 1848', 'Act of 9 September 1850'],
  },
  {
    code: 'AZ',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish New Mexico' },
      { from: '1821-09-27', status: 'foreign', name: 'Mexico' },
      { from: '1848-02-02', status: 'unorganized', name: 'Mexican Cession' },
      {
        from: '1850-09-09',
        status: 'organized_territory',
        name: 'New Mexico Territory',
        note:
          'The southern strip was still Mexican until the Gadsden Purchase of ' +
          '1853. Arizona was not separated until 1863.',
      },
    ],
    sources: [
      'Treaty of Guadalupe Hidalgo, 2 February 1848',
      'Gadsden Purchase, ratified 1854',
    ],
  },
  {
    code: 'UT',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish territory' },
      { from: '1821-09-27', status: 'foreign', name: 'Mexico' },
      { from: '1848-02-02', status: 'unorganized', name: 'Mexican Cession' },
      { from: '1850-09-09', status: 'organized_territory', name: 'Utah Territory' },
    ],
    sources: ['Treaty of Guadalupe Hidalgo, 2 February 1848', 'Act of 9 September 1850'],
  },
  {
    code: 'NV',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish territory' },
      { from: '1821-09-27', status: 'foreign', name: 'Mexico' },
      { from: '1848-02-02', status: 'unorganized', name: 'Mexican Cession' },
      { from: '1850-09-09', status: 'organized_territory', name: 'Utah Territory' },
      { from: '1861-03-02', status: 'organized_territory', name: 'Nevada Territory' },
    ],
    sources: ['Act of 9 September 1850', 'Act of 2 March 1861'],
  },
  {
    code: 'CO',
    history: [
      { from: '1789-03-04', status: 'foreign', name: 'Spanish territory' },
      {
        from: '1803-12-20',
        status: 'unorganized',
        name: 'Divided claim',
        note:
          'Eastern Colorado came in with the Louisiana Purchase; the western ' +
          'half remained Spanish and then Mexican until 1848.',
      },
      { from: '1861-02-28', status: 'organized_territory', name: 'Colorado Territory' },
    ],
    sources: ['Act of 28 February 1861'],
  },

  // ==========================================================================
  // THE OREGON COUNTRY — held jointly, then divided
  // ==========================================================================
  {
    code: 'OR',
    history: [
      {
        from: '1789-03-04',
        status: 'disputed',
        name: 'Oregon Country',
        note:
          'Claimed at various times by Britain, Spain, Russia and the United ' +
          'States, and occupied jointly with Britain from 1818 with no border ' +
          'agreed at all.',
      },
      { from: '1846-06-15', status: 'unorganized', name: 'Oregon Country' },
      { from: '1848-08-14', status: 'organized_territory', name: 'Oregon Territory' },
      { from: '1859-02-14', status: 'state', name: 'Oregon' },
    ],
    sources: [
      'Anglo-American Convention of 1818 (joint occupation)',
      'Oregon Treaty, 15 June 1846',
      'Act of 14 August 1848; admitted 14 February 1859',
    ],
  },
  {
    code: 'WA',
    history: [
      { from: '1789-03-04', status: 'disputed', name: 'Oregon Country' },
      { from: '1846-06-15', status: 'unorganized', name: 'Oregon Country' },
      { from: '1848-08-14', status: 'organized_territory', name: 'Oregon Territory' },
      { from: '1853-03-02', status: 'organized_territory', name: 'Washington Territory' },
    ],
    sources: ['Oregon Treaty, 15 June 1846', 'Act of 2 March 1853'],
  },
  {
    code: 'ID',
    history: [
      { from: '1789-03-04', status: 'disputed', name: 'Oregon Country' },
      { from: '1846-06-15', status: 'unorganized', name: 'Oregon Country' },
      { from: '1848-08-14', status: 'organized_territory', name: 'Oregon Territory' },
      { from: '1853-03-02', status: 'organized_territory', name: 'Washington Territory' },
    ],
    sources: ['Oregon Treaty, 15 June 1846', 'Idaho Territory was not organized until 1863'],
  },

  // ==========================================================================
  // OUTSIDE THE PERIOD ENTIRELY
  // ==========================================================================
  {
    code: 'AK',
    history: [
      {
        from: '1789-03-04',
        status: 'foreign',
        name: 'Russian America',
        note: 'Purchased from Russia in 1867, well outside this game’s period.',
      },
    ],
    sources: ['Treaty with Russia, 30 March 1867'],
  },
  {
    code: 'HI',
    history: [
      {
        from: '1789-03-04',
        status: 'foreign',
        name: 'Hawaiian Islands',
        note:
          'A sovereign kingdom from 1795, overthrown with American assistance in ' +
          '1893 and annexed in 1898. Outside this game’s period.',
      },
    ],
    sources: ['Kingdom of Hawaii, unified 1795'],
  },
  {
    code: 'WV',
    history: [
      {
        from: '1789-03-04',
        status: 'state',
        name: 'Virginia',
        note:
          'Part of Virginia for this whole period. West Virginia separated in ' +
          '1863, during the war, and the modern outline shown here did not exist.',
      },
    ],
    sources: ['Admitted 20 June 1863'],
  },
  {
    code: 'DC',
    history: [
      {
        from: '1789-03-04',
        status: 'state',
        name: 'Maryland and Virginia',
        note: 'The land for the federal district was ceded by Maryland and Virginia.',
      },
      {
        from: '1801-02-27',
        status: 'organized_territory',
        name: 'District of Columbia',
        note:
          'Under the direct government of Congress, with no representation of ' +
          'its own — which is what the Residence Act of 1790 set up.',
      },
    ],
    sources: ['Residence Act, 16 July 1790', 'District of Columbia Organic Act, 27 February 1801'],
  },
];

export const TERRITORY_BY_CODE: Readonly<Record<string, TerritoryRecord>> =
  Object.fromEntries(TERRITORY.map((t) => [t.code, t]));
