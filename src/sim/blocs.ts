/**
 * BLOCS — who the country is made of, and how that changes
 *
 * Phase 2 brief §1 and queue item 8, taking two ideas from Democracy 4:
 *
 *   "Nobody in Democracy 4 is only a member of one group… citizens belong to
 *    multiple overlapping blocs simultaneously, with graduated rather than
 *    binary membership."
 *
 *   "Group membership is fluid and policies change the size of groups over
 *    time. Build this. Blocs should grow and shrink in response to policy, not
 *    just get happier or angrier."
 *
 * WHAT REPLACED WHAT
 *
 * Until this landed, a bloc was a row in a static table — a fixed weighting of
 * how much of each bloc lived in each region, used to land bill reactions and
 * grievance somewhere real. It never moved. A tariff could make the artisans
 * happy but could not make there be more of them.
 *
 * Membership is now STATE: a fraction of each region's population, per bloc,
 * recomputed monthly toward a target the economy and the statute book imply.
 * The static table survives only as the day-0 seed, which is where a day-0
 * equilibrium belongs.
 *
 * THREE PROPERTIES THAT MATTER
 *
 * 1. OVERLAPPING. Shares within a region do not sum to 1 and are not meant to.
 *    On the frontier, half the population are small farmers and four fifths are
 *    frontier settlers, because most of them are both. A measure that angers
 *    either angers most of the region.
 *
 * 2. INCOMPLETE, HONESTLY. They do not sum to 1 the other way either. In the
 *    South the shares total about 0.6, and the missing four tenths are mostly
 *    the enslaved — a third of the region's people, belonging to no bloc in a
 *    model of political interests because they were allowed none. The model
 *    does not quietly round them into "small farmers" to make a column add up.
 *    (DESIGN.md §9, ECONOMY.md §7.21)
 *
 * 3. EXPLICABLE. A bloc's target is a seed times a product of economic ratios,
 *    then the modifier ledger. `explainBloc` returns every step, and the steps
 *    sum to the target — the same contract `explainStat` has with a stat.
 *
 * WHY RATIOS RATHER THAN ABSOLUTE FORMULAS
 *
 * Every driver enters as `(now / day-0)^elasticity`. At day 0 every ratio is 1,
 * so the target equals the seed and nothing moves. The founding is an
 * equilibrium the model sits still in rather than a starting point it
 * immediately slides away from — the same discipline `baseProsperity` and
 * `baselineTaxBurden` already carry.
 */

import {
  BLOC_DRIFT_PER_MONTH,
  BLOC_ELASTICITIES,
  BLOC_MEMBERSHIP_1790,
  BLOC_MEMBERSHIP_MAX,
  BLOC_MEMBERSHIP_MIN,
} from './calibration';
import { explainStat, type StatBreakdown } from './modifiers';
import {
  BLOC_IDS,
  REGION_IDS,
  type BlocId,
  type BlocState,
  type GameState,
  type Modifier,
  type Region,
  type RegionId,
} from './types';

// ============================================================================
// SEEDING
// ============================================================================

/**
 * Day-0 membership, and the day-0 economy each bloc is measured against.
 *
 * Both are stored rather than recomputed. The denominators have to be the
 * founding's values forever — recomputing them from the current economy would
 * make every ratio 1 at every moment and the model would never move at all.
 */
export function seedBlocs(regions: readonly Region[]): BlocState {
  const membership: Record<string, Record<string, number>> = {};
  const drivers: Record<string, BlocDrivers> = {};

  for (const region of regions) {
    membership[region.id] = { ...(BLOC_MEMBERSHIP_1790[region.id] ?? {}) };
    drivers[region.id] = driversFor(region);
  }

  return { membership, baseDrivers: drivers, lastDriftDay: 0 };
}

/**
 * The four economic quantities a bloc's size responds to, per head.
 *
 * Per head rather than absolute, deliberately: a region whose trade doubles
 * while its population doubles has not become more mercantile. Absolute figures
 * would turn every bloc into a population counter.
 */
export interface BlocDrivers {
  tradePerHead: number;
  manufacturingPerHead: number;
  agriculturePerHead: number;
  /** Share of the region's people who are enslaved: the shape of staple agriculture. */
  enslavedShare: number;
  prosperity: number;
  population: number;
}

export function driversFor(region: Region): BlocDrivers {
  const head = Math.max(1, region.population);
  return {
    tradePerHead: region.tradeVolume / head,
    manufacturingPerHead: region.manufacturingOutput / head,
    agriculturePerHead: region.agriculturalOutput / head,
    enslavedShare: region.enslavedPopulation / head,
    prosperity: Math.max(1, region.prosperity),
    population: head,
  };
}

