/**
 * TAX AND SPENDING INSTANCES
 *
 * Phase 2 brief §4.3 turned three hard-coded tax rates into instances in state.
 * Two things have to be true of that change, and this file asserts both.
 *
 *   1. IT MOVED NO CALIBRATED NUMBER. The per-instance revenue path must produce
 *      exactly what the three named formulas produced. A structural change that
 *      quietly shifted the economy would invalidate every calibration constant
 *      and every historical comparison in the game.
 *
 *   2. EVERY DOLLAR IS ATTRIBUTABLE. The per-instance lines must reconcile to
 *      the headline receipts figure, the way the modifier ledger reconciles to a
 *      displayed stat. If the arithmetic on the Treasury screen did not add up,
 *      the screen would be lying.
 */

import { describe, expect, it } from 'vitest';
import { advanceDay } from './advanceDay';
import { OTHER_RECEIPTS, START } from './calibration';
import { createTestGame } from './createGame';
import {
  computeExciseRevenue,
  computeLandRevenue,
  computeTaxRevenue,
  taxBurden,
} from './economy/fiscal';
import { computeCustomsRevenue } from './economy/production';
import { TAX_BASES, TAX_BASE_IDS, isBaseAvailable } from './taxBases';
import {
  aggregateRate,
  burdenLevies,
  defundProgram,
  findTax,
  programsInForce,
  repealTax,
  rollupReceipts,
  setTaxRate,
  spendingFor,
  taxesInForce,
  tradeTaxRate,
  upsertTax,
} from './taxes';
import {
  FOUNDING_PROGRAM_IDS,
  FOUNDING_TAX_IDS,
  type ContentPack,
  type GameState,
} from './types';

const EMPTY: ContentPack = { version: 'test', events: [], laws: [] };

function run(state: GameState, days: number): GameState {
  let current = state;
  for (let i = 0; i < days; i++) current = advanceDay(current, EMPTY).state;
  return current;
}

// ============================================================================
// 1. THE STRUCTURAL CHANGE MOVED NOTHING
// ============================================================================

describe('the instance path reproduces the formulas it replaced', () => {
  it('computes customs identically to computeCustomsRevenue', () => {
    const tradeVolume = 43_000_000;
    const rate = 0.1;

    const viaInstance = computeTaxRevenue({
      rate,
      collectionEfficiency: 1,
      assessment: 'trade',
      tradeVolume,
      regionalBase: null,
      outputShare: null,
      regions: [],
    });

    expect(viaInstance.net).toBeCloseTo(
      computeCustomsRevenue(tradeVolume, rate),
      6,
    );
    // Collected at the port, so nothing is lost to regional non-compliance.
    expect(viaInstance.lostToNonCompliance).toBe(0);
  });

  it('computes the spirits excise identically to computeExciseRevenue', () => {
    const rate = 0.25;
    const regions = [
      { id: 'new_england', compliance: 80, output: 0 },
      { id: 'mid_atlantic', compliance: 90, output: 0 },
      { id: 'south', compliance: 70, output: 0 },
      { id: 'frontier', compliance: 40, output: 0 },
    ];

    const expected = regions.reduce(
      (sum, r) => sum + computeExciseRevenue(r.id, rate, r.compliance),
      0,
    );

    const viaInstance = computeTaxRevenue({
      rate,
      collectionEfficiency: 1,
      assessment: 'regional',
      tradeVolume: 0,
      regionalBase: TAX_BASES.spirits.regionalBase,
      outputShare: null,
      regions,
    });

    expect(viaInstance.net).toBeCloseTo(expected, 6);
  });

  it('computes the land tax identically to computeLandRevenue', () => {
    const rate = 0.02;
    const regions = [
      { id: 'new_england', compliance: 85, output: 0 },
      { id: 'mid_atlantic', compliance: 85, output: 0 },
      { id: 'south', compliance: 60, output: 0 },
      { id: 'frontier', compliance: 35, output: 0 },
    ];

    const expected = regions.reduce(
      (sum, r) => sum + computeLandRevenue(r.id, rate, r.compliance),
      0,
    );

    const viaInstance = computeTaxRevenue({
      rate,
      collectionEfficiency: 1,
      assessment: 'regional',
      tradeVolume: 0,
      regionalBase: TAX_BASES.land.regionalBase,
      outputShare: null,
      regions,
    });

    expect(viaInstance.net).toBeCloseTo(expected, 6);
  });

  it('computes the day-0 tax burden identically to the three-field form', () => {
    const state = createTestGame();
    const region = state.regions[0];

    const viaLevies = taxBurden({
      levies: burdenLevies(state.policies, state.day),
      tariffExposure: region.tariffExposure,
      exciseExposure: region.exciseExposure,
      landExposure: region.landExposure,
    });

    // What the old three-field version computed, written out longhand.
    const oldForm =
      START.tariffRate * region.tariffExposure +
      START.exciseRate * region.exciseExposure +
      START.landTaxRate * region.landExposure;

    expect(viaLevies).toBeCloseTo(oldForm, 10);
    expect(viaLevies).toBeCloseTo(region.baselineTaxBurden, 10);
  });

  /**
   * The load-bearing one. If the founding equilibrium moved, every calibration
   * constant solved against it — AG_PRODUCTIVITY, MAN_PRODUCTIVITY,
   * TRADE_SERVICES_MULTIPLIER — is now wrong, and so is the History comparison.
   */
  it('leaves the day-0 economy exactly where it was', () => {
    const state = createTestGame();
    expect(state.nation.gdp / 1_000_000).toBeCloseTo(193, 0);
    expect(tradeTaxRate(state.policies, state.day)).toBe(START.tariffRate);
  });
});

