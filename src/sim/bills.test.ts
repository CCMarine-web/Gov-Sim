/**
 * BILLS
 *
 * Phase 2 brief §4. Four things the design promises, each of which a test
 * should be able to falsify:
 *
 *   1. The slate meets the brief's floor — at least 25 bills across at least six
 *      departments, spanning enacted, proposed and counterfactual — and every
 *      bill on every tier carries factual context and sources.
 *   2. A bill that creates a tax produces a Treasury line attributed to it, and
 *      repealing the bill takes the line with it. This is the join between item
 *      5 and item 4.3, and the requirement the author stated most plainly.
 *   3. Effects phase in rather than landing whole on the day of signature, and
 *      the ledger still reconciles while they do.
 *   4. A bill that cannot be passed says why — with a real reason, not a shrug.
 */

import { describe, expect, it } from 'vitest';
import { PHASE_1_CONTENT } from '@/content';
import { advanceDay } from './advanceDay';
import {
  amendBill,
  amendCost,
  billModifiers,
  billStatus,
  blocSentimentShifts,
  enactBill,
  introduceCost,
  isInForce,
  repealBill,
  treasuryCost,
  validateBill,
} from './bills';
import { BLOC_REGION_WEIGHTS } from './calibration';
import { isoToDay } from './calendar';
import { createTestGame } from './createGame';
import { explainStat } from './modifiers';
import { taxesInForce } from './taxes';
import {
  BLOC_IDS,
  DEPARTMENTS,
  type Bill,
  type ContentPack,
  type GameState,
} from './types';

const BILLS = PHASE_1_CONTENT.bills;
const EMPTY: ContentPack = { version: 'test', events: [], bills: [], offices: [], parties: [], stateSeats: [] };

function run(state: GameState, days: number): GameState {
  let current = state;
  for (let i = 0; i < days; i++) current = advanceDay(current, EMPTY).state;
  return current;
}

/** A state with capital and a date, so a bill's availability is the only gate. */
function ready(billId: string, extraCapital = 500): GameState {
  const bill = BILLS.find((b) => b.id === billId)!;
  const base = createTestGame();
  const day = Math.max(base.day, isoToDay(bill.availableFrom));

  return {
    ...base,
    day,
    politicalCapital: {
      ...base.politicalCapital,
      current: extraCapital,
      cap: extraCapital,
    },
  };
}

function billById(id: string): Bill {
  return BILLS.find((b) => b.id === id)!;
}

// ============================================================================
// 1. THE SLATE
// ============================================================================

