/**
 * TREATIES
 *
 * Phase 2 brief §7. What the player can conclude with a foreign power, and what
 * it does to the country.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EFFECTS GO THROUGH THE LEDGER, LIKE EVERYTHING ELSE
 *
 *   "Trade agreements feed the real economy — trade volume, customs revenue,
 *    and regional prosperity. They must flow through the same model, not a
 *    parallel one."
 *
 * So `effects` here is the same shape a bill's `effects` is, aimed at the same
 * targets, applied with the same phase-in ramp. The Treasury cannot tell a
 * treaty from a statute.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HISTORICITY, as for bills (DESIGN.md §12.2):
 *
 *   enacted        actually concluded, on the date given
 *   proposed       genuinely negotiated or seriously urged, and failed
 *   counterfactual plausible for the period, never seriously advanced
 *
 * Every entry carries its factual note and its sources, and a counterfactual
 * says what it is departing from.
 */

import type { ModifierTemplate } from '@/sim/types';

export type TreatyHistoricity = 'enacted' | 'proposed' | 'counterfactual';

export interface TreatyTemplate {
  id: string;
  powerId: string;
  name: string;
  /** One sentence, for the chronicle and the card. */
  description: string;

  historicity: TreatyHistoricity;
  /** The real date, where there is one. Used for the card, not as a gate. */
  historicalDate: string | null;
  historicalNote: string;
  sources: string[];

  availableFrom: string;
  /** After this, the moment has passed. Null means it stays open. */
  availableUntil: string | null;

  capitalCost: number;
  /** Paid once, on signing. Ransoms and gifts were real money. */
  treasuryCost: number;
  /** Paid every year while it is in force. Tribute, chiefly. */
  annualTribute: number;

  /** Relations must be at least this good before anyone will sit down. */
  minimumRelation: number;
  requiresTreaties: string[];

  /** What signing does to the relation with this power. */
  relationEffect: number;
  /** And to others. Pleasing Britain displeases France; that is the period. */
  relationEffectOnOthers: Record<string, number>;

  /** Days over which the effects phase in. */
  phaseInDays: number;
  effects: ModifierTemplate[];
}

const perm = (
  target: string,
  value: number,
  isPercentage = false,
): ModifierTemplate => ({
  target,
  value,
  isPercentage,
  scalesWithSlider: false,
  durationDays: null,
});

