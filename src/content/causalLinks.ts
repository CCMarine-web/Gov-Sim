/**
 * THE MODEL'S OWN CAUSAL CLAIMS
 *
 * Phase 2 brief §9 item 15: "Causal web view — visualize the modifier ledger as
 * D4's policy network. We already have the graph data; this is mostly
 * rendering."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE LEDGER IS HALF THE GRAPH, AND THE SMALLER HALF
 *
 * The ledger records what the STATUTE BOOK is doing: this law adds 4 to
 * stability, that treaty adds 9% to trade capacity. Drawn alone it is a bipartite
 * fan — sources on one side, stats on the other, no path longer than one hop.
 * True, and not what anybody means by a causal web.
 *
 * The interesting half is how the country transmits an effect once it has one:
 * a tariff suppresses trade, which cuts customs, which widens the deficit, which
 * raises debt service, which crowds out everything else. **None of that is in
 * the ledger** — it is in the formulas, where each link already carries its
 * causal claim as a comment (CLAUDE.md, "every formula carries its causal claim
 * as a comment above it, in plain English, matching the wording in ECONOMY.md").
 *
 * This file is those claims, written once as data so the interface can draw
 * them. Each entry names its formula and its ECONOMY.md section, so the graph
 * and the model cannot silently drift: if a link here has no formula behind it,
 * that is a bug in one of them.
 *
 * IT IS NOT A SECOND MODEL. Nothing in the engine reads this file — the
 * simulation runs on the formulas, and this describes them. A structural edge
 * drawn here changes nothing about what the simulation does.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface CausalLink {
  /** Dotted target path, matching the modifier ledger's vocabulary. */
  from: string;
  to: string;
  /**
   * Which way it pushes. +1 means more of `from` gives more of `to`.
   *
   * A few links are genuinely non-monotonic — the tariff's effect on customs
   * revenue rises to 25% and falls after — and those are marked `curve`.
   */
  sign: 1 | -1 | 'curve';
  /** How hard, 0…1. For the weight of the drawn edge, not for arithmetic. */
  strength: number;
  /** The causal claim, in the wording ECONOMY.md uses. */
  claim: string;
  /** Where the formula lives, so the two cannot drift apart. */
  source: string;
}

