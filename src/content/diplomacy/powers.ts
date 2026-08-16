/**
 * FOREIGN POWERS
 *
 * Phase 2 brief §7. Every polity the United States had to deal with in this
 * period, as a modelled entity with its own interests.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO RULES GOVERN THIS FILE
 *
 * 1. THE DATA-INTEGRITY RULE APPLIES HERE EXACTLY AS IT DOES TO OUR OWN
 *    FIGURES. The brief: "Real 1790s figures where sourced, honest gaps where
 *    not — the same data-integrity rule applies to foreign nations as to our
 *    own." So a population is either cited or `null` with a reason. There are a
 *    lot of nulls in this file, and that is the correct outcome: nobody counted
 *    the Creek in 1790, and a plausible number would be a fabricated one.
 *
 * 2. NATIVE NATIONS ARE POLITIES, NOT TERRAIN. The brief again: "Native nations
 *    are sovereign polities with their own interests, diplomacy, and military
 *    capacity, not map obstacles. Represent them factually and seriously; the
 *    historical record here is ugly and the game shouldn't launder it." They
 *    are in the same list as Britain and France, with the same fields, and
 *    their `context` says plainly what was done to them.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `ruler` and `government` are dated, because both changed a great deal between
 * 1789 and 1800 — France four times over.
 */

export type PowerCategory = 'european' | 'barbary' | 'native_nation';

export type PowerGovernment =
  | 'absolute_monarchy'
  | 'constitutional_monarchy'
  | 'republic'
  | 'confederacy'
  | 'regency'
  | 'directory'
  | 'consulate';

export interface RulerTerm {
  /** ISO date this ruler or regime took power. */
  from: string;
  name: string;
  title: string;
  government: PowerGovernment;
  /** What changed, when the change is the interesting part. */
  note?: string;
}

export interface ForeignPower {
  id: string;
  name: string;
  /** The short form used on the map and in lists. */
  shortName: string;
  category: PowerCategory;

  /** In date order. The last entry whose date has passed is in force. */
  rulers: RulerTerm[];

  /**
   * Population, or null where no sourced figure exists.
   *
   * `asOf` records what year the figure is FOR, because a 1801 census used for
   * a 1790s game is a real approximation and the player should be able to see
   * that it is one.
   */
  population: { value: number; asOf: number; source: string } | null;
  /** Why there is no figure. Required whenever `population` is null. */
  populationGap: string | null;

  /**
   * Relative naval and land strength, 0–100, as a CALIBRATION value.
   *
   * Explicitly a game-design parameter, not a historical statistic — nobody
   * published a comparable index in 1790. The reasoning for each is in the
   * comment beside it, and no screen presents it as a sourced figure.
   * (DESIGN.md §12.2)
   */
  navalStrength: number;
  landStrength: number;

  /** Starting relation with the United States, −100…+100. Calibration. */
  startingRelation: number;

  /** What this power actually wants, in its own terms. Shown on its panel. */
  interests: string[];

  /** Factual context. The educational spine, and it does not soften anything. */
  context: string;

  sources: string[];
}