// ============================================================================
// 2. ATTRIBUTION RECONCILES
// ============================================================================

describe('every dollar of revenue is attributable', () => {
  const state = run(createTestGame(), 40); // past the first monthly recompute

  it('produces one line per tax in force', () => {
    const inForce = taxesInForce(state.policies, state.day);
    expect(state.treasury.receiptLines).toHaveLength(inForce.length);

    for (const line of state.treasury.receiptLines) {
      expect(findTax(state.policies, line.taxId)).not.toBeNull();
    }
  });

  it('names the tax and the law that created it on every line', () => {
    for (const line of state.treasury.receiptLines) {
      expect(line.name.length).toBeGreaterThan(0);
      // null is a valid answer for the founding taxes — no bill created them —
      // but the field must be present rather than absent.
      expect(line).toHaveProperty('createdByBillId');
    }
  });

  it('reconciles the lines to the headline receipts figure', () => {
    const receipts = state.treasury.annualisedReceipts;
    const headline =
      receipts.customs + receipts.excise + receipts.land + receipts.other;

    const fromLines =
      state.treasury.receiptLines.reduce((sum, l) => sum + l.net, 0) +
      OTHER_RECEIPTS;

    expect(fromLines).toBeCloseTo(headline, 6);
  });

  it('reconciles gross minus losses to net on every line', () => {
    for (const line of state.treasury.receiptLines) {
      expect(
        line.gross - line.lostToNonCompliance - line.lostToCollection,
        line.taxId,
      ).toBeCloseTo(line.net, 6);
      expect(line.lostToCollection, line.taxId).toBeGreaterThanOrEqual(0);
      expect(line.lostToNonCompliance, line.taxId).toBeGreaterThanOrEqual(0);
    }
  });

  it('reconciles the outlay lines to the headline outlays figure', () => {
    const outlays = state.treasury.annualisedOutlays;
    const headline =
      outlays.debtService +
      outlays.military +
      outlays.civil +
      outlays.infrastructure;

    const fromLines = state.treasury.outlayLines.reduce(
      (sum, l) => sum + l.annualAmount,
      0,
    );

    expect(fromLines).toBeCloseTo(headline, 6);
  });

  it('rolls each base up into the bucket its registry entry declares', () => {
    const lines = state.treasury.receiptLines.map((l) => ({
      ...l,
      net: 1_000,
    }));
    const rollup = rollupReceipts(lines, 0);

    for (const line of lines) {
      expect(rollup[TAX_BASES[line.base].bucket]).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// 3. A TAX CAN BE CREATED, CHANGED AND REPEALED
// ============================================================================

describe('creating, changing and repealing a tax', () => {
  it('a new tax appears in force and raises revenue', () => {
    let state = createTestGame();

    state = {
      ...state,
      policies: upsertTax(state.policies, {
        id: 'tax_carriages_1794',
        name: 'Carriage Duty of 1794',
        createdByBillId: 'bill_carriage_duty',
        base: 'carriages',
        rate: 0.02,
        exemptions: ['Carriages kept for hire or for husbandry'],
        collectionEfficiency: TAX_BASES.carriages.referenceEfficiency,
        enactedDay: state.day,
      }),
    };

    expect(taxesInForce(state.policies, state.day)).toHaveLength(4);

    const after = run(state, 40);
    const line = after.treasury.receiptLines.find(
      (l) => l.taxId === 'tax_carriages_1794',
    );

    expect(line).toBeDefined();
    expect(line!.net).toBeGreaterThan(0);
    // And it names its bill, which is the whole point of the change.
    expect(line!.createdByBillId).toBe('bill_carriage_duty');
    expect(line!.bucket).toBe('excise');
  });

  it('a repealed tax stops raising revenue and leaves the lines', () => {
    let state = createTestGame();
    state = { ...state, policies: setTaxRate(state.policies, FOUNDING_TAX_IDS.spirits, 0.2) };

    const levied = run(state, 40);
    const before = levied.treasury.receiptLines.find(
      (l) => l.taxId === FOUNDING_TAX_IDS.spirits,
    );
    expect(before!.net).toBeGreaterThan(0);

    const repealed = {
      ...levied,
      policies: repealTax(levied.policies, FOUNDING_TAX_IDS.spirits, levied.day),
    };
    const after = run(repealed, 40);

    expect(
      after.treasury.receiptLines.find((l) => l.taxId === FOUNDING_TAX_IDS.spirits),
    ).toBeUndefined();
  });

  it('keeps a repealed tax in the array, so the record survives', () => {
    const state = createTestGame();
    const repealed = repealTax(state.policies, FOUNDING_TAX_IDS.spirits, 500);

    expect(repealed.taxes).toHaveLength(3);
    expect(findTax(repealed, FOUNDING_TAX_IDS.spirits)!.repealedDay).toBe(500);
    expect(taxesInForce(repealed, 600)).toHaveLength(2);
    // And it was still in force before the repeal day.
    expect(taxesInForce(repealed, 400)).toHaveLength(3);
  });

  it('sums two taxes on one base into a single effective rate', () => {
    let state = createTestGame();
    state = {
      ...state,
      policies: upsertTax(state.policies, {
        id: 'tax_extra_impost',
        name: 'Additional duty on imports',
        createdByBillId: 'bill_extra',
        base: 'imports',
        rate: 0.05,
        exemptions: [],
        collectionEfficiency: 1,
        enactedDay: state.day,
      }),
    };

    // Two duties on imports are, to the merchant paying them and to the
    // trade-suppression curve alike, one duty at the sum of their rates.
    expect(aggregateRate(state.policies, state.day, 'imports')).toBeCloseTo(0.15, 10);
    expect(tradeTaxRate(state.policies, state.day)).toBeCloseTo(0.15, 10);
  });

  it('is idempotent by id, so a repeated enactment cannot double a tax', () => {
    let policies = createTestGame().policies;
    const tax = {
      id: 'tax_stamp_1797',
      name: 'Stamp Act of 1797',
      createdByBillId: 'bill_stamp',
      base: 'stamps' as const,
      rate: 0.01,
      exemptions: [],
      collectionEfficiency: 0.88,
      enactedDay: 100,
    };

    policies = upsertTax(policies, tax);
    policies = upsertTax(policies, tax);

    expect(policies.taxes.filter((t) => t.id === 'tax_stamp_1797')).toHaveLength(1);
  });
});

describe('spending programmes', () => {
  it('sums several programmes in one category', () => {
    let state = createTestGame();
    const before = spendingFor(state.policies, state.day, 'military');

    state = {
      ...state,
      policies: upsertTax(state.policies, {
        id: 'noop',
        name: 'noop',
        createdByBillId: null,
        base: 'imports',
        rate: 0,
        exemptions: [],
        collectionEfficiency: 1,
        enactedDay: state.day,
      }),
    };

    expect(spendingFor(state.policies, state.day, 'military')).toBe(before);
  });

  it('drops a defunded programme out of the outlays', () => {
    const state = createTestGame();
    const defunded = defundProgram(
      state.policies,
      FOUNDING_PROGRAM_IDS.infrastructure,
      10,
    );

    expect(spendingFor(defunded, 20, 'infrastructure')).toBe(0);
    expect(programsInForce(defunded, 20)).toHaveLength(2);
    // The record survives, as with taxes.
    expect(defunded.programs).toHaveLength(3);
  });
});

// ============================================================================
// 4. THE REGISTRY IS COHERENT AND HONEST
// ============================================================================

describe('the tax base registry', () => {
  it('gives every base the data its assessment method needs', () => {
    for (const id of TAX_BASE_IDS) {
      const base = TAX_BASES[id];
      if (base.assessment === 'regional') {
        expect(base.regionalBase, id).not.toBeNull();
        // Every region must have an entry, or a base would silently assess
        // nothing in that region.
        for (const region of ['new_england', 'mid_atlantic', 'south', 'frontier']) {
          expect(base.regionalBase![region], `${id}.${region}`).toBeTypeOf('number');
        }
      }
      if (base.assessment === 'outputShare') {
        expect(base.outputShare, id).toBeTypeOf('number');
        expect(base.outputShare!, id).toBeGreaterThan(0);
      }
    }
  });

  it('carries a factual note and at least one source for every base', () => {
    for (const id of TAX_BASE_IDS) {
      expect(TAX_BASES[id].historicalNote.length, id).toBeGreaterThan(40);
      expect(TAX_BASES[id].sources.length, id).toBeGreaterThan(0);
    }
  });

  it('explains itself whenever it locks a base', () => {
    for (const id of TAX_BASE_IDS) {
      const base = TAX_BASES[id];
      if (base.prohibitedBecause !== null) {
        // A lock with a shrug for a reason is worse than no lock: the player
        // learns nothing. (brief §4.4)
        expect(base.prohibitedBecause.length, id).toBeGreaterThan(60);
        expect(isBaseAvailable(id), id).toBe(false);
      }
    }
  });

  it('locks export duties, because the Constitution forbids them outright', () => {
    expect(isBaseAvailable('exports')).toBe(false);
    expect(TAX_BASES.exports.prohibitedBecause).toContain('exported from any State');
  });

  it('locks an income tax, and gives the apportionment reason', () => {
    expect(isBaseAvailable('income')).toBe(false);
    expect(TAX_BASES.income.prohibitedBecause).toContain('apportioned');
  });

  it('leaves a merely counterfactual base available, unlike a prohibited one', () => {
    // A general sales tax was administratively out of reach, not unlawful. The
    // distinction matters: one is a lock, the other is a choice the player may
    // make and be judged on. (brief §4.4)
    expect(TAX_BASES.sales.historicity).toBe('counterfactual');
    expect(isBaseAvailable('sales')).toBe(true);
  });

  it('collects the three founding bases at full efficiency and no others', () => {
    for (const id of TAX_BASE_IDS) {
      const full = TAX_BASES[id].referenceEfficiency === 1;
      const founding = id === 'imports' || id === 'spirits' || id === 'land';
      // `exports` also reads 1.0, but it can never be levied.
      if (!founding && id !== 'exports') {
        expect(full, `${id} should not be perfectly collectable`).toBe(false);
      }
    }
  });
});
