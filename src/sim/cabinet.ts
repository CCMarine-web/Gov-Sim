/**
 * THE CABINET
 *
 * Phase 2 brief §5, queue item 13:
 *
 *   "Appointees have competence and loyalty. Competence affects how efficiently
 *    their department's policies execute — a low-competence Treasury Secretary
 *    means tax collection efficiency drops and programs cost more to deliver.
 *    Loyalty affects whether they undermine you, leak, or resign publicly at
 *    damaging moments. Appointments cost political capital. In a republic,
 *    significant appointments need Senate confirmation, which is its own vote."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS REPLACES
 *
 * `administrativeCapacity` used to mean "how many offices exist and are
 * filled", read from the historical tenure record. `types.ts` said item 13
 * would replace that with "how competent and loyal the people filling them
 * are", and this is that: the historical record still supplies the DEFAULT
 * holder of every office, and the player's own appointments override it.
 *
 * A player who appoints nobody gets the cabinet history gave them. A player who
 * appoints gets what they chose, and pays for it.
 *
 * COMPETENCE ACTS THROUGH THE LEDGER, like everything else. There is no
 * `competenceBonus` read by the tax code — a Secretary writes modifiers against
 * the same targets a statute writes against, and the Treasury popover names him.
 *
 * LOYALTY IS NOT A DIE ROLL EITHER. It falls when the government does things the
 * officer's people hate, and a resignation happens when it crosses a threshold —
 * so a player watching the number can see it coming, which is the difference
 * between a consequence and a punishment.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Pure.
 */

import {
  CANDIDATES_BY_ID,
  candidatesFor,
  type Candidate,
} from '@/content/government/candidates';
import {
  APPOINTMENT_CAPITAL_COST,
  CABINET_COMPETENCE_BASELINE,
  LOYALTY_DECAY_PER_MONTH,
  LOYALTY_PER_OPPOSITION,
  RESIGNATION_LEGITIMACY_COST,
  RESIGNATION_THRESHOLD,
} from './calibration';
import { isoToDay } from './calendar';
import { NO_TACTICS, bothChambers, type BillTactics } from './congress';
import { makeModifierId, removeModifiersFromSource, upsertModifier } from './modifiers';
import { holderOn, recordEndDay } from './offices';
import type {
  BlocReaction,
  CabinetState,
  GameState,
  Modifier,
  Office,
  Party,
  Appointment,
} from './types';

// ============================================================================
// SEEDING
// ============================================================================

export function seedCabinet(): CabinetState {
  // Empty, and deliberately. On day 0 the departments did not exist — State was
  // created on 27 July 1789 and the Treasury not until 2 September — so a
  // cabinet pre-populated at the founding would be inventing a government the
  // player has not been given yet.
  return { appointments: {}, resignations: [] };
}

// ============================================================================
// WHO HOLDS AN OFFICE
// ============================================================================

export interface Holder {
  name: string;
  competence: number;
  loyalty: number;
  /** True when the player appointed them; false when history did. */
  appointed: boolean;
  /** The player's appointment record, when there is one. */
  appointment: Appointment | null;
  candidate: Candidate | null;
}

/**
 * Who is running a department today.
 *
 * The player's appointment wins; otherwise the historical record supplies the
 * holder, and a historical holder without a rated candidate takes the baseline.
 * That last case is not a fudge — it is the honest position for a man the
 * content has a name for and no assessment of.
 */
