# Lovable prompt 05: Admin page

Build `/admin` with tabs **Projects**, **People**, **Settings**. Layout reference: `docs/ui/screens/05-admin.png` (numbers, dates and Jira keys in it are placeholders; "HLX" is really `HELIX`). Every edit goes through the context's `applyOp` or `setScenario`; never change the model directly.

## Projects tab

```
+----------------------------------------------------------------+  +----------------------+
| Projects                                                        |  | Add a project        |
| Project | Type | Win chance | When | Unstaffed demand | Scenario | [View/Edit] |  | type, name, client,  |
+----------------------------------------------------------------+  | win chance, start,   |
| Jira project -> project (conversion table)                      |  | duration, stack lines|
| MRD row: [Unmapped · choose project v]  14 h non-billable       |  +----------------------+
+----------------------------------------------------------------+
```

| Component | Behaviour | Core |
|---|---|---|
| Projects list | `model.projects`: name and client; type tag (Signed · from Jira, Internal, Pipeline); win chance (pipeline only, "not set" when null); when ("since <startDate> -> <endDate or ongoing>", pipeline: "<start> · <durationWeeks> wks"); unstaffed demand lines "<stack> <fte>" (+ person name when a line has `email`); scenario: "always in" for signed and internal, "on" or "off" for pipeline from `resolveScenario(model, scenario)`. | `model.projects`, `resolveScenario` |
| Add a project form | Type (Pipeline, Signed, Internal), name, client, win chance (optional, pipeline only), start week (select from `FUTURE`, label `shortDate`), duration (1-26 weeks), stack lines: stack (select from `model.allStacks`, label `stackLabel`), FTE, from and to (selects whose **value is the week offset 0..duration-1** and label is `shortDate(addWeeks(start, i))`; "project start" = empty, "project end" = empty). Validate with `projectFromForm(model, form)` and show its `error` text. On success: `applyOp({ op: 'addProject', project })`; if it is a pipeline project also `setScenario(setProjectOn(scenario, project.projectId, true))`. | `projectFromForm` |
| Project panel (View / Edit) | Pipeline: edit name, client, win chance, start, duration with `editProject`; add a demand line with `addDemandLine`; **Mark as signed** with `markSigned` (optional new start week). Signed and internal: assign a person (person, hours/week, from week, to week) with `setAllocation`; add a demand line. | `overrides.ts` |
| Jira conversion table | One row per `model.keyMap` entry: Jira key, project name, type, start, end; plus the unmapped key `MRD` (from the F2 data issue) highlighted, with a project select -> `applyOp({ op: 'mapJiraKey', jiraProjectKey: 'MRD', projectId })` and the note "14 h counted as non-billable until converted". | `mapJiraKey` |

## People tab

Table of `model.people`: name, HR title, h/week (HR, read-only), stacks as tags with the main stack first and dark, cost/h. Edit stacks, main stack and cost per hour with `editPerson`. Below it, a read-only "Jira account -> person" table from `model.accountMap`, with the unmapped account from the F1 data issue flagged.

## Settings tab

Read-only from `model.settings`: overload above 100%, idle at or below 50%, available from 8 h free, billable target 80%, spare shown from 0.2 FTE.

## Must work (checked by running the core)

1. Add a pipeline project "Test React", React 1 FTE, 4 weeks from 7 Dec: it gets id P-5, appears in Plan's pipeline card switched on, and the skill matrix shows a new React shortage of 0.4 FTE from 7 Dec for 4 weeks.
2. Mark Loyalty app (P-2) as signed: it leaves the pipeline card; Márton's 40 h becomes a manual allocation from 7 Dec; its Node.js 0.5 and QA 0.5 lines stay as unstaffed demand, so the baseline matrix shows Node.js short 0.3 and QA short 0.75 from 7 Dec.
3. Map MRD to Delivery ops: unmapped key hours on Reports drop to 0 and the F2 data issue disappears from Home.
4. **Reset edits** undoes all of it.
