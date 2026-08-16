/**
 * ADVANCE DAY
 *
 * The core of the simulation:
 *
 *     advanceDay(state, content) -> TickResult
 *
 * Pure, deterministic, and the only function the runtime calls to move time
 * forward. Same state in, same state out, always. (DESIGN.md Rule 2)
 *
 * TWO CADENCES (DESIGN.md §6.5)
 *
 *   EVERY DAY   calendar, modifier expiry, treasury cash flow, event triggers
 *   MONTHLY     the economic aggregates, on the 1st of each month
 *
 * GDP and agricultural output do not meaningfully change day to day, and
 * recomputing fourteen interlinked variables 4,263 times would be both
 * wasteful and physically odd. The monthly trigger is derived from the
 * CALENDAR, never from `day % 30`, which would drift against real months.
 *
 * HOW MODIFIERS ENTER THE ECONOMY
 * The economic model computes a TARGET for each slow-moving stat; the modifier
 * ledger is applied to that target; the stored value then lags toward it. So a
 * law that harms stability pulls the equilibrium down and stability drifts
 * there over about three months, rather than snapping. This also means
 * modifiers cannot compound on themselves across ticks, which they would if
 * they were applied to the stored value each day.
 */

import {
  dayToDate,
  daysInYear,
  isFirstOfMonth,
  isFirstOfYear,
  yearOf,
} from './calendar';
import { RANGES, TAU_MONTHS } from './calibration';
import { evaluateAll } from './conditions';
import { applyEffects } from './effects';
import {
  borrow,
  complianceTarget,
  computeDebtService,
  computeTaxRevenue,
  creditTarget,
  dailyAccrual,
  taxBurden,
  type RegionFiscalContext,
} from './economy/fiscal';
import {
  computeGdp,
  computeLaborForce,
  computeRegionOutput,
  computeTradeVolume,
  infrastructureBonus,
} from './economy/production';
import {
  accrueCapital,
  administrativeCapacityTarget,
  capitalAccrualTarget,
  capitalCapTarget,
  eliteSupport,
} from './economy/politics';
import {
  MAX_CAPITAL_ACCRUAL,
  UNKEPT_PROMISE_LEGITIMACY_COST,
} from './calibration';
import {
  decayGrievance,
  grievanceCompliancePenalty,
  grievanceSentimentPenalty,
  reconcileUnrest,
  unrestStabilityCost,
} from './grievance';
import {
  dueObligations,
  partiesOn,
  seatCongress,
  seatsByParty,
} from './congress';
import { censusOfOffices } from './offices';
import { checkSuccession } from './succession';
import { TAX_BASES } from './taxBases';
import {
  burdenLevies,
  programsInForce,
  rollupReceipts,
  spendingFor,
  taxesInForce,
  tradeTaxRate,
} from './taxes';
import {
  annualGrowthRate,
  lagToward,
  monthlyGrowth,
  monthlyLegitimacyChange,
  prosperityTarget,
  sentimentTarget,
  stabilityTarget,
  tensionTarget,
} from './economy/society';
import { expireModifiers, resolveStat } from './modifiers';
import { OTHER_RECEIPTS } from './calibration';
import type {
  ContentPack,
  GameEvent,
  GameState,
  OutlayLine,
  Party,
  PartyId,
  Region,
  RevenueLine,
  TickEffect,
  TickResult,
} from './types';

/**
 * How an episode of unrest is announced.
 *
 * Written as prose rather than assembled from fields, because "the collectors
 * are turned back" says something "defiance: 62" does not. The chronicle is an
 * account of the player's run, not a system log. (UI.md §4.3)
 */
const UNREST_TITLE: Record<string, (region: string) => string> = {
  resistance: (region) => `Quiet non-payment in ${region}`,
  defiance: (region) => `Open defiance in ${region}`,
  revolt: (region) => `Armed rising in ${region}`,
};

const UNREST_BODY: Record<string, (region: string, bloc: string) => string> = {
  resistance: (region, bloc) =>
    `Assessments in ${region} are going unanswered. Nothing is said openly, and ` +
    `the money simply does not arrive. The ${bloc} are at the bottom of it.`,
  defiance: (region, bloc) =>
    `Collectors in ${region} are being turned back at the door, and the local ` +
    `magistrates will not compel them. The ${bloc} are at the head of it, and ` +
    'the question is no longer revenue but whether federal law runs here.',
  revolt: (region, bloc) =>
    `${region} is in arms. The ${bloc} have carried the country with them, and ` +
    'the government must either answer this with force or concede it. Either ' +
    'answer will be remembered.',
};

/**
 * Is today the day a new Congress convenes?
 *
 * 4 March of every odd-numbered year, which is where the Confederation Congress
 * fixed the start of the new government and where every congressional term began
 * until the Twentieth Amendment moved it to 3 January in 1935.
 */
function isCongressionalTerm(dayNumber: number): boolean {
  const date = dayToDate(dayNumber);
  return date.month === 3 && date.day === 4 && date.year % 2 === 1;
}

