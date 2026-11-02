# Lovable prompt 04: Reports page

Build `/reports`, period 28 Sep - 1 Nov 2026 (past weeks `PAST`). Visual reference: the Reports page of `docs/ui/canvas/Main.dc.html` (low-fi: plain tables and simple charts). Imports from `@/core` only.

## Layout

```
+---------+---------+---------+---------+
| Billable| Utilis. | Logged  | Total   |   4 tiles
| share   |         | vs avail| drift   |
+---------+---------+---------+---------+
| GAUGE: share vs 80% target | DONUT: where logged hours went | DONUT: billable by project |
+------------------------------------------------------------------+
| TABLE by person: available, plan, logged, drift, billable, share  |
| TABLE by project: plan, actual, drift, drift %   (MRD tagged "Unmapped") |
| BURN: project row or panel with hour budget (Orbit)               |
+------------------------------------------------------------------+
```

| Component | Core |
|---|---|
| Tiles, gauge | `billableSplit(model, '2026-09-28', '2026-10-26', 'company')` and `planVsActual` totals |
| Donut: where logged hours went (billable, internal, unmapped) | `billableSplit(..., 'project')` grouped by `type` |
| Donut: billable hours by project | `billableSplit(..., 'project')` where `billable` |
| Person table | `planVsActual(..., 'person')` + `billableSplit(..., 'person')`; Lili shows "—" (no past weeks) |
| Project table | `planVsActual(..., 'project')`; rows with `type: 'unmapped'` tagged Unmapped |
| Burn | `projectBurn(model, 'PRJ-ORBIT')`; show "not set" when `hourBudget` is null |

Always show the value as text next to any colour. Target met or missed is a word, not only a colour.

## Must work (answer key)

Billable 68.8% of logged time, utilisation 60.3%, Pulse drifts +29.5 h (+10.2%), MRD 14 h unmapped, Orbit 27.1% of budget used and forecast 99.2%.
