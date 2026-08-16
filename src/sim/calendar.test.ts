import { describe, expect, it } from 'vitest';
import {
  PHASE_1_END_DAY,
  PHASE_1_START_DAY,
  PHASE_1_TOTAL_DAYS,
  dateToDay,
  dayToDate,
  dayToIso,
  daysInMonth,
  daysInYear,
  formatLongDate,
  isFirstOfMonth,
  isFirstOfYear,
  isLeapYear,
  isoToDay,
  yearOf,
} from './calendar';

describe('epoch', () => {
  it('day 0 is 30 April 1789, the date of Washington’s inauguration', () => {
    expect(dayToDate(0)).toEqual({ year: 1789, month: 4, day: 30 });
    expect(dayToIso(0)).toBe('1789-04-30');
  });

  it('day 1 is 1 May 1789', () => {
    expect(dayToIso(1)).toBe('1789-05-01');
  });

  it('Phase 1 ends on day 4262, 31 December 1800', () => {
    expect(dayToIso(PHASE_1_END_DAY)).toBe('1800-12-31');
    expect(PHASE_1_END_DAY).toBe(4262);
  });

  it('Phase 1 spans 4,263 days inclusive', () => {
    expect(PHASE_1_TOTAL_DAYS).toBe(4263);
  });
});

describe('the 1800 leap year rule', () => {
  /**
   * The single most consequential calendar fact in Phase 1. A naive
   * `year % 4 === 0` check invents 29 February 1800 and puts every subsequent
   * date one day off — including the last day of the phase.
   */
  it('1800 is NOT a leap year, despite being divisible by 4', () => {
    expect(1800 % 4).toBe(0); // the trap
    expect(isLeapYear(1800)).toBe(false); // the rule
  });

  it('28 February 1800 is followed directly by 1 March 1800', () => {
    const feb28 = dateToDay(1800, 2, 28);
    expect(dayToIso(feb28 + 1)).toBe('1800-03-01');
  });

  it('1792 and 1796 ARE leap years and have 29 February', () => {
    expect(isLeapYear(1792)).toBe(true);
    expect(isLeapYear(1796)).toBe(true);
    expect(dayToIso(dateToDay(1792, 2, 28) + 1)).toBe('1792-02-29');
    expect(dayToIso(dateToDay(1796, 2, 28) + 1)).toBe('1796-02-29');
  });

  it('applies the full century rule', () => {
    expect(isLeapYear(1600)).toBe(true); // divisible by 400
    expect(isLeapYear(1700)).toBe(false);
    expect(isLeapYear(1800)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true); // divisible by 400
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
  });

  it('reports days in year correctly across the phase', () => {
    expect(daysInYear(1789)).toBe(365);
    expect(daysInYear(1792)).toBe(366);
    expect(daysInYear(1796)).toBe(366);
    expect(daysInYear(1800)).toBe(365); // not 366
  });

  it('reports February length correctly', () => {
    expect(daysInMonth(1800, 2)).toBe(28);
    expect(daysInMonth(1792, 2)).toBe(29);
    expect(daysInMonth(1789, 2)).toBe(28);
  });
});

describe('round-tripping', () => {
  it('dayToDate and dateToDay are exact inverses across all of Phase 1', () => {
    for (let day = PHASE_1_START_DAY; day <= PHASE_1_END_DAY; day++) {
      const { year, month, day: d } = dayToDate(day);
      expect(dateToDay(year, month, d)).toBe(day);
    }
  });

  it('advances exactly one calendar day per day number, with no gaps or repeats', () => {
    const seen = new Set<string>();
    let previous = dayToDate(PHASE_1_START_DAY);

    for (let day = PHASE_1_START_DAY; day <= PHASE_1_END_DAY; day++) {
      const iso = dayToIso(day);
      expect(seen.has(iso), `duplicate date ${iso}`).toBe(false);
      seen.add(iso);

      if (day > PHASE_1_START_DAY) {
        const current = dayToDate(day);
        const rolledMonth =
          current.day === 1 &&
          previous.day === daysInMonth(previous.year, previous.month);
        const sameMonth = current.day === previous.day + 1;
        expect(
          sameMonth || rolledMonth,
          `discontinuity between ${dayToIso(day - 1)} and ${iso}`,
        ).toBe(true);
        previous = current;
      }
    }

    expect(seen.size).toBe(PHASE_1_TOTAL_DAYS);
  });

  it('isoToDay round-trips with dayToIso', () => {
    for (const iso of ['1789-04-30', '1791-03-03', '1794-07-15', '1800-12-31']) {
      expect(dayToIso(isoToDay(iso))).toBe(iso);
    }
  });

  it('rejects malformed ISO dates rather than guessing', () => {
    expect(() => isoToDay('1791-3-3')).toThrow(/YYYY-MM-DD/);
    expect(() => isoToDay('March 1791')).toThrow();
    expect(() => isoToDay('')).toThrow();
  });
});

