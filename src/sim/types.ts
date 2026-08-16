/**
 * CORE TYPES
 *
 * The complete shape of simulation state and content. Implements DESIGN.md §13.
 *
 * THREE RULES CONSTRAIN EVERY TYPE IN THIS FILE
 *
 * Rule 3 — one serializable state object. `GameState` must round-trip through
 * JSON losslessly. So: no class instances, no `Date`, no functions, no `Map`,
 * no `Set`, no `undefined` values, no `NaN` or `Infinity`. Optional fields use
 * `| null` rather than `?` wherever the value is part of saved state, because
 * `undefined` disappears through `JSON.stringify` and an absent key is not the
 * same as an explicit null.
 *
 * Rule 4 — content is data, not code. Nothing in `ContentPack` may hold a
 * function. Trigger conditions and effects are declarative structures the
 * engine interprets (see `Condition` and `EffectSpec`), never callbacks.
 *
 * Rule 5 — every number explains itself. Stats are never mutated directly;
 * changes flow through `Modifier`.
 */

import type { RngState } from './rng';
import type { TaxBase } from './taxBases';

/**
 * Current save schema version.
 *
 * Increment whenever `GameState` changes shape, and add a migration in
 * src/sim/migrations/ in the same commit. On load, a mismatch is either
 * migrated forward or refused cleanly — never crashed, never silently loaded
 * into a broken state. (DESIGN.md Rule 8)
 */
export const SCHEMA_VERSION = 8;

// ============================================================================
// GOVERNMENT AND REGIONS
// ============================================================================

export type GovernmentType = 'monarchy' | 'republic';

export type RegionId = 'new_england' | 'mid_atlantic' | 'south' | 'frontier';

export const REGION_IDS: readonly RegionId[] = [
  'new_england',
  'mid_atlantic',
  'south',
  'frontier',
] as const;

// ============================================================================
// THE MODIFIER LEDGER (DESIGN.md Rule 5)
// ============================================================================

export type ModifierSourceType =
  | 'law'
  | 'event'
  | 'policy'
  | 'structural'
  | 'crisis'
  /** A treaty with a foreign power. Same ledger, same rules. (brief §7) */
  | 'treaty';

/**
 * A single tracked contribution to a stat.
 *
 * Nothing in the simulation changes a stat directly. Every change is a
 * modifier, so the interface can always show which sources produced a
 * displayed number and by how much, summing visibly to the total.
 *
 * `id` is deterministic — derived from `${sourceType}:${sourceId}:${target}` —
 * so re-applying the same source is idempotent and duplicates are impossible.
 */
export interface Modifier {
  id: string;
  /** Human-readable origin, shown in the UI: "Whiskey Tax of 1791". */
  source: string;
  sourceType: ModifierSourceType;
  /** Dotted path into state, e.g. "nation.stability" or "region.frontier.sentiment". */
  target: string;
  value: number;
  isPercentage: boolean;
  startDay: number;
  /** null = permanent. */
  endDay: number | null;
  /**
   * Days over which this modifier ramps from nothing to its full value.
   *
   * 0 means immediate, which is right for an event: a treaty signed is a treaty
   * signed. A BILL is different — a statute does not change a country the day
   * it is signed, because officers have to be appointed and collectors sent
   * (brief §4.2, `phaseInDays`). The ledger shows the ramped contribution and
   * still reconciles: the popover reports what the modifier is contributing
   * today, not what it will contribute eventually.
   */
  rampDays: number;
}

// ============================================================================
// THE POLITY
// ============================================================================

export interface Ruler {
  name: string;
  /** Dynasty (monarchy) or party (republic). */
  houseName: string;
  /** "King" or "President". Derived at creation from government type. */
  title: string;
  birthYear: number;
  /**
   * Named successor, or null if none is clear.
   *
   * A monarchy with no heir on the day the ruler dies has a succession crisis
   * (§ succession, ECONOMY.md §7.19). Inert on the republican path, where the
   * player persists through elections rather than through blood.
   */
  heirName: string | null;
  portraitId: string | null;
  /**
   * How many rulers have preceded this one. Zero for the founder.
   *
   * Legitimacy carries across a succession at a penalty, and the penalty is
   * about the *transfer*, not about the number — but the count is what lets the
   * chronicle say "the third of his house" and what a later phase will hang
   * dynastic effects on.
   */
  reignNumber: number;
  /** The day this ruler took power. Day 0 for the founder. */
  accededDay: number;
}

