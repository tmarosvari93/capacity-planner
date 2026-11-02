// Ask page: Claude chooses a function, code runs it, Claude phrases the result, code checks every number.
// The browser calls the edge function `ask` through callEdge (supabase.functions.invoke in the app).
import { FUNCTION_CATALOGUE } from './askCatalogue';
import { FUTURE, PAST, WEEKS, isoWeek, shortDate, weekOf } from './calendar';
import { describeScenario } from './scenario';
import {
  DEFAULT_RANGES, billableSplit, freeCapacity, loadByPerson, planVsActual, projectBurn, scenarioImpact, skillGap,
} from './questions';
import { stackLabel } from './stacks';
import type { Model, Scenario, Week } from './types';

export { CANNOT_ANSWER_TOOL, FUNCTION_CATALOGUE } from './askCatalogue';
export type FunctionName = (typeof FUNCTION_CATALOGUE)[number]['name'];
export const FUNCTION_NAMES = FUNCTION_CATALOGUE.map((f) => f.name) as FunctionName[];
export const OUT_OF_SCOPE = "I can't answer that from this data";
const USES_SCENARIO: FunctionName[] = ['freeCapacity', 'skillGap', 'loadByPerson'];

// ---- Validate and normalise the arguments Claude returned
export function validateArgs(m: Model, name: string, raw: unknown):
  { ok: true; args: Record<string, any> } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!FUNCTION_NAMES.includes(name as FunctionName)) return { ok: false, errors: [`Unknown function ${name}`] };
  const a: Record<string, any> = { ...((raw && typeof raw === 'object' ? raw : {}) as object) };
  const spec = FUNCTION_CATALOGUE.find((f) => f.name === name)!.input_schema;
  const props = Object.keys(spec.properties);
  for (const k of Object.keys(a)) if (!props.includes(k)) errors.push(`Unexpected argument ${k}`);
  for (const k of spec.required as readonly string[]) if (a[k] == null) errors.push(`Missing ${k}`);
  const week = (k: string, allowed: Week[]) => {
    if (a[k] == null) return;
    if (typeof a[k] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a[k])) return void errors.push(`${k} must be YYYY-MM-DD`);
    a[k] = weekOf(a[k]);
    if (!allowed.includes(a[k])) errors.push(`${k} ${a[k]} is outside the data (${allowed[0]} to ${allowed[allowed.length - 1]})`);
  };
  const past = ['billableSplit', 'planVsActual'].includes(name);
  week('week', FUTURE);
  week('fromWeek', past ? PAST : FUTURE);
  week('toWeek', past ? PAST : FUTURE);
  if (a.fromWeek && a.toWeek && a.fromWeek > a.toWeek) errors.push('fromWeek is after toWeek');
  if (a.stack != null && !m.allStacks.includes(a.stack)) errors.push(`Unknown stack ${a.stack}`);
  if (a.projectId != null && !m.projectById.has(a.projectId)) errors.push(`Unknown project ${a.projectId}`);
  if (a.groupBy != null) {
    const ok = name === 'planVsActual' ? ['person', 'project'] : ['company', 'person', 'project'];
    if (!ok.includes(a.groupBy)) errors.push(`groupBy must be one of ${ok.join(', ')}`);
  }
  if (a.scenario != null) {
    const ps = a.scenario?.projects;
    if (!ps || typeof ps !== 'object') errors.push('scenario.projects is missing');
    else {
      for (const [pid, cfg] of Object.entries<any>(ps)) {
        if (m.projectById.get(pid)?.type !== 'pipeline') errors.push(`${pid} is not a pipeline project`);
        if (typeof cfg?.on !== 'boolean') errors.push(`${pid}.on must be true or false`);
        if (cfg?.startShiftWeeks != null && !Number.isInteger(cfg.startShiftWeeks)) errors.push(`${pid}.startShiftWeeks must be whole weeks`);
      }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, args: a };
}

