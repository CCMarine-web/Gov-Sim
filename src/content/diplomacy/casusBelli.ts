/**
 * CASUS BELLI — the grounds for war
 *
 * Phase 2 brief §7, queue item 12:
 *
 *   "Model the HOI4-style threshold gate: aggression without justification
 *    tanks legitimacy, invites foreign hostility, and in a republic can simply
 *    be voted down."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT A JUSTIFICATION IS HERE
 *
 * A real, dated grievance, with a `strength` that says how good a case it makes
 * in public. Almost every entry is something that actually happened and that
 * somebody actually argued should mean war — the forts, impressment, the
 * spoliations, the closure of the Mississippi. They are listed with their
 * strength AND their historical note, so a player can see both how well it
 * would play and what it really was.
 *
 * `fabricated: true` marks the other kind. Manufacturing a pretext is available
 * and it is expensive, and if the government goes to war on one the country
 * finds out — see `war.ts`. This is the "aggression without justification" case
 * and it is deliberately the worst deal in the game.
 *
 * NOTHING HERE PRESENTS AN AGGRESSION AS JUSTIFIED. The strength is how well a
 * case would have played in 1795, not a judgement about whether it was right.
 * The notes say what the war would actually have been.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { BlocReaction } from '@/sim/types';

export interface CasusBelli {
  id: string;
  powerId: string;
  name: string;
  /** The case, as the government would put it. */
  claim: string;

  /**
   * 0–100. How good a case this makes in public.
   *
   * Below `WAR_JUSTIFICATION_FLOOR` a republic will almost never carry the vote
   * and a monarchy pays heavily for going anyway.
   */
  strength: number;
  /** Manufactured rather than real. The country finds out. */
  fabricated: boolean;

  availableFrom: string;
  availableUntil: string | null;
  /** Gone once this treaty is in force — the grievance has been settled. */
  settledBy: string | null;

  /** Who wants this war, and who does not. Drives the congressional vote. */
  blocReactions: BlocReaction[];

  historicalNote: string;
  sources: string[];
}

