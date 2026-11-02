import { describe, expect, it } from 'vitest';
import { WEEKS } from '../src/core/calendar';
import { plannedHours, plannedRows } from '../src/core/capacity';
import {
  EMPTY_LAYER, applyOverrides, loadOverrides, projectFromForm, resetOverrides, saveOverrides, withOp, withScenario,
  type OverrideLayer,
} from '../src/core/overrides';
import { billableSplit, scenarioImpact, skillGap } from '../src/core/questions';
import { describeScenario, setAlignStarts, setProjectOn, shiftProject } from '../src/core/scenario';
import { KEY, dataset, model } from './helpers';

const MARTON = 'marton.kiss@agency.example';

function memoryStorage() {
  const s = new Map<string, string>();
  return { getItem: (k: string) => s.get(k) ?? null, setItem: (k: string, v: string) => void s.set(k, v), removeItem: (k: string) => void s.delete(k) };
}

describe('hours edit (person panel)', () => {
  it('changes only the edited cells', async () => {
    const before = await model();
    const layer = withOp(EMPTY_LAYER, { op: 'setAllocation', email: MARTON, projectId: 'INT-PULSE', hoursPerWeek: 0,
      fromWeek: '2026-11-30', toWeek: '2027-01-18' });
    const after = await model(layer);
    for (const p of before.people) {
      for (const w of WEEKS) {
        const changed = p.email === MARTON && w >= '2026-11-30';
        const b = plannedHours(before, p.email, w);
        const a = plannedHours(after, p.email, w);
        if (changed) expect(a, `${p.email} ${w}`).toBe(0);
        else expect(a, `${p.email} ${w}`).toBe(b);
      }
    }
    expect(plannedRows(after, MARTON, '2026-11-30')[0].source).toBe('manual');
  });
  it('demo step 3: with P-2 aligned, Márton drops from 150% to 100% after the edit', async () => {
    const sc = KEY.meta.scenarios.pairAligned;
    const layer = withOp(EMPTY_LAYER, { op: 'setAllocation', email: MARTON, projectId: 'INT-PULSE', hoursPerWeek: 0,
      fromWeek: '2026-11-30', toWeek: '2027-01-18' });
    const m = await model(layer);
    expect(plannedHours(m, MARTON, '2026-11-30', sc)).toBe(40);
    expect(scenarioImpact(m, sc).newlyOver.map((p) => p.name)).toEqual(['Kovács Anna']);
  });
  it('manual edits never rewrite the past plan of record', async () => {
    const layer = withOp(EMPTY_LAYER, { op: 'setAllocation', email: MARTON, projectId: 'INT-PULSE', hoursPerWeek: 0,
      fromWeek: '2026-09-28', toWeek: '2026-10-26' });
    expect(plannedHours(await model(layer), MARTON, '2026-10-05')).toBe(20);
  });
});

