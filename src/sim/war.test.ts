/**
 * WAR
 *
 * Phase 2 brief §7, queue item 12. The brief is specific and this file tests it
 * clause by clause:
 *
 *   "A monarch declares war by decree. A republic requires a congressional
 *    declaration… Model the HOI4-style threshold gate: aggression without
 *    justification tanks legitimacy, invites foreign hostility, and in a
 *    republic can simply be voted down."
 *
 * So: five claims.
 *
 *   1. A crown declares and cannot be refused. A republic must carry both
 *      chambers and CAN be refused.
 *   2. The threshold gate is a spectrum, not a switch: cost rises as the case
 *      weakens, and a fabricated pretext is the worst deal available.
 *   3. Aggression invites foreign hostility — every other power, not only the
 *      victim.
 *   4. A grievance settled by treaty stops being grounds for war.
 *   5. A war is a state, not a campaign: it suppresses trade, wears the country
 *      down faster the worse the case was, and ends when the government ends it.
 */

import { describe, expect, it } from 'vitest';
import { PARTIES, PHASE_1_CONTENT } from '@/content';
import { CASUS_BELLI } from '@/content/diplomacy/casusBelli';
import { POWERS } from '@/content/diplomacy/powers';
import { TREATY_BY_ID } from '@/content/diplomacy/treaties';
import { advanceDay, resolveDecision } from './advanceDay';
import { isoToDay } from './calendar';
import {
  FABRICATION_CAPITAL_COST,
  UNJUSTIFIED_WAR_THRESHOLD,
  WAR_DECLARATION_CAPITAL,
} from './calibration';
import { evaluateAll } from './conditions';
import { createTestGame } from './createGame';
import { relationWith, signTreaty } from './diplomacy';
import { explainStat } from './modifiers';
import type { GameState, GovernmentType } from './types';
import {
  accrueWeariness,
  activeWars,
  availableGrounds,
  declarationCost,
  declareWar,
  fabricateClaim,
  groundsById,
  makePeace,
  peaceOnOffer,
  warWith,
} from './war';