/** "First", "Second"… for the chronicle. Falls back to a numeral. */
function ordinalCongress(n: number): string {
  const words = [
    '',
    'First',
    'Second',
    'Third',
    'Fourth',
    'Fifth',
    'Sixth',
    'Seventh',
    'Eighth',
    'Ninth',
    'Tenth',
  ];
  return words[n] ?? `${n}th`;
}

/**
 * What the new Congress looks like, in words.
 *
 * Names the largest party in each chamber and its share, because "the Fourth
 * Congress convenes" tells a player nothing they can act on.
 */
function describeCongress(
  state: GameState,
  number: number,
  parties: readonly Party[],
  day: number,
): string {
  const live = partiesOn(parties, day);
  const byId = new Map(live.map((p) => [p.id, p]));

  const describe = (chamber: 'house' | 'senate'): string => {
    const seats = seatsByParty(state.congress, chamber, live);
    const entries = Object.entries(seats).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return 'no members';

    const total = entries.reduce((s, [, v]) => s + v, 0);
    const [topId, topSeats] = entries[0];
    const name = byId.get(topId as PartyId)?.shortName ?? topId;
    return `${name} lead with about ${((topSeats / total) * 100).toFixed(0)} per cent`;
  };

  return (
    `The ${ordinalCongress(number)} Congress is seated. ` +
    `In the House, ${describe('house')}. In the Senate, ${describe('senate')}. ` +
    'The government must carry both.'
  );
}

/** Read a numeric flag, defaulting to 0. Content sets these; the engine reads them. */
function numericFlag(state: GameState, key: string): number {
  const value = state.flags[key];
  return typeof value === 'number' ? value : 0;
}

// ============================================================================
// MONTHLY ECONOMY RECOMPUTE
// ============================================================================

/**
 * Recompute the economic aggregates. Called on the 1st of each month.
 *
 * Exported so tests can drive it directly rather than having to advance thirty
 * days to observe one recompute.
 */
