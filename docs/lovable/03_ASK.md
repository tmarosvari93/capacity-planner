# Lovable prompt 03: Ask page

Build `/ask`. Layout reference: `docs/ui/screens/03-ask.png`. One question, one answer. No chat thread, no SQL, no database. Remove "New conversation" and the "Design review only" box from the image; use the copy below instead of the image's "database query" wording.

## Layout

```
QUESTIONS ANSWERED FROM YOUR DATA
Ask                                        Scenario: <describeScenario>   [Clear]
+---------------------------------------------------------+  +-------------------------+
| What do you want to know about capacity?                |  | HOW AN ANSWER IS MADE   |
| Ask in plain words. Every number in the answer comes    |  | 1-4 (copy below)        |
| from a tested function over the sample HR and Jira      |  +-------------------------+
| exports. Claude only writes the conclusion.             |  | FUNCTIONS IT CAN USE    |
| chips: the 5 brief questions + 3 more                   |  | 7 functions (below)     |
+---------------------------------------------------------+  +-------------------------+
| ANSWER CARD (when there is one)                         |
|  ● status dot (pulses while answering)                  |
|  Conclusion · written by Claude from the numbers below  |
|  Numbers table                                          |
|  How this was worked out: function, arguments, scenario,|
|  data read (files and row counts)                       |
+---------------------------------------------------------+
| [ Ask about capacity, skills, scenarios or billable time      ] [Ask] |
```

States: empty (chips only) | answering | answer | "I can't answer that from this data" | error with **Try again**.

## Wiring (the whole flow is already in `src/core/ask.ts`)

```ts
import { supabase } from '@/integrations/supabase/client';
const answer = await runAsk(model, question, scenario, (body) =>
  supabase.functions.invoke('ask', { body }).then((r) => { if (r.error) throw r.error; return r.data; }));
```

Render only the `AskAnswer` that comes back: `status` (`answer`, `cannot`, `error`), `conclusion`, `table` (`columns`, `rows`), `function`, `args` (as formatted JSON in mono), `scenario`, `dataRead.summary` and `dataRead.files`. If `usedTemplate` is true, add a small note: "Standard sentence used: the written answer did not pass the number check." On `error`, show `answer.error` in small mono text under the message.

Rules:
- The answer card is frozen: it keeps the scenario it was asked under even if the scenario changes later. Keep only the latest answer in page state; **Clear** removes it.
- Read `?q=` from the URL; if present, fill the box and run it once on load (Home's "Ask about this").
- Chips: "Who will be available in 4 weeks?", "What happens if two pipeline projects start at the same time?", "Which skill will we run short of?", "Who is over 100%, and who is idle?", "How much of our time went to billable work?", plus "Do we have enough Java developers in December?", "Which project drifted most from plan in the last 5 weeks?", "How much of the Orbit e-shop budget have we used?".
- The edge function `ask` is already in `supabase/functions/ask/`. Do not change it. It needs the secret `ANTHROPIC_API_KEY` in Lovable Cloud; tell me if it is missing.
- Never calculate in the page.

## Copy for the right-hand boxes

How an answer is made:
1. Claude picks one function that fits your question, with its inputs.
2. The app runs that function on the imported HR and Jira data and your plan edits.
3. Claude writes a short conclusion using only the numbers the function returned. Claude never calculates.
4. The app checks every number in the conclusion against the result; if one does not match, a standard sentence is shown instead.

Functions it can use (name in mono, then one line): `freeCapacity()` Who has free hours in a week, by stack · `scenarioImpact()` What changes when pipeline projects switch on · `skillGap()` Which stack is short or spare, by week · `loadByPerson()` Who is over or under their capacity · `billableSplit()` Billable share of logged time · `planVsActual()` Plan against Jira hours · `projectBurn()` Hours used against a project budget.

## Must work

- "Which skill will we run short of?" -> function `skillGap`, table shows Backend · Java and QA.
- "What are our developers' salaries?" -> "I can't answer that from this data".
- With the edge function switched off or the key missing -> the error state with Try again, not a blank page.
