// The brief's five questions and the two further functions (contract §7).
// Result shapes match fixtures/answer_key.json exactly.
import { FUTURE, TODAY, WEEKS, fteHours, weekOf, weeksBetween, workingDays } from './calendar';
import { actualHours, allocationRows, availableHours, freeHours, loadPct, plannedHours, plannedRows } from './capacity';
import { resolveScenario } from './scenario';
import { balanceFte, demandFte, demandParts, supplyFte } from './stacks';
import type { Model, Scenario, Week, Worklog } from './types';
import { EPS, byText, r1, r2, sum } from './util';

export const DEFAULT_RANGES = {
  future: { fromWeek: '2026-11-02', toWeek: '2027-01-18' },
  next5: { fromWeek: '2026-11-02', toWeek: '2026-11-30' },
  past: { fromWeek: '2026-09-28', toWeek: '2026-10-26' },
} as const;

// ---- Q1 Who will be available in 4 weeks?
export function freeCapacity(m: Model, week: Week, stack?: string | null, sc?: Scenario) {
  const w = weekOf(week);
  const people = m.people
    .filter((p) => !stack || p.mainStack === stack)
    .map((p) => ({ p, fh: freeHours(m, p.email, w, sc) }))
    .filter(({ fh }) => fh >= m.settings.availableMinHours)
    .map(({ p, fh }) => ({
      email: p.email, name: p.name, mainStack: p.mainStack, freeHours: r2(fh), freeFte: r2(fh / fteHours(w)),
      availableHours: r2(availableHours(m, p.email, w)), plannedHours: r2(plannedHours(m, p.email, w, sc)),
    }))
    .sort((a, b) => b.freeHours - a.freeHours || byText(a.name, b.name));
  return { week: w, workingDays: workingDays(w), people, totalFreeHours: r2(sum(people.map((r) => r.freeHours))) };
}

// ---- Q4 Who is over 100%, and who is idle?
export function loadByPerson(m: Model, fromWeek: Week, toWeek: Week, sc?: Scenario) {
  const { overloadPct, idlePct } = m.settings;
  const over: { email: string; name: string; weeks: Week[]; peakPct: number }[] = [];
  const idle: { email: string; name: string; weeks: Week[]; lowestPct: number }[] = [];
  const plannedWhileAway: { email: string; name: string; weeks: Week[] }[] = [];
  const grid: Record<string, Record<Week, number | 'away' | null>> = {};
  for (const p of m.people) {
    const cells: Record<Week, number | 'away' | null> = {};
    const ow: [Week, number][] = [];
    const iw: [Week, number][] = [];
    const aw: Week[] = [];
    for (const w of weeksBetween(fromWeek, toWeek)) {
      const ld = loadPct(m, p.email, w, sc);
      cells[w] = typeof ld === 'number' ? r1(ld) : ld;
      if (ld === 'away') aw.push(w);
      else if (ld == null) continue;
      else if (ld > overloadPct + EPS) ow.push([w, ld]);
      else if (ld <= idlePct + EPS) iw.push([w, ld]);
    }
    grid[p.email] = cells;
    if (ow.length) over.push({ email: p.email, name: p.name, weeks: ow.map((x) => x[0]), peakPct: r1(Math.max(...ow.map((x) => x[1]))) });
    if (iw.length) idle.push({ email: p.email, name: p.name, weeks: iw.map((x) => x[0]), lowestPct: r1(Math.min(...iw.map((x) => x[1]))) });
    if (aw.length) plannedWhileAway.push({ email: p.email, name: p.name, weeks: aw });
  }
  return { fromWeek, toWeek, over, idle, plannedWhileAway, loadPct: grid };
}

// ---- Q3 Which skill will we run short of?
export function skillGap(m: Model, fromWeek: Week, toWeek: Week, sc?: Scenario, stack?: string | null) {
  const shortages: { stack: string; firstWeek: Week; weeks: number; peakFte: number; shortWeeks: Week[] }[] = [];
  const spare: { stack: string; weeks: number; maxSpareFte: number }[] = [];
  const matrix: Record<string, Record<Week, { supplyFte: number; demandFte: number; balanceFte: number }>> = {};
  for (const s of m.allStacks) {
    if (stack && s !== stack) continue;
    const cells: Record<Week, { supplyFte: number; demandFte: number; balanceFte: number }> = {};
    const sw: [Week, number][] = [];
    const pw: [Week, number][] = [];
    for (const w of weeksBetween(fromWeek, toWeek)) {
      const b = balanceFte(m, s, w, sc);
      cells[w] = { supplyFte: r2(supplyFte(m, s, w, sc)), demandFte: r2(demandFte(m, s, w, sc)), balanceFte: r2(b) };
      if (b < -EPS) sw.push([w, -b]);
      else if (b >= m.settings.spareMinFte - EPS) pw.push([w, b]);
    }
    matrix[s] = cells;
    if (sw.length) {
      shortages.push({ stack: s, firstWeek: sw[0][0], weeks: sw.length, peakFte: r2(Math.max(...sw.map((x) => x[1]))),
        shortWeeks: sw.map((x) => x[0]) });
    }
    if (pw.length) spare.push({ stack: s, weeks: pw.length, maxSpareFte: r2(Math.max(...pw.map((x) => x[1]))) });
  }
  shortages.sort((a, b) => byText(a.firstWeek, b.firstWeek) || b.peakFte - a.peakFte);
  return { fromWeek, toWeek, shortages, spare, matrix };
}