export function holderOf(
  state: GameState,
  office: Office,
  day = state.day,
): Holder | null {
  const appointment = state.cabinet.appointments[office.id] ?? null;
  if (appointment && appointment.appointedDay <= day && appointment.leftDay === null) {
    const candidate = CANDIDATES_BY_ID[appointment.candidateId] ?? null;
    return {
      name: candidate?.name ?? appointment.candidateId,
      competence: candidate?.competence ?? CABINET_COMPETENCE_BASELINE,
      loyalty: appointment.loyalty,
      appointed: true,
      appointment,
      candidate,
    };
  }

  /*
    PAST THE END OF THE RECORD, THE LAST HOLDER STANDS.

    The same clamp `censusOfOffices` applies, and it has to be the same one:
    the office record simply stops at the end of 1800, which is not the same as
    every department in the United States falling vacant on 1 January 1801
    (BLOCKERS.md B-005). Without this, capacity would count an office as staffed
    and then find nobody competent running it — two answers to one question,
    which is how the political-capital test caught it.
  */
  const end = recordEndDay([office]);
  const asAt = end !== null && day > end ? end : day;

  const historical = holderOn(office, asAt);
  if (!historical) return null;

  const candidate =
    candidatesFor(office.id).find((c) => c.name === historical.name) ?? null;

  return {
    name: historical.name,
    competence: candidate?.competence ?? CABINET_COMPETENCE_BASELINE,
    loyalty: candidate?.loyalty ?? CABINET_COMPETENCE_BASELINE,
    appointed: false,
    appointment: null,
    candidate,
  };
}

/**
 * The mean competence of the cabinet, 0–100, or null when nobody is in post.
 *
 * Null rather than zero: on 30 April 1789 no department existed, and a zero
 * would say the government was staffed by incompetents rather than unstaffed.
 */
export function cabinetCompetence(
  state: GameState,
  offices: readonly Office[],
): number | null {
  const held = offices
    .map((office) => holderOf(state, office))
    .filter((h): h is Holder => h !== null);

  if (held.length === 0) return null;
  return held.reduce((sum, h) => sum + h.competence, 0) / held.length;
}

// ============================================================================
// WHAT COMPETENCE DOES
// ============================================================================

/**
 * What each department's competence actually affects.
 *
 * The brief names the Treasury case exactly — "tax collection efficiency drops
 * and programs cost more to deliver" — so that is what the Treasury does. The
 * others follow the same principle: a department affects the thing it does, and
 * nothing else.
 *
 * Values are the effect AT FULL COMPETENCE. The actual modifier scales from
 * −1× at zero competence through 0 at the baseline to +1× at 100, so an
 * incompetent officer is a real cost rather than merely a smaller bonus.
 */
const DEPARTMENT_EFFECTS: Record<string, Array<{ target: string; atFull: number; percentage: boolean }>> = {
  // Collection, and the cost of delivering what is voted.
  treasury: [
    { target: 'region.new_england.compliance', atFull: 6, percentage: false },
    { target: 'region.mid_atlantic.compliance', atFull: 6, percentage: false },
    { target: 'region.south.compliance', atFull: 6, percentage: false },
    { target: 'region.frontier.compliance', atFull: 6, percentage: false },
    { target: 'nation.tradeCapacity', atFull: 0.04, percentage: true },
  ],
  // A department that can negotiate is worth trade, and a stable border.
  state: [
    { target: 'nation.tradeCapacity', atFull: 0.05, percentage: true },
    { target: 'nation.stability', atFull: 3, percentage: false },
  ],
  // An army that is supplied and led is a frontier that holds.
  war: [
    { target: 'nation.stability', atFull: 5, percentage: false },
    { target: 'region.frontier.sentiment', atFull: 6, percentage: false },
  ],
  // Law that runs is legitimacy.
  attorney_general: [
    { target: 'nation.legitimacy', atFull: 4, percentage: false },
    { target: 'nation.stability', atFull: 2, percentage: false },
  ],
};

/**
 * The modifiers a serving officer puts into the ledger.
 *
 * Scaled about the baseline so competence can be NEGATIVE in effect: a
 * Secretary of the Treasury at 40 makes collection worse, which is the brief's
 * requirement and not merely a smaller improvement.
 */
