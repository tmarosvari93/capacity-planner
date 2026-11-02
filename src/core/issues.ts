// Data issues and last sync for Home (contract §5.4).
import type { DataIssue, Model } from './types';

const ORDER: Record<DataIssue['severity'], number> = { error: 0, warning: 1, info: 2 };

/** All issues, errors first, then warnings, then info; stable within a severity. */
export function dataIssues(m: Model): DataIssue[] {
  return m.issues.map((x, i) => ({ x, i }))
    .sort((a, b) => ORDER[a.x.severity] - ORDER[b.x.severity] || a.i - b.i)
    .map(({ x }) => x);
}

export function issueCounts(m: Model): Record<DataIssue['severity'], number> {
  const c = { error: 0, warning: 0, info: 0 };
  m.issues.forEach((i) => c[i.severity]++);
  return c;
}

/** Newest export time per source (Jira, HR, App). */
export function lastSync(m: Model): { source: string; exportedAt: string; files: number }[] {
  const by = new Map<string, { exportedAt: string; files: number }>();
  for (const f of m.dataset.manifest) {
    const cur = by.get(f.source);
    by.set(f.source, { exportedAt: !cur || f.exportedAt > cur.exportedAt ? f.exportedAt : cur.exportedAt,
      files: (cur?.files ?? 0) + 1 });
  }
  return [...by].map(([source, v]) => ({ source, ...v }));
}
