/**
 * BLOCS — who the country is made of, and how that changes
 *
 * Phase 2 brief §1, queue item 8. Six claims, each of which a test should be
 * able to falsify:
 *
 *   1. Membership is OVERLAPPING and INCOMPLETE, and both are deliberate. On
 *      the frontier the shares exceed 1 because most settlers are also farmers;
 *      in the South they fall well short of 1 because a third of the people were
 *      enslaved and belonged to no political interest at all.
 *   2. The founding is an EQUILIBRIUM. Nothing drifts on day 0, because every
 *      driver is a ratio to its own founding value.
 *   3. The economy moves the blocs. Trade builds merchants; manufacturing
 *      builds artisans OUT OF the farmers.
 *   4. POLICY moves the blocs, through the modifier ledger like everything else,
 *      so a tariff produces more artisans rather than merely happier ones.
 *   5. It moves SLOWLY, and a measure repealed before it takes hold leaves the
 *      country roughly where it found it.
 *   6. Every target EXPLAINS ITSELF: seed plus contributions equals target,
 *      exactly as a stat's contributions sum to the stat.
 */

import { describe, expect, it } from 'vitest';
import { PHASE_1_CONTENT } from '@/content';
import { advanceDay, resolveDecision } from './advanceDay';
import {
  blocChangeSinceFounding,
  blocNationalSize,
  blocWeights,
  blocsInRegion,
  blocTarget,
  driftBlocs,
  explainBloc,
  seedBlocs,
  unrepresentedShare,
} from './blocs';
import { enactBill } from './bills';
import { evaluateAll } from './conditions';
import { BLOC_DRIFT_PER_MONTH, BLOC_MEMBERSHIP_1790 } from './calibration';
import { createTestGame } from './createGame';
import { BLOC_IDS, REGION_IDS, type Bill, type GameState } from './types';

function billById(id: string): Bill {
  return PHASE_1_CONTENT.bills.find((b) => b.id === id)!;
}

function run(state: GameState, days: number): GameState {
  let current = state;
  for (let i = 0; i < days; i++) {
    current = advanceDay(current, PHASE_1_CONTENT).state;
    // The loop halts on a pending decision, so a test that does not answer them
    // silently stops advancing and then measures a country that never moved.
    while (current.eventState.pendingDecisions.length > 0) {
      const pending = current.eventState.pendingDecisions[0];
      const event = PHASE_1_CONTENT.events.find((e) => e.id === pending.eventId)!;
      // The FIRST ELIGIBLE option, not simply the first: some options are open
      // only to a republic, and a monarchy run that reached for one would throw.
      const option =
        event.options.find((o) => evaluateAll(o.requirements, current)) ??
        event.options[0];
      current = resolveDecision(
        current,
        PHASE_1_CONTENT,
        pending.eventId,
        option.id,
      ).state;
    }
  }
  return current;
}

/** A state with the capital to pass anything, so the tests are about blocs. */
function funded(): GameState {
  const base = createTestGame({ governmentType: 'monarchy' });
  return {
    ...base,
    politicalCapital: { ...base.politicalCapital, current: 2000, cap: 2000 },
    treasury: { ...base.treasury, balance: 50_000_000 },
  };
}

// ============================================================================
// 1. OVERLAPPING, AND HONESTLY INCOMPLETE
// ============================================================================

describe('membership overlaps, and does not pretend to cover everybody', () => {
  it('puts most of the frontier in two blocs at once', () => {
    const state = createTestGame();
    const shares = state.blocs.membership.frontier;

    // Half the frontier are small farmers and four fifths are frontier
    // settlers, because most of them are both people. A column summing to
    // exactly 1 would be the binary model the brief asks us to leave behind.
    const total = BLOC_IDS.reduce((sum, b) => sum + (shares[b] ?? 0), 0);
    expect(total).toBeGreaterThan(1);
    expect(shares.small_farmers).toBeGreaterThan(0.3);
    expect(shares.frontier_settlers).toBeGreaterThan(0.5);
  });

  it('leaves the enslaved third of the South in no bloc, and says so', () => {
    const state = createTestGame();
    const shares = state.blocs.membership.south;
    const total = BLOC_IDS.reduce((sum, b) => sum + (shares[b] ?? 0), 0);

    // Rounding them into "small farmers" would make the arithmetic tidy by
    // asserting something false about 1790.
    expect(total).toBeLessThan(0.8);
    expect(unrepresentedShare(state, 'south')).toBeGreaterThan(0.3);
    expect(unrepresentedShare(state, 'new_england')).toBeLessThan(0.01);
  });

  it('puts each bloc where its economy actually is', () => {
    const weights = blocWeights(createTestGame());

    expect(weights.planters.south).toBeGreaterThan(0.7);
    expect(weights.seamen.new_england).toBeGreaterThan(weights.seamen.south);
    expect(weights.financiers.mid_atlantic).toBeGreaterThan(
      weights.financiers.frontier,
    );
    expect(weights.frontier_settlers.frontier).toBeGreaterThan(0.5);
  });

  it('keeps every bloc’s weights summing to one', () => {
    const weights = blocWeights(createTestGame());
    for (const bloc of BLOC_IDS) {
      const total = REGION_IDS.reduce((s, r) => s + weights[bloc][r], 0);
      expect(total, bloc).toBeCloseTo(1, 9);
    }
  });
});

