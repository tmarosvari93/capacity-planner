// Per person and week: available, planned, load, free, actual (contract §4).
import { TODAY, fteHours, workingDates, workingDays } from './calendar';
import { pipelineLines } from './scenario';
import type { AllocationSource, ISODate, Model, Person, PlanRow, Scenario, Week } from './types';
import { sum } from './util';

function person(m: Model, email: string): Person {
  const p = m.personByEmail.get(email);
  if (!p) throw new Error(`Unknown person ${email}`);
  return p;
}

export function employedDates(p: Person, w: Week): ISODate[] {
  return workingDates(w).filter((d) => d >= p.start && (p.end == null || d <= p.end));
}
export function absenceDays(p: Person, w: Week): number {
  return employedDates(p, w).filter((d) => p.absent.has(d)).length;
}
export function availableHours(m: Model, email: string, w: Week): number {
  const p = person(m, email);
  return (p.weeklyHours / 5) * (employedDates(p, w).length - absenceDays(p, w));
}

/** Allocations after precedence manual > sprint > seed, pro-rated. Manual edits apply to future weeks only. */
export function allocationRows(m: Model, email: string, w: Week): PlanRow[] {
  const wd = workingDays(w);
  const bySrc = new Map<string, Partial<Record<AllocationSource, { hours: number; rate: number }>>>();
  const put = (pid: string, src: AllocationSource, hours: number, rate: number) => {
    if (!bySrc.has(pid)) bySrc.set(pid, {});
    bySrc.get(pid)![src] = { hours, rate };
  };
  for (const a of m.allocByEmail.get(email) ?? []) {
    if (!(a.fromWeek <= w && w <= a.toWeek)) continue;
    if (a.source === 'seed') put(a.projectId, 'seed', (a.hoursPerWeek * wd) / 5, a.hoursPerWeek);
    else if (a.source === 'manual' && w >= TODAY) put(a.projectId, 'manual', (a.hoursPerWeek * wd) / 5, a.hoursPerWeek);
  }
  if (m.sprint?.weeks.includes(w)) {
    for (const [k, h] of m.sprint.assigned) {
      const [em, pid] = k.split('|');
      if (em === email) put(pid, 'sprint', h, h);
    }
  }
  const rows: PlanRow[] = [];
  for (const [projectId, srcs] of bySrc) {
    for (const s of ['manual', 'sprint', 'seed'] as const) {
      const v = srcs[s];
      if (v) {
        rows.push({ projectId, hours: v.hours, ratePerWeek: v.rate, source: s });
        break;
      }
    }
  }
  return rows;
}

/** Allocation rows plus named lines of switched-on pipeline projects. */
export function plannedRows(m: Model, email: string, w: Week, sc?: Scenario): PlanRow[] {
  const rows = allocationRows(m, email, w);
  for (const { projectId, line } of pipelineLines(m, sc, w)) {
    if (line.email === email) {
      rows.push({ projectId, hours: line.fte * fteHours(w), ratePerWeek: line.fte * 40, source: 'pipeline' });
    }
  }
  return rows;
}

export function plannedHours(m: Model, email: string, w: Week, sc?: Scenario): number {
  return sum(plannedRows(m, email, w, sc).map((r) => r.hours));
}

/** Load in %; 'away' = planned while 0 h available; null = nothing available and nothing planned. */
export function loadPct(m: Model, email: string, w: Week, sc?: Scenario): number | 'away' | null {
  const a = availableHours(m, email, w);
  const pl = plannedHours(m, email, w, sc);
  if (a === 0) return pl === 0 ? null : 'away';
  return (pl / a) * 100;
}

export function freeHours(m: Model, email: string, w: Week, sc?: Scenario): number {
  return Math.max(0, availableHours(m, email, w) - plannedHours(m, email, w, sc));
}

/** Logged hours by a mapped person in week w, whatever the project key (C15). */
export function actualHours(m: Model, email: string, w: Week): number {
  return sum(m.worklogs.filter((l) => l.email === email && l.week === w).map((l) => l.hours));
}

/** Logged hours by project for the person panel; unmapped keys as "UNMAPPED:<key>". */
export function actualRows(m: Model, email: string, w: Week): { projectId: string; hours: number }[] {
  const out = new Map<string, number>();
  for (const l of m.worklogs) {
    if (l.email !== email || l.week !== w) continue;
    const k = l.projectId ?? `UNMAPPED:${l.projectKey}`;
    out.set(k, (out.get(k) ?? 0) + l.hours);
  }
  return [...out].map(([projectId, hours]) => ({ projectId, hours }));
}

/** actual − plan of record, past weeks only (baseline). */
export function driftHours(m: Model, email: string, w: Week): number | null {
  if (w >= TODAY) return null;
  return actualHours(m, email, w) - plannedHours(m, email, w);
}

/** The formula line for the person panel. */
export function availabilityFormula(m: Model, email: string, w: Week): string {
  const p = person(m, email);
  const days = employedDates(p, w).length;
  const off = absenceDays(p, w);
  return `available = ${p.weeklyHours} h ÷ 5 × (${days} working days − ${off} off) = ${+availableHours(m, email, w).toFixed(2)} h`;
}