export interface NationStats {
  population: number;
  laborForce: number;
  /** Annualised, nominal dollars. */
  agriculturalOutput: number;
  manufacturingOutput: number;
  tradeVolume: number;
  /**
   * Latent capacity to trade, before tariff suppression is applied.
   * A lagged stock (τ = 24 months), which is why a tariff cut does not restore
   * trade overnight — the player who wrecks trade with a punitive rate spends
   * years digging out. (ECONOMY.md §7.5)
   */
  tradeCapacity: number;
  gdp: number;
  /** 0–100. */
  stability: number;
  /**
   * 0–100. The RESOLVED value: `legitimacyBase` with the modifier ledger
   * applied. This is what conditions read and what the UI displays.
   */
  legitimacy: number;
  /**
   * The accumulated base, before modifiers.
   *
   * Legitimacy is cumulative rather than target-seeking (ECONOMY.md §7.15), so
   * the base and the resolved value must be stored separately. Folding
   * modifiers back into the stored value would re-add every permanent modifier
   * on every monthly recompute — a single +8 from the Bill of Rights would
   * become +8 per month forever.
   *
   * Lagged stats (stability, sentiment, tension) do not need this: modifiers
   * shift the target they converge toward, so they cannot compound.
   */
  legitimacyBase: number;
  /** 0–100. */
  sectionalTension: number;
  /**
   * 0–100. How much of the federal administration actually exists and is
   * staffed, from the historical office record in the content pack.
   *
   * A government cannot execute what it has no one to execute. On day 0 this is
   * near zero and correctly so: the Department of State was created on 27 July
   * 1789, War on 7 August, and the Treasury not until 2 September — the player
   * begins with a constitution and almost no machinery. It is a driver of
   * political capital accrual (§7.17).
   *
   * Phase 2 item 13 replaces "how many offices are filled" with "how competent
   * and loyal the people filling them are". The term is here now so the
   * currency has a real administrative component from the start rather than an
   * inert placeholder.
   */
  administrativeCapacity: number;
  /**
   * The model's targets BEFORE the modifier ledger is applied.
   *
   * Stored rather than re-derived in the UI, so the stat popover can show the
   * honest picture for a lagged stat: the current value, the modifiers acting
   * on its target, and where it is therefore heading. Without this the popover
   * would have to pretend modifiers act on the current value, which for a
   * lagged stat is simply untrue. (UI.md §7)
   */
  modelTargets: {
    stability: number;
    sectionalTension: number;
  };
}

/**
 * A constituent state or territory of a region.
 *
 * The simulation operates at the region level in Phase 1 — there is no
 * per-state maths. This exists so Phase 2's map can attach geometry to
 * entities that already exist rather than introducing them. (DESIGN.md §8.1)
 */
export interface StateEntry {
  code: string;
  name: string;
  population1790: number;
  enslavedPopulation1790: number;
}

export interface Region {
  id: RegionId;
  name: string;
  states: StateEntry[];
  population: number;
  enslavedPopulation: number;
  laborForce: number;
  agriculturalOutput: number;
  manufacturingOutput: number;
  tradeVolume: number;
  /** 0–100 index. */
  prosperity: number;
  /**
   * Change in prosperity at the last monthly recompute.
   * Sentiment depends on the DIRECTION conditions are moving, not only their
   * level: a region getting poorer from a high base is angrier than one
   * getting richer from a low base. (ECONOMY.md §7.12)
   */
  prosperityTrend: number;
  /** −100…+100 toward the federal government. */
  sentiment: number;
  /** 0–100. The share of assessed federal revenue actually remitted. */
  compliance: number;
  dominantIndustry: string;
  /**
   * How heavily each tax falls on this region, given its economy.
   * The mechanism that makes one national policy produce four different
   * political reactions. (ECONOMY.md §7.12)
   */
  tariffExposure: number;
  exciseExposure: number;
  landExposure: number;
  /** Baseline for the prosperity index; set at game creation. */
  baselineOutputPerCapita: number;
  /**
   * Day-0 equilibrium values, set at game creation and never changed.
   *
   * These make the founding a genuine equilibrium rather than a starting point
   * the model immediately pulls away from. The seeded prosperity and sentiment
   * already reflect the world as it stood in 1789, INCLUDING the tariff that
   * existed then — so the model must treat the day-0 tax burden as neutral and
   * respond to CHANGES from it. Without this the null run slides downhill from
   * the first month for no reason the player caused.
   */
  baseProsperity: number;
  baseSentiment: number;
  baselineTaxBurden: number;
  /**
   * The model's targets for this region BEFORE the modifier ledger is applied.
   *
   * Same reasoning as `NationStats.modelTargets`: a lagged stat's modifiers act
   * on the target it is moving toward, not on its current value, so the stat
   * popover needs the unmodified target to show an honest breakdown. Without
   * this the Regions view could not satisfy acceptance criterion 4.
   */
  modelTargets: {
    prosperity: number;
    sentiment: number;
    compliance: number;
  };
}

// ============================================================================
// FISCAL
// ============================================================================

export interface ReceiptBreakdown {
  customs: number;
  excise: number;
  land: number;
  other: number;
}

export interface OutlayBreakdown {
  debtService: number;
  military: number;
  civil: number;
  infrastructure: number;
}

export interface TreasuryState {
  balance: number;
  debtPrincipal: number;
  /** Effective blended annual interest rate on outstanding debt. */
  debtWeightedRate: number;
  /** 0–100. Drives the cost of new borrowing. */
  creditRating: number;
  emergencyBorrowing: boolean;
  /** How many times debt service has gone unpaid. Permanent credit damage. */
  missedPayments: number;
  /** Accrued so far this calendar year. */
  receiptsYTD: ReceiptBreakdown;
  outlaysYTD: OutlayBreakdown;
  /**
   * Annualised run rates from the most recent monthly recompute.
   *
   * A ROLLUP of `receiptLines` and `outlayLines`, not a parallel calculation.
   * The four buckets are a display and accounting convention that predates tax
   * instances, and deriving them from the lines is what stops the headline
   * figures and the detailed view from disagreeing.
   */
  annualisedReceipts: ReceiptBreakdown;
  annualisedOutlays: OutlayBreakdown;
  /**
   * Per-instance attribution for the current run rates. One line per tax in
   * force, one per funded programme, plus debt service.
   *
   * This is what makes "which law is producing this money" answerable, and it is
   * why Treasury can render whatever taxes happen to exist rather than three
   * hard-coded rows. (brief §4.3, docs/DECISIONS.md D-019)
   */
  receiptLines: RevenueLine[];
  outlayLines: OutlayLine[];
  /** Totals for the previous completed calendar year. */
  lastYearReceipts: number;
  lastYearOutlays: number;
}

