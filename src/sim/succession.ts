/**
 * SUCCESSION
 *
 * The ruler ages and dies, and the crown passes. Implements Phase 2 brief §2.1
 * and ECONOMY.md §7.19.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PLAYER DOES NOT LEAVE
 *
 * DESIGN.md pillar 2: the player persists in power for the entire game
 * regardless of who nominally holds office. A succession is therefore not a
 * game-over and not a handover — it is a change in the CIRCUMSTANCES the player
 * governs under. "The player continues as the new monarch" (brief §2.1) is the
 * whole of it: the name at the top of the screen changes, the standing the
 * office carries drops, and the player carries on.
 *
 * WHY IT COSTS LEGITIMACY EVEN WHEN IT GOES SMOOTHLY
 *
 * An heir inherits the crown, not the standing. Every transfer is a moment at
 * which "why this family?" can be asked out loud, and the answer has to be
 * re-established rather than assumed. A disputed succession — no heir named —
 * costs far more, and takes stability with it.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * DETERMINISM. Mortality is the first genuinely random thing in the simulation.
 * It uses the seeded PRNG whose state lives in `GameState` (Rule 2), so a save
 * replays to an identical result and two runs from one seed produce the same
 * king dying on the same day.
 *
 * Pure: takes state, returns state.
 */

import {
  HEIR_SECURITY_THRESHOLD,
  MORTALITY_BY_AGE,
  SUCCESSION_CRISIS_DURATION_DAYS,
  SUCCESSION_CRISIS_LEGITIMACY_COST,
  SUCCESSION_CRISIS_STABILITY_COST,
  SUCCESSION_LEGITIMACY_COST,
} from './calibration';
import { formatLongDate, yearOf } from './calendar';
import { upsertModifier } from './modifiers';
import { chance } from './rng';
import type { GameState, TickEffect } from './types';

/** The ruler's age in whole years on `day`. */
export function rulerAge(state: GameState, day = state.day): number {
  return yearOf(day) - state.ruler.birthYear;
}

/**
 * Annual probability of death at a given age.
 *
 * Adult mortality, not life expectancy at birth. The latter was around 35 in
 * 1790 and is dominated by infant deaths, which say nothing about the survival
 * of a man who has already reached fifty-seven. These are game-design
 * parameters informed by adult life tables, never shown as historical fact.
 */
export function annualMortality(age: number): number {
  let rate = MORTALITY_BY_AGE[0].annual;
  for (const band of MORTALITY_BY_AGE) {
    if (age >= band.from) rate = band.annual;
  }
  return rate;
}

/**
 * The name of the successor.
 *
 * A named heir succeeds. With none, the crown is disputed — and the fallback
 * name is deliberately generic, because in a disputed succession the point is
 * precisely that nobody agreed who it should be.
 */
function successorName(state: GameState): { name: string; disputed: boolean } {
  if (state.ruler.heirName) {
    return { name: state.ruler.heirName, disputed: false };
  }
  return {
    name: `A contested claimant of the House of ${state.ruler.houseName}`,
    disputed: true,
  };
}

/**
 * The heir a new ruler is credited with, or null if the succession after this
 * one will be contested.
 *
 * Deterministic and derived from the state, not rolled: whether a dynasty's
 * next step is settled is a consequence of how it has governed, and making it
 * random would take that back out of the player's hands.
 */
export function heirFor(state: GameState, rulerName: string): string | null {
  if (state.nation.legitimacyBase < HEIR_SECURITY_THRESHOLD) return null;
  return `The heir of ${rulerName}`;
}

export interface SuccessionResult {
  state: GameState;
  effects: TickEffect[];
  /** True if the ruler died this tick. */
  occurred: boolean;
}

/**
 * Check for the ruler's death, and pass the crown if it happens.
 *
 * Called once a year, on 1 January, rather than daily: the mortality figures
 * are annual, and rolling them daily would need a conversion that adds nothing
 * a player can perceive. Once a year is also when the age on screen changes.
 *
 * ONLY ON THE MONARCHICAL PATH. A republic's president is replaced by election
 * (queue item 7), not by death, and the player persists through both — but the
 * mechanics are different and modelling a presidential death as a succession
 * would be wrong.
 */
