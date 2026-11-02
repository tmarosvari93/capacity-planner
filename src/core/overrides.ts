// Planning edits as a separate layer over the imported data (contract §5.3), and the model build.
// The layer is a list of operations replayed in order, plus the scenario. It is saved in
// localStorage, so a re-import never wipes edits and Reset clears them in one step.
import { LAST_WEEK, TODAY, addDays, addWeeks, daysBetween, minDate, weekOf } from './calendar';
import type {
  Allocation, DataIssue, Dataset, DemandLine, Model, Person, Project, ProjectType, Scenario, SprintPlan, Week, Worklog,
} from './types';

export type Op =
  | { op: 'setAllocation'; email: string; projectId: string; hoursPerWeek: number; fromWeek: Week; toWeek: Week }
  | { op: 'addProject'; project: Project }
  | { op: 'editProject'; projectId: string; patch: Partial<Omit<Project, 'projectId'>> }
  | { op: 'addDemandLine'; projectId: string; line: DemandLine }
  | { op: 'markSigned'; projectId: string; startDate?: Week }
  | { op: 'mapJiraKey'; jiraProjectKey: string; projectId: string }
  | { op: 'editPerson'; email: string; patch: { stacks?: string[]; mainStack?: string; costPerHour?: number | null } };

export interface OverrideLayer {
  version: 1;
  ops: Op[];
  scenario?: Scenario;
}

export const EMPTY_LAYER: OverrideLayer = { version: 1, ops: [] };
export const STORAGE_KEY = 'capacity.overrides.v1';