// ----------------------------------------------------------------------------
// TAXES AND SPENDING AS INSTANCES (Phase 2 brief §4.3)
//
// Phase 1 had three tax rates and three spending lines, as fixed fields. That
// made it impossible for a law to create a tax: passing a bill could only move
// a number that already existed.
//
// Now a tax is an INSTANCE in state. Treasury renders whatever is in the array,
// revenue is computed per instance from its own base and efficiency, and every
// dollar is attributable to the law that created it. This is the structural
// change the rest of Phase 2 rests on. (docs/DECISIONS.md D-018)
// ----------------------------------------------------------------------------

/**
 * One tax, as it exists in the world.
 *
 * `id` is stable for the life of the tax and is what effects, bills and the
 * interface refer to. A repealed tax is NOT deleted: `repealedDay` is set, so
 * the record of what was levied and when survives, which is what lets the
 * chronicle and the History view stay honest about a run's fiscal past.
 */
export interface TaxInstance {
  id: string;
  /** As a player and the chronicle refer to it: "Whiskey Excise of 1791". */
  name: string;
  /** The bill or event that created it. null for the taxes present at founding. */
  createdByBillId: string | null;
  base: TaxBase;
  /** Ad valorem rate, 0–1. */
  rate: number;
  /**
   * What is exempt from it, in plain English, for display.
   *
   * Declarative text rather than a mechanical carve-out: exemptions in this
   * period were written into the statute in prose ("spirits distilled from
   * domestic materials in a private still"), and modelling each as a formula
   * would be a large amount of machinery for very little play value. They are
   * shown so the player knows what the law they passed actually says.
   */
  exemptions: string[];
  /**
   * 0–1. How much of the assessed tax the administration can collect, before
   * regional compliance is applied. Enforcement is a real problem in 1790:
   * a duty taken at a few dozen customs houses is not the same job as one
   * assessed on every still in the backcountry. (ECONOMY.md §7.8)
   */
  collectionEfficiency: number;
  enactedDay: number;
  /** null = still in force. */
  repealedDay: number | null;
}

export type SpendingCategory = 'military' | 'civil' | 'infrastructure';

/**
 * One spending programme, as it exists in the world.
 *
 * Same shape and same reasoning as `TaxInstance`: a bill that funds a naval
 * yard should produce a line in Treasury called the naval yard, not increase an
 * abstract "military" number.
 */
export interface SpendingProgram {
  id: string;
  name: string;
  createdByBillId: string | null;
  category: SpendingCategory;
  /** Annual outlay in dollars. */
  annualAmount: number;
  enactedDay: number;
  repealedDay: number | null;
}

/**
 * What one tax actually produced, and why.
 *
 * THE ATTRIBUTION REQUIREMENT. Brief §4.3: "the modifier ledger attributes each
 * dollar to its originating law by name." Revenue is not routed through
 * `Modifier[]` — a modifier is an additive or percentage adjustment to a stat,
 * and revenue is a sum over instances, so forcing it through would mean lying
 * about what a modifier is. What it gets instead is the same GUARANTEE in the
 * right structure: a per-instance line that names its tax and the law that
 * created it, shows what was lost to collection and to non-compliance, and sums
 * visibly to the headline total. (docs/DECISIONS.md D-019)
 */
export interface RevenueLine {
  taxId: string;
  name: string;
  createdByBillId: string | null;
  base: TaxBase;
  bucket: 'customs' | 'excise' | 'land' | 'other';
  rate: number;
  /** Assessed value the rate was applied to. */
  assessedBase: number;
  /** rate × assessedBase, before any loss. */
  gross: number;
  /** Lost because the tax cannot be fully collected. Non-negative. */
  lostToCollection: number;
  /** Lost because regions did not remit. Non-negative. */
  lostToNonCompliance: number;
  /** What actually reaches the Treasury. gross − the two losses. */
  net: number;
}

/** The same attribution for the other side of the ledger. */
export interface OutlayLine {
  programId: string;
  name: string;
  createdByBillId: string | null;
  category: SpendingCategory | 'debtService';
  annualAmount: number;
}

export interface PolicyState {
  /** Every tax ever created this run, including repealed ones. */
  taxes: TaxInstance[];
  /** Every spending programme ever created this run, including repealed ones. */
  programs: SpendingProgram[];
  /**
   * Every bill ever passed this run, including repealed ones.
   *
   * Replaces `enactedLawIds: string[]`, which could record only that a law had
   * passed — not when, not at what intensity, and not that it had since been
   * repealed. (brief §4)
   */
  bills: EnactedBill[];
  /** Cumulative infrastructure spend; drives diminishing returns. */
  cumulativeInfrastructure: number;
}

/**
 * The ids of the three taxes and three programmes that exist at the founding.
 *
 * Stable and well-known, because content, migrations and tests all need to name
 * them. A new tax created by a bill gets an id derived from the bill.
 */
export const FOUNDING_TAX_IDS = {
  impost: 'tax_impost',
  spirits: 'tax_spirits',
  land: 'tax_land',
} as const;

export const FOUNDING_PROGRAM_IDS = {
  military: 'prog_military',
  civil: 'prog_civil',
  infrastructure: 'prog_infrastructure',
} as const;

// ============================================================================
// POLITICAL CAPITAL (Phase 2 brief §3)
//
// One currency, accruing daily, gating what the government can actually get
// done. Drawn from Democracy 4's political capital and HOI4's political power:
// D4 for what it is spent on, HOI4 for daily accrual, which fits a real-time
// clock far better than D4's quarterly turns.
//
// The distinction that makes it worth having alongside legitimacy: capital is
// the CAPACITY to act, legitimacy is the STANDING you spend by acting. A
// government can be widely thought legitimate and still unable to get anything
// through; it can also burn its standing acting decisively. Both are true of
// real governments, and modelling only one of them collapses the difference.
// (docs/DECISIONS.md D-020)
// ============================================================================

