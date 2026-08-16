/**
 * BILLS — TAXATION, TRADE AND BANKING, 1789 to 1800
 *
 * Legislation the player may introduce at will, as distinct from events, which
 * arrive on their own schedule and demand an answer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FOUR TIERS (brief §4.4)
 *
 *   enacted        Became law in reality. The real date and outcome are shown.
 *   proposed       Genuinely debated at the time; failed or stalled.
 *   counterfactual Plausible for the era, never seriously advanced.
 *   anachronistic  Impossible for the period. Locked, with the reason stated.
 *
 * EVERY tier carries factual historical context. That is the educational spine
 * of the game and it is not dropped because a bill is counterfactual — if
 * anything a counterfactual needs it more, because the player has to know what
 * they are departing from.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A locked bill explains itself. `prerequisites` are read by `describeUnmet()`
 * and rendered as plain English, and `lockedBecause` is rendered verbatim, so
 * "Requires the Funding Act of 1790" and "Article I forbids it" both come from
 * the same structure that gates the bill and cannot drift from it.
 */

import type { Bill } from '@/sim/types';

export const FISCAL_BILLS: Bill[] = [
  // ==========================================================================
  // BANKING AND CURRENCY
  // ==========================================================================
  {
    id: 'bank_of_the_united_states',
    category: 'banking',
    name: 'Bank of the United States',
    description:
      'Charter a national bank for twenty years to hold federal deposits, issue ' +
      'notes, and lend to the government.',
    historicalNote:
      'Chartered on 25 February 1791 for a twenty-year term, with capital of ' +
      '$10 million, of which the federal government subscribed one fifth. It held ' +
      'federal deposits, issued notes that circulated as a national currency, and ' +
      'acted as fiscal agent to the Treasury. Its constitutionality was disputed ' +
      'from the outset, Jefferson and Madison arguing that Congress held only ' +
      'enumerated powers and Hamilton that powers necessary to execute them were ' +
      'implied. The charter was allowed to lapse in 1811.',
    sources: [
      'Act of 25 February 1791, 1 Stat. 191',
      'Hamilton, "Opinion on the Constitutionality of a National Bank" (1791)',
    ],
    hasSlider: false,
    sliderRange: null,
    sliderLabel: null,
    sliderUnit: null,
    capitalCost: { introduce: 45, repeal: 30, raise: 0, lower: 0 },
    treasuryCost: { min: 500_000, max: 500_000 },
    phaseInDays: 365,
    prerequisites: [{ kind: 'flag', key: 'assumption_passed', equals: true }],
    availableFrom: '1791-01-01',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.stability', value: 4, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'region.new_england.prosperity', value: 3, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'region.mid_atlantic.prosperity', value: 4, isPercentage: false, scalesWithSlider: false, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'financiers', strength: 85, reason: 'A market for public paper and a bank to hold it' },
      { bloc: 'merchants', strength: 60, reason: 'Credit and a circulating note the ports can rely on' },
      { bloc: 'planters', strength: -45, reason: 'Northern finance, funded by taxes the South pays' },
      { bloc: 'small_farmers', strength: -30, reason: 'Paper wealth for men who never touched a plough' },
    ],
    createsTax: null,
    createsProgram: null,
    repealable: true,
  },

  {
    id: 'coinage_act_1792',
    category: 'banking',
    name: 'The Coinage Act of 1792',
    description:
      'Establish a national Mint at Philadelphia and define the dollar as the ' +
      'unit of account, decimally divided.',
    historicalNote:
      'Signed 2 April 1792. It established the Mint, defined the dollar in silver ' +
      'and gold, and made the United States the first nation to adopt a decimal ' +
      'currency. It also prescribed the death penalty for debasing the coinage. ' +
      'The Mint struck very little in its first years, and foreign coin — Spanish ' +
      'dollars above all — remained legal tender until 1857.',
    sources: ['Coinage Act of 1792, 1 Stat. 246 (2 April 1792)'],
    hasSlider: false,
    sliderRange: null,
    sliderLabel: null,
    sliderUnit: null,
    capitalCost: { introduce: 18, repeal: 25, raise: 0, lower: 0 },
    treasuryCost: { min: 120_000, max: 120_000 },
    phaseInDays: 540,
    prerequisites: [],
    availableFrom: '1791-06-01',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.legitimacy', value: 3, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'nation.stability', value: 2, isPercentage: false, scalesWithSlider: false, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'merchants', strength: 55, reason: 'One unit of account instead of thirteen' },
      { bloc: 'artisans', strength: 25, reason: 'Wages paid in a coin that means the same everywhere' },
      { bloc: 'financiers', strength: 30, reason: 'A defined specie standard to lend against' },
    ],
    createsTax: null,
    createsProgram: null,
    repealable: false,
  },

  // ==========================================================================
  // TAXATION
  // ==========================================================================
  {
    id: 'carriage_duty_1794',
    category: 'taxation',
    name: 'The Carriage Duty of 1794',
    description:
      'Lay a duty on privately kept pleasure carriages, assessed on their value.',
    historicalNote:
      'Passed 5 June 1794 as part of a revenue package to fund the military ' +
      'establishment. Virginia planters challenged it as an unapportioned direct ' +
      'tax, and in Hylton v. United States (1796) the Supreme Court upheld it as ' +
      'an excise — the first occasion on which the Court considered the ' +
      'constitutionality of an act of Congress. It fell on urban and planter ' +
      'wealth and raised comparatively little.',
    sources: [
      'Act of 5 June 1794, 1 Stat. 373',
      'Hylton v. United States, 3 U.S. (3 Dall.) 171 (1796)',
    ],
    hasSlider: true,
    sliderRange: [0.005, 0.05],
    sliderLabel: 'Duty on assessed carriage value',
    sliderUnit: 'rate',
    capitalCost: { introduce: 14, repeal: 8, raise: 16, lower: 5 },
    treasuryCost: { min: 20_000, max: 45_000 },
    phaseInDays: 180,
    prerequisites: [],
    availableFrom: '1794-01-01',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.legitimacy', value: -2, isPercentage: false, scalesWithSlider: true, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'planters', strength: -55, reason: 'A tax on the visible mark of a gentleman' },
      { bloc: 'merchants', strength: -30, reason: 'Falls squarely on town wealth' },
      { bloc: 'small_farmers', strength: 20, reason: 'At last a tax the rich pay and they do not' },
    ],
    createsTax: {
      taxId: 'tax_carriages',
      name: 'Carriage Duty of 1794',
      base: 'carriages',
      rate: 0.02,
      exemptions: ['Carriages kept for hire, and waggons used in husbandry'],
      collectionEfficiency: null,
    },
    createsProgram: null,
    repealable: true,
  },

  {
    id: 'snuff_and_sugar_duty_1794',
    category: 'taxation',
    name: 'Duties on Snuff and Refined Sugar',
    description:
      'Lay an excise on manufactured snuff and on sugar refined within the ' +
      'United States.',
    historicalNote:
      'Part of the same 1794 revenue package as the carriage duty. The snuff duty ' +
      'proved so difficult to collect — it was laid on the mills rather than the ' +
      'product, and millers simply idled them — that Congress suspended it within ' +
      'two years and repealed it in 1800. It is a good illustration of a tax that ' +
      'is easy to write and impossible to gather.',
    sources: ['Act of 5 June 1794, 1 Stat. 384'],
    hasSlider: true,
    sliderRange: [0.01, 0.08],
    sliderLabel: 'Duty on refined goods',
    sliderUnit: 'rate',
    capitalCost: { introduce: 11, repeal: 6, raise: 12, lower: 4 },
    treasuryCost: { min: 15_000, max: 35_000 },
    phaseInDays: 240,
    prerequisites: [],
    availableFrom: '1794-01-01',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.legitimacy', value: -1.5, isPercentage: false, scalesWithSlider: true, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'artisans', strength: -40, reason: 'Laid on the mill, whether it runs or not' },
      { bloc: 'merchants', strength: -20, reason: 'Another schedule to keep and another officer to satisfy' },
    ],
    createsTax: {
      taxId: 'tax_refined_goods',
      name: 'Duties on Snuff and Refined Sugar',
      base: 'refined_goods',
      rate: 0.03,
      exemptions: ['Sugar refined for export'],
      collectionEfficiency: null,
    },
    createsProgram: null,
    repealable: true,
  },

  {
    id: 'auction_duty_1794',
    category: 'taxation',
    name: 'Duty on Sales at Auction',
    description: 'Lay a duty on the value of goods sold at public auction.',
    historicalNote:
      'The third limb of the 1794 package. Auctions were a principal channel for ' +
      'disposing of imported cargo, so the duty fell on the same mercantile ' +
      'interest as the impost and was collected at the same few places — which is ' +
      'why it was among the more collectable of the new excises.',
    sources: ['Act of 5 June 1794, 1 Stat. 397'],
    hasSlider: true,
    sliderRange: [0.005, 0.04],
    sliderLabel: 'Duty on auctioned value',
    sliderUnit: 'rate',
    capitalCost: { introduce: 9, repeal: 6, raise: 10, lower: 3 },
    treasuryCost: { min: 8_000, max: 20_000 },
    phaseInDays: 120,
    prerequisites: [],
    availableFrom: '1794-01-01',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [],
    blocReactions: [
      { bloc: 'merchants', strength: -45, reason: 'Taxes the very method by which a cargo is turned into cash' },
      { bloc: 'artisans', strength: 15, reason: 'Cheap imported goods at auction undercut the workshop' },
    ],
    createsTax: {
      taxId: 'tax_auctions',
      name: 'Duty on Sales at Auction',
      base: 'auctions',
      rate: 0.01,
      exemptions: ['Sales under execution of a court judgment'],
      collectionEfficiency: null,
    },
    createsProgram: null,
    repealable: true,
  },

  {
    id: 'stamp_act_1797',
    category: 'taxation',
    name: 'The Stamp Act of 1797',
    description:
      'Require a federal stamp on legal instruments, bonds, insurance policies ' +
      'and ships’ papers.',
    historicalNote:
      'Passed 6 July 1797 under the fiscal pressure of the deteriorating relation ' +
      'with France. Congress laid a duty on legal and commercial paper ' +
      'twenty-two years after colonial resistance to the British Stamp Act of ' +
      '1765 — a resonance contemporaries noticed at once and opponents used ' +
      'against the measure throughout the debate.',
    sources: ['Act of 6 July 1797, 1 Stat. 527'],
    hasSlider: true,
    sliderRange: [0.002, 0.02],
    sliderLabel: 'Stamp duty on instrument value',
    sliderUnit: 'rate',
    capitalCost: { introduce: 22, repeal: 10, raise: 18, lower: 5 },
    treasuryCost: { min: 30_000, max: 70_000 },
    phaseInDays: 210,
    prerequisites: [],
    availableFrom: '1797-01-01',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.legitimacy', value: -4, isPercentage: false, scalesWithSlider: true, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'merchants', strength: -50, reason: 'Every bill of lading and policy of insurance now costs' },
      { bloc: 'financiers', strength: -35, reason: 'Bonds and transfers taxed at the moment of execution' },
      { bloc: 'small_farmers', strength: -25, reason: 'A deed or a will cannot be had without paying for it' },
    ],
    createsTax: {
      taxId: 'tax_stamps',
      name: 'Stamp Act of 1797',
      base: 'stamps',
      rate: 0.006,
      exemptions: ['Instruments to which the United States is a party'],
      collectionEfficiency: null,
    },
    createsProgram: null,
    repealable: true,
  },

  {
    id: 'direct_tax_1798',
    category: 'taxation',
    name: 'The Direct Tax of 1798',
    description:
      'Lay an apportioned direct tax on dwelling houses and on enslaved persons, ' +
      'assessed by federal officers, to fund the military establishment.',
    historicalNote:
      'The Acts of 9 and 14 July 1798 laid the first federal direct tax, ' +
      'apportioned among the states to raise $2,000,000 for the Quasi-War. It ' +
      'assessed land, dwelling houses, and enslaved people at fifty cents a head ' +
      'for those aged twelve to fifty. Houses were graduated by value, and the ' +
      'assessment required federal officers to measure and count the windows of ' +
      'private homes. That intrusion, more than the sum demanded, turned ' +
      'resistance in the Pennsylvania German counties into Fries’s Rebellion in ' +
      '1799. The federal government thereby taxed slaveholding as property while ' +
      'the Constitution counted three-fifths of the same people for representation.',
    sources: [
      'Act of 9 July 1798, 1 Stat. 580 (valuation)',
      'Act of 14 July 1798, 1 Stat. 597 (apportionment)',
      'U.S. Const. art. I, § 2, cl. 3 and § 9, cl. 4',
    ],
    hasSlider: true,
    sliderRange: [0.002, 0.02],
    sliderLabel: 'Rate on assessed value',
    sliderUnit: 'rate',
    capitalCost: { introduce: 55, repeal: 15, raise: 40, lower: 8 },
    treasuryCost: { min: 90_000, max: 180_000 },
    phaseInDays: 300,
    prerequisites: [],
    availableFrom: '1798-01-01',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.legitimacy', value: -9, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'nation.sectionalTension', value: 5, isPercentage: false, scalesWithSlider: true, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'small_farmers', strength: -70, reason: 'Falls whether or not there was cash that year' },
      { bloc: 'planters', strength: -60, reason: 'Taxes the people they hold as property, by the head' },
      { bloc: 'frontier_settlers', strength: -50, reason: 'Federal officers counting windows on the far side of the mountains' },
      { bloc: 'merchants', strength: 20, reason: 'Revenue raised somewhere other than the customs house' },
    ],
    createsTax: {
      taxId: 'tax_dwellings',
      name: 'Direct Tax of 1798 — dwelling houses',
      base: 'dwellings',
      rate: 0.005,
      exemptions: ['Dwellings valued under one hundred dollars'],
      collectionEfficiency: null,
    },
    createsProgram: null,
    repealable: true,
  },

  {
    id: 'general_sales_tax',
    category: 'taxation',
    name: 'A General Tax on Retail Sales',
    description:
      'Lay a duty on the value of goods sold at retail throughout the United ' +
      'States.',
    historicalNote:
      'Never proposed in this period, and it is worth understanding why: a ' +
      'general sales tax is constitutionally available to Congress as an excise, ' +
      'so unlike an income tax nothing forbids it. What made it impossible was ' +
      'administration. Assessing retail sales requires records most 1790s ' +
      'shopkeepers did not keep and inspectors the federal government did not ' +
      'have — it employed almost no one outside the customs houses and the post ' +
      'roads. No American government levied a general sales tax until the states ' +
      'began doing so in the 1930s.',
    sources: [
      'U.S. Const. art. I, § 8, cl. 1',
      'Historical Statistics of the United States, series Y 358-373 (federal civilian employment)',
    ],
    hasSlider: true,
    sliderRange: [0.005, 0.05],
    sliderLabel: 'Duty on retail value',
    sliderUnit: 'rate',
    capitalCost: { introduce: 70, repeal: 25, raise: 45, lower: 12 },
    treasuryCost: { min: 250_000, max: 600_000 },
    phaseInDays: 730,
    prerequisites: [],
    availableFrom: '1789-04-30',
    availableUntil: null,
    historicity: 'counterfactual',
    lockedBecause: null,
    effects: [
      { target: 'nation.legitimacy', value: -12, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'nation.stability', value: -5, isPercentage: false, scalesWithSlider: true, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'merchants', strength: -65, reason: 'An inspector in every shop, for a tax on every sale' },
      { bloc: 'artisans', strength: -55, reason: 'The workshop taxed on what it sells, not what it earns' },
      { bloc: 'small_farmers', strength: -40, reason: 'Everything bought at the store now costs more' },
      { bloc: 'frontier_settlers', strength: -45, reason: 'Unenforceable here, which will not stop them trying' },
    ],
    createsTax: {
      taxId: 'tax_sales',
      name: 'General Tax on Retail Sales',
      base: 'sales',
      rate: 0.01,
      exemptions: ['Provisions and unmilled grain'],
      collectionEfficiency: null,
    },
    createsProgram: null,
    repealable: true,
  },

  {
    id: 'federal_income_tax',
    category: 'taxation',
    name: 'A Federal Tax on Incomes',
    description:
      'Lay a tax on the annual income of persons within the United States.',
    historicalNote:
      'The first federal income tax was enacted in 1861 to pay for the Civil War. ' +
      'It lapsed in 1872, was revived in 1894, struck down in Pollock v. Farmers’ ' +
      'Loan & Trust the following year, and made durable only by the Sixteenth ' +
      'Amendment in 1913 — a hundred and twenty-four years after the government ' +
      'this player is running took office.',
    sources: [
      'U.S. Const. art. I, § 2, cl. 3 and § 9, cl. 4',
      'Pollock v. Farmers’ Loan & Trust Co., 157 U.S. 429 (1895)',
      'U.S. Const. amend. XVI (1913)',
    ],
    hasSlider: true,
    sliderRange: [0.01, 0.1],
    sliderLabel: 'Rate on assessed income',
    sliderUnit: 'rate',
    capitalCost: { introduce: 120, repeal: 40, raise: 60, lower: 15 },
    treasuryCost: { min: 400_000, max: 900_000 },
    phaseInDays: 730,
    prerequisites: [],
    availableFrom: '1789-04-30',
    availableUntil: null,
    historicity: 'anachronistic',
    lockedBecause:
      'A tax on income is a direct tax, and Article I requires direct taxes to be ' +
      'apportioned among the states by population — which an income tax cannot ' +
      'be, because income is not distributed in proportion to population. That ' +
      'objection was decisive in Pollock v. Farmers’ Loan & Trust (1895) and was ' +
      'removed only by the Sixteenth Amendment in 1913. There is also no machinery ' +
      'to assess income: no returns, no withholding, and no federal officers ' +
      'outside the customs houses and the post roads.',
    effects: [],
    blocReactions: [],
    createsTax: {
      taxId: 'tax_income',
      name: 'Federal Tax on Incomes',
      base: 'income',
      rate: 0.02,
      exemptions: [],
      collectionEfficiency: null,
    },
    createsProgram: null,
    repealable: true,
  },

  {
    id: 'export_duty_on_staples',
    category: 'taxation',
    name: 'A Duty on Exported Staples',
    description:
      'Lay a duty on tobacco, rice and cotton leaving American ports.',
    historicalNote:
      'The export clause was one of the compromises that made the Constitution ' +
      'ratifiable in the South, alongside the three-fifths clause and the bar on ' +
      'restricting the slave trade before 1808. Without it the staple-exporting ' +
      'states would have borne a tax the northern carrying trade escaped. It has ' +
      'never been amended and remains good law: the Supreme Court struck down a ' +
      'federal coal export tax on these grounds as recently as 1996.',
    sources: [
      'U.S. Const. art. I, § 9, cl. 5',
      'United States v. IBM Corp., 517 U.S. 843 (1996)',
    ],
    hasSlider: true,
    sliderRange: [0.01, 0.15],
    sliderLabel: 'Duty on exported value',
    sliderUnit: 'rate',
    capitalCost: { introduce: 100, repeal: 30, raise: 50, lower: 12 },
    treasuryCost: { min: 40_000, max: 80_000 },
    phaseInDays: 90,
    prerequisites: [],
    availableFrom: '1789-04-30',
    availableUntil: null,
    historicity: 'anachronistic',
    lockedBecause:
      'The Constitution forbids it outright: "No Tax or Duty shall be laid on ' +
      'Articles exported from any State." This was a condition of ratification for ' +
      'the staple-exporting states, and no amendment has ever altered it.',
    effects: [],
    blocReactions: [],
    createsTax: {
      taxId: 'tax_exports',
      name: 'Duty on Exported Staples',
      base: 'exports',
      rate: 0.03,
      exemptions: [],
      collectionEfficiency: null,
    },
    createsProgram: null,
    repealable: true,
  },

  // ==========================================================================
  // TRADE AND TARIFFS
  // ==========================================================================
  {
    id: 'tonnage_act_1789',
    category: 'trade',
    name: 'The Tonnage Act of 1789',
    description:
      'Lay discriminating tonnage duties, favouring American-built and ' +
      'American-owned shipping over foreign bottoms.',
    historicalNote:
      'Passed 20 July 1789, sixteen days after the Tariff Act. It charged six ' +
      'cents a ton on American vessels, thirty cents on American-built vessels in ' +
      'foreign ownership, and fifty cents on foreign bottoms. The discrimination ' +
      'was deliberate protection for the domestic carrying trade, and within a ' +
      'decade the American merchant marine had grown enormously — helped ' +
      'considerably by the European war after 1793, which drove neutral shipping ' +
      'into American hands.',
    sources: ['Tonnage Act of 1789, 1 Stat. 27 (20 July 1789)'],
    hasSlider: false,
    sliderRange: null,
    sliderLabel: null,
    sliderUnit: null,
    capitalCost: { introduce: 12, repeal: 14, raise: 0, lower: 0 },
    treasuryCost: { min: 15_000, max: 15_000 },
    phaseInDays: 120,
    prerequisites: [],
    availableFrom: '1789-07-20',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'region.new_england.prosperity', value: 4, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'region.mid_atlantic.prosperity', value: 3, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'region.south.prosperity', value: -2, isPercentage: false, scalesWithSlider: false, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'seamen', strength: 80, reason: 'Berths in a fleet that is about to grow' },
      { bloc: 'merchants', strength: 45, reason: 'The carrying trade sheltered from British bottoms' },
      { bloc: 'planters', strength: -35, reason: 'Dearer freight for a crop that must cross an ocean' },
    ],
    createsTax: null,
    createsProgram: null,
    repealable: true,
  },

  {
    id: 'commercial_discrimination_against_britain',
    category: 'trade',
    name: 'Commercial Discrimination against Great Britain',
    description:
      'Lay additional duties on the goods and shipping of nations having no ' +
      'commercial treaty with the United States — which means Britain.',
    historicalNote:
      'Madison introduced resolutions to this effect in the First Congress in ' +
      '1789 and again in January 1794. Both times the House was sympathetic and ' +
      'the Senate was not; in 1794 the measure was defeated by the Vice ' +
      'President’s casting vote, and the Jay mission was sent instead. The ' +
      'argument against was that Britain supplied nearly all American imports and ' +
      'therefore nearly all federal revenue, so a commercial war with Britain was ' +
      'a fiscal war on the Treasury.',
    sources: [
      'Annals of Congress, 1st Cong., 1st Sess. (April 1789)',
      'Annals of Congress, 3rd Cong., 1st Sess. (January 1794)',
    ],
    hasSlider: true,
    sliderRange: [0.02, 0.15],
    sliderLabel: 'Additional duty on non-treaty nations',
    sliderUnit: 'rate',
    capitalCost: { introduce: 40, repeal: 20, raise: 30, lower: 10 },
    treasuryCost: { min: 10_000, max: 25_000 },
    phaseInDays: 150,
    prerequisites: [],
    availableFrom: '1789-04-30',
    availableUntil: null,
    historicity: 'proposed',
    lockedBecause: null,
    effects: [
      { target: 'nation.tradeCapacity', value: -0.1, isPercentage: true, scalesWithSlider: true, durationDays: null },
      { target: 'region.new_england.prosperity', value: -5, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'nation.legitimacy', value: 3, isPercentage: false, scalesWithSlider: true, durationDays: 1095 },
    ],
    blocReactions: [
      { bloc: 'artisans', strength: 70, reason: 'British manufactures priced out of the American market at last' },
      { bloc: 'small_farmers', strength: 45, reason: 'A blow struck at the old enemy, and at no cost they can see' },
      { bloc: 'merchants', strength: -75, reason: 'Britain is the trade; a war on Britain is a war on the counting house' },
      { bloc: 'financiers', strength: -60, reason: 'The impost pays the debt, and the impost is British goods' },
    ],
    createsTax: null,
    createsProgram: null,
    repealable: true,
  },
];
