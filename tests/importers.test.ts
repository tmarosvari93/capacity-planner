import { describe, expect, it } from 'vitest';
import { detectKind, mergeUpload, parseAbsencesCsv, parsePeopleCsv } from '../src/core/importers';
import { applyOverrides } from '../src/core/overrides';
import { dataIssues, lastSync } from '../src/core/issues';
import { parseCsv, parseHrDate } from '../src/core/util';
import { KEY, dataset, model, readData } from './helpers';

describe('importers on the sample files', () => {
  it('rows read match the answer key', async () => {
    expect((await dataset()).rows).toEqual(KEY.meta.rowsRead);
  });
  it('people: 12 imported, HR dates and hours as in the key', async () => {
    const m = await model();
    expect(m.people).toHaveLength(12);
    for (const p of KEY.people) {
      const got = m.personByEmail.get(p.email)!;
      expect(got, p.email).toBeDefined();
      expect([got.name, got.weeklyHours, got.start, got.end, got.mainStack, got.stacks])
        .toEqual([p.name, p.weeklyHours, p.start, p.end, p.mainStack, p.stacks]);
    }
  });
  it('605 worklogs, 34 sprint issues', async () => {
    const ds = await dataset();
    expect(ds.worklogs).toHaveLength(605);
    expect(ds.sprint!.issues).toHaveLength(34);
    expect(ds.worklogFiles.map((f) => f.weekStart)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  });
  it('data issues equal the answer key (as a set)', async () => {
    const m = await model();
    const norm = (xs: any[]) => xs.map((i) => JSON.stringify([i.severity, i.rule, i.file, i.row, i.text, i.fixIn])).sort();
    expect(norm(m.issues)).toEqual(norm(KEY.dataIssues));
  });
  it('dataIssues sorts errors first', async () => {
    const sev = dataIssues(await model()).map((i) => i.severity);
    expect(sev[0]).toBe('error');
    expect(sev.indexOf('info')).toBeGreaterThan(sev.lastIndexOf('warning'));
  });
  it('last sync per source', async () => {
    const s = Object.fromEntries(lastSync(await model()).map((x) => [x.source, x.exportedAt]));
    expect(s).toEqual({ HR: '2026-11-02T06:45:00+01:00', Jira: '2026-11-02T07:20:00+01:00', App: '2026-11-02T08:00:00+01:00' });
  });
});

describe('flaws F1–F8 (answer key "flaws")', () => {
  const F = KEY.flaws;
  it('F1 unmapped person: 6 h kept on Helix, in no person row', async () => {
    const m = await model();
    const logs = m.worklogs.filter((l) => l.email == null);
    expect(logs.reduce((t, l) => t + l.hours, 0)).toBe(F.F1.unmappedPersonHours);
    expect(new Set(logs.map((l) => l.projectId))).toEqual(new Set(['PRJ-HELIX']));
  });
  it('F2 unmapped key MRD: 14 h, no project', async () => {
    const m = await model();
    const logs = m.worklogs.filter((l) => l.projectId == null);
    expect(logs.reduce((t, l) => t + l.hours, 0)).toBe(F.F2.unmappedKeyHours);
    expect(new Set(logs.map((l) => l.projectKey))).toEqual(new Set(['MRD']));
  });
  it('F3 unlabelled worklogs counted, info only', async () => {
    expect((await model()).unlabelledWorklogs).toBe(F.F3.unlabelledWorklogs);
  });
  it('F4 Fleet dashboard has no win chance and is still a pipeline project', async () => {
    const p = (await model()).projectById.get(F.F4.projectId)!;
    expect(p.winChancePct).toBeNull();
    expect(p.type).toBe('pipeline');
  });
  it('F5 issue without estimate counts 0 h: Bence on Helix 20 h/week in the sprint', async () => {
    const m = await model();
    expect(m.sprint!.assigned.get(`${F.F5.personEmail}|${F.F5.projectId}`)).toBe(F.F5.sprintHoursPerWeek);
  });
  it('F6 holiday over 24-25 Dec is not deducted twice', async () => {
    const { absenceDays, availableHours } = await import('../src/core/capacity');
    const m = await model();
    const p = m.personByEmail.get('eszter.nagy@agency.example')!;
    expect(absenceDays(p, '2026-12-21')).toBe(F.F6.absenceDaysW52);
    expect(availableHours(m, p.email, '2026-12-21')).toBe(F.F6.availableHoursW52);
  });
  it('F7 blank weekly hours read as 40', async () => {
    expect((await model()).personByEmail.get('petra.molnar@agency.example')!.weeklyHours).toBe(F.F7.weeklyHours);
  });
  it('F8 dates: dotted and slash read with a warning, "Feb 2027" row skipped', async () => {
    const m = await model();
    expect(m.personByEmail.get('lili.horvath@agency.example')!.start).toBe(F.F8.liliStart);
    expect(m.personByEmail.get('dora.szabo@agency.example')!.end).toBe(F.F8.doraEnd);
    expect(m.people).toHaveLength(F.F8.peopleImported);
    expect(m.issues.find((i) => i.severity === 'error')!.row).toBe(F.F8.skippedRow);
  });
});

describe('parsers on their own', () => {
  it('HR dates', () => {
    expect(parseHrDate('2026.11.16.')).toEqual({ date: '2026-11-16', format: 'dotted' });
    expect(parseHrDate('31/01/2027')).toEqual({ date: '2027-01-31', format: 'slash' });
    expect(parseHrDate('31/02/2027').format).toBe('bad');
    expect(parseHrDate('').format).toBe('blank');
  });
  it('CSV with quotes, commas and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
  });
  it('unknown absence e-mail is skipped as an error', () => {
    const r = parseAbsencesCsv('email,type,start_date,end_date\nnobody@x.example,holiday,2026-11-02,2026-11-03\n', new Set());
    expect(r.absences).toHaveLength(0);
    expect(r.issues[0].severity).toBe('error');
  });
  it('people without an e-mail are skipped', () => {
    const r = parsePeopleCsv('email,full_name,job_title,weekly_hours,start_date,end_date,employment_type\n,X,Y,40,2026-01-01,,employee\n');
    expect(r.people).toHaveLength(0);
  });
});

