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
  daysInYear,
  isFirstOfMonth,
  isFirstOfYear,
  yearOf,
} from './calendar';
import { RANGES, TAU_MONTHS } from './calibration';
import { evaluateAll } from './conditions';
import {
  borrow,
  complianceTarget,
  computeDebtService,
  computeExciseRevenue,
  computeLandRevenue,
  creditTarget,
  dailyAccrual,
  taxBurden,
} from './economy/fiscal';
import {
  computeCustomsRevenue,
  computeGdp,
  computeLaborForce,
  computeRegionOutput,
  computeTradeVolume,
  infrastructureBonus,
} from './economy/production';
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
  Region,
  TickEffect,
  TickResult,
} from './types';

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
export function recomputeEconomy(state: GameState): {
  state: GameState;
  effects: TickEffect[];
} {
  const effects: TickEffect[] = [];
  const { taxRates, spending } = state.policies;
  const day = state.day;

  const infraBonus = infrastructureBonus(state.policies.cumulativeInfrastructure);

  // --- Regions -------------------------------------------------------------
  const regions: Region[] = state.regions.map((region) => {
    const laborForce = computeLaborForce(region.population, region.enslavedPopulation);

    const output = computeRegionOutput({
      regionId: region.id,
      laborForce,
      stability: state.nation.stability,
      cumulativeInfrastructure: state.policies.cumulativeInfrastructure,
      tariffRate: taxRates.tariffAvg,
    });

    const burden = taxBurden({
      tariffRate: taxRates.tariffAvg,
      exciseRate: taxRates.excise,
      landTaxRate: taxRates.landTax,
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
    const sentimentGoal = resolveStat(
      `region.${region.id}.sentiment`,
      sentimentTarget({
        baseSentiment: region.baseSentiment,
        taxBurden: burden,
        baselineTaxBurden: region.baselineTaxBurden,
        prosperity,
        baseProsperity: region.baseProsperity,
        prosperityTrend,
        governmentAffinity: 0,
      }),
      state.activeModifiers,
      day,
      RANGES.sentiment,
    );

    const sentiment = lagToward(region.sentiment, sentimentGoal, TAU_MONTHS.sentiment);

    // Compliance: the loop that makes a tax worth only what people pay.
    const compliance = lagToward(
      region.compliance,
      complianceTarget({ sentiment, legitimacy: state.nation.legitimacy }),
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

  const tradeVolume = computeTradeVolume(tradeCapacity, taxRates.tariffAvg);

  for (const region of regions) {
    const share =
      totalOutput > 0
        ? (region.agriculturalOutput + region.manufacturingOutput) / totalOutput
        : 0;
    region.tradeVolume = tradeVolume * share;
  }

  // --- Receipts ------------------------------------------------------------
  const customs = computeCustomsRevenue(tradeVolume, taxRates.tariffAvg);
  const excise = regions.reduce(
    (s, r) => s + computeExciseRevenue(r.id, taxRates.excise, r.compliance),
    0,
  );
  const land = regions.reduce(
    (s, r) => s + computeLandRevenue(r.id, taxRates.landTax, r.compliance),
    0,
  );

  const annualisedReceipts = { customs, excise, land, other: OTHER_RECEIPTS };

  // --- Outlays -------------------------------------------------------------
  // Debt service is non-discretionary and is computed first.
  const debtService = computeDebtService(
    state.treasury.debtPrincipal,
    state.treasury.debtWeightedRate,
  );

  const annualisedOutlays = {
    debtService,
    military: spending.military,
    civil: spending.civil,
    infrastructure: spending.infrastructure,
  };

  const totalOutlays =
    debtService + spending.military + spending.civil + spending.infrastructure;

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
  const sectionalTension = lagToward(
    state.nation.sectionalTension,
    resolveStat(
      'nation.sectionalTension',
      tensionTarget({
        sentiments: regions.map((r) => r.sentiment),
        prosperities: regions.map((r) => r.prosperity),
        slaveryTension: numericFlag(state, 'slavery_tension'),
      }),
      state.activeModifiers,
      day,
      RANGES.percent,
    ),
    TAU_MONTHS.sentiment,
  );

  const meanSentiment =
    regions.reduce((s, r) => s + r.sentiment, 0) / (regions.length || 1);

  const stability = lagToward(
    state.nation.stability,
    resolveStat(
      'nation.stability',
      stabilityTarget({
        meanSentiment,
        sectionalTension,
        legitimacy: state.nation.legitimacy,
      }),
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

  const legitimacy = Math.min(
    100,
    Math.max(
      0,
      resolveStat(
        'nation.legitimacy',
        state.nation.legitimacy + legitimacyDelta,
        state.activeModifiers,
        day,
        RANGES.percent,
      ),
    ),
  );

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
        sectionalTension,
      },
      treasury: {
        ...state.treasury,
        creditRating,
        annualisedReceipts,
        annualisedOutlays,
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
          customs + excise + land + OTHER_RECEIPTS,
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
    if (due.has(event.id)) return true;
    if (event.triggerConditions.length === 0) return false;
    return evaluateAll(event.triggerConditions, state);
  });

  return [...candidates].sort((a, b) => b.weight - a.weight);
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

  // --- Monthly economy -----------------------------------------------------
  if (isFirstOfMonth(day)) {
    const recomputed = recomputeEconomy(next);
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