export const CAUSAL_LINKS: readonly CausalLink[] = [
  // ==========================================================================
  // THE FISCAL SPINE — the chain the whole game turns on
  // ==========================================================================
  {
    from: 'policy.tariffRate',
    to: 'nation.tradeVolume',
    sign: 'curve',
    strength: 0.9,
    claim:
      'A tariff suppresses the trade it taxes, gently below 15% and sharply ' +
      'above 30%. Revenue therefore peaks at 25% and falls after.',
    source: 'economy/production.ts computeTradeVolume — ECONOMY.md §7.5',
  },
  {
    from: 'nation.tradeVolume',
    to: 'treasury.customs',
    sign: 1,
    strength: 0.95,
    claim: 'Customs are levied on what actually crosses the wharf, not on what would have.',
    source: 'economy/fiscal.ts computeTaxRevenue — ECONOMY.md §7.6',
  },
  {
    from: 'treasury.customs',
    to: 'treasury.balance',
    sign: 1,
    strength: 0.9,
    claim: 'Receipts accrue daily to the balance.',
    source: 'economy/fiscal.ts dailyAccrual — ECONOMY.md §7.9',
  },
  {
    from: 'treasury.balance',
    to: 'treasury.debtPrincipal',
    sign: -1,
    strength: 0.7,
    claim:
      'A balance that will not meet the outlays is borrowed against. The debt is ' +
      'what a deficit turns into.',
    source: 'economy/fiscal.ts borrow — ECONOMY.md §7.10',
  },
  {
    from: 'treasury.debtPrincipal',
    to: 'treasury.debtService',
    sign: 1,
    strength: 0.95,
    claim: 'Interest is owed on the principal, at the rate credit commands.',
    source: 'economy/fiscal.ts computeDebtService — ECONOMY.md §7.10',
  },
  {
    from: 'treasury.debtService',
    to: 'treasury.balance',
    sign: -1,
    strength: 0.8,
    claim:
      'Debt service is the first charge on the revenue, and it crowds out every ' +
      'other outlay. This is the loop that makes insolvency compound.',
    source: 'economy/fiscal.ts — ECONOMY.md §7.10, DESIGN.md §10',
  },
  {
    from: 'treasury.creditRating',
    to: 'treasury.debtService',
    sign: -1,
    strength: 0.6,
    claim: 'A government nobody will lend to pays more to borrow.',
    source: 'economy/fiscal.ts creditTarget — ECONOMY.md §7.11',
  },

  // ==========================================================================
  // THE POLITICAL SPINE
  // ==========================================================================
  {
    from: 'nation.legitimacy',
    to: 'region.compliance',
    sign: 1,
    strength: 0.85,
    claim:
      'Below a threshold, legitimacy drags compliance down: a region remits less ' +
      'of what is assessed. This is the mechanism that makes legitimacy material ' +
      'rather than a vibe.',
    source: 'economy/fiscal.ts complianceTarget — ECONOMY.md §7.7, DESIGN.md §10',
  },
  {
    from: 'region.sentiment',
    to: 'region.compliance',
    sign: 1,
    strength: 0.7,
    claim: 'A region that resents the government pays it less willingly.',
    source: 'economy/fiscal.ts complianceTarget — ECONOMY.md §7.7',
  },
  {
    from: 'region.compliance',
    to: 'treasury.customs',
    sign: 1,
    strength: 0.75,
    claim: 'Only what is remitted is revenue. Assessment is not collection.',
    source: 'economy/fiscal.ts computeTaxRevenue — ECONOMY.md §7.7',
  },
  {
    from: 'grievance.byRegion',
    to: 'region.compliance',
    sign: -1,
    strength: 0.8,
    claim:
      'Above 35 the collectors start being turned away. Grievance takes the ' +
      'revenue before it takes anything else.',
    source: 'grievance.ts grievanceCompliancePenalty — ECONOMY.md §7.19',
  },
  {
    from: 'grievance.byRegion',
    to: 'region.sentiment',
    sign: -1,
    strength: 0.85,
    claim: 'Sentiment falls at any level of grievance, which is the warning.',
    source: 'grievance.ts grievanceSentimentPenalty — ECONOMY.md §7.19',
  },
  {
    from: 'grievance.byRegion',
    to: 'nation.stability',
    sign: -1,
    strength: 0.7,
    claim: 'Above 55 an episode of unrest opens, and unrest costs stability.',
    source: 'grievance.ts unrestStabilityCost — ECONOMY.md §7.19',
  },

  // ==========================================================================
  // THE ECONOMY PROPER
  // ==========================================================================
  {
    from: 'nation.stability',
    to: 'nation.gdp',
    sign: 1,
    strength: 0.6,
    claim:
      'Instability suppresses output: disrupted markets, seized goods, men under ' +
      'arms rather than at the plough.',
    source: 'economy/production.ts computeRegionOutput — ECONOMY.md §7.4',
  },
  {
    from: 'region.prosperity',
    to: 'region.sentiment',
    sign: 1,
    strength: 0.75,
    claim:
      'Sentiment follows the DIRECTION conditions are moving, not only their ' +
      'level: a region getting poorer from a high base is angrier than one ' +
      'getting richer from a low base.',
    source: 'economy/society.ts sentimentTarget — ECONOMY.md §7.12',
  },
  {
    from: 'nation.gdp',
    to: 'region.prosperity',
    sign: 1,
    strength: 0.7,
    claim: 'Prosperity is output per head against the founding baseline.',
    source: 'economy/society.ts prosperityTarget — ECONOMY.md §7.12',
  },
  {
    from: 'policy.infrastructure',
    to: 'nation.gdp',
    sign: 1,
    strength: 0.5,
    claim:
      'Cumulative public works raise output, with diminishing returns: the tenth ' +
      'road matters less than the first.',
    source: 'economy/production.ts infrastructureBonus — ECONOMY.md §7.4',
  },
  {
    from: 'policy.tariffRate',
    to: 'nation.manufacturingOutput',
    sign: 1,
    strength: 0.55,
    claim: 'Protection builds workshops, which is the other half of what a tariff does.',
    source: 'economy/production.ts computeRegionOutput — ECONOMY.md §7.4',
  },

  // ==========================================================================
  // WHO THE COUNTRY IS MADE OF (item 8)
  // ==========================================================================
  {
    from: 'nation.manufacturingOutput',
    to: 'bloc.artisans',
    sign: 1,
    strength: 0.7,
    claim: 'Protection and prosperity fill the workshops.',
    source: 'blocs.ts BLOC_ELASTICITIES — ECONOMY.md §7.21',
  },
  {
    from: 'nation.manufacturingOutput',
    to: 'bloc.small_farmers',
    sign: -1,
    strength: 0.6,
    claim:
      'The workshop fills from the farm and always has. A measure that builds ' +
      'workshops does not merely please the artisans; it makes more of them, out ' +
      'of the farmers.',
    source: 'blocs.ts BLOC_ELASTICITIES — ECONOMY.md §7.21',
  },
  {
    from: 'nation.tradeVolume',
    to: 'bloc.merchants',
    sign: 1,
    strength: 0.65,
    claim: 'The carrying trade makes merchants; nothing else does.',
    source: 'blocs.ts BLOC_ELASTICITIES — ECONOMY.md §7.21',
  },
  {
    from: 'bloc.planters',
    to: 'nation.sectionalTension',
    sign: 1,
    strength: 0.8,
    claim:
      'The enslaved share of a region is the axis the conflict was fought on, and ' +
      'it is the largest term in sectional strain.',
    source: 'map.ts sectionalStrain — ECONOMY.md §7.22',
  },

  // ==========================================================================
  // THE MACHINERY OF GOVERNMENT
  // ==========================================================================
  {
    from: 'cabinet.competence',
    to: 'nation.administrativeCapacity',
    sign: 1,
    strength: 0.6,
    claim:
      'A department run by a man out of his depth is not the same government as ' +
      'one run by Hamilton.',
    source: 'economy/politics.ts administrativeCapacityTarget — ECONOMY.md §7.25',
  },
  {
    from: 'nation.administrativeCapacity',
    to: 'politicalCapital.accrual',
    sign: 1,
    strength: 0.7,
    claim: 'A government cannot execute what it has no one to execute.',
    source: 'economy/politics.ts capitalAccrualTarget — ECONOMY.md §7.17',
  },
  {
    from: 'nation.legitimacy',
    to: 'politicalCapital.accrual',
    sign: 1,
    strength: 0.8,
    claim: 'Standing is what a government spends when it acts.',
    source: 'economy/politics.ts capitalAccrualTarget — ECONOMY.md §7.17',
  },
  {
    from: 'politicalCapital.accrual',
    to: 'policy.tariffRate',
    sign: 1,
    strength: 0.5,
    claim:
      'Capital gates what can be passed at all. An unpopular government simply ' +
      'cannot afford certain measures.',
    source: 'bills.ts priceOf — ECONOMY.md §7.17',
  },
  {
    from: 'nation.sectionalTension',
    to: 'nation.stability',
    sign: -1,
    strength: 0.65,
    claim: 'A union pulling apart is a union less able to govern itself.',
    source: 'economy/society.ts stabilityTarget — ECONOMY.md §7.13',
  },
];

/** Every node the structural map mentions, in no particular order. */
export function structuralNodes(): string[] {
  const set = new Set<string>();
  for (const link of CAUSAL_LINKS) {
    set.add(link.from);
    set.add(link.to);
  }
  return [...set];
}