/**
 * Temporary emergency powers.
 *
 * Democracy 4's mechanic, and a good fit for this period: a severe enough
 * crisis lets a government push through what it otherwise could not. Raises
 * both the accrual rate and the cap, and expires on a fixed day — the powers
 * are temporary, and the game should never quietly forget to end them.
 */
export interface EmergencyPowers {
  /** What justified them, in the words the chronicle uses. */
  reason: string;
  grantedDay: number;
  endsDay: number;
  /** Multiplier applied to accrual and to the cap while active. */
  multiplier: number;
}

export interface PoliticalCapitalState {
  /** The stock on hand. Never negative, never above the resolved cap. */
  current: number;
  /**
   * The model's pre-ledger targets for daily accrual and for the cap.
   *
   * Stored for the same reason `NationStats.modelTargets` is: the stat popover
   * shows what the model computed, then what the ledger did to it, then the
   * total. Without the unmodified figure the popover could not reconcile.
   */
  modelTargets: { accrual: number; cap: number };
  /** The resolved figures actually in force, after the ledger. */
  accrualPerDay: number;
  cap: number;
  emergency: EmergencyPowers | null;
  /** Lifetime totals. Not spent by anything; they exist so balance is checkable. */
  totalAccrued: number;
  totalSpent: number;
  /**
   * Capital that accrued into a full reserve and was therefore lost.
   *
   * Tracked rather than silently discarded, because "hoarding is not a
   * strategy" (brief §3) is a design claim, and this is the number that says
   * whether it is true in play.
   */
  totalWasted: number;
}

// ============================================================================
// CONGRESS (Phase 2 brief §2.2)
//
// The republic's half of the founding choice. A crown decrees; a president has
// to carry a legislature, and the legislature has its own opinions.
//
// A PARTY IS A COALITION OF INTERESTS, not a list of positions. `blocAffinity`
// says whose side it takes, bills already declare whom they help and harm, and
// the vote falls out of the two. `docs/DECISIONS.md` D-030 argues why that is a
// better encoding than issue axes for this period.
// ============================================================================

export type PartyId =
  /** The informal interests of the First and Second Congresses. */
  | 'pro_administration'
  | 'anti_administration'
  /** What they hardened into from the Third Congress, in 1793. */
  | 'federalist'
  | 'democratic_republican';

export const PARTY_IDS: readonly PartyId[] = [
  'pro_administration',
  'anti_administration',
  'federalist',
  'democratic_republican',
] as const;

export interface Party {
  id: PartyId;
  name: string;
  shortName: string;
  activeFrom: string;
  activeUntil: string | null;
  /**
   * How reliably members vote the line rather than their own state's interest,
   * 0…1. Low in the first two Congresses, because there was no line to vote.
   */
  discipline: number;
  /** −1…+1 per bloc: whose interests this party takes as its own. */
  blocAffinity: Record<string, number>;
  historicalNote: string;
  sources: string[];
}

/** A state's House seats, and when that number changed. */
export interface StateSeats {
  code: string;
  name: string;
  regionId: RegionId;
  /** ISO date the state ratified or was admitted. */
  admittedOn: string;
  /** In date order. The last entry whose date has passed is in force. */
  house: Array<{ from: string; seats: number }>;
}

/** One state's representation, and how it is split. */
export interface Delegation {
  stateCode: string;
  regionId: RegionId;
  houseSeats: number;
  senateSeats: number;
  /**
   * Party shares of this delegation, as fractions summing to 1.
   *
   * Fractions rather than whole members, and deliberately: this project has not
   * sourced a state-by-state party breakdown for every Congress, and inventing
   * named members would dress a model up as a record. A share is honestly a
   * model. (ECONOMY.md §7.20, BLOCKERS.md B-006)
   */
  share: Record<string, number>;
  /**
   * The same, for the Senate — which is NOT the same, and that is the point.
   *
   * Article I §3 cl. 2 divided the senators into three classes so that only a
   * third face election in any cycle. A Senate therefore carries two thirds of
   * an opinion the country has already moved on from. Modeled by blending the
   * fresh share into the sitting one at each election rather than replacing it.
   * (ECONOMY.md §7.20)
   */
  senateShare: Record<string, number>;
}

/**
 * A promise made to buy votes, which comes due later.
 *
 * Log-rolling (brief §2.2). The votes arrive now; the favour is called in on
 * `dueDay`, and the government pays then — in capital if it has any, in
 * standing if it does not. A promise with no cost is not a promise.
 */
export interface Obligation {
  id: string;
  /** Whose support was bought. */
  party: PartyId;
  /** The bill it was bought for, for the chronicle. */
  forBillId: string;
  incurredDay: number;
  dueDay: number;
  /** Political capital owed when it comes due. */
  cost: number;
  settledDay: number | null;
}

export interface CongressState {
  /** 1st, 2nd, 3rd… Increments every two years on 4 March. */
  number: number;
  convenedDay: number;
  delegations: Delegation[];
  /**
   * billId -> the first day it may be introduced again.
   * A bill voted down does not come straight back. (brief §2.2)
   */
  cooldowns: Record<string, number>;
  obligations: Obligation[];
  /** How many bills the government has lost. Repeated failure damages standing. */
  defeats: number;
  /**
   * Persuasion bought and not yet spent, by party.
   *
   * Political capital spent whipping a particular interest, which lasts until
   * the next vote. Buying votes is a real action with a real price, and it
   * should not be permanent.
   */
  whipped: Record<string, number>;
}

