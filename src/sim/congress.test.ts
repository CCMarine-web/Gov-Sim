/**
 * CONGRESS — the republic path
 *
 * Phase 2 brief §2.2. Six claims, each of which a test should be able to
 * falsify:
 *
 *   1. The seat counts are the historical ones, and they change on the real
 *      dates: 65 seats in 1789, 105 from 1793, two senators per state, and
 *      Vermont, Kentucky and Tennessee appearing when they were admitted.
 *   2. The vote is INSPECTABLE. Every delegation's reasons sum to its
 *      inclination, exactly as a stat's contributions sum to the stat.
 *   3. Region can override party. A Virginia Federalist and a Massachusetts
 *      Federalist do not vote alike on a bill that divides their interests —
 *      which is the seed of the sectional politics the game is building toward.
 *   4. The player has real tools, each with a real price: whipping, riders, and
 *      a log-roll whose bill comes due later.
 *   5. A defeat costs capital, starts a cooldown, and damages standing MORE each
 *      time.
 *   6. Elections re-seat Congress from the country as it now is, so a region the
 *      government has alienated returns members who will not vote for it.
 */

import { describe, expect, it } from 'vitest';
import { PARTIES, PHASE_1_CONTENT, STATE_SEATS } from '@/content';
import { advanceDay, resolveDecision } from './advanceDay';
import { billStatus, enactBill } from './bills';
import { isoToDay } from './calendar';
import {
  CONGRESS_DEFEAT_LEGITIMACY_COST,
  FAILED_BILL_COOLDOWN_DAYS,
  RIDER_CAPITAL_COST,
} from './calibration';
import {
  NO_TACTICS,
  bothChambers,
  cooldownRemaining,
  delegationShare,
  dueObligations,
  houseSeatsOn,
  offCooldown,
  partiesOn,
  seatCongress,
  seatsByParty,
  tacticsCost,
  totalSeats,
  whipCount,
  type BillTactics,
} from './congress';
import { createTestGame } from './createGame';
import type { Bill, CongressState, GameState } from './types';

function billById(id: string): Bill {
  return PHASE_1_CONTENT.bills.find((b) => b.id === id)!;
}

