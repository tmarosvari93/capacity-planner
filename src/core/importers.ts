// Importers: parse each source export into raw records plus data issues (contract §3, §5, §6).
// Pure functions on text; loadAll() reads the files listed in manifest.json.
import { NON_WORKING, addDays, isValidDate, weekOf, weekday } from './calendar';
import type {
  Absence, DataIssue, Dataset, HrPerson, ManifestEntry, RawSprint, RawWorklog, Seed,
} from './types';
import { csvObjects, parseHrDate } from './util';

const issue = (
  severity: DataIssue['severity'], rule: string, file: string, row: DataIssue['row'], text: string,
  fixIn: string | null = null,
): DataIssue => ({ severity, rule, file, row, text, fixIn });

// ---- HR people (hr/people.csv)
export function parsePeopleCsv(text: string, file = 'hr/people.csv') {
  const rows = csvObjects(text);
  const people: HrPerson[] = [];
  const issues: DataIssue[] = [];
  rows.forEach((r, i) => {
    const n = i + 1;
    const email = (r.email ?? '').trim().toLowerCase();
    const start = parseHrDate(r.start_date);
    const end = parseHrDate(r.end_date);
    if (!email) {
      issues.push(issue('error', 'missing-email', file, n, 'No e-mail. Row skipped.'));
      return;
    }
    if (start.format === 'bad' || start.format === 'blank' || end.format === 'bad') {
      const bad = start.format === 'bad' || start.format === 'blank' ? r.start_date : r.end_date;
      issues.push(issue('error', 'F8', file, n, `Date "${bad}" cannot be read. Row skipped.`));
      return;
    }
    for (const [raw, parsed] of [[r.start_date, start], [r.end_date, end]] as const) {
      if (parsed.format === 'dotted' || parsed.format === 'slash') {
        issues.push(issue('warning', 'F8', file, n, `Date "${raw}" is not ISO. Read as ${parsed.date}.`));
      }
    }
    let weeklyHours = Number(r.weekly_hours);
    if (!(r.weekly_hours ?? '').trim()) {
      weeklyHours = 40;
      issues.push(issue('warning', 'F7', file, n, 'Blank weekly hours. Used 40 h; fix in HR.'));
    } else if (!Number.isFinite(weeklyHours) || weeklyHours < 0) {
      issues.push(issue('error', 'bad-hours', file, n, `Weekly hours "${r.weekly_hours}" cannot be read. Row skipped.`));
      return;
    }
    people.push({
      email, name: r.full_name, title: r.job_title, weeklyHours,
      start: start.date as string, end: end.date, employmentType: r.employment_type || 'employee', row: n,
    });
  });
  return { people, issues, rows: rows.length };
}

// ---- HR absences (hr/absences.csv)
export function parseAbsencesCsv(text: string, knownEmails: Set<string>, file = 'hr/absences.csv') {
  const rows = csvObjects(text);
  const absences: Absence[] = [];
  const issues: DataIssue[] = [];
  rows.forEach((r, i) => {
    const n = i + 1;
    const email = (r.email ?? '').trim().toLowerCase();
    if (!knownEmails.has(email)) {
      issues.push(issue('error', 'absence-unknown-email', file, n, 'Unknown e-mail. Row skipped.'));
      return;
    }
    const s = parseHrDate(r.start_date);
    const e = parseHrDate(r.end_date);
    if (!s.date || !e.date || e.date < s.date) {
      issues.push(issue('error', 'absence-bad-dates', file, n, 'Start or end date cannot be read. Row skipped.'));
      return;
    }
    const overlap: string[] = [];
    for (let d = s.date; d <= e.date; d = addDays(d, 1)) {
      if (weekday(d) < 5 && d in NON_WORKING) overlap.push(d);
    }
    if (overlap.length) {
      issues.push(issue('info', 'F6', file, n,
        `Absence overlaps non-working day(s) ${overlap.join(', ')}. Not deducted twice.`));
    }
    absences.push({ email, type: r.type, start: s.date, end: e.date, row: n });
  });
  return { absences, issues, rows: rows.length };
}

// ---- Jira worklogs (jira/worklogs_<week>.json)
export function parseWorklogs(text: string, file: string) {
  const js = JSON.parse(text);
  const worklogs: RawWorklog[] = (js.worklogs ?? []).map((l: any) => ({
    id: String(l.id),
    file,
    issueKey: l.issueKey,
    projectKey: l.projectKey,
    labels: l.labels ?? [],
    accountId: l.author?.accountId ?? '',
    displayName: l.author?.displayName ?? '',
    day: String(l.started).slice(0, 10),
    hours: Number(l.timeSpentSeconds) / 3600,
  }));
  const weekStart = js.weekStart ?? (worklogs[0] ? weekOf(worklogs[0].day) : '');
  return { worklogs, rows: worklogs.length, exportedAt: js.exportedAt as string, weekStart };
}

// ---- Jira sprint (jira/sprint_next.json)
export function parseSprint(text: string, file = 'jira/sprint_next.json') {
  const js = JSON.parse(text);
  const issues: DataIssue[] = [];
  const sprint: RawSprint = {
    file,
    id: js.sprint.id,
    name: js.sprint.name,
    startDate: js.sprint.startDate,
    endDate: js.sprint.endDate,
    issues: (js.issues ?? []).map((it: any) => {
      if (it.timeoriginalestimate == null) {
        issues.push(issue('warning', 'F5', file, it.key,
          `Sprint issue ${it.key} has no estimate. Counted as 0 h; planned load may be low.`));
      }
      return {
        key: it.key,
        projectKey: it.projectKey,
        accountId: it.assignee?.accountId ?? null,
        estimateSeconds: it.timeoriginalestimate ?? null,
      };
    }),
  };
  return { sprint, issues, rows: sprint.issues.length };
}

