# Lovable prompt 01: Plan page (the core)

Build `/plan`. Layout reference: `docs/ui/screens/02-plan.png` (numbers in it are placeholders). Read the "Where the build differs" table in `00_SETUP.md` first. Imports from `@/core` only. Order on the page, top to bottom: pipeline card, skill matrix, People grid, legend bar. "How to use this page" box on the right.

## Layout

```
Plan   2 Nov 2026 – 24 Jan 2027, 12 weeks
+-----------------------------------------------------------------------------+  +-------------+
| PIPELINE  All off = signed and internal work only     [+ Add project] [All off]  | How to use  |
| ON · DEAL                         | 2 Nov | 9 Nov | ... | 18 Jan |            |  | this page   |
| (o) P-1 Fintech customer portal   |       |       | [== bar: 3 FTE ...]  [-][+]|  +-------------+
|     Meridian Pay · 50% win chance |  shift -/+ weeks at the end of each row     |
| (o) P-2 Loyalty app · 75%         |   bar from 7 Dec, 8 weeks                   |
| (o) P-3 Fleet dashboard · win chance not set   bar from 4 Jan, 6 weeks        |
| (o) P-4 Nova phase 2 · 25%        |   bar from 28 Dec, 10 weeks                 |
| [x] Align starts                                                              |
| chips: (Kovács Anna over 100% from 30 Nov, peak 150%) (Java gap 0.3 -> 1.3 FTE) |
+-----------------------------------------------------------------------------+
| SKILL MATRIX · FTE balance per week (– short, + spare)   "2 stacks short: ..."|
| stack rows x 12 future weeks; -0.3 amber, +0.6 navy tint, blank when 0..0.2   |
+-----------------------------------------------------------------------------+
| People                                     [x] Show last 5 weeks (actuals)    |
| PERSON          | 28 Sep ... 26 Oct (actual) || 2 Nov today | 9 Nov ... 18 Jan|
| BACKEND · JAVA · 2 (MAIN STACK)                                               |
| Kovács Anna     | 38h +2 ...                 || 100%  ...  away 40h plan     |
| 40 h/wk · Java, DevOps                                                        |
| Unstaffed · Java (demand row, only when there is demand)                      |
+-----------------------------------------------------------------------------+
| legend: Over 100% · 51–100% · Idle 50% or less · Planned while away · ● Manual edit   Manual edits: N [Reset edits] |
```

## Components and the core function behind each

| Component | Behaviour | Core |
|---|---|---|
| Pipeline card | One row per project with `type === 'pipeline'` (P-1 to P-4, plus any added in Admin). Switch: `setScenario(setProjectOn(scenario, id, on))`. Shift −/+: `shiftProject(scenario, id, -1 or +1)`. Align starts: `setAlignStarts(scenario, checked)`. All off: `setScenario(undefined)`. Win chance `null` shows "win chance not set". The bar starts at `resolveScenario(model, scenario)[id] ?? project.startDate` and ends at `projectLastWeek(project, start)`; label = the project's demand lines (stack FTE, named person in brackets). Bars are dashed when off, solid when on. No editing on the bar; "+ Add project" goes to `/admin`. | `scenario.ts`, `projectLastWeek` |
| Change chips | Hidden at baseline. From `scenarioImpact(model, scenario)`: one chip per `newlyOver` entry ("<name> over 100% from <shortDate(firstWeek)>, peak <peakPct>%") and per `stackChanges` entry ("<stackLabel> gap grows <baselinePeakFte> -> <peakFte> FTE" or "<stackLabel> new gap <peakFte> FTE"). | `scenarioImpact`, `stackLabel`, `shortDate` |
| Week headers | `shortDate(w)` and `isoWeek(w)`; under it "today" for `TODAY`, else `workingDays(w)` + " days" when it is not 5; tooltip `weekNote(w)` (W43 4, W50 6, W52 3, W53 4 days). | `calendar.ts` |
| Skill matrix | Rows = `model.allStacks` labelled with `stackLabel`. Cells = `skillGap(model, FUTURE[0], FUTURE[FUTURE.length - 1], scenario).matrix[stack][week].balanceFte`: negative = short (amber, "−0.3"), ≥ 0.2 = spare (navy tint, "+0.6"), otherwise blank. Header line from `.shortages`. When a scenario is on, outline cells whose value differs from the baseline call (`scenario` = undefined). Click a cell -> demand panel. | `skillGap`, `stackLabel` |
| People grid | Rows = `model.people` grouped by `mainStack` (group header "<STACK LABEL> · <count> (MAIN STACK)"); under the name "<weeklyHours> h/wk · <stacks, main first>". Columns = `PAST` (if the checkbox is on), a thick today line, then `FUTURE`. **Past cell:** `actualHours` + "h" and `driftHours` signed ("38h", "+2"). **Future cell:** `loadPct(model, email, w, scenario)`: a number -> "<n>%" with band (over > 100 amber, 51–100 navy tint, ≤ 50 dashed outline); `'away'` -> hatched "away" + planned hours; `null` and `employedDates(person, w).length === 0` -> "not started" (or "left"); add "<n>d off" when `absenceDays(person, w) > 0`. Dot marker when any `allocationRows(...)` row has `source === 'manual'`. Rows sorted by name inside each group. | `capacity.ts` |
| Unstaffed demand rows | Under each stack group, a row "Unstaffed · <stack>" when `demandFte(model, stack, w, scenario) > 0` in any future week; cell = that FTE. | `stacks.ts` |
| Person panel | Click any cell. First line: `availabilityFormula(model, email, w)`. Then hours by project with a source tag: future weeks `plannedRows(model, email, w, scenario)` (seed, sprint, manual, pipeline); past weeks plan `allocationRows` vs actual `actualRows`. **Future weeks only:** edit form (project select from signed and internal projects, hours/week, from week, to week, all weeks from `FUTURE`) -> `applyOp({ op: 'setAllocation', email, projectId, hoursPerWeek, fromWeek, toWeek })`. | `capacity.ts`, `overrides.ts` |
| Demand panel | Click a matrix cell: `demandParts(model, stack, w, scenario)` (label and hours) and `freeCapacity(model, w, stack, scenario).people`. | `stacks.ts`, `questions.ts` |
| Legend bar | "Manual edits: N" = number of ops in `layer.ops`; Reset edits -> `reset()`. | context |
| How to use this page | 1. Orange cells in the skill matrix are weeks a stack runs short. 2. Switch pipeline deals on to see their effect; shift them or align their starts. 3. Click a person's cell to see the hours behind it and change future hours. 4. Every change applies at once; Reset edits undoes all of them. | — |

## Must work (checked against `fixtures/answer_key.json`)

1. Baseline: Java −0.3 in the weeks of 30 Nov and 7 Dec; QA −0.25 in the week of 28 Dec.
2. Switch on P-1 and P-2, tick **Align starts**: Loyalty app moves to 30 Nov. Chips: Kovács Anna and Kiss Márton over 100% from 30 Nov (peak 150%); Java 0.3 -> 1.3 FTE; QA 0.25 -> 0.75; new gaps React 0.4, Node.js 0.3, UX/UI 0.2. Grid and matrix change to match.
3. Click Márton's 30 Nov cell: Pulse 20 h (seed) + Loyalty app 40 h (pipeline), load 150%. Set his Pulse hours to 0 from 30 Nov to 18 Jan: his 30 Nov load drops to 100% and the cell shows the manual dot.
4. Refresh the page: edits and scenario are still there. **Reset edits**: everything is back to step 1.

If a number looks wrong, do not fix it in the UI. Tell me which core function returned it.