export function cabinetModifiers(
  state: GameState,
  offices: readonly Office[],
): Modifier[] {
  const modifiers: Modifier[] = [];

  for (const office of offices) {
    const holder = holderOf(state, office);
    if (!holder) continue;

    const effects = DEPARTMENT_EFFECTS[office.id];
    if (!effects) continue;

    // −1 at zero competence, 0 at the baseline, +1 at 100.
    const scale =
      holder.competence >= CABINET_COMPETENCE_BASELINE
        ? (holder.competence - CABINET_COMPETENCE_BASELINE) /
          (100 - CABINET_COMPETENCE_BASELINE)
        : (holder.competence - CABINET_COMPETENCE_BASELINE) / CABINET_COMPETENCE_BASELINE;

    if (Math.abs(scale) < 0.001) continue;

    for (const effect of effects) {
      modifiers.push({
        id: makeModifierId('appointment', office.id, effect.target),
        source: `${holder.name}, ${office.title}`,
        sourceType: 'appointment',
        target: effect.target,
        value: effect.atFull * scale,
        isPercentage: effect.percentage,
        startDay: state.day,
        endDay: null,
        // No ramp: a department is run well or badly from the day the man walks
        // in. What takes time is the effect on a LAGGED stat, which the lag
        // already handles.
        rampDays: 0,
      });
    }
  }

  return modifiers;
}

/** Put the cabinet's effects into the ledger, replacing whatever was there. */
export function refreshCabinetModifiers(
  state: GameState,
  offices: readonly Office[],
): GameState {
  let modifiers = state.activeModifiers;
  for (const office of offices) {
    modifiers = removeModifiersFromSource(modifiers, 'appointment', office.id);
  }
  for (const modifier of cabinetModifiers({ ...state, activeModifiers: modifiers }, offices)) {
    modifiers = upsertModifier(modifiers, modifier);
  }
  return { ...state, activeModifiers: modifiers };
}

// ============================================================================
// APPOINTING
// ============================================================================

export type AppointmentStatus =
  | { kind: 'available' }
  | { kind: 'inPost' }
  | { kind: 'notYet'; from: string }
  | { kind: 'unavailable'; until: string }
  | { kind: 'officeNotCreated'; from: string };

export function appointmentStatus(
  state: GameState,
  office: Office,
  candidate: Candidate,
): AppointmentStatus {
  if (state.day < isoToDay(office.createdOn)) {
    return { kind: 'officeNotCreated', from: office.createdOn };
  }
  const current = state.cabinet.appointments[office.id];
  if (current && current.candidateId === candidate.id && current.leftDay === null) {
    return { kind: 'inPost' };
  }
  if (state.day < isoToDay(candidate.availableFrom)) {
    return { kind: 'notYet', from: candidate.availableFrom };
  }
  if (
    candidate.availableUntil !== null &&
    state.day >= isoToDay(candidate.availableUntil)
  ) {
    return { kind: 'unavailable', until: candidate.availableUntil };
  }
  return { kind: 'available' };
}

export type AppointmentOutcome =
  | { kind: 'appointed'; state: GameState }
  /** The Senate refused. An ordinary outcome on the republican path. */
  | { kind: 'rejected'; state: GameState; forSeats: number; againstSeats: number }
  | { kind: 'refused'; state: GameState; reason: string };

/**
 * Appoint someone.
 *
 * On the REPUBLICAN path the Senate confirms, and it is a real vote — the same
 * `whipCount` a bill and a declaration of war go through, on the candidate's own
 * bloc reactions. Article II §2 is not decoration: a president can be refused
 * his own cabinet.
 *
 * On the MONARCHICAL path the crown appoints. Which is the same bargain again.
 */
