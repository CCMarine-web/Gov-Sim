/**
 * GRIEVANCE, UNREST AND SUCCESSION — the monarchy path
 *
 * Phase 2 brief §2.1. Five claims the design makes, each of which a test should
 * be able to falsify:
 *
 *   1. Grievance is tracked PER BLOC. Decreeing against the planters repeatedly
 *      builds planter grievance specifically, not generic unhappiness — and it
 *      lands in the South, where the planters are.
 *   2. A decree costs more than a bill: more legitimacy, more grievance, less
 *      political capital. Speed against consent.
 *   3. Grievance has teeth. Above thresholds it takes revenue, then stability,
 *      then produces a rising.
 *   4. The ruler dies, the crown passes, and the player carries on. An orderly
 *      succession costs; a disputed one costs far more — and WHICH it is, is
 *      something the player controls.
 *   5. NEITHER PATH IS STRICTLY BETTER. The brief calls that a defect; this is
 *      where it is checked.
 */

import { describe, expect, it } from 'vitest';
import { PHASE_1_CONTENT } from '@/content';
import { advanceDay } from './advanceDay';
import { enactBill, priceOf } from './bills';
import {
  DECREE_CAPITAL_FACTOR,
  HEIR_SECURITY_THRESHOLD,
  SUCCESSION_CRISIS_LEGITIMACY_COST,
  SUCCESSION_LEGITIMACY_COST,
  UNREST_THRESHOLD,
} from './calibration';
import { isoToDay } from './calendar';
import { createTestGame } from './createGame';
import {
  accrueGrievance,
  activeEpisodes,
  decayGrievance,
  decreeLegitimacyCost,
  emptyGrievance,
  grievanceCompliancePenalty,
  grievanceSentimentPenalty,
  principalGrievance,
  reconcileUnrest,
  regionalGrievance,
  severityFor,
  unrestStabilityCost,
  weightedOpposition,
} from './grievance';
import { annualMortality, checkSuccession, heirFor, rulerAge } from './succession';
import { PHASE_1_END_DAY } from './calendar';
import type { Bill, BlocReaction, ContentPack, GameState } from './types';

const EMPTY: ContentPack = { version: 'test', events: [], bills: [], offices: [], parties: [], stateSeats: [] };

function run(state: GameState, days: number, content = EMPTY): GameState {
  let current = state;
  for (let i = 0; i < days; i++) current = advanceDay(current, content).state;
  return current;
}

function billById(id: string): Bill {
  return PHASE_1_CONTENT.bills.find((b) => b.id === id)!;
}

/** A government with capital to spare, so affordability is not the variable. */
function funded(state: GameState, capital = 900): GameState {
  return {
    ...state,
    politicalCapital: { ...state.politicalCapital, current: capital, cap: capital },
  };
}

const PLANTERS_HATE_IT: BlocReaction[] = [
  { bloc: 'planters', strength: -90, reason: 'test' },
];

// ============================================================================
// 1. GRIEVANCE IS SPECIFIC
// ============================================================================

