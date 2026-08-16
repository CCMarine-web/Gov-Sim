/**
 * CALENDAR
 *
 * Converts between the simulation's integer day counter and civil dates.
 *
 * Game time is an integer: `day 0` is 30 April 1789, the date of Washington's
 * inauguration. Phase 1 ends on `day 4262`, 31 December 1800 — a span of 4,263
 * days. (DESIGN.md §6.6)
 *
 * WHY NOT `Date`
 * This module deliberately uses pure integer arithmetic and never constructs a
 * JavaScript `Date`. `Date` interprets values against the host machine's time
 * zone, so the same day number could resolve to different dates on two
 * machines — which would violate determinism (DESIGN.md Rule 2) in a way that
 * would only show up when a save moved between computers. Integer arithmetic
 * cannot drift.
 *
 * THE ALGORITHM
 * `daysFromCivil` and `civilFromDays` implement Howard Hinnant's well-known
 * civil calendar algorithms. They are exact for the proleptic Gregorian
 * calendar over any year range we care about, and they are branch-free integer
 * maths rather than a table of month lengths.
 *
 * Gregorian is the correct calendar throughout the game's range: Britain and
 * its colonies adopted it in 1752, well before 1789.
 */

/** Day 0 of the simulation: 30 April 1789. */
export const EPOCH_YEAR = 1789;
export const EPOCH_MONTH = 4;
export const EPOCH_DAY = 30;

/** Phase 1 covers 1789-04-30 through 1800-12-31 inclusive. */
export const PHASE_1_START_DAY = 0;
export const PHASE_1_END_DAY = 4262;
export const PHASE_1_TOTAL_DAYS = PHASE_1_END_DAY - PHASE_1_START_DAY + 1;

export interface CivilDate {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Integer division that floors toward negative infinity, as the algorithm requires. */
function idiv(a: number, b: number): number {
  return Math.floor(a / b);
}

/**
 * Days since 1970-01-01 for a proleptic Gregorian date.
 * Negative for dates before 1970 — which is every date in Phase 1.
 */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = year - (month <= 2 ? 1 : 0);
  const era = idiv(y >= 0 ? y : y - 399, 400);
  const yoe = y - era * 400; // [0, 399]
  const doy = idiv(153 * (month + (month > 2 ? -3 : 9)) + 2, 5) + day - 1; // [0, 365]
  const doe = yoe * 365 + idiv(yoe, 4) - idiv(yoe, 100) + doy; // [0, 146096]
  return era * 146097 + doe - 719468;
}

/** Inverse of `daysFromCivil`. */
function civilFromDays(z: number): CivilDate {
  const shifted = z + 719468;
  const era = idiv(shifted >= 0 ? shifted : shifted - 146096, 146097);
  const doe = shifted - era * 146097; // [0, 146096]
  const yoe = idiv(doe - idiv(doe, 1460) + idiv(doe, 36524) - idiv(doe, 146096), 365); // [0, 399]
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + idiv(yoe, 4) - idiv(yoe, 100)); // [0, 365]
  const mp = idiv(5 * doy + 2, 153); // [0, 11]
  const d = doy - idiv(153 * mp + 2, 5) + 1; // [1, 31]
  const m = mp + (mp < 10 ? 3 : -9); // [1, 12]
  return { year: y + (m <= 2 ? 1 : 0), month: m, day: d };
}

/** Day number of the epoch, expressed in days-since-1970. */
const EPOCH_OFFSET = daysFromCivil(EPOCH_YEAR, EPOCH_MONTH, EPOCH_DAY);

/**
 * Convert a simulation day number to a civil date.
 * `dayToDate(0)` is 30 April 1789.
 */
export function dayToDate(day: number): CivilDate {
  return civilFromDays(EPOCH_OFFSET + day);
}

/**
 * Convert a civil date to a simulation day number.
 * The inverse of `dayToDate`.
 */
export function dateToDay(year: number, month: number, day: number): number {
  return daysFromCivil(year, month, day) - EPOCH_OFFSET;
}

/** Parse an ISO `YYYY-MM-DD` string to a simulation day number. */
export function isoToDay(iso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    throw new Error(
      `Invalid ISO date "${iso}". Expected YYYY-MM-DD. ` +
        'Content files must use zero-padded ISO dates.',
    );
  }
  return dateToDay(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** Format a day number as an ISO `YYYY-MM-DD` string. */
export function dayToIso(day: number): string {
  const { year, month, day: d } = dayToDate(day);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Is this a leap year in the proleptic Gregorian calendar?
 *
 * A year is a leap year if it is divisible by 4, EXCEPT century years, which
 * must also be divisible by 400.
 *
 * This matters concretely and immediately: **1800 is not a leap year.** A naive
 * `year % 4 === 0` check would invent 29 February 1800, putting every date from
 * that point to the end of Phase 1 one day off — including the final date of
 * the phase and any event scripted in 1800.
 */
export function isLeapYear(year: number): boolean {
  if (year % 4 !== 0) return false;
  if (year % 100 !== 0) return true;
  return year % 400 === 0;
}

/** 365 or 366. Used for daily accrual of annual figures. (ECONOMY.md §7.9) */
export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/** Number of days in a given month. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/**
 * Is this day the first of a month?
 *
 * The economic model recomputes on the 1st of each month rather than every day
 * (DESIGN.md §6.5). The trigger is the calendar, derived from `day`, never a
 * modulo of the day counter — `day % 30` would drift against real months.
 */
export function isFirstOfMonth(day: number): boolean {
  return dayToDate(day).day === 1;
}

/** Is this day the first of January? Used for annual fiscal rollover. */
export function isFirstOfYear(day: number): boolean {
  const date = dayToDate(day);
  return date.month === 1 && date.day === 1;
}

/**
 * Format a day number in period-appropriate long form: "14 March 1791".
 *
 * Deliberately not `Intl.DateTimeFormat`, which varies by host locale and
 * would render differently on different machines — a determinism hazard and a
 * presentation inconsistency. (DESIGN.md Rule 2)
 */
export function formatLongDate(day: number): string {
  const { year, month, day: d } = dayToDate(day);
  return `${d} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** Month name for a 1–12 month number. */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1];
}

/** The calendar year of a given day. */
export function yearOf(day: number): number {
  return dayToDate(day).year;
}
