/**
 * CANDIDATES FOR OFFICE
 *
 * Phase 2 brief §5, queue item 13:
 *
 *   "Take P&R's minister model. Appointees have competence and loyalty…
 *    Real historical figures where appropriate, with sourced biographical
 *    notes."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RATINGS ARE A MODEL. THE BIOGRAPHIES ARE NOT.
 *
 * This file mixes two kinds of thing and keeps them apart, exactly as
 * DESIGN.md §12.2 requires:
 *
 *   `note` and `sources` are BENCHMARK DATA. What the person actually did,
 *   cited. Nothing in them is invented.
 *
 *   `competence` and `loyalty` are CALIBRATION CONSTANTS. Nobody rated
 *   Alexander Hamilton out of a hundred. They are game parameters, informed by
 *   the record and reasoned in the comment beside each figure, and the
 *   Government screen states on its face that they are a model rather than a
 *   verdict.
 *
 * Giving a real person a number is the most delicate thing in this project's
 * content, so the rule is: the number must be defensible from what they did IN
 * OFFICE, and the note must say what that was. Where a reputation is contested
 * — McHenry, Pickering — the note says the reputation is contested rather than
 * silently picking a side.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * LOYALTY IS TO THE PLAYER'S GOVERNMENT, not to the United States. A figure
 * with low loyalty is not a traitor; he is a man with his own view of what the
 * government should be doing, and the willingness to say so publicly. That is
 * what Jefferson and Randolph both were.
 */

import type { BlocReaction } from '@/sim/types';

export interface Candidate {
  id: string;
  officeId: string;
  name: string;

  /**
   * 0–100. How well this person makes their department work.
   *
   * CALIBRATION. Affects collection efficiency, the cost of delivering
   * programmes, and how much of the administration effectively exists.
   */
  competence: number;
  /**
   * 0–100. How far they will go along with a government they disagree with.
   *
   * CALIBRATION. Low loyalty does not mean disloyal to the country: it means
   * they will resign publicly, brief against the government, or oppose it in
   * print — all of which men in these offices actually did.
   */
  loyalty: number;

  /** Available to appoint between these dates. Real people were not always free. */
  availableFrom: string;
  availableUntil: string | null;

  /** Who welcomes this appointment, for the Senate confirmation vote. */
  blocReactions: BlocReaction[];

  /** What they actually did. Cited, and never invented. */
  note: string;
  sources: string[];
}

const SENATE_SOURCES = [
  'US Senate, "First Cabinet Confirmation"',
  'US Department of State, Office of the Historian',
];