describe('the bill slate meets the brief', () => {
  it('offers at least 25 bills', () => {
    expect(BILLS.length).toBeGreaterThanOrEqual(25);
  });

  it('spans at least six departments', () => {
    const departments = new Set(BILLS.map((b) => b.category));
    expect(departments.size).toBeGreaterThanOrEqual(6);
  });

  it('includes enacted, proposed and counterfactual bills', () => {
    const tiers = new Set(BILLS.map((b) => b.historicity));
    for (const tier of ['enacted', 'proposed', 'counterfactual'] as const) {
      expect(tiers.has(tier), `no ${tier} bill in the slate`).toBe(true);
    }
  });

  it('includes at least one anachronistic bill, locked with a real reason', () => {
    const locked = BILLS.filter((b) => b.historicity === 'anachronistic');
    expect(locked.length).toBeGreaterThan(0);

    for (const bill of locked) {
      // A lock with a shrug for a reason teaches the player nothing, which is
      // the one thing a locked bill must not do. (brief §4.4)
      expect(bill.lockedBecause, bill.id).not.toBeNull();
      expect(bill.lockedBecause!.length, bill.id).toBeGreaterThan(80);
    }
  });

  it('validates structurally, every one of them', () => {
    for (const bill of BILLS) {
      expect(validateBill(bill), bill.id).toEqual([]);
    }
  });

  it('gives every bill on every tier factual context and sources', () => {
    for (const bill of BILLS) {
      expect(bill.historicalNote.length, bill.id).toBeGreaterThan(120);
      expect(bill.sources.length, bill.id).toBeGreaterThan(0);
      for (const source of bill.sources) {
        expect(source.trim().length, `${bill.id}: ${source}`).toBeGreaterThan(10);
      }
    }
  });

  it('uses a known department for every bill', () => {
    for (const bill of BILLS) {
      expect(DEPARTMENTS, bill.id).toContain(bill.category);
    }
  });

  it('names only known blocs', () => {
    for (const bill of BILLS) {
      for (const reaction of bill.blocReactions) {
        expect(BLOC_IDS, `${bill.id} -> ${reaction.bloc}`).toContain(reaction.bloc);
      }
    }
  });

  it('has unique ids', () => {
    const ids = BILLS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('creates no two taxes or programmes with the same id', () => {
    const taxIds = BILLS.map((b) => b.createsTax?.taxId).filter(Boolean);
    const programIds = BILLS.map((b) => b.createsProgram?.programId).filter(Boolean);
    expect(new Set(taxIds).size).toBe(taxIds.length);
    expect(new Set(programIds).size).toBe(programIds.length);
  });

  it('resolves every prerequisite naming another bill', () => {
    const ids = new Set(BILLS.map((b) => b.id));
    for (const bill of BILLS) {
      for (const condition of bill.prerequisites) {
        if (condition.kind === 'billEnacted') {
          expect(ids.has(condition.billId), `${bill.id} -> ${condition.billId}`).toBe(
            true,
          );
        }
      }
    }
  });

  it('dates every enacted bill inside the period it claims', () => {
    for (const bill of BILLS) {
      if (bill.historicity !== 'enacted') continue;
      const from = isoToDay(bill.availableFrom);
      expect(from, `${bill.id} (${bill.availableFrom})`).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives every bill a phase-in, because no statute lands whole', () => {
    for (const bill of BILLS) {
      if (bill.historicity === 'anachronistic') continue;
      expect(bill.phaseInDays, bill.id).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// 2. A BILL CREATES A TREASURY LINE
// ============================================================================

describe('a bill that lays a tax produces a Treasury line', () => {
  it('creates the tax, attributed to the bill that made it', () => {
    const state = ready('carriage_duty_1794');
    const bill = billById('carriage_duty_1794');

    expect(taxesInForce(state.policies, state.day)).toHaveLength(3);

    const after = enactBill(state, bill, 0.02).state;
    const taxes = taxesInForce(after.policies, after.day);

    expect(taxes).toHaveLength(4);
    const carriage = taxes.find((t) => t.id === 'tax_carriages')!;
    expect(carriage.createdByBillId).toBe('carriage_duty_1794');
    expect(carriage.rate).toBe(0.02);
    // The statutory exemption travels with it, so the player can read what the
    // law they passed actually says.
    expect(carriage.exemptions.length).toBeGreaterThan(0);
  });

  it('raises real money on the next monthly recompute', () => {
    const state = ready('carriage_duty_1794');
    const enacted = enactBill(state, billById('carriage_duty_1794'), 0.03).state;
    const later = run(enacted, 40);

    const line = later.treasury.receiptLines.find((l) => l.taxId === 'tax_carriages');
    expect(line).toBeDefined();
    expect(line!.net).toBeGreaterThan(0);
    expect(line!.createdByBillId).toBe('carriage_duty_1794');
  });

  it('takes the Treasury line with it when repealed', () => {
    const state = ready('carriage_duty_1794');
    const bill = billById('carriage_duty_1794');
    const enacted = enactBill(state, bill, 0.03).state;

    const repealed = repealBill(
      { ...enacted, politicalCapital: { ...enacted.politicalCapital, current: 500 } },
      bill,
    ).state;

    expect(taxesInForce(repealed.policies, repealed.day)).toHaveLength(3);
    expect(isInForce(repealed, bill.id)).toBe(false);

    // The record survives — a run keeps an account of what was passed and when.
    expect(repealed.policies.bills.some((b) => b.billId === bill.id)).toBe(true);
  });

  it('moves the tax rate when the bill is amended', () => {
    const state = ready('carriage_duty_1794');
    const bill = billById('carriage_duty_1794');
    const enacted = enactBill(state, bill, 0.01).state;

    const amended = amendBill(enacted, bill, 0.04).state;
    const tax = amended.policies.taxes.find((t) => t.id === 'tax_carriages')!;

    // The Treasury line and the Legislation slider must not be able to disagree.
    expect(tax.rate).toBe(0.04);
    expect(
      amended.policies.bills.find((b) => b.billId === bill.id)!.sliderValue,
    ).toBe(0.04);
  });

  it('funds a spending programme the same way', () => {
    const state = ready('lighthouse_act_1789');
    const bill = billById('lighthouse_act_1789');
    const after = enactBill(state, bill, 40_000).state;

    const program = after.policies.programs.find((p) => p.id === 'prog_lighthouses');
    expect(program).toBeDefined();
    expect(program!.createdByBillId).toBe('lighthouse_act_1789');
    expect(program!.annualAmount).toBe(40_000);
  });
});

// ============================================================================
// 3. PHASE-IN
// ============================================================================

describe('a bill phases in rather than landing whole', () => {
  it('contributes nothing on the day it is signed, and all of it later', () => {
    const bill = billById('judiciary_act_1789');
    const state = ready('judiciary_act_1789');
    const enacted = enactBill(state, bill).state;

    const stabilityAt = (day: number) =>
      explainStat(
        'nation.stability',
        50,
        enacted.activeModifiers,
        day,
        { min: 0, max: 100 },
      );

    const atSigning = stabilityAt(enacted.day);
    const halfway = stabilityAt(enacted.day + Math.round(bill.phaseInDays / 2));
    const complete = stabilityAt(enacted.day + bill.phaseInDays);

    expect(atSigning.contributions[0].effect).toBe(0);
    expect(halfway.contributions[0].effect).toBeGreaterThan(0);
    expect(halfway.contributions[0].effect).toBeLessThan(
      complete.contributions[0].effect,
    );
    expect(complete.contributions[0].rampProgress).toBe(1);
  });

  it('keeps the breakdown reconciling all the way through the ramp', () => {
    const bill = billById('judiciary_act_1789');
    const enacted = enactBill(ready('judiciary_act_1789'), bill).state;

    // The one invariant the ledger may never break: base + contributions +
    // clamp === total, at every point of the phase-in.
    for (const offset of [0, 30, 90, 200, 400]) {
      const breakdown = explainStat(
        'nation.stability',
        50,
        enacted.activeModifiers,
        enacted.day + offset,
        { min: 0, max: 100 },
      );

      const sum =
        breakdown.base +
        breakdown.contributions.reduce((s, c) => s + c.effect, 0) +
        breakdown.clampAdjustment;

      expect(sum, `day +${offset}`).toBeCloseTo(breakdown.total, 9);
    }
  });

  it('does not restart the phase-in when a bill is merely amended', () => {
    // A law already in force whose rate is adjusted is not a new law, and
    // making the country absorb it from nothing again would be wrong.
    const bill = billById('carriage_duty_1794');
    const enacted = enactBill(ready('carriage_duty_1794'), bill, 0.01).state;
    const later = { ...enacted, day: enacted.day + 100 };
    const amended = amendBill(later, bill, 0.04).state;

    for (const modifier of amended.activeModifiers) {
      if (!modifier.id.includes(bill.id)) continue;
      expect(modifier.startDay).toBe(enacted.day);
    }
  });

  it('scales a slider bill’s effects with the slider', () => {
    const bill = billById('carriage_duty_1794');
    const low = billModifiers(bill, 0.005, 0);
    const high = billModifiers(bill, 0.05, 0);

    expect(Math.abs(high[0].value)).toBeGreaterThan(Math.abs(low[0].value));
  });
});

// ============================================================================
// 4. AVAILABILITY EXPLAINS ITSELF
// ============================================================================

describe('a bill the player cannot pass says why', () => {
  it('reports a bill whose date has not arrived', () => {
    const bill = billById('stamp_act_1797');
    const status = billStatus(createTestGame(), bill);

    expect(status.kind).toBe('notYet');
    if (status.kind !== 'notYet') return;
    expect(status.from).toBe(bill.availableFrom);
  });

  it('reports an unmet prerequisite in plain English', () => {
    const bill = billById('navy_department_1798');
    const state = { ...createTestGame(), day: isoToDay('1798-06-01') };
    const status = billStatus(state, bill);

    expect(status.kind).toBe('blocked');
    if (status.kind !== 'blocked') return;
    expect(status.reasons.length).toBeGreaterThan(0);
    expect(status.reasons[0]).toContain('naval_act_1794');
  });

  it('locks an anachronistic bill whatever the date, and gives the reason', () => {
    const bill = billById('federal_income_tax');
    for (const day of [0, 2000, 4262]) {
      const status = billStatus({ ...createTestGame(), day }, bill);
      expect(status.kind, `day ${day}`).toBe('locked');
    }

    const status = billStatus(createTestGame(), bill);
    if (status.kind !== 'locked') return;
    // The Constitution does not become satisfiable by waiting.
    expect(status.because).toContain('apportioned');
  });

  it('locks an export duty on the constitutional bar', () => {
    const status = billStatus(createTestGame(), billById('export_duty_on_staples'));
    expect(status.kind).toBe('locked');
    if (status.kind !== 'locked') return;
    expect(status.because).toContain('exported from any State');
  });

  it('refuses to enact a bill that is not available', () => {
    expect(() =>
      enactBill(createTestGame(), billById('stamp_act_1797'), 0.01),
    ).toThrow(/not available/);
  });

  it('refuses to enact a bill the government cannot afford', () => {
    const poor = { ...ready('judiciary_act_1789', 1) };
    expect(() => enactBill(poor, billById('judiciary_act_1789'))).toThrow(
      /political capital/,
    );
  });
});

// ============================================================================
// 5. COSTS AND BLOC REACTIONS
// ============================================================================

describe('what a bill costs', () => {
  it('charges more to introduce a slider bill at the top of its range', () => {
    const bill = billById('carriage_duty_1794');
    expect(introduceCost(bill, 0.05)).toBeGreaterThan(introduceCost(bill, 0.005));
  });

  it('interpolates the treasury cost across the slider range', () => {
    const bill = billById('carriage_duty_1794');
    expect(treasuryCost(bill, 0.005)).toBe(bill.treasuryCost.min);
    expect(treasuryCost(bill, 0.05)).toBe(bill.treasuryCost.max);
  });

  it('charges to raise and to lower, at different rates', () => {
    const bill = billById('carriage_duty_1794');
    const raise = amendCost(bill, 0.005, 0.05);
    const lower = amendCost(bill, 0.05, 0.005);

    expect(raise).toBeGreaterThan(0);
    expect(lower).toBeGreaterThan(0);
    // Raising a tax is harder than lowering one, and the schema says so with
    // four separate numbers rather than one. (Democracy 4's structure.)
    expect(raise).toBeGreaterThan(lower);
  });

  it('charges nothing to amend to the value already in force', () => {
    const bill = billById('carriage_duty_1794');
    expect(amendCost(bill, 0.02, 0.02)).toBe(0);
  });

  it('deducts the capital and the money when a bill passes', () => {
    const state = ready('bank_of_the_united_states');
    const withPrereq = {
      ...state,
      flags: { ...state.flags, assumption_passed: true },
    };
    const bill = billById('bank_of_the_united_states');

    const after = enactBill(withPrereq, bill).state;

    expect(after.politicalCapital.current).toBeCloseTo(
      withPrereq.politicalCapital.current - bill.capitalCost.introduce,
      6,
    );
    expect(after.treasury.balance).toBeCloseTo(
      withPrereq.treasury.balance - bill.treasuryCost.min,
      6,
    );
  });
});

describe('bloc reactions land on the regions', () => {
  it('weights every bloc to sum to one across the regions', () => {
    for (const bloc of BLOC_IDS) {
      const weights = BLOC_REGION_WEIGHTS[bloc];
      const total = Object.values(weights).reduce((s, w) => s + w, 0);
      expect(total, bloc).toBeCloseTo(1, 6);
    }
  });

  it('sends a frontier bloc’s anger to the frontier', () => {
    const shifts = blocSentimentShifts(
      [{ bloc: 'frontier_settlers', strength: -80, reason: 'test' }],
      createTestGame().regions,
    );

    expect(shifts.frontier).toBeLessThan(0);
    expect(shifts.frontier).toBeLessThan(shifts.new_england);
  });

  it('sends a planter bloc’s anger to the South', () => {
    const shifts = blocSentimentShifts(
      [{ bloc: 'planters', strength: -80, reason: 'test' }],
      createTestGame().regions,
    );

    expect(shifts.south).toBeLessThan(shifts.new_england);
  });

  it('moves base sentiment rather than the current value when a bill passes', () => {
    const state = ready('direct_tax_1798');
    const bill = billById('direct_tax_1798');
    const before = state.regions.find((r) => r.id === 'frontier')!;

    const after = enactBill(state, bill, 0.01).state;
    const region = after.regions.find((r) => r.id === 'frontier')!;

    // The equilibrium moves; the stored value then drifts there over the usual
    // six months. Applying it to the current value would produce a jump the
    // model would immediately undo.
    expect(region.baseSentiment).toBeLessThan(before.baseSentiment);
    expect(region.sentiment).toBe(before.sentiment);
  });

  it('does not refund the resentment when a bill is repealed', () => {
    const state = ready('direct_tax_1798');
    const bill = billById('direct_tax_1798');
    const enacted = enactBill(state, bill, 0.01).state;
    const angered = enacted.regions.find((r) => r.id === 'frontier')!.baseSentiment;

    const repealed = repealBill(enacted, bill).state;

    // A country does not un-resent a law because it was taken back, and a
    // repeal that refunded the damage would make an unpopular bill temporarily
    // free.
    expect(repealed.regions.find((r) => r.id === 'frontier')!.baseSentiment).toBe(
      angered,
    );
  });
});
