/**
 * GRIEVANCE AND UNREST
 *
 * The price of ruling by decree. Implements Phase 2 brief §2.1 and
 * ECONOMY.md §7.19.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DESIGN, IN ONE SENTENCE FROM THE BRIEF
 *
 *   "Decreeing against the planters repeatedly builds planter grievance
 *    specifically, not just generic unhappiness."
 *
 * That is why grievance is tracked per BLOC rather than as a single number. A
 * government can be broadly tolerated and still have made one interest
 * implacable, and the interest it has made implacable determines where the
 * trouble comes from. Regional grievance is DERIVED from bloc grievance through
 * the same weighting bills use (`blocWeights`), so the two cannot
 * disagree and a bloc's anger lands where that bloc actually is.
 *
 * WHY THE MONARCHY PAYS MORE FOR THE SAME MEASURE
 *
 * A decree is imposed. Nobody was persuaded, nobody consented, and the losers
 * had no opportunity to be heard, so the whole of their opposition becomes
 * resentment at the government. A bill argued through and voted on is a bill
 * the losers were part of losing: they dislike the outcome, they do not resent
 * the process. The ratio between the two constants is the central balance of
 * the two paths — set them equal and the republic's slowness buys nothing.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Everything here is pure.
 */

import {
  BLOC_POWER,
  DECREE_GRIEVANCE_PER_OPPOSITION,
  DECREE_LEGITIMACY_FLOOR,
  DECREE_LEGITIMACY_PER_OPPOSITION,
  GRIEVANCE_DECAY_PER_MONTH,
  GRIEVANCE_TO_COMPLIANCE,
  GRIEVANCE_TO_SENTIMENT,
  LEGISLATION_GRIEVANCE_PER_OPPOSITION,
  UNREST_RESOLUTION_MARGIN,
  UNREST_STABILITY_COST,
  UNREST_THRESHOLD,
} from './calibration';
import type { BlocWeights } from './blocs';
import { BLOC_IDS, REGION_IDS } from './types';
import type {
  BlocId,
  BlocReaction,
  GovernmentType,
  GrievanceState,
  RegionId,
  UnrestEpisode,
  UnrestSeverity,
} from './types';

/** A country with nothing yet held against it. */
export function emptyGrievance(): GrievanceState {
  const byBloc: Record<string, number> = {};
  for (const bloc of BLOC_IDS) byBloc[bloc] = 0;

  const byRegion: Record<string, number> = {};
  for (const region of REGION_IDS) byRegion[region] = 0;

  return { byBloc, byRegion, episodes: [] };
}

// ============================================================================
// ACCUMULATION
// ============================================================================

/**
 * How much a measure runs against a bloc's interest, weighted by how much that
 * bloc's displeasure actually costs a government.
 *
 * Only OPPOSITION counts. A bloc that gains by a measure does not bank goodwill
 * against the next one — a government does not get to decree something popular
 * and spend the credit on something hated. That asymmetry is deliberate: it
 * stops "pass a sweetener first" from being a general-purpose answer to every
 * unpopular decree, which would make the whole grievance system optional.
 */
export function weightedOpposition(reactions: readonly BlocReaction[]): number {
  let total = 0;
  for (const reaction of reactions) {
    if (reaction.strength >= 0) continue;
    total += -reaction.strength * (BLOC_POWER[reaction.bloc] ?? 0.5);
  }
  return total;
}

/**
 * The legitimacy a crown spends decreeing this.
 *
 * "Every decree spends legitimacy, and spends more when it runs against the
 * interests of powerful blocs." (brief §2.1) There is a floor because acting
 * alone always costs something, even when nobody minds the measure itself.
 */
export function decreeLegitimacyCost(reactions: readonly BlocReaction[]): number {
  return (
    DECREE_LEGITIMACY_FLOOR +
    weightedOpposition(reactions) * DECREE_LEGITIMACY_PER_OPPOSITION
  );
}

/**
 * Add the grievance a measure creates, bloc by bloc.
 *
 * Unweighted by `BLOC_POWER` here, deliberately: power determines what a bloc's
 * anger COSTS the government (above), not how angry the bloc gets. The
 * seamen resent a measure that harms them exactly as much as the planters
 * resent one that harms them; the difference is what they can do about it.
 */
