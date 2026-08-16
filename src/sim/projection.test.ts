import { describe, expect, it } from 'vitest';
import { advanceDay } from './advanceDay';
import { createTestGame } from './createGame';
import { currentPolicy, enactPolicy, policyLegitimacyCost, taxIncrease } from './policy';
import {
  comparePolicies,
  policyDiffers,
  projectPolicy,
  readProjection,
  type ProposedPolicy,
} from './projection';
import { aggregateRate } from './taxes';
import {
  FOUNDING_PROGRAM_IDS,
  FOUNDING_TAX_IDS,
  type ContentPack,
  type GameState,
} from './types';

const EMPTY: ContentPack = { version: 'test', events: [], bills: [], offices: [], parties: [], stateSeats: [] };

const policyOf = currentPolicy;

/** The proposal, with one tax's rate changed. */
function withRate(
  state: GameState,
  taxId: string,
  rate: number,
): ProposedPolicy {
  const p = currentPolicy(state);
  return { ...p, rates: { ...p.rates, [taxId]: rate } };
}

/**
 * A state with capital to burn.
 *
 * These tests are about the economy, not about affordability — political
 * capital is gated separately and tested in politicalCapital.test.ts. Topping
 * the reserve up keeps each test asking one question. A test that failed here
 * because a government could not afford the change would be reporting the wrong
 * thing.
 */
function funded(state: GameState): GameState {
  return {
    ...state,
    politicalCapital: { ...state.politicalCapital, current: 500, cap: 500 },
  };
}

function withTariff(state: GameState, rate: number): ProposedPolicy {
  return withRate(state, FOUNDING_TAX_IDS.impost, rate);
}

function withExcise(state: GameState, rate: number): ProposedPolicy {
  return withRate(state, FOUNDING_TAX_IDS.spirits, rate);
}

describe('the projection uses the real engine', () => {
  /**
   * The point of the whole module. If the projection were a separate simplified
   * formula it would drift from the model, and the number the player decides
   * from would be the one that is wrong.
   */
  it('matches what actually happens when the same policy is played out', () => {
    const state = createTestGame();
    const proposed = withTariff(state, 0.2);

    const projected = projectPolicy(state, proposed, EMPTY, 200);

    // Now actually play it: enact, then run the same 200 days.
    let played = enactPolicy(state, proposed).state;
    // The projection suppresses events, so play without them too.
    for (let i = 0; i < 200; i++) played = advanceDay(played, EMPTY).state;

    const actual = readProjection(played);

    expect(projected.totalReceipts).toBeCloseTo(actual.totalReceipts, 4);
    expect(projected.totalOutlays).toBeCloseTo(actual.totalOutlays, 4);
    expect(projected.debtPrincipal).toBeCloseTo(actual.debtPrincipal, 4);
    expect(projected.regionCompliance.frontier).toBeCloseTo(
      actual.regionCompliance.frontier,
      6,
    );
  });

  it('does not mutate the state it projects from', () => {
    const state = createTestGame();
    const before = JSON.parse(JSON.stringify(state));
    projectPolicy(state, withTariff(state, 0.35), EMPTY, 120);
    expect(state).toEqual(before);
  });

  it('always finishes, even when the real content pack would fire a decision', () => {
    const state = createTestGame();
    // Day 400+ is well past the first event trigger. A projection that fired
    // it would block forever on a pending decision.
    const projection = projectPolicy(state, policyOf(state), EMPTY, 500);
    expect(projection.daysSimulated).toBe(500);
    expect(Number.isFinite(projection.totalReceipts)).toBe(true);
  });

  it('is deterministic', () => {
    const state = createTestGame();
    const a = projectPolicy(state, withTariff(state, 0.18), EMPTY, 300);
    const b = projectPolicy(state, withTariff(state, 0.18), EMPTY, 300);
    expect(a).toEqual(b);
  });
});

describe('the projection reproduces the tariff curve (ECONOMY.md §7.5)', () => {
  const state = createTestGame();

  it('raising the tariff from 5% to 20% increases projected customs revenue', () => {
    const low = projectPolicy(state, withTariff(state, 0.05), EMPTY, 120);
    const high = projectPolicy(state, withTariff(state, 0.2), EMPTY, 120);
    expect(high.receipts.customs).toBeGreaterThan(low.receipts.customs);
  });

  it('raising the tariff from 25% to 40% DECREASES projected customs revenue', () => {
    const peak = projectPolicy(state, withTariff(state, 0.25), EMPTY, 120);
    const punitive = projectPolicy(state, withTariff(state, 0.4), EMPTY, 120);
    expect(punitive.receipts.customs).toBeLessThan(peak.receipts.customs);
  });

  it('turns over near 25%, so the slider mark is telling the truth', () => {
    let bestRate = 0;
    let best = -Infinity;
    for (let rate = 0.05; rate <= 0.45001; rate += 0.025) {
      const revenue = projectPolicy(state, withTariff(state, rate), EMPTY, 60).receipts
        .customs;
      if (revenue > best) {
        best = revenue;
        bestRate = rate;
      }
    }
    expect(bestRate).toBeGreaterThan(0.2);
    expect(bestRate).toBeLessThan(0.3);
  });
});