// ============================================================================
// THE TARGET, AND ITS EXPLANATION
// ============================================================================

/** One driver's contribution to a bloc's target, in membership points. */
export interface BlocDriverContribution {
  /** Which quantity moved. */
  driver: keyof BlocDrivers;
  /** Plain English, for the popover. */
  label: string;
  /** now / day-0. Above 1 means the quantity has grown. */
  ratio: number;
  /** How hard this bloc responds to it. Negative means the bloc shrinks as it grows. */
  elasticity: number;
  /** Membership points this factor added, given everything applied before it. */
  effect: number;
}

export interface BlocBreakdown {
  regionId: string;
  bloc: BlocId;
  /** Day-0 membership: where this starts. */
  seed: number;
  /** The economy's contributions, in order, each already reconciled. */
  drivers: BlocDriverContribution[];
  /** Seed plus every driver: what the economy alone implies. */
  economicTarget: number;
  /** The statute book's effect on top, through the ledger like everything else. */
  ledger: StatBreakdown;
  /** Where membership is heading. */
  target: number;
  /** Where it is now. */
  current: number;
  /** target − current. Positive means the bloc is growing. */
  gap: number;
}

const DRIVER_LABEL: Record<keyof BlocDrivers, string> = {
  tradePerHead: 'trade per head',
  manufacturingPerHead: 'manufacturing per head',
  agriculturePerHead: 'farm output per head',
  enslavedShare: 'the enslaved share of the population',
  prosperity: 'prosperity',
  population: 'population',
};

/**
 * The ledger target a bill uses to move a bloc's size.
 *
 * `bloc.artisans.new_england` — a percentage modifier here is the mechanism by
 * which a protective tariff produces more artisans rather than merely happier
 * ones. Named as a dotted path like every other target, so nothing about the
 * ledger has to learn that blocs exist.
 */
export function blocTarget(bloc: BlocId, regionId: string): string {
  return `bloc.${bloc}.${regionId}`;
}

/**
 * Where a bloc's membership is heading, and every reason why.
 *
 * The arithmetic returned here IS the arithmetic that produces the target. The
 * drivers are applied in a fixed order and each one's `effect` is what it added
 * given the ones before it, so `seed + Σ effects = economicTarget` exactly —
 * a multiplicative model reported additively, which is the only form a player
 * can check by eye.
 */
export function explainBloc(
  state: GameState,
  regionId: string,
  bloc: BlocId,
): BlocBreakdown {
  const region = state.regions.find((r) => r.id === regionId);
  const seed = BLOC_MEMBERSHIP_1790[regionId]?.[bloc] ?? 0;
  const current = state.blocs.membership[regionId]?.[bloc] ?? seed;

  const base = state.blocs.baseDrivers[regionId];
  const elasticities = BLOC_ELASTICITIES[bloc] ?? {};

  const drivers: BlocDriverContribution[] = [];
  let running = seed;

  if (region && base) {
    const now = driversFor(region);
    for (const key of Object.keys(elasticities) as Array<keyof BlocDrivers>) {
      const elasticity = elasticities[key];
      if (!elasticity) continue;

      const denominator = base[key];
      // A day-0 value of zero cannot be a denominator, and a ratio against it
      // would be meaningless rather than large. The factor is simply absent.
      const ratio = denominator > 0 ? now[key] / denominator : 1;
      const factor = Math.pow(Math.max(0.01, ratio), elasticity);

      const after = running * factor;
      drivers.push({
        driver: key,
        label: DRIVER_LABEL[key],
        ratio,
        elasticity,
        effect: after - running,
      });
      running = after;
    }
  }

  const economicTarget = running;

  const ledger = explainStat(
    blocTarget(bloc, regionId),
    economicTarget,
    state.activeModifiers,
    state.day,
    { min: BLOC_MEMBERSHIP_MIN, max: BLOC_MEMBERSHIP_MAX },
  );

  return {
    regionId,
    bloc,
    seed,
    drivers,
    economicTarget,
    ledger,
    target: ledger.total,
    current,
    gap: ledger.total - current,
  };
}

// ============================================================================
// DRIFT
// ============================================================================

/**
 * A month's movement toward the target.
 *
 * Partial, and slowly: `BLOC_DRIFT_PER_MONTH` of the remaining gap. People do
 * not change trade because a statute passed; they change it over years, and a
 * bloc that snapped to its target would make policy feel like a switch rather
 * than a consequence. It also means a policy reversed before it has taken hold
 * leaves the country roughly where it found it, which is correct.
 */