export function recomputeEconomy(
  state: GameState,
  content: ContentPack,
): {
  state: GameState;
  effects: TickEffect[];
} {
  const effects: TickEffect[] = [];
  const day = state.day;

  const infraBonus = infrastructureBonus(state.policies.cumulativeInfrastructure);

  /*
    THE TAX RATES ARE NOW DERIVED, NOT STORED.
    Whatever taxes exist in `policies.taxes` and are in force today determine the
    rate that suppresses trade and the burden each region feels. With the three
    founding taxes this is arithmetically identical to reading the three fields
    it replaced — the structural change deliberately moved no calibrated number.
    (brief §4.3, docs/DECISIONS.md D-018)
  */
  const tradeRate = tradeTaxRate(state.policies, day);
  const levies = burdenLevies(state.policies, day);

  // --- Regions -------------------------------------------------------------
  const regions: Region[] = state.regions.map((region) => {
    const laborForce = computeLaborForce(region.population, region.enslavedPopulation);

    const output = computeRegionOutput({
      regionId: region.id,
      laborForce,
      stability: state.nation.stability,
      cumulativeInfrastructure: state.policies.cumulativeInfrastructure,
      tariffRate: tradeRate,
    });

    const burden = taxBurden({
      levies,
      tariffExposure: region.tariffExposure,
      exciseExposure: region.exciseExposure,
      landExposure: region.landExposure,
    });

    // Prosperity: lags a year, because prosperity is lived conditions.
    const outputPerCapita =
      region.population > 0
        ? (output.agricultural + output.manufacturing) / region.population
        : 0;

    const prosperityGoal = prosperityTarget({
      baseProsperity: region.baseProsperity,
      outputPerCapita,
      baselineOutputPerCapita: region.baselineOutputPerCapita,
      taxBurden: burden,
      baselineTaxBurden: region.baselineTaxBurden,
      infrastructureBonus: infraBonus,
    });

    const prosperity = lagToward(region.prosperity, prosperityGoal, TAU_MONTHS.prosperity);
    const prosperityTrend = prosperity - region.prosperity;

    // Sentiment: lags six months, and is pulled by the modifier ledger as well
    // as by the model.
    const sentimentModelTarget =
      sentimentTarget({
        baseSentiment: region.baseSentiment,
        taxBurden: burden,
        baselineTaxBurden: region.baselineTaxBurden,
        prosperity,
        baseProsperity: region.baseProsperity,
        prosperityTrend,
        governmentAffinity: 0,
      }) -
      // Grievance bites sentiment at any level, unlike compliance, which has a
      // threshold. People can be sullen without refusing to pay, and this is
      // the channel the player sees FIRST — which is what makes the Regions
      // screen a warning rather than a post-mortem. (ECONOMY.md §7.19)
      grievanceSentimentPenalty(state.grievance.byRegion[region.id] ?? 0);

    const sentimentGoal = resolveStat(
      `region.${region.id}.sentiment`,
      sentimentModelTarget,
      state.activeModifiers,
      day,
      RANGES.sentiment,
    );

    const sentiment = lagToward(region.sentiment, sentimentGoal, TAU_MONTHS.sentiment);

    // Compliance: the loop that makes a tax worth only what people pay, less
    // whatever a standing grievance against the government takes off it. Below
    // the resistance threshold the penalty is zero — ordinary discontent is not
    // rebellion. (ECONOMY.md §7.19)
    const complianceModelTarget = Math.max(
      0,
      complianceTarget({
        sentiment,
        legitimacy: state.nation.legitimacy,
      }) - grievanceCompliancePenalty(state.grievance.byRegion[region.id] ?? 0),
    );

    const compliance = lagToward(
      region.compliance,
      complianceModelTarget,
      TAU_MONTHS.compliance,
    );

    return {
      ...region,
      laborForce,
      agriculturalOutput: output.agricultural,
      manufacturingOutput: output.manufacturing,
      prosperity,
      prosperityTrend,
      sentiment,
      compliance,
      modelTargets: {
        prosperity: prosperityGoal,
        sentiment: sentimentModelTarget,
        compliance: complianceModelTarget,
      },
    };
  });

  // --- National output and trade -------------------------------------------
  const agriculturalOutput = regions.reduce((s, r) => s + r.agriculturalOutput, 0);
  const manufacturingOutput = regions.reduce((s, r) => s + r.manufacturingOutput, 0);
  const totalOutput = agriculturalOutput + manufacturingOutput;

  // Trade capacity grows toward the economy's size but lags two years, so a
  // tariff cut does not restore trade overnight.
  const capacityGoal = totalOutput * 0.3;
  const tradeCapacity = lagToward(
    state.nation.tradeCapacity,
    capacityGoal,
    TAU_MONTHS.tradeCapacity,
  );

  const tradeVolume = computeTradeVolume(tradeCapacity, tradeRate);

  for (const region of regions) {
    const share =
      totalOutput > 0
        ? (region.agriculturalOutput + region.manufacturingOutput) / totalOutput
        : 0;
    region.tradeVolume = tradeVolume * share;
  }

  // --- Receipts ------------------------------------------------------------
  /*
    ONE LINE PER TAX IN FORCE.

    Revenue is no longer three bespoke formulas. Each tax is assessed against its
    own base, at its own rate, with its own collection efficiency, and the line it
    produces names the law that created it. That is what makes every dollar on the
    Treasury screen attributable. (brief §4.3, docs/DECISIONS.md D-019)

    The four headline buckets are then a ROLLUP of these lines, never a parallel
    calculation, so the detail and the headline cannot drift apart.
  */
  const fiscalRegions: RegionFiscalContext[] = regions.map((r) => ({
    id: r.id,
    compliance: r.compliance,
    output: r.agriculturalOutput + r.manufacturingOutput,
  }));

  const receiptLines: RevenueLine[] = taxesInForce(state.policies, day).map((tax) => {
    const definition = TAX_BASES[tax.base];
    const revenue = computeTaxRevenue({
      rate: tax.rate,
      collectionEfficiency: tax.collectionEfficiency,
      assessment: definition.assessment,
      tradeVolume,
      regionalBase: definition.regionalBase,
      outputShare: definition.outputShare,
      regions: fiscalRegions,
    });

    return {
      taxId: tax.id,
      name: tax.name,
      createdByBillId: tax.createdByBillId,
      base: tax.base,
      bucket: definition.bucket,
      rate: tax.rate,
      ...revenue,
    };
  });

  const annualisedReceipts = rollupReceipts(receiptLines, OTHER_RECEIPTS);

  // --- Outlays -------------------------------------------------------------
  // Debt service is non-discretionary and is computed first.
  const debtService = computeDebtService(
    state.treasury.debtPrincipal,
    state.treasury.debtWeightedRate,
  );

  const funded = programsInForce(state.policies, day);

  const outlayLines: OutlayLine[] = [
    {
      programId: 'debt_service',
      name: 'Debt service',
      createdByBillId: null,
      category: 'debtService',
      annualAmount: debtService,
    },
    ...funded.map((program) => ({
      programId: program.id,
      name: program.name,
      createdByBillId: program.createdByBillId,
      category: program.category,
      annualAmount: Math.max(0, program.annualAmount),
    })),
  ];

  const annualisedOutlays = {
    debtService,
    military: spendingFor(state.policies, day, 'military'),
    civil: spendingFor(state.policies, day, 'civil'),
    infrastructure: spendingFor(state.policies, day, 'infrastructure'),
  };

  const totalOutlays =
    annualisedOutlays.debtService +
    annualisedOutlays.military +
    annualisedOutlays.civil +
    annualisedOutlays.infrastructure;

  // --- GDP -----------------------------------------------------------------
  const gdp = computeGdp({
    agriculturalOutput,
    manufacturingOutput,
    tradeVolume,
    federalOutlays: totalOutlays,
  });

  // --- Credit --------------------------------------------------------------
  const creditRating = lagToward(
    state.treasury.creditRating,
    creditTarget({
      debtPrincipal: state.treasury.debtPrincipal,
      gdp,
      missedPayments: state.treasury.missedPayments,
      stability: state.nation.stability,
    }),
    TAU_MONTHS.creditRating,
  );

  // --- Tension and stability ----------------------------------------------
  const tensionModelTarget = tensionTarget({
    sentiments: regions.map((r) => r.sentiment),
    prosperities: regions.map((r) => r.prosperity),
    slaveryTension: numericFlag(state, 'slavery_tension'),
  });

  const sectionalTension = lagToward(
    state.nation.sectionalTension,
    resolveStat(
      'nation.sectionalTension',
      tensionModelTarget,
      state.activeModifiers,
      day,
      RANGES.percent,
    ),
    TAU_MONTHS.sentiment,
  );

  const meanSentiment =
    regions.reduce((s, r) => s + r.sentiment, 0) / (regions.length || 1);

  const stabilityModelTarget =
    stabilityTarget({
      meanSentiment,
      sectionalTension,
      legitimacy: state.nation.legitimacy,
    }) -
    // Open defiance and armed rising cost stability directly, for as long as
    // they run. Quiet non-payment costs nothing here: it is already costing
    // revenue, and charging it twice would make the mildest tier of unrest the
    // most punishing per point of grievance. (ECONOMY.md §7.19)
    unrestStabilityCost(state.grievance);

  const stability = lagToward(
    state.nation.stability,
    resolveStat(
      'nation.stability',
      stabilityModelTarget,
      state.activeModifiers,
      day,
      RANGES.percent,
    ),
    TAU_MONTHS.stability,
  );

  // --- Legitimacy ----------------------------------------------------------
  const meanProsperityTrend =
    regions.reduce((s, r) => s + r.prosperityTrend, 0) / (regions.length || 1);

  const legitimacyDelta = monthlyLegitimacyChange({
    governmentType: state.governmentType,
    prosperityGain: meanProsperityTrend,
    eventDelta: 0,
  });

  // The BASE accumulates; the ledger is applied on top for the resolved value.
  // Never fold the resolved value back into the base — that would re-add every
  // permanent modifier on every recompute. (types.ts, NationStats.legitimacyBase)
  const legitimacyBase = Math.min(
    100,
    Math.max(0, state.nation.legitimacyBase + legitimacyDelta),
  );

  const legitimacy = resolveStat(
    'nation.legitimacy',
    legitimacyBase,
    state.activeModifiers,
    day,
    RANGES.percent,
  );

  // --- Political capital: the accrual rate and the cap ---------------------
  /*
    Recomputed monthly like every other slow-moving aggregate, then accrued
    DAILY from the stored rate (see the tick below). Two cadences for one
    quantity, and deliberately so: the rate is a function of legitimacy,
    support, stability and administration, none of which change day to day, but
    the capital itself should tick up with the calendar the way HOI4's political
    power does. (ECONOMY.md §7.17)
  */
  const census = censusOfOffices(content.offices, day);
  const administrativeCapacity = administrativeCapacityTarget({
    officesCreated: census.created,
    officesFilled: census.filled,
    officesTotal: census.total,
  });

  const accrualModelTarget = capitalAccrualTarget({
    governmentType: state.governmentType,
    legitimacy,
    stability,
    popularSupport: meanSentiment,
    eliteSupport: eliteSupport(regions),
    administrativeCapacity,
  });

  const capModelTarget = capitalCapTarget({
    governmentType: state.governmentType,
    legitimacy,
  });

  // Emergency powers multiply BOTH, which is what makes them worth having: a
  // crisis government can generate faster and hold more at once.
  const emergencyFactor = state.politicalCapital.emergency?.multiplier ?? 1;

  const accrualPerDay =
    resolveStat(
      'nation.politicalCapitalAccrual',
      accrualModelTarget,
      state.activeModifiers,
      day,
      { min: 0, max: MAX_CAPITAL_ACCRUAL },
    ) * emergencyFactor;

  const capitalCap =
    resolveStat(
      'nation.politicalCapitalCap',
      capModelTarget,
      state.activeModifiers,
      day,
      { min: 1, max: 1_000 },
    ) * emergencyFactor;

  // --- Population ----------------------------------------------------------
  const grownRegions = regions.map((region) => {
    const rate = annualGrowthRate(region.prosperity, stability);
    const growth = monthlyGrowth(rate);

    // The enslaved population grows too. Omitting this was a real modelling
    // error: because coerced participation is higher than free participation
    // (ECONOMY.md §7.3), a static enslaved population means the labour mix
    // shifts toward the lower rate every month, so output per head drifts
    // downward for no reason the player caused.
    //
    // Growing it at the same rate as the region holds the mix stable and is
    // close to the record: nationally the enslaved population rose from
    // 697,697 in 1790 to roughly 894,000 in 1800, a little slower than total
    // population. Flagged in ECONOMY.md §11 for anchoring against the 1800
    // census at state level.
    return {
      ...region,
      population: region.population * (1 + growth),
      enslavedPopulation: region.enslavedPopulation * (1 + growth),
    };
  });

  const population = grownRegions.reduce((s, r) => s + r.population, 0);
  const laborForce = grownRegions.reduce((s, r) => s + r.laborForce, 0);

  effects.push({
    kind: 'economyRecomputed',
    day,
    description: `Economy recomputed for ${yearOf(day)}`,
    refs: [],
  });

  return {
    state: {
      ...state,
      regions: grownRegions,
      nation: {
        ...state.nation,
        population,
        laborForce,
        agriculturalOutput,
        manufacturingOutput,
        tradeVolume,
        tradeCapacity,
        gdp,
        stability,
        legitimacy,
        legitimacyBase,
        sectionalTension,
        administrativeCapacity,
        modelTargets: {
          stability: stabilityModelTarget,
          sectionalTension: tensionModelTarget,
        },
      },
      politicalCapital: {
        ...state.politicalCapital,
        // The stock is NOT touched here — accrual is daily, in the tick. This
        // sets the rate and the ceiling the tick then works within, and clamps
        // the stock if the ceiling just fell beneath it.
        current: Math.min(state.politicalCapital.current, capitalCap),
        modelTargets: { accrual: accrualModelTarget, cap: capModelTarget },
        accrualPerDay,
        cap: capitalCap,
      },
      treasury: {
        ...state.treasury,
        creditRating,
        annualisedReceipts,
        annualisedOutlays,
        receiptLines,
        outlayLines,
      },
      lastEconomyRecomputeDay: day,
      series: {
        days: [...state.series.days, day],
        population: [...state.series.population, population],
        gdp: [...state.series.gdp, gdp],
        debt: [...state.series.debt, state.treasury.debtPrincipal],
        treasuryBalance: [...state.series.treasuryBalance, state.treasury.balance],
        receipts: [
          ...state.series.receipts,
          annualisedReceipts.customs +
            annualisedReceipts.excise +
            annualisedReceipts.land +
            annualisedReceipts.other,
        ],
        outlays: [...state.series.outlays, totalOutlays],
        stability: [...state.series.stability, stability],
        legitimacy: [...state.series.legitimacy, legitimacy],
        sectionalTension: [...state.series.sectionalTension, sectionalTension],
      },
    },
    effects,
  };
}

