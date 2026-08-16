/**
 * CONGRESS
 *
 * The republic's half of the founding choice. Implements Phase 2 brief §2.2 and
 * ECONOMY.md §7.20.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE CENTRAL REQUIREMENT
 *
 *   "Vote resolution must be transparent and inspectable. Before committing to
 *    introduce a bill, the player sees a projected whip count broken down by
 *    party and by region, with each bloc's reasoning visible. Same
 *    modifier-ledger honesty as everything else."
 *
 * So `whipCount()` does not return a number. It returns every delegation's vote
 * with the reasons that produced it, and those reasons sum to the inclination
 * that produced the vote — exactly as `explainStat` does for a stat. A whip
 * count the player cannot interrogate would be the ledger rule broken in a new
 * place.
 *
 * HOW A DELEGATION MAKES UP ITS MIND
 *
 *   party line      Σ over blocs of (party affinity × how the bill treats them),
 *                   weighted by the party's discipline
 *   regional interest the same sum, but weighted by how much each bloc actually
 *                   lives in THIS state's region — which is what lets a member
 *                   break with the party over a sectional question
 *   grievance       a delegation whose region resents the government is harder
 *                   to carry
 *   whipping        political capital the player has spent on this party
 *
 * The regional term is the seed of sectional politics the brief asks for: a
 * Virginia Federalist and a Massachusetts Federalist are the same party and do
 * not vote alike on a tariff, because the planters are not in Massachusetts.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Everything here is pure.
 */

import {
  BLOC_REGION_WEIGHTS,
  CONGRESS_DEFEAT_LEGITIMACY_COST,
  CONGRESS_GRIEVANCE_RESISTANCE,
  CONGRESS_PARTY_LINE_WEIGHT,
  CONGRESS_REGIONAL_WEIGHT,
  CONGRESS_UNDECIDED_BAND,
  CONGRESS_WHIP_EFFECT,
  FAILED_BILL_COOLDOWN_DAYS,
  OPPOSED_BLOC_DISCOUNT,
  LOG_ROLL_CAPITAL_COST,
  LOG_ROLL_DUE_DAYS,
  LOG_ROLL_VOTE_EFFECT,
  RIDER_CAPITAL_COST,
  RIDER_VOTE_EFFECT,
  SENATE_CLASS_TURNOVER,
  WHIP_CAPITAL_PER_POINT,
} from './calibration';
import { isoToDay } from './calendar';
import type {
  Bill,
  BlocId,
  CongressState,
  Delegation,
  GameState,
  Party,
  PartyId,
  RegionId,
  StateSeats,
} from './types';

// ============================================================================
// COMPOSITION
// ============================================================================

/** Parties in existence on `day`. */
export function partiesOn(parties: readonly Party[], day: number): Party[] {
  return parties.filter(
    (p) =>
      day >= isoToDay(p.activeFrom) &&
      (p.activeUntil === null || day < isoToDay(p.activeUntil)),
  );
}

/**
 * What an interest became.
 *
 * The Pro-Administration men of the First Congress did not vanish in 1793 and
 * get replaced by strangers — they became the Federalists, and the
 * Anti-Administration interest became the Democratic-Republicans. So a
 * delegation seated under the old names still counts under the new ones, and a
 * save from 1791 loaded in 1794 does not find its legislature empty.
 *
 * This also makes the whip count robust to a state whose date has moved without
 * an election, which is exactly the situation a migration or a test constructs.
 */
const PARTY_SUCCESSOR: Record<string, PartyId> = {
  pro_administration: 'federalist',
  anti_administration: 'democratic_republican',
};

/**
 * Resolve a party id recorded in a delegation to one that exists on `day`.
 *
 * Returns null when there is no such party and no successor, which is the
 * honest answer for a share the model cannot place.
 */
export function resolveParty(
  partyId: string,
  live: readonly Party[],
): Party | null {
  const direct = live.find((p) => p.id === partyId);
  if (direct) return direct;

  const successor = PARTY_SUCCESSOR[partyId];
  return successor ? (live.find((p) => p.id === successor) ?? null) : null;
}

/** A state's House seats on `day`, or 0 if it is not yet in the union. */
export function houseSeatsOn(state: StateSeats, day: number): number {
  let seats = 0;
  for (const entry of state.house) {
    if (day >= isoToDay(entry.from)) seats = entry.seats;
  }
  return seats;
}

export function isSeated(state: StateSeats, day: number): boolean {
  return day >= isoToDay(state.admittedOn);
}