describe('upload of a newer export (merge by key)', () => {
  it('re-uploading W44 changes nothing; a new week adds rows and moves last sync', async () => {
    const ds = await dataset();
    const w44 = await readData('jira/worklogs_2026-W44.json');
    const same = mergeUpload(ds, 'jira/worklogs_2026-W44.json', w44, '');
    expect(same.worklogs).toHaveLength(605);
    const next = JSON.parse(w44);
    next.exportedAt = '2026-11-09T07:15:00+01:00';
    next.weekStart = '2026-11-02';
    next.worklogs = next.worklogs.slice(0, 3).map((l: any, i: number) => ({ ...l, id: `99${i}`, started: '2026-11-03T09:00:00.000+0100' }));
    const up = mergeUpload(ds, 'jira/worklogs_2026-W45.json', JSON.stringify(next), '');
    expect(up.worklogs).toHaveLength(608);
    expect(lastSync(applyOverrides(up)).find((s) => s.source === 'Jira')!.exportedAt).toBe('2026-11-09T07:15:00+01:00');
  });
  it('detects file kinds and refuses others', async () => {
    expect(detectKind('hr/people.csv', await readData('hr/people.csv'))).toBe('people');
    expect(detectKind('a.csv', await readData('hr/absences.csv'))).toBe('absences');
    expect(detectKind('x.json', await readData('jira/sprint_next.json'))).toBe('sprint');
    expect(() => mergeUpload({} as any, 'x.json', '{"foo":1}', '')).toThrow();
  });
});
