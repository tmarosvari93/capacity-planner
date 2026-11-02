# Lovable prompt 02: Home page

Build `/`. Visual reference: the Home page of `docs/ui/canvas/Main.dc.html`. Imports from `@/core` only. Heading: "What needs attention".

## Layout

```
+------------------------------------------------------------------+
| FIVE QUESTION TILES (row of cards, each: question, one-line answer, "Ask about this") |
| Q1 Who is available in 4 weeks? | Q2 Two pipeline projects at once? | Q3 Which skill runs short? |
| Q4 Over 100% / idle?            | Q5 Billable share?                                         |
+------------------------------------------+-----------------------+
| PEOPLE OVER 100% OR IDLE (this week + 4) | SKILL MATRIX, compact  |
| table: person, status, weeks, peak/low   | shortages only         |
+------------------------------------------+-----------------------+
| DATA FROM LAST IMPORT  (error > warning > info; file, row, rule, [Fix in Admin]) |
| LAST SYNC  Jira / HR / App timestamps          [Upload newer export] (step 7)   |
+------------------------------------------------------------------+
```

## Tiles and the core function that feeds each

| Tile | Core call | One-line answer (use `templateConclusion` text or build from the result) |
|---|---|---|
| Q1 | `freeCapacity(model, '2026-11-30', null, scenario)` | "6 people have at least a day free in the week of 30 Nov" + top names |
| Q2 | `scenarioImpact(model, P-1 + P-2 on, alignStarts)` (a fixed scenario, independent of the open one) | people newly over 100%, stacks with new or larger gap |
| Q3 | `skillGap(model, FUTURE[0], FUTURE.at(-1), scenario)` | first stack to run short, week, peak FTE |
| Q4 | `loadByPerson(model, '2026-11-02', '2026-11-30', scenario)` | counts and names over 100% and idle, planned-while-away flagged |
| Q5 | `billableSplit(model, '2026-09-28', '2026-10-26', 'company')` | share of logged time vs 80% target, utilisation |

"Ask about this" navigates to `/ask?q=<the question>` (Ask runs it on load).

## Other components

| Component | Core |
|---|---|
| Over/idle table (this week and next 4) | `loadByPerson`; empty state "Nobody over or idle" |
| Compact skill matrix, shortages only | `skillGap(...).shortages` |
| Data issues list sorted error, warning, info, with file, row, rule text and a "Fix in Admin" link when `fixIn` is set | `dataIssues(model)` from `issues.ts` |
| Last sync per source | `lastSync(model)` from `issues.ts` |
| Upload newer export (build last, cut first) | `mergeUpload` |

## Must work

Baseline numbers match `BUILD_PLAN.md` section 3, step 1: 6 people free on 30 Nov; Java short from 30 Nov by 0.3 FTE; Kinga, Dora and Gergo over 100%, Marton and Lili idle, Anna planned while away; billable 68.8% of logged time against 80%; Q2 pushes Anna and Marton to 150%. When a scenario is on, tiles that use it say so. All ten data issues appear. **This is the first version that can be submitted.**