/**
 * How a state's delegation divides between the parties in existence.
 *
 * A MODEL, NOT A RECORD, and the whole reason it is derived rather than
 * tabulated: this project has not sourced a state-by-state party breakdown for
 * every Congress, and inventing one would dress a model up as history. It is
 * built from the region's economic character — whose interests live there — and
 * from how that region currently feels about the federal government.
 *
 * The consequence, which is the point: a region the government has alienated
 * returns members who will not vote for it. Sentiment becomes seats.
 * (ECONOMY.md §7.20, BLOCKERS.md B-006)
 */
export function delegationShare(
  regionId: RegionId,
  parties: readonly Party[],
  regionSentiment: number,
): Record<string, number> {
  const raw: Record<string, number> = {};

  for (const party of parties) {
    /*
      How much of this region's economy this party speaks for: the party's
      affinity for each bloc, weighted by how much of that bloc lives here.
      A party aligned with the planters polls strongly in the South and barely
      registers in New England, which is the correct shape.
    */
    let alignment = 0;
    for (const [bloc, weight] of Object.entries(BLOC_REGION_WEIGHTS)) {
      alignment += (party.blocAffinity[bloc] ?? 0) * (weight[regionId] ?? 0);
    }

    /*
      Sentiment tilts the region toward or away from whoever is in office. The
      administration party gains where the government is liked and loses where
      it is not — which is how a badly governed region ends up sending members
      who will vote the government down.
    */
    const proGovernment =
      party.id === 'pro_administration' || party.id === 'federalist' ? 1 : -1;
    const tilt = (regionSentiment / 100) * proGovernment * 0.35;

    // Shifted positive so every party retains some presence everywhere: no
    // region in 1790 was unanimous, and a zero share would make a state
    // permanently unwinnable.
    raw[party.id] = Math.max(0.05, 1 + alignment * 1.6 + tilt);
  }

  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  const share: Record<string, number> = {};
  for (const party of parties) share[party.id] = raw[party.id] / total;
  return share;
}

/**
 * The Senate after an election: one class replaced, two classes still sitting.
 *
 * Article I §3 cl. 2. Only a third of the seats are contested in any cycle, so
 * the chamber moves at a third of the speed of opinion. A state seated for the
 * first time has no sitting class and takes the fresh result whole, which is
 * what actually happened when Vermont and Kentucky arrived.
 *
 * Recorded party ids are resolved forward before blending, so a class elected
 * as Anti-Administration is still counted once that interest has become the
 * Democratic-Republicans — the members did not change, only the name did.
 */
function rolledSenate(
  fresh: Record<string, number>,
  sitting: Delegation | undefined,
  live: readonly Party[],
): Record<string, number> {
  if (!sitting) return { ...fresh };

  const held: Record<string, number> = {};
  let carried = 0;
  for (const [recordedId, value] of Object.entries(sitting.senateShare)) {
    const party = resolveParty(recordedId, live);
    if (!party || value <= 0) continue;
    held[party.id] = (held[party.id] ?? 0) + value;
    carried += value;
  }
  // A share that resolved to nothing — every party in it since dissolved —
  // leaves no incumbents to carry, so the fresh result stands alone.
  if (carried <= 0) return { ...fresh };

  const out: Record<string, number> = {};
  for (const id of new Set([...Object.keys(fresh), ...Object.keys(held)])) {
    out[id] =
      (fresh[id] ?? 0) * SENATE_CLASS_TURNOVER +
      ((held[id] ?? 0) / carried) * (1 - SENATE_CLASS_TURNOVER);
  }
  return out;
}

/** Build the whole legislature for `day` from the seat record and sentiment. */
export function seatCongress(params: {
  day: number;
  number: number;
  stateSeats: readonly StateSeats[];
  parties: readonly Party[];
  sentimentByRegion: Record<string, number>;
  previous?: CongressState;
}): CongressState {
  const live = partiesOn(params.parties, params.day);

  const sitting = new Map(
    (params.previous?.delegations ?? []).map((d) => [d.stateCode, d] as const),
  );

  const delegations: Delegation[] = params.stateSeats
    .filter((s) => isSeated(s, params.day))
    .map((s) => {
      const share = delegationShare(
        s.regionId,
        live,
        params.sentimentByRegion[s.regionId] ?? 0,
      );
      return {
        stateCode: s.code,
        regionId: s.regionId,
        houseSeats: houseSeatsOn(s, params.day),
        // Article I §3: two per state, whatever its size. The reason Delaware
        // matters as much as Virginia in one chamber and a twentieth as much in
        // the other.
        senateSeats: 2,
        share,
        senateShare: rolledSenate(share, sitting.get(s.code), live),
      };
    });

  return {
    number: params.number,
    convenedDay: params.day,
    delegations,
    // Cooldowns and obligations survive an election: a Congress that threw a
    // bill out is replaced, but the government's promises and its embarrassments
    // are its own.
    cooldowns: params.previous?.cooldowns ?? {},
    obligations: params.previous?.obligations ?? [],
    defeats: params.previous?.defeats ?? 0,
    // Whipping does not survive an election. The members it bought are gone.
    whipped: {},
  };
}