export const POWERS: readonly ForeignPower[] = [
  // ==========================================================================
  // THE EUROPEAN POWERS
  // ==========================================================================
  {
    id: 'britain',
    name: 'Kingdom of Great Britain',
    shortName: 'Britain',
    category: 'european',
    rulers: [
      {
        from: '1760-10-25',
        name: 'George III',
        title: 'King',
        government: 'constitutional_monarchy',
        note: 'Ministry under William Pitt the Younger from 1783.',
      },
    ],
    population: {
      value: 10_500_000,
      asOf: 1801,
      source:
        'First British census, 1801: about 8.9 million in England and Wales and ' +
        '1.6 million in Scotland. No earlier count exists.',
    },
    populationGap: null,
    // The Royal Navy was the largest in the world and the United States had
    // none to speak of, which is the single most important asymmetry in the
    // period. 95 rather than 100 leaves room for a later century.
    navalStrength: 95,
    landStrength: 70,
    // Hostile, and with cause on both sides: forts still held in the northwest,
    // pre-war debts unpaid, seamen impressed.
    startingRelation: -35,
    interests: [
      'Keep the northwestern forts until the pre-war debts are paid',
      'Keep American shipping out of the West Indies',
      'Prevent a Franco-American alliance from being any use to France',
      'Sell manufactures into the American market, which it dominates',
    ],
    context:
      'Britain had not evacuated the northwestern forts it agreed to give up in ' +
      'the Treaty of Paris of 1783, arguing that the states had obstructed the ' +
      'recovery of pre-war debts owed to British creditors — which they had. ' +
      'It was also the destination or origin of the great majority of American ' +
      'trade, so the tariff that funded the federal government was in practice ' +
      'a tax on commerce with Britain. Impressment of seamen from American ' +
      'vessels was a standing grievance that was never settled in this period.',
    sources: [
      'Treaty of Paris, 3 September 1783',
      'Jay Treaty, signed 19 November 1794, proclaimed 29 February 1796',
      'Census of Great Britain, 1801',
    ],
  },
  {
    id: 'france',
    name: 'France',
    shortName: 'France',
    category: 'european',
    rulers: [
      {
        from: '1774-05-10',
        name: 'Louis XVI',
        title: 'King',
        government: 'absolute_monarchy',
        note: 'From 1789 a constitutional monarch in practice, and from 1791 in law.',
      },
      {
        from: '1792-09-21',
        name: 'The National Convention',
        title: 'Convention',
        government: 'republic',
        note: 'Monarchy abolished. Louis XVI was executed on 21 January 1793.',
      },
      {
        from: '1795-11-02',
        name: 'The Directory',
        title: 'Directory',
        government: 'directory',
      },
      {
        from: '1799-11-10',
        name: 'Napoleon Bonaparte',
        title: 'First Consul',
        government: 'consulate',
        note: 'The coup of 18 Brumaire.',
      },
    ],
    population: {
      value: 28_000_000,
      asOf: 1789,
      source:
        'Standard estimates for France in 1789 fall around 28 million; no census ' +
        'of the period is precise, and the figure is an estimate rather than a count.',
    },
    populationGap: null,
    navalStrength: 70,
    landStrength: 95,
    // The alliance of 1778 was real and recent, and the United States owed
    // France its independence and a great deal of money.
    startingRelation: 55,
    interests: [
      'Hold the United States to the alliance of 1778',
      'Open American ports to French privateers and close them to Britain',
      'Be repaid the loans that funded the Revolution',
      'Keep Britain out of the American market',
    ],
    context:
      'The Treaty of Alliance of 1778 was still in force and was a defensive ' +
      'alliance guaranteeing the French West Indies. When France went to war with ' +
      'Britain in 1793 it created the first genuine foreign-policy crisis of the ' +
      'new government: honour the alliance and fight Britain, or declare ' +
      'neutrality and be accused of ingratitude. Washington chose neutrality. ' +
      'By 1798 the relationship had collapsed into the undeclared naval Quasi-War.',
    sources: [
      'Treaty of Alliance with France, 6 February 1778',
      'Proclamation of Neutrality, 22 April 1793',
      'Convention of 1800 (Treaty of Mortefontaine), 30 September 1800',
    ],
  },
  {
    id: 'spain',
    name: 'Kingdom of Spain',
    shortName: 'Spain',
    category: 'european',
    rulers: [
      {
        from: '1788-12-14',
        name: 'Charles IV',
        title: 'King',
        government: 'absolute_monarchy',
        note: 'Government effectively in the hands of Manuel Godoy from 1792.',
      },
    ],
    population: null,
    populationGap:
      'No census of Spain from this period has been used here. The Floridablanca ' +
      'census of 1787 exists but has not been consulted at the standard this ' +
      'project requires, so the figure is left unavailable rather than estimated.',
    navalStrength: 55,
    landStrength: 50,
    startingRelation: -20,
    interests: [
      'Keep the Mississippi closed to American commerce',
      'Hold Louisiana and the Floridas as a buffer against American settlement',
      'Keep the southeastern Native nations as allies against the United States',
    ],
    context:
      'Spain held New Orleans and with it the outlet of the entire western river ' +
      'system, which made it the most important foreign power in the lives of ' +
      'American settlers west of the mountains. Closing the Mississippi to ' +
      'American commerce was a standing threat and at times a reality. Pinckney’s ' +
      'Treaty of 1795 opened the river and granted the right of deposit at New ' +
      'Orleans, and was the most popular diplomatic achievement of the decade.',
    sources: [
      'Treaty of San Lorenzo (Pinckney’s Treaty), 27 October 1795',
      'Third Treaty of San Ildefonso, 1 October 1800',
    ],
  },
  {
    id: 'dutch',
    name: 'Dutch Republic',
    shortName: 'The Dutch',
    category: 'european',
    rulers: [
      {
        from: '1751-10-22',
        name: 'William V',
        title: 'Stadtholder',
        government: 'republic',
      },
      {
        from: '1795-01-19',
        name: 'The Batavian Republic',
        title: 'Republic',
        government: 'republic',
        note: 'A French client state after the French invasion of the winter of 1794–95.',
      },
    ],
    population: null,
    populationGap:
      'No sourced figure for the Dutch Republic in this period has been used ' +
      'here. It is left unavailable rather than estimated.',
    navalStrength: 40,
    landStrength: 25,
    // Amsterdam bankers held a great deal of American debt and were the only
    // willing lenders the new government had.
    startingRelation: 40,
    interests: [
      'Be repaid the loans Amsterdam houses made to the United States',
      'Keep a share of the carrying trade against Britain',
    ],
    context:
      'The Dutch Republic recognised American independence in 1782 and Amsterdam ' +
      'banking houses became the principal foreign lenders to the United States. ' +
      'Servicing that debt was one of the first duties of the new Treasury, and ' +
      'the willingness of Dutch bankers to keep lending was a real constraint on ' +
      'American policy. French invasion in 1795 turned the republic into a client ' +
      'state and ended its independent diplomacy.',
    sources: [
      'Treaty of Amity and Commerce with the Netherlands, 8 October 1782',
    ],
  },
  {
    id: 'portugal',
    name: 'Kingdom of Portugal',
    shortName: 'Portugal',
    category: 'european',
    rulers: [
      {
        from: '1777-02-24',
        name: 'Maria I',
        title: 'Queen',
        government: 'absolute_monarchy',
      },
      {
        from: '1792-02-10',
        name: 'John, Prince of Brazil',
        title: 'Prince Regent',
        government: 'absolute_monarchy',
        note: 'Governing in his mother’s name after her incapacity.',
      },
    ],
    population: null,
    populationGap: 'No sourced figure has been used here.',
    navalStrength: 35,
    landStrength: 20,
    startingRelation: 15,
    interests: [
      'Keep its long alliance with Britain',
      'Sell wine, and buy grain and fish',
      'Keep Algerine corsairs out of the Atlantic',
    ],
    context:
      'A minor trading partner, and consequential for one reason: the Portuguese ' +
      'squadron in the Strait of Gibraltar bottled the Algerine corsairs into the ' +
      'Mediterranean. When Portugal made a truce with Algiers in 1793, the ' +
      'corsairs came out into the Atlantic and began taking American ships, which ' +
      'is the direct cause of the Naval Act of 1794 and the first American navy.',
    sources: ['Portuguese–Algerine truce, 1793'],
  },

  // ==========================================================================
  // THE BARBARY STATES
  // ==========================================================================
  {
    id: 'algiers',
    name: 'Regency of Algiers',
    shortName: 'Algiers',
    category: 'barbary',
    rulers: [
      {
        from: '1791-07-01',
        name: 'Hassan Pasha',
        title: 'Dey',
        government: 'regency',
        note: 'Nominally Ottoman, in practice independent.',
      },
    ],
    population: null,
    populationGap: 'No sourced figure has been used here.',
    navalStrength: 25,
    landStrength: 15,
    startingRelation: -50,
    interests: [
      'Tribute, in cash and naval stores, from every power that trades in the Mediterranean',
      'Captives to ransom',
    ],
    context:
      'Algiers took American merchant ships and held their crews for ransom. ' +
      'Eleven ships were taken in 1793 alone after the truce with Portugal let ' +
      'the corsairs into the Atlantic. The United States eventually paid: the ' +
      'treaty of 1795 cost roughly a fifth of the entire federal budget in cash ' +
      'and stores, and secured the release of the surviving captives. Paying ' +
      'tribute was the cheaper option and was understood at the time to be ' +
      'humiliating.',
    sources: [
      'Treaty with Algiers, 5 September 1795',
      'Naval Act of 1794, 27 March 1794',
    ],
  },
  {
    id: 'morocco',
    name: 'Sultanate of Morocco',
    shortName: 'Morocco',
    category: 'barbary',
    rulers: [
      {
        from: '1790-04-11',
        name: 'Yazid',
        title: 'Sultan',
        government: 'absolute_monarchy',
      },
      {
        from: '1792-11-01',
        name: 'Slimane',
        title: 'Sultan',
        government: 'absolute_monarchy',
      },
    ],
    population: null,
    populationGap: 'No sourced figure has been used here.',
    navalStrength: 15,
    landStrength: 20,
    // The one Barbary state at peace with the United States, and the first
    // nation to recognise it.
    startingRelation: 25,
    interests: ['Keep the treaty of 1786', 'Trade at Tangier and Salé'],
    context:
      'Morocco recognised American independence in 1777 and signed a treaty of ' +
      'peace and friendship in 1786 which was honoured throughout this period — ' +
      'the oldest unbroken treaty relationship the United States has. Unlike ' +
      'Algiers, Tunis and Tripoli, it did not take American ships.',
    sources: ['Treaty of Marrakesh (Moroccan–American Treaty of Friendship), 1786'],
  },
  {
    id: 'tripoli',
    name: 'Regency of Tripoli',
    shortName: 'Tripoli',
    category: 'barbary',
    rulers: [
      {
        from: '1795-01-20',
        name: 'Yusuf Karamanli',
        title: 'Pasha',
        government: 'regency',
      },
    ],
    population: null,
    populationGap: 'No sourced figure has been used here.',
    navalStrength: 15,
    landStrength: 10,
    startingRelation: -40,
    interests: ['Tribute', 'A larger share than Algiers receives'],
    context:
      'Tripoli signed a treaty with the United States in 1796, ratified in 1797. ' +
      'Its Article 11 — declaring that the government of the United States "is not ' +
      'in any sense founded on the Christian religion" — is one of the most cited ' +
      'documents of the early republic. Yusuf Karamanli later declared war in 1801 ' +
      'over the size of the tribute, which is beyond this period.',
    sources: ['Treaty of Tripoli, signed 1796, ratified 10 June 1797'],
  },
  {
    id: 'tunis',
    name: 'Regency of Tunis',
    shortName: 'Tunis',
    category: 'barbary',
    rulers: [
      {
        from: '1782-05-01',
        name: 'Hammuda ibn Ali',
        title: 'Bey',
        government: 'regency',
      },
    ],
    population: null,
    populationGap: 'No sourced figure has been used here.',
    navalStrength: 15,
    landStrength: 10,
    startingRelation: -35,
    interests: ['Tribute', 'Naval stores'],
    context:
      'The last of the Barbary states to come to terms with the United States, ' +
      'in a treaty concluded in 1797 after Algiers and Tripoli had already been ' +
      'bought off. Tunis took American vessels on the same footing as the other ' +
      'regencies and expected the same tribute, and the negotiation turned ' +
      'largely on how much it would be relative to what Algiers had received — ' +
      'which is the whole logic of the system: each payment set the price for ' +
      'the next.',
    sources: ['Treaty with Tunis, 1797'],
  },

  // ==========================================================================
  // THE NATIVE NATIONS
  //
  // Sovereign polities with their own diplomacy and their own war aims, listed
  // here on exactly the same terms as Britain and France. The population fields
  // are almost all null, and that is not neglect: no reliable count of these
  // nations in the 1790s exists, estimates vary widely, and a number invented
  // for a panel would be a fabricated one.
  // ==========================================================================
  {
    id: 'northwest_confederacy',
    name: 'Northwestern Confederacy',
    shortName: 'NW Confederacy',
    category: 'native_nation',
    rulers: [
      {
        from: '1785-01-01',
        name: 'Blue Jacket and Little Turtle',
        title: 'War leaders',
        government: 'confederacy',
        note:
          'A confederacy of nations — Shawnee, Miami, Delaware, Wyandot and ' +
          'others — with no single head. Leadership was by council and by ' +
          'reputation in war.',
      },
    ],
    population: null,
    populationGap:
      'No reliable count exists. Estimates of the confederated nations vary ' +
      'widely and are left unavailable rather than reconciled into a false total.',
    // They destroyed two American armies. This number is not a courtesy.
    navalStrength: 0,
    landStrength: 45,
    startingRelation: -70,
    interests: [
      'Hold the Ohio River as the boundary, as agreed with Britain in 1768',
      'Stop the survey and sale of land north of the Ohio',
      'Keep British supply and support from Detroit',
    ],
    context:
      'The confederacy defeated two United States armies: Harmar’s in 1790 and ' +
      'St Clair’s on 4 November 1791, the worst defeat the United States Army ' +
      'ever suffered at the hands of Native forces, with over 600 killed. It was ' +
      'broken at Fallen Timbers in August 1794 and the Treaty of Greenville the ' +
      'following year ceded most of modern Ohio. The war was fought over the ' +
      'Ohio boundary, which the United States had claimed by conquest from ' +
      'Britain in 1783 — a claim the nations living there had not been party to ' +
      'and did not accept.',
    sources: [
      'St Clair’s Defeat, 4 November 1791',
      'Battle of Fallen Timbers, 20 August 1794',
      'Treaty of Greenville, 3 August 1795',
    ],
  },
  {
    id: 'creek',
    name: 'Muscogee (Creek) Confederacy',
    shortName: 'Muscogee',
    category: 'native_nation',
    rulers: [
      {
        from: '1783-01-01',
        name: 'Alexander McGillivray',
        title: 'Principal chief',
        government: 'confederacy',
      },
      {
        from: '1793-02-17',
        name: 'Council of the towns',
        title: 'Council',
        government: 'confederacy',
        note: 'After McGillivray’s death the confederacy had no comparable figure.',
      },
    ],
    population: null,
    populationGap:
      'Benjamin Hawkins surveyed the Creek towns in 1798–99, but no figure from ' +
      'it has been used here at the standard this project requires.',
    navalStrength: 0,
    landStrength: 35,
    startingRelation: -30,
    interests: [
      'Stop Georgia’s encroachment on Creek land',
      'Play Spain and the United States against each other',
      'Keep the trade at Pensacola open',
    ],
    context:
      'The Creek were under sustained pressure from Georgian settlement and had ' +
      'a Spanish alternative to American protection, which McGillivray used ' +
      'skilfully. The Treaty of New York in 1790 was negotiated directly with ' +
      'Washington and ceded land in exchange for a guarantee of the remainder — ' +
      'a guarantee the federal government proved unable or unwilling to enforce ' +
      'against Georgia.',
    sources: ['Treaty of New York, 7 August 1790'],
  },
  {
    id: 'cherokee',
    name: 'Cherokee Nation',
    shortName: 'Cherokee',
    category: 'native_nation',
    rulers: [
      {
        from: '1788-01-01',
        name: 'Little Turkey',
        title: 'Principal chief',
        government: 'confederacy',
      },
    ],
    population: null,
    populationGap:
      'Estimates for the 1790s vary widely and no figure is used here. The ' +
      'nation had also just been through a smallpox epidemic and a decade of ' +
      'war, which makes any single number more misleading than useful.',
    navalStrength: 0,
    landStrength: 30,
    startingRelation: -25,
    interests: [
      'Hold the boundary agreed at Hopewell in 1785',
      'Stop settlement on the Cumberland and the Holston',
    ],
    context:
      'The Treaty of Hopewell of 1785 set a boundary that settlers crossed almost ' +
      'immediately and that the states would not enforce. The Treaty of Holston ' +
      'in 1791 moved the line again in exchange for an annuity. The Chickamauga ' +
      'towns fought on until 1794. Every treaty in this period followed the same ' +
      'pattern: a cession, a guarantee of what remained, and then further ' +
      'settlement across the new line.',
    sources: [
      'Treaty of Hopewell, 28 November 1785',
      'Treaty of Holston, 2 July 1791',
    ],
  },
  {
    id: 'haudenosaunee',
    name: 'Haudenosaunee (Six Nations)',
    shortName: 'Six Nations',
    category: 'native_nation',
    rulers: [
      {
        from: '1784-01-01',
        name: 'The Grand Council at Buffalo Creek',
        title: 'Council',
        government: 'confederacy',
        note:
          'The confederacy had split during the Revolution and its council fire ' +
          'was divided between Buffalo Creek and Grand River in Canada.',
      },
    ],
    population: null,
    populationGap: 'No reliable count of the Six Nations in this period is used here.',
    navalStrength: 0,
    landStrength: 20,
    startingRelation: -15,
    interests: [
      'Secure what remains of the Seneca and Oneida lands in New York',
      'Avoid being drawn into the war in the Ohio country',
    ],
    context:
      'The confederacy was divided by the Revolution, four nations having sided ' +
      'with Britain and two with the United States, and much of it had removed to ' +
      'Grand River in Canada. New York State acquired most of the remaining ' +
      'Haudenosaunee land through a series of treaties the federal government did ' +
      'not stop. The Treaty of Canandaigua in 1794 is still recognised, and the ' +
      'annuity of cloth it provided for is still delivered.',
    sources: ['Treaty of Canandaigua, 11 November 1794'],
  },
  {
    id: 'shawnee',
    name: 'Shawnee',
    shortName: 'Shawnee',
    category: 'native_nation',
    rulers: [
      {
        from: '1785-01-01',
        name: 'Blue Jacket',
        title: 'War leader',
        government: 'confederacy',
      },
    ],
    population: null,
    populationGap: 'No reliable count is used here.',
    navalStrength: 0,
    landStrength: 25,
    startingRelation: -65,
    interests: [
      'The Ohio boundary',
      'Hold the Miami and Maumee towns',
    ],
    context:
      'The Shawnee were among the most committed members of the Northwestern ' +
      'Confederacy and bore much of the fighting. They are listed separately ' +
      'because their diplomacy did not end with the confederacy’s defeat: the ' +
      'Shawnee reorganisation under Tecumseh in the next decade grew directly ' +
      'out of what was signed at Greenville.',
    sources: ['Treaty of Greenville, 3 August 1795'],
  },
];

export const POWER_BY_ID: Readonly<Record<string, ForeignPower>> =
  Object.fromEntries(POWERS.map((p) => [p.id, p]));