// ============================================================================
// GRIEVANCE AND UNREST (Phase 2 brief §2.1)
//
// The price of ruling by decree. A crown can act without asking, and the cost
// is that the people it acts against remember — specifically, and by name.
//
// "Decreeing against the planters repeatedly builds planter grievance
// specifically, not just generic unhappiness." That sentence is the whole
// design: grievance is tracked per BLOC and per REGION, so a government can be
// broadly popular and still have made one interest implacable.
// ============================================================================

export type UnrestSeverity =
  /** Quiet non-payment. Revenue falls; nothing else happens. */
  | 'resistance'
  /** Open refusal. Collectors are turned back; stability suffers. */
  | 'defiance'
  /** Armed rising. The government must answer it. */
  | 'revolt';

export interface UnrestEpisode {
  id: string;
  regionId: RegionId;
  severity: UnrestSeverity;
  /** The bloc whose grievance carried it over the threshold. */
  drivenBy: BlocId;
  startedDay: number;
  /** null while it is still running. */
  endedDay: number | null;
}

export interface GrievanceState {
  /**
   * 0–100 per bloc. Accumulates when the government acts against a bloc's
   * interest, and decays slowly — a grievance is forgotten, but not quickly.
   */
  byBloc: Record<string, number>;
  /** 0–100 per region, derived from bloc grievance and the bloc weighting. */
  byRegion: Record<string, number>;
  /** Every episode this run, including resolved ones. The record survives. */
  episodes: UnrestEpisode[];
}

// ============================================================================
// EVENTS AND LOGGING
// ============================================================================

export interface PendingEvent {
  eventId: string;
  firedOnDay: number;
}

export interface ScheduledEvent {
  eventId: string;
  fireOnDay: number;
}

export interface EventState {
  firedEventIds: string[];
  /** eventId -> chosen optionId. Lets content branch on past decisions. */
  chosenOptions: Record<string, string>;
  pendingDecisions: PendingEvent[];
  scheduledEvents: ScheduledEvent[];
}

export type LogTier = 'info' | 'decision' | 'crisis' | 'enactment';

export type LogCategory =
  | 'treasury'
  | 'legislation'
  | 'region'
  | 'event'
  | 'system';

export interface LogEntry {
  id: string;
  day: number;
  tier: LogTier;
  category: LogCategory;
  title: string;
  body: string;
  relatedEventId: string | null;
}

// ============================================================================
// TIME SERIES
// ============================================================================

/**
 * Monthly samples for sparklines and the History comparison view.
 *
 * Parallel arrays rather than an array of objects: this is roughly 140 samples
 * across Phase 1, and the flat form keeps saves compact and charts cheap to
 * render. `days[i]` is the day number for every other array's index `i`.
 */
export interface SeriesHistory {
  days: number[];
  population: number[];
  gdp: number[];
  debt: number[];
  treasuryBalance: number[];
  receipts: number[];
  outlays: number[];
  stability: number[];
  legitimacy: number[];
  sectionalTension: number[];
}

// ============================================================================
// GAME STATE
// ============================================================================

/**
 * The complete simulation state. One serializable object. (DESIGN.md Rule 3)
 *
 * Note on RNG: DESIGN.md §13 lists `seed`, `rngState`, and `rngCalls` as flat
 * fields. They are grouped here into `rng: RngState` — the same three values,
 * encapsulated with the functions that operate on them. Still plain JSON.
 */
export interface GameState {
  // --- identity and versioning ---
  schemaVersion: number;
  gameId: string;
  /** Wall-clock creation time. Metadata only; never read by the simulation. */
  createdAtISO: string;
  contentVersion: string;

  // --- determinism ---
  rng: RngState;

  // --- time ---
  /** Integer days since 1789-04-30 (day 0). */
  day: number;

  // --- the polity ---
  governmentType: GovernmentType;
  ruler: Ruler;
  nation: NationStats;
  regions: Region[];
  treasury: TreasuryState;
  policies: PolicyState;
  politicalCapital: PoliticalCapitalState;
  /**
   * Who resents the government, and how much. (brief §2.1)
   *
   * The price of ruling by decree, tracked per bloc and per region so that a
   * crown can be broadly tolerated and still have made one interest implacable.
   */
  grievance: GrievanceState;
  /**
   * The legislature. (brief §2.2)
   *
   * Present on both paths and simulated on both — a crown still has a country
   * with interests in it — but only the republic has to win its votes. A
   * monarchy decrees, and Congress is a record of who would have objected.
   */
  congress: CongressState;
  /**
   * Who the country is made of, and how that is changing. (brief §1, item 8)
   *
   * Overlapping, graduated membership per region, drifting monthly toward what
   * the economy and the statute book imply. The reason a tariff can produce
   * more artisans rather than merely happier ones.
   */
  blocs: BlocState;
  /**
   * The world outside. (brief §7)
   *
   * Relations with every foreign power, the treaties in force, and what those
   * treaties cost every year. The treaties themselves act on the economy
   * through the modifier ledger, exactly as bills do.
   */
  diplomacy: DiplomacyState;

  // --- the ledger ---
  activeModifiers: Modifier[];

  // --- content interaction ---
  eventState: EventState;
  /** Content-settable flags, for branching without engine changes. */
  flags: Record<string, string | number | boolean>;

  // --- record ---
  log: LogEntry[];
  series: SeriesHistory;

  // --- bookkeeping ---
  lastEconomyRecomputeDay: number;
  /** True while a decision is blocking; the loop must not advance. */
  paused: boolean;
}