export const CASUS_BELLI: readonly CasusBelli[] = [
  // ==========================================================================
  // BRITAIN
  // ==========================================================================
  {
    id: 'northwestern_forts',
    powerId: 'britain',
    name: 'The Retained Posts',
    claim:
      'Britain holds seven forts on American soil that it agreed to evacuate in ' +
      '1783, and arms the confederacy fighting us from them.',
    strength: 62,
    fabricated: false,
    availableFrom: '1789-04-30',
    availableUntil: null,
    settledBy: 'jay_treaty',
    blocReactions: [
      { bloc: 'frontier_settlers', strength: 85, reason: 'The forts are why the war in the Ohio country never ends' },
      { bloc: 'small_farmers', strength: 30, reason: 'Land in the northwest that cannot be settled while the posts stand' },
      { bloc: 'merchants', strength: -80, reason: 'Britain is the market; a war with it is a war on our own trade' },
      { bloc: 'financiers', strength: -75, reason: 'Customs on British goods service the whole debt' },
      { bloc: 'seamen', strength: -55, reason: 'The Royal Navy would take every ship we have' },
    ],
    historicalNote:
      'Britain kept Detroit, Niagara, Oswego and four other posts after 1783, ' +
      'citing American obstruction of pre-war debt recovery — which had in fact ' +
      'occurred. It also supplied the Northwestern Confederacy from them. This ' +
      'was the strongest legal grievance the United States had against Britain ' +
      'in the period, and the government did not go to war over it: it sent Jay, ' +
      'and got the posts evacuated in 1796 by treaty. The reason is in the bloc ' +
      'reactions — the customs revenue that a British war would have destroyed ' +
      'was the entire income of the federal government.',
    sources: [
      'Treaty of Paris, 3 September 1783, Article 7',
      'Jay Treaty, 19 November 1794',
    ],
  },
  {
    id: 'impressment',
    powerId: 'britain',
    name: 'The Impressment of Seamen',
    claim:
      'The Royal Navy takes men out of American ships at sea and calls them ' +
      'British subjects.',
    strength: 70,
    fabricated: false,
    availableFrom: '1793-02-01',
    availableUntil: null,
    settledBy: null,
    blocReactions: [
      { bloc: 'seamen', strength: 95, reason: 'It is their own men being taken' },
      { bloc: 'merchants', strength: 20, reason: 'Crews that cannot be kept are voyages that cannot be made' },
      { bloc: 'artisans', strength: 45, reason: 'A national humiliation, felt in every port town' },
      { bloc: 'financiers', strength: -70, reason: 'War with the creditor and the customer at once' },
      { bloc: 'planters', strength: -20, reason: 'The staple crops go to Britain and nowhere else' },
    ],
    historicalNote:
      'Britain claimed the right to take its own subjects from neutral merchant ' +
      'ships, and in practice took men who were American. It was never settled in ' +
      'this period — the Jay Treaty is silent on it — and it remained a grievance ' +
      'until it became one of the stated causes of the War of 1812. A genuine ' +
      'wrong, and a war fought over it in the 1790s would have been fought ' +
      'without a navy.',
    sources: ['Jay Treaty, 19 November 1794 — silent on impressment'],
  },

  // ==========================================================================
  // FRANCE
  // ==========================================================================
  {
    id: 'french_spoliations',
    powerId: 'france',
    name: 'The Spoliations',
    claim:
      'French cruisers and privateers are taking American merchant ships, and ' +
      'the Directory will not receive our ministers.',
    strength: 74,
    fabricated: false,
    availableFrom: '1797-06-01',
    availableUntil: null,
    settledBy: 'convention_of_1800',
    blocReactions: [
      { bloc: 'merchants', strength: 90, reason: 'Hundreds of ships taken, and no court that will hear it' },
      { bloc: 'seamen', strength: 70, reason: 'Crews held, and cargoes condemned' },
      { bloc: 'financiers', strength: 60, reason: 'Insurance rates that make the West India trade impossible' },
      { bloc: 'frontier_settlers', strength: -50, reason: 'A rich man’s war over shipping nobody here owns' },
      { bloc: 'small_farmers', strength: -45, reason: 'Taxes and a standing army, for a quarrel at sea' },
    ],
    historicalNote:
      'After the Jay Treaty, France treated American shipping as it treated ' +
      'British and took over three hundred vessels. The XYZ affair of 1798 — in ' +
      'which French agents demanded a bribe before negotiations could begin — ' +
      'turned public opinion sharply and produced the undeclared naval Quasi-War, ' +
      'fought from 1798 to 1800 without a declaration. Congress never declared ' +
      'war, which is itself the point: the republic could have and chose not to.',
    sources: [
      'XYZ affair, dispatches published April 1798',
      'Quasi-War, 1798–1800',
      'Convention of 1800, 30 September 1800',
    ],
  },

  // ==========================================================================
  // SPAIN
  // ==========================================================================
  {
    id: 'mississippi_closed',
    powerId: 'spain',
    name: 'The Closure of the Mississippi',
    claim:
      'Spain closes the river to American commerce and denies the right of ' +
      'deposit at New Orleans.',
    strength: 58,
    fabricated: false,
    availableFrom: '1789-04-30',
    availableUntil: null,
    settledBy: 'pinckney_treaty',
    blocReactions: [
      { bloc: 'frontier_settlers', strength: 95, reason: 'Without the river a crop cannot be sold at all' },
      { bloc: 'planters', strength: 40, reason: 'The southwestern lands are worth nothing without an outlet' },
      { bloc: 'merchants', strength: -30, reason: 'A Spanish war closes the Havana and Cadiz trades' },
      { bloc: 'clergy', strength: -25, reason: 'A war of conquest against a Catholic neighbour' },
      { bloc: 'financiers', strength: -55, reason: 'A war on credit the government does not have' },
    ],
    historicalNote:
      'Spain closed the lower Mississippi to American commerce for most of the ' +
      'period, which for a western farmer meant a crop that could not reach a ' +
      'market. Western separatism was a genuine risk, and men including James ' +
      'Wilkinson took Spanish money. The question was settled by Pinckney’s ' +
      'Treaty in 1795, not by force — and the treaty was ratified unanimously, ' +
      'which nothing else in the decade was.',
    sources: ['Treaty of San Lorenzo, 27 October 1795'],
  },

  // ==========================================================================
  // THE BARBARY STATES
  // ==========================================================================
  {
    id: 'algerine_captures',
    powerId: 'algiers',
    name: 'The Captives at Algiers',
    claim:
      'Algiers takes American ships and holds their crews for ransom, and will ' +
      'not release them for anything but tribute.',
    strength: 80,
    fabricated: false,
    availableFrom: '1793-11-01',
    availableUntil: null,
    settledBy: 'treaty_with_algiers',
    blocReactions: [
      { bloc: 'seamen', strength: 90, reason: 'Their own men, held for years' },
      { bloc: 'merchants', strength: 75, reason: 'The Mediterranean trade is simply closed' },
      { bloc: 'clergy', strength: 60, reason: 'Christians held in bondage, and a government that pays for it' },
      { bloc: 'artisans', strength: 55, reason: 'Ships to build, and a national humiliation to end' },
      { bloc: 'small_farmers', strength: -40, reason: 'A navy is a permanent tax, and the sea is not our business' },
      { bloc: 'planters', strength: -35, reason: 'A fleet paid for by everyone and used by the northern ports' },
    ],
    historicalNote:
      'Eleven American ships were taken in 1793 after Portugal made a truce that ' +
      'let the corsairs into the Atlantic. The country did both things: it built ' +
      'a navy, in the Naval Act of 1794, and it paid, in the treaty of 1795. The ' +
      'payment was roughly a fifth of federal expenditure. Nobody at the time ' +
      'described paying as anything other than a humiliation, and nobody thought ' +
      'the United States could have fought without a fleet it did not yet have.',
    sources: [
      'Naval Act of 1794, 27 March 1794',
      'Treaty with Algiers, 5 September 1795',
    ],
  },
  {
    id: 'tripolitan_demands',
    powerId: 'tripoli',
    name: 'The Demands of Tripoli',
    claim:
      'Tripoli demands a larger tribute than was agreed and threatens our ' +
      'shipping if it is not paid.',
    strength: 66,
    fabricated: false,
    availableFrom: '1797-06-01',
    availableUntil: null,
    settledBy: null,
    blocReactions: [
      { bloc: 'seamen', strength: 80, reason: 'The tribute buys peace only until the next demand' },
      { bloc: 'merchants', strength: 65, reason: 'A price that rises every year is not a treaty' },
      { bloc: 'financiers', strength: 30, reason: 'Cheaper to fight once than to pay forever' },
      { bloc: 'small_farmers', strength: -35, reason: 'A war across an ocean, paid for here' },
    ],
    historicalNote:
      'Yusuf Karamanli regarded the tribute settled in 1796 as too small compared ' +
      'with what Algiers received, and declared war on the United States in 1801 ' +
      'by cutting down the flagstaff at the American consulate. That is beyond ' +
      'this period, but the demands that led to it were made within it.',
    sources: ['Treaty of Tripoli, ratified 10 June 1797'],
  },

  // ==========================================================================
  // THE OHIO COUNTRY
  //
  // Framed as the United States framed it, and then said plainly to be what it
  // was. A game that let the player declare this war without saying what the
  // war was about would be laundering the record.
  // ==========================================================================
  {
    id: 'ohio_boundary',
    powerId: 'northwest_confederacy',
    name: 'The Ohio Boundary',
    claim:
      'The confederacy refuses the boundary the United States claims by the ' +
      'treaty of 1783, and raids the settlements north of the river.',
    strength: 55,
    fabricated: false,
    availableFrom: '1789-04-30',
    availableUntil: null,
    settledBy: 'treaty_of_greenville',
    blocReactions: [
      { bloc: 'frontier_settlers', strength: 90, reason: 'Settlements burned, and no protection from anyone' },
      { bloc: 'small_farmers', strength: 45, reason: 'Land warrants that cannot be taken up' },
      { bloc: 'financiers', strength: 35, reason: 'Public land is the only asset the government has to sell' },
      { bloc: 'clergy', strength: -30, reason: 'A war of conquest, whatever it is called' },
      { bloc: 'merchants', strength: -20, reason: 'An army to pay for, and a war Britain may join' },
    ],
    historicalNote:
      'The United States claimed the Ohio country by conquest from Britain in ' +
      '1783 — a claim the nations living there had not been party to and did not ' +
      'accept, having not been defeated. The war that followed cost two American ' +
      'armies: Harmar in 1790 and St Clair on 4 November 1791, the worst defeat ' +
      'the United States Army ever suffered against Native forces. It ended at ' +
      'Fallen Timbers in 1794 and at Greenville in 1795, with the cession of most ' +
      'of modern Ohio. It was a war of conquest and describing it as anything ' +
      'else would be false.',
    sources: [
      'Treaty of Paris, 3 September 1783',
      'St Clair’s Defeat, 4 November 1791',
      'Treaty of Greenville, 3 August 1795',
    ],
  },

  // ==========================================================================
  // MANUFACTURED
  //
  // One per power, generated below. Deliberately weak, deliberately expensive,
  // and the country finds out.
  // ==========================================================================
];