describe('Add project, switch on, Mark as signed (demo step 5)', () => {
  it('Add project form validates like the canvas', async () => {
    const m = await model();
    const base = { type: 'pipeline' as const, name: 'Test', client: '', startWeek: '2026-12-07', durationWeeks: 4,
      lines: [{ stack: 'React', fte: 1 }] };
    expect(projectFromForm(m, { ...base, name: ' ' })).toEqual({ error: 'Give the project a name.' });
    expect(projectFromForm(m, { ...base, durationWeeks: 30 })).toEqual({ error: 'Duration must be 1 to 26 weeks.' });
    expect(projectFromForm(m, { ...base, lines: [{ stack: 'React', fte: 0 }] })).toEqual({ error: 'Add at least one stack line with FTE above 0.' });
    const ok = projectFromForm(m, base);
    expect('project' in ok && ok.project.projectId).toBe('P-5');
  });
  it('a new pipeline project switched on grows the React gap', async () => {
    let m = await model();
    const r = projectFromForm(m, { type: 'pipeline', name: 'Kiosk app', client: 'Demo', startWeek: '2026-12-07',
      durationWeeks: 4, lines: [{ stack: 'React', fte: 1 }] });
    if (!('project' in r)) throw new Error(r.error);
    let layer: OverrideLayer = withOp(EMPTY_LAYER, { op: 'addProject', project: r.project });
    layer = withScenario(layer, setProjectOn(layer.scenario, 'P-5', true));
    m = await model(layer);
    const base = skillGap(m, '2026-11-02', '2027-01-18').matrix.React['2026-12-07'].balanceFte;
    const on = skillGap(m, '2026-11-02', '2027-01-18', layer.scenario).matrix.React['2026-12-07'].balanceFte;
    expect(on).toBeCloseTo(base - 1, 2);
    expect(m.issues.some((i) => i.rule === 'F4' && i.row === 'P-5')).toBe(true); // no win chance given
  });
  it('Mark as signed: named lines become allocations, unnamed lines become baseline demand', async () => {
    const layer = withOp(EMPTY_LAYER, { op: 'markSigned', projectId: 'P-2', startDate: '2026-11-30' });
    const m = await model(layer);
    const p = m.projectById.get('P-2')!;
    expect(p.type).toBe('signed');
    expect(p.winChancePct).toBeNull();
    expect(p.startDate).toBe('2026-11-30');
    expect(p.endDate).toBe('2027-01-22');
    expect(p.demand.map((d) => [d.stack, d.fte, d.fromWeek, d.toWeek])).toEqual([
      ['Node.js', 0.5, '2026-11-30', '2027-01-18'], ['QA', 0.5, '2026-11-30', '2027-01-18']]);
    expect(plannedRows(m, MARTON, '2026-11-30').find((r) => r.projectId === 'P-2'))
      .toEqual({ projectId: 'P-2', hours: 40, ratePerWeek: 40, source: 'manual' });
    const gaps = Object.fromEntries(skillGap(m, '2026-11-02', '2027-01-18').shortages.map((s) => [s.stack, s.peakFte]));
    expect(gaps['Node.js']).toBeCloseTo(0.3, 2);
    expect(gaps.QA).toBeCloseTo(0.75, 2);
  });
  it('mapping MRD to P-1 and signing P-1 makes those 14 h billable', async () => {
    const before = billableSplit(await model(), '2026-09-28', '2026-10-26').company.billableHours;
    let layer = withOp(EMPTY_LAYER, { op: 'mapJiraKey', jiraProjectKey: 'MRD', projectId: 'P-1' });
    let m = await model(layer);
    expect(m.issues.some((i) => i.rule === 'F2')).toBe(false);
    expect(billableSplit(m, '2026-09-28', '2026-10-26').company.billableHours).toBe(before); // still pipeline
    layer = withOp(layer, { op: 'markSigned', projectId: 'P-1' });
    m = await model(layer);
    expect(billableSplit(m, '2026-09-28', '2026-10-26').company.billableHours).toBe(before + 14);
  });
  it('a broken edit is skipped and flagged, not thrown', async () => {
    const m = await model(withOp(EMPTY_LAYER, { op: 'markSigned', projectId: 'PRJ-NOVA' }));
    expect(m.issues.some((i) => i.rule === 'edit-skipped')).toBe(true);
  });
});

describe('scenario helpers', () => {
  it('switch, shift and align build the answer key scenario', async () => {
    const m = await model();
    let sc = setProjectOn(undefined, 'P-1', true);
    sc = setProjectOn(sc, 'P-2', true);
    expect(describeScenario(m, sc)).toBe('P-1, P-2 on');
    sc = setAlignStarts(sc, true);
    expect(scenarioImpact(m, sc).resolvedStarts).toEqual({ 'P-1': '2026-11-30', 'P-2': '2026-11-30' });
    expect(describeScenario(m, sc)).toBe('P-1, P-2 on, starts aligned (30 Nov)');
    expect(describeScenario(m, shiftProject(setProjectOn(undefined, 'P-4', true), 'P-4', -2))).toBe('P-4 on, P-4 from 14 Dec');
    expect(describeScenario(m, undefined)).toBe('Baseline');
  });
  it('a scenario entry for a signed project is ignored', async () => {
    const m = await model(withOp(EMPTY_LAYER, { op: 'markSigned', projectId: 'P-1' }));
    expect(scenarioImpact(m, setProjectOn(undefined, 'P-1', true)).resolvedStarts).toEqual({});
  });
});

describe('localStorage layer and Reset (demo step 7)', () => {
  it('save, load and reset; reset returns the answer key baseline', async () => {
    const st = memoryStorage();
    const layer = withScenario(withOp(EMPTY_LAYER, { op: 'markSigned', projectId: 'P-2' }), KEY.meta.scenarios.pairAligned);
    saveOverrides(layer, st);
    expect(loadOverrides(st)).toEqual(layer);
    const cleared = resetOverrides(st);
    expect(loadOverrides(st)).toEqual(EMPTY_LAYER);
    const m = applyOverrides(await dataset(), cleared);
    expect(skillGap(m, '2026-11-02', '2027-01-18').shortages.map((s) => s.stack)).toEqual(['Java', 'QA']);
  });
  it('a corrupt or blocked store falls back to no edits', () => {
    expect(loadOverrides({ getItem: () => '{oops', setItem: () => {}, removeItem: () => {} })).toEqual(EMPTY_LAYER);
    expect(loadOverrides({ getItem: () => { throw new Error('blocked'); }, setItem: () => {}, removeItem: () => {} })).toEqual(EMPTY_LAYER);
    expect(() => saveOverrides(EMPTY_LAYER, { getItem: () => null, setItem: () => { throw new Error('full'); }, removeItem: () => {} })).not.toThrow();
  });
});
