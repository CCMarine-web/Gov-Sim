/**
 * GAME CREATION
 *
 * Builds the day-0 `GameState` from region seed data and calibration
 * constants. Implements ECONOMY.md section 4.
 *
 * PURITY NOTE
 * `gameId` and `createdAtISO` are ARGUMENTS, not generated here. The engine may
 * not call `Date.now()` or `Math.random()` (DESIGN.md Rules 1 and 2), so the
 * caller in src/runtime/ supplies both. This looks like an inconvenience and is
 * actually the rule doing its job: it keeps game creation as deterministic and
 * testable as every other part of the simulation.
 */

import {
  REGION_SEEDS,
  seedEnslavedPopulation,
  seedPopulation,
} from '@/content/regions/regions1790';
/*
  The same established pattern as the region seeds above: createGame reads the
  founding data straight from content, because a new game is defined by the
  content pack it is created against. Both are pure data with no logic.
*/
import { PARTIES as partyData, STATE_SEATS as seatData } from '@/content/government/congress';
import { seedBlocs } from './blocs';
import { seatCongress } from './congress';
import { START, START_DEBT_RATE, START_TRADE_CAPACITY } from './calibration';
import {
  capitalAccrualTarget,
  capitalCapTarget,
  eliteSupport,
} from './economy/politics';
import { taxBurden } from './economy/fiscal';
import {
  computeGdp,
  computeLaborForce,
  computeRegionOutput,
  computeTradeVolume,
} from './economy/production';
import { emptyGrievance } from './grievance';
import { createRng } from './rng';
import {
  FOUNDING_PROGRAM_IDS,
  FOUNDING_TAX_IDS,
  SCHEMA_VERSION,
  type GameState,
  type GovernmentType,
  type Region,
  type SpendingProgram,
  type TaxInstance,
} from './types';

export interface NewGameOptions {
  governmentType: GovernmentType;
  rulerName: string;
  /** Dynasty name (monarchy) or party name (republic). */
  houseName: string;
  /** Seed for the deterministic PRNG. */
  seed: number;
  /** Supplied by the caller: the engine cannot generate identifiers. */
  gameId: string;
  /** Wall-clock creation time, ISO 8601. Metadata only. */
  createdAtISO: string;
  contentVersion: string;
  rulerBirthYear?: number;
}

/** "King" or "President", derived from the founding choice. */
export function titleFor(governmentType: GovernmentType): string {
  return governmentType === 'monarchy' ? 'King' : 'President';
}

/**
 * The three taxes that exist at the founding.
 *
 * Only the impost carries a rate. There was no federal excise until March 1791
 * and no federal direct tax until 1798, so those two exist at a rate of zero —
 * present so that Treasury has a line for them and an event can raise the rate,
 * rather than having to invent the tax at the same moment it sets its rate.
 *
 * `collectionEfficiency` is 1.0 for all three, and deliberately so: their
 * assessed bases in calibration.ts were solved against OBSERVED revenue, so
 * collection losses are already inside those figures. Applying a second factor
 * would double-count them. Taxes created by later bills carry their base's
 * reference efficiency, which is relative to this baseline. (ECONOMY.md §7.8)
 */
function foundingTaxes(): TaxInstance[] {
  return [
    {
      id: FOUNDING_TAX_IDS.impost,
      name: 'Impost of 1789',
      createdByBillId: null,
      base: 'imports',
      rate: START.tariffRate,
      exemptions: [
        'Goods carried in American-built and American-owned vessels paid a reduced duty',
      ],
      collectionEfficiency: 1.0,
      enactedDay: 0,
      repealedDay: null,
    },
    {
      id: FOUNDING_TAX_IDS.spirits,
      name: 'Excise on distilled spirits',
      createdByBillId: null,
      base: 'spirits',
      rate: START.exciseRate,
      exemptions: [],
      collectionEfficiency: 1.0,
      enactedDay: 0,
      repealedDay: null,
    },
    {
      id: FOUNDING_TAX_IDS.land,
      name: 'Direct tax on land',
      createdByBillId: null,
      base: 'land',
      rate: START.landTaxRate,
      exemptions: [],
      collectionEfficiency: 1.0,
      enactedDay: 0,
      repealedDay: null,
    },
  ];
}