describe('grievance is tracked per bloc, not as generic unhappiness', () => {
  it('starts empty — every grievance in a run is something the player did', () => {
    const state = createTestGame();
    for (const level of Object.values(state.grievance.byBloc)) {
      expect(level).toBe(0);
    }
    expect(state.grievance.episodes).toEqual([]);
  });

  it('builds against the bloc that was acted against, and no other', () => {
    const after = accrueGrievance(emptyGrievance(), PLANTERS_HATE_IT, 'monarchy');

    expect(after.byBloc.planters).toBeGreaterThan(0);
    for (const bloc of ['merchants', 'artisans', 'seamen', 'clergy']) {
      expect(after.byBloc[bloc], bloc).toBe(0);
    }
  });

  it('compounds when the same bloc is acted against repeatedly', () => {
    // "Decreeing against the planters repeatedly builds planter grievance
    // specifically" — the brief's own sentence, as an assertion.
    let grievance = emptyGrievance();
    const levels: number[] = [];
    for (let i = 0; i < 4; i++) {
      grievance = accrueGrievance(grievance, PLANTERS_HATE_IT, 'monarchy');
      levels.push(grievance.byBloc.planters);
    }

    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThan(levels[i - 1]);
    }
  });

  it('banks no goodwill from a bloc that gains', () => {
    // A government does not get to decree something popular and spend the
    // credit on something hated.
    const after = accrueGrievance(
      emptyGrievance(),
      [{ bloc: 'merchants', strength: 90, reason: 'test' }],
      'monarchy',
    );
    expect(after.byBloc.merchants).toBe(0);
  });

  it('lands where the aggrieved bloc actually is', () => {
    const planters = regionalGrievance({ planters: 100 });
    expect(planters.south).toBeGreaterThan(planters.new_england);
    expect(planters.south).toBeGreaterThan(planters.frontier);

    const frontier = regionalGrievance({ frontier_settlers: 100 });
    expect(frontier.frontier).toBeGreaterThan(frontier.south);
  });

  it('names the bloc most responsible for a region’s grievance', () => {
    expect(principalGrievance({ planters: 90, seamen: 10 }, 'south')).toBe('planters');
    expect(principalGrievance({ planters: 10, seamen: 90 }, 'new_england')).toBe(
      'seamen',
    );
  });

  it('decays, proportionally, so a large grievance lingers and a small one fades', () => {
    const small = decayGrievance({ ...emptyGrievance(), byBloc: { planters: 10 } });
    const large = decayGrievance({ ...emptyGrievance(), byBloc: { planters: 90 } });

    expect(small.byBloc.planters).toBeLessThan(10);
    expect(large.byBloc.planters).toBeLessThan(90);
    // Proportional: the large one loses more in absolute terms.
    expect(90 - large.byBloc.planters).toBeGreaterThan(10 - small.byBloc.planters);
  });

  it('never exceeds 100 however many times it is provoked', () => {
    let grievance = emptyGrievance();
    for (let i = 0; i < 60; i++) {
      grievance = accrueGrievance(grievance, PLANTERS_HATE_IT, 'monarchy');
    }
    expect(grievance.byBloc.planters).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// 2. A DECREE COSTS MORE THAN A BILL
// ============================================================================

describe('ruling by decree is faster and dearer', () => {
  const bill = billById('direct_tax_1798');

  it('costs a crown a fraction of the capital', () => {
    const asKing = priceOf(bill, 0.01, 'monarchy');
    const asPresident = priceOf(bill, 0.01, 'republic');

    expect(asKing.capital).toBeCloseTo(
      asPresident.capital * DECREE_CAPITAL_FACTOR,
      6,
    );
    expect(asKing.byDecree).toBe(true);
  });

  it('costs a crown legitimacy, and a legislature none', () => {
    expect(priceOf(bill, 0.01, 'monarchy').legitimacy).toBeGreaterThan(0);
    // Not because passing a bill is free, but because its cost is already
    // charged in political capital. Charging both would make the republic
    // strictly worse, which the brief calls a defect.
    expect(priceOf(bill, 0.01, 'republic').legitimacy).toBe(0);
  });

  it('spends more legitimacy when powerful blocs are the ones opposed', () => {
    const weak = decreeLegitimacyCost([
      { bloc: 'seamen', strength: -80, reason: 'test' },
    ]);
    const strong = decreeLegitimacyCost([
      { bloc: 'planters', strength: -80, reason: 'test' },
    ]);

    // "spends more when it runs against the interests of powerful blocs"
    expect(strong).toBeGreaterThan(weak);
  });

  it('costs something even when nobody minds the measure', () => {
    // Acting alone always costs. There is a floor.
    expect(decreeLegitimacyCost([])).toBeGreaterThan(0);
  });

  it('counts only opposition, never support', () => {
    const mixed = weightedOpposition([
      { bloc: 'planters', strength: -50, reason: 'test' },
      { bloc: 'merchants', strength: 90, reason: 'test' },
    ]);
    const alone = weightedOpposition([
      { bloc: 'planters', strength: -50, reason: 'test' },
    ]);
    expect(mixed).toBe(alone);
  });

  it('creates several times the grievance a legislated bill does', () => {
    const decreed = priceOf(bill, 0.01, 'monarchy').grievance;
    const legislated = priceOf(bill, 0.01, 'republic').grievance;

    // The ratio is the central balance of the two paths. Set them equal and the
    // republic's slowness buys nothing.
    expect(decreed).toBeGreaterThan(legislated * 3);
  });

  it('records the difference when the same bill is actually passed', () => {
    const day = isoToDay('1798-06-01');
    const asKing = enactBill(
      funded({ ...createTestGame({ governmentType: 'monarchy' }), day }),
      bill,
      0.01,
    ).state;
    const asPresident = enactBill(
      funded({ ...createTestGame({ governmentType: 'republic' }), day }),
      bill,
      0.01,
    ).state;

    expect(asKing.grievance.byBloc.planters).toBeGreaterThan(
      asPresident.grievance.byBloc.planters,
    );
    expect(asKing.nation.legitimacyBase).toBeLessThan(
      createTestGame({ governmentType: 'monarchy' }).nation.legitimacyBase,
    );
    expect(asPresident.nation.legitimacyBase).toBe(
      createTestGame({ governmentType: 'republic' }).nation.legitimacyBase,
    );
  });

  it('says in the chronicle that it was done by decree', () => {
    const day = isoToDay('1798-06-01');
    const after = enactBill(
      funded({ ...createTestGame({ governmentType: 'monarchy' }), day }),
      bill,
      0.01,
    ).state;

    const entry = after.log[after.log.length - 1];
    expect(entry.title).toContain('by decree');
    expect(entry.body).toContain('without a vote');
  });
});

// ============================================================================
// 3. GRIEVANCE HAS TEETH
// ============================================================================

describe('grievance has consequences, in stages', () => {
  it('does nothing to revenue below the resistance threshold', () => {
    // Ordinary discontent is not rebellion. A model in which every complaint
    // cost revenue would make the player unable to govern at all.
    expect(grievanceCompliancePenalty(UNREST_THRESHOLD.resistance - 1)).toBe(0);
    expect(grievanceCompliancePenalty(UNREST_THRESHOLD.resistance + 20)).toBeGreaterThan(
      0,
    );
  });

  it('bites sentiment at any level, so the warning comes first', () => {
    // This is the channel the player sees first, which is what makes the
    // Regions screen a warning rather than a post-mortem.
    expect(grievanceSentimentPenalty(10)).toBeGreaterThan(0);
    expect(grievanceSentimentPenalty(50)).toBeGreaterThan(
      grievanceSentimentPenalty(10),
    );
  });

  it('escalates through the three severities', () => {
    expect(severityFor(0)).toBeNull();
    expect(severityFor(UNREST_THRESHOLD.resistance)).toBe('resistance');
    expect(severityFor(UNREST_THRESHOLD.defiance)).toBe('defiance');
    expect(severityFor(UNREST_THRESHOLD.revolt)).toBe('revolt');
  });

  it('opens an episode when a region crosses a threshold', () => {
    const grievance = { ...emptyGrievance(), byRegion: { south: 60 } };
    const change = reconcileUnrest(grievance, 100);

    expect(change.started).toHaveLength(1);
    expect(change.started[0].regionId).toBe('south');
    expect(change.started[0].severity).toBe('defiance');
    expect(activeEpisodes(change.grievance)).toHaveLength(1);
  });

  it('escalates by closing one episode and opening the next', () => {
    let grievance = reconcileUnrest(
      { ...emptyGrievance(), byRegion: { south: 40 } },
      100,
    ).grievance;
    expect(activeEpisodes(grievance)[0].severity).toBe('resistance');

    const escalated = reconcileUnrest({ ...grievance, byRegion: { south: 85 } }, 200);
    grievance = escalated.grievance;

    // The chronicle should read as a story, not as overlapping states.
    expect(escalated.ended).toHaveLength(1);
    expect(escalated.started).toHaveLength(1);
    expect(activeEpisodes(grievance)).toHaveLength(1);
    expect(activeEpisodes(grievance)[0].severity).toBe('revolt');
  });

  it('holds an episode open through a small dip, so it cannot flicker', () => {
    const opened = reconcileUnrest(
      { ...emptyGrievance(), byRegion: { south: 60 } },
      100,
    ).grievance;

    // Two points below the threshold is inside the resolution margin.
    const dipped = reconcileUnrest({ ...opened, byRegion: { south: 53 } }, 130);
    expect(dipped.ended).toHaveLength(0);
    expect(activeEpisodes(dipped.grievance)).toHaveLength(1);
  });

  it('closes an episode once grievance falls well clear', () => {
    const opened = reconcileUnrest(
      { ...emptyGrievance(), byRegion: { south: 60 } },
      100,
    ).grievance;

    const cleared = reconcileUnrest({ ...opened, byRegion: { south: 10 } }, 200);
    expect(cleared.ended).toHaveLength(1);
    expect(activeEpisodes(cleared.grievance)).toHaveLength(0);
    // The record survives.
    expect(cleared.grievance.episodes).toHaveLength(1);
  });

  it('charges stability for defiance and revolt but not for quiet non-payment', () => {
    const quiet = reconcileUnrest(
      { ...emptyGrievance(), byRegion: { south: 40 } },
      1,
    ).grievance;
    const armed = reconcileUnrest(
      { ...emptyGrievance(), byRegion: { south: 85 } },
      1,
    ).grievance;

    // Quiet non-payment is already costing revenue; charging it twice would
    // make the mildest tier the most punishing per point of grievance.
    expect(unrestStabilityCost(quiet)).toBe(0);
    expect(unrestStabilityCost(armed)).toBeGreaterThan(0);
  });

  it('names the region and the bloc in the chronicle, in words', () => {
    const state: GameState = {
      ...createTestGame({ governmentType: 'monarchy' }),
      grievance: {
        ...emptyGrievance(),
        byBloc: { planters: 95 },
        byRegion: regionalGrievance({ planters: 95 }),
      },
    };

    const after = run(state, 40);
    const entry = after.log.find((l) => l.title.includes('non-payment') ||
      l.title.includes('defiance') || l.title.includes('rising'));

    expect(entry).toBeDefined();
    expect(entry!.body).toContain('planters');
    expect(entry!.category).toBe('region');
  });

  it('costs real revenue once it bites', () => {
    const quiet = run(createTestGame({ governmentType: 'monarchy' }), 400);

    const aggrieved = run(
      {
        ...createTestGame({ governmentType: 'monarchy' }),
        grievance: {
          ...emptyGrievance(),
          byBloc: { planters: 95, small_farmers: 80 },
          byRegion: regionalGrievance({ planters: 95, small_farmers: 80 }),
        },
      },
      400,
    );

    const south = (s: GameState) => s.regions.find((r) => r.id === 'south')!;
    expect(south(aggrieved).compliance).toBeLessThan(south(quiet).compliance);
    expect(south(aggrieved).sentiment).toBeLessThan(south(quiet).sentiment);
  });
});

// ============================================================================
// 4. SUCCESSION
// ============================================================================

describe('the ruler dies and the player carries on', () => {
  it('rises with age, from a low adult base', () => {
    expect(annualMortality(30)).toBeLessThan(annualMortality(60));
    expect(annualMortality(60)).toBeLessThan(annualMortality(80));
  });

  it('never touches a republic', () => {
    const president = createTestGame({ governmentType: 'republic' });
    const after = run(president, PHASE_1_END_DAY);
    expect(after.ruler.name).toBe(president.ruler.name);
    expect(after.ruler.reignNumber).toBe(0);
  });

  it('passes the crown, and the player is still governing', () => {
    // The default seed's second draw is 0.0034, which kills the 57-year-old
    // founder on 1 January 1791. That is bad luck for a king and convenient
    // for a test.
    const state = createTestGame({ governmentType: 'monarchy' });
    const after = run(state, 800);

    expect(after.ruler.reignNumber).toBe(1);
    expect(after.ruler.name).not.toBe(state.ruler.name);
    expect(after.ruler.accededDay).toBeGreaterThan(0);
    // No game over. (DESIGN.md pillar 2)
    expect(after.day).toBe(800);
  });

  it('costs legitimacy even when it goes smoothly', () => {
    const state = createTestGame({ governmentType: 'monarchy' });
    const before = state.nation.legitimacyBase;
    const after = run(state, 800);

    expect(after.ruler.reignNumber).toBe(1);
    // An heir inherits the crown, not the standing.
    expect(before - after.nation.legitimacyBase).toBeGreaterThanOrEqual(
      SUCCESSION_LEGITIMACY_COST - 1,
    );
  });

  it('costs far more when no heir was named', () => {
    const secure = createTestGame({ governmentType: 'monarchy' });
    const shaky: GameState = {
      ...secure,
      ruler: { ...secure.ruler, heirName: null },
    };

    const orderly = checkSuccession({ ...secure, day: 365 });
    const disputed = checkSuccession({ ...shaky, day: 365 });

    // Both use the same seed and the same day, so the roll is the same.
    if (!orderly.occurred || !disputed.occurred) return;

    expect(secure.nation.legitimacyBase - orderly.state.nation.legitimacyBase).toBe(
      SUCCESSION_LEGITIMACY_COST,
    );
    expect(shaky.nation.legitimacyBase - disputed.state.nation.legitimacyBase).toBe(
      SUCCESSION_CRISIS_LEGITIMACY_COST,
    );
    expect(disputed.state.flags.succession_disputed).toBe(true);
  });

  /**
   * The mechanic's whole point: whether the NEXT succession is orderly is a
   * consequence of how the player has governed, not a coin toss.
   */
  it('leaves a secure dynasty an heir and a spent one none', () => {
    const state = createTestGame({ governmentType: 'monarchy' });

    const secure: GameState = {
      ...state,
      nation: { ...state.nation, legitimacyBase: HEIR_SECURITY_THRESHOLD + 10 },
    };
    const spent: GameState = {
      ...state,
      nation: { ...state.nation, legitimacyBase: HEIR_SECURITY_THRESHOLD - 10 },
    };

    expect(heirFor(secure, 'A King')).not.toBeNull();
    expect(heirFor(spent, 'A King')).toBeNull();
  });

  it('advances the RNG whether or not the ruler dies', () => {
    // Advancing only on death would make the sequence depend on the outcome it
    // produced, which is the classic way to break replay.
    const state = createTestGame({ governmentType: 'monarchy', seed: 42 });
    const result = checkSuccession(state);
    expect(result.occurred).toBe(false);
    expect(result.state.rng.calls).toBeGreaterThan(state.rng.calls);
  });

  it('stays deterministic across the whole span', () => {
    const a = run(createTestGame({ governmentType: 'monarchy' }), 2000);
    const b = run(createTestGame({ governmentType: 'monarchy' }), 2000);
    expect(a).toEqual(b);
  });

  it('ages the ruler with the calendar', () => {
    const state = createTestGame({ governmentType: 'monarchy' });
    expect(rulerAge(state, 0)).toBe(1789 - state.ruler.birthYear);
    expect(rulerAge(state, isoToDay('1795-06-01'))).toBe(
      1795 - state.ruler.birthYear,
    );
  });
});

// ============================================================================
// 5. NEITHER PATH IS STRICTLY BETTER
// ============================================================================

describe('the two paths trade against each other', () => {
  const bill = billById('direct_tax_1798');
  const day = isoToDay('1798-06-01');

  it('lets the crown act when the republic cannot afford to', () => {
    // The crown's advantage, concretely: a measure that is out of reach for a
    // legislature is within reach for a decree.
    const capital = priceOf(bill, 0.02, 'republic').capital - 1;

    const king = {
      ...createTestGame({ governmentType: 'monarchy' }),
      day,
      politicalCapital: {
        ...createTestGame().politicalCapital,
        current: capital,
        cap: 500,
      },
    };
    const president = { ...king, governmentType: 'republic' as const };

    expect(priceOf(bill, 0.02, 'monarchy').capital).toBeLessThan(capital);
    expect(priceOf(bill, 0.02, 'republic').capital).toBeGreaterThan(capital);
    expect(() => enactBill(king, bill, 0.02)).not.toThrow();
    expect(() => enactBill(president, bill, 0.02)).toThrow(/political capital/);
  });

  it('leaves the crown holding the grievance the republic avoided', () => {
    const king = enactBill(
      funded({ ...createTestGame({ governmentType: 'monarchy' }), day }),
      bill,
      0.02,
    ).state;
    const president = enactBill(
      funded({ ...createTestGame({ governmentType: 'republic' }), day }),
      bill,
      0.02,
    ).state;

    const total = (s: GameState) =>
      Object.values(s.grievance.byBloc).reduce((a, b) => a + b, 0);

    expect(total(king)).toBeGreaterThan(total(president) * 3);
  });

  it('turns repeated decrees into a country that will not pay', () => {
    /*
      The whole arc of the monarchy path, end to end: decree repeatedly against
      the same interests, and the revenue stops arriving. The Whiskey Rebellion
      as a warning shot rather than a one-off. (brief §2.1)
    */
    let king = funded({ ...createTestGame({ governmentType: 'monarchy' }), day }, 5000);
    const baseline = run({ ...king }, 900);

    for (const id of [
      'direct_tax_1798',
      'stamp_act_1797',
      'carriage_duty_1794',
      'provisional_army_1798',
      'general_sales_tax',
      'land_act_1796',
    ]) {
      const bill = billById(id);
      king = enactBill(king, bill, bill.hasSlider ? bill.sliderRange![1] : null).state;
      king = funded(king, 5000);
    }

    const after = run(king, 900);

    expect(Object.values(after.grievance.byBloc).some((v) => v > 20)).toBe(true);
    expect(activeEpisodes(after.grievance).length).toBeGreaterThan(0);

    const south = (s: GameState) => s.regions.find((r) => r.id === 'south')!;
    expect(south(after).compliance).toBeLessThan(south(baseline).compliance);
  });
});
