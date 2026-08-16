/**
 * PHASE 1 EVENT SLATE, CONTINUED
 *
 * A continuation of `events1790s.ts`, split only for file length. Same rules
 * apply: `body` may be evocative, `historicalContext` must be factual, and
 * every factual claim is checked against the sources listed on the event.
 *
 * These five fill out the decade so the 1790s feel populated rather than
 * sparse: the first congressional fight over slavery, an epidemic that emptied
 * the capital, the treaty that opened the Mississippi, the precedent
 * Washington set by leaving, and the affair that produced an undeclared war.
 */

import type { GameEvent } from '@/sim/types';

export const EVENTS_1790S_ADDITIONAL: GameEvent[] = [
  // ==========================================================================
  {
    id: 'quaker_petitions_1790',
    title: 'The Antislavery Petitions',
    historicalDate: '1790-02-11',
    triggerConditions: [{ kind: 'dateOnOrAfter', date: '1790-02-11' }],
    pausesGame: true,
    weight: 84,
    oneShot: true,
    body:
      'Quaker delegations from Philadelphia and New York have petitioned Congress to ' +
      'end the importation of enslaved people. A second petition, from the ' +
      'Pennsylvania Abolition Society and signed by Benjamin Franklin, goes further ' +
      'and asks Congress to work toward abolition itself. Southern members are ' +
      'incandescent, and say plainly that the union will not survive the question ' +
      'being asked.',
    historicalContext:
      'On 11 February 1790 Quaker delegations from the Philadelphia and New York ' +
      'Yearly Meetings petitioned the First Congress to end the slave trade. The ' +
      'following day a petition from the Pennsylvania Society for Promoting the ' +
      'Abolition of Slavery, signed by Benjamin Franklin as its president, asked ' +
      'Congress to go further and act against slavery itself. It was among the last ' +
      'public acts of Franklin’s life; he died two months later. A House committee ' +
      'reported on 5 March 1790 that the Constitution restrained Congress from ' +
      'prohibiting the importation of enslaved people before 1808 or from ' +
      'emancipating anyone, and the petitions were tabled. The debate that followed ' +
      'rehearsed almost every argument that would be made about slavery for the next ' +
      'seventy years.',
    sources: [
      'Petition from the Pennsylvania Society for the Abolition of Slavery to the First Congress, February 1790 (National Constitution Center)',
      'US National Archives, "From Ben Franklin to the Civil War: Antislavery Petitions in Congress"',
      'US Constitution, Article I, Section 9, Clause 1',
    ],
    options: [
      {
        id: 'table_petitions',
        label: 'Accept the committee report and table the petitions',
        description:
          'Hold that the Constitution forecloses the question until 1808. This is what ' +
          'happened.',
        requirements: [],
        previewedEffects: [
          'The southern states are reassured and the union holds',
          'The question is deferred, not settled',
        ],
        effects: [
          { kind: 'regionSentiment', regionId: 'south', delta: 8 },
          { kind: 'regionSentiment', regionId: 'new_england', delta: -4 },
          {
            kind: 'modifier',
            source: 'Antislavery petitions tabled',
            sourceType: 'event',
            target: 'nation.sectionalTension',
            value: 5,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'setFlag', key: 'petitions_tabled', value: true },
        ],
      },
      {
        id: 'permit_debate',
        label: 'Let the petitions be debated on their merits',
        description:
          'Decline to rule the question out of order. The debate will be long and it ' +
          'will not be contained.',
        requirements: [],
        previewedEffects: [
          'Northern opinion is gratified',
          'The southern states are alarmed and sectional division deepens sharply',
        ],
        effects: [
          { kind: 'regionSentiment', regionId: 'new_england', delta: 10 },
          { kind: 'regionSentiment', regionId: 'mid_atlantic', delta: 6 },
          { kind: 'regionSentiment', regionId: 'south', delta: -18 },
          {
            kind: 'modifier',
            source: 'Slavery debated in Congress',
            sourceType: 'event',
            target: 'nation.sectionalTension',
            value: 16,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'setFlag', key: 'petitions_tabled', value: false },
        ],
      },
      {
        id: 'end_the_trade',
        label: 'Move to end the importation of enslaved people at once',
        description:
          'Argue that the 1808 clause sets a limit on delay, not a licence for it. ' +
          'The southern states will call it a breach of the bargain that made the ' +
          'Constitution possible.',
        requirements: [],
        previewedEffects: [
          'A severe rupture with the southern states',
          'Sectional division becomes the defining question of the republic',
        ],
        effects: [
          { kind: 'regionSentiment', regionId: 'new_england', delta: 14 },
          { kind: 'regionSentiment', regionId: 'south', delta: -30 },
          {
            kind: 'modifier',
            source: 'Move against the slave trade',
            sourceType: 'event',
            target: 'nation.sectionalTension',
            value: 26,
            isPercentage: false,
            durationDays: null,
          },
          {
            kind: 'modifier',
            source: 'Move against the slave trade',
            sourceType: 'event',
            target: 'nation.stability',
            value: -7,
            isPercentage: false,
            durationDays: 1460,
          },
          { kind: 'setFlag', key: 'petitions_tabled', value: false },
        ],
      },
    ],
  },

  // ==========================================================================
  {
    id: 'yellow_fever_1793',
    title: 'Yellow Fever in the Capital',
    historicalDate: '1793-08-01',
    triggerConditions: [{ kind: 'dateOnOrAfter', date: '1793-08-01' }],
    pausesGame: true,
    weight: 89,
    oneShot: true,
    body:
      'A fever is spreading through Philadelphia. The dead are carried out daily and ' +
      'the physicians disagree violently about cause and cure. Those who can afford ' +
      'to leave are leaving. The seat of government is emptying, and there is no ' +
      'provision anywhere in the Constitution for what to do when the capital itself ' +
      'becomes uninhabitable.',
    historicalContext:
      'Between 1 August and 9 November 1793, yellow fever killed more than 5,000 ' +
      'people in Philadelphia, then the most populous city in the United States and ' +
      'the temporary seat of the federal government under the Residence Act. The ' +
      'city held roughly 50,000 residents; about 20,000 fled, some 40 percent of the ' +
      'population, including virtually every federal officer. Washington left for ' +
      'Mount Vernon on 10 September. The disease is carried by mosquitoes, which was ' +
      'not understood at the time; the epidemic ended with the first frosts. The ' +
      'city’s free Black community, wrongly believed to be immune, was recruited to ' +
      'nurse the sick and bury the dead, and suffered heavily for it.',
    sources: [
      'J. H. Powell, Bring Out Your Dead: The Great Plague of Yellow Fever in Philadelphia in 1793',
      'Historical Society of Pennsylvania, contemporary mortality returns',
    ],
    options: [
      {
        id: 'withdraw_government',
        label: 'Withdraw the government from the city',
        description:
          'Remove the officers of government beyond the reach of the fever and wait ' +
          'for the frosts. This is what happened.',
        requirements: [],
        previewedEffects: [
          'The government survives intact',
          'Administration halts for months',
          'The abandonment is remembered',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'Yellow fever epidemic',
            sourceType: 'crisis',
            target: 'nation.stability',
            value: -6,
            isPercentage: false,
            durationDays: 365,
          },
          {
            kind: 'modifier',
            source: 'Government withdrew from the fever',
            sourceType: 'crisis',
            target: 'nation.legitimacy',
            value: -4,
            isPercentage: false,
            durationDays: 730,
          },
          { kind: 'regionSentiment', regionId: 'mid_atlantic', delta: -8 },
        ],
      },
      {
        id: 'remain_and_fund_relief',
        label: 'Remain, and fund relief from the Treasury',
        description:
          'Keep the government in the city and pay for nurses, burials and the care ' +
          'of orphans. There is no precedent and arguably no authority for it.',
        requirements: [],
        previewedEffects: [
          'Considerable expense',
          'Legitimacy rises markedly',
          'Officers of government are themselves at risk',
        ],
        effects: [
          { kind: 'treasuryDelta', amount: -400_000, reason: 'Epidemic relief' },
          {
            kind: 'modifier',
            source: 'Government remained through the fever',
            sourceType: 'crisis',
            target: 'nation.legitimacy',
            value: 9,
            isPercentage: false,
            durationDays: null,
          },
          {
            kind: 'modifier',
            source: 'Yellow fever epidemic',
            sourceType: 'crisis',
            target: 'nation.stability',
            value: -4,
            isPercentage: false,
            durationDays: 365,
          },
          { kind: 'regionSentiment', regionId: 'mid_atlantic', delta: 12 },
        ],
      },
    ],
  },

  // ==========================================================================
  {
    id: 'pinckney_treaty_1795',
    title: 'The Mississippi Question',
    historicalDate: '1795-10-27',
    triggerConditions: [{ kind: 'dateOnOrAfter', date: '1795-10-10' }],
    pausesGame: true,
    weight: 83,
    oneShot: true,
    body:
      'Spain holds New Orleans, and with it the mouth of the Mississippi. Western ' +
      'farmers can float their produce down the river but cannot land it, which makes ' +
      'the river worthless to them. There is loose talk in Kentucky of seeking terms ' +
      'with Spain directly, since the federal government has secured them nothing.',
    historicalContext:
      'Thomas Pinckney negotiated the Treaty of San Lorenzo, signed 27 October 1795, ' +
      'by which Spain granted the United States free navigation of the Mississippi ' +
      'and the right of deposit at New Orleans — the right to land goods for ' +
      'transhipment without paying duty. It also fixed the Florida boundary at the ' +
      '31st parallel. The treaty was ratified unanimously, a striking contrast with ' +
      'the Jay Treaty of the same period, and it transformed the economics of western ' +
      'settlement: produce that could not previously reach market now could. Spain ' +
      'suspended the right of deposit in 1802, which precipitated the Louisiana ' +
      'Purchase.',
    sources: [
      'Treaty of Friendship, Limits, and Navigation between Spain and the United States (Treaty of San Lorenzo), 27 October 1795',
    ],
    options: [
      {
        id: 'ratify_pinckney',
        label: 'Ratify the treaty',
        description:
          'Secure navigation and the right of deposit. The west becomes economically ' +
          'viable.',
        requirements: [],
        previewedEffects: [
          'Frontier prosperity rises substantially',
          'Frontier sentiment improves markedly',
          'Western separatism loses its argument',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'Pinckney’s Treaty',
            sourceType: 'event',
            target: 'region.frontier.prosperity',
            value: 14,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'regionSentiment', regionId: 'frontier', delta: 22 },
          { kind: 'regionSentiment', regionId: 'south', delta: 6 },
          {
            kind: 'modifier',
            source: 'Pinckney’s Treaty',
            sourceType: 'event',
            target: 'nation.legitimacy',
            value: 5,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'setFlag', key: 'mississippi_open', value: true },
        ],
      },
      {
        id: 'press_for_more',
        label: 'Reject the terms and press Spain for cession of New Orleans',
        description:
          'Hold out for the port itself rather than a right of deposit within it. ' +
          'Spain is unlikely to yield, and the west waits.',
        requirements: [],
        previewedEffects: [
          'The river stays effectively closed',
          'The frontier concludes the federal government cannot serve it',
        ],
        effects: [
          { kind: 'regionSentiment', regionId: 'frontier', delta: -16 },
          {
            kind: 'modifier',
            source: 'Mississippi left closed',
            sourceType: 'event',
            target: 'nation.sectionalTension',
            value: 9,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'setFlag', key: 'mississippi_open', value: false },
        ],
      },
    ],
  },

  // ==========================================================================
  {
    id: 'farewell_precedent_1796',
    title: 'The Question of a Third Term',
    historicalDate: '1796-09-19',
    triggerConditions: [{ kind: 'dateOnOrAfter', date: '1796-09-19' }],
    pausesGame: true,
    weight: 82,
    oneShot: true,
    body:
      'Seven years in office. There is no law limiting how long the office may be ' +
      'held, and a great many people assume it will be held for life. What is decided ' +
      'now will not be a preference but a precedent, and precedents in a new republic ' +
      'harden quickly into rules.',
    historicalContext:
      'Washington’s Farewell Address was published in the Philadelphia Daily American ' +
      'Advertiser on 19 September 1796, announcing he would not stand for a third ' +
      'term. Nothing in the Constitution required it. The address, drafted with ' +
      'Hamilton’s assistance, warned against the "baneful effects of the spirit of ' +
      'party" and against permanent alliances with foreign nations. The two-term ' +
      'limit remained an unwritten convention until Franklin Roosevelt broke it in ' +
      '1940; it was made law by the Twenty-Second Amendment in 1951. Setting a limit ' +
      'on one’s own power voluntarily is among the reasons the office survived at all.',
    sources: [
      'George Washington, Farewell Address, published 19 September 1796',
      'US Constitution, Twenty-Second Amendment (ratified 1951)',
    ],
    options: [
      {
        id: 'set_the_precedent',
        label: 'Establish that the office is relinquished, not held for life',
        description:
          'Announce that the officeholder will stand down. The office outlives the ' +
          'person, which is the whole argument for a republic. This is what happened.',
        requirements: [{ kind: 'governmentType', is: 'republic' }],
        previewedEffects: [
          'Legitimacy rises substantially and permanently',
          'The republic is shown to be a form of government, not a person',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'The two-term precedent',
            sourceType: 'event',
            target: 'nation.legitimacy',
            value: 12,
            isPercentage: false,
            durationDays: null,
          },
          {
            kind: 'modifier',
            source: 'The two-term precedent',
            sourceType: 'event',
            target: 'nation.stability',
            value: 4,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'regionSentiment', regionId: 'all', delta: 5 },
          { kind: 'setFlag', key: 'two_term_precedent', value: true },
        ],
      },
      {
        id: 'remain_in_office',
        label: 'Remain in office',
        description:
          'Nothing forbids it, and the republic is young. But every year that passes ' +
          'makes the office harder to distinguish from a crown.',
        requirements: [{ kind: 'governmentType', is: 'republic' }],
        previewedEffects: [
          'Continuity of administration',
          'Legitimacy suffers, and the charge of monarchy gains force',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'A third term taken',
            sourceType: 'event',
            target: 'nation.legitimacy',
            value: -10,
            isPercentage: false,
            durationDays: null,
          },
          {
            kind: 'modifier',
            source: 'A third term taken',
            sourceType: 'event',
            target: 'nation.stability',
            value: 3,
            isPercentage: false,
            durationDays: 1095,
          },
          { kind: 'regionSentiment', regionId: 'new_england', delta: -8 },
          { kind: 'setFlag', key: 'two_term_precedent', value: false },
        ],
      },
      {
        id: 'affirm_the_crown',
        label: 'Affirm that the crown is held for life',
        description:
          'The question does not arise for a monarchy. Say so plainly, and settle the ' +
          'succession on your house.',
        requirements: [{ kind: 'governmentType', is: 'monarchy' }],
        previewedEffects: [
          'Succession is settled and stability improves',
          'Anti-monarchical feeling in the north hardens',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'Succession settled on the crown',
            sourceType: 'event',
            target: 'nation.stability',
            value: 6,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'regionSentiment', regionId: 'new_england', delta: -10 },
          { kind: 'regionSentiment', regionId: 'mid_atlantic', delta: -7 },
          { kind: 'regionSentiment', regionId: 'south', delta: 4 },
          { kind: 'setFlag', key: 'two_term_precedent', value: false },
        ],
      },
    ],
  },

  // ==========================================================================
  {
    id: 'xyz_affair_1798',
    title: 'The XYZ Affair',
    historicalDate: '1798-04-03',
    triggerConditions: [
      { kind: 'dateOnOrAfter', date: '1798-04-03' },
      { kind: 'flag', key: 'neutrality_proclaimed', equals: true },
    ],
    pausesGame: true,
    weight: 91,
    oneShot: true,
    body:
      'The envoys sent to Paris to settle French seizures of American shipping have ' +
      'been met not by ministers but by intermediaries, who demanded a substantial ' +
      'bribe and a loan to France before negotiations could begin at all. The ' +
      'dispatches have been published. The country is furious.',
    historicalContext:
      'American commissioners sent to France in 1797 were approached by agents of ' +
      'foreign minister Talleyrand — designated X, Y and Z in the published ' +
      'dispatches — who demanded a bribe of some £50,000 and a large loan before ' +
      'negotiations would open. When Adams released the dispatches on 3 April 1798 ' +
      'the public reaction was ferocious, and "millions for defence, but not one cent ' +
      'for tribute" became the slogan of the moment. The affair produced a surge of ' +
      'support for the Federalists, the creation of the Navy Department, and the ' +
      'Quasi-War: an undeclared naval conflict with France fought largely in the ' +
      'Caribbean from 1798 to 1800, ended by the Convention of 1800. It also supplied ' +
      'the atmosphere in which the Alien and Sedition Acts were passed.',
    sources: [
      'Dispatches from the United States commissioners to France, published 3 April 1798',
      'Convention of 1800 (Treaty of Mortefontaine), 30 September 1800',
    ],
    options: [
      {
        id: 'arm_and_resist',
        label: 'Arm, and resist without declaring war',
        description:
          'Build the navy, authorise the taking of French privateers, and stop short ' +
          'of a declaration. This is what happened.',
        requirements: [],
        previewedEffects: [
          'Substantial military expense',
          'A surge of national feeling',
          'Trade with France ceases',
        ],
        effects: [
          { kind: 'treasuryDelta', amount: -2_200_000, reason: 'Naval armament' },
          {
            kind: 'modifier',
            source: 'The Quasi-War',
            sourceType: 'crisis',
            target: 'nation.stability',
            value: 5,
            isPercentage: false,
            durationDays: 900,
          },
          { kind: 'regionSentiment', regionId: 'new_england', delta: 12 },
          { kind: 'regionSentiment', regionId: 'south', delta: -6 },
          { kind: 'setFlag', key: 'quasi_war', value: true },
          /*
            The 1798 crisis is the clearest case of emergency powers in the
            period: under the pressure of an undeclared naval war Congress
            created the Navy Department, raised a provisional army, laid the
            direct tax, passed the stamp duties, and passed the Alien and
            Sedition Acts -- an extraordinary volume of legislation in a few
            months. That capacity is what this models, and it lapses.
          */
          {
            kind: 'grantEmergencyPowers',
            reason: 'the undeclared naval war with France',
            durationDays: 540,
          },
        ],
      },
      {
        id: 'declare_war',
        label: 'Ask for a declaration of war against France',
        description:
          'Answer the insult openly. The republic has almost no army and a navy of ' +
          'six ships.',
        requirements: [],
        previewedEffects: [
          'Ruinous expense',
          'Trade collapses',
          'Republican opinion turns hard against the government',
        ],
        effects: [
          { kind: 'treasuryDelta', amount: -4_500_000, reason: 'War mobilisation' },
          {
            kind: 'modifier',
            source: 'War with France',
            sourceType: 'crisis',
            target: 'nation.stability',
            value: -10,
            isPercentage: false,
            durationDays: 1095,
          },
          {
            kind: 'modifier',
            source: 'War with France',
            sourceType: 'crisis',
            target: 'nation.sectionalTension',
            value: 12,
            isPercentage: false,
            durationDays: null,
          },
          { kind: 'regionSentiment', regionId: 'south', delta: -16 },
          { kind: 'setFlag', key: 'quasi_war', value: true },
          // A declared war grants more, and for longer, than an undeclared one.
          {
            kind: 'grantEmergencyPowers',
            reason: 'the war with France',
            durationDays: 900,
            multiplier: 3,
          },
        ],
      },
      {
        id: 'negotiate_again',
        label: 'Send a second mission and swallow the insult',
        description:
          'Refuse to be provoked. The humiliation is public and will be remembered.',
        requirements: [],
        previewedEffects: [
          'No war and no expense',
          'Legitimacy suffers badly',
          'Shipping remains exposed to French seizure',
        ],
        effects: [
          {
            kind: 'modifier',
            source: 'Insult swallowed',
            sourceType: 'event',
            target: 'nation.legitimacy',
            value: -11,
            isPercentage: false,
            durationDays: 1095,
          },
          { kind: 'regionSentiment', regionId: 'new_england', delta: -14 },
          { kind: 'setFlag', key: 'quasi_war', value: false },
        ],
      },
    ],
  },
];
