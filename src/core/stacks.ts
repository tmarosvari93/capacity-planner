// Skill (stack) demand, supply and balance in FTE (contract §4). Supply counts main stack only.
import { LAST_WEEK, TODAY, fteHours, weekOf } from './calendar';
import { freeHours } from './capacity';
import { pipelineLines } from './scenario';
import type { Model, Scenario, Week } from './types';
import { sum } from './util';

export interface DemandPart {
  projectId: string;
  kind: 'demand line' | 'sprint' | 'pipeline line';
  label: string;
  hours: number;
}

/** Unstaffed demand in a stack and week. Future weeks only. */
export function demandParts(m: Model, stack: string, w: Week, sc?: Scenario): DemandPart[] {
  if (w < TODAY) return [];
  const parts: DemandPart[] = [];
  for (const p of m.projects) {
    if (p.type === 'pipeline') continue;
    for (const l of p.demand) {
      if (l.stack !== stack || l.email) continue;
      const from = l.fromWeek ?? weekOf(p.startDate);
      const to = l.toWeek ?? (p.endDate ? weekOf(p.endDate) : LAST_WEEK);
      if (from <= w && w <= to) {
        parts.push({ projectId: p.projectId, kind: 'demand line', label: `${p.name} · ${stack} ${l.fte} FTE, no person yet`,
          hours: l.fte * fteHours(w) });
      }
    }
  }
  if (m.sprint?.weeks.includes(w)) {
    for (const u of m.sprint.unassigned) {
      if (u.stack === stack) {
        parts.push({ projectId: u.projectId, kind: 'sprint', label: `Sprint ${m.sprint.id} · ${u.key} unassigned`,
          hours: u.hoursPerWeek });
      }
    }
  }
  for (const { projectId, line } of pipelineLines(m, sc, w)) {
    if (line.stack === stack && !line.email) {
      const p = m.projectById.get(projectId)!;
      parts.push({ projectId, kind: 'pipeline line', label: `${projectId} ${p.name} · ${line.fte} FTE unstaffed (what-if)`,
        hours: line.fte * fteHours(w) });
    }
  }
  return parts;
}

export function demandFte(m: Model, stack: string, w: Week, sc?: Scenario): number {
  return sum(demandParts(m, stack, w, sc).map((d) => d.hours)) / fteHours(w);
}

/** Free hours of people whose main stack is this stack, as FTE. */
export function supplyFte(m: Model, stack: string, w: Week, sc?: Scenario): number {
  return sum(m.people.filter((p) => p.mainStack === stack).map((p) => freeHours(m, p.email, w, sc))) / fteHours(w);
}

/** supply − demand. Negative = shortage. */
export function balanceFte(m: Model, stack: string, w: Week, sc?: Scenario): number {
  return supplyFte(m, stack, w, sc) - demandFte(m, stack, w, sc);
}

/** Main-stack people with free hours, for the demand panel. */
export function supplyPeople(m: Model, stack: string, w: Week, sc?: Scenario) {
  return m.people
    .filter((p) => p.mainStack === stack)
    .map((p) => ({ email: p.email, name: p.name, freeHours: freeHours(m, p.email, w, sc) }))
    .filter((p) => p.freeHours > 0);
}

/** "Backend · Java" or "QA" for single-stack groups. */
export function stackLabel(m: Model, stack: string): string {
  const g = m.stackGroups.find((x) => x.stacks.includes(stack));
  return !g || g.group === stack ? stack : `${g.group} · ${stack}`;
}
