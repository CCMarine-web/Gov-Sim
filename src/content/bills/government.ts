/**
 * BILLS — MILITARY, JUDICIARY, ADMINISTRATION, POSTS AND PUBLIC WORKS
 *
 * The machinery of the federal government: the courts that enforce its laws,
 * the force behind them, the posts that carry them, and the works it builds.
 *
 * See `fiscal.ts` for the four historicity tiers and what each obliges.
 */

import type { Bill } from '@/sim/types';

export const GOVERNMENT_BILLS: Bill[] = [
  // ==========================================================================
  // FEDERAL JUDICIARY AND LAW ENFORCEMENT
  // ==========================================================================
  {
    id: 'judiciary_act_1789',
    category: 'judiciary',
    name: 'The Judiciary Act of 1789',
    description:
      'Establish the federal court system: a Supreme Court of six justices, ' +
      'thirteen district courts, and three circuit courts.',
    historicalNote:
      'Signed on 24 September 1789, the Judiciary Act created the federal court ' +
      'system the Constitution had authorised but not organised, establishing a ' +
      'Supreme Court of a Chief Justice and five associate justices, along with ' +
      'district and circuit courts. Its Section 25 allowed appeals from state ' +
      'courts to the Supreme Court on federal questions, which proved essential to ' +
      'federal supremacy. Section 13 of the same Act was later struck down in ' +
      'Marbury v. Madison (1803), the case that established judicial review.',
    sources: ['Judiciary Act of 1789, 1 Stat. 73 (24 September 1789)'],
    hasSlider: false,
    sliderRange: null,
    sliderLabel: null,
    sliderUnit: null,
    capitalCost: { introduce: 20, repeal: 60, raise: 0, lower: 0 },
    treasuryCost: { min: 180_000, max: 180_000 },
    phaseInDays: 270,
    prerequisites: [],
    availableFrom: '1789-09-24',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.stability', value: 5, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'nation.legitimacy', value: 4, isPercentage: false, scalesWithSlider: false, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'merchants', strength: 50, reason: 'A federal court that will enforce a contract across a state line' },
      { bloc: 'financiers', strength: 55, reason: 'Debts owed across state lines become collectable' },
      { bloc: 'small_farmers', strength: -25, reason: 'A distant court, and the creditor knows the way to it' },
      { bloc: 'frontier_settlers', strength: -20, reason: 'Justice now sits an impossible distance away' },
    ],
    createsTax: null,
    createsProgram: null,
    repealable: false,
  },

  // ==========================================================================
  // MILITARY AND NAVAL
  // ==========================================================================
  {
    id: 'militia_act_1792',
    category: 'military',
    name: 'The Militia Acts of 1792',
    description:
      'Require every free able-bodied white male citizen between eighteen and ' +
      'forty-five to enrol in the militia and arm himself, and authorise the ' +
      'President to call it out.',
    historicalNote:
      'Two acts of May 1792. The first authorised the President to call out the ' +
      'militia to suppress insurrection or repel invasion, on the certification of ' +
      'a federal judge or Supreme Court justice that ordinary judicial ' +
      'proceedings were obstructed. The second required enrolment and obliged each ' +
      'man to provide his own musket, bayonet and ammunition. The certification ' +
      'requirement was used in August 1794, when Justice James Wilson certified ' +
      'obstruction in western Pennsylvania and Washington called out nearly 13,000 ' +
      'militia against the whiskey rebels.',
    sources: [
      'Act of 2 May 1792, 1 Stat. 264 (calling forth the militia)',
      'Act of 8 May 1792, 1 Stat. 271 (uniform militia)',
    ],
    hasSlider: false,
    sliderRange: null,
    sliderLabel: null,
    sliderUnit: null,
    capitalCost: { introduce: 25, repeal: 35, raise: 0, lower: 0 },
    treasuryCost: { min: 60_000, max: 60_000 },
    phaseInDays: 365,
    prerequisites: [],
    availableFrom: '1792-05-02',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.stability', value: 6, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'nation.legitimacy', value: -2, isPercentage: false, scalesWithSlider: false, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'merchants', strength: 30, reason: 'Order on the roads and at the wharves' },
      { bloc: 'small_farmers', strength: -40, reason: 'Buy a musket you cannot afford, to be marched where you are told' },
      { bloc: 'frontier_settlers', strength: -35, reason: 'The instrument by which the east will come west' },
      { bloc: 'clergy', strength: -15, reason: 'Muster days are Sabbath days spoiled' },
    ],
    createsTax: null,
    createsProgram: null,
    repealable: true,
  },

  {
    id: 'naval_act_1794',
    category: 'military',
    name: 'The Naval Act of 1794',
    description:
      'Authorise the construction of six frigates to protect American commerce ' +
      'against the Barbary corsairs.',
    historicalNote:
      'Passed 27 March 1794 in response to Algerine captures of American merchant ' +
      'ships and crews in the Mediterranean. It authorised six frigates and — at ' +
      'the insistence of members who opposed a standing navy — provided that work ' +
      'would cease if peace were made with Algiers. Peace was made in 1795 and ' +
      'construction was suspended, but Congress permitted three ships to be ' +
      'finished: United States, Constellation and Constitution.',
    sources: ['Act to Provide a Naval Armament, 1 Stat. 350 (27 March 1794)'],
    hasSlider: true,
    sliderRange: [300_000, 1_400_000],
    sliderLabel: 'Annual naval construction',
    sliderUnit: 'dollars',
    capitalCost: { introduce: 28, repeal: 18, raise: 22, lower: 8 },
    treasuryCost: { min: 100_000, max: 260_000 },
    phaseInDays: 540,
    prerequisites: [],
    availableFrom: '1794-03-27',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.stability', value: 3, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'region.new_england.prosperity', value: 4, isPercentage: false, scalesWithSlider: true, durationDays: null },
      // Six frigates have to be built and then manned. The yards are in the
      // northern ports and so are the crews.
      { target: 'bloc.seamen.new_england', value: 0.12, isPercentage: true, scalesWithSlider: true, durationDays: null },
      { target: 'bloc.artisans.new_england', value: 0.08, isPercentage: true, scalesWithSlider: true, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'merchants', strength: 75, reason: 'Cargoes and crews taken in the Mediterranean, and nothing to answer with' },
      { bloc: 'seamen', strength: 65, reason: 'Protection at sea, and berths in the building of it' },
      { bloc: 'artisans', strength: 55, reason: 'Six frigates is years of work in the yards' },
      { bloc: 'planters', strength: -40, reason: 'A standing navy is a standing expense, paid from a crop they sell cheap' },
      { bloc: 'small_farmers', strength: -30, reason: 'Ships for merchants, taxes for everyone' },
    ],
    createsTax: null,
    createsProgram: {
      programId: 'prog_naval_construction',
      name: 'Naval construction',
      category: 'military',
      annualAmount: 600_000,
    },
    repealable: true,
  },

  {
    id: 'navy_department_1798',
    category: 'military',
    name: 'The Navy Department',
    description:
      'Create a Department of the Navy under its own Secretary, separate from ' +
      'the War Department.',
    historicalNote:
      'Established 30 April 1798, in the same weeks as the XYZ despatches became ' +
      'public. Benjamin Stoddert of Georgetown was its first Secretary. Until then ' +
      'naval affairs had been managed by the Secretary of War, who had an army to ' +
      'attend to as well; the separation is a clear case of a crisis producing ' +
      'administrative machinery that then outlasts it.',
    sources: ['Act of 30 April 1798, 1 Stat. 553'],
    hasSlider: false,
    sliderRange: null,
    sliderLabel: null,
    sliderUnit: null,
    capitalCost: { introduce: 20, repeal: 25, raise: 0, lower: 0 },
    treasuryCost: { min: 80_000, max: 80_000 },
    phaseInDays: 240,
    prerequisites: [{ kind: 'billEnacted', billId: 'naval_act_1794' }],
    availableFrom: '1798-01-01',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.stability', value: 3, isPercentage: false, scalesWithSlider: false, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'merchants', strength: 55, reason: 'A department whose whole business is protecting them' },
      { bloc: 'seamen', strength: 40, reason: 'Someone in the government whose job is the sea' },
      { bloc: 'planters', strength: -35, reason: 'A permanent naval establishment, permanently paid for' },
    ],
    createsTax: null,
    createsProgram: {
      programId: 'prog_navy_department',
      name: 'Navy Department establishment',
      category: 'military',
      annualAmount: 200_000,
    },
    repealable: true,
  },

  {
    id: 'provisional_army_1798',
    category: 'military',
    name: 'The Provisional Army',
    description:
      'Authorise the President to raise a provisional army of ten thousand men ' +
      'in the event of invasion or imminent danger of it.',
    historicalNote:
      'Passed 28 May 1798. Washington was recalled from retirement as commanding ' +
      'general, and insisted on Hamilton as his second — a demand Adams resented ' +
      'and eventually blamed for splitting the Federalists. The army was never ' +
      'seriously needed, since the conflict with France was fought at sea, and its ' +
      'chief effect was to alarm Republicans who saw a standing army raised by an ' +
      'administration that was simultaneously prosecuting its critics for sedition.',
    sources: [
      'Act of 28 May 1798, 1 Stat. 558',
      'Act of 16 July 1798, 1 Stat. 604 (augmenting the army)',
    ],
    hasSlider: true,
    sliderRange: [200_000, 2_000_000],
    sliderLabel: 'Annual establishment',
    sliderUnit: 'dollars',
    capitalCost: { introduce: 45, repeal: 15, raise: 30, lower: 6 },
    treasuryCost: { min: 150_000, max: 400_000 },
    phaseInDays: 270,
    prerequisites: [],
    availableFrom: '1798-05-01',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.stability', value: 4, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'nation.legitimacy', value: -7, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'nation.sectionalTension', value: 6, isPercentage: false, scalesWithSlider: true, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'merchants', strength: 30, reason: 'Something between the coast and a French landing' },
      { bloc: 'small_farmers', strength: -65, reason: 'A standing army was the whole complaint against the last government' },
      { bloc: 'frontier_settlers', strength: -55, reason: 'Regulars, and everyone knows which way regulars march' },
      { bloc: 'planters', strength: -50, reason: 'Raised by New England, commanded by Hamilton, paid for by tobacco' },
    ],
    createsTax: null,
    createsProgram: {
      programId: 'prog_provisional_army',
      name: 'Provisional army',
      category: 'military',
      annualAmount: 800_000,
    },
    repealable: true,
  },

  // ==========================================================================
  // POSTAL AND COMMUNICATIONS
  // ==========================================================================
  {
    id: 'post_office_act_1792',
    category: 'postal',
    name: 'The Post Office Act of 1792',
    description:
      'Establish the Post Office permanently, admit newspapers to the mails at ' +
      'low rates, and forbid officials from opening private letters.',
    historicalNote:
      'Signed 20 February 1792. It made the Post Office a permanent department, ' +
      'gave Congress rather than the executive the power to designate postal ' +
      'roads, admitted newspapers to the mails at heavily subsidised rates, and ' +
      'made it a crime for postal officials to open private correspondence. The ' +
      'newspaper provision is the consequential one: it built a national political ' +
      'press, and the network of postal roads grew from about 1,875 miles in 1790 ' +
      'to over 20,000 by 1800.',
    sources: [
      'Post Office Act of 1792, 1 Stat. 232 (20 February 1792)',
      'US Postal Service, "Postal Facts: Postal Route Mileage 1790-1800"',
    ],
    hasSlider: true,
    sliderRange: [60_000, 700_000],
    sliderLabel: 'Annual postal roads expenditure',
    sliderUnit: 'dollars',
    capitalCost: { introduce: 15, repeal: 30, raise: 12, lower: 6 },
    treasuryCost: { min: 40_000, max: 90_000 },
    phaseInDays: 365,
    prerequisites: [],
    availableFrom: '1792-02-20',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.legitimacy', value: 4, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'region.frontier.prosperity', value: 5, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'nation.sectionalTension', value: -3, isPercentage: false, scalesWithSlider: true, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'merchants', strength: 55, reason: 'Prices and news that arrive before the cargo does' },
      { bloc: 'frontier_settlers', strength: 60, reason: 'A road, and a reason for the road to be maintained' },
      { bloc: 'clergy', strength: 30, reason: 'Tracts and correspondence carried cheaply' },
      { bloc: 'artisans', strength: 25, reason: 'A subsidised press, and the press is how a trade organises' },
    ],
    createsTax: null,
    createsProgram: {
      programId: 'prog_postal_roads',
      name: 'Postal roads',
      category: 'infrastructure',
      annualAmount: 150_000,
    },
    repealable: false,
  },

  // ==========================================================================
  // PUBLIC WORKS AND INFRASTRUCTURE
  // ==========================================================================
  {
    id: 'lighthouse_act_1789',
    category: 'public_works',
    name: 'The Lighthouse Act of 1789',
    description:
      'Take the lighthouses, beacons, buoys and public piers into federal charge ' +
      'and maintain them at federal expense.',
    historicalNote:
      'The ninth act of the First Congress, signed 7 August 1789. It transferred ' +
      'the twelve colonial lighthouses to federal ownership and made their upkeep ' +
      'a federal charge — the first federal public works programme, and among the ' +
      'earliest instances of the general government taking on something the states ' +
      'had done. The administration of it fell to the Treasury, and Hamilton ' +
      'personally approved lighthouse contracts.',
    sources: ['Act of 7 August 1789, 1 Stat. 53'],
    hasSlider: true,
    sliderRange: [15_000, 160_000],
    sliderLabel: 'Annual maintenance',
    sliderUnit: 'dollars',
    capitalCost: { introduce: 6, repeal: 12, raise: 6, lower: 3 },
    treasuryCost: { min: 10_000, max: 25_000 },
    phaseInDays: 180,
    prerequisites: [],
    availableFrom: '1789-08-07',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'region.new_england.prosperity', value: 3, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'region.mid_atlantic.prosperity', value: 2, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'nation.legitimacy', value: 2, isPercentage: false, scalesWithSlider: true, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'seamen', strength: 70, reason: 'A light on the headland is the difference between a landfall and a wreck' },
      { bloc: 'merchants', strength: 50, reason: 'Insurance falls when the coast is lit' },
    ],
    createsTax: null,
    createsProgram: {
      programId: 'prog_lighthouses',
      name: 'Lighthouses and public piers',
      category: 'infrastructure',
      annualAmount: 30_000,
    },
    repealable: true,
  },

  {
    id: 'national_road_programme',
    category: 'public_works',
    name: 'A National System of Roads and Canals',
    description:
      'Fund a federal programme of post roads, turnpikes and canal surveys ' +
      'binding the seaboard to the western waters.',
    historicalNote:
      'Not seriously advanced in the 1790s, though the ambition was in the air ' +
      'throughout: Washington had promoted the Potomac Company since 1785 ' +
      'precisely to bind the west to the east commercially before it drifted ' +
      'toward Spain or Britain. Federal internal improvements began with the ' +
      'Cumberland Road, authorised in 1806, and Gallatin’s comprehensive Report on ' +
      'Roads and Canals came in 1808. The constitutional objection — that internal ' +
      'improvements were not among the enumerated powers — dogged the question ' +
      'until the Civil War.',
    sources: [
      'Gallatin, "Report on Roads and Canals" (1808)',
      'Act of 29 March 1806, 2 Stat. 357 (the Cumberland Road)',
    ],
    hasSlider: true,
    sliderRange: [100_000, 1_200_000],
    sliderLabel: 'Annual expenditure',
    sliderUnit: 'dollars',
    capitalCost: { introduce: 50, repeal: 20, raise: 25, lower: 8 },
    treasuryCost: { min: 120_000, max: 400_000 },
    phaseInDays: 730,
    prerequisites: [],
    availableFrom: '1790-01-01',
    availableUntil: null,
    historicity: 'counterfactual',
    lockedBecause: null,
    effects: [
      { target: 'region.frontier.prosperity', value: 12, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'region.mid_atlantic.prosperity', value: 5, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'nation.sectionalTension', value: -6, isPercentage: false, scalesWithSlider: true, durationDays: null },
      { target: 'nation.legitimacy', value: -3, isPercentage: false, scalesWithSlider: true, durationDays: null },
      // A road west is an invitation west. It also gives the interior farmer a
      // way to send a bulk crop to market as a crop rather than as whiskey,
      // which is the quiet answer to the grievance the excise created.
      { target: 'bloc.frontier_settlers.frontier', value: 0.15, isPercentage: true, scalesWithSlider: true, durationDays: null },
      { target: 'bloc.merchants.mid_atlantic', value: 0.08, isPercentage: true, scalesWithSlider: true, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'frontier_settlers', strength: 85, reason: 'A road to market is the whole difference between a farm and a subsistence' },
      { bloc: 'merchants', strength: 45, reason: 'The western trade brought within reach of the eastern ports' },
      { bloc: 'artisans', strength: 40, reason: 'Years of contracts, and a wider market at the end of them' },
      { bloc: 'planters', strength: -40, reason: 'Enumerated powers do not include a canal, and the precedent will not stop at canals' },
      { bloc: 'small_farmers', strength: -20, reason: 'Taxes now, for a road that reaches somebody else' },
    ],
    createsTax: null,
    createsProgram: {
      programId: 'prog_internal_improvements',
      name: 'Roads and canals',
      category: 'infrastructure',
      annualAmount: 400_000,
    },
    repealable: true,
  },

  // ==========================================================================
  // FEDERAL ADMINISTRATION
  // ==========================================================================
  {
    id: 'census_act_1790',
    category: 'administration',
    name: 'The Census Act of 1790',
    description:
      'Direct the federal marshals to enumerate the inhabitants of every district ' +
      'of the United States.',
    historicalNote:
      'Signed 1 March 1790. The Constitution required an enumeration within three ' +
      'years for apportioning representatives and direct taxes, and this act ' +
      'directed the marshals to carry it out. The count began on 2 August 1790, ' +
      'took eighteen months, and returned 3,929,326 people, of whom 697,681 were ' +
      'enslaved. Washington and Jefferson both believed it an undercount. It is ' +
      'the figure on which this simulation’s starting population rests.',
    sources: [
      'Act of 1 March 1790, 1 Stat. 101',
      'US Census Bureau, "1790 Census: Return of the Whole Number of Persons"',
    ],
    hasSlider: false,
    sliderRange: null,
    sliderLabel: null,
    sliderUnit: null,
    capitalCost: { introduce: 8, repeal: 40, raise: 0, lower: 0 },
    treasuryCost: { min: 45_000, max: 45_000 },
    phaseInDays: 540,
    prerequisites: [],
    availableFrom: '1790-03-01',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.legitimacy', value: 2, isPercentage: false, scalesWithSlider: false, durationDays: null },
      { target: 'nation.stability', value: 2, isPercentage: false, scalesWithSlider: false, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'financiers', strength: 30, reason: 'A country whose size is known is a country that can be lent to' },
      { bloc: 'frontier_settlers', strength: 25, reason: 'Counted at last, and representation follows counting' },
      { bloc: 'small_farmers', strength: -15, reason: 'A man from the government writing down what you have' },
    ],
    createsTax: null,
    createsProgram: null,
    repealable: false,
  },

  {
    id: 'presidential_succession_act_1792',
    category: 'elections',
    name: 'The Presidential Succession Act of 1792',
    description:
      'Provide for the succession to the presidency, and fix the manner and ' +
      'timing of choosing electors.',
    historicalNote:
      'Signed 1 March 1792. It placed the President pro tempore of the Senate and ' +
      'then the Speaker of the House in the line of succession — deliberately ' +
      'excluding the Secretary of State, which contemporaries read as a Federalist ' +
      'measure aimed at Jefferson. It also fixed the timing of the choice of ' +
      'electors, giving the presidential election its shape. It stood until 1886.',
    sources: ['Act of 1 March 1792, 1 Stat. 239'],
    hasSlider: false,
    sliderRange: null,
    sliderLabel: null,
    sliderUnit: null,
    capitalCost: { introduce: 16, repeal: 20, raise: 0, lower: 0 },
    treasuryCost: { min: 5_000, max: 5_000 },
    phaseInDays: 90,
    prerequisites: [],
    availableFrom: '1792-01-01',
    availableUntil: null,
    historicity: 'enacted',
    lockedBecause: null,
    effects: [
      { target: 'nation.stability', value: 4, isPercentage: false, scalesWithSlider: false, durationDays: null },
    ],
    blocReactions: [
      { bloc: 'financiers', strength: 25, reason: 'An orderly succession is a stable market' },
      { bloc: 'merchants', strength: 20, reason: 'No question about who governs if the President dies' },
    ],
    createsTax: null,
    createsProgram: null,
    repealable: true,
  },
];