describe('cross-check against an independent implementation', () => {
  /**
   * Verifies our pure integer arithmetic against JavaScript's own calendar via
   * Date.UTC. Date is banned inside src/sim/ because it is timezone-sensitive,
   * but Date.UTC is deterministic and makes a legitimate independent check
   * here in a test.
   */
  it('agrees with Date.UTC on every day of Phase 1', () => {
    const epochUtc = Date.UTC(1789, 3, 30); // month is 0-indexed

    for (let day = PHASE_1_START_DAY; day <= PHASE_1_END_DAY; day++) {
      const expected = new Date(epochUtc + day * 86_400_000);
      const actual = dayToDate(day);

      expect(actual.year).toBe(expected.getUTCFullYear());
      expect(actual.month).toBe(expected.getUTCMonth() + 1);
      expect(actual.day).toBe(expected.getUTCDate());
    }
  });
});

describe('known historical dates land where they should', () => {
  it.each([
    ['1789-04-30', 'Washington inaugurated (day 0)'],
    ['1791-03-03', 'excise on distilled spirits enacted'],
    ['1791-12-15', 'Bill of Rights ratified'],
    ['1793-02-12', 'Fugitive Slave Act'],
    ['1795-10-27', 'Pinckney’s Treaty'],
    ['1800-12-31', 'final day of Phase 1'],
  ])('%s (%s) round-trips exactly', (iso) => {
    expect(dayToIso(isoToDay(iso))).toBe(iso);
  });

  it('places every scripted event date inside the Phase 1 window', () => {
    for (const iso of ['1790-07-26', '1791-03-03', '1794-07-16', '1798-07-14']) {
      const day = isoToDay(iso);
      expect(day).toBeGreaterThanOrEqual(PHASE_1_START_DAY);
      expect(day).toBeLessThanOrEqual(PHASE_1_END_DAY);
    }
  });
});

describe('month and year boundaries', () => {
  it('identifies exactly 140 month starts in Phase 1', () => {
    // May 1789 through December 1800:
    //   1789: May-Dec        =   8
    //   1790-1799: 10 x 12   = 120
    //   1800: Jan-Dec        =  12
    let count = 0;
    for (let day = PHASE_1_START_DAY; day <= PHASE_1_END_DAY; day++) {
      if (isFirstOfMonth(day)) count++;
    }
    expect(count).toBe(140);
  });

  it('identifies exactly 11 year starts in Phase 1 (1790 through 1800)', () => {
    let count = 0;
    for (let day = PHASE_1_START_DAY; day <= PHASE_1_END_DAY; day++) {
      if (isFirstOfYear(day)) count++;
    }
    expect(count).toBe(11);
  });

  it('does not treat day 0 as a month start (it is the 30th)', () => {
    expect(isFirstOfMonth(0)).toBe(false);
  });
});

describe('formatting', () => {
  it('renders period-appropriate long form', () => {
    expect(formatLongDate(isoToDay('1791-03-14'))).toBe('14 March 1791');
    expect(formatLongDate(0)).toBe('30 April 1789');
    expect(formatLongDate(PHASE_1_END_DAY)).toBe('31 December 1800');
  });

  it('does not zero-pad the day, matching period usage', () => {
    expect(formatLongDate(isoToDay('1791-03-03'))).toBe('3 March 1791');
  });

  it('yearOf reports the calendar year', () => {
    expect(yearOf(0)).toBe(1789);
    expect(yearOf(PHASE_1_END_DAY)).toBe(1800);
  });
});