export const CANDIDATES: readonly Candidate[] = [
  // ==========================================================================
  // THE TREASURY
  // ==========================================================================
  {
    id: 'hamilton',
    officeId: 'treasury',
    name: 'Alexander Hamilton',
    /*
      The highest competence in the file, and it is not close. Assumption, the
      funding system, the Bank, the Mint, the excise and the customs service
      were all built in five years by a department that did not exist when he
      took it. Loyalty is high but not maximal: he was loyal to the programme
      more than to the man, and he wrote against Adams in 1800.
    */
    competence: 95,
    loyalty: 78,
    availableFrom: '1789-04-30',
    availableUntil: null,
    blocReactions: [
      { bloc: 'financiers', strength: 95, reason: 'The man who made the public debt an asset' },
      { bloc: 'merchants', strength: 70, reason: 'A revenue system built on trade, and a navy to protect it' },
      { bloc: 'artisans', strength: 55, reason: 'The Report on Manufactures was written for them' },
      { bloc: 'planters', strength: -70, reason: 'Assumption made the South pay the North’s debts' },
      { bloc: 'small_farmers', strength: -60, reason: 'The excise, and a Treasury that reaches into the still-house' },
      { bloc: 'frontier_settlers', strength: -75, reason: 'The whiskey tax, and the army sent to collect it' },
    ],
    note:
      'Secretary of the Treasury from September 1789 to January 1795. Designed ' +
      'and carried assumption of the state debts, the funding system, the Bank ' +
      'of the United States, the Mint and the whiskey excise. Nearly every ' +
      'fiscal decision of the period is his, and so is the opposition party that ' +
      'formed against him.',
    sources: [...SENATE_SOURCES, 'Hamilton, "Report on Public Credit" (1790)'],
  },
  {
    id: 'wolcott',
    officeId: 'treasury',
    name: 'Oliver Wolcott Jr.',
    /*
      Competent administrator, and that is the whole of it: he ran the system
      Hamilton had built rather than building anything. High loyalty — he was
      Hamilton's own comptroller and remained his correspondent in office, which
      cuts both ways and is a real feature of the appointment.
    */
    competence: 68,
    loyalty: 85,
    availableFrom: '1791-06-01',
    availableUntil: null,
    blocReactions: [
      { bloc: 'financiers', strength: 55, reason: 'The system continues without interruption' },
      { bloc: 'merchants', strength: 35, reason: 'A steady hand at the custom houses' },
      { bloc: 'small_farmers', strength: -30, reason: 'The same excise, differently signed' },
    ],
    note:
      'Comptroller of the Treasury under Hamilton, then Secretary from February ' +
      '1795 to the end of 1800. Administered the existing system capably and ' +
      'originated little; he continued to correspond with Hamilton on department ' +
      'business after Hamilton had left office.',
    sources: SENATE_SOURCES,
  },
  {
    id: 'gallatin',
    officeId: 'treasury',
    name: 'Albert Gallatin',
    /*
      A counterfactual appointment with an excellent case: he was the best
      finance mind the opposition had, and he did in fact hold this office from
      1801. Loyalty to a FEDERALIST government would be low — he made his name
      attacking Hamilton's accounts from the House.
    */
    competence: 88,
    loyalty: 34,
    availableFrom: '1795-03-01',
    availableUntil: null,
    blocReactions: [
      { bloc: 'small_farmers', strength: 70, reason: 'A Treasury that answers for what it spends' },
      { bloc: 'frontier_settlers', strength: 65, reason: 'He opposed the excise from the western counties themselves' },
      { bloc: 'financiers', strength: -55, reason: 'The man who audited Hamilton line by line' },
      { bloc: 'merchants', strength: -30, reason: 'A sceptic of the whole funding system' },
    ],
    note:
      'Elected to the Senate in 1793 and unseated on a citizenship technicality; ' +
      'then to the House, where he forced the creation of the Ways and Means ' +
      'Committee and made himself the opposition’s authority on finance. He ' +
      'became Secretary of the Treasury in 1801 and held it for twelve years, ' +
      'longer than anyone before or since. Appointing him in the 1790s did not ' +
      'happen and would have been a deliberate turn.',
    sources: [
      ...SENATE_SOURCES,
      'US Senate, "Albert Gallatin: A Featured Biography"',
    ],
  },

  // ==========================================================================
  // STATE
  // ==========================================================================
  {
    id: 'jefferson',
    officeId: 'state',
    name: 'Thomas Jefferson',
    /*
      High competence — five years as minister to France, and the department he
      ran was the one he understood best. Loyalty deliberately low: he opposed
      the Bank as unconstitutional from inside the cabinet, funded Freneau's
      paper while Secretary, and resigned at the end of 1793. That is the
      textbook case of what low loyalty means in this model.
    */
    competence: 84,
    loyalty: 30,
    availableFrom: '1789-04-30',
    availableUntil: '1794-01-01',
    blocReactions: [
      { bloc: 'small_farmers', strength: 80, reason: 'The one man in the cabinet who speaks for them' },
      { bloc: 'planters', strength: 70, reason: 'A Virginian, and no friend of the funding system' },
      { bloc: 'frontier_settlers', strength: 55, reason: 'For the Mississippi, and against the excise' },
      { bloc: 'financiers', strength: -75, reason: 'He called the Bank unconstitutional in writing' },
      { bloc: 'merchants', strength: -45, reason: 'He would discriminate against British trade' },
    ],
    note:
      'Secretary of State from March 1790 to December 1793. Minister to France ' +
      'before that. Opposed the Bank as unconstitutional in a written opinion to ' +
      'Washington, favoured France over Britain in the war of 1793, and resigned ' +
      'after losing both arguments. The disagreement between him and Hamilton is ' +
      'the origin of the first party system.',
    sources: [...SENATE_SOURCES, 'Jefferson, "Opinion on the Constitutionality of a National Bank" (1791)'],
  },
  {
    id: 'randolph',
    officeId: 'state',
    name: 'Edmund Randolph',
    /*
      Middling competence and middling loyalty, and the middle is the point: he
      spent the period trying to hold a position between Hamilton and Jefferson
      and was trusted by neither. He left the office in a scandal over an
      intercepted French dispatch — the reputational risk is real and it is
      priced here rather than editorialised.
    */
    competence: 58,
    loyalty: 55,
    availableFrom: '1789-04-30',
    availableUntil: '1795-08-20',
    blocReactions: [
      { bloc: 'planters', strength: 40, reason: 'A Virginian who is not Jefferson' },
      { bloc: 'merchants', strength: 15, reason: 'No settled position, which is its own comfort' },
      { bloc: 'financiers', strength: -15, reason: 'He would not defend the Bank when it mattered' },
    ],
    note:
      'Attorney General from 1789, then Secretary of State from January 1794. ' +
      'Held both offices for 24 days in January 1794. Resigned in August 1795 ' +
      'after an intercepted dispatch from the French minister Fauchet was used ' +
      'to accuse him of soliciting money; he denied it and published a ' +
      'vindication, and the charge has never been settled either way.',
    sources: [...SENATE_SOURCES, 'Randolph, "A Vindication of Mr Randolph’s Resignation" (1795)'],
  },
  {
    id: 'pickering_state',
    officeId: 'state',
    name: 'Timothy Pickering',
    /*
      Competent and utterly unloyal to anyone he disagreed with, which is what
      actually happened: Adams dismissed him in 1800 for working against the
      peace mission to France from inside the cabinet. High competence, very low
      loyalty, and the pairing is the interesting one in the whole file.
    */
    competence: 70,
    loyalty: 22,
    availableFrom: '1795-01-01',
    availableUntil: null,
    blocReactions: [
      { bloc: 'merchants', strength: 55, reason: 'Firmly for Britain and against France' },
      { bloc: 'financiers', strength: 45, reason: 'A Hamiltonian in a department that matters' },
      { bloc: 'small_farmers', strength: -50, reason: 'The most warlike man in the government' },
      { bloc: 'frontier_settlers', strength: -35, reason: 'His Indian policy was the army first' },
    ],
    note:
      'Postmaster General, then Secretary of War, then Secretary of State from ' +
      'August 1795. Adams dismissed him in May 1800 after he refused to resign, ' +
      'having worked against the mission to France that ended the Quasi-War. He ' +
      'is the clearest case in the period of a competent officer who would not ' +
      'follow the head of government.',
    sources: SENATE_SOURCES,
  },
  {
    id: 'marshall',
    officeId: 'state',
    name: 'John Marshall',
    competence: 86,
    loyalty: 80,
    availableFrom: '1798-08-01',
    availableUntil: null,
    blocReactions: [
      { bloc: 'merchants', strength: 50, reason: 'One of the envoys who refused the XYZ demand' },
      { bloc: 'financiers', strength: 40, reason: 'Sound on contracts and on credit' },
      { bloc: 'planters', strength: 20, reason: 'A Virginian, whatever else he is' },
      { bloc: 'small_farmers', strength: -25, reason: 'A Federalist, and a lawyer' },
    ],
    note:
      'One of the three envoys to France in 1797–98 whose dispatches became the ' +
      'XYZ affair. Secretary of State from June 1800, and Chief Justice from ' +
      'February 1801 — he held both for a month. The most consequential lawyer ' +
      'in American history took this office for seven months.',
    sources: SENATE_SOURCES,
  },

  // ==========================================================================
  // WAR
  // ==========================================================================
  {
    id: 'knox',
    officeId: 'war',
    name: 'Henry Knox',
    /*
      Competence is the hard call in this file. Knox was Washington's trusted
      artillery chief and an able administrator of a department with almost no
      army; he also presided over Harmar's and St Clair's defeats. 62 reflects
      an officer who did the possible with nothing and still lost two armies.
      Loyalty very high — he was Washington's man throughout.
    */
    competence: 62,
    loyalty: 92,
    availableFrom: '1789-04-30',
    availableUntil: '1795-01-01',
    blocReactions: [
      { bloc: 'frontier_settlers', strength: 25, reason: 'He at least sends armies, whatever happens to them' },
      { bloc: 'merchants', strength: 20, reason: 'He argued for a navy before there was one' },
      { bloc: 'small_farmers', strength: -35, reason: 'A standing army is what a standing army is' },
    ],
    note:
      'Secretary of War from 1789 to the end of 1794, having been Washington’s ' +
      'chief of artillery in the Revolution. Argued in cabinet that the United ' +
      'States was bound by its treaties with the Native nations and that ' +
      'settlers, not the nations, were the aggressors — a position the ' +
      'government did not enforce. Presided over Harmar’s defeat in 1790 and St ' +
      'Clair’s in 1791.',
    sources: [
      ...SENATE_SOURCES,
      'US Army Center of Military History, "Secretaries of War"',
      'Knox to Washington on the obligations of the United States, 1789',
    ],
  },
  {
    id: 'mchenry',
    officeId: 'war',
    name: 'James McHenry',
    /*
      Low competence, and the reputation is contested, so the note says so. His
      administration of the department during the Quasi-War mobilisation was
      criticised at the time and he was asked to resign; defenders point out he
      was given an impossible task with no money. Loyalty is high — his fault
      was not disloyalty to Adams but deference to Hamilton.
    */
    competence: 40,
    loyalty: 60,
    availableFrom: '1796-01-01',
    availableUntil: null,
    blocReactions: [
      { bloc: 'merchants', strength: 20, reason: 'A department that will build the frigates' },
      { bloc: 'small_farmers', strength: -30, reason: 'The provisional army, and the taxes for it' },
    ],
    note:
      'Secretary of War from 1796 to 1800. Adams asked for his resignation in ' +
      'May 1800, complaining of the department’s administration during the ' +
      'Quasi-War mobilisation and of McHenry’s deference to Hamilton on ' +
      'appointments. His competence is genuinely contested: he was handed a ' +
      'sudden mobilisation with no established supply system and very little ' +
      'money, and contemporary criticism came largely from men with their own ' +
      'quarrels.',
    sources: [...SENATE_SOURCES, 'US Army Center of Military History, "Secretaries of War"'],
  },
  {
    id: 'wayne',
    officeId: 'war',
    name: 'Anthony Wayne',
    /*
      A counterfactual: he was never Secretary. But he is the officer who
      rebuilt the army after St Clair and won at Fallen Timbers, and appointing
      him would be a real and defensible choice for a player fighting in the
      Ohio country. Competence is high and specific; loyalty is high and
      uncomplicated.
    */
    competence: 78,
    loyalty: 84,
    availableFrom: '1792-04-13',
    availableUntil: '1796-12-15',
    blocReactions: [
      { bloc: 'frontier_settlers', strength: 80, reason: 'The one commander who has actually won out here' },
      { bloc: 'small_farmers', strength: -20, reason: 'A soldier at the head of a department' },
      { bloc: 'clergy', strength: -30, reason: 'A war of conquest, given its own ministry' },
    ],
    note:
      'Commanded the Legion of the United States from 1792, rebuilt and drilled ' +
      'it after St Clair’s defeat, and won at Fallen Timbers in August 1794, ' +
      'which produced the Treaty of Greenville. He was never Secretary of War, ' +
      'so appointing him is a counterfactual — but he is the period’s clearest ' +
      'case of military competence and the appointment is a real option a ' +
      'government could have taken.',
    sources: [
      'Battle of Fallen Timbers, 20 August 1794',
      'Treaty of Greenville, 3 August 1795',
    ],
  },

  // ==========================================================================
  // ATTORNEY GENERAL
  // ==========================================================================
  {
    id: 'randolph_ag',
    officeId: 'attorney_general',
    name: 'Edmund Randolph',
    competence: 66,
    loyalty: 60,
    availableFrom: '1789-04-30',
    availableUntil: '1794-01-26',
    blocReactions: [
      { bloc: 'planters', strength: 35, reason: 'A Virginian lawyer of standing' },
      { bloc: 'merchants', strength: 10, reason: 'No settled position either way' },
    ],
    note:
      'The first Attorney General, from September 1789. Drafted the Virginia ' +
      'Plan at the Convention and then declined to sign the finished ' +
      'Constitution, before supporting ratification. Held the office alongside ' +
      'the State Department for 24 days in January 1794.',
    sources: SENATE_SOURCES,
  },
  {
    id: 'bradford',
    officeId: 'attorney_general',
    name: 'William Bradford',
    competence: 74,
    loyalty: 76,
    availableFrom: '1794-01-01',
    availableUntil: '1795-08-23',
    blocReactions: [
      { bloc: 'clergy', strength: 45, reason: 'He argued in print against the death penalty' },
      { bloc: 'artisans', strength: 25, reason: 'A Pennsylvania lawyer of the reforming kind' },
      { bloc: 'planters', strength: -20, reason: 'A northerner with opinions about punishment' },
    ],
    note:
      'Attorney General from January 1794 until his death in August 1795. ' +
      'Author of "An Enquiry How Far the Punishment of Death Is Necessary in ' +
      'Pennsylvania" (1793), one of the earliest American arguments for ' +
      'restricting capital punishment. One of the commissioners sent to ' +
      'negotiate with the whiskey rebels.',
    sources: [
      ...SENATE_SOURCES,
      'Bradford, "An Enquiry How Far the Punishment of Death Is Necessary in Pennsylvania" (1793)',
    ],
  },
  {
    id: 'lee',
    officeId: 'attorney_general',
    name: 'Charles Lee',
    competence: 60,
    loyalty: 80,
    availableFrom: '1795-09-01',
    availableUntil: null,
    blocReactions: [
      { bloc: 'planters', strength: 25, reason: 'A Virginian, and a Federalist one' },
      { bloc: 'financiers', strength: 20, reason: 'Sound on the government’s own contracts' },
      { bloc: 'small_farmers', strength: -35, reason: 'He defended the Sedition Act' },
    ],
    note:
      'Attorney General from December 1795 to 1801. Defended the ' +
      'constitutionality of the Alien and Sedition Acts and argued for the ' +
      'government in the prosecutions under them.',
    sources: SENATE_SOURCES,
  },
];

export const CANDIDATES_BY_ID: Readonly<Record<string, Candidate>> =
  Object.fromEntries(CANDIDATES.map((c) => [c.id, c]));

/** Everyone who could take a given office on a given ISO date. */
export function candidatesFor(officeId: string): Candidate[] {
  return CANDIDATES.filter((c) => c.officeId === officeId);
}
