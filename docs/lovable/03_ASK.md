# Lovable prompt 03: Ask page

Build `/ask`. Visual reference: the Ask page of `docs/ui/canvas/Main.dc.html`. One question, one answer. No chat thread, no SQL.

## Layout

```
+---------------------------------------------------------------+
| [ question box                                        ] [Ask] |
| chips: Who is available in 4 weeks? | ...5 brief questions    |
+---------------------------------------------------------------+
| ANSWER CARD                                                   |
|  status dot (pulses while answering)                          |
|  Conclusion, written by Claude from the numbers below         |
|  Numbers table  (columns and rows from the result)            |
|  How this was worked out:                                     |
|    function  skillGap   args { fromWeek, toWeek }             |
|    scenario  Baseline                                         |
|    data read HR people, 12 rows; ... Jira worklogs W40-W44, 605 rows |
+---------------------------------------------------------------+
States: empty | answering | answer | "I can't answer that from this data" | error + [Try again]
```

## Wiring (the whole flow is already in `src/core/ask.ts`)

```ts
const answer = await runAsk(model, question, scenario,
  (body) => supabase.functions.invoke('ask', { body })
    .then((r) => { if (r.error) throw r.error; return r.data; }));
```

Render only the `AskAnswer` that comes back: `conclusion`, `table` (columns and rows), `function`, `args`, `scenario`, `dataRead.summary` and `dataRead.files`. `status` is `answer`, `cannot` or `error`. If `usedTemplate` is true, add a small note "Standard sentence used (the written answer failed the number check)".

Rules:
- The answer card is frozen: keep the scenario it was asked under even if the scenario changes later.
- Read `?q=` from the URL; if present, fill the box and run it once on load.
- The five chips are the brief's questions. Add three more chips from `fixtures/answer_key.json` `askTests`.
- The edge function `ask` already exists in `supabase/functions/ask/`. Do not change it. It needs the `ANTHROPIC_API_KEY` secret in Lovable Cloud. Tell me if it is missing.
- Never calculate in the page. Claude only chooses a function and phrases its result.

## Must work

"Which skill will we run short of?" -> `skillGap`, Java and QA in the table. "What are our developers' salaries?" -> "I can't answer that from this data".