// ---- Q2 What happens if two pipeline projects start at the same time?
export function scenarioImpact(m: Model, sc: Scenario, fromWeek: Week = DEFAULT_RANGES.future.fromWeek,
  toWeek: Week = DEFAULT_RANGES.future.toWeek) {
  const over = m.settings.overloadPct + EPS;
  const isOver = (x: number | 'away' | null) => typeof x === 'number' && x > over;
  const newlyOver: { email: string; name: string; firstWeek: Week; weeks: number; peakPct: number }[] = [];
  for (const p of m.people) {
    const hits: [Week, number][] = [];
    for (const w of weeksBetween(fromWeek, toWeek)) {
      const ls = loadPct(m, p.email, w, sc);
      if (isOver(ls) && !isOver(loadPct(m, p.email, w))) hits.push([w, ls as number]);
    }
    if (hits.length) {
      newlyOver.push({ email: p.email, name: p.name, firstWeek: hits[0][0], weeks: hits.length,
        peakPct: r1(Math.max(...hits.map((x) => x[1]))) });
    }
  }
  const baseShort = new Map(skillGap(m, fromWeek, toWeek).shortages.map((s) => [s.stack, s]));
  const stackChanges: { stack: string; change: 'new' | 'larger'; firstWeek: Week; weeks: number; peakFte: number;
    baselinePeakFte: number }[] = [];
  for (const s of m.allStacks) {
    const hits: [Week, number][] = [];
    for (const w of weeksBetween(fromWeek, toWeek)) {
      const bs = balanceFte(m, s, w, sc);
      const bb = balanceFte(m, s, w);
      if (bs < -EPS && bs < bb - EPS) hits.push([w, -bs]);
    }
    if (hits.length) {
      const b = baseShort.get(s);
      stackChanges.push({ stack: s, change: b ? 'larger' : 'new', firstWeek: hits[0][0], weeks: hits.length,
        peakFte: r2(Math.max(...hits.map((x) => x[1]))), baselinePeakFte: b ? b.peakFte : 0 });
    }
  }
  return { scenario: sc ?? null, resolvedStarts: resolveScenario(m, sc), newlyOver, stackChanges };
}

// ---- Q5 How much of our time went to billable work?
export type BillableGroup = 'company' | 'person' | 'project';

function logsIn(m: Model, weeks: Week[]): Worklog[] {
  const set = new Set(weeks);
  return m.worklogs.filter((l) => set.has(l.week));
}
const projectKeyOf = (l: Worklog) => l.projectId ?? `UNMAPPED:${l.projectKey}`;

export function billableSplit(m: Model, fromWeek: Week, toWeek: Week, groupBy: BillableGroup = 'company') {
  const weeks = weeksBetween(fromWeek, toWeek);
  const logs = logsIn(m, weeks);
  const isBill = (l: Worklog) => l.projectId != null && m.projectById.get(l.projectId)?.type === 'signed';
  const summary = (ls: Worklog[], avail: number) => {
    const logged = sum(ls.map((l) => l.hours));
    const bill = sum(ls.filter(isBill).map((l) => l.hours));
    return {
      loggedHours: r2(logged), billableHours: r2(bill),
      shareOfLoggedPct: logged ? r1((bill / logged) * 100) : null,
      availableHours: r2(avail),
      utilisationPct: avail ? r1((bill / avail) * 100) : null,
    };
  };
  const availOf = (email: string) => sum(weeks.map((w) => availableHours(m, email, w)));
  const company = {
    ...summary(logs, sum(m.people.map((p) => availOf(p.email)))),
    unmappedPersonHours: r2(sum(logs.filter((l) => l.email == null).map((l) => l.hours))),
    unmappedKeyHours: r2(sum(logs.filter((l) => l.projectId == null).map((l) => l.hours))),
  };
  const out: Record<string, unknown> = { fromWeek, toWeek, groupBy, targetPct: m.settings.billableTargetPct, company };
  if (groupBy === 'person') {
    out.rows = m.people.map((p) => ({ email: p.email, name: p.name,
      ...summary(logs.filter((l) => l.email === p.email), availOf(p.email)) }));
  }
  if (groupBy === 'project') {
    const keys = [...new Set(logs.map(projectKeyOf))].sort(byText);
    out.rows = keys.map((k) => ({
      projectId: k,
      name: m.projectById.get(k)?.name ?? `Unmapped key ${k.replace('UNMAPPED:', '')}`,
      type: m.projectById.get(k)?.type ?? 'unmapped',
      billable: !k.startsWith('UNMAPPED') && m.projectById.get(k)?.type === 'signed',
      loggedHours: r2(sum(logs.filter((l) => projectKeyOf(l) === k).map((l) => l.hours))),
    }));
  }
  return out as {
    fromWeek: Week; toWeek: Week; groupBy: BillableGroup; targetPct: number; company: typeof company;
    rows?: Record<string, any>[];
  };
}

