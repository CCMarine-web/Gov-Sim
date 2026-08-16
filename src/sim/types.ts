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
export const SCHEMA_VERSION = 2;

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
  | 'crisis';

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
  /** Inert in Phase 1; present so Phase 2 succession needs no migration. */
  heirName: string | null;
  portraitId: string | null;
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
  enactedLawIds: string[];
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
  | 'programDefunded';

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
  | { kind: 'lawEnacted'; lawId: string }
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
  | { kind: 'unlockLaw'; lawId: string }
  | { kind: 'repealLaw'; lawId: string }
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

export type LawCategory =
  | 'fiscal'
  | 'commercial'
  | 'military'
  | 'judicial'
  | 'civil';

export interface Law {
  id: string;
  title: string;
  category: LawCategory;
  description: string;
  /** One-off treasury cost to enact. */
  enactmentCost: number;
  requirements: Condition[];
  effects: EffectSpec[];
  historicalContext: string;
  sources: string[];
  repealable: boolean;
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
  laws: Law[];
}