// ============================================================================
// EVENTS
// ============================================================================

/**
 * Which events fire today?
 *
 * Evaluated in content order, then by descending weight, so the outcome is
 * stable for a given state and content pack. Determinism forbids relying on
 * any incidental ordering.
 */
function findFiringEvents(state: GameState, content: ContentPack): GameEvent[] {
  const due = new Set(
    state.eventState.scheduledEvents
      .filter((s) => s.fireOnDay <= state.day)
      .map((s) => s.eventId),
  );

  const candidates = content.events.filter((event) => {
    if (event.oneShot && state.eventState.firedEventIds.includes(event.id)) {
      return false;
    }

    // A scheduled event still has to satisfy its own trigger conditions. It
    // fires on the LATER of its scheduled day and the day its conditions are
    // met. Without this a follow-on scheduled `inDays` from its parent could
    // fire before its own historical date — the Whiskey Rebellion arrived
    // twelve days early exactly this way.
    const conditionsMet =
      event.triggerConditions.length === 0 ||
      evaluateAll(event.triggerConditions, state);

    if (due.has(event.id)) return conditionsMet;

    // Unscheduled events need conditions to fire at all; an event with no
    // conditions can only arrive by being scheduled.
    if (event.triggerConditions.length === 0) return false;
    return conditionsMet;
  });

  return [...candidates].sort((a, b) => b.weight - a.weight);
}