/**
 * A manufactured pretext against any power.
 *
 * Generated rather than authored per power, because the content of a fabricated
 * claim is by definition not specific — that is what makes it fabricated. It is
 * available against everyone, it is weak, and `war.ts` charges heavily for
 * using one.
 *
 * It exists because the brief asks for the aggression case to be modelled and
 * punished, not because it is a good idea. A player who takes it should be able
 * to see, before committing, exactly what it will cost.
 */
export function fabricatedClaim(powerId: string, powerName: string): CasusBelli {
  return {
    id: `fabricated:${powerId}`,
    powerId,
    name: 'A Manufactured Grievance',
    claim:
      `An insult to the flag is discovered, or asserted, and laid at the door of ` +
      `${powerName}.`,
    // Low on purpose. A case nobody believes is a case that does not carry a
    // chamber and does not survive contact with a newspaper.
    strength: 18,
    fabricated: true,
    availableFrom: '1789-04-30',
    availableUntil: null,
    settledBy: null,
    blocReactions: [
      { bloc: 'merchants', strength: -55, reason: 'A war got up on a pretext, and trade ruined for it' },
      { bloc: 'financiers', strength: -60, reason: 'Credit does not survive a government that invents its reasons' },
      { bloc: 'clergy', strength: -70, reason: 'A war begun on a falsehood' },
      { bloc: 'small_farmers', strength: -40, reason: 'Taxes for a quarrel nobody can explain' },
      { bloc: 'planters', strength: -25, reason: 'A war of choice, at the wrong moment' },
    ],
    historicalNote:
      'No such claim was manufactured in this period, and this is not a record of ' +
      'one. It is included because the brief asks for the case of aggression ' +
      'without justification to be modelled — and modelled means priced. Going to ' +
      'war on a manufactured pretext costs legitimacy heavily, turns other powers ' +
      'against the United States, and in a republic will almost certainly be ' +
      'voted down.',
    sources: [],
  };
}

export const CASUS_BELLI_BY_ID: Readonly<Record<string, CasusBelli>> =
  Object.fromEntries(CASUS_BELLI.map((c) => [c.id, c]));
