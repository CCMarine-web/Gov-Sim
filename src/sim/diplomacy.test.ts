/**
 * DIPLOMACY
 *
 * Phase 2 brief §7, queue item 11. Five claims a test should be able to
 * falsify:
 *
 *   1. The world of 1789 is not neutral, and starts as it was: Britain cool,
 *      France warm, Algiers hostile.
 *   2. Treaties flow through the SAME LEDGER as everything else. "They must
 *      flow through the same model, not a parallel one."
 *   3. A treaty that cannot be signed says why, in the same contract bills have.
 *   4. Tribute is a real, recurring charge on the Treasury.
 *   5. The data-integrity rule applies to foreign powers exactly as to our own:
 *      cited or honestly gapped, and nothing in between.
 */

import { describe, expect, it } from 'vitest';
import { PHASE_1_CONTENT } from '@/content';
import { POWERS, POWER_BY_ID } from '@/content/diplomacy/powers';
import { TREATIES, TREATY_BY_ID } from '@/content/diplomacy/treaties';
import { advanceDay, resolveDecision } from './advanceDay';
import { isoToDay } from './calendar';
import { ENVOY_CAPITAL_COST, TREATY_BREACH_LEGITIMACY_COST } from './calibration';
import { createTestGame } from './createGame';
import {
  annualTribute,
  breachTreaty,
  decayRelations,
  hasTreaty,
  relationWith,
  relationWord,
  rulerOn,
  seedDiplomacy,
  sendEnvoy,
  shiftRelation,
  signTreaty,
  treatiesInForce,
  treatyStatus,
} from './diplomacy';
import { explainStat } from './modifiers';
import type { GameState } from './types';

function funded(day = isoToDay('1795-01-01')): GameState {
  const base = createTestGame();
  return {
    ...base,
    day,
    politicalCapital: { ...base.politicalCapital, current: 1000, cap: 1000 },
    treasury: { ...base.treasury, balance: 20_000_000 },
  };
}

function run(state: GameState, days: number): GameState {
  let current = state;
  for (let i = 0; i < days; i++) {
    current = advanceDay(current, PHASE_1_CONTENT).state;
    while (current.eventState.pendingDecisions.length > 0) {
      const pending = current.eventState.pendingDecisions[0];
      const event = PHASE_1_CONTENT.events.find((e) => e.id === pending.eventId)!;
      current = resolveDecision(
        current,
        PHASE_1_CONTENT,
        pending.eventId,
        event.options[0].id,
      ).state;
    }
  }
  return current;
}

// ============================================================================
// 1. THE WORLD OF 1789
// ============================================================================

describe('the world starts as it was, not neutral', () => {
  it('has Britain cool, France warm and Algiers hostile', () => {
    const state = createTestGame();

    // Britain still holds the northwestern forts; France is owed both money and
    // gratitude; Algiers is taking American ships.
    expect(relationWith(state, 'britain')).toBeLessThan(0);
    expect(relationWith(state, 'france')).toBeGreaterThan(30);
    expect(relationWith(state, 'algiers')).toBeLessThan(-40);
    // And Morocco, alone among the Barbary states, is at peace with us.
    expect(relationWith(state, 'morocco')).toBeGreaterThan(0);
  });

  it('gives every power a relation, with no treaty and no tribute', () => {
    const state = createTestGame();

    for (const power of POWERS) {
      expect(state.diplomacy.relations[power.id], power.id).toBeDefined();
      expect(state.diplomacy.relations[power.id].atWar).toBe(false);
    }
    expect(state.diplomacy.treaties).toEqual([]);
    expect(annualTribute(state)).toBe(0);
  });

  it('knows who governs a power on a given day', () => {
    const france = POWER_BY_ID.france;

    expect(rulerOn(france, isoToDay('1791-01-01'))?.name).toBe('Louis XVI');
    expect(rulerOn(france, isoToDay('1794-01-01'))?.name).toBe(
      'The National Convention',
    );
    expect(rulerOn(france, isoToDay('1796-06-01'))?.name).toBe('The Directory');
    expect(rulerOn(france, isoToDay('1800-01-01'))?.name).toBe('Napoleon Bonaparte');
  });

  it('gives a relation a word, so it is never a bare number', () => {
    expect(relationWord(-90)).toBe('Hostile');
    expect(relationWord(0)).toBe('Correct');
    expect(relationWord(85)).toContain('Allied');
  });
});