describe('the projection includes lagged compliance (ECONOMY.md §7.7)', () => {
  /**
   * The reason the projection must be a forward simulation rather than
   * `base x rate`. A naive formula would promise revenue the frontier will
   * simply refuse to pay.
   */
  const state = createTestGame();

  it('a heavy excise shows frontier compliance collapsing in the projection', () => {
    const modest = projectPolicy(state, withExcise(state, 0.05), EMPTY, 365);
    const heavy = projectPolicy(state, withExcise(state, 0.3), EMPTY, 365);
    expect(heavy.regionCompliance.frontier).toBeLessThan(
      modest.regionCompliance.frontier,
    );
  });

  it('projected excise revenue rises by less than the rate multiple implies', () => {
    const modest = projectPolicy(state, withExcise(state, 0.05), EMPTY, 365);
    const heavy = projectPolicy(state, withExcise(state, 0.3), EMPTY, 365);

    const rateMultiple = 0.3 / 0.05; // 6x
    const revenueMultiple = heavy.receipts.excise / modest.receipts.excise;

    expect(revenueMultiple).toBeGreaterThan(1);
    expect(revenueMultiple).toBeLessThan(rateMultiple);
  });

  it('hits the frontier harder than any other region', () => {
    const heavy = projectPolicy(state, withExcise(state, 0.3), EMPTY, 365);
    for (const id of ['new_england', 'mid_atlantic', 'south']) {
      expect(heavy.regionCompliance.frontier).toBeLessThan(
        heavy.regionCompliance[id],
      );
    }
  });
});

describe('comparing policies', () => {
  it('simulates both columns over the same horizon so they are comparable', () => {
    const state = createTestGame();
    const { current, proposed } = comparePolicies(state, withTariff(state, 0.2), EMPTY, 200);
    expect(current.daysSimulated).toBe(200);
    expect(proposed.daysSimulated).toBe(200);
  });

  it('an unchanged policy projects identically to the current one', () => {
    const state = createTestGame();
    const { current, proposed } = comparePolicies(state, policyOf(state), EMPTY, 150);
    expect(proposed.totalReceipts).toBeCloseTo(current.totalReceipts, 6);
    expect(proposed.annualBalance).toBeCloseTo(current.annualBalance, 6);
  });

  it('detects whether anything changed', () => {
    const state = createTestGame();
    expect(policyDiffers(state, policyOf(state))).toBe(false);
    expect(policyDiffers(state, withTariff(state, 0.11))).toBe(true);

    const base = currentPolicy(state);
    const spend: ProposedPolicy = {
      ...base,
      amounts: {
        ...base.amounts,
        [FOUNDING_PROGRAM_IDS.military]:
          base.amounts[FOUNDING_PROGRAM_IDS.military] + 1,
      },
    };
    expect(policyDiffers(state, spend)).toBe(true);
  });
});