/**
 * The party shares that actually sit in one chamber.
 *
 * The two differ because the Senate turns over a third at a time (see
 * `rolledSenate`). Every vote count and every seat tally has to ask which
 * chamber it is counting, or the Senate is just a small copy of the House.
 */
export function sharesIn(
  delegation: Delegation,
  chamber: 'house' | 'senate',
): Record<string, number> {
  return chamber === 'house' ? delegation.share : delegation.senateShare;
}

export function totalSeats(congress: CongressState): { house: number; senate: number } {
  return {
    house: congress.delegations.reduce((s, d) => s + d.houseSeats, 0),
    senate: congress.delegations.reduce((s, d) => s + d.senateSeats, 0),
  };
}

/** Seats held by each party, across both chambers. */
export function seatsByParty(
  congress: CongressState,
  chamber: 'house' | 'senate',
  live?: readonly Party[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const delegation of congress.delegations) {
    const seats = chamber === 'house' ? delegation.houseSeats : delegation.senateSeats;
    for (const [recordedId, share] of Object.entries(sharesIn(delegation, chamber))) {
      // Resolved the same way the whip count resolves it, so the composition
      // shown on screen and the votes counted cannot name different parties.
      const party = live ? resolveParty(recordedId, live) : null;
      const key = party?.id ?? recordedId;
      out[key] = (out[key] ?? 0) + seats * share;
    }
  }
  return out;
}

// ============================================================================
// THE WHIP COUNT
// ============================================================================

/** One reason a delegation leans the way it does, in the player's language. */
export interface VoteReason {
  /** What produced it: the party, the region, grievance, or the player. */
  kind: 'party' | 'region' | 'grievance' | 'whip' | 'rider' | 'logroll';
  /** Signed contribution to the inclination. Sums to the total, visibly. */
  effect: number;
  /** Authored where possible, generated where not. Always a sentence. */
  text: string;
}

export interface DelegationVote {
  stateCode: string;
  regionId: RegionId;
  party: PartyId;
  /** Seats this line represents in the chamber being counted. */
  seats: number;
  /** −100…+100. Positive is for. */
  inclination: number;
  verdict: 'for' | 'against' | 'undecided';
  reasons: VoteReason[];
}

export interface WhipCount {
  chamber: 'house' | 'senate';
  votes: DelegationVote[];
  for: number;
  against: number;
  undecided: number;
  needed: number;
  passes: boolean;
}

export interface BillTactics {
  /** Political capital spent whipping each party for this vote. */
  whip: Record<string, number>;
  /** A rider attached to buy one party's support. */
  rider: PartyId | null;
  /** A promise of future support, bought from one party. */
  logRoll: PartyId | null;
}

export const NO_TACTICS: BillTactics = { whip: {}, rider: null, logRoll: null };

/**
 * How much a bill helps or harms the interests a party speaks for.
 *
 * The dot product of the party's affinities and the bill's bloc reactions.
 * Positive means the bill serves the party's coalition.
 */
function partyLine(bill: Bill, party: Party): number {
  let total = 0;

  for (const reaction of bill.blocReactions) {
    const affinity = party.blocAffinity[reaction.bloc] ?? 0;
    const raw = affinity * reaction.strength;

    /*
      SCHADENFREUDE IS DISCOUNTED, and this asymmetry matters.

      Taken at face value, a negative affinity times a negative reaction is a
      positive: a party set against the planters would welcome a measure that
      destroyed the plantation economy in exact proportion to the damage. That
      is wrong, and it produced a model in which the Federalists enthusiastically
      supported federal emancipation because it hurt an interest they opposed.

      Opposing an interest politically is not the same as wanting it ruined. A
      party is pleased by its opponents' discomfort a little, and defends its own
      people a great deal, so harm to a bloc the party is set against counts at a
      fraction. Benefit to a bloc it opposes is discounted the same way — helping
      your enemy is a mild irritation, not a proportional injury.
    */
    const againstOwnPeople = affinity > 0;
    total += againstOwnPeople ? raw : raw * OPPOSED_BLOC_DISCOUNT;
  }

  return total / 100;
}