// ============================================================================
// 2. TREATIES USE THE SAME LEDGER
// ============================================================================

describe('a treaty acts on the economy through the ledger, like a statute', () => {
  it('writes modifiers the ordinary breakdown can explain', () => {
    const before = funded();
    const treaty = TREATY_BY_ID.pinckney_treaty;
    const { state, ok } = signTreaty(before, treaty);

    expect(ok).toBe(true);

    // Same ledger, same targets, same explanation path as a bill's effects.
    const breakdown = explainStat(
      'region.frontier.prosperity',
      50,
      state.activeModifiers,
      state.day + treaty.phaseInDays,
    );
    const contribution = breakdown.contributions.find(
      (c) => c.source === treaty.name,
    );

    expect(contribution).toBeDefined();
    expect(contribution!.sourceType).toBe('treaty');
    expect(contribution!.effect).toBeGreaterThan(0);
  });

  it('phases in rather than landing whole on the day it is signed', () => {
    const treaty = TREATY_BY_ID.pinckney_treaty;
    const { state } = signTreaty(funded(), treaty);

    const onTheDay = explainStat(
      'region.frontier.prosperity',
      50,
      state.activeModifiers,
      state.day,
    );
    const later = explainStat(
      'region.frontier.prosperity',
      50,
      state.activeModifiers,
      state.day + treaty.phaseInDays,
    );

    // A treaty takes effect at the pace of ships and customs houses.
    expect(onTheDay.total).toBeLessThan(later.total);
  });

  it('actually moves the country when the months pass', () => {
    const treaty = TREATY_BY_ID.pinckney_treaty;
    const control = run(funded(), 900);
    const signed = run(signTreaty(funded(), treaty).state, 900);

    // The Mississippi opens, and the west is the better for it.
    const before = control.regions.find((r) => r.id === 'frontier')!;
    const after = signed.regions.find((r) => r.id === 'frontier')!;
    expect(after.prosperity).toBeGreaterThan(before.prosperity);
    expect(after.sentiment).toBeGreaterThan(before.sentiment);
  });

  it('takes its effects back out of the ledger when it is repudiated', () => {
    const treaty = TREATY_BY_ID.pinckney_treaty;
    const signed = signTreaty(funded(), treaty).state;
    const { state: broken, ok } = breachTreaty(signed, treaty.id);

    expect(ok).toBe(true);
    // A ledger that kept applying a treaty no longer in force would be lying.
    expect(
      broken.activeModifiers.some((m) => m.source === treaty.name),
    ).toBe(false);
    // But the country remembers. Relations fall hard, and so does standing.
    expect(relationWith(broken, 'spain')).toBeLessThan(relationWith(signed, 'spain'));
    expect(broken.nation.legitimacyBase).toBe(
      signed.nation.legitimacyBase - TREATY_BREACH_LEGITIMACY_COST,
    );
  });

  it('displeases the other side when it pleases one', () => {
    const before = funded();
    const { state } = signTreaty(before, TREATY_BY_ID.jay_treaty);

    // France read the Jay Treaty as a betrayal of the alliance, and said so.
    expect(relationWith(state, 'britain')).toBeGreaterThan(relationWith(before, 'britain'));
    expect(relationWith(state, 'france')).toBeLessThan(relationWith(before, 'france'));
  });
});

// ============================================================================
// 3. A REFUSAL EXPLAINS ITSELF
// ============================================================================