// ============================================================================
// TICK RESULTS
// ============================================================================

export type TickEffectKind =
  | 'eventFired'
  | 'modifierApplied'
  | 'modifierExpired'
  | 'thresholdCrossed'
  | 'economyRecomputed'
  | 'yearRolled'
  | 'borrowed'
  | 'taxEnacted'
  | 'taxChanged'
  | 'taxRepealed'
  | 'programFunded'
  | 'programDefunded'
  | 'capitalSpent'
  | 'emergencyPowersGranted'
  | 'emergencyPowersLapsed'
  | 'billEnacted'
  | 'billAmended'
  | 'billRepealed'
  | 'billDefeated'
  | 'congressElected'
  | 'obligationSettled'
  | 'unrestBegan'
  | 'unrestEnded'
  | 'succession'
  | 'successionDisputed';

export interface TickEffect {
  kind: TickEffectKind;
  day: number;
  description: string;
  /** Ids of whatever the effect concerns — event, modifier, region. */
  refs: string[];
}

/**
 * The result of advancing one day.
 *
 * `pauseRequested` is returned explicitly rather than left for the loop to
 * infer from state, so the runtime can halt on exactly the day a decision
 * event fires. A decision must never be missed because the game was at 5x.
 * (DESIGN.md §6.3)
 */
export interface TickResult {
  state: GameState;
  effects: TickEffect[];
  pauseRequested: boolean;
}

// ============================================================================
// CONTENT — CONDITIONS (DESIGN.md §7.2)
// ============================================================================

export type ComparisonOp = '<' | '<=' | '>' | '>=' | '==';

export type Condition =
  | { kind: 'dateOnOrAfter'; date: string }
  | { kind: 'dateBefore'; date: string }
  | { kind: 'stat'; path: string; op: ComparisonOp; value: number }
  | {
      kind: 'regionStat';
      regionId: RegionId;
      path: string;
      op: ComparisonOp;
      value: number;
    }
  | { kind: 'flag'; key: string; equals: string | number | boolean }
  | { kind: 'billEnacted'; billId: string }
  | { kind: 'eventFired'; eventId: string }
  | { kind: 'optionChosen'; eventId: string; optionId: string }
  | { kind: 'governmentType'; is: GovernmentType }
  | { kind: 'not'; of: Condition }
  | { kind: 'all'; of: Condition[] }
  | { kind: 'any'; of: Condition[] };

// ============================================================================
// CONTENT — EFFECTS (DESIGN.md §7.3)
// ============================================================================

export type EffectSpec =
  | {
      kind: 'modifier';
      source: string;
      sourceType: ModifierSourceType;
      target: string;
      value: number;
      isPercentage: boolean;
      /** null = permanent. */
      durationDays: number | null;
    }
  | { kind: 'treasuryDelta'; amount: number; reason: string }
  | { kind: 'regionSentiment'; regionId: RegionId | 'all'; delta: number }
  | { kind: 'setFlag'; key: string; value: string | number | boolean }
  | { kind: 'scheduleEvent'; eventId: string; inDays: number }
  | { kind: 'unlockBill'; billId: string }
  | { kind: 'repealBill'; billId: string }
  /** Change the rate of a tax that already exists, by id. */
  | { kind: 'setTaxRate'; taxId: string; value: number }
  /**
   * Bring a new tax into existence. This is the effect that makes brief §4.3
   * real: content declares a tax and the engine creates the instance, which
   * then appears in Treasury as its own line with its own revenue.
   *
   * Applying it twice for the same id is idempotent — the second application
   * updates the existing instance rather than creating a duplicate — so a
   * re-run event cannot silently double a country's taxes.
   */
  | {
      kind: 'enactTax';
      taxId: string;
      name: string;
      base: TaxBase;
      rate: number;
      exemptions: string[];
      /** Omitted means the base's reference efficiency. */
      collectionEfficiency?: number;
    }
  | { kind: 'repealTax'; taxId: string }
  | {
      kind: 'fundProgram';
      programId: string;
      name: string;
      category: SpendingCategory;
      annualAmount: number;
    }
  | { kind: 'defundProgram'; programId: string }
  /**
   * Grant temporary emergency powers — Democracy 4's mechanic (brief §3).
   *
   * A severe enough crisis lets a government push through what it otherwise
   * could not, at a raised accrual rate and a raised cap, for a fixed number of
   * days. Content-declared rather than engine-inferred, so a designer decides
   * which crises qualify and the player can be told why.
   */
  | {
      kind: 'grantEmergencyPowers';
      /** As the chronicle will phrase it: "the rebellion in the west". */
      reason: string;
      durationDays: number;
      /** Omitted means EMERGENCY_POWERS_MULTIPLIER. */
      multiplier?: number;
    }
  /** Spend or grant political capital directly. Negative amounts spend. */
  | { kind: 'politicalCapitalDelta'; amount: number; reason: string }
  | { kind: 'log'; tier: LogTier; category: LogCategory; title: string; body: string };

// ============================================================================
// CONTENT — EVENTS AND LAWS (DESIGN.md §7.1, §7.4)
// ============================================================================

export interface EventOption {
  id: string;
  label: string;
  description: string;
  /** If unmet, the option renders disabled with its reason shown. */
  requirements: Condition[];
  effects: EffectSpec[];
  /**
   * Authored plain-English effect summary shown on the option card.
   * Deliberately not generated from `effects` — the player should read
   * "Strengthens federal credit, angers frontier distillers", not a list of
   * raw numbers.
   */
  previewedEffects: string[];
}