function ready(
  governmentType: GovernmentType = 'monarchy',
  day = isoToDay('1795-01-01'),
): GameState {
  const base = createTestGame({ governmentType });
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
      // The first ELIGIBLE option: several are open only to a republic, and a
      // monarchy run reaching for one would throw.
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

// ============================================================================
// 1. THE TWO PATHS
// ============================================================================

describe('a crown declares, and a republic asks', () => {
  it('lets a monarchy declare at once, whatever anyone thinks', () => {
    const outcome = declareWar(ready('monarchy'), 'britain', 'impressment', PARTIES);

    expect(outcome.kind).toBe('declared');
    if (outcome.kind !== 'declared') return;
    expect(outcome.state.diplomacy.relations.britain.atWar).toBe(true);
    expect(activeWars(outcome.state)).toHaveLength(1);
  });

  it('puts a republic’s declaration to both chambers', () => {
    // A weak case against a power the country's commercial interests depend on
    // is exactly the war a legislature exists to refuse.
    const outcome = declareWar(
      ready('republic'),
      'britain',
      'fabricated:britain',
      PARTIES,
    );

    expect(outcome.kind).toBe('votedDown');
    if (outcome.kind !== 'votedDown') return;
    expect(outcome.state.diplomacy.relations.britain.atWar).toBe(false);
    expect(outcome.againstSeats).toBeGreaterThan(outcome.forSeats);
  });

  it('charges a republic for the attempt even when it fails', () => {
    const before = ready('republic');
    const outcome = declareWar(before, 'britain', 'fabricated:britain', PARTIES);

    expect(outcome.kind).toBe('votedDown');
    // Putting a measure and losing costs what putting it costs. A free attempt
    // would make the vote a free look at the count.
    expect(outcome.state.politicalCapital.current).toBe(
      before.politicalCapital.current - WAR_DECLARATION_CAPITAL,
    );
  });

  it('records the refusal in the chronicle with the division', () => {
    const outcome = declareWar(
      ready('republic'),
      'britain',
      'fabricated:britain',
      PARTIES,
    );
    if (outcome.kind !== 'votedDown') throw new Error('expected a refusal');

    const entry = outcome.state.log.find((l) => l.title.includes('declines to declare'));
    expect(entry).toBeDefined();
    expect(entry!.body).toMatch(/House|Senate/);
    expect(entry!.body).toContain('the peace');
  });

  it('carries a republic’s declaration when the country actually wants it', () => {
    /*
      A FARMING REPUBLIC CARRIES THE WARS ITS FARMERS WANT, and the model says
      so without being told to: the Mississippi and the Ohio boundary pass, and
      the maritime wars — Algiers, the French spoliations — do not, because the
      small farmers are most of every delegation and a navy is a permanent tax.
      That is a good likeness of the decade, in which Congress declared no
      maritime war at all and fought the Quasi-War without ever declaring it.
    */
    const outcome = declareWar(
      ready('republic'),
      'spain',
      'mississippi_closed',
      PARTIES,
    );

    expect(outcome.kind).toBe('declared');
  });

  it('lets a republic whip a war the country is against', () => {
    const state = ready('republic', isoToDay('1794-06-01'));

    // Unwhipped the Algerine war fails: the seamen and merchants want it, and
    // they are outnumbered by people for whom a navy is a permanent tax.
    expect(declareWar(state, 'algiers', 'algerine_captures', PARTIES).kind).toBe(
      'votedDown',
    );

    // Whipped hard it carries — at the ordinary price of whipping. A vote that
    // could never be moved would make the tools decoration.
    const whipped = declareWar(state, 'algiers', 'algerine_captures', PARTIES, {
      whip: { federalist: 45, democratic_republican: 45 },
      rider: null,
      logRoll: null,
    });
    expect(whipped.kind).toBe('declared');
  });
});

// ============================================================================
// 2. THE THRESHOLD GATE
// ============================================================================

describe('the cost of a war rises as the case for it weakens', () => {
  it('charges almost nothing in legitimacy for a strong case', () => {
    const strong = groundsById(ready(), 'algerine_captures')!;
    expect(strong.strength).toBeGreaterThan(UNJUSTIFIED_WAR_THRESHOLD);

    const cost = declarationCost(strong);
    expect(cost.legitimacy).toBe(0);
    expect(cost.unjustified).toBe(false);
  });

  it('charges in proportion to the shortfall, not as a switch', () => {
    const nearly = groundsById(ready(), 'mississippi_closed')!;
    const fabricated = groundsById(ready(), 'fabricated:spain')!;

    const nearCost = declarationCost(nearly);
    const fabCost = declarationCost(fabricated);

    // Just under the line costs a little. Nowhere near it costs a great deal.
    expect(nearCost.legitimacy).toBeGreaterThan(0);
    expect(fabCost.legitimacy).toBeGreaterThan(nearCost.legitimacy * 4);
  });

  it('actually takes the legitimacy when the war is declared', () => {
    const before = ready('monarchy');
    const cost = declarationCost(groundsById(before, 'fabricated:spain')!);
    const outcome = declareWar(before, 'spain', 'fabricated:spain', PARTIES);

    if (outcome.kind !== 'declared') throw new Error('expected a declaration');
    expect(outcome.state.nation.legitimacyBase).toBeCloseTo(
      before.nation.legitimacyBase - cost.legitimacy,
      6,
    );
  });

  it('makes a fabricated war the worst deal available', () => {
    const state = ready();
    for (const ground of availableGrounds(state, 'britain')) {
      if (ground.fabricated) continue;
      expect(declarationCost(ground).legitimacy).toBeLessThan(
        declarationCost(groundsById(state, 'fabricated:britain')!).legitimacy,
      );
    }
  });

  it('charges for preparing a pretext whether or not it is ever used', () => {
    const before = ready();
    const { state, ok } = fabricateClaim(before, 'spain');

    expect(ok).toBe(true);
    expect(state.politicalCapital.current).toBe(
      before.politicalCapital.current - FABRICATION_CAPITAL_COST,
    );
    expect(state.flags.fabricated_claim_spain).toBe(true);
  });
});

// ============================================================================
// 3. AGGRESSION INVITES FOREIGN HOSTILITY
// ============================================================================

describe('the rest of the world is watching', () => {
  it('turns every other power against a country that fabricates a pretext', () => {
    const before = ready('monarchy');
    const outcome = declareWar(before, 'spain', 'fabricated:spain', PARTIES);
    if (outcome.kind !== 'declared') throw new Error('expected a declaration');

    // "Invites foreign hostility" — a government that invents its reasons once
    // is a government nobody can safely sign anything with.
    for (const power of POWERS) {
      if (power.id === 'spain') continue;
      expect(
        relationWith(outcome.state, power.id),
        power.id,
      ).toBeLessThan(relationWith(before, power.id));
    }
  });

  it('leaves the others alone when the case is a good one', () => {
    const before = ready('monarchy', isoToDay('1794-06-01'));
    const outcome = declareWar(before, 'algiers', 'algerine_captures', PARTIES);
    if (outcome.kind !== 'declared') throw new Error('expected a declaration');

    expect(relationWith(outcome.state, 'britain')).toBe(relationWith(before, 'britain'));
    expect(relationWith(outcome.state, 'france')).toBe(relationWith(before, 'france'));
  });

  it('always turns the victim against us', () => {
    const before = ready('monarchy');
    const outcome = declareWar(before, 'britain', 'impressment', PARTIES);
    if (outcome.kind !== 'declared') throw new Error('expected a declaration');

    expect(relationWith(outcome.state, 'britain')).toBeLessThan(
      relationWith(before, 'britain'),
    );
  });
});

// ============================================================================
// 4. DIPLOMACY REMOVES GROUNDS FOR WAR
// ============================================================================

describe('a grievance settled is a war prevented', () => {
  it('takes the Mississippi off the table once Pinckney’s Treaty is in force', () => {
    const before = ready('monarchy');
    expect(
      availableGrounds(before, 'spain').some((g) => g.id === 'mississippi_closed'),
    ).toBe(true);

    const settled = signTreaty(before, TREATY_BY_ID.pinckney_treaty).state;
    expect(
      availableGrounds(settled, 'spain').some((g) => g.id === 'mississippi_closed'),
    ).toBe(false);
  });

  it('takes the posts off the table once the Jay Treaty is in force', () => {
    const before = ready('monarchy', isoToDay('1795-06-01'));
    const settled = signTreaty(before, TREATY_BY_ID.jay_treaty).state;

    expect(
      availableGrounds(settled, 'britain').some((g) => g.id === 'northwestern_forts'),
    ).toBe(false);
    // Impressment is NOT settled by it, because the treaty was silent on it.
    expect(
      availableGrounds(settled, 'britain').some((g) => g.id === 'impressment'),
    ).toBe(true);
  });

  it('leaves a manufactured claim always available, at its price', () => {
    const settled = signTreaty(ready(), TREATY_BY_ID.pinckney_treaty).state;
    const grounds = availableGrounds(settled, 'spain');

    // A player with no case can still have a war. The price is the model.
    expect(grounds.some((g) => g.fabricated)).toBe(true);
    expect(grounds[grounds.length - 1].fabricated).toBe(true);
  });

  it('offers nothing before its date', () => {
    const early = ready('monarchy', isoToDay('1790-01-01'));
    expect(
      availableGrounds(early, 'britain').some((g) => g.id === 'impressment'),
    ).toBe(false);
  });
});

// ============================================================================
// 5. A WAR IS A STATE, NOT A CAMPAIGN
// ============================================================================

describe('living with a war', () => {
  it('suppresses trade through the ledger, like everything else', () => {
    const outcome = declareWar(ready('monarchy'), 'britain', 'impressment', PARTIES);
    if (outcome.kind !== 'declared') throw new Error('expected a declaration');

    const breakdown = explainStat(
      'nation.tradeCapacity',
      1_000_000,
      outcome.state.activeModifiers,
      outcome.state.day,
    );
    const line = breakdown.contributions.find((c) => c.source.startsWith('War with'));

    expect(line).toBeDefined();
    expect(line!.effect).toBeLessThan(0);
  });

  it('wears the country down faster the worse the case was', () => {
    const good = declareWar(
      ready('monarchy', isoToDay('1794-06-01')),
      'algiers',
      'algerine_captures',
      PARTIES,
    );
    const bad = declareWar(ready('monarchy'), 'spain', 'fabricated:spain', PARTIES);
    if (good.kind !== 'declared' || bad.kind !== 'declared') {
      throw new Error('expected declarations');
    }

    let g = good.state;
    let b = bad.state;
    for (let i = 0; i < 12; i++) {
      g = accrueWeariness(g);
      b = accrueWeariness(b);
    }

    // A war the country believes in is endured. One it does not is resented
    // from the first month — which is what stops a bad war from being a single
    // payment at the declaration.
    expect(warWith(b, 'spain')!.weariness).toBeGreaterThan(
      warWith(g, 'algiers')!.weariness,
    );
  });

  it('accrues weariness monthly through the ordinary tick', () => {
    const outcome = declareWar(ready('monarchy'), 'britain', 'impressment', PARTIES);
    if (outcome.kind !== 'declared') throw new Error('expected a declaration');

    const later = run(outcome.state, 200);
    expect(warWith(later, 'britain')!.weariness).toBeGreaterThan(0);
  });

  it('ends when the government ends it, and takes the modifiers with it', () => {
    const outcome = declareWar(ready('monarchy'), 'britain', 'impressment', PARTIES);
    if (outcome.kind !== 'declared') throw new Error('expected a declaration');

    const { state, ok, terms } = makePeace(outcome.state, 'britain');

    expect(ok).toBe(true);
    expect(terms).not.toBeNull();
    expect(state.diplomacy.relations.britain.atWar).toBe(false);
    expect(warWith(state, 'britain')).toBeNull();
    expect(state.activeModifiers.some((m) => m.source.startsWith('War with'))).toBe(
      false,
    );
    // The record survives the peace, with how it ended.
    expect(state.diplomacy.wars[0].outcome).toBe(terms);
    expect(state.diplomacy.wars[0].endedDay).toBe(state.day);
  });

  it('offers worse terms as the country tires', () => {
    const outcome = declareWar(ready('monarchy'), 'britain', 'impressment', PARTIES);
    if (outcome.kind !== 'declared') throw new Error('expected a declaration');

    const fresh = peaceOnOffer(outcome.state, 'britain');
    const spent: GameState = {
      ...outcome.state,
      diplomacy: {
        ...outcome.state.diplomacy,
        wars: outcome.state.diplomacy.wars.map((w) => ({ ...w, weariness: 100 })),
      },
      nation: { ...outcome.state.nation, stability: 20, legitimacy: 20 },
    };

    const order = ['concession', 'settlement', 'victory'];
    expect(order.indexOf(peaceOnOffer(spent, 'britain'))).toBeLessThanOrEqual(
      order.indexOf(fresh),
    );
  });

  it('rewards a victory and punishes a capitulation, in standing', () => {
    const outcome = declareWar(ready('monarchy'), 'britain', 'impressment', PARTIES);
    if (outcome.kind !== 'declared') throw new Error('expected a declaration');

    const strong: GameState = {
      ...outcome.state,
      nation: { ...outcome.state.nation, stability: 100, legitimacy: 100 },
    };
    const weak: GameState = {
      ...outcome.state,
      nation: { ...outcome.state.nation, stability: 5, legitimacy: 5 },
      diplomacy: {
        ...outcome.state.diplomacy,
        wars: outcome.state.diplomacy.wars.map((w) => ({ ...w, weariness: 100 })),
      },
    };

    const won = makePeace(strong, 'britain');
    const lost = makePeace(weak, 'britain');

    expect(won.state.nation.legitimacyBase).toBeGreaterThan(
      lost.state.nation.legitimacyBase,
    );
  });

  it('refuses a second war with the same power', () => {
    const first = declareWar(ready('monarchy'), 'britain', 'impressment', PARTIES);
    if (first.kind !== 'declared') throw new Error('expected a declaration');

    const second = declareWar(first.state, 'britain', 'impressment', PARTIES);
    expect(second.kind).toBe('refused');
  });

  it('blocks treaties with a power we are at war with', () => {
    const outcome = declareWar(ready('monarchy'), 'spain', 'mississippi_closed', PARTIES);
    if (outcome.kind !== 'declared') throw new Error('expected a declaration');

    const { ok, reason } = signTreaty(outcome.state, TREATY_BY_ID.pinckney_treaty);
    expect(ok).toBe(false);
    expect(reason).toContain('war');
  });
});

// ============================================================================
// THE CONTENT
// ============================================================================

describe('the grounds for war are real and cited', () => {
  it('gives every casus belli a note long enough to say what it was', () => {
    for (const ground of CASUS_BELLI) {
      expect(ground.historicalNote.length, ground.id).toBeGreaterThan(200);
      expect(ground.sources.length, ground.id).toBeGreaterThan(0);
      expect(ground.blocReactions.length, ground.id).toBeGreaterThan(2);
      expect(ground.fabricated, ground.id).toBe(false);
    }
  });

  it('never lets a real grievance be silently one-sided', () => {
    // Every real war has somebody against it, and the model has to know who —
    // otherwise a republic could never refuse one.
    for (const ground of CASUS_BELLI) {
      expect(
        ground.blocReactions.some((r) => r.strength < 0),
        ground.id,
      ).toBe(true);
      expect(
        ground.blocReactions.some((r) => r.strength > 0),
        ground.id,
      ).toBe(true);
    }
  });

  it('says plainly what the Ohio war actually was', () => {
    const ohio = CASUS_BELLI.find((c) => c.id === 'ohio_boundary')!;

    // A game that let the player declare this war without saying what it was
    // would be laundering the record.
    expect(ohio.historicalNote).toContain('claimed the Ohio country by conquest');
    expect(ohio.historicalNote).toContain('war of conquest');
  });

  it('marks the manufactured claim as fiction, not history', () => {
    const fabricated = groundsById(createTestGame(), 'fabricated:britain')!;

    expect(fabricated.fabricated).toBe(true);
    expect(fabricated.sources).toEqual([]);
    expect(fabricated.historicalNote).toContain('No such claim was manufactured');
  });
});

describe('war obeys the architecture rules', () => {
  it('round-trips through JSON losslessly', () => {
    const outcome = declareWar(ready('monarchy'), 'britain', 'impressment', PARTIES);
    if (outcome.kind !== 'declared') throw new Error('expected a declaration');

    const state = run(outcome.state, 120);
    const copy = JSON.parse(JSON.stringify(state)) as GameState;
    expect(copy.diplomacy.wars).toEqual(state.diplomacy.wars);
  });

  it('is deterministic', () => {
    const one = declareWar(ready('monarchy'), 'britain', 'impressment', PARTIES);
    const two = declareWar(ready('monarchy'), 'britain', 'impressment', PARTIES);
    if (one.kind !== 'declared' || two.kind !== 'declared') {
      throw new Error('expected declarations');
    }

    expect(run(one.state, 300).diplomacy).toEqual(run(two.state, 300).diplomacy);
  });
});
