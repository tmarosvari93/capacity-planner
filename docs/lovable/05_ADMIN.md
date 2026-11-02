# Lovable prompt 05: Admin page

Build `/admin` with tabs **Projects**, **People**, **Settings**. Visual reference: the Admin page of `docs/ui/canvas/Main.dc.html`. Every edit goes through `applyOp` (core `overrides.ts`); never mutate the model directly.

## Projects tab

| Component | Behaviour | Core |
|---|---|---|
| Projects list | name, client, type (signed / pipeline / internal), win chance, dates, demand by stack, scenario state (on / off / always in) | `model.projects` |
| Add project form | type, name, client, win chance (optional), start week, duration, stack lines (stack, FTE, from offset, to offset). Validate with `projectFromForm(model, form)`; show its `error` text. On success `applyOp({op:'addProject', project})`; a new pipeline project is switched on in the scenario. | `projectFromForm`, `addProject` |
| Project panel | **Mark as signed** (pipeline only, `markSigned`), assign a person (hours/week, from, to) = `setAllocation`, add demand line = `addDemandLine` | `overrides.ts` |
| Jira conversion table | Jira key -> project, type, start, end. The unmapped MRD row is flagged with a project dropdown that calls `mapJiraKey`. | `mapJiraKey` |

## People tab

Name, HR title, hours/week (HR), stacks with the main stack first and dark, cost/h. Edit stacks, main stack and cost with `editPerson`. Below it, a read-only Jira account -> person table with unmapped accounts flagged (F1).

## Settings tab

Read-only: overload 100%, idle 50%, available >= 8 h, billable target 80%, spare >= 0.2 FTE (from `model.settings`).

## Must work (demo story step 5)

Add a pipeline project (React 1 FTE, 4 weeks from 7 Dec): it appears in the pipeline card on Plan, switched on, and the React gap grows. Mark the Loyalty app as signed: it leaves the pipeline card, Marton's 40 h becomes an allocation, and the Node.js and QA lines become unstaffed demand in the baseline. Map MRD to a project and its 14 h moves. **Reset edits** undoes all of it.
