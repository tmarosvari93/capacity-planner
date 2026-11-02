# Capacity Planner core (`src/core`)

Every number in the app comes from here. Pages never compute hours, loads or percentages themselves. Lovable must not edit `src/core`, `tests`, `fixtures`, `scripts`, `public/data` or `supabase/functions/ask`.

## Run

```
npm install
npm test             # Vitest: 104 tests against fixtures/answer_key.json
npm run typecheck    # tsc on the core, tests and the ask function logic
npm run data         # regenerate public/data and the answer key (Python 3)
```

CI (`.github/workflows/test.yml`) runs all three on every push. It fails if anyone edits the sample files or the answer key by hand.

## How a page uses it

```ts
import {
  loadAll, applyOverrides, loadOverrides, saveOverrides, resetOverrides, withOp, withScenario,
  freeCapacity, skillGap, loadByPerson, scenarioImpact, billableSplit, planVsActual, projectBurn,
  setProjectOn, shiftProject, setAlignStarts, describeScenario, runAsk,
} from '@/core';

const dataset = await loadAll((p) => fetch(`/data/${p}`).then((r) => r.text()));
let layer = loadOverrides();                       // edits + scenario from localStorage
let model = applyOverrides(dataset, layer);        // rebuild after every edit
const sc = layer.scenario;                         // undefined = baseline

freeCapacity(model, '2026-11-30', null, sc);       // Home tile Q1
layer = withScenario(layer, setAlignStarts(setProjectOn(setProjectOn(sc, 'P-1', true), 'P-2', true), true));
saveOverrides(layer); model = applyOverrides(dataset, layer);

const answer = await runAsk(model, question, layer.scenario,
  (body) => supabase.functions.invoke('ask', { body }).then((r) => { if (r.error) throw r.error; return r.data; }));
```

## Modules

| Module | What it does |
|---|---|
| `calendar` | 17-week window, Hungarian holidays, the 12 Dec working Saturday, FTE hours, week labels |
| `importers` | HR CSVs, Jira worklogs and sprint, seed; `loadAll` via `manifest.json`; `mergeUpload` for a newer export |
| `overrides` | The edit layer (`setAllocation`, `addProject`, `editProject`, `addDemandLine`, `markSigned`, `mapJiraKey`, `editPerson`), localStorage, Reset, `projectFromForm` for Add project |
| `scenario` | Switch, shift, align starts, `describeScenario` for the top bar |
| `capacity` | Available, planned rows with source, load %, free, actual, drift, the person-panel formula |
| `stacks` | Unstaffed demand, main-stack supply, balance in FTE |
| `questions` | The five brief questions plus `planVsActual` and `projectBurn` |
| `issues` | Data issues (errors first) and last sync per source |
| `ask` | Catalogue, argument validation, `runFunction`, data read, numbers guard, template sentences, answer table, `runAsk` |

## What the tests prove

- Every person × week cell of available, planned (baseline and P-1 + P-2 aligned) and actual hours equals the Python reference.
- The five questions, plan vs actual, Orbit burn and four extra cases equal `answer_key.json`. Hours and FTE match within ±0.01, percentages within ±0.1.
- All ten data issues and the eight seeded flaws behave as the contract says.
- Demo story edits: the hours edit changes only its cells, Add project → switch on → Mark as signed, mapping MRD, Reset.
- Ask: 13 expected questions validate and run, bad arguments are refused, and invented decimals are caught by the guard. The edge function's catalogue copy is identical.
- Ten guards were broken on purpose (precedence, F6, idle threshold, main-stack supply, align starts, F7, billable rule, past plan, numbers guard, working Saturday). Each made tests fail.
