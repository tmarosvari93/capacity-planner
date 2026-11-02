// Scenarios: switch pipeline projects on or off, shift their start, align starts (contract §4, C13).
import { TODAY, addDays, addWeeks, daysBetween, minDate, shortDate } from './calendar';
import { projectLastWeek } from './overrides';
import type { DemandLine, Model, Scenario, Week } from './types';

export const BASELINE: Scenario | undefined = undefined;

/** Effective start week of every switched-on pipeline project. */
export function resolveScenario(m: Model, sc?: Scenario): Record<string, Week> {
  const starts: Record<string, Week> = {};
  for (const [pid, cfg] of Object.entries(sc?.projects ?? {})) {
    const p = m.projectById.get(pid);
    if (!cfg.on || !p || p.type !== 'pipeline') continue;
    starts[pid] = addWeeks(p.startDate, cfg.startShiftWeeks ?? 0);
  }
  if (sc?.alignStarts) {
    const ids = Object.keys(starts);
    if (ids.length) {
      const first = ids.map((id) => starts[id]).sort()[0];
      ids.forEach((id) => (starts[id] = first));
    }
  }
  return starts;
}

/** Pipeline demand lines active in week w under the scenario. Pipeline demand counts from today on. */
export function pipelineLines(m: Model, sc: Scenario | undefined, w: Week): { projectId: string; line: DemandLine }[] {
  if (!sc || w < TODAY) return [];
  const out: { projectId: string; line: DemandLine }[] = [];
  for (const [pid, start] of Object.entries(resolveScenario(m, sc))) {
    const p = m.projectById.get(pid)!;
    const shift = daysBetween(p.startDate, start);
    const last = projectLastWeek(p, start);
    if (!(start <= w && w <= last)) continue;
    for (const line of p.demand) {
      const f = line.fromWeek ? addDays(line.fromWeek, shift) : start;
      const t = minDate(line.toWeek ? addDays(line.toWeek, shift) : last, last);
      if (f <= w && w <= t) out.push({ projectId: pid, line });
    }
  }
  return out;
}

// ---- Helpers for the pipeline card (each returns a new scenario)
const base = (sc?: Scenario): Scenario => ({ projects: { ...(sc?.projects ?? {}) }, alignStarts: sc?.alignStarts });

export function setProjectOn(sc: Scenario | undefined, projectId: string, on: boolean): Scenario {
  const s = base(sc);
  s.projects[projectId] = { ...(s.projects[projectId] ?? { startShiftWeeks: 0 }), on };
  return s;
}
export function shiftProject(sc: Scenario | undefined, projectId: string, deltaWeeks: number): Scenario {
  const s = base(sc);
  const cur = s.projects[projectId] ?? { on: false, startShiftWeeks: 0 };
  s.projects[projectId] = { ...cur, startShiftWeeks: (cur.startShiftWeeks ?? 0) + deltaWeeks };
  return s;
}
export function setAlignStarts(sc: Scenario | undefined, align: boolean): Scenario {
  return { ...base(sc), alignStarts: align };
}
export function allOff(): Scenario | undefined {
  return undefined;
}
export function isBaseline(m: Model, sc?: Scenario): boolean {
  return Object.keys(resolveScenario(m, sc)).length === 0;
}
/** "Baseline" or "P-1, P-2 on, starts aligned (30 Nov)". */
export function describeScenario(m: Model, sc?: Scenario): string {
  const starts = resolveScenario(m, sc);
  const ids = Object.keys(starts).sort();
  if (!ids.length) return 'Baseline';
  const shifted = ids.filter((id) => starts[id] !== m.projectById.get(id)!.startDate)
    .map((id) => `${id} from ${shortDate(starts[id])}`);
  return `${ids.join(', ')} on` + (sc?.alignStarts && ids.length > 1 ? `, starts aligned (${shortDate(starts[ids[0]])})` :
    shifted.length ? `, ${shifted.join(', ')}` : '');
}