export function checkSuccession(state: GameState): SuccessionResult {
  if (state.governmentType !== 'monarchy') {
    return { state, effects: [], occurred: false };
  }

  const age = rulerAge(state);
  const roll = chance(state.rng, annualMortality(age));

  // The RNG state advances whether or not the ruler dies. Advancing it only on
  // death would make the sequence depend on the outcome it produced, which is
  // the classic way to break replay.
  const withRoll: GameState = { ...state, rng: roll.rng };
  if (!roll.value) {
    return { state: withRoll, effects: [], occurred: false };
  }

  const { name, disputed } = successorName(withRoll);
  const day = withRoll.day;
  const departed = withRoll.ruler;

  const legitimacyCost = disputed
    ? SUCCESSION_CRISIS_LEGITIMACY_COST
    : SUCCESSION_LEGITIMACY_COST;

  let activeModifiers = withRoll.activeModifiers;

  if (disputed) {
    activeModifiers = upsertModifier(activeModifiers, {
      id: `crisis:succession_${day}:nation.stability`,
      source: `Disputed succession of ${yearOf(day)}`,
      sourceType: 'crisis',
      target: 'nation.stability',
      value: -SUCCESSION_CRISIS_STABILITY_COST,
      isPercentage: false,
      startDay: day,
      endDay: day + SUCCESSION_CRISIS_DURATION_DAYS,
      rampDays: 0,
    });
  }

  const next: GameState = {
    ...withRoll,
    ruler: {
      ...departed,
      name,
      // The heir's own age is not modelled: a new ruler is assumed to be a
      // generation younger, which is what a bloodline succession normally is.
      birthYear: yearOf(day) - 34,
      /*
        WHETHER THE NEXT SUCCESSION IS ORDERLY IS DECIDED HERE, AND THE PLAYER
        DECIDES IT.

        A dynasty with legitimacy to spare has an obvious successor and nobody
        troubles to dispute it. One that has spent its standing — on decrees, on
        unpopular measures, on crises mishandled — finds that the question of who
        comes next is suddenly worth arguing about, and the next death is a
        crisis rather than a transfer.

        Making it conditional rather than automatic is the difference between a
        mechanic and a punishment. (docs/DECISIONS.md D-028)
      */
      heirName: heirFor(withRoll, name),
      reignNumber: departed.reignNumber + 1,
      accededDay: day,
    },
    nation: {
      ...withRoll.nation,
      // Charged against the BASE, because legitimacy is cumulative rather than
      // target-seeking (ECONOMY.md §7.15). Charging the resolved value would be
      // undone by the next monthly recompute.
      legitimacyBase: Math.max(0, withRoll.nation.legitimacyBase - legitimacyCost),
    },
    activeModifiers,
    flags: disputed
      ? { ...withRoll.flags, succession_disputed: true }
      : withRoll.flags,
    log: [
      ...withRoll.log,
      {
        id: `${day}:succession:${departed.reignNumber}`,
        day,
        tier: disputed ? 'crisis' : 'decision',
        category: 'system',
        title: disputed
          ? `${departed.name} dies, and the succession is disputed`
          : `${departed.name} dies; ${name} succeeds`,
        body: disputed
          ? `${departed.name} died on ${formatLongDate(day)} at the age of ${age}, ` +
            'naming no heir. The crown is claimed and contested, and the ' +
            'question of who has the right to it is asked out loud for the ' +
            'first time. You govern on regardless.'
          : `${departed.name} died on ${formatLongDate(day)} at the age of ${age}. ` +
            `${name} succeeds as the ${ordinal(departed.reignNumber + 2)} of the ` +
            `House of ${departed.houseName}. The crown passes; the standing it ` +
            'carries does not pass with it.',
        relatedEventId: null,
      },
    ],
  };

  return {
    state: next,
    effects: [
      {
        kind: disputed ? 'successionDisputed' : 'succession',
        day,
        description: disputed
          ? `${departed.name} died with no heir named`
          : `${departed.name} died; ${name} succeeded`,
        refs: [],
      },
    ],
    occurred: true,
  };
}

/** "first", "second", … for the chronicle. Falls back to a numeral. */
function ordinal(n: number): string {
  const words = [
    '',
    'first',
    'second',
    'third',
    'fourth',
    'fifth',
    'sixth',
    'seventh',
    'eighth',
    'ninth',
    'tenth',
  ];
  return words[n] ?? `${n}th`;
}
