/**
 * BILLS — LAND, IMMIGRATION, SLAVERY, EDUCATION, HEALTH, AGRICULTURE, LABOUR
 *
 * The legislation that acted on who the country was made of and how they lived,
 * rather than on how the government paid for itself.
 *
 * Several of these are morally difficult. DESIGN.md §1.2 is the standard: they
 * are represented honestly as the consequential choices they were, without
 * sanitising and without being gratuitous, and every one carries factual
 * context so the player understands what actually happened. A history teacher
 * should be able to read any card here and find nothing false on it.
 *
 * See `fiscal.ts` for the four historicity tiers.
 */

import type { Bill } from '@/sim/types';

export const SOCIETY_BILLS: Bill[] = [
  // ==========================================================================
  // LAND AND TERRITORY
  // ==========================================================================
  {
    id: 'land_act_1796',
    category: 'land',
    name: 'The Land Act of 1796',
    description:
      'Survey the public lands north-west of the Ohio into townships and sell ' +
      'them at auction at not less than two dollars an acre.',
    historicalNote:
      'Signed 18 May 1796. It established the rectangular survey, set a minimum ' +
      'price of two dollars an acre, and sold in tracts of no less than 640 acres ' +
      'with a year to pay. The terms were beyond nearly every actual settler: a ' +
      'minimum purchase of $1,280 was more than most farms were worth. Sales were ' +
      'accordingly poor, and the Harrison Land Act of 1800 halved the minimum ' +
      'tract and extended credit to four years. Squatters occupied the land in the ' +
      'meantime regardless.',
    sources: [
      'Land Act of 1796, 1 Stat. 464 (18 May 1796)',
      'Harrison Land Act, 2 Stat. 73 (10 May 1800)',
    ],
    hasSlider: true,
    sliderRange: [1, 4],
    sliderLabel: 'Minimum price per acre (dollars)',
    sliderUnit: 'dollars',
    capitalCost: { introduce: 22, repeal: 15, raise: 14, lower: 18 },
    treasuryCost: { min: 70_000, max: 70_000 },
    phaseInDays: 365,
    prerequisites: [],
    availableFrom: '1796-05-18',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'region.frontier.prosperity', value: 4, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'nation.stability', value: 2, isPercentage: false, scalesWithSlider: false, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'financiers', strength: 50, reason: 'Public land converted into public revenue, at a price speculators can meet' },
      { bloc: 'frontier_settlers', strength: -45, reason: 'A minimum purchase no working farmer in the west can raise' },
      { bloc: 'small_farmers', strength: -25, reason: 'The land goes to whoever already has the money' },
    ],
    createsTax: null,
    createsProgram: null,
    repealable: true,
  },

  // ==========================================================================
  // IMMIGRATION AND NATURALIZATION
  // ==========================================================================
  {
    id: 'naturalization_act_1790',
    category: 'immigration',
    name: 'The Naturalization Act of 1790',
    description:
      'Establish a uniform rule of naturalization: two years’ residence, an oath, ' +
      'and good character.',
    historicalNote:
      'Signed 26 March 1790, the first federal naturalization statute. It required ' +
      'two years’ residence and restricted naturalization to "any alien, being a ' +
      'free white person" — a racial bar that remained in federal naturalization ' +
      'law, in one form or another, until 1952. It also provided that children of ' +
      'citizens born abroad were citizens at birth. The two-year term was ' +
      'lengthened to five in 1795 and to fourteen in 1798.',
    sources: [
      'Naturalization Act of 1790, 1 Stat. 103 (26 March 1790)',
      'Immigration and Nationality Act of 1952, 66 Stat. 163 (removing the racial bar)',
    ],
    hasSlider: false,
    sliderRange: null,
    sliderLabel: null,
    sliderUnit: null,
    capitalCost: { introduce: 10, repeal: 18, raise: 0, lower: 0 },
    treasuryCost: { min: 8_000, max: 8_000 },
    phaseInDays: 180,
    prerequisites: [],
    availableFrom: '1790-03-26',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.legitimacy', value: 2, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'region.mid_atlantic.prosperity', value: 2, isPercentage: false, scalesWithSlider: false, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'artisans', strength: 35, reason: 'Skilled hands arriving, and a path for them to citizenship' },
      { bloc: 'merchants', strength: 30, reason: 'Population is custom, and custom is trade' },
      { bloc: 'frontier_settlers', strength: 25, reason: 'More hands for the western settlements' },
    ],
    createsTax: null,
    createsProgram: null,
    repealable: true,
  },

  {
    id: 'naturalization_act_1798',
    category: 'immigration',
    name: 'The Naturalization Act of 1798',
    description:
      'Extend the residence required for naturalization from five years to ' +
      'fourteen, and require aliens to register with the government.',
    historicalNote:
      'Signed 18 June 1798, the first of the four Alien and Sedition Acts. Recent ' +
      'immigrants — Irish and French especially — voted Republican, and lengthening ' +
      'the residence requirement to fourteen years was understood at the time as a ' +
      'measure against Jefferson’s party as much as against foreign influence. It ' +
      'was repealed in 1802 and the term returned to five years, where it remains.',
    sources: [
      'Naturalization Act of 1798, 1 Stat. 566 (18 June 1798)',
      'Act of 14 April 1802, 2 Stat. 153 (repeal)',
    ],
    hasSlider: false,
    sliderRange: null,
    sliderLabel: null,
    sliderUnit: null,
    capitalCost: { introduce: 35, repeal: 12, raise: 0, lower: 0 },
    treasuryCost: { min: 12_000, max: 12_000 },
    phaseInDays: 120,
    prerequisites: [{ kind: 'billEnacted', billId: 'naturalization_act_1790' }],
    availableFrom: '1798-01-01',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.legitimacy', value: -8, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'nation.stability', value: 2, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'nation.sectionalTension', value: 4, isPercentage: false, scalesWithSlider: false, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'artisans', strength: -60, reason: 'Fourteen years is a working life; it is meant to keep them out of the polls' },
      { bloc: 'clergy', strength: 25, reason: 'Fewer foreign and irreligious voters' },
      { bloc: 'merchants', strength: -20, reason: 'Immigration is labour, and labour is cheap only while it arrives' },
      { bloc: 'small_farmers', strength: -35, reason: 'Plainly aimed at who may vote, not at who may enter' },
    ],
    createsTax: null,
    createsProgram: null,
    repealable: true,
  },

  // ==========================================================================
  // SLAVERY AND CIVIL RIGHTS
  // ==========================================================================
  {
    id: 'slave_trade_act_1794',
    category: 'slavery_civil_rights',
    name: 'The Slave Trade Act of 1794',
    description:
      'Prohibit the building, fitting or employing of any vessel in American ' +
      'ports for carrying enslaved people to any foreign country.',
    historicalNote:
      'Signed 22 March 1794. It did not touch slavery within the United States, ' +
      'nor the importation of enslaved people into it — the Constitution barred ' +
      'Congress from prohibiting that before 1808 — but it made it unlawful for ' +
      'Americans to build or outfit ships for the foreign slave trade, and Rhode ' +
      'Island shipowners had been deeply engaged in exactly that. Enforcement was ' +
      'weak and prosecutions were few. Congress prohibited importation itself with ' +
      'effect from 1 January 1808, the earliest date the Constitution allowed.',
    sources: [
      'Slave Trade Act of 1794, 1 Stat. 347 (22 March 1794)',
      'U.S. Const. art. I, § 9, cl. 1',
      'Act of 2 March 1807, 2 Stat. 426 (prohibiting importation from 1808)',
    ],
    hasSlider: false,
    sliderRange: null,
    sliderLabel: null,
    sliderUnit: null,
    capitalCost: { introduce: 30, repeal: 35, raise: 0, lower: 0 },
    treasuryCost: { min: 15_000, max: 15_000 },
    phaseInDays: 270,
    prerequisites: [],
    availableFrom: '1794-01-01',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.legitimacy', value: 3, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'nation.sectionalTension', value: 4, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'region.new_england.prosperity', value: -2, isPercentage: false, scalesWithSlider: false, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'clergy', strength: 55, reason: 'The traffic condemned, if not yet the institution' },
      { bloc: 'merchants', strength: -35, reason: 'Rhode Island bottoms built for exactly this trade' },
      { bloc: 'planters', strength: -20, reason: 'A federal hand on slavery is a federal hand on slavery, wherever it falls first' },
    ],
    createsTax: null,
    createsProgram: null,
    repealable: true,
  },

  {
    id: 'gradual_emancipation_federal',
    category: 'slavery_civil_rights',
    name: 'A Federal Plan of Gradual Emancipation',
    description:
      'Provide federal compensation to owners for the gradual emancipation of ' +
      'enslaved people, beginning with those born after a fixed date.',
    historicalNote:
      'No such bill was introduced in this period. Several northern states had ' +
      'gradual emancipation statutes — Pennsylvania in 1780, Connecticut and Rhode ' +
      'Island in 1784, New York in 1799 — all freeing children born after a date ' +
      'and only on reaching adulthood, so that people were still enslaved in New ' +
      'York into the 1820s. At federal level the subject was barely approachable: ' +
      'when Quaker petitions against the slave trade reached Congress in 1790, ' +
      'Southern members threatened disunion over the mere referral, and the House ' +
      'resolved that Congress had no authority to interfere with slavery in the ' +
      'states. This bill is marked counterfactual for that reason: not because it ' +
      'was unthinkable, but because it was politically impossible, and the model ' +
      'prices it accordingly.',
    sources: [
      'Pennsylvania Gradual Abolition Act (1 March 1780)',
      'New York Gradual Emancipation Act (29 March 1799)',
      'Annals of Congress, 1st Cong., 2nd Sess., 1197-1205 (March 1790)',
    ],
    hasSlider: true,
    sliderRange: [200_000, 3_000_000],
    sliderLabel: 'Annual compensation fund',
    sliderUnit: 'dollars',
    capitalCost: { introduce: 200, repeal: 40, raise: 60, lower: 20 },
    treasuryCost: { min: 300_000, max: 800_000 },
    phaseInDays: 1825,
    prerequisites: [],
    availableFrom: '1789-04-30',
    availableUntil: null,
    historicity: 'counterfactual',
    lockedBecause: null,
    effects: [
      { target: 'nation.sectionalTension', value: 35, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'nation.legitimacy', value: -10, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'nation.stability', value: -12, isPercentage: false, scalesWithSlider: false, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'planters', strength: -100, reason: 'The whole basis of the Southern economy, and they will leave the union over it' },
      { bloc: 'clergy', strength: 60, reason: 'What a great many of them have been preaching for twenty years' },
      { bloc: 'artisans', strength: 30, reason: 'Free labour ceases to compete with labour that costs nothing' },
      { bloc: 'small_farmers', strength: -15, reason: 'An enormous federal expense, for a question most of them do not face' },
      { bloc: 'financiers', strength: -25, reason: 'A compensation fund of that size means borrowing of that size' },
    ],
    createsTax: null,
    createsProgram: {
      programId: 'prog_emancipation_fund',
      name: 'Emancipation compensation fund',
      category: 'civil',
      annualAmount: 1_000_000,
    },
    repealable: true,
  },

  // ==========================================================================
  // HEALTH AND WELFARE
  // ==========================================================================
  {
    id: 'marine_hospital_service_1798',
    category: 'health_welfare',
    name: 'The Marine Hospital Service',
    description:
      'Provide for the relief of sick and disabled merchant seamen, funded by a ' +
      'deduction from their wages.',
    historicalNote:
      'Signed 16 July 1798, and the first federal medical programme. It required ' +
      'masters of American merchant vessels to deduct twenty cents a month from ' +
      'each seaman’s wages, collected by the customs officers, to fund hospitals ' +
      'in the port towns. It is also the first instance of a compulsory federal ' +
      'deduction from wages for a benefit — the distant ancestor of the Public ' +
      'Health Service, which traces its founding to this act.',
    sources: [
      'Act of 16 July 1798, 1 Stat. 605',
      'US Public Health Service, "History of the Commissioned Corps"',
    ],
    hasSlider: true,
    sliderRange: [10_000, 120_000],
    sliderLabel: 'Annual hospital expenditure',
    sliderUnit: 'dollars',
    capitalCost: { introduce: 10, repeal: 14, raise: 8, lower: 4 },
    treasuryCost: { min: 12_000, max: 30_000 },
    phaseInDays: 365,
    prerequisites: [],
    availableFrom: '1798-07-16',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'region.new_england.prosperity', value: 2, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'nation.legitimacy', value: 3, isPercentage: false, scalesWithSlider: true, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'seamen', strength: 60, reason: 'Somewhere to be taken when the fever comes ashore with you' },
      { bloc: 'merchants', strength: 20, reason: 'Crews that survive a voyage can be shipped on the next' },
      { bloc: 'clergy', strength: 35, reason: 'Charity made a public duty rather than a private one' },
    ],
    createsTax: null,
    createsProgram: {
      programId: 'prog_marine_hospitals',
      name: 'Marine hospitals',
      category: 'civil',
      annualAmount: 25_000,
    },
    repealable: true,
  },

  // ==========================================================================
  // EDUCATION
  // ==========================================================================
  {
    id: 'national_university',
    category: 'education',
    name: 'A National University',
    description:
      'Found and endow a national university in the federal city, for the ' +
      'education of youth from every part of the union.',
    historicalNote:
      'Washington urged this in his first annual message in 1790 and returned to ' +
      'it repeatedly, most insistently in his last, in December 1796. He argued ' +
      'that young men educated together from every state would form attachments ' +
      'across sectional lines, and he left shares in the Potomac Company in his ' +
      'will to endow it. Congress never acted. The bequest lapsed when the company ' +
      'failed, and no national university was ever founded.',
    sources: [
      'Washington, First Annual Message to Congress (8 January 1790)',
      'Washington, Eighth Annual Message to Congress (7 December 1796)',
      'Last Will and Testament of George Washington (9 July 1799)',
    ],
    hasSlider: true,
    sliderRange: [30_000, 300_000],
    sliderLabel: 'Annual endowment',
    sliderUnit: 'dollars',
    capitalCost: { introduce: 40, repeal: 15, raise: 15, lower: 6 },
    treasuryCost: { min: 100_000, max: 250_000 },
    phaseInDays: 1095,
    prerequisites: [],
    availableFrom: '1790-01-08',
    availableUntil: null,
    historicity: 'proposed',
    lockedBecause: null,
    effects: [
      { target: 'nation.sectionalTension', value: -5, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'nation.legitimacy', value: 3, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'region.mid_atlantic.prosperity', value: 2, isPercentage: false, scalesWithSlider: true, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'clergy', strength: -40, reason: 'The colleges are theirs, and a national one will not be' },
      { bloc: 'merchants', strength: 30, reason: 'Educated men for the counting houses, and connections across the states' },
      { bloc: 'planters', strength: -25, reason: 'Sons sent north to be taught out of their own opinions' },
      { bloc: 'artisans', strength: 15, reason: 'Learning that is not reserved to those who can already pay for it' },
    ],
    createsTax: null,
    createsProgram: {
      programId: 'prog_national_university',
      name: 'National university',
      category: 'civil',
      annualAmount: 80_000,
    },
    repealable: true,
  },

  // ==========================================================================
  // AGRICULTURE
  // ==========================================================================
  {
    id: 'national_board_of_agriculture',
    category: 'agriculture',
    name: 'A National Board of Agriculture',
    description:
      'Establish a federal board to collect and publish agricultural knowledge ' +
      'and encourage improved husbandry.',
    historicalNote:
      'Washington proposed this in his final annual message, in December 1796, ' +
      'having corresponded for years with Sir John Sinclair of the British Board ' +
      'of Agriculture. He argued that a board costing very little could spread ' +
      'improvements across a country whose soil was being exhausted by tobacco and ' +
      'careless cultivation. Congress did not act. No federal agricultural body ' +
      'existed until the Agricultural Division of the Patent Office in 1839, and ' +
      'no department until 1862.',
    sources: [
      'Washington, Eighth Annual Message to Congress (7 December 1796)',
      'Act of 15 May 1862, 12 Stat. 387 (establishing the Department of Agriculture)',
    ],
    hasSlider: true,
    sliderRange: [5_000, 60_000],
    sliderLabel: 'Annual expenditure',
    sliderUnit: 'dollars',
    capitalCost: { introduce: 12, repeal: 8, raise: 6, lower: 3 },
    treasuryCost: { min: 10_000, max: 25_000 },
    phaseInDays: 730,
    prerequisites: [],
    availableFrom: '1796-12-07',
    availableUntil: null,
    historicity: 'proposed',
    lockedBecause: null,
    effects: [
      { target: 'region.south.prosperity', value: 3, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'region.mid_atlantic.prosperity', value: 3, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'region.frontier.prosperity', value: 2, isPercentage: false, scalesWithSlider: true, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'planters', strength: 35, reason: 'Tobacco has exhausted the tidewater and everybody knows it' },
      { bloc: 'small_farmers', strength: 40, reason: 'Knowledge that used to belong only to gentlemen with libraries' },
      { bloc: 'financiers', strength: -10, reason: 'A small expense, but an expense with no revenue attached' },
    ],
    createsTax: null,
    createsProgram: {
      programId: 'prog_board_of_agriculture',
      name: 'Board of agriculture',
      category: 'civil',
      annualAmount: 20_000,
    },
    repealable: true,
  },

  // ==========================================================================
  // LABOUR AND MANUFACTURES
  // ==========================================================================
  {
    id: 'bounties_on_manufactures',
    category: 'labor',
    name: 'Bounties on Manufactures',
    description:
      'Pay federal bounties to encourage the establishment of manufactures the ' +
      'country presently imports.',
    historicalNote:
      'Hamilton’s Report on the Subject of Manufactures, submitted 5 December ' +
      '1791, recommended bounties as the most efficient means of establishing new ' +
      'industries — more so than protective duties, which he thought raised prices ' +
      'without guaranteeing production. Congress declined to act on it. The ' +
      'objection was partly constitutional, that bounties were not an enumerated ' +
      'power, and partly sectional, since the manufactures to be encouraged were ' +
      'northern and the revenue paying for them came disproportionately from ' +
      'southern staples. Of the whole Report, only the tariff recommendations were ' +
      'ever adopted.',
    sources: [
      'Hamilton, "Report on the Subject of Manufactures" (5 December 1791)',
      'Annals of Congress, 2nd Cong., 1st Sess.',
    ],
    hasSlider: true,
    sliderRange: [50_000, 800_000],
    sliderLabel: 'Annual bounties',
    sliderUnit: 'dollars',
    capitalCost: { introduce: 45, repeal: 18, raise: 20, lower: 8 },
    treasuryCost: { min: 60_000, max: 150_000 },
    phaseInDays: 1095,
    prerequisites: [],
    availableFrom: '1791-12-05',
    availableUntil: null,
    historicity: 'proposed',
    lockedBecause: null,
    effects: [
      { target: 'region.new_england.prosperity', value: 7, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'region.mid_atlantic.prosperity', value: 6, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'nation.sectionalTension', value: 7, isPercentage: false, scalesWithSlider: true, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'artisans', strength: 80, reason: 'Capital for workshops that cannot raise it any other way' },
      { bloc: 'financiers', strength: 45, reason: 'Manufacturing ventures worth subscribing to' },
      { bloc: 'planters', strength: -70, reason: 'Southern revenue paying northern manufacturers to compete with British goods they buy cheaply' },
      { bloc: 'small_farmers', strength: -35, reason: 'Public money to private mills, and dearer cloth at the end of it' },
    ],
    createsTax: null,
    createsProgram: {
      programId: 'prog_manufacturing_bounties',
      name: 'Bounties on manufactures',
      category: 'civil',
      annualAmount: 250_000,
    },
    repealable: true,
  },

  // ==========================================================================
  // FOREIGN AFFAIRS AND TREATIES
  // ==========================================================================
  {
    id: 'algerine_tribute_1795',
    category: 'foreign_affairs',
    name: 'Tribute to Algiers',
    description:
      'Appropriate money to ransom American captives and pay an annual tribute ' +
      'to the Dey of Algiers for the security of American shipping.',
    historicalNote:
      'The treaty with Algiers of September 1795 ransomed 115 American captives ' +
      'and provided for an annual tribute in naval stores. The total cost came to ' +
      'nearly a million dollars — around a sixth of federal expenditure that year — ' +
      'and the United States went on paying tribute to the Barbary states until ' +
      '1805. It is the clearest case in the period of the price of having no navy, ' +
      'and it was the argument that carried the Naval Act of 1794.',
    sources: [
      'Treaty of Peace and Amity with Algiers (5 September 1795)',
      'Act of 6 May 1796, 1 Stat. 459 (appropriation)',
    ],
    hasSlider: true,
    sliderRange: [50_000, 400_000],
    sliderLabel: 'Annual tribute',
    sliderUnit: 'dollars',
    capitalCost: { introduce: 30, repeal: 25, raise: 12, lower: 15 },
    treasuryCost: { min: 400_000, max: 900_000 },
    phaseInDays: 120,
    prerequisites: [],
    availableFrom: '1795-09-05',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'region.new_england.prosperity', value: 4, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'nation.legitimacy', value: -5, isPercentage: false, scalesWithSlider: false, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'seamen', strength: 70, reason: 'A hundred and fifteen of them are in Algiers, and this is what brings them home' },
      { bloc: 'merchants', strength: 60, reason: 'The Mediterranean reopened to American bottoms' },
      { bloc: 'small_farmers', strength: -40, reason: 'Tribute paid to a pirate, out of taxes, in the name of merchants' },
      { bloc: 'artisans', strength: -30, reason: 'Buying peace instead of building the ships that would take it' },
    ],
    createsTax: null,
    createsProgram: {
      programId: 'prog_barbary_tribute',
      name: 'Barbary tribute',
      category: 'civil',
      annualAmount: 120_000,
    },
    repealable: true,
  },
];