export function appoint(
  state: GameState,
  office: Office,
  candidateId: string,
  parties: readonly Party[],
  offices: readonly Office[],
  tactics: BillTactics = NO_TACTICS,
): AppointmentOutcome {
  const candidate = CANDIDATES_BY_ID[candidateId];
  if (!candidate || candidate.officeId !== office.id) {
    return { kind: 'refused', state, reason: 'No such candidate for this office.' };
  }

  const status = appointmentStatus(state, office, candidate);
  if (status.kind !== 'available') {
    return { kind: 'refused', state, reason: describeAppointmentStatus(status) };
  }
  if (state.politicalCapital.current < APPOINTMENT_CAPITAL_COST) {
    return {
      kind: 'refused',
      state,
      reason: `Not enough political capital: ${APPOINTMENT_CAPITAL_COST} is needed.`,
    };
  }

  const spent: GameState = {
    ...state,
    politicalCapital: {
      ...state.politicalCapital,
      current: state.politicalCapital.current - APPOINTMENT_CAPITAL_COST,
    },
  };

  if (state.governmentType === 'republic') {
    // Only the Senate confirms. The House has no part in it.
    const division = bothChambers(state, candidate, parties, tactics);
    if (!division.senate.passes) {
      return {
        kind: 'rejected',
        forSeats: division.senate.for,
        againstSeats: division.senate.against,
        state: {
          ...spent,
          log: [
            ...spent.log,
            {
              id: `${state.day}:rejected:${office.id}:${candidate.id}`,
              day: state.day,
              tier: 'enactment',
              category: 'system',
              title: `The Senate refuses to confirm ${candidate.name}`,
              body:
                `Divided ${division.senate.for.toFixed(0)} to ` +
                `${division.senate.against.toFixed(0)} against. The ${office.title} ` +
                'remains as it was, and the government has spent its standing for ' +
                'nothing.',
              relatedEventId: null,
            },
          ],
        },
      };
    }
  }

  const previous = state.cabinet.appointments[office.id];
  const appointment: Appointment = {
    officeId: office.id,
    candidateId: candidate.id,
    appointedDay: state.day,
    leftDay: null,
    loyalty: candidate.loyalty,
  };

  const appointed: GameState = {
    ...spent,
    cabinet: {
      ...spent.cabinet,
      appointments: { ...spent.cabinet.appointments, [office.id]: appointment },
      resignations: previous
        ? [...spent.cabinet.resignations]
        : spent.cabinet.resignations,
    },
    log: [
      ...spent.log,
      {
        id: `${state.day}:appoint:${office.id}:${candidate.id}`,
        day: state.day,
        tier: 'enactment',
        category: 'system',
        title: `${candidate.name} is appointed ${office.title}`,
        body: candidate.note,
        relatedEventId: null,
      },
    ],
  };

  return { kind: 'appointed', state: refreshCabinetModifiers(appointed, offices) };
}

// ============================================================================
// LOYALTY
// ============================================================================

/**
 * A measure the government has just carried, felt by the men who serve it.
 *
 * An officer's loyalty falls when the government does things HIS PEOPLE hate,
 * measured through the same bloc affinities the candidate carries. Jefferson
 * did not resign over a personality; he resigned because the government kept
 * doing things the small farmers and the planters could not stomach.
 */
export function strainLoyalty(
  cabinet: CabinetState,
  reactions: readonly BlocReaction[],
): CabinetState {
  const appointments: Record<string, Appointment> = {};

  for (const [officeId, appointment] of Object.entries(cabinet.appointments)) {
    if (appointment.leftDay !== null) {
      appointments[officeId] = appointment;
      continue;
    }

    const candidate = CANDIDATES_BY_ID[appointment.candidateId];
    if (!candidate) {
      appointments[officeId] = appointment;
      continue;
    }

    /*
      The dot product of how he feels about each bloc and how the measure treats
      them, CLAMPED to ±1. Positive means the measure serves his people.

      The clamp matters: without it a measure that hits three of an officer’s
      strongest affinities at once produces an alignment near 2, and a single
      bill ejects a man who in reality served four years of losing arguments.
      A measure can be wholly against everything he stands for; it cannot be
      more than that.
    */
    let raw = 0;
    for (const reaction of reactions) {
      const affinity =
        candidate.blocReactions.find((r) => r.bloc === reaction.bloc)?.strength ?? 0;
      raw += (affinity / 100) * (reaction.strength / 100);
    }
    const alignment = Math.max(-1, Math.min(1, raw));

    appointments[officeId] = {
      ...appointment,
      loyalty: Math.max(
        0,
        Math.min(100, appointment.loyalty + alignment * LOYALTY_PER_OPPOSITION),
      ),
    };
  }

  return { ...cabinet, appointments };
}

export interface ResignationResult {
  state: GameState;
  /** Who walked, this month. Named so the chronicle can say so. */
  resigned: Array<{ officeId: string; name: string }>;
}