/** Run a catalogue function. Functions that take a scenario use the open one when none is given. */
export function runFunction(m: Model, name: FunctionName, args: Record<string, any>, current?: Scenario) {
  const sc: Scenario | undefined = args.scenario ?? current;
  switch (name) {
    case 'freeCapacity': return freeCapacity(m, args.week, args.stack ?? null, sc);
    case 'scenarioImpact': return scenarioImpact(m, args.scenario);
    case 'skillGap': return skillGap(m, args.fromWeek, args.toWeek, sc, args.stack ?? null);
    case 'loadByPerson': return loadByPerson(m, args.fromWeek, args.toWeek, sc);
    case 'billableSplit': return billableSplit(m, args.fromWeek, args.toWeek, args.groupBy ?? 'company');
    case 'planVsActual': return planVsActual(m, args.fromWeek, args.toWeek, args.groupBy ?? 'person');
    case 'projectBurn': return projectBurn(m, args.projectId);
  }
}

/** The scenario a function actually ran under, for the answer card. */
export function scenarioUsed(name: FunctionName, args: Record<string, any>, current?: Scenario): Scenario | undefined {
  if (name === 'scenarioImpact') return args.scenario;
  return USES_SCENARIO.includes(name) ? args.scenario ?? current : undefined;
}

// ---- Data read: which files and how many rows fed the answer
export function dataRead(m: Model, name: FunctionName, args: Record<string, any>) {
  const rows = m.dataset.rows;
  const files: { path: string; label: string; rows: number }[] = [];
  const add = (path: string, label: string) => {
    if (rows[path] != null) files.push({ path, label, rows: rows[path] });
  };
  add('hr/people.csv', 'HR people');
  add('hr/absences.csv', 'HR absences');
  const actuals = ['billableSplit', 'planVsActual', 'projectBurn'].includes(name);
  const planning = !['billableSplit'].includes(name);
  const sprintFile = m.sprint ? m.dataset.sprint!.file : null;
  if (planning && sprintFile && name !== 'planVsActual') add(sprintFile, `Jira sprint ${m.sprint!.id}`);
  let worklogRange = '';
  if (actuals) {
    const wf = m.dataset.worklogFiles.filter((f) =>
      name === 'projectBurn' || (f.weekStart >= args.fromWeek && f.weekStart <= args.toWeek));
    wf.forEach((f) => add(f.path, `Jira worklogs ${isoWeek(f.weekStart).slice(5)}`));
    if (wf.length) {
      const n = wf.reduce((t, f) => t + f.rows, 0);
      worklogRange = `Jira worklogs ${isoWeek(wf[0].weekStart).slice(5)}–${isoWeek(wf[wf.length - 1].weekStart).slice(5)}, ${n} rows`;
    }
  }
  const seed = m.dataset.manifest.find((f) => f.kind === 'seed');
  if (seed) add(seed.path, 'App plan (projects, allocations, mappings)');
  const summary = [
    `HR people, ${rows['hr/people.csv'] ?? 0} rows`,
    `HR absences, ${rows['hr/absences.csv'] ?? 0} rows`,
    ...(planning && sprintFile && name !== 'planVsActual' ? [`Jira sprint ${m.sprint!.id}, ${rows[sprintFile]} issues`] : []),
    ...(worklogRange ? [worklogRange] : []),
    'app plan and edits',
  ].join('; ');
  return { files, summary };
}