export interface GameEvent {
  id: string;
  title: string;
  /** ISO date it happened in reality, where applicable. */
  historicalDate: string | null;
  /** All must be satisfied for the event to fire. */
  triggerConditions: Condition[];
  /** Narrative framing. */
  body: string;
  /**
   * What actually occurred, factually. Shown alongside the choice.
   * This is the educational backbone of the game and must be accurate.
   */
  historicalContext: string;
  sources: string[];
  options: EventOption[];
  /** True auto-pauses the clock when this event fires. */
  pausesGame: boolean;
  /** Tie-break when several events fire on the same day. Higher wins. */
  weight: number;
  oneShot: boolean;
}

// ----------------------------------------------------------------------------
// BILLS (Phase 2 brief §4)
//
// Phase 1 had `Law`: a title, a treasury cost, some effects. Brief §4 makes
// legislation the heart of the game, so a bill now carries what a bill actually
// has — a department, a political price separate from its fiscal one, an
// intensity where one makes sense, preconditions that explain themselves, a
// declared relationship to the historical record, and a statement of who gains
// and who loses.
//
// Modelled closely on Democracy 4's policy structure, as the brief asks.
// ----------------------------------------------------------------------------

/**
 * The seventeen departments a bill can belong to. (brief §4.1)
 *
 * Not every one has content in 1790, and that is deliberate: an empty
 * department shows what would unlock it and when, rather than being hidden. A
 * player should be able to see the shape of the government they do not yet have.
 */
export type Department =
  | 'taxation'
  | 'trade'
  | 'banking'
  | 'military'
  | 'judiciary'
  | 'public_works'
  | 'land'
  | 'immigration'
  | 'slavery_civil_rights'
  | 'education'
  | 'postal'
  | 'foreign_affairs'
  | 'agriculture'
  | 'labor'
  | 'health_welfare'
  | 'elections'
  | 'administration';

export const DEPARTMENTS: readonly Department[] = [
  'taxation',
  'trade',
  'banking',
  'military',
  'judiciary',
  'public_works',
  'land',
  'immigration',
  'slavery_civil_rights',
  'education',
  'postal',
  'foreign_affairs',
  'agriculture',
  'labor',
  'health_welfare',
  'elections',
  'administration',
] as const;

/**
 * A bill's relationship to the historical record. (brief §4.4)
 *
 * Every tier carries factual context — that is the educational spine and it is
 * not dropped because a bill is counterfactual.
 */
export type BillHistoricity =
  /** Became law in reality. The real date and outcome are shown. */
  | 'enacted'
  /** Genuinely debated at the time but failed or stalled. Fully available. */
  | 'proposed'
  /** Plausible for the era, never seriously advanced. Available, marked. */
  | 'counterfactual'
  /** Impossible for the period. Locked, with the reason stated. */
  | 'anachronistic';

/**
 * The economic and social groupings a bill acts on. (brief §1, from Democracy 4)
 *
 * Membership is graduated and overlapping — a Virginia planter is also a
 * slaveholder and often a debtor — and it MOVES: `BlocState` below carries the
 * live shares, `src/sim/blocs.ts` the model that changes them, and ECONOMY.md
 * §7.21 the reasoning. A bill's declared reactions land wherever the bloc
 * actually is on the day it passes, not wherever a table once said it was.
 */
export type BlocId =
  | 'planters'
  | 'merchants'
  | 'frontier_settlers'
  | 'artisans'
  | 'financiers'
  | 'clergy'
  | 'seamen'
  | 'small_farmers';

export const BLOC_IDS: readonly BlocId[] = [
  'planters',
  'merchants',
  'frontier_settlers',
  'artisans',
  'financiers',
  'clergy',
  'seamen',
  'small_farmers',
] as const;

/**
 * Who the country is made of, as it stands today. (brief §1, queue item 8)
 *
 * `membership[regionId][blocId]` is a fraction of that region's population.
 * Overlapping, so a region's shares may sum above 1; incomplete, so they may
 * sum below it. Both are load-bearing — see `calibration.ts`, BLOCS.
 */
export interface BlocState {
  membership: Record<string, Record<string, number>>;
  /**
   * The day-0 economy each bloc's target is measured against.
   *
   * Stored, never recomputed. Every driver enters the model as a ratio to its
   * founding value, so these are the denominators — recomputing them from the
   * current economy would make every ratio 1 forever and freeze the model.
   */
  baseDrivers: Record<
    string,
    {
      tradePerHead: number;
      manufacturingPerHead: number;
      agriculturePerHead: number;
      enslavedShare: number;
      prosperity: number;
      population: number;
    }
  >;
  /** Last day the monthly drift ran. Bookkeeping, like `lastEconomyRecomputeDay`. */
  lastDriftDay: number;
}

export interface BlocReaction {
  bloc: BlocId;
  /** −100…+100. How strongly this bloc gains or loses by the bill. */
  strength: number;
  /**
   * Why, in one clause. Shown on the bill card and, from item 7, in the whip
   * count. Authored rather than generated: "loses the only market a bulk crop
   * can reach" says something a number cannot.
   */
  reason: string;
}

/**
 * An effect a bill applies, expressed so it can scale with the bill's slider.
 *
 * Distinct from `EffectSpec`, which is a one-shot instruction. A bill's effects
 * persist while it is in force, scale with its intensity, and are withdrawn
 * when it is repealed, so they are declared as a template the engine
 * instantiates rather than as an instruction it executes.
 */
export interface ModifierTemplate {
  target: string;
  /**
   * The magnitude. For a slider bill this is the value AT THE TOP of the slider
   * range when `scalesWithSlider` is true, so the declared number is the
   * strongest the bill can be.
   */
  value: number;
  isPercentage: boolean;
  /** Scale linearly with the slider position across its range. */
  scalesWithSlider: boolean;
  /** null = in force as long as the bill is. */
  durationDays: number | null;
}