export function driftBlocs(state: GameState): BlocState {
  const membership: Record<string, Record<string, number>> = {};

  for (const regionId of REGION_IDS) {
    const row: Record<string, number> = {};
    for (const bloc of BLOC_IDS) {
      const { current, target } = explainBloc(state, regionId, bloc);
      const moved = current + (target - current) * BLOC_DRIFT_PER_MONTH;
      row[bloc] = clampMembership(moved);
    }
    membership[regionId] = row;
  }

  return { ...state.blocs, membership, lastDriftDay: state.day };
}

function clampMembership(value: number): number {
  if (!Number.isFinite(value)) return BLOC_MEMBERSHIP_MIN;
  return Math.min(BLOC_MEMBERSHIP_MAX, Math.max(BLOC_MEMBERSHIP_MIN, value));
}

// ============================================================================
// DERIVED VIEWS
// ============================================================================

/**
 * How many people a bloc has in a region.
 *
 * The bridge between a share and a weight. Everything downstream — where a
 * bill's reactions land, where grievance shows up, how a delegation leans —
 * asks this rather than a table.
 */
export function blocHeadcount(
  state: GameState,
  regionId: string,
  bloc: BlocId,
): number {
  const region = state.regions.find((r) => r.id === regionId);
  if (!region) return 0;
  return (state.blocs.membership[regionId]?.[bloc] ?? 0) * region.population;
}

/** A bloc's total membership across the country. */
export function blocNationalSize(state: GameState, bloc: BlocId): number {
  return REGION_IDS.reduce((sum, r) => sum + blocHeadcount(state, r, bloc), 0);
}

export type BlocWeights = Record<string, Record<string, number>>;

/**
 * What share of each bloc lives in each region, derived from membership.
 *
 * This is the successor to the old static `BLOC_REGION_WEIGHTS`, and it has the
 * same shape so that everything reading it kept working — but it is now a
 * consequence of where people actually are rather than an assertion about it.
 * Each bloc's weights sum to 1, as before.
 *
 * Computed rather than stored, for the reason regional grievance is computed
 * rather than stored: two records of the same fact drift apart.
 */
export function blocWeights(state: GameState): BlocWeights {
  const weights: BlocWeights = {};

  for (const bloc of BLOC_IDS) {
    const heads: Record<string, number> = {};
    let total = 0;
    for (const regionId of REGION_IDS) {
      const head = blocHeadcount(state, regionId, bloc);
      heads[regionId] = head;
      total += head;
    }

    const row: Record<string, number> = {};
    for (const regionId of REGION_IDS) {
      // A bloc that has vanished everywhere is spread nowhere. Returning zeros
      // rather than dividing by zero keeps every downstream sum finite.
      row[regionId] = total > 0 ? heads[regionId] / total : 0;
    }
    weights[bloc] = row;
  }

  return weights;
}

/**
 * Which way a bloc has moved since the founding, as a proportion.
 *
 * For the UI: "the artisans are a fifth larger than in 1790" is the sentence a
 * player can act on, and it is the one thing a static model could never say.
 */
export function blocChangeSinceFounding(
  state: GameState,
  regionId: string,
  bloc: BlocId,
): number {
  const seed = BLOC_MEMBERSHIP_1790[regionId]?.[bloc] ?? 0;
  if (seed <= 0) return 0;
  return (state.blocs.membership[regionId]?.[bloc] ?? seed) / seed - 1;
}

/** Blocs in a region, largest first. For the Regions screen. */
export function blocsInRegion(
  state: GameState,
  regionId: RegionId,
): Array<{ bloc: BlocId; share: number; change: number }> {
  return BLOC_IDS.map((bloc) => ({
    bloc,
    share: state.blocs.membership[regionId]?.[bloc] ?? 0,
    change: blocChangeSinceFounding(state, regionId, bloc),
  })).sort((a, b) => b.share - a.share);
}

/**
 * The share of a region's people who belong to no bloc in this model.
 *
 * Reported rather than hidden. In the South it is about four tenths, and most
 * of them are the enslaved: a third of the region's people, with no political
 * interest the model can represent because they were permitted none. A model
 * of political blocs that silently added them to a bloc would be making a claim
 * about 1790 that is false. (ECONOMY.md §7.21)
 */
export function unrepresentedShare(state: GameState, regionId: string): number {
  const region = state.regions.find((r) => r.id === regionId);
  if (!region) return 0;
  const enslaved = region.enslavedPopulation / Math.max(1, region.population);
  return Math.max(0, enslaved);
}

/**
 * Whether a modifier is one of ours.
 * Used by the Regions screen to show which statutes are moving a bloc.
 */
export function isBlocModifier(modifier: Modifier): boolean {
  return modifier.target.startsWith('bloc.');
}
