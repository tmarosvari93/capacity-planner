import { describe, expect, it } from 'vitest';
import {
  billableSplit, freeCapacity, loadByPerson, planVsActual, projectBurn, scenarioImpact, skillGap,
} from '../src/core/questions';
import { KEY, expectMatches, model } from './helpers';

const Q = KEY.questions;
const S = KEY.meta.scenarios;

describe('Q1 freeCapacity: who will be available in 4 weeks?', () => {
  it('baseline, week of 30 Nov', async () => {
    const m = await model();
    expectMatches(freeCapacity(m, '2026-11-30'), Q.q1_whoIsAvailableIn4Weeks.baseline.result);
  });
  it('with P-1 and P-2 on, starts aligned', async () => {
    const m = await model();
    expectMatches(freeCapacity(m, '2026-11-30', null, S.pairAligned), Q.q1_whoIsAvailableIn4Weeks.pairAligned.result);
  });
  it('React only, week of 7 Dec', async () => {
    expectMatches(freeCapacity(await model(), '2026-12-07', 'React'), KEY.extra.freeCapacityReact7Dec);
  });
});

describe('Q2 scenarioImpact: two pipeline projects at the same time', () => {
  it('P-1 and P-2, starts aligned', async () => {
    expectMatches(scenarioImpact(await model(), S.pairAligned), Q.q2_twoPipelineProjectsAtOnce.pairAligned.result);
  });
  it('P-1 and P-2, not aligned', async () => {
    expectMatches(scenarioImpact(await model(), S.pairUnaligned), Q.q2_twoPipelineProjectsAtOnce.pairUnaligned.result);
  });
  it('Nova phase 2 alone', async () => {
    expectMatches(scenarioImpact(await model(), S.nova2), KEY.extra.scenarioImpactNova2);
  });
  it('aligning changes only Márton and the Node.js and QA first weeks', async () => {
    const m = await model();
    const a = scenarioImpact(m, S.pairAligned);
    const u = scenarioImpact(m, S.pairUnaligned);
    expect(u.resolvedStarts).toEqual({ 'P-1': '2026-11-30', 'P-2': '2026-12-07' });
    expect(a.resolvedStarts).toEqual({ 'P-1': '2026-11-30', 'P-2': '2026-11-30' });
    const first = (r: typeof a) => Object.fromEntries(r.stackChanges.map((s) => [s.stack, s.firstWeek]));
    expect(first(u)).toMatchObject({ 'Node.js': '2026-12-07', QA: '2026-12-07', Java: '2026-11-30' });
    expect(first(a)).toMatchObject({ 'Node.js': '2026-11-30', QA: '2026-11-30', Java: '2026-11-30' });
  });
});

describe('Q3 skillGap: which skill will we run short of?', () => {
  it('baseline, next 12 weeks', async () => {
    expectMatches(skillGap(await model(), '2026-11-02', '2027-01-18'), Q.q3_skillShortage.baseline.result);
  });
  it('pair aligned', async () => {
    expectMatches(skillGap(await model(), '2026-11-02', '2027-01-18', S.pairAligned), Q.q3_skillShortage.pairAligned.result);
  });
  it('Java only, December', async () => {
    expectMatches(skillGap(await model(), '2026-11-30', '2026-12-28', undefined, 'Java'), KEY.extra.skillGapJavaDecember);
  });
});

describe('Q4 loadByPerson: who is over 100%, and who is idle?', () => {
  it('baseline, next 5 weeks', async () => {
    expectMatches(loadByPerson(await model(), '2026-11-02', '2026-11-30'), Q.q4_overAndIdle.baseline.result);
  });
  it('pair aligned', async () => {
    expectMatches(loadByPerson(await model(), '2026-11-02', '2026-11-30', S.pairAligned), Q.q4_overAndIdle.pairAligned.result);
  });
  it('Christmas weeks', async () => {
    expectMatches(loadByPerson(await model(), '2026-12-21', '2026-12-28'), KEY.extra.loadChristmas);
  });
});

describe('Q5 billableSplit: how much time went to billable work?', () => {
  for (const g of ['company', 'person', 'project'] as const) {
    it(`grouped by ${g}`, async () => {
      expectMatches(billableSplit(await model(), '2026-09-28', '2026-10-26', g), Q.q5_billableShare[g].result);
    });
  }
});

describe('planVsActual and projectBurn', () => {
  it('by person', async () => {
    expectMatches(planVsActual(await model(), '2026-09-28', '2026-10-26', 'person'), KEY.planVsActual.person);
  });
  it('by project; Pulse is the drifting project', async () => {
    const r = planVsActual(await model(), '2026-09-28', '2026-10-26', 'project');
    expectMatches(r, KEY.planVsActual.project);
    const mapped = r.rows.filter((x) => !String(x.projectId).startsWith('UNMAPPED'));
    const worst = mapped.reduce((a, b) => (Math.abs(b.driftPct ?? 0) > Math.abs(a.driftPct ?? 0) ? b : a));
    expect(worst.projectId).toBe('INT-PULSE');
  });
  it('Orbit burn', async () => {
    const { note, ...expected } = KEY.projectBurn;
    expectMatches(projectBurn(await model(), 'PRJ-ORBIT'), expected);
  });
});