// ---- Plan vs actual (Reports tables, Plan past cells)
export function planVsActual(m: Model, fromWeek: Week, toWeek: Week, groupBy: 'person' | 'project' = 'person') {
  const weeks = weeksBetween(fromWeek, toWeek).filter((w) => w < TODAY);
  const rows: Record<string, any>[] = [];
  if (groupBy === 'person') {
    for (const p of m.people) {
      const pl = sum(weeks.map((w) => plannedHours(m, p.email, w)));
      const ac = sum(weeks.map((w) => actualHours(m, p.email, w)));
      const av = sum(weeks.map((w) => availableHours(m, p.email, w)));
      rows.push({
        email: p.email, name: p.name, availableHours: r2(av), plannedHours: r2(pl), actualHours: r2(ac),
        driftHours: r2(ac - pl), unloggedHours: r2(av - ac),
        byWeek: Object.fromEntries(weeks.map((w) => [w, { plan: r2(plannedHours(m, p.email, w)), actual: r2(actualHours(m, p.email, w)) }])),
      });
    }
  } else {
    const plan = new Map<string, number>();
    for (const p of m.people) {
      for (const w of weeks) {
        for (const r of plannedRows(m, p.email, w)) plan.set(r.projectId, (plan.get(r.projectId) ?? 0) + r.hours);
      }
    }
    const act = new Map<string, number>();
    for (const l of logsIn(m, weeks)) act.set(projectKeyOf(l), (act.get(projectKeyOf(l)) ?? 0) + l.hours);
    for (const k of [...new Set([...plan.keys(), ...act.keys()])].sort(byText)) {
      const pl = plan.get(k) ?? 0;
      const ac = act.get(k) ?? 0;
      rows.push({
        projectId: k, name: m.projectById.get(k)?.name ?? `Unmapped key ${k.replace('UNMAPPED:', '')}`,
        type: m.projectById.get(k)?.type ?? 'unmapped',
        plannedHours: r2(pl), actualHours: r2(ac), driftHours: r2(ac - pl), driftPct: pl ? r1(((ac - pl) / pl) * 100) : null,
      });
    }
  }
  return { fromWeek, toWeek, groupBy, rows };
}

// ---- Project burn (Reports, project panel)
export function projectBurn(m: Model, projectId: string) {
  const p = m.projectById.get(projectId);
  if (!p) throw new Error(`Unknown project ${projectId}`);
  const logs = m.worklogs.filter((l) => l.projectId === projectId);
  const hours = sum(logs.map((l) => l.hours));
  const cost = sum(logs.map((l) => l.hours * (l.email ? m.personByEmail.get(l.email)?.costPerHour ?? 0 : 0)));
  const noCost = sum(logs.filter((l) => !l.email || m.personByEmail.get(l.email)?.costPerHour == null).map((l) => l.hours));
  const end = p.endDate ?? WEEKS[WEEKS.length - 1];
  const future = FUTURE.filter((w) => w <= end);
  const remaining = sum(m.people.flatMap((pe) => future.map((w) =>
    sum(allocationRows(m, pe.email, w).filter((r) => r.projectId === projectId).map((r) => r.hours)))));
  const unstaffed = sum(m.allStacks.flatMap((s) => future.map((w) =>
    sum(demandParts(m, s, w).filter((d) => d.projectId === projectId).map((d) => d.hours)))));
  const budget = p.hourBudget;
  const forecast = hours + remaining + unstaffed;
  return {
    projectId, name: p.name, actualHoursToDate: r2(hours), actualCostEur: Math.round(cost), hoursWithoutCost: r2(noCost),
    hourBudget: budget, budgetUsedPct: budget ? r1((hours / budget) * 100) : null,
    remainingPlannedHours: r2(remaining), remainingUnstaffedHours: r2(unstaffed), forecastHours: r2(forecast),
    forecastVsBudgetPct: budget ? r1((forecast / budget) * 100) : null, endDate: p.endDate,
  };
}
