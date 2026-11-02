# Lovable prompt 01: Plan page (the core)

Build `/plan`. Visual reference: the Plan page of `docs/ui/canvas/Main.dc.html` and `docs/ui/DESIGN_TOKENS.md`. Imports from `@/core` only.

## Layout

```
+------------------------------------------------------------------------------+
| PIPELINE CARD                                                  [All off]     |
| [on] P-1 Fintech customer portal  win 50%   start 30 Nov  shift [-][+]       |
| [on] P-2 Loyalty app              win 75%   start 7 Dec    shift [-][+]       |
| [ ] P-3 Fleet dashboard           win not set  start 8 Feb  shift [-][+]      |
| [ ] P-4 Nova phase 2              win 25%   start 25 Jan   shift [-][+]       |
| [x] Align starts                                                             |
|  chips:  (Kovacs Anna over 100% from 30 Nov, peak 150%)  (Java gap 0.3 -> 1.3 FTE) |
+------------------------------------------------------------------------------+
| PEOPLE GRID                  28 Sep  5 Oct 12 Oct 19 Oct 26 Oct | 2 Nov  9 Nov ... 18 Jan |
| Backend                      <-- actuals + drift -->        today|  <-- load % -->      |
|  Kovacs Anna  Java,DevOps    38h -2   40h ...                    | 100%   100% ...       |
|  ...                                                                                      |
|  Unstaffed Java (demand)                                         | 0.5 FTE ...           |
| Frontend ...  (grouped by main stack, 12 people)                                          |
+------------------------------------------------------------------------------+
| SKILL MATRIX   stack rows x 12 future weeks, cell = FTE balance              |
|  Java   -0.3  -0.3  +0.1 ...       (short = amber, spare = navy, blank < 0.2) |
+------------------------------------------------------------------------------+
Click a grid cell  -> PERSON PANEL (right side drawer)
Click a matrix cell -> DEMAND PANEL (right side drawer)
```

## Components and the core function that feeds each

| Component | Behaviour | Core |
|---|---|---|
| Pipeline card | One row per project with `type === 'pipeline'`. Switch calls `setProjectOn`; shift -/+ calls `shiftProject(sc, id, -1 or +1)`; Align starts calls `setAlignStarts`; All off calls `setScenario(undefined)`. Win chance null shows "not set". Every change applies at once (no Apply/Discard). | `scenario.ts` |
| Change chips | Hidden at baseline. One chip per entry of `scenarioImpact(model, scenario).newlyOver` ("Name over 100% from <short date>, peak N%") and `.stackChanges` ("<stack> gap grows a -> b FTE" or "<stack> new gap b FTE"). | `scenarioImpact`, `stackLabel` |
| People grid | Rows = `model.people` grouped by `mainStack` (stack tags shown, main first and dark). Columns = `WEEKS` (5 past, a clear today line, 12 future). **Past cell:** `actualHours` and drift = actual - `plannedHours` e.g. "38 h, -2". **Future cell:** `loadPct` as a number with band colour; "away" when it returns `'away'`; blank when `null`. Show a note on short weeks (`workingDays(w) !== 5`: W43 4, W50 6, W52 3, W53 4). Grey cells before a joiner's start. Marker "manual" when any `allocationRows` source is `manual`, "sprint" for W45-W46. | `capacity.ts`, `calendar.ts` |
| Unstaffed demand rows | Under each stack group, one row per stack that has `demandParts` in any future week, cell = `demandFte`. Hide the row when empty. | `stacks.ts` |
| Skill matrix | Rows = stacks, cells = `skillGap(model, FUTURE[0], FUTURE.at(-1), scenario).matrix[stack][week].balanceFte`. Negative = short (amber, "-0.3"), positive >= 0.2 = spare, else blank. Outline cells that differ from baseline when a scenario is on. | `skillGap` |
| Person panel | Opens on a cell. First line, exactly: "available = <weekly hours> h / 5 x (<employed days> days - <off days> off) = <available> h". Then hours by project with source tag (seed, sprint, manual, pipeline) from `plannedRows`/`allocationRows`, then flags. **Future weeks only:** an edit form (project, hours/week, from week, to week) that calls `applyOp({op:'setAllocation',...})`. | `capacity.ts`, `overrides.ts` |
| Demand panel | Opens on a matrix cell: `demandParts` list and main-stack people with free hours (`freeCapacity(model, week, stack, scenario)`). | `stacks.ts`, `questions.ts` |

## Must work (from `BUILD_PLAN.md` demo story)

1. Switch on P-1 and P-2, press **Align starts**: chips show Anna and Marton over 100% from 30 Nov (peak 150%), Java gap 0.3 -> 1.3 FTE, QA 0.25 -> 0.75, and new gaps in React 0.4, Node.js 0.3, UX/UI 0.2. Grid and matrix change to match.
2. Click Marton's 30 Nov cell: Pulse 20 h + Loyalty 40 h (pipeline), load 150%. Set his Pulse hours to 0 from 30 Nov to 18 Jan: he drops to 100% and the cell shows a manual marker.
3. **Reset edits** returns every number to baseline. A page refresh keeps edits.

If a number looks wrong, do not fix it in the UI. Say which core function returned it.