/**
 * A month in the cabinet: loyalty drifts back toward where the man started, and
 * anyone below the threshold resigns publicly.
 *
 * Drift toward the STARTING loyalty rather than upward without limit — a man
 * who came in sceptical does not become a partisan because a quiet year passed.
 *
 * A resignation is not a die roll. It happens when a visible number crosses a
 * visible line, so a player watching the Government screen can see it coming and
 * either change course or let him go. That is the difference between a
 * consequence and a punishment.
 */
export function tickCabinet(
  state: GameState,
  offices: readonly Office[],
): ResignationResult {
  const appointments: Record<string, Appointment> = {};
  const resigned: Array<{ officeId: string; name: string }> = [];
  let legitimacy = state.nation.legitimacyBase;
  const resignations = [...state.cabinet.resignations];

  for (const [officeId, appointment] of Object.entries(state.cabinet.appointments)) {
    if (appointment.leftDay !== null) {
      appointments[officeId] = appointment;
      continue;
    }

    const candidate = CANDIDATES_BY_ID[appointment.candidateId];
    const baseline = candidate?.loyalty ?? CABINET_COMPETENCE_BASELINE;
    const drifted =
      appointment.loyalty + (baseline - appointment.loyalty) * LOYALTY_DECAY_PER_MONTH;

    if (drifted < RESIGNATION_THRESHOLD) {
      appointments[officeId] = { ...appointment, loyalty: drifted, leftDay: state.day };
      resigned.push({ officeId, name: candidate?.name ?? appointment.candidateId });
      resignations.push({
        officeId,
        candidateId: appointment.candidateId,
        day: state.day,
      });
      legitimacy -= RESIGNATION_LEGITIMACY_COST;
      continue;
    }

    appointments[officeId] = { ...appointment, loyalty: drifted };
  }

  let next: GameState = {
    ...state,
    nation: { ...state.nation, legitimacyBase: legitimacy },
    cabinet: { ...state.cabinet, appointments, resignations },
  };

  for (const departure of resigned) {
    const office = offices.find((o) => o.id === departure.officeId);
    next = {
      ...next,
      log: [
        ...next.log,
        {
          id: `${state.day}:resign:${departure.officeId}`,
          day: state.day,
          tier: 'crisis',
          category: 'system',
          title: `${departure.name} resigns as ${office?.title ?? departure.officeId}`,
          body:
            'He goes publicly, and with a statement. A man who leaves quietly ' +
            'costs a government nothing; this one has been asked to carry ' +
            'measures he cannot defend, and he says so on the way out.',
          relatedEventId: null,
        },
      ],
    };
  }

  // The office reverts to whoever history had in it, so the department is not
  // simply empty — and the ledger has to be rebuilt around that.
  return { state: refreshCabinetModifiers(next, offices), resigned };
}

// ============================================================================
// EXPLANATION
// ============================================================================

export function describeAppointmentStatus(status: AppointmentStatus): string {
  switch (status.kind) {
    case 'available':
      return 'Can be appointed.';
    case 'inPost':
      return 'Already in post.';
    case 'notYet':
      return `Not available before ${status.from}.`;
    case 'unavailable':
      return `No longer available after ${status.until}.`;
    case 'officeNotCreated':
      return `The office does not exist until ${status.from}.`;
  }
}

/** Plain words for a loyalty, so it is never a bare number. */
export function loyaltyWord(loyalty: number): string {
  if (loyalty < RESIGNATION_THRESHOLD) return 'About to go';
  if (loyalty < 40) return 'Openly at odds';
  if (loyalty < 55) return 'Serving under protest';
  if (loyalty < 75) return 'Reliable';
  return 'Wholly the government’s man';
}

/** And for competence. */
export function competenceWord(competence: number): string {
  if (competence < 35) return 'Out of his depth';
  if (competence < 50) return 'Struggling';
  if (competence < 65) return 'Adequate';
  if (competence < 80) return 'Capable';
  if (competence < 92) return 'Formidable';
  return 'The best available';
}