function foundingPrograms(): SpendingProgram[] {
  return [
    {
      id: FOUNDING_PROGRAM_IDS.military,
      name: 'Army and militia',
      createdByBillId: null,
      category: 'military',
      annualAmount: START.spending.military,
      enactedDay: 0,
      repealedDay: null,
    },
    {
      id: FOUNDING_PROGRAM_IDS.civil,
      name: 'Civil establishment',
      createdByBillId: null,
      category: 'civil',
      annualAmount: START.spending.civil,
      enactedDay: 0,
      repealedDay: null,
    },
    {
      id: FOUNDING_PROGRAM_IDS.infrastructure,
      name: 'Roads, posts and lighthouses',
      createdByBillId: null,
      category: 'infrastructure',
      annualAmount: START.spending.infrastructure,
      enactedDay: 0,
      repealedDay: null,
    },
  ];
}

/**
 * Day-0 tax burden, as levies rather than three rate fields.
 *
 * Arithmetically identical to the three-field form it replaced, because the
 * excise and land rates are zero and the impost travels the tariff channel. That
 * identity is asserted by a test — the structural change must not move the
 * founding equilibrium.
 */
const FOUNDING_LEVIES: Array<{ rate: number; channel: 'tariff' | 'excise' | 'land' }> = [
  { rate: START.tariffRate, channel: 'tariff' },
  { rate: START.exciseRate, channel: 'excise' },
  { rate: START.landTaxRate, channel: 'land' },
];

