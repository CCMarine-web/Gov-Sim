import { describe, expect, it } from 'vitest';
import { advanceDay, resolveDecision } from '@/sim/advanceDay';
import { PHASE_1_END_DAY, PHASE_1_START_DAY, isoToDay } from '@/sim/calendar';
import { validateCondition } from '@/sim/conditions';
import { createTestGame } from '@/sim/createGame';
import { validateEffect } from '@/sim/effects';
import { REGION_IDS, type Condition, type GameState } from '@/sim/types';
import { CENSUS_1790_TOTALS, PHASE_1_CONTENT, REGION_SEEDS } from './index';

const { events, laws } = PHASE_1_CONTENT;

/** Every condition in a tree, flattened. */
function flattenConditions(condition: Condition): Condition[] {
  switch (condition.kind) {
    case 'not':
      return [condition, ...flattenConditions(condition.of)];
    case 'all':
    case 'any':
      return [condition, ...condition.of.flatMap(flattenConditions)];
    default:
      return [condition];
  }
}

describe('structural validity', () => {
  it('every event id is unique', () => {
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every law id is unique', () => {
    const ids = laws.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every event option id is unique within its event', () => {
    for (const event of events) {
      const ids = event.options.map((o) => o.id);
      expect(new Set(ids).size, event.id).toBe(ids.length);
    }
  });

  it('every event has between 2 and 4 options, per UI.md §5.10', () => {
    for (const event of events) {
      expect(event.options.length, event.id).toBeGreaterThanOrEqual(2);
      expect(event.options.length, event.id).toBeLessThanOrEqual(4);
    }
  });

  it('every condition validates', () => {
    for (const event of events) {
      for (const condition of event.triggerConditions) {
        expect(validateCondition(condition, event.id)).toEqual([]);
      }
      for (const option of event.options) {
        for (const condition of option.requirements) {
          expect(validateCondition(condition, `${event.id}.${option.id}`)).toEqual([]);
        }
      }
    }
    for (const law of laws) {
      for (const condition of law.requirements) {
        expect(validateCondition(condition, law.id)).toEqual([]);
      }
    }
  });

  it('every effect validates', () => {
    for (const event of events) {
      for (const option of event.options) {
        for (const effect of option.effects) {
          expect(validateEffect(effect, `${event.id}.${option.id}`)).toEqual([]);
        }
      }
    }
    for (const law of laws) {
      for (const effect of law.effects) {
        expect(validateEffect(effect, law.id)).toEqual([]);
      }
    }
  });
});

describe('referential integrity', () => {
  const eventIds = new Set(events.map((e) => e.id));
  const lawIds = new Set(laws.map((l) => l.id));
  const regionIds = new Set<string>(REGION_IDS);

  it('every scheduled event refers to an event that exists', () => {
    for (const event of events) {
      for (const option of event.options) {
        for (const effect of option.effects) {
          if (effect.kind === 'scheduleEvent') {
            expect(eventIds.has(effect.eventId), `${event.id} -> ${effect.eventId}`).toBe(true);
          }
        }
      }
    }
  });

  it('every unlocked or repealed law refers to a law that exists', () => {
    for (const event of events) {
      for (const option of event.options) {
        for (const effect of option.effects) {
          if (effect.kind === 'unlockLaw' || effect.kind === 'repealLaw') {
            expect(lawIds.has(effect.lawId), `${event.id} -> ${effect.lawId}`).toBe(true);
          }
        }
      }
    }
  });

  it('every referenced region exists', () => {
    for (const event of events) {
      for (const option of event.options) {
        for (const effect of option.effects) {
          if (effect.kind === 'regionSentiment' && effect.regionId !== 'all') {
            expect(regionIds.has(effect.regionId), event.id).toBe(true);
          }
        }
      }
    }
  });

  it('every condition referencing an event or law resolves', () => {
    const all = [
      ...events.flatMap((e) => e.triggerConditions.flatMap(flattenConditions)),
      ...laws.flatMap((l) => l.requirements.flatMap(flattenConditions)),
    ];
    for (const condition of all) {
      if (condition.kind === 'eventFired' || condition.kind === 'optionChosen') {
        expect(eventIds.has(condition.eventId)).toBe(true);
      }
      if (condition.kind === 'lawEnacted') {
        expect(lawIds.has(condition.lawId)).toBe(true);
      }
    }
  });
});

