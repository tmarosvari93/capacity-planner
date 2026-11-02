import { describe, expect, it } from 'vitest';
import { FUTURE, PAST, WEEKS, fteHours, isoWeek, weekNote, weekOf, workingDays } from '../src/core/calendar';
import { KEY } from './helpers';

describe('calendar', () => {
  it('17 weeks, 5 past and 12 future, with the answer key working days', () => {
    expect(WEEKS).toHaveLength(17);
    expect(PAST).toHaveLength(5);
    expect(FUTURE).toHaveLength(12);
    for (const c of KEY.calendar) {
      const i = WEEKS.indexOf(c.weekStart);
      expect(i, c.weekStart).toBeGreaterThanOrEqual(0);
      expect(workingDays(c.weekStart), c.weekStart).toBe(c.workingDays);
      expect(fteHours(c.weekStart)).toBe(c.fteHours);
      expect(isoWeek(c.weekStart)).toBe(c.isoWeek);
    }
  });
  it('short and long weeks: W43 4, W50 6, W52 3, W53 4', () => {
    expect(workingDays('2026-10-19')).toBe(4);
    expect(workingDays('2026-12-07')).toBe(6);
    expect(workingDays('2026-12-21')).toBe(3);
    expect(workingDays('2026-12-28')).toBe(4);
    expect(isoWeek('2026-12-28')).toBe('2026-W53');
  });
  it('weekOf and week notes', () => {
    expect(weekOf('2026-12-03')).toBe('2026-11-30');
    expect(weekOf('2026-11-01')).toBe('2026-10-26');
    expect(weekNote('2026-12-07')).toContain('Working Saturday');
    expect(weekNote('2026-11-30')).toBeNull();
  });
});