describe('a treaty that cannot be signed says why', () => {
  it('refuses one whose moment has not come', () => {
    const early = { ...funded(isoToDay('1790-01-01')) };
    const status = treatyStatus(early, TREATY_BY_ID.jay_treaty);

    expect(status.kind).toBe('notYet');
  });

  it('refuses one whose moment has passed', () => {
    const late = funded(isoToDay('1799-01-01'));
    const status = treatyStatus(late, TREATY_BY_ID.jay_treaty);

    expect(status.kind).toBe('tooLate');
  });

  it('refuses when relations are too poor, and says how much is needed', () => {
    const state = funded();
    const status = treatyStatus(state, TREATY_BY_ID.commercial_treaty_britain);

    expect(status.kind).toBe('relationTooLow');
    if (status.kind === 'relationTooLow') {
      expect(status.needed).toBeGreaterThan(status.have);
    }
  });

  it('names the treaty that has to come first', () => {
    const state = { ...funded(), diplomacy: { ...funded().diplomacy } };
    const boosted = {
      ...state,
      diplomacy: shiftRelation(state.diplomacy, 'britain', 100),
    };

    const status = treatyStatus(boosted, TREATY_BY_ID.commercial_treaty_britain);
    expect(status.kind).toBe('blocked');
    if (status.kind === 'blocked') {
      expect(status.reasons.join(' ')).toContain('Amity');
    }
  });

  it('will not sign what cannot be afforded', () => {
    const poor: GameState = {
      ...funded(),
      politicalCapital: { ...funded().politicalCapital, current: 1 },
    };

    const { ok, reason } = signTreaty(poor, TREATY_BY_ID.pinckney_treaty);
    expect(ok).toBe(false);
    expect(reason).toContain('political capital');
  });
});

// ============================================================================
// 4. ENVOYS AND TRIBUTE
// ============================================================================

describe('working at a relationship costs, and stopping loses it', () => {
  it('buys a little, for real capital', () => {
    const before = funded();
    const { state, ok } = sendEnvoy(before, 'britain');

    expect(ok).toBe(true);
    expect(relationWith(state, 'britain')).toBeGreaterThan(
      relationWith(before, 'britain'),
    );
    expect(state.politicalCapital.current).toBe(
      before.politicalCapital.current - ENVOY_CAPITAL_COST,
    );
  });

  it('drifts back toward a power’s own baseline, not toward zero', () => {
    const state = funded();
    let diplomacy = shiftRelation(state.diplomacy, 'britain', 60);
    const lifted = diplomacy.relations.britain.relation;

    for (let i = 0; i < 60; i++) diplomacy = decayRelations(diplomacy);

    const baseline = POWER_BY_ID.britain.startingRelation;
    // Five years of neglect takes back most of what a decade of missions bought.
    expect(diplomacy.relations.britain.relation).toBeLessThan(lifted);
    expect(diplomacy.relations.britain.relation).toBeGreaterThan(baseline - 1);
  });

  it('never lets a relation leave its range', () => {
    let diplomacy = seedDiplomacy();
    for (let i = 0; i < 200; i++) diplomacy = shiftRelation(diplomacy, 'france', 50);
    expect(diplomacy.relations.france.relation).toBe(100);

    for (let i = 0; i < 400; i++) diplomacy = shiftRelation(diplomacy, 'france', -50);
    expect(diplomacy.relations.france.relation).toBe(-100);
  });
});

describe('tribute is a real charge on the treasury', () => {
  it('starts when the treaty is signed and shows up in the outlays', () => {
    const before = funded();
    const treaty = TREATY_BY_ID.treaty_with_algiers;
    const { state } = signTreaty(before, treaty);

    expect(annualTribute(state)).toBe(treaty.annualTribute);

    // And it lands in the civil list, not in some separate channel.
    const settled = run(state, 40);
    const control = run(before, 40);
    expect(settled.treasury.annualisedOutlays.civil).toBeGreaterThan(
      control.treasury.annualisedOutlays.civil,
    );
  });

  it('costs the treasury its one-off price on the day', () => {
    const before = funded();
    const treaty = TREATY_BY_ID.treaty_with_algiers;
    const { state } = signTreaty(before, treaty);

    expect(state.treasury.balance).toBe(before.treasury.balance - treaty.treasuryCost);
  });

  it('stops when the treaty does', () => {
    const treaty = TREATY_BY_ID.treaty_with_algiers;
    const signed = signTreaty(funded(), treaty).state;
    const broken = breachTreaty(signed, treaty.id).state;

    expect(annualTribute(broken)).toBe(0);
  });
});