export function createGame(options: NewGameOptions): GameState {
  const {
    governmentType,
    rulerName,
    houseName,
    seed,
    gameId,
    createdAtISO,
    contentVersion,
    rulerBirthYear = 1732,
  } = options;

  const tariffRate = START.tariffRate;
  const stability = START.stability;

  // --- Regions -------------------------------------------------------------
  // Built from the census seed data, then given their day-0 output. Output
  // depends on stability and tariff, both of which are known constants at
  // day 0, so this is a straight derivation rather than a simulation step.
  const regions: Region[] = REGION_SEEDS.map((seedRegion) => {
    const population = seedPopulation(seedRegion);
    const enslavedPopulation = seedEnslavedPopulation(seedRegion);
    const laborForce = computeLaborForce(population, enslavedPopulation);

    const output = computeRegionOutput({
      regionId: seedRegion.id,
      laborForce,
      stability,
      cumulativeInfrastructure: 0,
      tariffRate,
    });

    const sentiment =
      governmentType === 'monarchy'
        ? seedRegion.sentimentMonarchy
        : seedRegion.sentimentRepublic;

    return {
      id: seedRegion.id,
      name: seedRegion.name,
      states: seedRegion.states.map((s) => ({ ...s })),
      population,
      enslavedPopulation,
      laborForce,
      agriculturalOutput: output.agricultural,
      manufacturingOutput: output.manufacturing,
      // Trade is allocated by share of national output, since ports serve
      // their hinterland. Assigned below, once national totals are known.
      tradeVolume: 0,
      prosperity: seedRegion.prosperity,
      prosperityTrend: 0,
      sentiment,
      compliance: 85,
      dominantIndustry: seedRegion.dominantIndustry,
      tariffExposure: seedRegion.tariffExposure,
      exciseExposure: seedRegion.exciseExposure,
      landExposure: seedRegion.landExposure,
      baselineOutputPerCapita: 0,
      // Day-0 equilibrium. The seeded prosperity and sentiment already reflect
      // the tariff that existed in 1789, so the founding tax burden is recorded
      // as neutral and the model responds to changes from it.
      baseProsperity: seedRegion.prosperity,
      baseSentiment: sentiment,
      // Day 0 is an equilibrium by construction, so the targets equal the
      // starting values until the first monthly recompute.
      modelTargets: {
        prosperity: seedRegion.prosperity,
        sentiment,
        compliance: 85,
      },
      baselineTaxBurden: taxBurden({
        levies: FOUNDING_LEVIES,
        tariffExposure: seedRegion.tariffExposure,
        exciseExposure: seedRegion.exciseExposure,
        landExposure: seedRegion.landExposure,
      }),
    };
  });

  // --- National aggregates -------------------------------------------------
  const population = regions.reduce((sum, r) => sum + r.population, 0);
  const laborForce = regions.reduce((sum, r) => sum + r.laborForce, 0);
  const agriculturalOutput = regions.reduce(
    (sum, r) => sum + r.agriculturalOutput,
    0,
  );
  const manufacturingOutput = regions.reduce(
    (sum, r) => sum + r.manufacturingOutput,
    0,
  );

  const tradeVolume = computeTradeVolume(START_TRADE_CAPACITY, tariffRate);
  const totalOutput = agriculturalOutput + manufacturingOutput;

  for (const region of regions) {
    const regionOutput = region.agriculturalOutput + region.manufacturingOutput;
    const share = totalOutput > 0 ? regionOutput / totalOutput : 0;
    region.tradeVolume = tradeVolume * share;
    region.baselineOutputPerCapita =
      region.population > 0 ? regionOutput / region.population : 0;
  }

  const debtService = START.debt * START_DEBT_RATE;
  const federalOutlays =
    debtService +
    START.spending.military +
    START.spending.civil +
    START.spending.infrastructure;

  const gdp = computeGdp({
    agriculturalOutput,
    manufacturingOutput,
    tradeVolume,
    federalOutlays,
  });

  const legitimacy =
    governmentType === 'monarchy'
      ? START.legitimacy.monarchy
      : START.legitimacy.republic;

  /*
    Day-0 political capital rate and ceiling, from the same formulas the monthly
    recompute uses. Derived rather than seeded, so the founding position cannot
    drift away from what the model would compute for it — the same discipline
    the tax burden gets above.

    Administrative capacity is 0: the executive departments did not exist on
    30 April 1789. That is not a placeholder, it is the date.
  */
  const meanSentimentAtFounding =
    regions.reduce((sum, r) => sum + r.sentiment, 0) / (regions.length || 1);

  const startingAccrual = capitalAccrualTarget({
    governmentType,
    legitimacy,
    stability,
    popularSupport: meanSentimentAtFounding,
    eliteSupport: eliteSupport(regions),
    administrativeCapacity: 0,
  });

  const startingCap = capitalCapTarget({ governmentType, legitimacy });

  /*
    WHO THE COUNTRY IS MADE OF, at the founding. Overlapping shares of each
    region, and the day-0 economy every later target is measured against — so
    the founding is an equilibrium the bloc model sits still in rather than a
    point it immediately slides away from. (ECONOMY.md §7.21)
  */
  const blocs = seedBlocs(regions);

  return {
    schemaVersion: SCHEMA_VERSION,
    gameId,
    createdAtISO,
    contentVersion,

    rng: createRng(seed),

    day: 0,

    governmentType,
    ruler: {
      name: rulerName,
      houseName,
      title: titleFor(governmentType),
      birthYear: rulerBirthYear,
      /*
        A monarchy founded today has an obvious successor; a republic does not
        have heirs at all. Without this every succession would be a crisis
        regardless of how the country had been governed, which is a punishment
        rather than a mechanic. (docs/DECISIONS.md D-028)
      */
      heirName:
        governmentType === 'monarchy' ? `The heir of ${rulerName}` : null,
      reignNumber: 0,
      accededDay: 0,
      portraitId: null,
    },

    nation: {
      population,
      laborForce,
      agriculturalOutput,
      manufacturingOutput,
      tradeVolume,
      tradeCapacity: START_TRADE_CAPACITY,
      gdp,
      stability,
      legitimacy,
      legitimacyBase: legitimacy,
      sectionalTension: START.sectionalTension,
      /*
        Zero, and correct. On 30 April 1789 there was a President, a Congress
        and essentially no administration: State was created on 27 July, War on
        7 August, the Treasury not until 2 September. The player begins holding
        an office in a government that does not yet exist, and it climbs from
        here as the machinery is built. Computed from the office record at the
        first monthly recompute. (ECONOMY.md §7.17)
      */
      administrativeCapacity: 0,
      // Day 0 is an equilibrium by construction, so the model targets equal
      // the starting values until the first monthly recompute.
      modelTargets: {
        stability,
        sectionalTension: START.sectionalTension,
      },
    },

    regions,

    treasury: {
      balance: START.treasuryBalance,
      debtPrincipal: START.debt,
      debtWeightedRate: START_DEBT_RATE,
      creditRating: START.creditRating,
      emergencyBorrowing: false,
      missedPayments: 0,
      receiptsYTD: { customs: 0, excise: 0, land: 0, other: 0 },
      outlaysYTD: { debtService: 0, military: 0, civil: 0, infrastructure: 0 },
      annualisedReceipts: { customs: 0, excise: 0, land: 0, other: 0 },
      annualisedOutlays: {
        debtService,
        military: START.spending.military,
        civil: START.spending.civil,
        infrastructure: START.spending.infrastructure,
      },
      /*
        Empty until the first monthly recompute on day 1, which is the same
        treatment `annualisedReceipts` already gets. Day 0 is 30 April 1789 and
        the Treasury Department did not exist until 2 September — starting with
        no collected revenue is both defensible and dramatically correct.
      */
      receiptLines: [],
      outlayLines: [],
      lastYearReceipts: 0,
      lastYearOutlays: 0,
    },

    policies: {
      taxes: foundingTaxes(),
      programs: foundingPrograms(),
      bills: [],
      cumulativeInfrastructure: 0,
    },

    /*
      POLITICAL CAPITAL AT THE FOUNDING.

      The rate and cap are DERIVED here rather than left at zero for the first
      monthly recompute to fill in, because a government that can neither act
      nor accrue for its first thirty-one days is not a playable starting
      position — and because every input the formula needs is already known at
      day 0. Administrative capacity is genuinely zero: the departments do not
      exist yet, which is a fact about 30 April 1789 rather than a placeholder.

      The stock starts at START.politicalCapital: enough for one substantial
      first budget, not enough to make the founding free.
    */
    politicalCapital: {
      current: START.politicalCapital,
      modelTargets: {
        accrual: startingAccrual,
        cap: startingCap,
      },
      accrualPerDay: startingAccrual,
      cap: startingCap,
      emergency: null,
      totalAccrued: 0,
      totalSpent: 0,
      totalWasted: 0,
    },

    /*
      A country with nothing yet held against it. Every grievance in a run is
      something the player did. (brief §2.1)
    */
    grievance: emptyGrievance(),

    /*
      THE FIRST CONGRESS, seated as it was on 4 March 1789 — eleven states, 59
      House seats of the 65 the Constitution allotted, because North Carolina
      and Rhode Island had not yet ratified. They join in November 1789 and May
      1790, and the seats appear when they do.

      Party shares are derived from each region's economic character and its
      day-0 sentiment. They are a MODEL, not a record: this project has not
      sourced a state-by-state party breakdown, and inventing one would dress a
      model up as history. (ECONOMY.md §7.20, BLOCKERS.md B-006)
    */
    congress: seatCongress({
      day: 0,
      number: 1,
      stateSeats: seatData,
      parties: partyData,
      sentimentByRegion: Object.fromEntries(
        regions.map((r) => [r.id, r.sentiment]),
      ),
      membershipByRegion: blocs.membership,
    }),
    blocs,

    activeModifiers: [],

    eventState: {
      firedEventIds: [],
      chosenOptions: {},
      pendingDecisions: [],
      scheduledEvents: [],
    },

    flags: {},

    log: [
      {
        id: 'founding',
        day: 0,
        tier: 'enactment',
        category: 'system',
        title: 'The United States is founded',
        body:
          governmentType === 'monarchy'
            ? `${rulerName} of the House of ${houseName} assumes the crown of the United States.`
            : `${rulerName} takes the oath of office as President of the United States.`,
        relatedEventId: null,
      },
    ],

    series: {
      days: [0],
      population: [population],
      gdp: [gdp],
      debt: [START.debt],
      treasuryBalance: [START.treasuryBalance],
      receipts: [0],
      outlays: [federalOutlays],
      stability: [stability],
      legitimacy: [legitimacy],
      sectionalTension: [START.sectionalTension],
    },

    lastEconomyRecomputeDay: 0,
    paused: false,
  };
}

/** Convenience for tests and fixtures: a republic with fixed identifiers. */
export function createTestGame(
  overrides: Partial<NewGameOptions> = {},
): GameState {
  return createGame({
    governmentType: 'republic',
    rulerName: 'George Washington',
    houseName: 'Federalist',
    seed: 20260815,
    gameId: 'test-game',
    createdAtISO: '1789-04-30T00:00:00.000Z',
    contentVersion: 'test',
    ...overrides,
  });
}