// ============================================================================
// RESOLVING A DECISION
// ============================================================================

/**
 * Apply the player's answer to a pending decision.
 *
 * Time cannot advance while a decision is pending (see `advanceDay`), so this
 * is the only way past one. Applying an option runs its effects, records the
 * choice so later content can branch on it, and writes a chronicle entry
 * naming what was chosen — the chronicle should read as an account of the
 * player's run, not a system log.
 *
 * Throws rather than silently ignoring an unknown event or option. A typo in
 * a UI call should surface immediately, not leave the game wedged behind a
 * decision that can never be answered.
 */
export function resolveDecision(
  state: GameState,
  content: ContentPack,
  eventId: string,
  optionId: string,
): { state: GameState; effects: TickEffect[] } {
  const pending = state.eventState.pendingDecisions.find(
    (p) => p.eventId === eventId,
  );
  if (!pending) {
    throw new Error(`No pending decision for event "${eventId}"`);
  }

  const event = content.events.find((e) => e.id === eventId);
  if (!event) {
    throw new Error(`Unknown event "${eventId}" in content pack`);
  }

  const option = event.options.find((o) => o.id === optionId);
  if (!option) {
    throw new Error(
      `Unknown option "${optionId}" for event "${eventId}". ` +
        `Available: ${event.options.map((o) => o.id).join(', ')}`,
    );
  }

  if (option.requirements.length > 0 && !evaluateAll(option.requirements, state)) {
    throw new Error(
      `Option "${optionId}" of event "${eventId}" does not meet its requirements`,
    );
  }

  const applied = applyEffects(state, option.effects, {
    day: state.day,
    sourceId: eventId,
    sourceName: event.title,
  });

  const remaining = applied.state.eventState.pendingDecisions.filter(
    (p) => p.eventId !== eventId,
  );

  const next: GameState = {
    ...applied.state,
    eventState: {
      ...applied.state.eventState,
      pendingDecisions: remaining,
      chosenOptions: {
        ...applied.state.eventState.chosenOptions,
        [eventId]: optionId,
      },
    },
    // Stay paused until the player restarts time themselves. They decide when
    // the clock resumes, not the game. (UI.md §5.10)
    paused: remaining.length > 0 ? true : applied.state.paused,
    log: [
      ...applied.state.log,
      {
        id: `${state.day}:${eventId}:decision`,
        day: state.day,
        tier: 'decision',
        category: 'event',
        title: event.title,
        body: `You chose: ${option.label}`,
        relatedEventId: eventId,
      },
    ],
  };

  return { state: next, effects: applied.tickEffects };
}