/** A tax a bill brings into existence when it passes. (brief §4.3) */
export interface BillTaxTemplate {
  taxId: string;
  name: string;
  base: TaxBase;
  /** Rate for a flat bill. Slider bills take their rate from the slider. */
  rate: number;
  exemptions: string[];
  collectionEfficiency: number | null;
}

/** A spending programme a bill funds when it passes. */
export interface BillProgramTemplate {
  programId: string;
  name: string;
  category: SpendingCategory;
  /** Annual amount for a flat bill. Slider bills take it from the slider. */
  annualAmount: number;
}

export interface Bill {
  id: string;
  category: Department;
  name: string;
  description: string;
  /** What actually happened, factually. Required on every tier. */
  historicalNote: string;
  sources: string[];

  /** A rate or intensity, rather than a flat enact/repeal. */
  hasSlider: boolean;
  sliderRange: [number, number] | null;
  /** What the slider means, e.g. "Duty on carriage value". */
  sliderLabel: string | null;
  sliderUnit: 'rate' | 'dollars' | null;

  /**
   * The political price, in political capital. Four numbers because the four
   * acts are different: introducing a thing is not the same as repealing it,
   * and raising a rate is not the same as lowering it. (Democracy 4's schema.)
   */
  capitalCost: {
    introduce: number;
    repeal: number;
    /** Per unit of slider increase. */
    raise: number;
    /** Per unit of slider decrease. */
    lower: number;
  };

  /** One-off treasury cost, across the slider range. */
  treasuryCost: { min: number; max: number };

  /**
   * Days over which the bill's effects ramp from nothing to full.
   *
   * A statute does not change a country the day it is signed: officers have to
   * be appointed, forms printed, collectors sent. Never zero for anything real.
   */
  phaseInDays: number;

  prerequisites: Condition[];
  /** Earliest plausible date, ISO. */
  availableFrom: string;
  availableUntil: string | null;

  historicity: BillHistoricity;
  /**
   * Why it cannot be passed, when `historicity` is 'anachronistic'.
   *
   * Rendered verbatim, so it has to be a real reason and not a shrug. A player
   * who wonders why they cannot lay an income tax in 1791 should learn the
   * constitutional and administrative answer from the game.
   */
  lockedBecause: string | null;

  effects: ModifierTemplate[];
  blocReactions: BlocReaction[];

  /** Instances this bill creates in Treasury when it passes. (brief §4.3) */
  createsTax: BillTaxTemplate | null;
  createsProgram: BillProgramTemplate | null;

  repealable: boolean;
}

/** A bill as it stands in a particular run. */
export interface EnactedBill {
  billId: string;
  enactedDay: number;
  /** null = still in force. Repealed bills stay, so the record survives. */
  repealedDay: number | null;
  /** Slider position, or null for a flat bill. */
  sliderValue: number | null;
}

// ============================================================================
// CONTENT — OFFICES
//
// Defined here rather than in src/content/ because the ENGINE reads them: how
// much of the administration exists and is staffed drives political capital
// accrual (§7.17). Content declares the tenures; the engine interprets them,
// which is Rule 4 working normally.
// ============================================================================

export interface Tenure {
  name: string;
  /** ISO date the holder took office. */
  from: string;
  /** ISO date they left, or null if still in office at the end of the period. */
  to: string | null;
  note?: string;
}

export interface Office {
  id: string;
  title: string;
  /** ISO date the office itself was created. Before this it does not exist. */
  createdOn: string;
  tenures: Tenure[];
  sources: string[];
}

// ============================================================================
// CONTENT PACK
// ============================================================================

/**
 * Everything the engine reads that is not state. Pure data, no functions.
 * `advanceDay(state, content)` is a function of exactly these two inputs.
 */
export interface ContentPack {
  version: string;
  events: GameEvent[];
  bills: Bill[];
  /** The parties, and the interests each of them serves. (brief §2.2) */
  parties: Party[];
  /** House seats by state, and the dates that changed them. */
  stateSeats: StateSeats[];
  /**
   * The offices of the federal government and who held them.
   *
   * Required rather than optional, because a content pack without them is a
   * country with no administration, and the engine should not have to guess
   * whether that is intended. Tests that want no administration pass `[]`
   * explicitly and get exactly that.
   */
  offices: Office[];
}

// ============================================================================
// DIPLOMACY (brief §7, queue item 11)
// ============================================================================

/** Where we stand with one foreign power. */
export interface PowerRelation {
  powerId: string;
  /** −100…+100. Plain words for it come from `relationWord`. */
  relation: number;
  /**
   * Set by queue item 12, which builds the declaration paths. Present now
   * because every query that asks "can this be signed" has to ask it, and a
   * field added later would mean a migration for a boolean.
   */
  atWar: boolean;
  /** The last day a mission was sent. For the UI, so a player can pace them. */
  lastEnvoyDay: number | null;
}

/** A treaty the United States has actually concluded. */
export interface TreatyRecord {
  treatyId: string;
  powerId: string;
  signedDay: number;
  /** null = still in force. */
  endedDay: number | null;
  /** Whether it ended by repudiation rather than by expiry or agreement. */
  breached: boolean;
}

/** Tribute owed every year while a treaty stands. */
export interface TributeObligation {
  powerId: string;
  treatyId: string;
  annualAmount: number;
}

export interface DiplomacyState {
  relations: Record<string, PowerRelation>;
  treaties: TreatyRecord[];
  tributeDue: TributeObligation[];
}