export function accrueGrievance(
  grievance: GrievanceState,
  reactions: readonly BlocReaction[],
  governmentType: GovernmentType,
  weights: BlocWeights,
): GrievanceState {
  const rate =
    governmentType === 'monarchy'
      ? DECREE_GRIEVANCE_PER_OPPOSITION
      : LEGISLATION_GRIEVANCE_PER_OPPOSITION;

  const byBloc = { ...grievance.byBloc };

  for (const reaction of reactions) {
    if (reaction.strength >= 0) continue;
    const current = byBloc[reaction.bloc] ?? 0;
    byBloc[reaction.bloc] = Math.min(100, current + -reaction.strength * rate);
  }

  return { ...grievance, byBloc, byRegion: regionalGrievance(byBloc, weights) };
}

/**
 * Regional grievance, derived from bloc grievance.
 *
 * Derived rather than stored independently, so the two cannot drift apart —
 * the same discipline the receipt rollup gets. A bloc's anger lands where that
 * bloc actually is, through the same weighting bills use, which is why
 * decreeing against the planters produces trouble in the South and decreeing
 * against the frontier settlers produces it in the west.
 */
export function regionalGrievance(
  byBloc: Record<string, number>,
  weights: BlocWeights,
): Record<string, number> {
  const byRegion: Record<string, number> = {};
  for (const region of REGION_IDS) byRegion[region] = 0;

  for (const bloc of BLOC_IDS) {
    const level = byBloc[bloc] ?? 0;
    if (level <= 0) continue;
    const row = weights[bloc] ?? {};
    for (const region of REGION_IDS) {
      byRegion[region] += level * (row[region] ?? 0);
    }
  }

  for (const region of REGION_IDS) {
    byRegion[region] = Math.min(100, byRegion[region]);
  }

  return byRegion;
}

/**
 * A month's decay.
 *
 * Proportional rather than flat, so a small grievance fades quickly and a large
 * one lingers. Grievances are forgotten, but not quickly.
 */
export function decayGrievance(
  grievance: GrievanceState,
  weights: BlocWeights,
): GrievanceState {
  const byBloc: Record<string, number> = {};
  for (const bloc of BLOC_IDS) {
    byBloc[bloc] = Math.max(0, (grievance.byBloc[bloc] ?? 0) * (1 - GRIEVANCE_DECAY_PER_MONTH));
  }
  return { ...grievance, byBloc, byRegion: regionalGrievance(byBloc, weights) };
}

// ============================================================================
// CONSEQUENCES
// ============================================================================

/**
 * CAUSAL CLAIM
 * A tax is only worth what people actually pay, and a population with a
 * standing grievance against the government pays less of it. Grievance below
 * the resistance threshold does nothing at all: ordinary discontent is not
 * rebellion, and a model in which every complaint costs revenue would make the
 * player unable to govern at all.
 *
 * Above it, the loss is proportional to the excess, which is what makes the
 * threshold a threshold rather than a cliff.
 */
export function grievanceCompliancePenalty(regionGrievance: number): number {
  const excess = regionGrievance - UNREST_THRESHOLD.resistance;
  return excess > 0 ? excess * GRIEVANCE_TO_COMPLIANCE : 0;
}

/**
 * CAUSAL CLAIM
 * Sentiment responds to grievance below the threshold as well as above it:
 * people can be sullen without refusing to pay. This is the gentler of the two
 * channels and it is the one the player sees first, which is what makes the
 * Regions screen a warning rather than a post-mortem.
 */
export function grievanceSentimentPenalty(regionGrievance: number): number {
  return regionGrievance * GRIEVANCE_TO_SENTIMENT;
}

/**
 * Severities in order, so escalation can be compared by RANK rather than by
 * name. Comparing by name meant a running defiance saw a wanted resistance,
 * read "different", and closed — so no episode could survive the smallest dip.
 */
const SEVERITY_RANK: Record<UnrestSeverity, number> = {
  resistance: 1,
  defiance: 2,
  revolt: 3,
};

/** The severity a level of regional grievance warrants, if any. */
export function severityFor(regionGrievance: number): UnrestSeverity | null {
  if (regionGrievance >= UNREST_THRESHOLD.revolt) return 'revolt';
  if (regionGrievance >= UNREST_THRESHOLD.defiance) return 'defiance';
  if (regionGrievance >= UNREST_THRESHOLD.resistance) return 'resistance';
  return null;
}

