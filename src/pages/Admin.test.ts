import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EMPTY_LAYER, FUTURE, PAST, applyOverrides, billableSplit, loadAll, plannedRows, projectFromForm, resetOverrides, resolveScenario, setProjectOn, skillGap, withOp, withScenario } from '../core';

const dataset = () => loadAll(async path => readFileSync(`public/data/${path}`, 'utf8'));

describe('Admin requested outcomes', () => {
  it('adds Test React as P-5, switched on with 0.4 FTE shortage for four weeks from 7 Dec', async () => {
    const data = await dataset();
    const model = applyOverrides(data);
    const result = projectFromForm(model, { type: 'pipeline', name: 'Test React', client: '', startWeek: '2026-12-07', durationWeeks: 4, lines: [{ stack: 'React', fte: 1, fromOffset: '', toOffset: '' }] });
    if ('error' in result) throw new Error(result.error);
    expect(result.project.projectId).toBe('P-5');
    const layer = withScenario(withOp(EMPTY_LAYER, { op: 'addProject', project: result.project }), setProjectOn(undefined, result.project.projectId, true));
    const edited = applyOverrides(data, layer);
    expect(resolveScenario(edited, layer.scenario)['P-5']).toBe('2026-12-07');
    const gap = skillGap(edited, FUTURE[0], FUTURE[FUTURE.length - 1], layer.scenario).shortages.find(row => row.stack === 'React');
    expect(gap?.firstWeek).toBe('2026-12-07');
    expect(gap?.weeks).toBe(4);
    expect(gap?.peakFte).toBe(0.4);
  });
  it('signs Loyalty with a manual 40 h allocation and preserves unstaffed Node.js and QA shortages', async () => {
    const model = applyOverrides(await dataset(), withOp(EMPTY_LAYER, { op: 'markSigned', projectId: 'P-2' }));
    const project = model.projectById.get('P-2');
    expect(project?.type).toBe('signed');
    expect(project?.demand.map(line => [line.stack, line.fte])).toEqual([['Node.js', 0.5], ['QA', 0.5]]);
    const marton = model.people.find(person => person.name === 'Kiss Márton');
    if (!marton) throw new Error('Missing Márton');
    expect(plannedRows(model, marton.email, '2026-12-07').find(row => row.projectId === 'P-2')).toMatchObject({ ratePerWeek: 40, source: 'manual' });
    const gap = skillGap(model, '2026-12-07', '2026-12-07').matrix;
    expect(gap['Node.js']['2026-12-07'].balanceFte).toBe(-0.3);
    expect(gap.QA['2026-12-07'].balanceFte).toBe(-0.5);
    expect(skillGap(model, '2026-12-07', FUTURE[FUTURE.length - 1]).shortages.find(row => row.stack === 'QA')?.peakFte).toBe(0.75);
  });
  it('mapping MRD to Delivery ops clears its 14 unmapped hours and F2 issue', async () => {
    const data = await dataset();
    const baseline = applyOverrides(data);
    const delivery = baseline.projects.find(project => project.name === 'Delivery ops');
    if (!delivery) throw new Error('Missing Delivery ops');
    expect(billableSplit(baseline, PAST[0], PAST[PAST.length - 1]).company.unmappedKeyHours).toBe(14);
    const model = applyOverrides(data, withOp(EMPTY_LAYER, { op: 'mapJiraKey', jiraProjectKey: 'MRD', projectId: delivery.projectId }));
    expect(billableSplit(model, PAST[0], PAST[PAST.length - 1]).company.unmappedKeyHours).toBe(0);
    expect(model.issues.some(issue => issue.rule === 'F2')).toBe(false);
  });
  it('reset removes added projects, signing, mapping, and scenario', async () => {
    const data = await dataset();
    const base = applyOverrides(data);
    const result = projectFromForm(base, { type: 'pipeline', name: 'Test React', client: '', startWeek: '2026-12-07', durationWeeks: 4, lines: [{ stack: 'React', fte: 1 }] });
    if ('error' in result) throw new Error(result.error);
    let layer = withOp(EMPTY_LAYER, { op: 'addProject', project: result.project });
    layer = withOp(layer, { op: 'markSigned', projectId: 'P-2' });
    layer = withOp(layer, { op: 'mapJiraKey', jiraProjectKey: 'MRD', projectId: 'INT-OPS' });
    layer = withScenario(layer, setProjectOn(undefined, 'P-5', true));
    expect(applyOverrides(data, layer).projectById.has('P-5')).toBe(true);
    const clean = resetOverrides(null);
    const model = applyOverrides(data, clean);
    expect(model.projectById.has('P-5')).toBe(false);
    expect(model.projectById.get('P-2')?.type).toBe('pipeline');
    expect(model.keyMap.has('MRD')).toBe(false);
    expect(clean.ops).toEqual([]);
    expect(clean.scenario).toBeUndefined();
  });
});