// ---- Numbers guard: every number in the conclusion must come from the payload or the question
function numbersIn(text: string): number[] {
  return (text.match(/-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g) ?? []).map((s) => Number(s.replace(/,/g, '')));
}
function allowedNumbers(payload: unknown, question: string): number[] {
  const out: number[] = numbersIn(question);
  const walk = (v: unknown, key = '') => {
    if (typeof v === 'number') out.push(v);
    else if (typeof v === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [y, mo, d] = v.split('-').map(Number);
        out.push(y, mo, d, Number(isoWeek(weekOf(v)).slice(6)));
      } else if (!/^[\w.+-]+@/.test(v)) out.push(...numbersIn(v));
    } else if (Array.isArray(v)) {
      out.push(v.length);
      v.forEach((x) => walk(x));
    } else if (v && typeof v === 'object') {
      const entries = Object.entries(v);
      if (key) out.push(entries.length);
      entries.forEach(([k, x]) => {
        walk(k);
        walk(x, k);
      });
    }
  };
  walk(payload);
  return out;
}
/** ok = every number in the text matches a number in the payload or question (rounding allowed). */
export function checkNumbers(text: string, payload: unknown, question = ''): { ok: boolean; unknown: number[] } {
  const allowed = allowedNumbers(payload, question);
  const okNum = (t: number) => allowed.some((a) =>
    Math.abs(t - a) <= 0.051 || (Number.isInteger(t) && Math.abs(t - a) <= 0.5) || Math.abs(t + a) <= 0.051);
  const unknown = numbersIn(text).filter((t) => !okNum(t));
  return { ok: unknown.length === 0, unknown };
}

/** What the conclude call receives, and what the numbers guard checks against. */
export function concludePayload(m: Model, name: FunctionName, args: Record<string, any>, result: unknown, sc?: Scenario) {
  return {
    function: name, args, scenario: describeScenario(m, sc), result,
    settings: { overloadPct: m.settings.overloadPct, idlePct: m.settings.idlePct, billableTargetPct: m.settings.billableTargetPct },
  };
}

// ---- Fixed sentences: used when the conclusion fails the guard or the edge function is down
const wk = (w: string) => shortDate(w);
const names = (xs: { name: string }[], n = 3) => xs.slice(0, n).map((x) => x.name).join(', ');
export function templateConclusion(m: Model, name: FunctionName, r: any): string {
  switch (name) {
    case 'freeCapacity':
      return r.people.length
        ? `${r.people.length} people have at least a day free in the week of ${wk(r.week)}. Most free: ${r.people.slice(0, 3)
          .map((p: any) => `${p.name} (${p.freeHours} h)`).join(', ')}.`
        : `Nobody has a full day free in the week of ${wk(r.week)}.`;
    case 'scenarioImpact': {
      const ids = Object.keys(r.resolvedStarts).join(' and ') || 'no pipeline projects';
      const first = r.newlyOver[0];
      return `With ${ids} on, ${r.newlyOver.length} people go newly over 100% and ${r.stackChanges.length} stacks get a new or larger gap.` +
        (first ? ` First: ${first.name} from ${wk(first.firstWeek)}, peak ${first.peakPct}%.` : '');
    }
    case 'skillGap': {
      const s = r.shortages;
      return s.length
        ? `${stackLabel(m, s[0].stack)} is the first to run short, from the week of ${wk(s[0].firstWeek)}, up to ${s[0].peakFte} FTE.` +
          (s.length > 1 ? ` Also short: ${s.slice(1).map((x: any) => x.stack).join(', ')}.` : '')
        : `No stack runs short between ${wk(r.fromWeek)} and ${wk(r.toWeek)}.`;
    }
    case 'loadByPerson':
      return `Between ${wk(r.fromWeek)} and ${wk(r.toWeek)}, ${r.over.length} people go over 100% (${names(r.over) || 'none'}) and ` +
        `${r.idle.length} are idle at 50% or less (${names(r.idle) || 'none'}).` +
        (r.plannedWhileAway.length ? ` Planned while away: ${names(r.plannedWhileAway)}.` : '');
    case 'billableSplit': {
      const c = r.company;
      return `Billable work was ${c.shareOfLoggedPct}% of logged time (${c.billableHours} of ${c.loggedHours} h) against a ${r.targetPct}% target; ` +
        `utilisation was ${c.utilisationPct}% of available hours.`;
    }
    case 'planVsActual': {
      const rows = [...r.rows].filter((x: any) => x.plannedHours || x.actualHours)
        .sort((a: any, b: any) => Math.abs(b.driftHours) - Math.abs(a.driftHours));
      const top = rows[0];
      return top ? `The largest drift from plan is ${top.name}: ${top.actualHours} h logged against ${top.plannedHours} h planned (${top.driftHours > 0 ? '+' : ''}${top.driftHours} h).`
        : 'Nothing was planned or logged in these weeks.';
    }
    case 'projectBurn':
      return `${r.name}: ${r.actualHoursToDate} h logged to date (€${r.actualCostEur}).` +
        (r.hourBudget ? ` That is ${r.budgetUsedPct}% of the ${r.hourBudget} h budget; forecast ${r.forecastVsBudgetPct}% of budget.` : ' No hour budget is set.');
  }
}

