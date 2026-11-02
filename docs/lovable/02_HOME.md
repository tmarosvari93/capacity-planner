# Lovable prompt 02: Home page

Build `/`. Layout reference: `docs/ui/screens/01-home.png` (numbers in it are placeholders). Imports from `@/core` only. Eyebrow "WEEK OF MON 2 NOV 2026 · W45", heading "What needs attention".

## Layout

```
+----------------------+----------------------+----------------------+----------------------+
| Which skill will we  | Who is over 100%,    | Who will be available| What if two pipeline |
| run short of?        | and who is idle?     | in 4 weeks? (w/c 30  | projects start       |
| <big answer>         | (this week + next 4) | Nov)                 | together?            |
| [Open in Plan][Ask]  | [Open Plan][Ask]     | [Open Plan][Ask]     | [Try this scenario][Ask] |
+----------------------+----------------------+----------------------+----------------------+
| How much of our time went to billable work?  [Open Reports][Ask about this]   |
+--------------------------------------------------------------------------------------------+
| SKILL MATRIX · FTE balance per week, next 12 weeks   (reuse the Plan matrix component)      |
+-------------------------------------------+------------------------------------------------+
| People over 100% or idle · this week and next 4 | Data from last import   [Upload newer export] |
| Person | Stack | Status | Weeks | Peak     | last sync cards; issues error > warning > info  |
+-------------------------------------------+------------------------------------------------+
```

## Tiles

| Tile | Core call | Big line and detail lines |
|---|---|---|
| Which skill will we run short of? | `skillGap(model, FUTURE[0], FUTURE[FUTURE.length - 1], scenario)` | `stackLabel` of the first shortage; one line per shortage "<stack> from w/c <shortDate(firstWeek)>, up to <peakFte> FTE short" |
| Who is over 100%, and who is idle? | `loadByPerson(model, '2026-11-02', '2026-11-30', scenario)` | "<over.length> over · <idle.length> idle"; names with peak or lowest %; planned-while-away names |
| Who will be available in 4 weeks? | `freeCapacity(model, IN_4_WEEKS, null, scenario)` | "<people.length> people, <totalFreeHours> h free"; top 4 rows "<name> · <mainStack> · <freeFte> FTE (<freeHours> h)" |
| What if two pipeline projects start together? | `scenarioImpact(model, PAIR)` with the fixed `PAIR` below, independent of the open scenario | "<newlyOver.length> people over 100%, <stackChanges.length> stacks short"; first lines of each. **Try this scenario** = `setScenario(PAIR)` then go to `/plan` |
| How much of our time went to billable work? | `billableSplit(model, PAST[0], PAST[PAST.length - 1], 'company')` | "<shareOfLoggedPct>% of logged time" vs "<targetPct>% target"; "Utilisation <utilisationPct>% of available hours"; "28 Sep – 1 Nov, Jira worklogs" |

```ts
const PAIR = { projects: { 'P-1': { on: true, startShiftWeeks: 0 }, 'P-2': { on: true, startShiftWeeks: 0 } }, alignStarts: true };
```

When a scenario is on, the tiles that take `scenario` show a small "with scenario: <describeScenario>" note. "Ask about this" navigates to `/ask?q=<the tile's question>`; "Open in Plan" goes to `/plan`; "Open Reports" to `/reports`.

## Other components

| Component | Core |
|---|---|
| Skill matrix (same component as Plan) | `skillGap(...).matrix` |
| Over/idle table: person, stack tags, status (Over / Idle / Away), weeks (`shortDate`), peak or lowest % | `loadByPerson(...).over`, `.idle`, `.plannedWhileAway`; empty state "Nobody over or idle" |
| Data from last import: last sync cards per source; "<n> warnings, <n> handled silently, <n> rows skipped" (use `issueCounts(model)`); each issue with severity tag, text, file, row and rule; "Fix in Admin" link to `/admin` when `fixIn` is set | `dataIssues(model)`, `issueCounts(model)`, `lastSync(model)` |
| Upload newer export (build last, skip if short of time) | `mergeUpload(dataset, path, text, new Date().toISOString())` |

## Must work (baseline, checked against `fixtures/answer_key.json`)

- Skill: Backend · Java from w/c 30 Nov, up to 0.3 FTE short; QA from w/c 28 Dec, up to 0.25 FTE.
- Over: Szabó Dóra 112.5%, Varga Gergő 116.7%, Papp Kinga 110%. Idle: Horváth Lili 40%, Kiss Márton 50%. Kovács Anna planned while away (w/c 23 Nov).
- Available in 4 weeks: 6 people, 88 h free (Horváth Lili 24 h, Kiss Márton 20 h, Varga Gergő 16 h, Balogh Réka 12 h, Fekete Máté 8 h, Tóth Bence 8 h).
- Two pipeline projects: Kovács Anna and Kiss Márton over 100% from 30 Nov (150%); Java and QA gaps grow; React, Node.js and UX/UI get new gaps.
- Billable: 68.8% of logged time against 80%; utilisation 60.3%.
- 10 data issues listed.

**This is the first version that can be submitted.**
