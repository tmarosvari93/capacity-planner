# Lovable prompt 04: Reports page

Build `/reports` for 28 Sep – 1 Nov 2026 (`PAST`). Layout reference: `docs/ui/screens/04-reports.png` (numbers in it are placeholders). Imports from `@/core` only. Eyebrow "ACTUALS FROM JIRA WORKLOGS", heading "Reports · 28 Sep – 1 Nov 2026", note on the right "Billable = logged on a project of type Signed."

```ts
const FROM = PAST[0], TO = PAST[PAST.length - 1];
const company = billableSplit(model, FROM, TO, 'company');
const byPersonBill = billableSplit(model, FROM, TO, 'person');
const byProjectBill = billableSplit(model, FROM, TO, 'project');
const byPerson = planVsActual(model, FROM, TO, 'person');
const byProject = planVsActual(model, FROM, TO, 'project');
const burn = projectBurn(model, 'PRJ-ORBIT');
```

## Layout and sources

```
+-------------------+-------------------+-------------------+-------------------+
| Billable share of | Billable          | Logged vs         | Plan vs actual    |
| logged time       | utilisation       | available         | (total drift)     |
+-------------------+-------------------+-------------------+-------------------+
| Gauge: share vs target | Donut: where logged hours went | Donut: billable hours by project |
+---------------------------------------+---------------------------------------+
| By person · plan vs actual and billable | By project · plan vs actual         |
+---------------------------------------+---------------------------------------+
| Orbit e-shop · budget burn (row in the project table or its own card)          |
```

| Component | Source |
|---|---|
| Tile: billable share | `company.company.shareOfLoggedPct`; "<billableHours> of <loggedHours> logged hours, incl. <unmappedKeyHours> h unmapped" |
| Tile: utilisation | `company.company.utilisationPct`; "<billableHours> billable of <availableHours> available hours" |
| Tile: logged vs available | "<loggedHours> h logged of <availableHours> h available" from `company.company` (two numbers, no percentage) |
| Tile: plan vs actual | Headline = the `byProject.rows` entry with the largest absolute `driftHours` (Pulse): "<name> <driftHours> h (<driftPct>%)" |
| Gauge | `shareOfLoggedPct` against `targetPct`; text "<n> pts below target" or "target met" as words |
| Donut: where logged hours went | `byProjectBill.rows` grouped by `type` (signed = billable client work, internal, unmapped): use the row `loggedHours` values as segments and list them with hours |
| Donut: billable hours by project | `byProjectBill.rows` where `billable` |
| Person table | `byPerson.rows` (available, plan, actual as "Logged", drift) joined by email with `byPersonBill.rows` (billable, share of logged); bar = share of logged. Horváth Lili shows "—" for share (she starts 16 Nov) |
| Project table | `byProject.rows` (plan, actual, drift, drift %); type tag Billable / Internal / Unmapped from `type`. **No "Unmapped person" row**: those hours stay on Helix claims portal |
| Burn | `burn`: logged to date, cost (EUR), % of budget used, remaining planned, remaining unstaffed, forecast and forecast vs budget; "not set" when `hourBudget` is null |

Show every value as text next to its colour. Target met or missed is written as a word.

## Must work (checked against `fixtures/answer_key.json`)

Billable 68.8% of logged time (1182.25 of 1717.5 h), utilisation 60.3% (of 1961.6 h available), MRD 14 h unmapped. Pulse drifts +29.5 h (+10.2%). Orbit: 352.75 h logged, 27.1% of the 1300 h budget used, forecast 99.2%.