function republic(day = 0, capital = 900): GameState {
  const base = createTestGame({ governmentType: 'republic' });
  return {
    ...base,
    day,
    // The Bank's prerequisite. Set here so the tests are about the VOTE rather
    // than about whether the bill has become available.
    flags: { ...base.flags, assumption_passed: true },
    politicalCapital: { ...base.politicalCapital, current: capital, cap: capital },
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
// 1. THE SEATS ARE HISTORICAL
// ============================================================================

describe('the seat counts are the historical ones', () => {
  it('seats 59 of the Constitution’s 65 at the founding, because two states had not ratified', () => {
    const state = createTestGame();
    const totals = totalSeats(state.congress);

    // North Carolina ratified in November 1789 and Rhode Island in May 1790, so
    // on 30 April 1789 their 6 seats are not yet filled.
    expect(totals.house).toBe(59);
    expect(totals.senate).toBe(22);
  });

  it('seats North Carolina and Rhode Island when they ratify', () => {
    const nc = STATE_SEATS.find((s) => s.code === 'NC')!;
    const ri = STATE_SEATS.find((s) => s.code === 'RI')!;

    expect(houseSeatsOn(nc, isoToDay('1789-11-20'))).toBe(0);
    expect(houseSeatsOn(nc, isoToDay('1789-11-21'))).toBe(5);
    expect(houseSeatsOn(ri, isoToDay('1790-05-28'))).toBe(0);
    expect(houseSeatsOn(ri, isoToDay('1790-05-29'))).toBe(1);
  });

  it('raises the House to 105 with the Apportionment Act of 1792', () => {
    const day = isoToDay('1793-03-04');
    const congress = seatCongress({
      day,
      number: 3,
      stateSeats: STATE_SEATS,
      parties: PARTIES,
      sentimentByRegion: {},
    });

    // 1 Stat. 253: 105 seats from the Third Congress. Vermont and Kentucky are
    // in by then; Tennessee is not.
    expect(totalSeats(congress).house).toBe(105);
  });

  it('gives every state exactly two senators, whatever its size', () => {
    const state = createTestGame();
    for (const delegation of state.congress.delegations) {
      expect(delegation.senateSeats, delegation.stateCode).toBe(2);
    }

    // Which is why Delaware matters as much as Virginia in one chamber and a
    // twentieth as much in the other.
    const de = state.congress.delegations.find((d) => d.stateCode === 'DE')!;
    const va = state.congress.delegations.find((d) => d.stateCode === 'VA')!;
    expect(de.senateSeats).toBe(va.senateSeats);
    expect(de.houseSeats).toBeLessThan(va.houseSeats / 5);
  });

  it('admits Vermont, Kentucky and Tennessee on their real dates', () => {
    const check = (code: string, before: string, on: string) => {
      const s = STATE_SEATS.find((x) => x.code === code)!;
      expect(houseSeatsOn(s, isoToDay(before)), `${code} before`).toBe(0);
      expect(houseSeatsOn(s, isoToDay(on)), `${code} on`).toBeGreaterThan(0);
    };

    check('VT', '1791-03-03', '1791-03-04');
    check('KY', '1792-05-31', '1792-06-01');
    check('TN', '1796-05-31', '1796-06-01');
  });

  it('has no formal parties until 1793, and two after', () => {
    // The Congressional Biographical Directory labels the first two Congresses
    // only Pro- and Anti-Administration, because nothing more formal existed.
    const early = partiesOn(PARTIES, isoToDay('1790-01-01')).map((p) => p.id);
    expect(early).toEqual(['pro_administration', 'anti_administration']);

    const later = partiesOn(PARTIES, isoToDay('1794-01-01')).map((p) => p.id);
    expect(later).toEqual(['federalist', 'democratic_republican']);
  });

  it('gives the early interests low discipline, because there was no line to vote', () => {
    const early = partiesOn(PARTIES, isoToDay('1790-01-01'));
    const later = partiesOn(PARTIES, isoToDay('1794-01-01'));

    for (const party of early) {
      for (const organised of later) {
        expect(party.discipline).toBeLessThan(organised.discipline);
      }
    }
  });
});

// ============================================================================
// 2. THE VOTE IS INSPECTABLE
// ============================================================================

describe('the whip count shows its working', () => {
  const bill = billById('bank_of_the_united_states');

  it('gives every delegation reasons that sum to its inclination', () => {
    const state = republic(isoToDay('1791-06-01'));
    const count = whipCount(state, bill, PARTIES, 'house');

    expect(count.votes.length).toBeGreaterThan(0);
    for (const vote of count.votes) {
      const sum = vote.reasons.reduce((s, r) => s + r.effect, 0);
      // The same contract the modifier ledger has with a stat. A number the
      // player cannot interrogate is a number they cannot plan against.
      expect(Math.max(-100, Math.min(100, sum)), vote.stateCode).toBeCloseTo(
        vote.inclination,
        9,
      );
    }
  });

  it('names the party and the state in the reasons, in words', () => {
    const state = republic(isoToDay('1791-06-01'));
    const count = whipCount(state, bill, PARTIES, 'house');
    const vote = count.votes[0];

    const kinds = vote.reasons.map((r) => r.kind);
    expect(kinds).toContain('party');
    expect(kinds).toContain('region');
    for (const reason of vote.reasons) {
      expect(reason.text.length).toBeGreaterThan(10);
    }
  });

  it('counts for, against and undecided to the seats in the chamber', () => {
    const state = republic(isoToDay('1791-06-01'));
    const count = whipCount(state, bill, PARTIES, 'house');
    const totals = totalSeats(state.congress);

    expect(count.for + count.against + count.undecided).toBeCloseTo(totals.house, 6);
  });

  it('lets a delegation abstain rather than forcing a side', () => {
    const state = republic(isoToDay('1791-06-01'));
    const count = whipCount(state, bill, PARTIES, 'house');
    expect(count.votes.some((v) => v.verdict === 'undecided')).toBe(true);
  });

  it('requires both chambers', () => {
    const state = republic(isoToDay('1791-06-01'));
    const result = bothChambers(state, bill, PARTIES);
    expect(result.passes).toBe(result.house.passes && result.senate.passes);
  });
});

// ============================================================================
// 3. REGION CAN OVERRIDE PARTY
// ============================================================================

describe('a member votes their state as well as their party', () => {
  it('splits one party across regions on a sectionally divisive bill', () => {
    // Bounties on manufactures: artisans +80, planters −70. Northern and
    // southern members of the SAME party should not agree about it.
    const bill = billById('bounties_on_manufactures');
    const state = republic(isoToDay('1795-01-01'));
    const count = whipCount(state, bill, PARTIES, 'house');

    const federalist = count.votes.filter((v) => v.party === 'federalist');
    const northern = federalist.filter(
      (v) => v.regionId === 'new_england' || v.regionId === 'mid_atlantic',
    );
    const southern = federalist.filter((v) => v.regionId === 'south');

    expect(northern.length).toBeGreaterThan(0);
    expect(southern.length).toBeGreaterThan(0);

    const mean = (xs: typeof federalist) =>
      xs.reduce((s, v) => s + v.inclination, 0) / xs.length;

    // The seed of the sectional politics the whole game is building toward.
    expect(mean(northern)).toBeGreaterThan(mean(southern));
  });

  it('gives a region’s own interest a reason naming the bloc behind it', () => {
    const bill = billById('bounties_on_manufactures');
    const state = republic(isoToDay('1795-01-01'));
    const count = whipCount(state, bill, PARTIES, 'house');

    const virginia = count.votes.find((v) => v.stateCode === 'VA')!;
    const regional = virginia.reasons.find((r) => r.kind === 'region')!;
    expect(regional.text).toContain('VA');
    // The reason is the bill's own authored clause, not a generated one.
    expect(regional.text.length).toBeGreaterThan(20);
  });

  it('makes an aggrieved region harder to carry', () => {
    const bill = billById('bank_of_the_united_states');
    const calm = republic(isoToDay('1795-01-01'));
    const angry: GameState = {
      ...calm,
      grievance: {
        ...calm.grievance,
        byRegion: { ...calm.grievance.byRegion, south: 60 },
      },
    };

    const southIn = (s: GameState) =>
      whipCount(s, bill, PARTIES, 'house')
        .votes.filter((v) => v.regionId === 'south')
        .reduce((sum, v) => sum + v.inclination, 0);

    expect(southIn(angry)).toBeLessThan(southIn(calm));
  });
});

// ============================================================================
// 4. THE PLAYER'S TOOLS
// ============================================================================

describe('the player can change the count, at a price', () => {
  const bill = billById('bank_of_the_united_states');
  const day = isoToDay('1791-06-01');

  it('whipping moves votes and costs capital', () => {
    const state = republic(day);
    const before = whipCount(state, bill, PARTIES, 'house');

    const tactics: BillTactics = {
      ...NO_TACTICS,
      whip: { anti_administration: 30 },
    };
    const after = whipCount(state, bill, PARTIES, 'house', tactics);

    expect(after.for).toBeGreaterThan(before.for);
    expect(tacticsCost(tactics)).toBeGreaterThan(0);
  });

  it('a rider buys one party outright, for a flat price', () => {
    const state = republic(day);
    const tactics: BillTactics = { ...NO_TACTICS, rider: 'anti_administration' };

    const before = whipCount(state, bill, PARTIES, 'house');
    const after = whipCount(state, bill, PARTIES, 'house', tactics);

    expect(after.for).toBeGreaterThan(before.for);
    expect(tacticsCost(tactics)).toBe(RIDER_CAPITAL_COST);
  });

  it('a log-roll is cheap now and creates a promise that comes due', () => {
    const state = republic(day);
    const tactics: BillTactics = { ...NO_TACTICS, logRoll: 'anti_administration' };

    expect(tacticsCost(tactics)).toBeLessThan(RIDER_CAPITAL_COST);

    const after = enactBill(state, bill, null, PARTIES, tactics).state;
    expect(after.congress.obligations).toHaveLength(1);

    const obligation = after.congress.obligations[0];
    expect(obligation.party).toBe('anti_administration');
    expect(obligation.dueDay).toBeGreaterThan(after.day);
    // It comes due at more than it cost. A promise with no cost is not a promise.
    expect(obligation.cost).toBeGreaterThan(tacticsCost(tactics));
  });

  it('settles the promise when it falls due, and says so', () => {
    const state = republic(day, 3000);
    const enacted = enactBill(state, bill, null, PARTIES, {
      ...NO_TACTICS,
      logRoll: 'anti_administration',
    }).state;

    const obligation = enacted.congress.obligations[0];
    const later = run({ ...enacted, day: obligation.dueDay - 1 }, 3);

    expect(dueObligations(later.congress, later.day)).toHaveLength(0);
    expect(later.congress.obligations[0].settledDay).not.toBeNull();
    expect(later.log.some((l) => l.title.includes('promise'))).toBe(true);
  });

  it('costs standing when the promise cannot be kept', () => {
    const state = republic(day, 3000);
    const enacted = enactBill(state, bill, null, PARTIES, {
      ...NO_TACTICS,
      logRoll: 'anti_administration',
    }).state;

    const obligation = enacted.congress.obligations[0];
    const broke: GameState = {
      ...enacted,
      day: obligation.dueDay - 1,
      politicalCapital: { ...enacted.politicalCapital, current: 0, accrualPerDay: 0 },
    };

    const after = run(broke, 3);
    expect(after.nation.legitimacyBase).toBeLessThan(broke.nation.legitimacyBase);
    expect(after.log.some((l) => l.title.includes('cannot be kept'))).toBe(true);
  });

  it('spends the tactics whether the bill carries or not', () => {
    // A government that whips hard and loses has still whipped hard. Refunding
    // the attempt would make trying free and failure costless.
    const state = republic(day, 400);
    const hopeless = billById('general_sales_tax');
    const tactics: BillTactics = { ...NO_TACTICS, whip: { pro_administration: 10 } };

    const before = state.politicalCapital.current;
    const after = enactBill(state, hopeless, 0.03, PARTIES, tactics).state;

    expect(after.politicalCapital.current).toBeLessThan(before);
  });
});

// ============================================================================
// 5. DEFEAT
// ============================================================================

describe('a bill can be voted down', () => {
  it('defeats a bill the country hates, without throwing', () => {
    // A general sales tax: merchants −65, artisans −55, small farmers −40,
    // frontier settlers −45. Every interest in the country loses by it, and
    // nothing in the model should be able to carry that.
    const state = republic(isoToDay('1795-01-01'), 3000);
    const bill = billById('general_sales_tax');

    const result = bothChambers(state, bill, PARTIES);
    expect(result.passes).toBe(false);

    const after = enactBill(state, bill, 0.03, PARTIES).state;
    // A defeat is an ordinary outcome, not an error.
    expect(after.policies.bills.some((b) => b.billId === bill.id)).toBe(false);
    expect(after.congress.defeats).toBe(1);
  });

  it('starts a cooldown, and says how long', () => {
    const state = republic(isoToDay('1795-01-01'), 3000);
    const bill = billById('general_sales_tax');
    const after = enactBill(state, bill, 0.03, PARTIES).state;

    expect(offCooldown(after.congress, bill.id, after.day)).toBe(false);
    expect(cooldownRemaining(after.congress, bill.id, after.day)).toBe(
      FAILED_BILL_COOLDOWN_DAYS,
    );

    const status = billStatus(after, bill);
    expect(status.kind).toBe('onCooldown');
  });

  it('damages standing more each time', () => {
    let state = republic(isoToDay('1795-01-01'), 9000);
    const bill = billById('general_sales_tax');

    const losses: number[] = [];
    for (let i = 0; i < 3; i++) {
      const before = state.nation.legitimacyBase;
      state = enactBill(state, bill, 0.03, PARTIES).state;
      losses.push(before - state.nation.legitimacyBase);
      // Clear the cooldown so the same bill can be lost again.
      state = {
        ...state,
        congress: { ...state.congress, cooldowns: {} },
        politicalCapital: { ...state.politicalCapital, current: 9000 },
      };
    }

    expect(losses[0]).toBeCloseTo(CONGRESS_DEFEAT_LEGITIMACY_COST, 6);
    expect(losses[1]).toBeGreaterThan(losses[0]);
    expect(losses[2]).toBeGreaterThan(losses[1]);
  });

  it('records which chamber refused it and by how much', () => {
    const state = republic(isoToDay('1795-01-01'), 3000);
    const bill = billById('general_sales_tax');
    const after = enactBill(state, bill, 0.03, PARTIES).state;

    const entry = after.log[after.log.length - 1];
    expect(entry.title).toContain('defeated');
    expect(entry.body).toMatch(/House|Senate/);
    expect(entry.body).toContain('for and');
  });

  it('never blocks a monarchy, which has no vote to lose', () => {
    const base = createTestGame({ governmentType: 'monarchy' });
    const king: GameState = {
      ...base,
      day: isoToDay('1795-01-01'),
      politicalCapital: { ...base.politicalCapital, current: 3000, cap: 3000 },
    };
    const bill = billById('general_sales_tax');

    const after = enactBill(king, bill, 0.03, PARTIES).state;
    expect(after.policies.bills.some((b) => b.billId === bill.id)).toBe(true);
    expect(after.congress.defeats).toBe(0);
  });
});

// ============================================================================
// 6. ELECTIONS
// ============================================================================

describe('elections re-seat Congress from the country as it is', () => {
  it('convenes a new Congress on 4 March of every odd year', () => {
    const state = run(republic(0), isoToDay('1791-03-05'));
    expect(state.congress.number).toBeGreaterThan(1);
    expect(state.log.some((l) => l.title.includes('Congress convenes'))).toBe(true);
  });

  it('returns members hostile to a government that has alienated a region', () => {
    const parties = partiesOn(PARTIES, isoToDay('1795-01-01'));

    const content = delegationShare('south', parties, 60);
    const hostile = delegationShare('south', parties, -60);

    // Sentiment becomes seats: the administration party loses ground where the
    // government is disliked.
    expect(hostile.federalist).toBeLessThan(content.federalist);
    expect(hostile.democratic_republican).toBeGreaterThan(
      content.democratic_republican,
    );
  });

  it('leaves every party some presence everywhere', () => {
    const parties = partiesOn(PARTIES, isoToDay('1795-01-01'));
    for (const regionId of ['new_england', 'mid_atlantic', 'south', 'frontier']) {
      const share = delegationShare(regionId as never, parties, -100);
      for (const party of parties) {
        // No region in 1790 was unanimous, and a zero share would make a state
        // permanently unwinnable.
        expect(share[party.id], `${regionId}/${party.id}`).toBeGreaterThan(0);
      }
      const total = Object.values(share).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 9);
    }
  });

  it('carries cooldowns and promises across an election but not whipping', () => {
    const previous = seatCongress({
      day: 0,
      number: 1,
      stateSeats: STATE_SEATS,
      parties: PARTIES,
      sentimentByRegion: {},
    });
    const used = {
      ...previous,
      cooldowns: { some_bill: 500 },
      defeats: 2,
      whipped: { federalist: 30 },
    };

    const next = seatCongress({
      day: isoToDay('1793-03-04'),
      number: 3,
      stateSeats: STATE_SEATS,
      parties: PARTIES,
      sentimentByRegion: {},
      previous: used,
    });

    // A Congress that threw a bill out is replaced; the government's promises
    // and its embarrassments are its own.
    expect(next.cooldowns).toEqual({ some_bill: 500 });
    expect(next.defeats).toBe(2);
    // The members the whipping bought are gone.
    expect(next.whipped).toEqual({});
  });

  it('grows the House as states are admitted, over a played run', () => {
    const early = run(republic(0), 400);
    const late = run(republic(0), 2600);

    expect(totalSeats(late.congress).house).toBeGreaterThan(
      totalSeats(early.congress).house,
    );
    expect(totalSeats(late.congress).senate).toBeGreaterThan(
      totalSeats(early.congress).senate,
    );
  });

  it('reports the largest party in the chronicle, not just a number', () => {
    const state = run(republic(0), isoToDay('1793-03-05'));
    const entry = state.log.find((l) => l.title.includes('Third Congress'));

    expect(entry).toBeDefined();
    expect(entry!.body).toMatch(/per cent/);
    expect(entry!.body).toContain('must carry both');
  });

  /*
    ARTICLE I §3 CLAUSE 2

    Only a third of the Senate faces election in any cycle, so the chamber
    carries two thirds of an opinion the country has already moved on from.
    Without this the Senate is a small copy of the House and the second chamber
    is decoration.
  */
  describe('the Senate turns over a third at a time', () => {
    const day = isoToDay('1795-03-04');
    const live = partiesOn(PARTIES, day);
    const warm = { new_england: 60, mid_atlantic: 60, south: 60, frontier: 60 };
    const cold = { new_england: -60, mid_atlantic: -60, south: -60, frontier: -60 };

    function seat(sentiment: Record<string, number>, previous?: CongressState) {
      return seatCongress({
        day,
        number: previous ? previous.number + 1 : 1,
        stateSeats: STATE_SEATS,
        parties: PARTIES,
        sentimentByRegion: sentiment,
        previous,
      });
    }

    it('moves the House the whole way and the Senate a third of it', () => {
      const before = seat(warm);
      const after = seat(cold, before);

      const va = after.delegations.find((d) => d.stateCode === 'VA')!;
      const sat = before.delegations.find((d) => d.stateCode === 'VA')!;
      const fresh = delegationShare('south', live, -60);

      for (const party of live) {
        // The House is elected entire: it is exactly the new result.
        expect(va.share[party.id], `house/${party.id}`).toBeCloseTo(
          fresh[party.id],
          9,
        );
        // The Senate is one class new and two classes sitting.
        expect(va.senateShare[party.id], `senate/${party.id}`).toBeCloseTo(
          fresh[party.id] / 3 + (sat.senateShare[party.id] * 2) / 3,
          9,
        );
      }
    });

    it('leaves the Senate short of where opinion has already gone', () => {
      const before = seat(warm);
      const after = seat(cold, before);

      const houseSeats = seatsByParty(after, 'house', live);
      const senateSeats = seatsByParty(after, 'senate', live);
      const houseShare =
        houseSeats.federalist / totalSeats(after).house;
      const senateShare =
        senateSeats.federalist / totalSeats(after).senate;

      // The country has turned against the administration. The House says so;
      // the Senate has not finished hearing about it.
      expect(senateShare).toBeGreaterThan(houseShare);
    });

    it('gives a newly admitted state its first two senators outright', () => {
      // Kentucky was admitted on 1 June 1792, so it is absent from the Congress
      // seated in 1791 and present in the one seated in 1793. It has no sitting
      // class to carry, and its first Senate delegation is simply what it
      // elected — which is what actually happened.
      const before = seatCongress({
        day: isoToDay('1791-03-04'),
        number: 2,
        stateSeats: STATE_SEATS,
        parties: PARTIES,
        sentimentByRegion: warm,
      });
      expect(before.delegations.map((d) => d.stateCode)).not.toContain('KY');

      const after = seatCongress({
        day: isoToDay('1793-03-04'),
        number: 3,
        stateSeats: STATE_SEATS,
        parties: PARTIES,
        sentimentByRegion: cold,
        previous: before,
      });

      const ky = after.delegations.find((d) => d.stateCode === 'KY')!;
      expect(ky.senateShare).toEqual(ky.share);

      // And a state that WAS sitting is not treated the same way.
      const va = after.delegations.find((d) => d.stateCode === 'VA')!;
      expect(va.senateShare).not.toEqual(va.share);
    });

    it('carries a sitting class across the renaming of the parties', () => {
      const oldParties = partiesOn(PARTIES, isoToDay('1791-03-04'));
      const before = seatCongress({
        day: isoToDay('1791-03-04'),
        number: 2,
        stateSeats: STATE_SEATS,
        parties: PARTIES,
        sentimentByRegion: warm,
        previous: undefined,
      });
      expect(oldParties.map((p) => p.id)).toContain('pro_administration');

      const after = seatCongress({
        day: isoToDay('1793-03-04'),
        number: 3,
        stateSeats: STATE_SEATS,
        parties: PARTIES,
        sentimentByRegion: warm,
        previous: before,
      });

      for (const delegation of after.delegations) {
        // The members did not change; only the name of the interest did. So the
        // sitting class must still be counted, and the shares must still be a
        // whole chamber rather than two thirds of one.
        const total = Object.values(delegation.senateShare).reduce(
          (a, b) => a + b,
          0,
        );
        expect(total, delegation.stateCode).toBeCloseTo(1, 9);
        expect(Object.keys(delegation.senateShare)).not.toContain(
          'pro_administration',
        );
      }
    });
  });

  it('keeps seat shares summing to the seats in the chamber', () => {
    const state = run(republic(0), 2600);
    const totals = totalSeats(state.congress);

    const house = seatsByParty(state.congress, 'house');
    const senate = seatsByParty(state.congress, 'senate');

    expect(Object.values(house).reduce((a, b) => a + b, 0)).toBeCloseTo(
      totals.house,
      6,
    );
    expect(Object.values(senate).reduce((a, b) => a + b, 0)).toBeCloseTo(
      totals.senate,
      6,
    );
  });
});
