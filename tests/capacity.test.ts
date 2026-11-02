import { describe, expect, it } from 'vitest';
import { FUTURE, PAST, WEEKS } from '../src/core/calendar';
import {
  actualHours, allocationRows, availabilityFormula, availableHours, driftHours, loadPct, plannedHours, plannedRows,
} from '../src/core/capacity';
import { KEY, model } from './helpers';

const MX = KEY.matrices;
const near = (a: number, b: number) => Math.abs(a - b) <= 0.0101;

describe('per person and week, every cell against the answer key', () => {
  it('availableHours', async () => {
    const m = await model();
    for (const [email, row] of Object.entries<number[]>(MX.availableHours)) {
      WEEKS.forEach((w, i) => expect(near(availableHours(m, email, w), row[i]), `${email} ${w}`).toBe(true));
    }
  });
  it('plannedHours, baseline', async () => {
    const m = await model();
    for (const [email, row] of Object.entries<number[]>(MX.plannedHoursBaseline)) {
      WEEKS.forEach((w, i) => expect(near(plannedHours(m, email, w), row[i]), `${email} ${w}`).toBe(true));
    }
  });
  it('plannedHours, P-1 and P-2 aligned', async () => {
    const m = await model();
    for (const [email, row] of Object.entries<number[]>(MX.plannedHoursPairAligned)) {
      WEEKS.forEach((w, i) =>
        expect(near(plannedHours(m, email, w, KEY.meta.scenarios.pairAligned), row[i]), `${email} ${w}`).toBe(true));
    }
  });
  it('actualHours, past weeks', async () => {
    const m = await model();
    for (const [email, row] of Object.entries<number[]>(MX.actualHours)) {
      PAST.forEach((w, i) => expect(near(actualHours(m, email, w), row[i]), `${email} ${w}`).toBe(true));
    }
  });
  it('plan source precedence for W45–W47: manual > sprint > seed', async () => {
    const m = await model();
    for (const [email, weeks] of Object.entries<Record<string, string>[]>(MX.planSource)) {
      weeks.forEach((expected, i) => {
        const got = Object.fromEntries(allocationRows(m, email, FUTURE[i]).map((r) => [r.projectId, r.source]));
        expect(got, `${email} ${FUTURE[i]}`).toEqual(expected);
      });
    }
  });
});

describe('story checks', () => {
  it('Lili: nothing before 16 Nov, 40 h after', async () => {
    const m = await model();
    expect(availableHours(m, 'lili.horvath@agency.example', '2026-11-09')).toBe(0);
    expect(loadPct(m, 'lili.horvath@agency.example', '2026-11-09')).toBeNull();
    expect(availableHours(m, 'lili.horvath@agency.example', '2026-11-16')).toBe(40);
  });
  it('Anna is planned while away in the week of 23 Nov', async () => {
    expect(loadPct(await model(), 'anna.kovacs@agency.example', '2026-11-23')).toBe('away');
  });
  it('the working Saturday pro-rates a 20 h/week person to 24 h', async () => {
    const m = await model();
    expect(availableHours(m, 'zoltan.farkas@agency.example', '2026-12-07')).toBe(24);
    // Nova 8 + Helix 6 (to 7 Dec) + Orbit 6 = 20 h/week, × 6/5 days = 24 h: exactly 100%
    expect(plannedHours(m, 'zoltan.farkas@agency.example', '2026-12-07')).toBeCloseTo(24);
    expect(loadPct(m, 'zoltan.farkas@agency.example', '2026-12-07')).toBeCloseTo(100);
  });
  it('Dóra ends 31 Jan: still full in January, manual 36 h/week on Orbit from 9 Nov', async () => {
    const m = await model();
    expect(availableHours(m, 'dora.szabo@agency.example', '2027-01-18')).toBe(32);
    expect(plannedRows(m, 'dora.szabo@agency.example', '2026-11-16')).toEqual([
      { projectId: 'PRJ-ORBIT', hours: 36, ratePerWeek: 36, source: 'manual' }]);
  });
  it('pipeline rows only from today, only when switched on', async () => {
    const m = await model();
    const sc = KEY.meta.scenarios.pairAligned;
    const rows = plannedRows(m, 'marton.kiss@agency.example', '2026-11-30', sc);
    expect(rows.map((r) => [r.projectId, r.hours, r.source])).toEqual([['INT-PULSE', 20, 'seed'], ['P-2', 40, 'pipeline']]);
    expect(plannedRows(m, 'marton.kiss@agency.example', '2026-10-26', sc).some((r) => r.source === 'pipeline')).toBe(false);
  });
  it('drift is null in the future; MRD hours count in Kinga\'s actuals', async () => {
    const m = await model();
    expect(driftHours(m, 'kinga.papp@agency.example', '2026-11-02')).toBeNull();
    expect(actualHours(m, 'kinga.papp@agency.example', '2026-10-26')).toBe(
      m.worklogs.filter((l) => l.email === 'kinga.papp@agency.example' && l.week === '2026-10-26').reduce((t, l) => t + l.hours, 0));
    expect(m.worklogs.some((l) => l.email === 'kinga.papp@agency.example' && l.projectKey === 'MRD')).toBe(true);
  });
  it('formula line', async () => {
    expect(availabilityFormula(await model(), 'anna.kovacs@agency.example', '2026-11-23'))
      .toBe('available = 40 h ÷ 5 × (5 working days − 5 off) = 0 h');
  });
});