// ---- Numbers table for the answer card
export function toTable(m: Model, name: FunctionName, r: any): { columns: string[]; rows: (string | number)[][] } {
  const pct = (x: number | null) => (x == null ? '—' : `${x}%`);
  switch (name) {
    case 'freeCapacity':
      return { columns: ['Person', 'Main stack', 'Free h', 'Free FTE'], rows: r.people.map((p: any) => [p.name, p.mainStack, p.freeHours, p.freeFte]) };
    case 'scenarioImpact':
      return {
        columns: ['Item', 'Change', 'From week', 'Peak'],
        rows: [
          ...r.newlyOver.map((p: any) => [p.name, 'newly over 100%', wk(p.firstWeek), `${p.peakPct}%`]),
          ...r.stackChanges.map((s: any) => [stackLabel(m, s.stack), s.change === 'new' ? 'new gap' : `gap grows from ${s.baselinePeakFte} FTE`,
            wk(s.firstWeek), `${s.peakFte} FTE short`]),
        ],
      };
    case 'skillGap':
      return { columns: ['Stack', 'First short', 'Weeks short', 'Peak FTE'], rows: r.shortages.map((s: any) => [stackLabel(m, s.stack), wk(s.firstWeek), s.weeks, s.peakFte]) };
    case 'loadByPerson':
      return {
        columns: ['Person', 'Status', 'Weeks', 'Peak or low'],
        rows: [
          ...r.over.map((p: any) => [p.name, 'Over 100%', p.weeks.map(wk).join(', '), `${p.peakPct}%`]),
          ...r.idle.map((p: any) => [p.name, 'Idle', p.weeks.map(wk).join(', '), `${p.lowestPct}%`]),
          ...r.plannedWhileAway.map((p: any) => [p.name, 'Planned while away', p.weeks.map(wk).join(', '), '—']),
        ],
      };
    case 'billableSplit':
      if (r.rows && r.groupBy === 'person') {
        return { columns: ['Person', 'Logged h', 'Billable h', 'Share of logged', 'Utilisation'],
          rows: r.rows.map((x: any) => [x.name, x.loggedHours, x.billableHours, pct(x.shareOfLoggedPct), pct(x.utilisationPct)]) };
      }
      if (r.rows) return { columns: ['Project', 'Billable', 'Logged h'], rows: r.rows.map((x: any) => [x.name, x.billable ? 'yes' : 'no', x.loggedHours]) };
      return { columns: ['Measure', 'Value'], rows: [
        ['Logged hours', r.company.loggedHours], ['Billable hours', r.company.billableHours],
        ['Share of logged time', pct(r.company.shareOfLoggedPct)], ['Target', `${r.targetPct}%`],
        ['Available hours', r.company.availableHours], ['Utilisation', pct(r.company.utilisationPct)],
        ['Unmapped key hours (non-billable)', r.company.unmappedKeyHours]] };
    case 'planVsActual':
      return { columns: [r.groupBy === 'person' ? 'Person' : 'Project', 'Plan h', 'Actual h', 'Drift h'],
        rows: r.rows.map((x: any) => [x.name, x.plannedHours, x.actualHours, x.driftHours]) };
    case 'projectBurn':
      return { columns: ['Measure', 'Value'], rows: [
        ['Logged to date (h)', r.actualHoursToDate], ['Cost to date (EUR)', r.actualCostEur],
        ['Hour budget', r.hourBudget ?? 'not set'], ['Budget used', pct(r.budgetUsedPct)],
        ['Remaining planned (h)', r.remainingPlannedHours], ['Remaining unstaffed (h)', r.remainingUnstaffedHours],
        ['Forecast (h)', r.forecastHours], ['Forecast vs budget', pct(r.forecastVsBudgetPct)]] };
  }
}