/**
 * The same, but weighted by which blocs actually live in this region.
 *
 * THIS IS THE SECTIONAL TERM, and it is the seed of everything the brief wants
 * from it. A Virginia Federalist and a Massachusetts Federalist belong to the
 * same party and do not vote alike on a tariff, because the planters are not in
 * Massachusetts. Over decades this is what turns a party system into a
 * sectional one.
 */
function regionalInterest(bill: Bill, regionId: RegionId): number {
  let total = 0;
  for (const reaction of bill.blocReactions) {
    const weight = BLOC_REGION_WEIGHTS[reaction.bloc]?.[regionId] ?? 0;
    total += reaction.strength * weight;
  }
  return total / 100;
}

/** The bloc most responsible for a region's view of a bill, for the reason text. */
function principalInterest(bill: Bill, regionId: RegionId): { bloc: BlocId; reason: string } | null {
  let best: { bloc: BlocId; reason: string; magnitude: number } | null = null;

  for (const reaction of bill.blocReactions) {
    const weight = BLOC_REGION_WEIGHTS[reaction.bloc]?.[regionId] ?? 0;
    const magnitude = Math.abs(reaction.strength) * weight;
    if (!best || magnitude > best.magnitude) {
      best = { bloc: reaction.bloc, reason: reaction.reason, magnitude };
    }
  }

  return best ? { bloc: best.bloc, reason: best.reason } : null;
}

/**
 * Count the votes, and show the working.
 *
 * Returns a line per delegation per party, each carrying the reasons that
 * produced its inclination. The reasons SUM to the inclination — the same
 * contract the modifier ledger has with a stat, and for the same reason: a
 * number the player cannot interrogate is a number they cannot plan against.
 */
export function whipCount(
  state: GameState,
  bill: Bill,
  parties: readonly Party[],
  chamber: 'house' | 'senate',
  tactics: BillTactics = NO_TACTICS,
): WhipCount {
  const live = partiesOn(parties, state.day);
  const votes: DelegationVote[] = [];

  for (const delegation of state.congress.delegations) {
    const seatsInChamber =
      chamber === 'house' ? delegation.houseSeats : delegation.senateSeats;
    if (seatsInChamber === 0) continue;

    const grievance = state.grievance.byRegion[delegation.regionId] ?? 0;
    const interest = regionalInterest(bill, delegation.regionId);
    const principal = principalInterest(bill, delegation.regionId);

    for (const [recordedId, share] of Object.entries(sharesIn(delegation, chamber))) {
      // Resolved through succession: a delegation seated as Pro-Administration
      // still counts once that interest has become the Federalists.
      const party = resolveParty(recordedId, live);
      if (!party || share <= 0) continue;
      const partyId = party.id;

      const seats = seatsInChamber * share;
      if (seats < 0.01) continue;

      const reasons: VoteReason[] = [];

      // --- The party line -------------------------------------------------
      const line = partyLine(bill, party) * party.discipline * CONGRESS_PARTY_LINE_WEIGHT;
      reasons.push({
        kind: 'party',
        effect: line,
        text:
          line >= 0
            ? `${party.shortName} sees its people served by this`
            : `${party.shortName} sees its people harmed by this`,
      });

      // --- The state's own interest, which can override the line ----------
      const regional = interest * CONGRESS_REGIONAL_WEIGHT;
      reasons.push({
        kind: 'region',
        effect: regional,
        text: principal
          ? `${delegation.stateCode}: ${principal.reason}`
          : `${delegation.stateCode} has no strong interest either way`,
      });

      // --- A region that resents the government is harder to carry --------
      if (grievance > 1) {
        const drag = -grievance * CONGRESS_GRIEVANCE_RESISTANCE;
        reasons.push({
          kind: 'grievance',
          effect: drag,
          text: `${delegation.stateCode} is aggrieved and disinclined to oblige`,
        });
      }

      // --- What the player has bought -------------------------------------
      const whipped =
        (tactics.whip[partyId] ?? 0) + (state.congress.whipped[partyId] ?? 0);
      if (whipped > 0) {
        const effect = whipped * CONGRESS_WHIP_EFFECT;
        reasons.push({
          kind: 'whip',
          effect,
          text: `${party.shortName} members have been spoken to`,
        });
      }

      if (tactics.rider === partyId) {
        reasons.push({
          kind: 'rider',
          effect: RIDER_VOTE_EFFECT,
          text: `A rider has been attached for the ${party.shortName} interest`,
        });
      }

      if (tactics.logRoll === partyId) {
        reasons.push({
          kind: 'logroll',
          effect: LOG_ROLL_VOTE_EFFECT,
          text: `${party.shortName} has been promised support in return`,
        });
      }

      const inclination = Math.max(
        -100,
        Math.min(100, reasons.reduce((sum, r) => sum + r.effect, 0)),
      );

      votes.push({
        stateCode: delegation.stateCode,
        regionId: delegation.regionId,
        party: partyId as PartyId,
        seats,
        inclination,
        verdict:
          inclination > CONGRESS_UNDECIDED_BAND
            ? 'for'
            : inclination < -CONGRESS_UNDECIDED_BAND
              ? 'against'
              : 'undecided',
        reasons,
      });
    }
  }

  let forSeats = 0;
  let againstSeats = 0;
  let undecidedSeats = 0;

  for (const vote of votes) {
    if (vote.verdict === 'for') forSeats += vote.seats;
    else if (vote.verdict === 'against') againstSeats += vote.seats;
    else undecidedSeats += vote.seats;
  }

  /*
    A simple majority of those voting. The undecided abstain — which is what a
    genuinely undecided member did far more often than the modern whipped
    Congress makes it look, and it means a bill can pass on a plurality of a
    thin house.
  */
  const voting = forSeats + againstSeats;
  const needed = voting / 2;

  return {
    chamber,
    votes,
    for: forSeats,
    against: againstSeats,
    undecided: undecidedSeats,
    needed,
    passes: voting > 0 ? forSeats > needed : false,
  };
}