// ============================================================================
// 2. THE FOUNDING IS AN EQUILIBRIUM
// ============================================================================

describe('nothing moves on its own at the founding', () => {
  it('has every target equal to its seed on day 0', () => {
    const state = createTestGame();

    for (const regionId of REGION_IDS) {
      for (const bloc of BLOC_IDS) {
        const breakdown = explainBloc(state, regionId, bloc);
        // Every driver is a ratio to its own founding value, so on day 0 every
        // ratio is 1 and the target is the seed. Without this the country would
        // slide away from the founding for no reason the player caused.
        expect(breakdown.target, `${regionId}/${bloc}`).toBeCloseTo(
          breakdown.seed,
          9,
        );
        expect(breakdown.gap, `${regionId}/${bloc}`).toBeCloseTo(0, 9);
      }
    }
  });

  it('drifts nowhere on a day-0 state', () => {
    const state = createTestGame();
    const drifted = driftBlocs(state);

    for (const regionId of REGION_IDS) {
      for (const bloc of BLOC_IDS) {
        expect(drifted.membership[regionId][bloc], `${regionId}/${bloc}`).toBeCloseTo(
          state.blocs.membership[regionId][bloc],
          9,
        );
      }
    }
  });

  it('seeds the denominators from the founding economy, not from nothing', () => {
    const state = createTestGame();
    const seeded = seedBlocs(state.regions);

    for (const region of state.regions) {
      const base = seeded.baseDrivers[region.id];
      expect(base.population).toBe(region.population);
      expect(base.tradePerHead).toBeCloseTo(region.tradeVolume / region.population, 9);
      // A zero denominator would make every ratio meaningless rather than large.
      expect(base.prosperity).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// 3. THE ECONOMY MOVES THE BLOCS
// ============================================================================

describe('the economy changes who the country is made of', () => {
  it('grows the merchants when the carrying trade grows', () => {
    const base = createTestGame();
    const richer: GameState = {
      ...base,
      regions: base.regions.map((r) =>
        r.id === 'new_england' ? { ...r, tradeVolume: r.tradeVolume * 1.5 } : r,
      ),
    };

    const before = explainBloc(base, 'new_england', 'merchants');
    const after = explainBloc(richer, 'new_england', 'merchants');

    expect(after.target).toBeGreaterThan(before.target);
    expect(after.drivers.some((d) => d.driver === 'tradePerHead')).toBe(true);
  });

  it('fills the workshops out of the farms', () => {
    const base = createTestGame();
    const industrial: GameState = {
      ...base,
      regions: base.regions.map((r) =>
        r.id === 'mid_atlantic'
          ? { ...r, manufacturingOutput: r.manufacturingOutput * 2 }
          : r,
      ),
    };

    const artisans = explainBloc(industrial, 'mid_atlantic', 'artisans');
    const farmers = explainBloc(industrial, 'mid_atlantic', 'small_farmers');

    // The workshop fills from the farm and always has. A model in which every
    // bloc only ever grows is a model of nothing.
    expect(artisans.target).toBeGreaterThan(artisans.seed);
    expect(farmers.target).toBeLessThan(farmers.seed);
  });

  it('measures per head, so a region that only grows does not become mercantile', () => {
    const base = createTestGame();
    const doubled: GameState = {
      ...base,
      regions: base.regions.map((r) =>
        r.id === 'south'
          ? {
              ...r,
              population: r.population * 2,
              enslavedPopulation: r.enslavedPopulation * 2,
              tradeVolume: r.tradeVolume * 2,
              manufacturingOutput: r.manufacturingOutput * 2,
              agriculturalOutput: r.agriculturalOutput * 2,
            }
          : r,
      ),
    };

    // Everything doubled together: the region is twice the size and exactly as
    // mercantile as it was. Only the frontier settlers, who track population by
    // design, should notice.
    expect(explainBloc(doubled, 'south', 'merchants').target).toBeCloseTo(
      explainBloc(base, 'south', 'merchants').target,
      9,
    );
  });
});

// ============================================================================
// 4. POLICY MOVES THE BLOCS, THROUGH THE LEDGER
// ============================================================================

describe('a statute changes the country, not just its mood', () => {
  it('makes more artisans rather than merely happier ones', () => {
    const before = funded();
    const bill = billById('bounties_on_manufactures');
    const after = enactBill(
      { ...before, day: 1000 },
      bill,
      bill.sliderRange![1],
    ).state;

    // Three years of phase-in, so the day it passes it does nothing yet — a
    // statute does not change a country the day it is signed. Measured once the
    // ramp has run.
    const breakdown = explainBloc({ ...after, day: after.day + 1095 }, 'mid_atlantic', 'artisans');
    expect(breakdown.target).toBeGreaterThan(breakdown.seed);

    // Through the LEDGER, like everything else — so the statute is named in the
    // breakdown and the player can see which law is doing it. (brief §10 rule 2)
    expect(breakdown.ledger.contributions.length).toBeGreaterThan(0);
    expect(breakdown.ledger.contributions[0].source).toContain('Bounties');
    expect(breakdown.ledger.target).toBe(blocTarget('artisans', 'mid_atlantic'));
  });

  it('dissolves the planters when the thing that defined them is abolished', () => {
    const before = funded();
    const bill = billById('gradual_emancipation_federal');
    const after = enactBill({ ...before, day: 1000 }, bill, null).state;

    const planters = explainBloc({ ...after, day: after.day + 2000 }, 'south', 'planters');
    // An interest defined by holding people in bondage cannot outlive the
    // bondage. It is not merely angered; it goes away.
    expect(planters.target).toBeLessThan(planters.seed);
  });

  it('actually moves the country when the months pass', () => {
    const start = funded();
    const bill = billById('bounties_on_manufactures');
    const enacted = enactBill({ ...start, day: 1000 }, bill, bill.sliderRange![1]).state;

    const after = run(enacted, 1400);

    expect(blocChangeSinceFounding(after, 'mid_atlantic', 'artisans')).toBeGreaterThan(
      0.05,
    );
    expect(blocNationalSize(after, 'artisans')).toBeGreaterThan(
      blocNationalSize(start, 'artisans'),
    );
  });

  it('lands a bill’s anger where the bloc has actually moved to', () => {
    /*
      The point of making membership move at all. Weights are derived from where
      people are TODAY, so a country whose workshops have filled for a decade
      reacts to a measure differently from the one that passed the first tariff.
    */
    const start = funded();
    const bill = billById('bounties_on_manufactures');
    const enacted = enactBill({ ...start, day: 1000 }, bill, bill.sliderRange![1]).state;
    const later = run(enacted, 1800);

    const before = blocWeights(start).artisans;
    const after = blocWeights(later).artisans;

    expect(after.mid_atlantic).toBeGreaterThan(before.mid_atlantic);
    // And what moves in must come out of somewhere: the shares still sum to 1.
    expect(REGION_IDS.reduce((s, r) => s + after[r], 0)).toBeCloseTo(1, 9);
  });
});

// ============================================================================
// 5. IT MOVES SLOWLY
// ============================================================================

describe('the country changes at the speed of a country', () => {
  it('closes only a small part of the gap each month', () => {
    const base = createTestGame();
    const pushed: GameState = {
      ...base,
      regions: base.regions.map((r) =>
        r.id === 'new_england' ? { ...r, tradeVolume: r.tradeVolume * 3 } : r,
      ),
    };

    const target = explainBloc(pushed, 'new_england', 'merchants').target;
    const start = pushed.blocs.membership.new_england.merchants;
    const after = driftBlocs(pushed).membership.new_england.merchants;

    expect(after).toBeCloseTo(start + (target - start) * BLOC_DRIFT_PER_MONTH, 9);
    // Nowhere near arriving. People do not change trade because a statute passed.
    expect(after).toBeLessThan(start + (target - start) * 0.1);
  });

  it('leaves the country roughly where it found it if a law is soon repealed', () => {
    const start = funded();
    const bill = billById('bounties_on_manufactures');

    const enacted = enactBill({ ...start, day: 1000 }, bill, bill.sliderRange![1]).state;
    const brief = run(enacted, 120);
    const { state: repealed } = { state: { ...brief } };
    const undone = run(
      {
        ...repealed,
        activeModifiers: repealed.activeModifiers.filter(
          (m) => !m.source.includes('Bounties'),
        ),
      },
      400,
    );

    // Under a tenth of the way. A measure taken back before it took hold should
    // not have rebuilt the economy — and that falls out of the drift rate rather
    // than being a separate mechanism.
    expect(
      Math.abs(blocChangeSinceFounding(undone, 'mid_atlantic', 'artisans')),
    ).toBeLessThan(0.05);
  });

  it('never lets a share leave its bounds, however hard it is pushed', () => {
    const base = createTestGame();
    const absurd: GameState = {
      ...base,
      regions: base.regions.map((r) => ({
        ...r,
        tradeVolume: r.tradeVolume * 1000,
        manufacturingOutput: r.manufacturingOutput * 1000,
      })),
    };

    let state = absurd;
    for (let i = 0; i < 400; i++) {
      state = { ...state, blocs: driftBlocs(state) };
    }

    for (const regionId of REGION_IDS) {
      for (const bloc of BLOC_IDS) {
        const share = state.blocs.membership[regionId][bloc];
        expect(Number.isFinite(share), `${regionId}/${bloc}`).toBe(true);
        expect(share, `${regionId}/${bloc}`).toBeGreaterThan(0);
        expect(share, `${regionId}/${bloc}`).toBeLessThanOrEqual(0.95);
      }
    }
  });
});

// ============================================================================
// 6. EVERY TARGET EXPLAINS ITSELF
// ============================================================================

describe('a bloc’s size explains itself, like every other number', () => {
  it('has its contributions sum to its target', () => {
    const base = funded();
    const bill = billById('bounties_on_manufactures');
    const enacted = enactBill({ ...base, day: 1000 }, bill, bill.sliderRange![1]).state;
    const state = run(enacted, 900);

    for (const regionId of REGION_IDS) {
      for (const bloc of BLOC_IDS) {
        const b = explainBloc(state, regionId, bloc);

        // The same contract `explainStat` has with a stat: the arithmetic
        // returned is the arithmetic that produced the number.
        const fromDrivers =
          b.seed + b.drivers.reduce((sum, d) => sum + d.effect, 0);
        expect(fromDrivers, `${regionId}/${bloc} drivers`).toBeCloseTo(
          b.economicTarget,
          9,
        );

        const fromLedger =
          b.ledger.base +
          b.ledger.contributions.reduce((sum, c) => sum + c.effect, 0) +
          b.ledger.clampAdjustment;
        expect(fromLedger, `${regionId}/${bloc} ledger`).toBeCloseTo(b.target, 9);
      }
    }
  });

  it('names the quantity behind each contribution in plain words', () => {
    const base = createTestGame();
    const richer: GameState = {
      ...base,
      regions: base.regions.map((r) =>
        r.id === 'new_england' ? { ...r, tradeVolume: r.tradeVolume * 1.4 } : r,
      ),
    };

    const b = explainBloc(richer, 'new_england', 'merchants');
    const trade = b.drivers.find((d) => d.driver === 'tradePerHead')!;

    expect(trade.label).toBe('trade per head');
    expect(trade.ratio).toBeGreaterThan(1);
    expect(trade.effect).toBeGreaterThan(0);
  });

  it('orders a region’s blocs largest first, for the screen', () => {
    const listed = blocsInRegion(createTestGame(), 'south');
    for (let i = 1; i < listed.length; i++) {
      expect(listed[i - 1].share).toBeGreaterThanOrEqual(listed[i].share);
    }
    expect(listed[0].bloc).toBe('small_farmers');
  });
});

// ============================================================================
// THE ENGINE RULES STILL HOLD
// ============================================================================

describe('blocs obey the architecture rules', () => {
  it('round-trips through JSON losslessly', () => {
    const state = run(createTestGame(), 400);
    const copy = JSON.parse(JSON.stringify(state)) as GameState;
    expect(copy.blocs).toEqual(state.blocs);
  });

  it('is deterministic across two identical runs', () => {
    const a = run(createTestGame({ seed: 7 }), 500);
    const b = run(createTestGame({ seed: 7 }), 500);
    expect(a.blocs).toEqual(b.blocs);
  });

  it('drifts monthly, not daily', () => {
    const start = createTestGame();
    const pushed: GameState = {
      ...start,
      regions: start.regions.map((r) => ({ ...r, tradeVolume: r.tradeVolume * 2 })),
    };

    // Day 10 is 10 May, so the next day is nowhere near the first of a month.
    // Day 0 would not do: 30 April plus one is 1 May, and the test would be
    // asserting the opposite of what it means.
    const midMonth = { ...pushed, day: 10 };
    const oneDay = advanceDay(midMonth, PHASE_1_CONTENT).state;

    expect(oneDay.blocs.membership).toEqual(midMonth.blocs.membership);
    expect(oneDay.blocs.lastDriftDay).toBe(0);

    // And on the first of the following month it does move.
    const toTheFirst = run(midMonth, 25);
    expect(toTheFirst.blocs.lastDriftDay).toBeGreaterThan(0);
    expect(toTheFirst.blocs.membership).not.toEqual(midMonth.blocs.membership);
  });

  it('keeps the seed table honest: every region and bloc is present', () => {
    for (const regionId of REGION_IDS) {
      const row = BLOC_MEMBERSHIP_1790[regionId];
      expect(row, regionId).toBeDefined();
      for (const bloc of BLOC_IDS) {
        expect(row[bloc], `${regionId}/${bloc}`).toBeGreaterThan(0);
      }
    }
  });
});
