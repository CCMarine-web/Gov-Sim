/**
 * TAX BASES
 *
 * What a tax can be levied ON, and how the engine turns a rate into revenue.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * Phase 1 had three hard-coded tax rates: a tariff, an excise and a land tax.
 * Phase 2 brief §4.3 requires taxes to become instances in state, so that
 * passing a bill in Legislation creates a real new line in Treasury. A bill
 * cannot create a new tax if the only taxes the engine can compute are three
 * fields with three bespoke formulas.
 *
 * So a tax instance names a BASE, and this registry says what that base is
 * worth and how it behaves. Adding a new kind of tax to the game is now a data
 * edit here plus a bill in content — no engine change. (DESIGN.md Rule 4, in
 * spirit: the engine interprets, the data declares.)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHAT IS AND IS NOT HISTORICAL HERE
 *
 * The `historicity` field on each base is a factual claim about the period and
 * is shown to the player. The dollar figures are calibration constants living
 * in calibration.ts, documented in ECONOMY.md §7.8, and never shown as history.
 * (DESIGN.md §12.2)
 */

import {
  ASSESSABLE_INCOME_SHARE,
  AUCTION_VALUE_BASE,
  CARRIAGE_VALUE_BASE,
  DISTILLING_BASE,
  DWELLING_VALUE_BASE,
  ENSLAVED_ASSESSMENT_BASE,
  LAND_VALUE_BASE,
  REFINED_GOODS_BASE,
  RETAIL_SALES_SHARE,
  STAMPABLE_BASE,
} from './calibration';

/**
 * Everything a tax can be levied on.
 *
 * The real federal revenue bases of 1789–1800, plus two counterfactuals and one
 * that the Constitution forbids outright.
 */
export type TaxBase =
  // --- what the federal government actually used ---
  | 'imports'
  | 'spirits'
  | 'carriages'
  | 'refined_goods'
  | 'auctions'
  | 'stamps'
  | 'land'
  | 'dwellings'
  | 'enslaved_persons'
  // --- counterfactual: possible to describe, not possible to administer ---
  | 'income'
  | 'sales'
  // --- constitutionally prohibited ---
  | 'exports';

/**
 * Which of the four headline receipt buckets a base rolls up into.
 *
 * The buckets are a display and accounting convention that predates instances
 * (`ReceiptBreakdown`, the History view, the monthly series). Keeping them as a
 * ROLLUP of the per-instance lines rather than a parallel calculation means the
 * detailed view and the headline figures cannot disagree.
 */
export type ReceiptBucket = 'customs' | 'excise' | 'land' | 'other';

/**
 * Which regional exposure channel a base's burden falls through.
 *
 * `Region` carries `tariffExposure`, `exciseExposure` and `landExposure` — how
 * heavily each kind of tax lands on that region's economy. This is the
 * mechanism that makes one national policy produce four different political
 * reactions (ECONOMY.md §7.12), and every base has to say which channel it
 * travels down.
 */
export type BurdenChannel = 'tariff' | 'excise' | 'land';

/** How the taxable amount is arrived at. */
export type Assessment =
  /** The national volume of taxed trade, which the rate itself suppresses. */
  | 'trade'
  /** A fixed assessed value per region, from calibration.ts. */
  | 'regional'
  /** A share of each region's own output — scales as the economy grows. */
  | 'outputShare';

export type Historicity =
  /** Levied by the federal government in this period. */
  | 'enacted'
  /** Seriously proposed or debated at the time, but not adopted. */
  | 'proposed'
  /** Describable in the period's vocabulary, but never seriously advanced. */
  | 'counterfactual'
  /** Impossible in the period. Locked, with the reason stated. */
  | 'anachronistic';

