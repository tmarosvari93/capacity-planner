// Calendar: the fixed planning window and the Hungarian working schedule.
// Source: NGM decree 10/2025 (IV. 30.), checked 1 Nov 2026 (contract §1).
import type { ISODate, Week } from './types';

export const TODAY: ISODate = '2026-11-02';
export const WINDOW_START: Week = '2026-09-28';
export const N_WEEKS = 17; // 5 past + 12 future
export const IN_4_WEEKS: Week = '2026-11-30';

export const NON_WORKING: Record<ISODate, string> = {
  '2026-10-23': 'Public holiday (1956 Revolution)',
  '2026-11-01': 'Public holiday (All Saints)',
  '2026-12-24': 'Bridge rest day',
  '2026-12-25': 'Public holiday (Christmas)',
  '2026-12-26': 'Public holiday',
  '2027-01-01': 'Public holiday (New Year)',
};
export const WORKING_SATURDAYS: Record<ISODate, string> = {
  '2026-12-12': 'Working Saturday (swap for 24 Dec)',
};

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toUTC(d: ISODate): number {
  const [y, m, dd] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, dd);
}
function fromUTC(t: number): ISODate {
  return new Date(t).toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(toUTC(d) + n * DAY_MS);
}
export function addWeeks(d: ISODate, n: number): ISODate {
  return addDays(d, 7 * n);
}
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}
/** 0 = Monday … 6 = Sunday */
export function weekday(d: ISODate): number {
  return (new Date(toUTC(d)).getUTCDay() + 6) % 7;
}
export function weekOf(d: ISODate): Week {
  return addDays(d, -weekday(d));
}
export function isValidDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return fromUTC(toUTC(d)) === d;
}
export const minDate = (a: ISODate, b: ISODate): ISODate => (a < b ? a : b);
export const maxDate = (a: ISODate, b: ISODate): ISODate => (a > b ? a : b);

export function isWorkingDay(d: ISODate): boolean {
  if (d in WORKING_SATURDAYS) return true;
  if (weekday(d) >= 5) return false;
  return !(d in NON_WORKING);
}

export const WEEKS: Week[] = Array.from({ length: N_WEEKS }, (_, i) => addWeeks(WINDOW_START, i));
export const PAST: Week[] = WEEKS.filter((w) => w < TODAY);
export const FUTURE: Week[] = WEEKS.filter((w) => w >= TODAY);
export const LAST_WEEK: Week = WEEKS[WEEKS.length - 1];

export function weekDates(w: Week): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(w, i));
}
export function workingDates(w: Week): ISODate[] {
  return weekDates(w).filter(isWorkingDay);
}
export function workingDays(w: Week): number {
  return workingDates(w).length;
}
/** 1 FTE in this week = 8 h × working days. */
export function fteHours(w: Week): number {
  return 8 * workingDays(w);
}
/** Window weeks w with from <= w <= to. */
export function weeksBetween(from: Week, to: Week): Week[] {
  return WEEKS.filter((w) => from <= w && w <= to);
}
export function isoWeek(w: Week): string {
  const thursday = addDays(w, 3);
  const year = thursday.slice(0, 4);
  const n = Math.floor(daysBetween(`${year}-01-01`, thursday) / 7) + 1;
  return `${year}-W${String(n).padStart(2, '0')}`;
}
/** "30 Nov" */
export function shortDate(d: ISODate): string {
  const [, m, dd] = d.split('-').map(Number);
  return `${dd} ${MONTHS[m - 1]}`;
}
/** Notes for short or long weeks, for the grid header. */
export function weekNote(w: Week): string | null {
  const notes = weekDates(w)
    .filter((d) => d in NON_WORKING || d in WORKING_SATURDAYS)
    .filter((d) => d in WORKING_SATURDAYS || weekday(d) < 5)
    .map((d) => `${shortDate(d)}: ${NON_WORKING[d] ?? WORKING_SATURDAYS[d]}`);
  return notes.length ? notes.join('; ') : null;
}