describe('enacting policy', () => {
  it('applies the proposed rates', () => {
    const state = createTestGame();
    const result = enactPolicy(state, withTariff(state, 0.22)).state;
    expect(aggregateRate(result.policies, result.day, 'imports')).toBe(0.22);
  });

  it('writes a chronicle entry describing the change in words', () => {
    const state = createTestGame();
    const result = enactPolicy(state, withTariff(state, 0.22)).state;
    const entry = result.log[result.log.length - 1];
    expect(entry.category).toBe('treasury');
    // The tax is named, not its category. With a dynamic set of taxes "the
    // tariff was raised" is no longer unambiguous — there may be several.
    expect(entry.body).toContain('Impost of 1789 raised');
    expect(entry.body).toContain('22.0%');
  });

  it('does not mutate the input state', () => {
    const state = funded(createTestGame());
    const before = JSON.parse(JSON.stringify(state));
    enactPolicy(state, withTariff(state, 0.3));
    expect(state).toEqual(before);
  });

  describe('the political cost runs through the ledger', () => {
    it('charges legitimacy for a tax rise, as a visible policy modifier', () => {
      const state = createTestGame();
      const result = enactPolicy(state, withTariff(state, 0.25)).state;

      const modifier = result.activeModifiers.find(
        (m) => m.target === 'nation.legitimacy' && m.sourceType === 'policy',
      );
      expect(modifier).toBeDefined();
      expect(modifier!.value).toBeLessThan(0);
      // Temporary, not permanent: political costs wear off.
      expect(modifier!.endDay).not.toBeNull();
    });

    it('charges nothing for a tax cut', () => {
      const state = createTestGame();
      const result = enactPolicy(state, withTariff(state, 0.02)).state;
      expect(
        result.activeModifiers.filter((m) => m.sourceType === 'policy'),
      ).toHaveLength(0);
    });

    it('buys no legitimacy for a cut either, so rates cannot be farmed', () => {
      const state = createTestGame();
      expect(policyLegitimacyCost(state, withTariff(state, 0.0))).toBe(0);
    });

    /**
     * DESIGN.md §9.2: a republic must carry the country with it; a crown may
     * simply act. This is that row, made mechanical.
     */
    it('costs a monarchy less than a republic for the same rise', () => {
      const republic = createTestGame({ governmentType: 'republic' });
      const monarchy = createTestGame({ governmentType: 'monarchy' });

      const republicCost = policyLegitimacyCost(republic, withTariff(republic, 0.3));
      const monarchyCost = policyLegitimacyCost(monarchy, withTariff(monarchy, 0.3));

      expect(republicCost).toBeGreaterThan(0);
      expect(monarchyCost).toBeGreaterThan(0);
      expect(monarchyCost).toBeLessThan(republicCost);
    });

    it('scales with the size of the rise', () => {
      const state = createTestGame();
      const small = policyLegitimacyCost(state, withTariff(state, 0.15));
      const large = policyLegitimacyCost(state, withTariff(state, 0.35));
      expect(large).toBeGreaterThan(small);
    });

    it('sums increases across several taxes and ignores the cuts', () => {
      const state = createTestGame();
      const base = currentPolicy(state);
      const mixed: ProposedPolicy = {
        ...base,
        rates: {
          ...base.rates,
          [FOUNDING_TAX_IDS.impost]: 0.02, // a cut, ignored
          [FOUNDING_TAX_IDS.spirits]: 0.1, // a rise, counted
        },
      };
      expect(taxIncrease(state, mixed)).toBeCloseTo(0.1, 6);
    });

    it('the cost is visible in the ledger and expires on schedule', () => {
      const state = funded(createTestGame());
      const enacted = enactPolicy(state, withTariff(state, 0.3)).state;
      const modifier = enacted.activeModifiers[0];

      let played = enacted;
      for (let i = 0; i < 40; i++) played = advanceDay(played, EMPTY).state;
      expect(played.activeModifiers).toHaveLength(1);

      // Run past its end day.
      played = enacted;
      const totalDays = modifier.endDay! - modifier.startDay + 5;
      for (let i = 0; i < totalDays; i++) played = advanceDay(played, EMPTY).state;
      expect(played.activeModifiers).toHaveLength(0);
    });
  });
});

describe('the causal chain is observable end to end', () => {
  /**
   * Acceptance criterion 3: setting tax rates produces effects that propagate
   * through the economy over subsequent weeks and months in a traceable way.
   */
  it('receipts move within weeks, sentiment moves over months', () => {
    const state = funded(createTestGame());
    const enacted = enactPolicy(state, withExcise(state, 0.25)).state;

    const at = (days: number) => {
      let s = enacted;
      for (let i = 0; i < days; i++) s = advanceDay(s, EMPTY).state;
      return s;
    };

    const start = enacted;
    const oneMonth = at(32);
    const sixMonths = at(190);
    const twoYears = at(730);

    // Revenue responds immediately at the first monthly recompute.
    expect(oneMonth.treasury.annualisedReceipts.excise).toBeGreaterThan(
      start.treasury.annualisedReceipts.excise,
    );

    // Sentiment moves far less in one month than over two years.
    const frontierAt = (s: GameState) =>
      s.regions.find((r) => r.id === 'frontier')!.sentiment;

    const oneMonthShift = Math.abs(frontierAt(oneMonth) - frontierAt(start));
    const sixMonthShift = Math.abs(frontierAt(sixMonths) - frontierAt(start));
    const twoYearShift = Math.abs(frontierAt(twoYears) - frontierAt(start));

    expect(sixMonthShift).toBeGreaterThan(oneMonthShift);
    expect(twoYearShift).toBeGreaterThan(sixMonthShift);
  });
});
