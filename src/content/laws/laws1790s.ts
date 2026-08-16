/**
 * PHASE 1 LAWS — 1789 to 1800
 *
 * Laws the player may enact at will, as distinct from events, which arrive on
 * their own schedule and demand an answer.
 *
 * A locked law explains itself. The `requirements` below are read by
 * `describeUnmet()` and rendered as plain English, so "Requires the Funding Act
 * of 1790" is generated from the same structure that gates the law and cannot
 * drift from it. (UI.md §5.5)
 *
 * As with events, `historicalContext` is factual and `sources` records where it
 * was checked.
 */

import type { Law } from '@/sim/types';

export const LAWS_1790S: Law[] = [
  {
    id: 'judiciary_act_1789',
    title: 'The Judiciary Act of 1789',
    category: 'judicial',
    description:
      'Establish the federal court system: a Supreme Court of six justices, thirteen ' +
      'district courts, and three circuit courts.',
    enactmentCost: 180_000,
    requirements: [{ kind: 'dateOnOrAfter', date: '1789-09-24' }],
    historicalContext:
      'Signed on 24 September 1789, the Judiciary Act created the federal court system ' +
      'the Constitution had authorised but not organised, establishing a Supreme Court ' +
      'of a Chief Justice and five associate justices, along with district and circuit ' +
      'courts. Its Section 25 allowed appeals from state courts to the Supreme Court on ' +
      'federal questions, which proved essential to federal supremacy. Section 13 of the ' +
      'same Act was later struck down in Marbury v. Madison (1803), the case that ' +
      'established judicial review.',
    sources: ['Judiciary Act of 1789, 1 Stat. 73 (24 September 1789)'],
    effects: [
      {
        kind: 'modifier',
        source: 'Judiciary Act of 1789',
        sourceType: 'law',
        target: 'nation.stability',
        value: 5,
        isPercentage: false,
        durationDays: null,
      },
      {
        kind: 'modifier',
        source: 'Judiciary Act of 1789',
        sourceType: 'law',
        target: 'nation.legitimacy',
        value: 4,
        isPercentage: false,
        durationDays: null,
      },
    ],
    repealable: false,
  },

  {
    id: 'bank_of_the_united_states',
    title: 'Bank of the United States',
    category: 'fiscal',
    description:
      'Charter a national bank for twenty years to hold federal deposits, issue notes, ' +
      'and lend to the government.',
    enactmentCost: 500_000,
    requirements: [
      { kind: 'dateOnOrAfter', date: '1791-01-01' },
      { kind: 'flag', key: 'assumption_passed', equals: true },
    ],
    historicalContext:
      'Chartered on 25 February 1791 for a twenty-year term, with capital of $10 million, ' +
      'of which the federal government subscribed one fifth. It held federal deposits, ' +
      'issued notes that circulated as a national currency, and acted as fiscal agent to ' +
      'the Treasury. Its constitutionality was disputed from the outset, Jefferson and ' +
      'Madison arguing that Congress held only enumerated powers and Hamilton that powers ' +
      'necessary to execute them were implied. The charter was allowed to lapse in 1811.',
    sources: [
      'Act of 25 February 1791, 1 Stat. 191',
      'US Constitution, Article I, Section 8',
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
      { kind: 'regionSentiment', regionId: 'south', delta: -6 },
      { kind: 'regionSentiment', regionId: 'new_england', delta: 6 },
    ],
    repealable: true,
  },

  {
    id: 'coinage_act_1792',
    title: 'The Coinage Act of 1792',
    category: 'fiscal',
    description:
      'Establish the Mint at Philadelphia and define the dollar as the unit of account, ' +
      'on a bimetallic standard.',
    enactmentCost: 240_000,
    requirements: [{ kind: 'dateOnOrAfter', date: '1792-04-02' }],
    historicalContext:
      'Passed on 2 April 1792, the Coinage Act established the United States Mint in ' +
      'Philadelphia — the first federal building erected under the Constitution — and ' +
      'defined the dollar as the money of account, divided decimally. It set a ' +
      'bimetallic standard at a silver-to-gold ratio of 15:1. Because the market ratio ' +
      'soon diverged from the legal one, gold was systematically undervalued and largely ' +
      'left circulation, an early practical demonstration of Gresham’s law.',
    sources: ['Coinage Act of 1792, 1 Stat. 246 (2 April 1792)'],
    effects: [
      {
        kind: 'modifier',
        source: 'Coinage Act of 1792',
        sourceType: 'law',
        target: 'nation.stability',
        value: 3,
        isPercentage: false,
        durationDays: null,
      },
    ],
    repealable: false,
  },

  {
    id: 'post_office_act_1792',
    title: 'The Post Office Act of 1792',
    category: 'civil',
    description:
      'Establish a permanent Post Office, admit newspapers to the mails at low rates, ' +
      'and forbid officials from opening private correspondence.',
    enactmentCost: 150_000,
    requirements: [{ kind: 'dateOnOrAfter', date: '1792-02-20' }],
    historicalContext:
      'Signed on 20 February 1792, the Act made the Post Office permanent, gave Congress ' +
      'rather than the executive the power to designate postal roads, admitted newspapers ' +
      'to the mails at heavily subsidised rates, and made it a crime for postal officials ' +
      'to open private letters. The newspaper subsidy was deliberate policy: an informed ' +
      'citizenry was held to be a precondition of republican government. The postal ' +
      'network expanded rapidly and became the principal means by which information ' +
      'moved across the country.',
    sources: ['Post Office Act of 1792, 1 Stat. 232 (20 February 1792)'],
    effects: [
      {
        kind: 'modifier',
        source: 'Post Office Act of 1792',
        sourceType: 'law',
        target: 'nation.legitimacy',
        value: 3,
        isPercentage: false,
        durationDays: null,
      },
      { kind: 'regionSentiment', regionId: 'frontier', delta: 6 },
      { kind: 'regionSentiment', regionId: 'all', delta: 2 },
    ],
    repealable: false,
  },

  {
    id: 'naval_act_1794',
    title: 'The Naval Act of 1794',
    category: 'military',
    description:
      'Authorise six frigates to protect American commerce from the Barbary corsairs.',
    enactmentCost: 688_000,
    requirements: [{ kind: 'dateOnOrAfter', date: '1794-03-27' }],
    historicalContext:
      'Passed on 27 March 1794 in response to Algerine corsairs seizing American merchant ' +
      'ships and enslaving their crews, the Act authorised the construction of six ' +
      'frigates and effectively founded the United States Navy, the Continental Navy ' +
      'having been disbanded after the Revolution. It carried a clause halting ' +
      'construction if peace were concluded with Algiers; when a treaty was reached in ' +
      '1795, Washington persuaded Congress to complete three of the ships. Among them was ' +
      'USS Constitution, launched in 1797 and still a commissioned vessel today.',
    sources: ['Naval Act of 1794, 1 Stat. 350 (27 March 1794)'],
    effects: [
      {
        kind: 'modifier',
        source: 'Naval Act of 1794',
        sourceType: 'law',
        target: 'nation.stability',
        value: 3,
        isPercentage: false,
        durationDays: null,
      },
      { kind: 'regionSentiment', regionId: 'new_england', delta: 8 },
      { kind: 'regionSentiment', regionId: 'south', delta: -3 },
    ],
    repealable: false,
  },

  {
    id: 'land_act_1796',
    title: 'The Land Act of 1796',
    category: 'commercial',
    description:
      'Set terms for the sale of public land in the Northwest Territory, at two dollars ' +
      'the acre.',
    enactmentCost: 90_000,
    requirements: [{ kind: 'dateOnOrAfter', date: '1796-05-18' }],
    historicalContext:
      'Passed on 18 May 1796, the Act set the minimum price of public land at $2.00 per ' +
      'acre with a minimum purchase of 640 acres and one year’s credit. The terms proved ' +
      'too demanding for most settlers — $1,280 was far beyond ordinary means — and sales ' +
      'were disappointing, which led to the far more accessible terms of the Harrison ' +
      'Land Act of 1800. It nonetheless established the rectangular survey system and the ' +
      'principle that public land would be sold rather than granted.',
    sources: ['Land Act of 1796, 1 Stat. 464 (18 May 1796)'],
    effects: [
      {
        kind: 'modifier',
        source: 'Land Act of 1796',
        sourceType: 'law',
        target: 'nation.stability',
        value: 2,
        isPercentage: false,
        durationDays: null,
      },
      { kind: 'regionSentiment', regionId: 'frontier', delta: -4 },
    ],
    repealable: true,
  },
];