export interface TaxBaseDefinition {
  id: TaxBase;
  /** What a player sees. */
  label: string;
  /** What the tax falls on, in one plain sentence. */
  description: string;
  bucket: ReceiptBucket;
  burden: BurdenChannel;
  assessment: Assessment;
  /** Assessed value per region, for `regional` bases. */
  regionalBase: Record<string, number> | null;
  /** Share of regional output, for `outputShare` bases. */
  outputShare: number | null;
  /**
   * Does this tax's rate suppress the volume it is levied on?
   *
   * True only for `imports`: a tariff makes trade dearer and there is therefore
   * less of it, which is why customs revenue peaks at 25% and falls beyond it
   * (ECONOMY.md §7.5). A land tax does not make there be less land.
   */
  suppressesItsOwnBase: boolean;
  /**
   * How much of the assessed tax an honest administration can actually collect,
   * before regional compliance is applied.
   *
   * 1.0 for the three founding bases, and that is deliberate rather than lazy:
   * their assessed values in calibration.ts were solved against OBSERVED
   * revenue, so collection losses are already inside those figures and applying
   * a second factor would double-count them. For every other base the figure is
   * relative to that baseline — a duty collected from a few dozen customs
   * houses is far more collectable than one assessed on every still in the
   * backcountry. (ECONOMY.md §7.8)
   */
  referenceEfficiency: number;
  historicity: Historicity;
  /**
   * Why this base cannot be used, if it cannot. Rendered verbatim as the lock
   * explanation, so it has to be a real reason and not a shrug.
   */
  prohibitedBecause: string | null;
  /** Factual context, shown wherever the base appears. Never invented. */
  historicalNote: string;
  sources: string[];
}

/**
 * THE REGISTRY.
 *
 * Ordered as a player would meet them: the impost first, because it paid for
 * almost everything; then the excises; then the direct taxes; then what was
 * never possible.
 */
