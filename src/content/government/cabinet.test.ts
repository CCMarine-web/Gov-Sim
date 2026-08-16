import { describe, expect, it } from 'vitest';
import { PHASE_1_END_DAY, PHASE_1_START_DAY, isoToDay } from '@/sim/calendar';
import { HISTORICAL_ADMINISTRATIONS, OFFICES } from './cabinet';

describe('cabinet data integrity', () => {
  it('every office carries at least one source', () => {
    for (const office of OFFICES) {
      expect(office.sources.length, office.id).toBeGreaterThan(0);
    }
  });

  it('every date is a zero-padded ISO date', () => {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    for (const office of OFFICES) {
      expect(office.createdOn).toMatch(iso);
      for (const tenure of office.tenures) {
        expect(tenure.from, `${office.id} ${tenure.name}`).toMatch(iso);
        if (tenure.to !== null) expect(tenure.to).toMatch(iso);
      }
    }
  });

  it('no tenure ends before it begins', () => {
    for (const office of OFFICES) {
      for (const tenure of office.tenures) {
        if (tenure.to === null) continue;
        expect(
          isoToDay(tenure.to),
          `${office.id} ${tenure.name}`,
        ).toBeGreaterThanOrEqual(isoToDay(tenure.from));
      }
    }
  });

  it('tenures within an office are in chronological order and do not overlap', () => {
    for (const office of OFFICES) {
      for (let i = 1; i < office.tenures.length; i++) {
        const previous = office.tenures[i - 1];
        const current = office.tenures[i];
        expect(previous.to, `${office.id} ${previous.name}`).not.toBeNull();
        expect(
          isoToDay(current.from),
          `${office.id}: ${current.name} starts before ${previous.name} ends`,
        ).toBeGreaterThanOrEqual(isoToDay(previous.to!));
      }
    }
  });

  it('no tenure begins before its department was created', () => {
    for (const office of OFFICES) {
      const created = isoToDay(office.createdOn);
      for (const tenure of office.tenures) {
        expect(
          isoToDay(tenure.from),
          `${office.id} ${tenure.name}`,
        ).toBeGreaterThanOrEqual(created);
      }
    }
  });

  it('every date falls inside the Phase 1 window', () => {
    const dates = [
      ...OFFICES.flatMap((o) => [
        o.createdOn,
        ...o.tenures.flatMap((t) => (t.to ? [t.from, t.to] : [t.from])),
      ]),
      ...HISTORICAL_ADMINISTRATIONS.flatMap((a) => (a.to ? [a.from, a.to] : [a.from])),
    ];

    for (const date of dates) {
      const day = isoToDay(date);
      expect(day, date).toBeGreaterThanOrEqual(PHASE_1_START_DAY);
      // Adams's term ends 1801-03-04, just past the window; allow the historical
      // administrations to run slightly over so the record is not truncated.
      expect(day, date).toBeLessThanOrEqual(PHASE_1_END_DAY + 100);
    }
  });

  it('covers the four departments that existed in this period', () => {
    expect(OFFICES.map((o) => o.id).sort()).toEqual([
      'attorney_general',
      'state',
      'treasury',
      'war',
    ]);
  });
});

describe('known appointments land on their verified dates', () => {
  it.each([
    ['treasury', 'Alexander Hamilton', '1789-09-11'],
    ['state', 'Thomas Jefferson', '1790-03-22'],
    ['war', 'Henry Knox', '1789-09-12'],
    ['attorney_general', 'Edmund Randolph', '1789-09-26'],
  ])('%s: %s from %s', (officeId, name, from) => {
    const office = OFFICES.find((o) => o.id === officeId)!;
    const tenure = office.tenures.find((t) => t.name === name)!;
    expect(tenure).toBeDefined();
    expect(tenure.from).toBe(from);
  });

  /**
   * Edmund Randolph held both the Attorney Generalship and the State
   * Department, and for 24 days in January 1794 he held them at the same time:
   * he took State on 2 January while remaining Attorney General until the
   * 26th, when William Bradford succeeded him.
   *
   * An earlier version of this test asserted he left one before taking the
   * other. That was the test encoding a tidy assumption, not the data being
   * wrong — the overlap is real and is now asserted rather than smoothed away.
   */
  it('records Randolph’s brief simultaneous tenure in two offices', () => {
    const asAG = OFFICES.find((o) => o.id === 'attorney_general')!.tenures.find(
      (t) => t.name === 'Edmund Randolph',
    )!;
    const asState = OFFICES.find((o) => o.id === 'state')!.tenures.find(
      (t) => t.name === 'Edmund Randolph',
    )!;

    expect(asAG).toBeDefined();
    expect(asState).toBeDefined();

    const overlapDays = isoToDay(asAG.to!) - isoToDay(asState.from);
    expect(overlapDays).toBeGreaterThan(0);
    expect(overlapDays).toBeLessThan(40);
  });

  it('records the single historical change of administration', () => {
    expect(HISTORICAL_ADMINISTRATIONS.map((a) => a.name)).toEqual([
      'George Washington',
      'John Adams',
    ]);
  });
});