export const withOp = (layer: OverrideLayer, op: Op): OverrideLayer => ({ ...layer, ops: [...layer.ops, op] });
export const withScenario = (layer: OverrideLayer, scenario: Scenario | undefined): OverrideLayer =>
  ({ ...layer, scenario });

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const defaultStorage = (): StorageLike | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export function loadOverrides(storage: StorageLike | null = defaultStorage()): OverrideLayer {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_LAYER;
    const layer = JSON.parse(raw);
    return layer?.version === 1 && Array.isArray(layer.ops) ? layer : EMPTY_LAYER;
  } catch {
    return EMPTY_LAYER;
  }
}
export function saveOverrides(layer: OverrideLayer, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(layer));
  } catch {
    /* storage full or blocked: edits stay in memory for this session */
  }
}
export function resetOverrides(storage: StorageLike | null = defaultStorage()): OverrideLayer {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return EMPTY_LAYER;
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const issue = (severity: DataIssue['severity'], rule: string, file: string, row: DataIssue['row'], text: string,
  fixIn: string | null = null): DataIssue => ({ severity, rule, file, row, text, fixIn });

/** Last week of a project: endDate's week, or start + duration for pipeline, or the window end. */
export function projectLastWeek(p: Project, start: Week = p.startDate): Week {
  if (p.type === 'pipeline' && p.durationWeeks) return addWeeks(start, p.durationWeeks - 1);
  return p.endDate ? weekOf(p.endDate) : LAST_WEEK;
}

/** Build the model: dataset + edits, mappings resolved, indexes built. */
export function applyOverrides(ds: Dataset, layer: OverrideLayer = EMPTY_LAYER): Model {
  const seed = ds.seed;
  const projects: Project[] = clone(seed.projects);
  const allocations: Allocation[] = clone(seed.allocations);
  const enrich = new Map(seed.people.map((p) => [p.email, clone(p)]));
  const keyMap = new Map(seed.jiraProjectMap.map((m) => [m.jiraProjectKey, m.projectId]));
  const accountMap = new Map(seed.jiraAccountMap.map((m) => [m.accountId, m.email]));
  const editIssues: DataIssue[] = [];
  const projectById = () => new Map(projects.map((p) => [p.projectId, p]));
  const skip = (why: string) => editIssues.push(issue('warning', 'edit-skipped', 'edits', null, why));

  for (const op of layer.ops) {
    const byId = projectById();
    switch (op.op) {
      case 'setAllocation':
        if (!byId.has(op.projectId) || !enrich.has(op.email)) skip(`Hours edit for an unknown person or project skipped.`);
        else allocations.push({ email: op.email, projectId: op.projectId, hoursPerWeek: op.hoursPerWeek,
          fromWeek: op.fromWeek, toWeek: op.toWeek, source: 'manual' });
        break;
      case 'addProject':
        if (byId.has(op.project.projectId)) skip(`Project ${op.project.projectId} already exists.`);
        else projects.push(clone(op.project));
        break;
      case 'editProject': {
        const p = byId.get(op.projectId);
        if (!p) skip(`Edit of unknown project ${op.projectId} skipped.`);
        else Object.assign(p, clone(op.patch));
        break;
      }
      case 'addDemandLine': {
        const p = byId.get(op.projectId);
        if (!p) skip(`Demand line for unknown project ${op.projectId} skipped.`);
        else p.demand.push(clone(op.line));
        break;
      }
      case 'markSigned': {
        const p = byId.get(op.projectId);
        if (!p || p.type !== 'pipeline') {
          skip(`Mark as signed skipped: ${op.projectId} is not a pipeline project.`);
          break;
        }
        const start = op.startDate ?? p.startDate;
        const shift = daysBetween(p.startDate, start);
        const last = projectLastWeek(p, start);
        const unstaffed: DemandLine[] = [];
        for (const l of p.demand) {
          const from = l.fromWeek ? addDays(l.fromWeek, shift) : start;
          const to = minDate(l.toWeek ? addDays(l.toWeek, shift) : last, last);
          if (l.email) {
            allocations.push({ email: l.email, projectId: p.projectId, hoursPerWeek: l.fte * 40,
              fromWeek: from, toWeek: to, source: 'manual' });
          } else unstaffed.push({ ...l, fromWeek: from, toWeek: to });
        }
        Object.assign(p, { type: 'signed', winChancePct: null, startDate: start, endDate: addDays(last, 4),
          demand: unstaffed });
        break;
      }
      case 'mapJiraKey':
        if (!byId.has(op.projectId)) skip(`Jira key ${op.jiraProjectKey} mapped to an unknown project.`);
        else keyMap.set(op.jiraProjectKey, op.projectId);
        break;
      case 'editPerson': {
        const e = enrich.get(op.email);
        if (!e) skip(`Edit of unknown person ${op.email} skipped.`);
        else {
          Object.assign(e, clone(op.patch));
          if (e.mainStack && !e.stacks.includes(e.mainStack)) e.stacks = [e.mainStack, ...e.stacks];
        }
        break;
      }
    }
  }

  // People: HR record + Admin enrichment + absences.
  const people: Person[] = ds.hrPeople.map((h) => {
    const e = enrich.get(h.email);
    return {
      email: h.email, name: h.name, title: h.title, weeklyHours: h.weeklyHours, start: h.start, end: h.end,
      employmentType: h.employmentType, stacks: e?.stacks ?? [], mainStack: e?.mainStack ?? null,
      costPerHour: e?.costPerHour ?? null, absent: new Set<string>(),
    };
  });
  const personByEmail = new Map(people.map((p) => [p.email, p]));
  for (const a of ds.absences) {
    const p = personByEmail.get(a.email);
    if (!p) continue;
    for (let d = a.start; d <= a.end; d = addDays(d, 1)) p.absent.add(d);
  }
  const issues: DataIssue[] = [...ds.issues];
  for (const p of people) {
    if (!p.mainStack) issues.push(issue('warning', 'no-main-stack', 'app/seed.json', p.email,
      `${p.name} has no main stack. Not counted in skill supply.`, 'Admin > People'));
  }

  // Projects: F4.
  for (const p of projects) {
    if (p.type === 'pipeline' && p.winChancePct == null) {
      issues.push(issue('info', 'F4', p.origin === 'manual' && !seed.projects.some((s) => s.projectId === p.projectId)
        ? 'edits' : 'app/seed.json', p.projectId,
        `Pipeline project "${p.name}" has no win chance. Shown as not set; still switchable.`));
    }
  }

  // Worklogs: resolve person and project, F1 and F2, F3.
  const unmappedPerson = new Map<string, number>();
  const unmappedKey = new Map<string, number>();
  let unlabelled = 0;
  const worklogs: Worklog[] = ds.worklogs.map((l) => {
    const mapped = accountMap.get(l.accountId);
    const email = mapped && personByEmail.has(mapped) ? mapped : null;
    const projectId = keyMap.get(l.projectKey) ?? null;
    if (!l.labels.length) unlabelled++;
    if (!email) unmappedPerson.set(`${l.accountId}\u0000${l.file}`, (unmappedPerson.get(`${l.accountId}\u0000${l.file}`) ?? 0) + l.hours);
    if (!projectId) unmappedKey.set(`${l.projectKey}\u0000${l.file}`, (unmappedKey.get(`${l.projectKey}\u0000${l.file}`) ?? 0) + l.hours);
    return { id: l.id, file: l.file, week: weekOf(l.day), day: l.day, email, projectId, projectKey: l.projectKey,
      hours: l.hours, labels: l.labels };
  });
  for (const [k, h] of unmappedPerson) {
    const [acct, file] = k.split('\u0000');
    issues.push(issue('warning', 'F1', file, acct,
      `Jira author ${acct.slice(0, 12)}… is not in HR or the account map. ${+h.toFixed(2)} h kept on the project as "Unmapped person".`,
      'Admin > People > Jira accounts'));
  }
  for (const [k, h] of unmappedKey) {
    const [key, file] = k.split('\u0000');
    issues.push(issue('warning', 'F2', file, key,
      `Jira project key ${key} is not mapped. ${+h.toFixed(2)} h counted as non-billable.`,
      'Admin > Projects > Jira conversion'));
  }
  if (ds.worklogs.length) {
    issues.push(issue('info', 'F3', 'jira/worklogs_*', null,
      `${unlabelled} worklogs have no FE/BE label. No effect: actuals use the main stack.`));
  }

  // Sprint: assigned estimates become sprint allocations; unassigned become unstaffed demand.
  const byId = projectById();
  let sprint: SprintPlan | null = null;
  if (ds.sprint) {
    const s = ds.sprint;
    const weeks: Week[] = [];
    for (let w = weekOf(s.startDate); w <= s.endDate; w = addWeeks(w, 1)) if (w >= TODAY) weeks.push(w);
    sprint = { id: s.id, name: s.name, startDate: s.startDate, endDate: s.endDate, weeks, assigned: new Map(), unassigned: [] };
    for (const it of s.issues) {
      const projectId = keyMap.get(it.projectKey);
      const h = (it.estimateSeconds ?? 0) / 3600 / Math.max(1, weeks.length);
      if (!projectId) {
        issues.push(issue('warning', 'sprint-unmapped-key', s.file, it.key,
          `Sprint issue ${it.key} is on unmapped key ${it.projectKey}. Not counted.`, 'Admin > Projects > Jira conversion'));
        continue;
      }
      if (it.accountId == null) {
        const stacks = [...new Set((byId.get(projectId)?.demand ?? []).map((d) => d.stack))].sort();
        if (stacks.length !== 1) {
          issues.push(issue('warning', 'sprint-unassigned-stack', s.file, it.key,
            'Unassigned issue but the project has no single demand stack. Not counted.'));
          continue;
        }
        sprint.unassigned.push({ projectId, stack: stacks[0], hoursPerWeek: h, key: it.key });
      } else {
        const email = accountMap.get(it.accountId);
        if (!email || !personByEmail.has(email)) {
          issues.push(issue('warning', 'sprint-unmapped-person', s.file, it.key,
            `Sprint issue ${it.key} is assigned to an unknown Jira account. Not counted.`, 'Admin > People > Jira accounts'));
          continue;
        }
        const k = `${email}|${projectId}`;
        sprint.assigned.set(k, (sprint.assigned.get(k) ?? 0) + h);
      }
    }
  }

  const allocByEmail = new Map<string, Allocation[]>();
  for (const a of allocations) {
    if (!allocByEmail.has(a.email)) allocByEmail.set(a.email, []);
    allocByEmail.get(a.email)!.push(a);
  }
  const stackGroups = seed.stacks;
  return {
    dataset: ds, settings: seed.settings, stackGroups, allStacks: stackGroups.flatMap((g) => g.stacks),
    people, personByEmail, projects, projectById: byId, allocations, allocByEmail, worklogs, sprint,
    accountMap, keyMap, issues: [...issues, ...editIssues], unlabelledWorklogs: unlabelled,
  };
}

// ---- Add project form (Admin) → Project, with the canvas's validation messages
export interface ProjectForm {
  type: ProjectType;
  name: string;
  client: string;
  winChancePct?: number | string | null;
  startWeek: Week;
  durationWeeks: number | string;
  lines: { stack: string; fte: number | string; fromOffset?: number | string | null; toOffset?: number | string | null }[];
}

export function nextProjectId(m: Model, type: ProjectType): string {
  const prefix = type === 'internal' ? 'INT-' : 'P-';
  let n = 1;
  while (m.projectById.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export function projectFromForm(m: Model, f: ProjectForm): { project: Project } | { error: string } {
  const name = (f.name ?? '').trim();
  const dur = Number(f.durationWeeks);
  if (!name) return { error: 'Give the project a name.' };
  if (!(Number.isInteger(dur) && dur >= 1 && dur <= 26)) return { error: 'Duration must be 1 to 26 weeks.' };
  if (!f.startWeek || weekOf(f.startWeek) !== f.startWeek) return { error: 'Pick a start week.' };
  const start = f.startWeek;
  const last = addWeeks(start, dur - 1);
  const off = (v: unknown) => (v === '' || v == null ? null : Number(v));
  const lines: DemandLine[] = f.lines
    .map((l) => ({ ...l, fte: Number(l.fte) }))
    .filter((l) => l.fte > 0 && m.allStacks.includes(l.stack))
    .map((l) => {
      const o = off(l.fromOffset) ?? 0;
      let e = off(l.toOffset);
      if (e != null && e < o) e = o;
      return {
        stack: l.stack, fte: l.fte, email: null,
        fromWeek: o ? addWeeks(start, Math.min(o, dur - 1)) : null,
        toWeek: e != null ? addWeeks(start, Math.min(e, dur - 1)) : null,
      };
    });
  if (!lines.length) return { error: 'Add at least one stack line with FTE above 0.' };
  const win = off(f.winChancePct);
  if (win != null && !(win >= 0 && win <= 100)) return { error: 'Win chance must be 0 to 100.' };
  return {
    project: {
      projectId: nextProjectId(m, f.type), name, client: (f.client ?? '').trim(), type: f.type, origin: 'manual',
      startDate: start,
      endDate: f.type === 'pipeline' ? null : addDays(last, 4),
      durationWeeks: f.type === 'pipeline' ? dur : null,
      winChancePct: f.type === 'pipeline' ? win : null,
      hourBudget: null,
      demand: lines,
    },
  };
}