/** Both chambers. A bill must carry each of them. */
export function bothChambers(
  state: GameState,
  bill: Bill,
  parties: readonly Party[],
  tactics: BillTactics = NO_TACTICS,
): { house: WhipCount; senate: WhipCount; passes: boolean } {
  const house = whipCount(state, bill, parties, 'house', tactics);
  const senate = whipCount(state, bill, parties, 'senate', tactics);
  return { house, senate, passes: house.passes && senate.passes };
}

// ============================================================================
// WHAT THE TACTICS COST
// ============================================================================

export function tacticsCost(tactics: BillTactics): number {
  let cost = 0;
  for (const points of Object.values(tactics.whip)) {
    cost += points * WHIP_CAPITAL_PER_POINT;
  }
  if (tactics.rider !== null) cost += RIDER_CAPITAL_COST;
  if (tactics.logRoll !== null) cost += LOG_ROLL_CAPITAL_COST;
  return cost;
}

// ============================================================================
// COOLDOWNS AND OBLIGATIONS
// ============================================================================

/** May this bill be introduced on `day`? */
export function offCooldown(congress: CongressState, billId: string, day: number): boolean {
  const until = congress.cooldowns[billId];
  return until === undefined || day >= until;
}

export function cooldownRemaining(
  congress: CongressState,
  billId: string,
  day: number,
): number {
  const until = congress.cooldowns[billId];
  return until === undefined ? 0 : Math.max(0, until - day);
}

/**
 * Record a defeat.
 *
 * "Failed bills go on cooldown and cost reputation. Repeatedly failing bills
 * should visibly damage the player's standing." (brief §2.2) The cooldown is
 * fixed; the legitimacy cost RISES with the number of defeats, because the
 * third bill a government loses says something the first did not.
 */
export function recordDefeat(
  congress: CongressState,
  billId: string,
  day: number,
): { congress: CongressState; legitimacyCost: number } {
  const defeats = congress.defeats + 1;

  return {
    congress: {
      ...congress,
      defeats,
      cooldowns: { ...congress.cooldowns, [billId]: day + FAILED_BILL_COOLDOWN_DAYS },
      // A vote lost spends the whipping that failed to win it.
      whipped: {},
    },
    legitimacyCost: CONGRESS_DEFEAT_LEGITIMACY_COST * Math.min(4, defeats),
  };
}

/** A promise made. It comes due. */
export function addObligation(
  congress: CongressState,
  party: PartyId,
  billId: string,
  day: number,
): CongressState {
  return {
    ...congress,
    obligations: [
      ...congress.obligations,
      {
        // Deterministic: day plus party, never generated. (Rule 2)
        id: `obligation:${party}:${day}`,
        party,
        forBillId: billId,
        incurredDay: day,
        dueDay: day + LOG_ROLL_DUE_DAYS,
        cost: LOG_ROLL_CAPITAL_COST * 2,
        settledDay: null,
      },
    ],
  };
}

/** Obligations that have come due on `day` and are not yet settled. */
export function dueObligations(congress: CongressState, day: number) {
  return congress.obligations.filter((o) => o.settledDay === null && day >= o.dueDay);
}
