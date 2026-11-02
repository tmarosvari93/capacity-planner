# Capacity Planner

A prototype internal tool for a software agency: plan how people split across billable and internal projects, see the effect of pipeline deals, and report what actually happened.

Built for Adroit Group's AI Product Builder assignment, Task 01. **All people, clients and numbers are fictional.**

- **Live demo:** https://future-fit-capacity-map.lovable.app (no login, nothing to install)
- **Start here:** the "Start here" page in the app gives a two-minute tour.

## What it answers

The brief's five example questions, each with a home on screen:

| Question | Where |
| --- | --- |
| Who will be available in 4 weeks? | Home card, Plan > People |
| What happens if two pipeline projects start at the same time? | Plan > Pipeline: switch deals on, shift them, or tick "Align starts" |
| Which skill will we run short of? | Home card, skill matrix on Home and Plan |
| Who is over 100%, and who is idle? | Home card and table, Plan > People |
| How much of our time went to billable work? | Home card, Reports |

The **Ask** page answers the same questions in plain words. Claude picks one tested calculation and writes the sentence; the code does the maths, and every number in the sentence is checked against the result before it is shown.

## The capacity model in short

- **Capacity:** weekly hours from HR, minus absences and public holidays. 1 FTE = 8 h x working days in the week.
- **Load:** planned hours / capacity. Over = above 100%, idle = 50% or less, available = 8 h or more free.
- **Demand:** each project needs stacks in FTE (for example Backend · Java 0.5 FTE). A stack is short in a week when demand exceeds the free time of the people whose main stack it is. Uncovered demand shows as "Unstaffed".
- **Actuals:** Jira worklogs. Billable = logged on a signed client project. Shown against the plan per person and per project.
- **Scenarios:** pipeline deals are off by default. Switching one on adds its demand on Plan only; Home, Reports and Ask always show committed work.

## Data

The app reads deliberately imperfect sample exports from `public/data/`:

- `hr/people.csv`, `hr/absences.csv`: people, weekly hours, start dates, time off
- `jira/worklogs_2026-W40..W44.json`, `jira/sprint_next.json`: actuals and next sprint
- `app/seed.json`: what HR and Jira do not hold (projects, stack demand, pipeline deals, Jira key mapping)

Import problems (unreadable dates, an unmapped Jira key, an unknown Jira author) are listed on Home, not hidden. "Upload newer export" accepts a fresh file of the same shape. Manual edits on Plan and Admin are kept in a separate layer in the browser, so a new import never overwrites them; "Reset Admin and Plan edits" clears them.

To regenerate the sample data: `bun run data` (needs Python 3).

## Run it locally

Requires [Bun](https://bun.sh) (the repo has a `bun.lock`).

```sh
git clone https://github.com/tmarosvari93/capacity-planner
cd capacity-planner
bun install
bun run dev        # http://localhost:8080
bun run test       # 104 tests
bun run typecheck  # type check of the calculation core
```

Everything except **Ask** works locally with no setup. Ask calls the Supabase edge function `supabase/functions/ask`, which needs the secret `ANTHROPIC_API_KEY` set in Lovable Cloud (or your own Supabase project). Use the live demo to try Ask.

## How it is built

- React 18, TypeScript, Vite, Tailwind; built with Lovable and Claude.
- `src/core/`: all calculations as plain, tested TypeScript functions (capacity, importers, overrides, scenarios, questions, Ask catalogue). The UI only calls these.
- `src/pages/`: Start, Home, Plan, Reports, Admin, Ask.
- `supabase/functions/ask/`: the only server code. Holds the Anthropic key; picks a function and writes the conclusion.
- `tests/` and `fixtures/answer_key.json`: the expected answers the tests check against.
- `CORE.md` and `DATA_CONTRACT.md`: the calculation rules and the import format.

## Known limitations

- Prototype only: no login, and edits are stored per browser, so they are not shared between users.
- The Ask endpoint has no sign-in or rate limit. Acceptable for a demo with fictional data, not for real use.
- Thresholds (100% over, 50% idle, 80% billable target) are fixed; Admin > Settings shows them read-only.
- Pipeline demand counts at full size; the win chance is shown but does not weight the numbers.
- Ask answers "what if we win X?" with a pointer instead of a number; the pipeline what-if lives on Plan.
- On a 1280 px screen the Plan timelines scroll sideways.