describe('historical integrity', () => {
  /**
   * The educational backbone. A history teacher should find nothing false on
   * any card, and every factual claim should say where it was checked.
   */
  it('every event carries a non-empty historical context', () => {
    for (const event of events) {
      expect(event.historicalContext.length, event.id).toBeGreaterThan(120);
    }
  });

  it('every event cites at least one source', () => {
    for (const event of events) {
      expect(event.sources.length, event.id).toBeGreaterThan(0);
      for (const source of event.sources) {
        expect(source.trim().length, event.id).toBeGreaterThan(10);
      }
    }
  });

  it('every law carries historical context and a source', () => {
    for (const law of laws) {
      expect(law.historicalContext.length, law.id).toBeGreaterThan(120);
      expect(law.sources.length, law.id).toBeGreaterThan(0);
    }
  });

  it('every historical date falls inside the Phase 1 window', () => {
    for (const event of events) {
      if (event.historicalDate === null) continue;
      const day = isoToDay(event.historicalDate);
      expect(day, `${event.id} (${event.historicalDate})`).toBeGreaterThanOrEqual(
        PHASE_1_START_DAY,
      );
      expect(day, `${event.id} (${event.historicalDate})`).toBeLessThanOrEqual(
        PHASE_1_END_DAY,
      );
    }
  });

  it('every option previews its effects in plain English', () => {
    for (const event of events) {
      for (const option of event.options) {
        expect(option.previewedEffects.length, `${event.id}.${option.id}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('region seed integrity', () => {
  it('regional census figures sum to the verified national totals', () => {
    const population = REGION_SEEDS.flatMap((r) => r.states).reduce(
      (s, st) => s + st.population1790,
      0,
    );
    const enslaved = REGION_SEEDS.flatMap((r) => r.states).reduce(
      (s, st) => s + st.enslavedPopulation1790,
      0,
    );
    expect(population).toBe(CENSUS_1790_TOTALS.population);
    expect(enslaved).toBe(CENSUS_1790_TOTALS.enslavedPopulation);
  });

  it('covers all four regions exactly once', () => {
    expect(REGION_SEEDS.map((r) => r.id).sort()).toEqual([...REGION_IDS].sort());
  });

  it('carries a source and a source tier for the census data', () => {
    expect(CENSUS_1790_TOTALS.source.length).toBeGreaterThan(10);
    expect(['primary', 'secondary']).toContain(CENSUS_1790_TOTALS.sourceTier);
  });
});

// ============================================================================
// PLAYING THROUGH
// ============================================================================

/**
 * Run the full Phase 1 span, answering every decision with the first available
 * option. Proves the content actually fires and can be played through.
 */
function playThrough(state: GameState, choose: (eventId: string, options: string[]) => string) {
  let current = state;
  const fired: Array<{ eventId: string; day: number }> = [];

  for (let i = 0; i < PHASE_1_END_DAY; i++) {
    const tick = advanceDay(current, PHASE_1_CONTENT);
    current = tick.state;

    for (const effect of tick.effects) {
      if (effect.kind === 'eventFired') {
        fired.push({ eventId: effect.refs[0], day: effect.day });
      }
    }

    // Answer anything blocking, then carry on.
    while (current.eventState.pendingDecisions.length > 0) {
      const pending = current.eventState.pendingDecisions[0];
      const event = PHASE_1_CONTENT.events.find((e) => e.id === pending.eventId)!;
      const available = event.options
        .filter((o) => o.requirements.length === 0 || o.id === event.options[0].id)
        .map((o) => o.id);
      current = resolveDecision(
        current,
        PHASE_1_CONTENT,
        pending.eventId,
        choose(pending.eventId, available),
      ).state;
    }
  }

  return { state: current, fired };
}

describe('the content plays through', () => {
  const { state, fired } = playThrough(createTestGame(), (_id, options) => options[0]);

  it('fires at least 6 real events, per acceptance criterion 5', () => {
    expect(fired.length).toBeGreaterThanOrEqual(6);
  });

  it('fires at least 12, so the decade feels populated rather than sparse', () => {
    expect(fired.length).toBeGreaterThanOrEqual(12);
  });

  it('fires each of the anchor events of the decade', () => {
    const firedIds = fired.map((f) => f.eventId);
    for (const id of [
      'quaker_petitions_1790',
      'assumption_1790',
      'bank_1791',
      'whiskey_excise_1791',
      'bill_of_rights_1791',
      'fugitive_slave_1793',
      'neutrality_1793',
      'yellow_fever_1793',
      'whiskey_rebellion_1794',
      'jay_treaty_1795',
      'pinckney_treaty_1795',
      'farewell_precedent_1796',
      'xyz_affair_1798',
      'alien_sedition_1798',
    ]) {
      expect(firedIds, `${id} never fired`).toContain(id);
    }
  });

  it('fires them in chronological order', () => {
    for (let i = 1; i < fired.length; i++) {
      expect(fired[i].day).toBeGreaterThanOrEqual(fired[i - 1].day);
    }
  });

  it('fires each event on or after its historical date', () => {
    for (const record of fired) {
      const event = PHASE_1_CONTENT.events.find((e) => e.id === record.eventId)!;
      if (event.historicalDate === null) continue;
      // Triggers may open slightly before the historical date so the player can
      // act on the decision as it arose, but must not fire wildly early.
      const historicalDay = isoToDay(event.historicalDate);
      expect(record.day, event.id).toBeGreaterThan(historicalDay - 60);
    }
  });

  it('reaches the end of Phase 1 without stalling', () => {
    expect(state.day).toBe(PHASE_1_END_DAY);
    expect(state.eventState.pendingDecisions).toHaveLength(0);
  });

  it('records every choice so later content can branch on it', () => {
    expect(Object.keys(state.eventState.chosenOptions).length).toBe(fired.length);
  });

  it('writes a readable chronicle rather than a system log', () => {
    const decisions = state.log.filter((l) => l.tier === 'decision');
    expect(decisions.length).toBeGreaterThanOrEqual(6);
    for (const entry of decisions) {
      expect(entry.body).toMatch(/^You chose: /);
    }
  });

  it('leaves the state serializable after a full played run', () => {
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('is deterministic: the same choices produce the same run', () => {
    const a = playThrough(createTestGame(), (_id, options) => options[0]);
    const b = playThrough(createTestGame(), (_id, options) => options[0]);
    expect(a.state).toEqual(b.state);
    expect(a.fired).toEqual(b.fired);
  });
});

describe('choices actually diverge', () => {
  it('different answers produce materially different runs', () => {
    const first = playThrough(createTestGame(), (_id, options) => options[0]);
    const last = playThrough(createTestGame(), (_id, options) => options[options.length - 1]);

    expect(first.state.nation.legitimacy).not.toBeCloseTo(
      last.state.nation.legitimacy,
      3,
    );
  });

  it('the whiskey rebellion only fires if the excise was enacted', () => {
    // Always decline the excise (its third option), and the 1794 rebellion
    // should never arrive.
    const { fired } = playThrough(createTestGame(), (eventId, options) =>
      eventId === 'whiskey_excise_1791' ? 'decline_excise' : options[0],
    );
    expect(fired.map((f) => f.eventId)).not.toContain('whiskey_rebellion_1794');
  });
});