// ============================================================================
// 5. THE DATA-INTEGRITY RULE APPLIES ABROAD TOO
// ============================================================================

describe('foreign figures are cited or honestly gapped, never in between', () => {
  it('gives every power either a sourced population or a stated reason', () => {
    for (const power of POWERS) {
      if (power.population) {
        expect(power.population.source.length, power.id).toBeGreaterThan(20);
        expect(power.population.asOf, power.id).toBeGreaterThan(1700);
        expect(power.populationGap, power.id).toBeNull();
      } else {
        // A null with no explanation is a gap the player cannot interpret.
        expect(power.populationGap, power.id).not.toBeNull();
        expect(power.populationGap!.length, power.id).toBeGreaterThan(20);
      }
    }
  });

  it('gives every power sources and real context', () => {
    for (const power of POWERS) {
      expect(power.sources.length, power.id).toBeGreaterThan(0);
      expect(power.context.length, power.id).toBeGreaterThan(150);
      expect(power.interests.length, power.id).toBeGreaterThan(0);
    }
  });

  it('treats Native nations as polities, with the same fields as Britain', () => {
    const native = POWERS.filter((p) => p.category === 'native_nation');
    expect(native.length).toBeGreaterThanOrEqual(5);

    for (const nation of native) {
      // Same shape, same requirements, no special case.
      expect(nation.rulers.length, nation.id).toBeGreaterThan(0);
      expect(nation.interests.length, nation.id).toBeGreaterThan(0);
      expect(nation.sources.length, nation.id).toBeGreaterThan(0);
      // And a real military capacity, because they had one.
      expect(nation.landStrength, nation.id).toBeGreaterThan(0);
    }

    // The confederacy that destroyed two American armies is not a rounding error.
    expect(POWER_BY_ID.northwest_confederacy.landStrength).toBeGreaterThan(40);
  });

  it('gives every treaty a note long enough to say something factual', () => {
    for (const treaty of TREATIES) {
      expect(treaty.historicalNote.length, treaty.id).toBeGreaterThan(150);
      expect(treaty.sources.length, treaty.id).toBeGreaterThan(0);
      expect(POWER_BY_ID[treaty.powerId], treaty.id).toBeDefined();

      // An enacted treaty must carry the date it was actually concluded.
      if (treaty.historicity === 'enacted') {
        expect(treaty.historicalDate, treaty.id).not.toBeNull();
      }
    }
  });

  it('does not let a counterfactual pretend to be history', () => {
    for (const treaty of TREATIES) {
      if (treaty.historicity === 'counterfactual') {
        expect(treaty.historicalDate, treaty.id).toBeNull();
      }
    }
  });
});

// ============================================================================
// THE ENGINE RULES
// ============================================================================

describe('diplomacy obeys the architecture rules', () => {
  it('round-trips through JSON losslessly', () => {
    const signed = signTreaty(funded(), TREATY_BY_ID.pinckney_treaty).state;
    const state = run(signed, 200);
    const copy = JSON.parse(JSON.stringify(state)) as GameState;

    expect(copy.diplomacy).toEqual(state.diplomacy);
  });

  it('is deterministic', () => {
    const a = run(createTestGame({ seed: 11 }), 400);
    const b = run(createTestGame({ seed: 11 }), 400);
    expect(a.diplomacy).toEqual(b.diplomacy);
  });

  it('keeps treaties in force queryable by day', () => {
    const treaty = TREATY_BY_ID.pinckney_treaty;
    const signed = signTreaty(funded(), treaty).state;

    expect(hasTreaty(signed, treaty.id)).toBe(true);
    expect(treatiesInForce(signed, 'spain')).toHaveLength(1);
    expect(treatiesInForce(signed, 'britain')).toHaveLength(0);

    const broken = breachTreaty(signed, treaty.id).state;
    expect(hasTreaty(broken, treaty.id)).toBe(false);
  });
});