export const TREATIES: readonly TreatyTemplate[] = [
  // ==========================================================================
  // BRITAIN
  // ==========================================================================
  {
    id: 'jay_treaty',
    powerId: 'britain',
    name: 'Treaty of Amity, Commerce and Navigation',
    description:
      'Britain evacuates the northwestern forts and American ships gain limited ' +
      'access to the West Indies; the debt and boundary questions go to commissions.',
    historicity: 'enacted',
    historicalDate: '1794-11-19',
    historicalNote:
      'Negotiated by John Jay and signed on 19 November 1794, ratified after a ' +
      'bitter Senate fight and proclaimed on 29 February 1796. It secured the ' +
      'evacuation of the northwestern forts, which happened in 1796, and averted ' +
      'a war the United States could not have fought. It obtained almost nothing ' +
      'on impressment and very little on West Indian trade, and it was the most ' +
      'unpopular measure of the decade: Jay was burned in effigy, and the ' +
      'controversy did as much as anything to create the party system. France ' +
      'regarded it as a breach of the alliance of 1778, which is the direct road ' +
      'to the Quasi-War.',
    sources: [
      'Treaty of Amity, Commerce and Navigation (Jay Treaty), signed 19 November 1794',
      'Proclaimed 29 February 1796',
    ],
    availableFrom: '1794-04-01',
    availableUntil: '1798-01-01',
    capitalCost: 120,
    treasuryCost: 0,
    annualTribute: 0,
    minimumRelation: -60,
    requiresTreaties: [],
    relationEffect: 45,
    // France read it as a betrayal, and said so.
    relationEffectOnOthers: { france: -40, spain: -10 },
    phaseInDays: 545,
    effects: [
      perm('nation.tradeCapacity', 0.09, true),
      perm('region.new_england.prosperity', 5),
      perm('region.mid_atlantic.prosperity', 4),
      // The forts go, and the frontier is safer for it.
      perm('region.frontier.prosperity', 6),
      perm('region.frontier.sentiment', 8),
      // And the South, which owed the pre-war debts, is furious.
      perm('region.south.sentiment', -10),
      perm('nation.sectionalTension', 8),
    ],
  },
  {
    id: 'commercial_treaty_britain',
    powerId: 'britain',
    name: 'Full Commercial Reciprocity with Britain',
    description:
      'Equal terms for American ships in every British port, including the West Indies.',
    historicity: 'counterfactual',
    historicalDate: null,
    historicalNote:
      'This is what Jay was sent to get and did not get. Britain had no reason to ' +
      'concede it: it held the stronger position, its manufactures dominated the ' +
      'American market, and the West India trade was the most valuable thing it ' +
      'could have given away. Included as a counterfactual because the ' +
      'negotiation genuinely happened and the terms were genuinely asked for — ' +
      'not because it was ever likely.',
    sources: ['Jay’s instructions, 1794'],
    availableFrom: '1794-04-01',
    availableUntil: null,
    capitalCost: 200,
    treasuryCost: 0,
    annualTribute: 0,
    // Only conceivable from a position of real strength.
    minimumRelation: 55,
    requiresTreaties: ['jay_treaty'],
    relationEffect: 20,
    relationEffectOnOthers: { france: -50 },
    phaseInDays: 730,
    effects: [
      perm('nation.tradeCapacity', 0.22, true),
      perm('region.new_england.prosperity', 12),
      perm('region.mid_atlantic.prosperity', 10),
      perm('region.south.prosperity', 6),
    ],
  },

  // ==========================================================================
  // FRANCE
  // ==========================================================================
  {
    id: 'neutrality_with_france',
    powerId: 'france',
    name: 'Understanding on Neutrality',
    description:
      'France accepts American neutrality in its war with Britain, and the ' +
      'alliance of 1778 is read narrowly.',
    historicity: 'proposed',
    historicalDate: null,
    historicalNote:
      'Washington proclaimed neutrality on 22 April 1793 unilaterally, and France ' +
      'never accepted the reading of the 1778 alliance that made it lawful. ' +
      'Genêt’s mission — commissioning privateers in American ports and appealing ' +
      'over the President’s head to the people — was the consequence. An agreed ' +
      'understanding was sought and not obtained, which is why this is listed as ' +
      'proposed rather than enacted.',
    sources: [
      'Proclamation of Neutrality, 22 April 1793',
      'Treaty of Alliance with France, 6 February 1778',
    ],
    availableFrom: '1793-04-22',
    availableUntil: '1799-01-01',
    capitalCost: 90,
    treasuryCost: 0,
    annualTribute: 0,
    minimumRelation: 10,
    requiresTreaties: [],
    relationEffect: 25,
    relationEffectOnOthers: { britain: 15 },
    phaseInDays: 365,
    effects: [
      // Neutrality is worth money: American bottoms carry for both sides.
      perm('nation.tradeCapacity', 0.12, true),
      perm('region.new_england.prosperity', 6),
      perm('nation.stability', 4),
    ],
  },
  {
    id: 'convention_of_1800',
    powerId: 'france',
    name: 'Convention of Mortefontaine',
    description:
      'The alliance of 1778 is dissolved by agreement and the undeclared naval ' +
      'war is ended.',
    historicity: 'enacted',
    historicalDate: '1800-09-30',
    historicalNote:
      'Signed on 30 September 1800, ending the Quasi-War and releasing the United ' +
      'States from the alliance of 1778 — the entanglement Washington had warned ' +
      'against in his Farewell Address. Adams regarded sending the mission that ' +
      'produced it as the best thing he ever did, and it cost him the support of ' +
      'his own party and probably the election of 1800.',
    sources: ['Convention of 1800 (Treaty of Mortefontaine), 30 September 1800'],
    availableFrom: '1799-02-01',
    availableUntil: null,
    capitalCost: 110,
    treasuryCost: 0,
    annualTribute: 0,
    minimumRelation: -70,
    requiresTreaties: [],
    relationEffect: 50,
    relationEffectOnOthers: { britain: -10 },
    phaseInDays: 270,
    effects: [
      perm('nation.tradeCapacity', 0.07, true),
      perm('nation.stability', 6),
      perm('region.new_england.prosperity', 4),
      perm('region.mid_atlantic.prosperity', 3),
    ],
  },

  // ==========================================================================
  // SPAIN
  // ==========================================================================
  {
    id: 'pinckney_treaty',
    powerId: 'spain',
    name: 'Treaty of San Lorenzo',
    description:
      'The Mississippi is opened to American commerce, with the right of deposit ' +
      'at New Orleans, and the southern boundary is fixed at the 31st parallel.',
    historicity: 'enacted',
    historicalDate: '1795-10-27',
    historicalNote:
      'Negotiated by Thomas Pinckney and signed on 27 October 1795. It gave the ' +
      'western settlements what they had wanted since the Revolution: a legal ' +
      'route to market for a bulk crop. It was ratified unanimously, which nothing ' +
      'else in this decade was, and it did more for the loyalty of the west than ' +
      'any measure the government took directly.',
    sources: ['Treaty of San Lorenzo (Pinckney’s Treaty), 27 October 1795'],
    availableFrom: '1794-06-01',
    availableUntil: null,
    capitalCost: 85,
    treasuryCost: 0,
    annualTribute: 0,
    minimumRelation: -50,
    requiresTreaties: [],
    relationEffect: 40,
    relationEffectOnOthers: { britain: -5 },
    phaseInDays: 365,
    effects: [
      // The single most consequential thing for the west in this period.
      perm('region.frontier.prosperity', 18),
      perm('region.frontier.sentiment', 22),
      perm('region.south.prosperity', 6),
      perm('nation.tradeCapacity', 0.06, true),
      perm('nation.sectionalTension', -6),
    ],
  },
  {
    id: 'purchase_of_new_orleans',
    powerId: 'spain',
    name: 'Purchase of New Orleans',
    description: 'Spain sells the city and its approaches outright.',
    historicity: 'counterfactual',
    historicalDate: null,
    historicalNote:
      'The United States repeatedly sought to buy New Orleans and Spain refused. ' +
      'It came into American hands only because Spain retroceded Louisiana to ' +
      'France in 1800 and Napoleon, having lost Saint-Domingue, sold the whole of ' +
      'it in 1803 — an outcome nobody in this period foresaw or negotiated for. ' +
      'Listed as a counterfactual because the attempt was real and the refusal ' +
      'was consistent.',
    sources: ['Instructions to American ministers at Madrid, 1790s'],
    availableFrom: '1796-01-01',
    availableUntil: '1800-10-01',
    capitalCost: 160,
    treasuryCost: 4_000_000,
    annualTribute: 0,
    minimumRelation: 60,
    requiresTreaties: ['pinckney_treaty'],
    relationEffect: 10,
    relationEffectOnOthers: { france: -15, britain: -10 },
    phaseInDays: 730,
    effects: [
      perm('region.frontier.prosperity', 25),
      perm('region.frontier.sentiment', 20),
      perm('nation.tradeCapacity', 0.14, true),
      perm('nation.stability', 5),
    ],
  },

  // ==========================================================================
  // THE BARBARY STATES
  // ==========================================================================
  {
    id: 'treaty_with_algiers',
    powerId: 'algiers',
    name: 'Treaty with the Dey of Algiers',
    description:
      'Tribute in cash and naval stores, in exchange for peace and the release ' +
      'of the American captives.',
    historicity: 'enacted',
    historicalDate: '1795-09-05',
    historicalNote:
      'Concluded on 5 September 1795. The cost was extraordinary — roughly a fifth ' +
      'of federal expenditure, in cash, stores and a frigate — and it bought the ' +
      'release of the surviving captives, some of whom had been held for over a ' +
      'decade. Paying was cheaper than fighting and everyone involved understood ' +
      'it as a humiliation. The alternative was the navy, which is why the Naval ' +
      'Act of 1794 and this treaty are two halves of one argument.',
    sources: ['Treaty with Algiers, 5 September 1795'],
    availableFrom: '1793-11-01',
    availableUntil: null,
    capitalCost: 60,
    treasuryCost: 642_500,
    annualTribute: 21_600,
    minimumRelation: -80,
    requiresTreaties: [],
    relationEffect: 55,
    relationEffectOnOthers: {},
    phaseInDays: 180,
    effects: [
      // Mediterranean trade resumes, and insurance rates fall.
      perm('nation.tradeCapacity', 0.05, true),
      perm('region.new_england.prosperity', 4),
      // And the country knows what was paid for it.
      perm('nation.legitimacy', -4),
    ],
  },
  {
    id: 'treaty_of_tripoli',
    powerId: 'tripoli',
    name: 'Treaty of Tripoli',
    description: 'Peace with Tripoli, on the usual terms.',
    historicity: 'enacted',
    historicalDate: '1796-11-04',
    historicalNote:
      'Signed in 1796 and ratified unanimously by the Senate on 7 June 1797. Its ' +
      'Article 11, stating that "the government of the United States of America ' +
      'is not in any sense founded on the Christian religion", was read aloud in ' +
      'the Senate before that vote. Tripoli declared war in 1801 over the size of ' +
      'the tribute, beyond this period.',
    sources: ['Treaty of Tripoli, signed 1796, ratified 10 June 1797'],
    availableFrom: '1796-01-01',
    availableUntil: null,
    capitalCost: 40,
    treasuryCost: 56_000,
    annualTribute: 12_000,
    minimumRelation: -70,
    requiresTreaties: [],
    relationEffect: 50,
    relationEffectOnOthers: {},
    phaseInDays: 180,
    effects: [perm('nation.tradeCapacity', 0.02, true)],
  },

  // ==========================================================================
  // THE NATIVE NATIONS
  //
  // These are treaties between sovereigns, and the notes say what the treaties
  // actually did rather than what they said they did.
  // ==========================================================================
  {
    id: 'treaty_of_new_york',
    powerId: 'creek',
    name: 'Treaty of New York',
    description:
      'A boundary with the Muscogee, an annuity, and a federal guarantee of the ' +
      'land that remains.',
    historicity: 'enacted',
    historicalDate: '1790-08-07',
    historicalNote:
      'Negotiated directly between Washington and Alexander McGillivray and signed ' +
      'on 7 August 1790. The Muscogee ceded a large tract in Georgia; in exchange ' +
      'the United States guaranteed the rest of their land against encroachment. ' +
      'The federal government did not enforce that guarantee against Georgia, and ' +
      'settlement across the line continued. This is the pattern of the whole ' +
      'period and it is worth stating plainly: the cession was permanent and the ' +
      'guarantee was not.',
    sources: ['Treaty of New York, 7 August 1790'],
    availableFrom: '1790-01-01',
    availableUntil: null,
    capitalCost: 55,
    treasuryCost: 15_000,
    annualTribute: 1_500,
    minimumRelation: -60,
    requiresTreaties: [],
    relationEffect: 40,
    relationEffectOnOthers: { spain: -10 },
    phaseInDays: 365,
    effects: [
      perm('region.south.prosperity', 4),
      perm('nation.stability', 4),
      // Georgia did not want a federal boundary drawn across its claims.
      perm('region.south.sentiment', -5),
    ],
  },
  {
    id: 'treaty_of_holston',
    powerId: 'cherokee',
    name: 'Treaty of Holston',
    description:
      'A new boundary with the Cherokee Nation, an annuity, and a promise of ' +
      'protection.',
    historicity: 'enacted',
    historicalDate: '1791-07-02',
    historicalNote:
      'Signed on 2 July 1791. It moved the Hopewell line of 1785 in favour of the ' +
      'settlements on the Holston and Cumberland, in exchange for an annuity later ' +
      'increased. Settlers crossed the new line as they had crossed the old one, ' +
      'and the Chickamauga towns fought on until 1794.',
    sources: [
      'Treaty of Holston, 2 July 1791',
      'Treaty of Hopewell, 28 November 1785',
    ],
    availableFrom: '1791-01-01',
    availableUntil: null,
    capitalCost: 45,
    treasuryCost: 8_000,
    annualTribute: 1_000,
    minimumRelation: -60,
    requiresTreaties: [],
    relationEffect: 35,
    relationEffectOnOthers: {},
    phaseInDays: 365,
    effects: [
      perm('region.frontier.prosperity', 5),
      perm('region.south.prosperity', 3),
      perm('nation.stability', 3),
    ],
  },
  {
    id: 'treaty_of_greenville',
    powerId: 'northwest_confederacy',
    name: 'Treaty of Greenville',
    description:
      'The Northwestern Confederacy cedes most of the Ohio country after its ' +
      'defeat at Fallen Timbers.',
    historicity: 'enacted',
    historicalDate: '1795-08-03',
    historicalNote:
      'Signed on 3 August 1795, a year after Fallen Timbers. It ceded most of ' +
      'modern Ohio and part of Indiana and fixed a boundary that lasted about ' +
      'fifteen years. It followed two American defeats — Harmar in 1790 and St ' +
      'Clair in 1791, the worst the United States Army ever suffered against ' +
      'Native forces — and a deliberate, expensive rebuilding of the army under ' +
      'Anthony Wayne. It is a treaty of conquest, and describing it as anything ' +
      'else would be false.',
    sources: [
      'Treaty of Greenville, 3 August 1795',
      'Battle of Fallen Timbers, 20 August 1794',
    ],
    availableFrom: '1794-09-01',
    availableUntil: null,
    capitalCost: 70,
    treasuryCost: 20_000,
    annualTribute: 9_500,
    minimumRelation: -95,
    requiresTreaties: [],
    relationEffect: 30,
    relationEffectOnOthers: { britain: -5, shawnee: 15 },
    phaseInDays: 545,
    effects: [
      perm('region.frontier.prosperity', 14),
      perm('region.frontier.sentiment', 12),
      perm('nation.stability', 8),
      perm('nation.legitimacy', 5),
    ],
  },
  {
    id: 'treaty_of_canandaigua',
    powerId: 'haudenosaunee',
    name: 'Treaty of Canandaigua',
    description:
      'Peace and friendship with the Six Nations, and an annuity in cloth.',
    historicity: 'enacted',
    historicalDate: '1794-11-11',
    historicalNote:
      'Signed on 11 November 1794. It acknowledged Haudenosaunee land in western ' +
      'New York and provided an annuity, which is still delivered as cloth each ' +
      'year. It kept the Six Nations out of the war in the Ohio country at the ' +
      'moment that mattered most. New York State nevertheless acquired most of ' +
      'the land it acknowledged, through separate purchases the federal government ' +
      'did not prevent.',
    sources: ['Treaty of Canandaigua, 11 November 1794'],
    availableFrom: '1794-01-01',
    availableUntil: null,
    capitalCost: 40,
    treasuryCost: 10_000,
    annualTribute: 4_500,
    minimumRelation: -60,
    requiresTreaties: [],
    relationEffect: 45,
    relationEffectOnOthers: { northwest_confederacy: -10 },
    phaseInDays: 365,
    effects: [
      perm('region.mid_atlantic.prosperity', 4),
      perm('nation.stability', 5),
      perm('nation.legitimacy', 3),
    ],
  },
  {
    id: 'enforced_guarantee',
    powerId: 'creek',
    name: 'Enforcement of the Federal Guarantee',
    description:
      'Federal troops are used to hold the treaty line against the settlers who ' +
      'cross it.',
    historicity: 'counterfactual',
    historicalDate: null,
    historicalNote:
      'The United States guaranteed Muscogee and Cherokee land in treaties it ' +
      'signed, and then did not enforce those guarantees against its own citizens ' +
      'or against Georgia. Washington and Knox both understood the obligation and ' +
      'neither found it politically possible to meet. This is a counterfactual — ' +
      'it did not happen — but not an anachronistic one: the power existed, the ' +
      'obligation was written down, and the reason it went unenforced was that ' +
      'enforcing it would have cost the government support it could not spare.',
    sources: [
      'Treaty of New York, 7 August 1790',
      'Henry Knox to Washington on the obligations of the United States, 1789',
    ],
    availableFrom: '1791-01-01',
    availableUntil: null,
    capitalCost: 140,
    treasuryCost: 45_000,
    annualTribute: 0,
    minimumRelation: 20,
    requiresTreaties: ['treaty_of_new_york'],
    relationEffect: 45,
    relationEffectOnOthers: { cherokee: 25, spain: -10 },
    phaseInDays: 545,
    effects: [
      // It works, and it costs the government the frontier and the South.
      perm('nation.stability', 6),
      perm('nation.legitimacy', -8),
      perm('region.frontier.sentiment', -22),
      perm('region.south.sentiment', -14),
      perm('nation.sectionalTension', 6),
    ],
  },
];

export const TREATY_BY_ID: Readonly<Record<string, TreatyTemplate>> =
  Object.fromEntries(TREATIES.map((t) => [t.id, t]));