export const TAX_BASES: Record<TaxBase, TaxBaseDefinition> = {
  imports: {
    id: 'imports',
    label: 'Imports',
    description: 'An ad valorem duty on goods entering American ports.',
    bucket: 'customs',
    burden: 'tariff',
    assessment: 'trade',
    regionalBase: null,
    outputShare: null,
    suppressesItsOwnBase: true,
    referenceEfficiency: 1.0,
    historicity: 'enacted',
    prohibitedBecause: null,
    historicalNote:
      'The Tariff Act of 4 July 1789 was the second statute the First Congress ' +
      'passed, and the impost it created supplied the overwhelming majority of ' +
      'federal revenue for the next century. Schedules averaged roughly 8 to 10 ' +
      'per cent ad valorem at the outset.',
    sources: [
      'Tariff Act of 1789, 1 Stat. 24',
      'Historical Statistics of the United States, series Y 352-357',
    ],
  },

  spirits: {
    id: 'spirits',
    label: 'Distilled spirits',
    description: 'An excise on whiskey and other spirits at the still.',
    bucket: 'excise',
    burden: 'excise',
    assessment: 'regional',
    regionalBase: DISTILLING_BASE,
    outputShare: null,
    suppressesItsOwnBase: false,
    referenceEfficiency: 1.0,
    historicity: 'enacted',
    prohibitedBecause: null,
    historicalNote:
      'The excise of 3 March 1791 fell hardest on the western counties, where ' +
      'whiskey was the only form in which a bulk grain crop could profitably be ' +
      'carried over the mountains to market. To a frontier farmer it was ' +
      'therefore a tax on selling anything at all. Resistance culminated in the ' +
      'Whiskey Rebellion of 1794, and the excise was repealed in 1802.',
    sources: [
      'Act of 3 March 1791, 1 Stat. 199',
      'Act of 6 April 1802, 2 Stat. 148 (repeal)',
    ],
  },

  carriages: {
    id: 'carriages',
    label: 'Pleasure carriages',
    description: 'A duty on privately kept carriages, assessed on their value.',
    bucket: 'excise',
    burden: 'excise',
    assessment: 'regional',
    regionalBase: CARRIAGE_VALUE_BASE,
    outputShare: null,
    suppressesItsOwnBase: false,
    referenceEfficiency: 0.85,
    historicity: 'enacted',
    prohibitedBecause: null,
    historicalNote:
      'The Carriage Duty Act of 5 June 1794 taxed privately kept carriages. Its ' +
      'constitutionality was challenged as an unapportioned direct tax and ' +
      'upheld in Hylton v. United States (1796), which held it to be an excise — ' +
      'the first time the Supreme Court considered the constitutionality of an ' +
      'act of Congress. It fell on urban wealth and raised comparatively little.',
    sources: [
      'Act of 5 June 1794, 1 Stat. 373',
      'Hylton v. United States, 3 U.S. (3 Dall.) 171 (1796)',
    ],
  },

  refined_goods: {
    id: 'refined_goods',
    label: 'Refined sugar and snuff',
    description: 'An excise on sugar refining and manufactured snuff.',
    bucket: 'excise',
    burden: 'excise',
    assessment: 'regional',
    regionalBase: REFINED_GOODS_BASE,
    outputShare: null,
    suppressesItsOwnBase: false,
    referenceEfficiency: 0.8,
    historicity: 'enacted',
    prohibitedBecause: null,
    historicalNote:
      'Part of the 1794 revenue package, which extended excises to snuff, ' +
      'refined sugar, carriages, auctions and retail licences for wine and ' +
      'spirits. The snuff duty proved so difficult to collect that it was ' +
      'suspended within two years.',
    sources: ['Act of 5 June 1794, 1 Stat. 384'],
  },

  auctions: {
    id: 'auctions',
    label: 'Sales at auction',
    description: 'A duty on the value of goods sold at auction.',
    bucket: 'excise',
    burden: 'tariff',
    assessment: 'regional',
    regionalBase: AUCTION_VALUE_BASE,
    outputShare: null,
    suppressesItsOwnBase: false,
    referenceEfficiency: 0.9,
    historicity: 'enacted',
    prohibitedBecause: null,
    historicalNote:
      'Also from the 1794 package. Auctions were a principal channel for ' +
      'disposing of imported cargo, so the duty fell on the same mercantile ' +
      'interest as the impost — which is why its burden travels down the tariff ' +
      'channel in this model rather than the excise one.',
    sources: ['Act of 5 June 1794, 1 Stat. 397'],
  },

  stamps: {
    id: 'stamps',
    label: 'Stamp duties',
    description:
      'A duty on legal instruments, bonds, insurance policies and ships’ papers.',
    bucket: 'other',
    burden: 'tariff',
    assessment: 'regional',
    regionalBase: STAMPABLE_BASE,
    outputShare: null,
    suppressesItsOwnBase: false,
    referenceEfficiency: 0.88,
    historicity: 'enacted',
    prohibitedBecause: null,
    historicalNote:
      'The Stamp Act of 6 July 1797 taxed legal and commercial paper. Congress ' +
      'passed it in the fiscal pressure of the Quasi-War, twenty-two years after ' +
      'colonial resistance to the British Stamp Act of 1765 — a resonance ' +
      'contemporaries noticed and opponents used.',
    sources: ['Act of 6 July 1797, 1 Stat. 527'],
  },

  land: {
    id: 'land',
    label: 'Land',
    description: 'A direct tax on the assessed value of land.',
    bucket: 'land',
    burden: 'land',
    assessment: 'regional',
    regionalBase: LAND_VALUE_BASE,
    outputShare: null,
    suppressesItsOwnBase: false,
    referenceEfficiency: 1.0,
    historicity: 'enacted',
    prohibitedBecause: null,
    historicalNote:
      'No federal direct tax existed until the Direct Tax of 14 July 1798, which ' +
      'assessed land, dwelling houses and enslaved people to raise an apportioned ' +
      '$2,000,000 for the Quasi-War. A direct tax falls on people whether or not ' +
      'they have cash that year, which is what made it a last resort — and what ' +
      'provoked Fries’s Rebellion in eastern Pennsylvania in 1799.',
    sources: [
      'Act of 14 July 1798, 1 Stat. 597',
      'U.S. Const. art. I, § 2, cl. 3 and § 9, cl. 4 (apportionment)',
    ],
  },

  dwellings: {
    id: 'dwellings',
    label: 'Dwelling houses',
    description: 'A direct tax on the assessed value of dwelling houses.',
    bucket: 'land',
    burden: 'land',
    assessment: 'regional',
    regionalBase: DWELLING_VALUE_BASE,
    outputShare: null,
    suppressesItsOwnBase: false,
    referenceEfficiency: 0.92,
    historicity: 'enacted',
    prohibitedBecause: null,
    historicalNote:
      'The 1798 direct tax assessed houses on a graduated scale by value, and the ' +
      'assessment required federal officers to measure and count the windows of ' +
      'private homes. That intrusion, more than the sum demanded, is what turned ' +
      'resistance in the Pennsylvania German counties into Fries’s Rebellion.',
    sources: ['Act of 9 July 1798, 1 Stat. 580'],
  },

  enslaved_persons: {
    id: 'enslaved_persons',
    label: 'Enslaved persons',
    description:
      'A direct tax levied per enslaved person, as the 1798 assessment did.',
    bucket: 'land',
    burden: 'land',
    assessment: 'regional',
    regionalBase: ENSLAVED_ASSESSMENT_BASE,
    outputShare: null,
    suppressesItsOwnBase: false,
    referenceEfficiency: 0.95,
    historicity: 'enacted',
    prohibitedBecause: null,
    historicalNote:
      'The Direct Tax of 1798 laid a flat fifty cents on each enslaved person ' +
      'aged twelve to fifty, alongside its assessments on land and houses. The ' +
      'federal government thereby taxed slaveholding as property while the ' +
      'Constitution counted three-fifths of the same people for apportionment ' +
      'and representation. It is included in this model because it happened, and ' +
      'because the fiscal treatment of slavery is part of how the sectional ' +
      'conflict was built.',
    sources: [
      'Act of 14 July 1798, 1 Stat. 597',
      'U.S. Const. art. I, § 2, cl. 3',
    ],
  },

  income: {
    id: 'income',
    label: 'Incomes',
    description: 'A tax on assessed annual income — never levied in this period.',
    bucket: 'other',
    burden: 'land',
    assessment: 'outputShare',
    regionalBase: null,
    outputShare: ASSESSABLE_INCOME_SHARE,
    suppressesItsOwnBase: false,
    referenceEfficiency: 0.45,
    historicity: 'anachronistic',
    prohibitedBecause:
      'A tax on income would be a direct tax, and Article I requires direct taxes ' +
      'to be apportioned among the states by population — which an income tax ' +
      'cannot be, since income is not distributed in proportion to population. ' +
      'That objection was decisive in Pollock v. Farmers’ Loan & Trust (1895) and ' +
      'was only removed by the Sixteenth Amendment in 1913. There is also no ' +
      'administrative machinery to assess income: no returns, no withholding, and ' +
      'no federal officers outside the customs houses and post roads.',
    historicalNote:
      'The first federal income tax was enacted in 1861 to pay for the Civil War. ' +
      'It was allowed to lapse in 1872, revived in 1894, struck down in 1895, and ' +
      'only made durable by constitutional amendment in 1913.',
    sources: [
      'U.S. Const. art. I, § 2, cl. 3 and § 9, cl. 4',
      'Pollock v. Farmers’ Loan & Trust Co., 157 U.S. 429 (1895)',
      'U.S. Const. amend. XVI (1913)',
    ],
  },

  sales: {
    id: 'sales',
    label: 'Retail sales',
    description: 'A general tax on retail sales — never levied in this period.',
    bucket: 'other',
    burden: 'excise',
    assessment: 'outputShare',
    regionalBase: null,
    outputShare: RETAIL_SALES_SHARE,
    suppressesItsOwnBase: false,
    referenceEfficiency: 0.4,
    historicity: 'counterfactual',
    prohibitedBecause: null,
    historicalNote:
      'A general sales tax is constitutionally available as an excise, and so is ' +
      'not forbidden the way an income tax is. It was never seriously advanced, ' +
      'because there was no way to administer it: assessing sales requires ' +
      'records that most 1790s retailers did not keep and inspectors the federal ' +
      'government did not have. No American government levied a general sales tax ' +
      'until the states began doing so in the 1930s.',
    sources: ['U.S. Const. art. I, § 8, cl. 1'],
  },

  exports: {
    id: 'exports',
    label: 'Exports',
    description: 'A duty on goods leaving American ports.',
    bucket: 'customs',
    burden: 'tariff',
    assessment: 'trade',
    regionalBase: null,
    outputShare: null,
    suppressesItsOwnBase: true,
    referenceEfficiency: 1.0,
    historicity: 'anachronistic',
    prohibitedBecause:
      'The Constitution forbids it outright: "No Tax or Duty shall be laid on ' +
      'Articles exported from any State." This was a condition of ratification ' +
      'for the staple-exporting states, which would otherwise have borne a tax ' +
      'the northern carrying trade escaped. No amendment has ever altered it, and ' +
      'it remains in force.',
    historicalNote:
      'The export clause was one of the compromises that made the Constitution ' +
      'ratifiable in the South, alongside the three-fifths clause and the bar on ' +
      'restricting the slave trade before 1808. It is still good law: the Supreme ' +
      'Court struck down a federal coal export tax on these grounds as recently ' +
      'as United States v. IBM (1996).',
    sources: [
      'U.S. Const. art. I, § 9, cl. 5',
      'United States v. IBM Corp., 517 U.S. 843 (1996)',
    ],
  },
};

/** In registry order, for rendering lists deterministically. */
export const TAX_BASE_IDS = Object.keys(TAX_BASES) as TaxBase[];

/**
 * Can a tax be levied on this base at all?
 *
 * A prohibited base is not hidden — it is shown locked, with
 * `prohibitedBecause` as the explanation. A player who wonders why they cannot
 * tax exports should learn the answer from the game.
 */
export function isBaseAvailable(base: TaxBase): boolean {
  return TAX_BASES[base].prohibitedBecause === null;
}