// ---- Context sent with the choose call, so Claude can map names to ids and dates to weeks
export function askContext(m: Model, current?: Scenario) {
  return {
    today: '2026-11-02 (Monday)',
    pastWeeks: `${PAST[0]} to ${PAST[PAST.length - 1]} (actuals)`,
    futureWeeks: `${FUTURE[0]} to ${FUTURE[FUTURE.length - 1]} (plan)`,
    in4Weeks: '2026-11-30',
    defaults: DEFAULT_RANGES,
    projects: m.projects.map((p) => ({ projectId: p.projectId, name: p.name, client: p.client, type: p.type })),
    stacks: m.allStacks,
    people: m.people.map((p) => ({ name: p.name, mainStack: p.mainStack })),
    openScenario: describeScenario(m, current),
    weeks: WEEKS,
  };
}

// ---- The whole flow, called by the Ask page
export interface AskAnswer {
  question: string;
  askedAt: string;
  status: 'answer' | 'cannot' | 'error';
  conclusion: string;
  usedTemplate: boolean;
  function?: FunctionName;
  args?: Record<string, any>;
  scenario?: string;
  table?: { columns: string[]; rows: (string | number)[][] };
  dataRead?: ReturnType<typeof dataRead>;
  result?: unknown;
  error?: string;
}

export type CallEdge = (body: Record<string, unknown>) => Promise<any>;

export async function runAsk(m: Model, question: string, current: Scenario | undefined, callEdge: CallEdge,
  now: () => string = () => new Date().toISOString()): Promise<AskAnswer> {
  const askedAt = now();
  const q = question.trim().slice(0, 500);
  const fail = (error: string): AskAnswer =>
    ({ question: q, askedAt, status: 'error', conclusion: 'Something went wrong. Try again.', usedTemplate: false, error });
  if (!q) return fail('Empty question');
  let chosen: any;
  try {
    chosen = await callEdge({ mode: 'choose', question: q, context: askContext(m, current) });
  } catch (e) {
    return fail(String(e));
  }
  if (chosen?.error) return fail(String(chosen.error));
  if (chosen?.outOfScope || !chosen?.function) {
    return { question: q, askedAt, status: 'cannot', conclusion: OUT_OF_SCOPE, usedTemplate: false };
  }
  const v = validateArgs(m, chosen.function, chosen.args);
  if (!v.ok) {
    return { ...fail(v.errors.join('; ')), status: 'cannot', conclusion: `${OUT_OF_SCOPE} (${v.errors[0]})` };
  }
  const name = chosen.function as FunctionName;
  const sc = scenarioUsed(name, v.args, current);
  const result = runFunction(m, name, v.args, current);
  const payload = concludePayload(m, name, v.args, result, sc);
  let conclusion = '';
  let usedTemplate = false;
  try {
    const c = await callEdge({ mode: 'conclude', question: q, payload });
    conclusion = typeof c?.text === 'string' ? c.text.trim() : '';
  } catch {
    conclusion = '';
  }
  if (!conclusion || !checkNumbers(conclusion, payload, q).ok) {
    conclusion = templateConclusion(m, name, result);
    usedTemplate = true;
  }
  return {
    question: q, askedAt, status: 'answer', conclusion, usedTemplate, function: name, args: v.args,
    scenario: describeScenario(m, sc), table: toTable(m, name, result), dataRead: dataRead(m, name, v.args), result,
  };
}
