/**
 * PHASE 1 EVENT SLATE — 1789 to 1800
 *
 * Nine real events, each with genuine branching choices.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE FOR `historicalContext`
 *
 * A history teacher should be able to read any card here and find nothing
 * false. `body` is narrative framing and may be evocative; `historicalContext`
 * is a factual account of what actually happened and may not be. Every claim
 * in it is checked, and `sources` lists where it was checked.
 *
 * Where a decision is morally serious — the Fugitive Slave Act below — it is
 * presented as the consequential choice it was, with honest context. Not
 * sanitised, not gratuitous.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This file is DATA. It contains no logic. Adding an event here requires no
 * engine change, which is the test of DESIGN.md Rule 4.
 */

import type { GameEvent } from '@/sim/types';

export const EVENTS_1790S: GameEvent[] = [
  // ==========================================================================
  {
    id: 'assumption_1790',
    title: 'The Assumption of State Debts',
    historicalDate: '1790-08-04',
    triggerConditions: [{ kind: 'dateOnOrAfter', date: '1790-06-20' }],
    pausesGame: true,
    weight: 100,
    oneShot: true,
    body:
      'The Secretary of the Treasury proposes that the federal government assume the ' +
      'war debts of the several states. Northern states, deep in debt, are eager. ' +
      'Virginia and the southern states, having largely paid their own, ask why they ' +
      'should be taxed to discharge another state’s obligations. The question is ' +
      'whether this is one nation or thirteen creditors.',
    historicalContext:
      'Congress passed the Funding Act on 4 August 1790, authorising the assumption of ' +
      '$21.5 million in state debts; in the event about $18.3 million was actually ' +
      'assumed, as not every state drew its full allocation. The measure passed as part ' +
      'of the Compromise of 1790, agreed over a dinner at Thomas Jefferson’s New York ' +
      'home in June 1790 between Jefferson, James Madison, and Alexander Hamilton. ' +
      'Southern votes for assumption were traded for the permanent national capital ' +
      'being sited on the Potomac, fixed by the Residence Act of 16 July 1790. ' +
      'Assumption established the principle that federal credit stood behind the whole ' +
      'union, and the federal debt rose from $71.06 million on 1 January 1790 to ' +
      '$75.46 million a year later.',
    sources: [
      'Funding Act of 1790, 1 Stat. 138 (4 August 1790)',
      'Residence Act of 1790, 1 Stat. 130 (16 July 1790)',
      'US Treasury, Fiscal Data, "Historical Debt Outstanding"',
    ],
    options: [
      {
        id: 'assume_full',
        label: 'Assume the state debts in full',
        description:
          'The federal government takes on the war debts of every state, and with them ' +
          'the loyalty of every creditor.',
        requirements: [],
        previewedEffects: [
          'Federal credit strengthens markedly',
          'Northern states are gratified; the South resents the burden',
          'National debt rises by roughly $18 million',
        ],
        effects: [
          { kind: 'treasuryDelta', amount: -18_300_000, reason: 'Assumption of state debts' },
          {
            kind: 'modifier',
            source: 'Funding Act of 1790',
            sourceType: 'law',
            target: 'nation.legitimacy',
            value: 6,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'regionSentiment', regionId: 'new_england', delta: 12 },
          { kind: 'regionSentiment', regionId: 'mid_atlantic', delta: 8 },
          { kind: 'regionSentiment', regionId: 'south', delta: -14 },
          { kind: 'setFlag', key: 'assumption_passed', value: true },
          { kind: 'unlockLaw', lawId: 'bank_of_the_united_states' },
        ],
      },
      {
        id: 'assume_with_compromise',
        label: 'Assume the debts, and site the capital on the Potomac',
        description:
          'Trade the southern votes you need for the permanent seat of government. ' +
          'This is what actually happened.',
        requirements: [],
        previewedEffects: [
          'Federal credit strengthens',
          'Southern resentment is substantially bought off',
          'National debt rises by roughly $18 million',
        ],
        effects: [
          { kind: 'treasuryDelta', amount: -18_300_000, reason: 'Assumption of state debts' },
          {
            kind: 'modifier',
            source: 'Compromise of 1790',
            sourceType: 'law',
            target: 'nation.legitimacy',
            value: 8,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'regionSentiment', regionId: 'new_england', delta: 10 },
          { kind: 'regionSentiment', regionId: 'mid_atlantic', delta: 6 },
          { kind: 'regionSentiment', regionId: 'south', delta: -4 },
          { kind: 'setFlag', key: 'assumption_passed', value: true },
          { kind: 'setFlag', key: 'capital_on_potomac', value: true },
          { kind: 'unlockLaw', lawId: 'bank_of_the_united_states' },
        ],
      },
      {
        id: 'refuse_assumption',
        label: 'Let each state answer for its own debts',
        description:
          'The federal government confines itself to its own obligations. States that ' +
          'borrowed heavily must find their own way.',
        requirements: [],
        previewedEffects: [
          'The Treasury is spared an enormous liability',
          'Federal credit remains untested and weak',
          'Northern creditors are alienated',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'Assumption refused',
            sourceType: 'event',
            target: 'nation.sectionalTension',
            value: 8,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'regionSentiment', regionId: 'new_england', delta: -12 },
          { kind: 'regionSentiment', regionId: 'mid_atlantic', delta: -8 },
          { kind: 'regionSentiment', regionId: 'south', delta: 6 },
          { kind: 'setFlag', key: 'assumption_passed', value: false },
        ],
      },
    ],
  },

  // ==========================================================================
  {
    id: 'whiskey_excise_1791',
    title: 'The Excise on Distilled Spirits',
    historicalDate: '1791-03-03',
    triggerConditions: [{ kind: 'dateOnOrAfter', date: '1791-02-20' }],
    pausesGame: true,
    weight: 95,
    oneShot: true,
    body:
      'The Treasury proposes an excise upon distilled spirits to service the assumed ' +
      'debt. Representatives from the western counties warn that whiskey is not a ' +
      'luxury there but the only means by which grain reaches market at all. A tax on ' +
      'spirits, they say, is a tax on the act of selling anything.',
    historicalContext:
      'Congress passed the excise on distilled spirits on 3 March 1791, the first ' +
      'internal federal tax in the nation’s history. It was intended to service the ' +
      'debt assumed under the Funding Act. Resistance in western Pennsylvania grew over ' +
      'three years into the Whiskey Rebellion of 1794. The grievance was structural ' +
      'rather than merely fiscal: transporting bulk grain over the Alleghenies was ' +
      'uneconomic, so western farmers distilled it into whiskey, which was compact ' +
      'enough to carry and served locally as a medium of exchange. Taxing whiskey ' +
      'therefore fell on western farmers far more heavily than on eastern ones.',
    sources: [
      'Act of 3 March 1791, 1 Stat. 199 ("An Act repealing... the duties heretofore laid upon Distilled Spirits")',
      'US Alcohol and Tobacco Tax and Trade Bureau, "The Whiskey Rebellion"',
    ],
    options: [
      {
        id: 'enact_full',
        label: 'Enact the excise at the full proposed rate',
        description: 'The debt must be serviced, and this is the revenue available.',
        requirements: [],
        previewedEffects: [
          'Meaningful new revenue',
          'Frontier distillers are angered',
          'Unrest in the western counties becomes likely',
        ],
        effects: [
          { kind: 'setTaxRate', tax: 'excise', value: 0.25 },
          { kind: 'regionSentiment', regionId: 'frontier', delta: -18 },
          { kind: 'setFlag', key: 'excise_enacted', value: true },
          { kind: 'scheduleEvent', eventId: 'whiskey_rebellion_1794', inDays: 1230 },
        ],
      },
      {
        id: 'enact_reduced',
        label: 'Enact the excise at a reduced rate',
        description: 'Take less, and give the western counties less to resent.',
        requirements: [],
        previewedEffects: [
          'Modest new revenue',
          'Frontier resentment is real but contained',
        ],
        effects: [
          { kind: 'setTaxRate', tax: 'excise', value: 0.12 },
          { kind: 'regionSentiment', regionId: 'frontier', delta: -8 },
          { kind: 'setFlag', key: 'excise_enacted', value: true },
        ],
      },
      {
        id: 'decline_excise',
        label: 'Decline to tax spirits',
        description:
          'Preserve frontier goodwill. The debt must then be serviced from elsewhere.',
        requirements: [],
        previewedEffects: [
          'No new revenue; debt service must come from customs or borrowing',
          'The frontier is conciliated',
        ],
        effects: [
          { kind: 'regionSentiment', regionId: 'frontier', delta: 8 },
          { kind: 'setFlag', key: 'excise_enacted', value: false },
          {
            kind: 'modifier',
            source: 'Excise declined',
            sourceType: 'event',
            target: 'nation.legitimacy',
            value: -3,
            isPercentage: false,
            durationDays: 730,
          },
        ],
      },
    ],
  },

  // ==========================================================================
  {
    id: 'bank_1791',
    title: 'A Bank of the United States',
    historicalDate: '1791-02-25',
    triggerConditions: [
      { kind: 'dateOnOrAfter', date: '1791-01-10' },
      { kind: 'flag', key: 'assumption_passed', equals: true },
    ],
    pausesGame: true,
    weight: 90,
    oneShot: true,
    body:
      'A national bank is proposed: to hold federal deposits, to issue notes that ' +
      'circulate as money, and to lend to the government in emergency. The Secretary of ' +
      'State objects that the Constitution nowhere grants the power to charter a ' +
      'corporation. The Secretary of the Treasury answers that powers necessary to ' +
      'execute the enumerated ones are implied in them.',
    historicalContext:
      'Washington signed the charter of the First Bank of the United States on ' +
      '25 February 1791, granting it a twenty-year term. The dispute it provoked was ' +
      'the first great argument over constitutional interpretation: Jefferson and ' +
      'Madison argued for strict construction, holding that Congress possessed only the ' +
      'powers explicitly enumerated; Hamilton argued for implied powers under the ' +
      'Necessary and Proper Clause. Washington sided with Hamilton. The Bank’s charter ' +
      'was allowed to lapse in 1811, and the argument it opened over the reach of ' +
      'federal power has never entirely closed.',
    sources: [
      'Act of 25 February 1791, 1 Stat. 191 (Bank of the United States)',
      'US Constitution, Article I, Section 8 (Necessary and Proper Clause)',
    ],
    options: [
      {
        id: 'charter_bank',
        label: 'Charter the Bank',
        description:
          'Accept the doctrine of implied powers. Federal credit and commerce gain a ' +
          'permanent instrument.',
        requirements: [],
        previewedEffects: [
          'Federal credit improves substantially',
          'Commerce and manufacturing benefit',
          'Strict constructionists are alarmed',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'Bank of the United States',
            sourceType: 'law',
            target: 'nation.stability',
            value: 4,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'regionSentiment', regionId: 'new_england', delta: 8 },
          { kind: 'regionSentiment', regionId: 'mid_atlantic', delta: 8 },
          { kind: 'regionSentiment', regionId: 'south', delta: -8 },
          { kind: 'setFlag', key: 'bank_chartered', value: true },
        ],
      },
      {
        id: 'veto_bank',
        label: 'Refuse the charter as unconstitutional',
        description:
          'Hold that Congress possesses only the powers the Constitution enumerates.',
        requirements: [],
        previewedEffects: [
          'Strict construction is affirmed',
          'Federal credit develops more slowly',
          'The South and the frontier approve',
        ],
        effects: [
          { kind: 'regionSentiment', regionId: 'south', delta: 8 },
          { kind: 'regionSentiment', regionId: 'frontier', delta: 5 },
          { kind: 'regionSentiment', regionId: 'new_england', delta: -8 },
          { kind: 'setFlag', key: 'bank_chartered', value: false },
        ],
      },
    ],
  },

  // ==========================================================================
  {
    id: 'bill_of_rights_1791',
    title: 'The Bill of Rights is Ratified',
    historicalDate: '1791-12-15',
    triggerConditions: [{ kind: 'dateOnOrAfter', date: '1791-12-15' }],
    pausesGame: true,
    weight: 85,
    oneShot: true,
    body:
      'Ten amendments have been ratified by the requisite number of states. They bind ' +
      'the government you lead, and they were the price of ratification itself.',
    historicalContext:
      'Virginia’s ratification on 15 December 1791 completed the three-fourths majority ' +
      'required, bringing ten of the twelve amendments proposed by Congress in 1789 into ' +
      'effect. They were promised during the ratification debates to satisfy ' +
      'Anti-Federalists who feared a government without explicit limits. One of the two ' +
      'amendments not ratified at the time concerned congressional pay; it was ' +
      'eventually ratified in 1992 as the Twenty-Seventh Amendment, more than two ' +
      'centuries later.',
    sources: [
      'United States Constitution, Amendments I–X (ratified 15 December 1791)',
      'US National Archives, "The Bill of Rights"',
    ],
    options: [
      {
        id: 'embrace',
        label: 'Proclaim the amendments as the foundation of the republic',
        description: 'Bind yourself publicly to the limits they impose.',
        requirements: [{ kind: 'governmentType', is: 'republic' }],
        previewedEffects: ['Legitimacy rises considerably', 'Stability improves'],
        effects: [
          {
            kind: 'modifier',
            source: 'Bill of Rights',
            sourceType: 'event',
            target: 'nation.legitimacy',
            value: 8,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'regionSentiment', regionId: 'all', delta: 6 },
        ],
      },
      {
        id: 'accept_as_crown',
        label: 'Accept the amendments as a grant from the crown',
        description:
          'Present the liberties as conferred by your authority rather than as limits ' +
          'upon it.',
        requirements: [{ kind: 'governmentType', is: 'monarchy' }],
        previewedEffects: [
          'Legitimacy rises modestly',
          'The northern states remain unconvinced',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'Bill of Rights',
            sourceType: 'event',
            target: 'nation.legitimacy',
            value: 5,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'regionSentiment', regionId: 'south', delta: 5 },
          { kind: 'regionSentiment', regionId: 'new_england', delta: 2 },
        ],
      },
    ],
  },

  // ==========================================================================
  {
    id: 'fugitive_slave_1793',
    title: 'The Fugitive Slave Act',
    historicalDate: '1793-02-12',
    triggerConditions: [{ kind: 'dateOnOrAfter', date: '1793-02-01' }],
    pausesGame: true,
    weight: 88,
    oneShot: true,
    body:
      'Congress presents a bill to enforce the Constitution’s clause respecting persons ' +
      'held to service who escape into another state. It would empower an enslaver or ' +
      'their agent to seize a person in any state and obtain a certificate of removal ' +
      'from a magistrate. The accused would have no right to a jury, and no right to ' +
      'testify.',
    historicalContext:
      'The Fugitive Slave Act was signed on 12 February 1793. It implemented Article IV, ' +
      'Section 2 of the Constitution, permitting an enslaver or their agent to seize a ' +
      'person alleged to have escaped and to obtain a certificate of removal from a ' +
      'federal judge or local magistrate on their own oral testimony or affidavit. The ' +
      'accused could not demand a jury trial and could not testify on their own behalf, ' +
      'which meant free Black Americans could be, and were, seized and delivered into ' +
      'slavery with almost no legal protection. Obstructing a seizure carried a $500 ' +
      'penalty. Several northern states later passed personal liberty laws attempting to ' +
      'counter it. It remained in force until 1864.',
    sources: [
      'Fugitive Slave Act of 1793, 1 Stat. 302 (12 February 1793)',
      'US Constitution, Article IV, Section 2, Clause 3',
    ],
    options: [
      {
        id: 'sign_act',
        label: 'Sign the Act',
        description:
          'Enforce the constitutional clause as the southern states demand. This is what ' +
          'happened.',
        requirements: [],
        previewedEffects: [
          'The South is satisfied; the union holds',
          'Sectional division deepens permanently',
        ],
        effects: [
          { kind: 'regionSentiment', regionId: 'south', delta: 10 },
          { kind: 'regionSentiment', regionId: 'new_england', delta: -8 },
          {
            kind: 'modifier',
            source: 'Fugitive Slave Act of 1793',
            sourceType: 'law',
            target: 'nation.sectionalTension',
            value: 8,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'setFlag', key: 'fugitive_slave_act', value: true },
        ],
      },
      {
        id: 'demand_due_process',
        label: 'Insist on jury trial before signing',
        description:
          'Require that any person seized may demand a jury and may testify. The southern ' +
          'states will regard this as nullification by procedure.',
        requirements: [],
        previewedEffects: [
          'Northern sentiment improves',
          'The South is angered and sectional division widens sharply',
        ],
        effects: [
          { kind: 'regionSentiment', regionId: 'new_england', delta: 8 },
          { kind: 'regionSentiment', regionId: 'mid_atlantic', delta: 5 },
          { kind: 'regionSentiment', regionId: 'south', delta: -16 },
          {
            kind: 'modifier',
            source: 'Due process demanded for the accused',
            sourceType: 'event',
            target: 'nation.sectionalTension',
            value: 14,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'setFlag', key: 'fugitive_slave_act', value: false },
        ],
      },
      {
        id: 'refuse_act',
        label: 'Refuse the bill entirely',
        description:
          'Decline to legislate on the matter at all, leaving the clause unenforced.',
        requirements: [],
        previewedEffects: [
          'A severe rupture with the southern states',
          'Sectional division becomes the central question of the republic',
        ],
        effects: [
          { kind: 'regionSentiment', regionId: 'south', delta: -25 },
          { kind: 'regionSentiment', regionId: 'new_england', delta: 12 },
          {
            kind: 'modifier',
            source: 'Fugitive Slave Act refused',
            sourceType: 'event',
            target: 'nation.sectionalTension',
            value: 22,
            isPercentage: false,
            durationDays: null,
          },
          {
            kind: 'modifier',
            source: 'Fugitive Slave Act refused',
            sourceType: 'event',
            target: 'nation.stability',
            value: -6,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'setFlag', key: 'fugitive_slave_act', value: false },
        ],
      },
    ],
  },

  // ==========================================================================
  {
    id: 'neutrality_1793',
    title: 'War Between Britain and France',
    historicalDate: '1793-04-22',
    triggerConditions: [{ kind: 'dateOnOrAfter', date: '1793-04-10' }],
    pausesGame: true,
    weight: 92,
    oneShot: true,
    body:
      'France, having executed its king, is at war with Britain. The treaty of alliance ' +
      'of 1778 binds the United States to France, who came to our aid when no one else ' +
      'would. Yet Britain commands the seas on which our commerce depends, and the ' +
      'republic has no navy worth the name.',
    historicalContext:
      'Washington issued the Proclamation of Neutrality on 22 April 1793, declaring the ' +
      'United States impartial toward the belligerents. The decision was bitterly ' +
      'contested: the Treaty of Alliance of 1778 with France remained technically in ' +
      'force, and Jefferson’s faction held that gratitude and republican principle ' +
      'demanded support for France. Hamilton’s faction argued the treaty had been made ' +
      'with a monarchy that no longer existed and that war with Britain would be ruinous. ' +
      'The dispute hardened the emerging division between Federalists and Democratic-' +
      'Republicans. The European wars that followed proved enormously profitable for ' +
      'American shipping, as a neutral carrier able to trade with both sides.',
    sources: [
      'Proclamation of Neutrality (22 April 1793)',
      'Treaty of Alliance between the United States and France (1778)',
    ],
    options: [
      {
        id: 'proclaim_neutrality',
        label: 'Proclaim neutrality',
        description:
          'Declare the United States impartial. Trade with both, fight neither.',
        requirements: [],
        previewedEffects: [
          'American shipping profits enormously as a neutral carrier',
          'Pro-French opinion is outraged',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'Proclamation of Neutrality',
            sourceType: 'event',
            target: 'nation.stability',
            value: 3,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'regionSentiment', regionId: 'new_england', delta: 10 },
          { kind: 'regionSentiment', regionId: 'south', delta: -6 },
          { kind: 'setFlag', key: 'neutrality_proclaimed', value: true },
          { kind: 'scheduleEvent', eventId: 'jay_treaty_1795', inDays: 790 },
        ],
      },
      {
        id: 'honour_alliance',
        label: 'Honour the alliance with France',
        description:
          'Stand by the treaty of 1778. Britain will treat our shipping as hostile.',
        requirements: [],
        previewedEffects: [
          'Trade with Britain collapses; commerce suffers badly',
          'Republican opinion is gratified',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'Alliance with France honoured',
            sourceType: 'event',
            target: 'nation.stability',
            value: -8,
            isPercentage: false,
            durationDays: 1460,
          },
          { kind: 'regionSentiment', regionId: 'new_england', delta: -15 },
          { kind: 'regionSentiment', regionId: 'south', delta: 8 },
          { kind: 'regionSentiment', regionId: 'frontier', delta: 5 },
          { kind: 'setFlag', key: 'neutrality_proclaimed', value: false },
        ],
      },
    ],
  },

  // ==========================================================================
  {
    id: 'whiskey_rebellion_1794',
    title: 'The Whiskey Rebellion',
    historicalDate: '1794-07-16',
    triggerConditions: [
      { kind: 'dateOnOrAfter', date: '1794-07-16' },
      { kind: 'flag', key: 'excise_enacted', equals: true },
    ],
    pausesGame: true,
    weight: 98,
    oneShot: true,
    body:
      'Western Pennsylvania is in open defiance. A federal marshal has been fired upon, ' +
      'the regional excise inspector’s house burned, and some thousands have mustered ' +
      'outside Pittsburgh. The revenue is not being collected. The question is no longer ' +
      'fiscal: it is whether federal law reaches beyond the seaboard at all.',
    historicalContext:
      'Resistance to the 1791 excise culminated in the summer of 1794 with an attack on ' +
      'the home of regional inspector John Neville and a muster of several thousand ' +
      'men near Pittsburgh. Washington invoked the Militia Act and called out ' +
      'approximately 13,000 militia from Pennsylvania, Virginia, Maryland, and New ' +
      'Jersey. On 19 September 1794 he rode west with the army, becoming the only ' +
      'sitting President ever to lead troops in the field, and reached Bedford, ' +
      'Pennsylvania, in October before returning to Philadelphia and handing command to ' +
      'Henry "Light-Horse Harry" Lee. The rebellion dissolved without a battle. Around ' +
      'twenty men were arrested and two convicted of treason; Washington pardoned both. ' +
      'The episode established that the federal government would enforce its laws, and ' +
      'it cost the administration heavily in the west.',
    sources: [
      'US Alcohol and Tobacco Tax and Trade Bureau, "The Whiskey Rebellion"',
      'Mount Vernon Ladies’ Association, "George Washington and the Whiskey Rebellion"',
      'Militia Act of 1792, 1 Stat. 264',
    ],
    options: [
      {
        id: 'march_the_militia',
        label: 'Call out the militia and lead them west yourself',
        description:
          'Demonstrate beyond argument that federal law is enforceable everywhere. This ' +
          'is what happened.',
        requirements: [],
        previewedEffects: [
          'Federal authority is decisively established',
          'The frontier is subdued and embittered',
          'Considerable expense',
        ],
        effects: [
          { kind: 'treasuryDelta', amount: -1_200_000, reason: 'Militia expedition' },
          {
            kind: 'modifier',
            source: 'Whiskey Rebellion suppressed',
            sourceType: 'crisis',
            target: 'nation.stability',
            value: 8,
            isPercentage: false,
            durationDays: null,
          },
          {
            kind: 'modifier',
            source: 'Whiskey Rebellion suppressed',
            sourceType: 'crisis',
            target: 'region.frontier.sentiment',
            value: -12,
            isPercentage: false,
            durationDays: 1825,
          },
          { kind: 'setFlag', key: 'rebellion_suppressed', value: true },
        ],
      },
      {
        id: 'negotiate',
        label: 'Send commissioners to negotiate',
        description:
          'Offer amnesty in exchange for submission, and avoid marching an army against ' +
          'citizens.',
        requirements: [],
        previewedEffects: [
          'The frontier is conciliated',
          'Federal authority is seen to have flinched',
          'Excise collection remains poor',
        ],
        effects: [
          { kind: 'regionSentiment', regionId: 'frontier', delta: 10 },
          {
            kind: 'modifier',
            source: 'Rebellion negotiated',
            sourceType: 'crisis',
            target: 'nation.legitimacy',
            value: -6,
            isPercentage: false,
            durationDays: 1095,
          },
          {
            kind: 'modifier',
            source: 'Rebellion negotiated',
            sourceType: 'crisis',
            target: 'nation.stability',
            value: -4,
            isPercentage: false,
            durationDays: 730,
          },
        ],
      },
      {
        id: 'repeal_excise',
        label: 'Repeal the excise',
        description:
          'Concede the grievance entirely. The revenue is lost and the precedent is set ' +
          'that defiance works.',
        requirements: [],
        previewedEffects: [
          'The frontier is delighted',
          'Excise revenue ends',
          'Federal authority is materially weakened',
        ],
        effects: [
          { kind: 'setTaxRate', tax: 'excise', value: 0 },
          { kind: 'regionSentiment', regionId: 'frontier', delta: 20 },
          {
            kind: 'modifier',
            source: 'Excise repealed under duress',
            sourceType: 'crisis',
            target: 'nation.legitimacy',
            value: -12,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'setFlag', key: 'excise_enacted', value: false },
        ],
      },
    ],
  },

  // ==========================================================================
  {
    id: 'jay_treaty_1795',
    title: 'The Jay Treaty',
    historicalDate: '1795-06-24',
    triggerConditions: [
      { kind: 'dateOnOrAfter', date: '1795-06-01' },
      { kind: 'flag', key: 'neutrality_proclaimed', equals: true },
    ],
    pausesGame: true,
    weight: 87,
    oneShot: true,
    body:
      'The envoy to London has returned with a treaty. Britain will at last evacuate the ' +
      'western forts it has held since the peace, and American commerce gains a settled ' +
      'footing. But there is no concession on the impressment of our sailors, and no ' +
      'compensation for the enslaved people carried off at the war’s end. The terms are ' +
      'widely read as a humiliation.',
    historicalContext:
      'John Jay negotiated the treaty in London, signing it on 19 November 1794. The ' +
      'Senate ratified it on 24 June 1795 by exactly the required two-thirds, and ' +
      'Washington signed it on 18 August 1795. Britain agreed to evacuate the ' +
      'northwestern forts it had retained in violation of the 1783 peace, and the treaty ' +
      'secured a decade of profitable Anglo-American trade. It obtained nothing on ' +
      'impressment, and it was ferociously unpopular: Jay was burned in effigy across ' +
      'the country, and the treaty crystallised the split between Federalists and ' +
      'Democratic-Republicans into organised political parties. It is a clear case of a ' +
      'measure that was materially beneficial and politically disastrous.',
    sources: [
      'Treaty of Amity, Commerce and Navigation (Jay Treaty), signed 19 November 1794',
      'US Senate ratification, 24 June 1795',
    ],
    options: [
      {
        id: 'ratify',
        label: 'Ratify the treaty',
        description:
          'Accept the humiliation for the commerce and the forts. This is what happened.',
        requirements: [],
        previewedEffects: [
          'Trade with Britain is secured; commerce flourishes',
          'The western forts are evacuated',
          'Furious public opposition; legitimacy suffers',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'Jay Treaty',
            sourceType: 'event',
            target: 'nation.legitimacy',
            value: -7,
            isPercentage: false,
            durationDays: 1095,
          },
          { kind: 'regionSentiment', regionId: 'new_england', delta: 10 },
          { kind: 'regionSentiment', regionId: 'frontier', delta: 8 },
          { kind: 'regionSentiment', regionId: 'south', delta: -14 },
          { kind: 'setFlag', key: 'jay_treaty_ratified', value: true },
        ],
      },
      {
        id: 'reject',
        label: 'Reject the treaty',
        description:
          'Refuse terms that concede impressment. Britain keeps the forts and commerce ' +
          'remains at hazard.',
        requirements: [],
        previewedEffects: [
          'Popular opinion is gratified',
          'Trade remains vulnerable to British seizure',
          'The western forts remain in British hands',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'Jay Treaty rejected',
            sourceType: 'event',
            target: 'nation.legitimacy',
            value: 5,
            isPercentage: false,
            durationDays: 730,
          },
          { kind: 'regionSentiment', regionId: 'south', delta: 10 },
          { kind: 'regionSentiment', regionId: 'new_england', delta: -12 },
          { kind: 'regionSentiment', regionId: 'frontier', delta: -8 },
          { kind: 'setFlag', key: 'jay_treaty_ratified', value: false },
        ],
      },
    ],
  },

  // ==========================================================================
  {
    id: 'alien_sedition_1798',
    title: 'The Alien and Sedition Acts',
    historicalDate: '1798-07-14',
    triggerConditions: [{ kind: 'dateOnOrAfter', date: '1798-06-18' }],
    pausesGame: true,
    weight: 86,
    oneShot: true,
    body:
      'With an undeclared naval war against France under way, Congress presents four ' +
      'acts: lengthening the residence required for citizenship, empowering the ' +
      'President to deport aliens judged dangerous, and making it criminal to publish ' +
      'false or malicious writing against the government. Supporters call it necessary ' +
      'in wartime. Opponents call it the end of the First Amendment.',
    historicalContext:
      'Four acts were passed between June and July 1798: the Naturalization Act ' +
      '(18 June), the Alien Friends Act (25 June), the Alien Enemies Act (6 July), and ' +
      'the Sedition Act (14 July). The Sedition Act criminalised false, scandalous, and ' +
      'malicious writing against the government, and about twenty-five people were ' +
      'arrested under it, mostly Democratic-Republican newspaper editors; ten were ' +
      'convicted. The acts provoked the Virginia and Kentucky Resolutions, drafted ' +
      'secretly by Madison and Jefferson, which argued that states could judge the ' +
      'constitutionality of federal law — an argument later drawn upon by advocates of ' +
      'nullification and secession. Most of the acts expired or were repealed by 1802. ' +
      'They are generally regarded as a principal cause of the Federalists’ defeat in ' +
      '1800.',
    sources: [
      'Naturalization Act, 1 Stat. 566 (18 June 1798)',
      'Alien Friends Act, 1 Stat. 570 (25 June 1798)',
      'Alien Enemies Act, 1 Stat. 577 (6 July 1798)',
      'Sedition Act, 1 Stat. 596 (14 July 1798)',
    ],
    options: [
      {
        id: 'sign_all',
        label: 'Sign all four acts',
        description:
          'Suppress dissent for the duration of the crisis. This is what happened.',
        requirements: [],
        previewedEffects: [
          'Short-term stability improves',
          'Legitimacy falls sharply and lastingly',
          'Sectional and party division deepens',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'Alien and Sedition Acts',
            sourceType: 'law',
            target: 'nation.stability',
            value: 6,
            isPercentage: false,
            durationDays: 1095,
          },
          {
            kind: 'modifier',
            source: 'Alien and Sedition Acts',
            sourceType: 'law',
            target: 'nation.legitimacy',
            value: -14,
            isPercentage: false,
            durationDays: null,
          },
          {
            kind: 'modifier',
            source: 'Alien and Sedition Acts',
            sourceType: 'law',
            target: 'nation.sectionalTension',
            value: 10,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'regionSentiment', regionId: 'all', delta: -6 },
          { kind: 'setFlag', key: 'sedition_act', value: true },
        ],
      },
      {
        id: 'aliens_only',
        label: 'Sign the alien acts but veto the Sedition Act',
        description:
          'Take the wartime powers over foreign nationals; refuse to criminalise ' +
          'criticism of the government.',
        requirements: [],
        previewedEffects: [
          'Modest stability gain',
          'Legitimacy is largely preserved',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'Alien Acts',
            sourceType: 'law',
            target: 'nation.stability',
            value: 3,
            isPercentage: false,
            durationDays: 1095,
          },
          {
            kind: 'modifier',
            source: 'Alien Acts',
            sourceType: 'law',
            target: 'nation.legitimacy',
            value: -3,
            isPercentage: false,
            durationDays: 730,
          },
          { kind: 'setFlag', key: 'sedition_act', value: false },
        ],
      },
      {
        id: 'veto_all',
        label: 'Veto all four',
        description:
          'Hold that a republic at war does not cease to be a republic.',
        requirements: [],
        previewedEffects: [
          'Legitimacy rises',
          'No wartime powers; stability suffers during the crisis',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'Alien and Sedition Acts vetoed',
            sourceType: 'event',
            target: 'nation.legitimacy',
            value: 8,
            isPercentage: false,
            durationDays: null,
          },
          {
            kind: 'modifier',
            source: 'No wartime powers',
            sourceType: 'event',
            target: 'nation.stability',
            value: -5,
            isPercentage: false,
            durationDays: 1095,
          },
          { kind: 'setFlag', key: 'sedition_act', value: false },
        ],
      },
    ],
  },
];