// ---- App seed (app/seed.json)
export function parseSeed(text: string): Seed {
  const seed = JSON.parse(text) as Seed;
  seed.people = seed.people.map((p) => ({ ...p, email: p.email.toLowerCase() }));
  seed.allocations = seed.allocations.map((a) => ({ ...a, email: a.email.toLowerCase() }));
  seed.jiraAccountMap = seed.jiraAccountMap.map((m) => ({ ...m, email: m.email.toLowerCase() }));
  return seed;
}

/** Guess what an uploaded file is. */
export function detectKind(path: string, text: string): ManifestEntry['kind'] | null {
  if (/\.csv$/i.test(path)) {
    const header = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0];
    if (header.includes('weekly_hours')) return 'people';
    if (header.includes('start_date') && header.includes('type')) return 'absences';
    return null;
  }
  try {
    const js = JSON.parse(text);
    if (Array.isArray(js.worklogs)) return 'worklogs';
    if (js.sprint && Array.isArray(js.issues)) return 'sprint';
  } catch {
    return null;
  }
  return null;
}

/** Load every file named in public/data/manifest.json. fetchText gets a path relative to that folder. */
export async function loadAll(fetchText: (path: string) => Promise<string>): Promise<Dataset> {
  const manifest: ManifestEntry[] = JSON.parse(await fetchText('manifest.json')).files;
  const byKind = (k: ManifestEntry['kind']) => manifest.filter((m) => m.kind === k);
  const text = new Map<string, string>();
  await Promise.all(manifest.map(async (m) => text.set(m.path, await fetchText(m.path))));

  const seedEntry = byKind('seed')[0];
  if (!seedEntry) throw new Error('manifest.json lists no seed file');
  const ds: Dataset = {
    manifest, rows: {}, issues: [], hrPeople: [], absences: [], worklogs: [], worklogFiles: [],
    sprint: null, seed: parseSeed(text.get(seedEntry.path)!),
  };
  for (const kind of ['people', 'absences', 'worklogs', 'sprint'] as const) {
    for (const m of byKind(kind)) Object.assign(ds, mergeFile(ds, kind, m.path, text.get(m.path)!));
  }
  return ds;
}

/** Merge one file into a dataset by key (contract §5.2). Returns a new dataset. */
export function mergeFile(ds: Dataset, kind: ManifestEntry['kind'], path: string, text: string): Dataset {
  const out: Dataset = { ...ds, rows: { ...ds.rows }, issues: ds.issues.filter((i) => i.file !== path) };
  if (kind === 'people') {
    const r = parsePeopleCsv(text, path);
    const byEmail = new Map(ds.hrPeople.map((p) => [p.email, p]));
    r.people.forEach((p) => byEmail.set(p.email, p));
    out.hrPeople = [...byEmail.values()];
    out.issues.push(...r.issues);
    out.rows[path] = r.rows;
  } else if (kind === 'absences') {
    const r = parseAbsencesCsv(text, new Set(ds.hrPeople.map((p) => p.email)), path);
    const key = (a: Absence) => `${a.email}|${a.start}|${a.type}`;
    const byKey = new Map(ds.absences.map((a) => [key(a), a]));
    r.absences.forEach((a) => byKey.set(key(a), a));
    out.absences = [...byKey.values()];
    out.issues.push(...r.issues);
    out.rows[path] = r.rows;
  } else if (kind === 'worklogs') {
    const r = parseWorklogs(text, path);
    const byId = new Map(ds.worklogs.map((l) => [l.id, l]));
    r.worklogs.forEach((l) => byId.set(l.id, l));
    out.worklogs = [...byId.values()];
    out.worklogFiles = [...ds.worklogFiles.filter((f) => f.path !== path),
      { path, weekStart: r.weekStart, rows: r.rows }].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
    out.rows[path] = r.rows;
  } else if (kind === 'sprint') {
    const r = parseSprint(text, path);
    if (ds.sprint && ds.sprint.file !== path) out.issues = out.issues.filter((i) => i.file !== ds.sprint!.file);
    out.sprint = r.sprint;
    out.issues.push(...r.issues);
    out.rows[path] = r.rows;
  } else {
    throw new Error(`Cannot merge a ${kind} file`);
  }
  return out;
}

/** Upload of a newer export (build step 7). Adds a manifest entry so last sync and data read update. */
export function mergeUpload(ds: Dataset, path: string, text: string, exportedAt: string): Dataset {
  const kind = detectKind(path, text);
  if (!kind) throw new Error('This file is not a people, absences, worklog or sprint export.');
  if (kind === 'worklogs' || kind === 'sprint') {
    const js = JSON.parse(text);
    if (js.exportedAt) exportedAt = js.exportedAt;
  }
  if (!isValidDate(exportedAt.slice(0, 10))) throw new Error('Export time cannot be read.');
  const merged = mergeFile(ds, kind, path, text);
  const source = kind === 'people' || kind === 'absences' ? 'HR' : 'Jira';
  merged.manifest = [...ds.manifest.filter((m) => m.path !== path), { path, source, kind, exportedAt }];
  return merged;
}