// ============================================================================
// THE TICK
// ============================================================================

export function advanceDay(state: GameState, content: ContentPack): TickResult {
  // A decision blocks time entirely. The player must never be able to run past
  // an unresolved choice.
  if (state.eventState.pendingDecisions.length > 0) {
    return { state, effects: [], pauseRequested: true };
  }

  const effects: TickEffect[] = [];
  const day = state.day + 1;

  let next: GameState = { ...state, day };

  // --- Modifier expiry -----------------------------------------------------
  const { active, expired } = expireModifiers(next.activeModifiers, day);
  if (expired.length > 0) {
    next = { ...next, activeModifiers: active };
    for (const modifier of expired) {
      effects.push({
        kind: 'modifierExpired',
        day,
        description: `${modifier.source} no longer applies to ${modifier.target}`,
        refs: [modifier.id],
      });
    }
  }

  // --- Emergency powers expiry --------------------------------------------
  // Checked before accrual, so the day they lapse is the first day at the
  // ordinary rate rather than a free extra day at the crisis one. Temporary
  // powers that the game forgets to end are not temporary.
  if (next.politicalCapital.emergency !== null &&
      day >= next.politicalCapital.emergency.endsDay) {
    const lapsed = next.politicalCapital.emergency;

    next = {
      ...next,
      politicalCapital: {
        ...next.politicalCapital,
        emergency: null,
        // The rate and cap revert at the next monthly recompute; the stock is
        // clamped immediately, because holding crisis-sized reserves after the
        // crisis has passed is exactly the hoarding the cap exists to prevent.
        accrualPerDay: next.politicalCapital.modelTargets.accrual,
        cap: next.politicalCapital.modelTargets.cap,
        current: Math.min(
          next.politicalCapital.current,
          next.politicalCapital.modelTargets.cap,
        ),
      },
      log: [
        ...next.log,
        {
          id: `${day}:emergency-lapsed`,
          day,
          tier: 'info',
          category: 'system',
          title: 'Emergency powers lapse',
          body: `The extraordinary authority granted for ${lapsed.reason} expires. The government returns to ordinary means.`,
          relatedEventId: null,
        },
      ],
    };

    effects.push({
      kind: 'emergencyPowersLapsed',
      day,
      description: `Emergency powers for ${lapsed.reason} expired`,
      refs: [],
    });
  }

  // --- Daily political capital accrual -------------------------------------
  // Daily, following HOI4 rather than Democracy 4's quarterly turns: a
  // real-time clock wants a currency that moves with it. The rate itself was
  // set at the last monthly recompute. (ECONOMY.md §7.17)
  {
    const pc = next.politicalCapital;
    const accrual = accrueCapital({
      current: pc.current,
      accrualPerDay: pc.accrualPerDay,
      cap: pc.cap,
    });

    next = {
      ...next,
      politicalCapital: {
        ...pc,
        current: accrual.current,
        totalAccrued: pc.totalAccrued + accrual.accrued,
        totalWasted: pc.totalWasted + accrual.wasted,
      },
    };
  }

  // --- Daily treasury accrual ---------------------------------------------
  // Annual figures accrue at 1/daysInYear per day, using the ACTUAL length of
  // the current year. 1800 is not a leap year (see calendar.ts).
  const yearLength = daysInYear(yearOf(day));
  const r = next.treasury.annualisedReceipts;
  const o = next.treasury.annualisedOutlays;

  const receiptsToday =
    dailyAccrual(r.customs, yearLength) +
    dailyAccrual(r.excise, yearLength) +
    dailyAccrual(r.land, yearLength) +
    dailyAccrual(r.other, yearLength);

  const outlaysToday =
    dailyAccrual(o.debtService, yearLength) +
    dailyAccrual(o.military, yearLength) +
    dailyAccrual(o.civil, yearLength) +
    dailyAccrual(o.infrastructure, yearLength);

  let treasury = {
    ...next.treasury,
    balance: next.treasury.balance + receiptsToday - outlaysToday,
    receiptsYTD: {
      customs: next.treasury.receiptsYTD.customs + dailyAccrual(r.customs, yearLength),
      excise: next.treasury.receiptsYTD.excise + dailyAccrual(r.excise, yearLength),
      land: next.treasury.receiptsYTD.land + dailyAccrual(r.land, yearLength),
      other: next.treasury.receiptsYTD.other + dailyAccrual(r.other, yearLength),
    },
    outlaysYTD: {
      debtService:
        next.treasury.outlaysYTD.debtService + dailyAccrual(o.debtService, yearLength),
      military: next.treasury.outlaysYTD.military + dailyAccrual(o.military, yearLength),
      civil: next.treasury.outlaysYTD.civil + dailyAccrual(o.civil, yearLength),
      infrastructure:
        next.treasury.outlaysYTD.infrastructure +
        dailyAccrual(o.infrastructure, yearLength),
    },
  };

  // --- Deficit -------------------------------------------------------------
  if (treasury.balance < 0) {
    const result = borrow({
      shortfall: -treasury.balance,
      debtPrincipal: treasury.debtPrincipal,
      weightedRate: treasury.debtWeightedRate,
      creditRating: treasury.creditRating,
    });

    treasury = {
      ...treasury,
      balance: 0,
      debtPrincipal: result.debtPrincipal,
      debtWeightedRate: result.weightedRate,
      emergencyBorrowing: true,
    };

    effects.push({
      kind: 'borrowed',
      day,
      description: `Borrowed ${Math.round(result.borrowed).toLocaleString('en-US')} to cover a shortfall`,
      refs: [],
    });
  } else if (treasury.emergencyBorrowing) {
    treasury = { ...treasury, emergencyBorrowing: false };
  }

  next = { ...next, treasury };

  // --- Annual rollover -----------------------------------------------------
  if (isFirstOfYear(day)) {
    const ytdReceipts =
      next.treasury.receiptsYTD.customs +
      next.treasury.receiptsYTD.excise +
      next.treasury.receiptsYTD.land +
      next.treasury.receiptsYTD.other;

    const ytdOutlays =
      next.treasury.outlaysYTD.debtService +
      next.treasury.outlaysYTD.military +
      next.treasury.outlaysYTD.civil +
      next.treasury.outlaysYTD.infrastructure;

    next = {
      ...next,
      treasury: {
        ...next.treasury,
        lastYearReceipts: ytdReceipts,
        lastYearOutlays: ytdOutlays,
        receiptsYTD: { customs: 0, excise: 0, land: 0, other: 0 },
        outlaysYTD: { debtService: 0, military: 0, civil: 0, infrastructure: 0 },
      },
    };

    effects.push({
      kind: 'yearRolled',
      day,
      description: `Fiscal year ${yearOf(day) - 1} closed`,
      refs: [],
    });
  }

  // --- Congress: elections and promises coming due -------------------------
  /*
    A Congress sits two years, from 4 March of every odd year (Art. I §4 and the
    Act of 1792 fixing the term). At each new Congress the seats are re-drawn
    from the CURRENT state of the country: a region the government has alienated
    returns members who will not vote for it. That is the whole point of holding
    elections in a game where the player never leaves office — the player
    persists, but the legislature they must carry does not. (brief §2.2)
  */
  if (isCongressionalTerm(day)) {
    const previous = next.congress;
    const sentimentByRegion: Record<string, number> = {};
    for (const region of next.regions) sentimentByRegion[region.id] = region.sentiment;

    next = {
      ...next,
      congress: seatCongress({
        day,
        number: previous.number + 1,
        stateSeats: content.stateSeats,
        parties: content.parties,
        sentimentByRegion,
        previous,
      }),
      log: [
        ...next.log,
        {
          id: `${day}:congress:${previous.number + 1}`,
          day,
          tier: 'info',
          category: 'system',
          title: `The ${ordinalCongress(previous.number + 1)} Congress convenes`,
          body: describeCongress(next, previous.number + 1, content.parties, day),
          relatedEventId: null,
        },
      ],
    };

    effects.push({
      kind: 'congressElected',
      day,
      description: `The ${ordinalCongress(previous.number + 1)} Congress convenes`,
      refs: [],
    });
  }

  /*
    Promises come due. A log-roll bought votes months ago and the favour is
    called in now — paid in capital if the government has it, in standing if it
    does not. A promise with no cost is not a promise.
  */
  for (const obligation of dueObligations(next.congress, day)) {
    const affordable = obligation.cost <= next.politicalCapital.current;

    next = {
      ...next,
      politicalCapital: {
        ...next.politicalCapital,
        current: affordable
          ? next.politicalCapital.current - obligation.cost
          : next.politicalCapital.current,
        totalSpent: affordable
          ? next.politicalCapital.totalSpent + obligation.cost
          : next.politicalCapital.totalSpent,
      },
      nation: affordable
        ? next.nation
        : {
            ...next.nation,
            // A promise the government cannot keep costs more than one it can.
            legitimacyBase: Math.max(
              0,
              next.nation.legitimacyBase - UNKEPT_PROMISE_LEGITIMACY_COST,
            ),
          },
      congress: {
        ...next.congress,
        obligations: next.congress.obligations.map((o) =>
          o.id === obligation.id ? { ...o, settledDay: day } : o,
        ),
      },
      log: [
        ...next.log,
        {
          id: `${day}:obligation:${obligation.id}`,
          day,
          tier: affordable ? 'info' : 'crisis',
          category: 'legislation',
          title: affordable
            ? 'A promise is called in'
            : 'A promise cannot be kept',
          body: affordable
            ? `The support promised for ${obligation.forBillId} is asked for, and ` +
              `given. It cost ${obligation.cost.toFixed(1)} political capital.`
            : `The support promised for ${obligation.forBillId} is asked for and ` +
              'cannot be given. The government has nothing left to trade, and ' +
              'everyone now knows it.',
          relatedEventId: null,
        },
      ],
    };

    effects.push({
      kind: 'obligationSettled',
      day,
      description: affordable ? 'Obligation settled' : 'Obligation defaulted',
      refs: [obligation.id],
    });
  }

  // --- Annual succession check ---------------------------------------------
  /*
    Once a year, not daily: the mortality figures are annual, and rolling them
    daily would need a conversion that adds nothing a player can perceive.
    1 January is also when the age on screen changes.

    Runs BEFORE the monthly recompute so a succession's legitimacy cost is in
    place when the economy is recomputed on the same day, rather than lagging a
    month behind the event that caused it.
  */
  if (isFirstOfYear(day)) {
    const succession = checkSuccession(next);
    next = succession.state;
    effects.push(...succession.effects);
  }

  // --- Monthly grievance and unrest ----------------------------------------
  /*
    Monthly, with the other slow-moving aggregates. Grievance decays a little,
    regional grievance is re-derived from it, and episodes of unrest open and
    close to match. (brief §2.1, ECONOMY.md §7.19)

    Before the economy recompute, so that this month's compliance and sentiment
    already reflect this month's grievance.
  */
  if (isFirstOfMonth(day)) {
    const decayed = decayGrievance(next.grievance);
    const reconciled = reconcileUnrest(decayed, day);
    next = { ...next, grievance: reconciled.grievance };

    for (const episode of reconciled.started) {
      const region = next.regions.find((r) => r.id === episode.regionId);
      next = {
        ...next,
        log: [
          ...next.log,
          {
            id: `${day}:unrest:${episode.id}`,
            day,
            tier: episode.severity === 'resistance' ? 'info' : 'crisis',
            category: 'region',
            title: UNREST_TITLE[episode.severity](region?.name ?? episode.regionId),
            body: UNREST_BODY[episode.severity](
              region?.name ?? episode.regionId,
              episode.drivenBy.replace(/_/g, ' '),
            ),
            relatedEventId: null,
          },
        ],
      };

      effects.push({
        kind: 'unrestBegan',
        day,
        description: `${episode.severity} in ${region?.name ?? episode.regionId}`,
        refs: [episode.id],
      });
    }

    for (const episode of reconciled.ended) {
      effects.push({
        kind: 'unrestEnded',
        day,
        description: `${episode.severity} in ${episode.regionId} ended`,
        refs: [episode.id],
      });
    }
  }

  // --- Monthly economy -----------------------------------------------------
  if (isFirstOfMonth(day)) {
    const recomputed = recomputeEconomy(next, content);
    next = recomputed.state;
    effects.push(...recomputed.effects);
  }

  // --- Events --------------------------------------------------------------
  let pauseRequested = false;
  const firing = findFiringEvents(next, content);

  if (firing.length > 0) {
    const firedIds = firing.map((e) => e.id);

    next = {
      ...next,
      eventState: {
        ...next.eventState,
        firedEventIds: [...next.eventState.firedEventIds, ...firedIds],
        scheduledEvents: next.eventState.scheduledEvents.filter(
          (s) => !firedIds.includes(s.eventId),
        ),
        pendingDecisions: [
          ...next.eventState.pendingDecisions,
          ...firing
            .filter((e) => e.pausesGame)
            .map((e) => ({ eventId: e.id, firedOnDay: day })),
        ],
      },
    };

    for (const event of firing) {
      effects.push({
        kind: 'eventFired',
        day,
        description: event.title,
        refs: [event.id],
      });
      if (event.pausesGame) pauseRequested = true;
    }
  }

  if (pauseRequested) {
    next = { ...next, paused: true };
  }

  return { state: next, effects, pauseRequested };
}