/** Episodes running on `day`. */
export function activeEpisodes(grievance: GrievanceState): UnrestEpisode[] {
  return grievance.episodes.filter((e) => e.endedDay === null);
}

/** Total stability cost of everything currently running. */
export function unrestStabilityCost(grievance: GrievanceState): number {
  let total = 0;
  for (const episode of activeEpisodes(grievance)) {
    total += UNREST_STABILITY_COST[episode.severity] ?? 0;
  }
  return total;
}

/** The bloc most responsible for a region's grievance. Named in the chronicle. */
export function principalGrievance(
  byBloc: Record<string, number>,
  regionId: RegionId,
  weights: BlocWeights,
): BlocId {
  let worst: BlocId = BLOC_IDS[0];
  let worstShare = -1;

  for (const bloc of BLOC_IDS) {
    const share = (byBloc[bloc] ?? 0) * (weights[bloc]?.[regionId] ?? 0);
    if (share > worstShare) {
      worstShare = share;
      worst = bloc;
    }
  }

  return worst;
}

export interface UnrestChange {
  grievance: GrievanceState;
  /** Episodes that began this month. */
  started: UnrestEpisode[];
  /** Episodes that ended this month. */
  ended: UnrestEpisode[];
}

/**
 * Open and close unrest episodes to match the current grievance.
 *
 * ESCALATION IS ONE STEP AT A TIME, and de-escalation closes the episode
 * outright. A region whose grievance climbs from resistance to revolt closes
 * the resistance episode and opens a revolt, so the chronicle reads as a story
 * rather than as a set of overlapping states.
 *
 * The resolution margin is hysteresis, and it is necessary: without it an
 * episode sitting exactly on its threshold would start and stop every month,
 * filling the chronicle with a rebellion that keeps changing its mind.
 */
export function reconcileUnrest(
  grievance: GrievanceState,
  day: number,
  weights: BlocWeights,
): UnrestChange {
  const episodes = [...grievance.episodes];
  const started: UnrestEpisode[] = [];
  const ended: UnrestEpisode[] = [];

  for (const regionId of REGION_IDS) {
    const level = grievance.byRegion[regionId] ?? 0;
    const wanted = severityFor(level);
    const running = episodes.find((e) => e.regionId === regionId && e.endedDay === null);

    if (running) {
      const holdAt = UNREST_THRESHOLD[running.severity] - UNREST_RESOLUTION_MARGIN;
      const stillWarranted = level >= holdAt;

      /*
        ESCALATION ONLY. A wanted severity BELOW the running one is not a
        reason to close the episode — that is a dip, and the hysteresis above is
        what decides whether it matters. Comparing severities by name rather
        than by rank was a real bug: at 53 the running defiance would see a
        wanted resistance, read "different", and close, so an episode could
        never survive the smallest dip and the chronicle filled with a rebellion
        that kept changing its mind.
      */
      const escalated = wanted !== null && SEVERITY_RANK[wanted] > SEVERITY_RANK[running.severity];

      if (!stillWarranted || escalated) {
        const index = episodes.indexOf(running);
        const closed = { ...running, endedDay: day };
        episodes[index] = closed;
        ended.push(closed);
      } else {
        continue;
      }
    }

    /*
      Open a new episode when one is warranted and none is running — or when the
      one that was running has just been closed above, either because it
      escalated or because it fell out of range. A region that de-escalates from
      defiance to resistance therefore closes the defiance and opens a
      resistance, which reads correctly in the chronicle.
    */
    const stillRunning = episodes.some(
      (e) => e.regionId === regionId && e.endedDay === null,
    );
    if (wanted !== null && !stillRunning) {
      const episode: UnrestEpisode = {
        // Deterministic: day plus region, never generated. (Rule 2)
        id: `unrest:${regionId}:${day}`,
        regionId,
        severity: wanted,
        drivenBy: principalGrievance(grievance.byBloc, regionId, weights),
        startedDay: day,
        endedDay: null,
      };
      episodes.push(episode);
      started.push(episode);
    }
  }

  return { grievance: { ...grievance, episodes }, started, ended };
}
