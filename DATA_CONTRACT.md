# Capacity app – data contract (v2.1, 1 Nov 2026)

Task 01. Defines every entity and field, where it comes from, its format and key, and how the brief's five questions are computed. The generator script, the answer key and the build must follow this file; if they disagree, this file wins until changed.

v2 replaced v1 after the UI design review (1 Nov 2026). v2.1 (1 Nov, 22:29) adds the changes Tamas approved with the sample data (C12–C19). What changed and why is in §0. Tags: anything not stated by Tamas or the brief is marked [assumption] or [suggestion]. Field names imitate real Jira and HR exports but do not claim to be exact [assumption].

---

## 0. Changes from v1

| # | v1 | v2 | Why |
|---|---|---|---|
| C1 | CRM file (`crm/deals.json`) with stages | **Dropped.** 2–5 pipeline projects entered by hand in Admin, optional win chance % | Decided by Tamas: a CRM import adds parsing and flaws but no answer to the brief's questions |
| C2 | Charter files for signed projects (dates, budget, demand) | **Dropped.** Signed projects come from converting a Jira project in Admin; people link to them through Jira (worklogs, sprint) or a manual assignment in Admin | Decided by Tamas: nobody would upload a charter; Jira already knows who works where |
| C3 | Status derived from the CRM stage; billable = deal `Closed Won` | Project `type` is stored: `signed`, `pipeline`, `internal`. **Billable = type `signed`.** "Mark as signed" turns a pipeline project into a signed one | Follows from C1 |
| C4 | 7 flat skills, one primary + secondary "could cover" | **Stacks in two levels** (group → stack), a person has one or more stacks, one of them is the **main** stack | Decided by Tamas: Backend/Frontend alone hides Java vs .NET shortages |
| C5 | Hours in the skill view | **FTE everywhere at planning level** (pipeline, skill matrix); hours in the person view | Decided by Tamas: one unit per view |
| C6 | Win % from a stage table | `winChancePct` per pipeline project, optional, display only | Follows from C1 |
| C7 | `hourBudget` from charters | Optional `hourBudget` on the project, entered in Admin; burn shows % of budget only when it is set [suggestion] | Charters are gone, so budget needs a home |
| C8 | Scenario `{dealId: on/off, startShiftWeeks}` | `{projectId: on/off, startShiftWeeks}` plus an "align starts" action | Brief question 2 says "start at the same time"; the seed pipeline projects start on different dates, so the scenario must be able to line them up |
| C9 | Ask panel on every page | **Ask is its own page** in the sidebar; one question → one answer, each answer frozen at the time it was asked | Decided by Tamas in design review |
| C10 | Plan vs actual inside Plan | Same, **past 5 weeks shown by default** in the People grid; plus plan vs actual tables in Reports | Brief: "forward planning and factual reporting in one view" |
| C11 | Seeded flaws F4, F5 (CRM) | Replaced by F4 (pipeline project without win chance) and F5 (sprint issue without estimate) | CRM is gone |

### v2.1 additions (approved by Tamas, 1 Nov 2026, 22:29)

| # | Change | Why |
|---|---|---|
| C12 | `public/data/manifest.json` lists every sample file with its source, kind and `exportedAt`; the app reads it first. CSV files carry their export time here | A browser cannot list a folder; CSVs have no place for a timestamp |
| C13 | Scenario gains `alignStarts: boolean`; resolving it sets every switched-on pipeline project's start to the earliest (shifted) start among them | Makes C8's "align starts" a stored, testable input |
| C14 | `skillGap` takes an optional `stack` | Answers "enough Java in December?" without a new function |
| C15 | A worklog by a mapped person on an **unmapped key** counts in that person's actuals and in company logged hours as non-billable; project views show it under "Unmapped key MRD" | The person is known; only the project is not |
| C16 | Sample story: unassigned sprint issues are on Nova (stack from its Java demand line); Orbit starts 28 Sep; MRD is 14 h of pre-sales work replacing planned hours | Rule in §3.5 needs a demand line; burn needs Orbit's full history inside the window |
| C17 | Unstaffed demand lines on **internal** projects count like signed ones | Internal work is a commitment; the Add project form allows internal lines |
| C18 | Sprint hours per person and project are an absolute weekly figure (estimate ÷ sprint weeks), not pro-rated | Estimates are already in hours for that sprint |
| C19 | Manual allocations apply to future weeks only; a manual allocation may already be in `seed.json` (Dóra on Orbit, 36 h/week, 9 Nov–14 Dec) | Admins entered it before this export; past weeks are the plan of record |

---

## 1. Conventions

| Item | Rule |
|---|---|
| Today | Fixed: **Mon 2 Nov 2026** (ISO week 2026-W45). Weeks before it show actuals; this week and later show plan. |
| Week | ISO week, Monday to Sunday, keyed by its **Monday date** (`weekStart`, `YYYY-MM-DD`). Avoids the 2026 week-53 trap (28 Dec–3 Jan). |
| Window | **Past: 5 weeks**, 28 Sep–1 Nov 2026 (W40–W44). **Future: 12 weeks**, 2 Nov 2026–24 Jan 2027 (W45–2027-W03, last week starts 18 Jan). "In 4 weeks" = week of **30 Nov**. |
| Hours | Decimal hours, 0.25 precision in the UI. Jira stores seconds; importers convert. |
| FTE | **1 FTE = 8 h × working days in that week.** A normal week = 40 h; Christmas week (3 days) = 24 h. |
| Pro-rating | A weekly rate (allocation or demand) applies in full to a 5-day week and is scaled by `workingDays / 5` otherwise. |
| Dates | ISO `YYYY-MM-DD` everywhere except the deliberately messy HR CSV (§6). |
| Money | EUR, whole euros [assumption]. Only used for `costPerHour` and burn cost. |
| Encoding | UTF-8 (Hungarian names). CSV: comma separated, header row, double-quote escaping. |

### Hungarian calendar inside the window (built into the app)
Source: NGM decree 10/2025 (IV. 30.) on the 2026 working schedule, checked 1 Nov 2026.

| Date | Day | Type | Effect |
|---|---|---|---|
| 23 Oct 2026 | Fri | Public holiday (1956 Revolution) | W43 has 4 working days |
| 1 Nov 2026 | Sun | Public holiday (All Saints) | none (weekend) |
| 12 Dec 2026 | Sat | **Working Saturday** (swap for 24 Dec) | W50 has **6** working days |
| 24 Dec 2026 | Thu | Bridge rest day | |
| 25 Dec 2026 | Fri | Public holiday (Christmas) | W52 has 3 working days |
| 26 Dec 2026 | Sat | Public holiday | none (weekend) |
| 1 Jan 2027 | Fri | Public holiday (New Year) | W53 has 4 working days |

[assumption] No 2027 bridge days fall inside the window. Re-check the 2027 decree before relying on it beyond January.

---

## 2. Files

All sample files ship in `public/data/` and load at start, in the order listed in `manifest.json` (C12). Each has an `exportedAt` timestamp; per source, the newest is shown as "last sync" (Jira, HR).

| # | File | Source | Shape | Count |
|---|---|---|---|---|
| 0 | `manifest.json` | Generated with the files | JSON | 1 |
| 1 | `hr/people.csv` | HR system, manual export | CSV | 1 |
| 2 | `hr/absences.csv` | HR system, manual export | CSV | 1 |
| 3 | `jira/worklogs_2026-W40.json` … `W44.json` | Jira, API-shaped | JSON | 5 |
| 4 | `jira/sprint_next.json` | Jira, API-shaped | JSON | 1 |
| 5 | `app/seed.json` | What admins have already entered in the app (projects, stacks, allocations, maps, settings) | JSON | 1 |

Removed in v2: `crm/deals.json`, `charters/*.json` (C1, C2). The generator is `scripts/generate_sample_data.py`; it also writes `fixtures/answer_key.json`.

Uploads: a newer file of type 1–4 (e.g. next week's Jira export) can be uploaded, parsed in the browser and merged by key (§5). Not persisted beyond the session [assumption; known limitation]. [suggestion] Build last; cut first if time runs out.

---

## 3. Entities and fields

### 3.1 Person — from HR (`hr/people.csv`), enriched in Admin

| Field | Type | Source | Notes |
|---|---|---|---|
| `email` | string | HR | **Key.** Lower-cased on import. |
| `full_name` | string | HR | |
| `job_title` | string | HR | Display only. |
| `weekly_hours` | number | HR | Contract hours (40, 32, 20…). Blank → 40, flagged (F7). |
| `start_date` | date | HR | Before it: 0 available hours (joiner). |
| `end_date` | date \| blank | HR | After it: 0 hours. Blank = open-ended. |
| `employment_type` | `employee` \| `contractor` | HR | Display and filter only. |
| `stacks` | Stack[] (≥ 1) | App (Admin) | All stacks the person can work in. |
| `mainStack` | Stack | App (Admin) | Exactly one, must be in `stacks`. Drives supply (§4). Shown first, dark tag. |
| `costPerHour` | number (EUR) | App (Admin) | Manual, loaded cost, not salary. Used for burn cost only. |

### 3.2 Stack — fixed list in the app [suggestion]

| Group | Stacks |
|---|---|
| Backend | Java, .NET, Node.js |
| Frontend | React, Angular |
| Mobile | Flutter, Native |
| QA | QA |
| DevOps | DevOps |
| UX/UI | UX/UI |
| Delivery | Delivery (PM/BA) |

Single-stack groups show the group name only. The list is editable in a later version, not in the prototype.

### 3.3 Absence — from HR (`hr/absences.csv`)

| Field | Type | Notes |
|---|---|---|
| `email` | string | FK → Person. Unknown email → row skipped, flagged. |
| `type` | `holiday` \| `sick` | |
| `start_date`, `end_date` | date | Inclusive, full days [assumption: no half days]. |

Only absence days that are employed **working days** reduce capacity; a holiday on a public holiday is not deducted twice (F6).

### 3.4 Worklog (actuals) — from Jira (`jira/worklogs_*.json`)

```json
{ "exportedAt": "...", "weekStart": "2026-10-05",
  "worklogs": [ { "id": "10442", "issueKey": "NOVA-212",
     "projectKey": "NOVA", "labels": ["BE"],
     "author": { "accountId": "712020:...", "displayName": "Kovács Anna" },
     "started": "2026-10-06T09:00:00.000+0200", "timeSpentSeconds": 14400 } ] }
```

| Field | Notes |
|---|---|
| `id` | **Key.** Re-importing a week replaces worklogs with the same id. |
| `author.accountId` | → email via `JiraAccountMap` (§3.8). |
| `projectKey` | → `projectId` via `JiraProjectMap` (§3.8). |
| `labels` | Kept for display. Actual hours are counted against the person's **main stack** [suggestion: no report in the design splits actuals by stack, so label parsing is not needed]. |
| `started` | Date part decides the week. |
| `timeSpentSeconds` | ÷ 3600 → hours. |

### 3.5 Sprint (near-term plan) — from Jira (`jira/sprint_next.json`)

| Field | Notes |
|---|---|
| `sprint.id`, `name`, `startDate`, `endDate` | Sprint **SPR-31**, Mon 2 Nov – Fri 13 Nov (W45–W46) [assumption: two-week sprints]. |
| `issues[].key`, `projectKey` | As in worklogs. |
| `issues[].assignee.accountId` | → email. **Unassigned issue = unstaffed demand** on that project, in the stack of the project's demand lines when they have exactly one stack, else flagged and not counted [assumption]. |
| `issues[].timeoriginalestimate` | Seconds. Spread evenly over the sprint weeks (half W45, half W46), as an absolute weekly figure (C18). Missing → 0 h, flagged (F5). |

### 3.6 Project — from `app/seed.json` and Admin

| Field | Type | Notes |
|---|---|---|
| `projectId` | string | **Key**, e.g. `PRJ-NOVA`, `P-1`. |
| `name`, `client` | string | Client blank for internal. |
| `type` | `signed` \| `pipeline` \| `internal` | **Stored**, chosen in Admin (Type dropdown). Billable = `signed`. |
| `origin` | `jira` \| `manual` | `jira` = created by converting a Jira project key; `manual` = Add project form. Display only. |
| `startDate` | date | Signed/internal: from the Jira conversion row. Pipeline: entered. |
| `endDate` | date \| null | Signed: entered at conversion. Internal: null = ongoing. Pipeline: `startDate + durationWeeks`. |
| `durationWeeks` | number | Pipeline only. |
| `winChancePct` | number \| null | **Pipeline only, optional.** Display only; null shown as "not set" (F4). No weighted forecast (cut). |
| `hourBudget` | number \| null | Optional. Burn % only when set (C7). |
| `demand[]` | `{stack, fte, fromWeek?, toWeek?, email?}` | One line per stack need. **No email = unstaffed.** `fromWeek`/`toWeek` default to project dates; a stack needed in two bursts gets two lines (Tamas, design review). |

**Mark as signed** (pipeline → signed): `type` becomes `signed`, `winChancePct` is cleared, named demand lines become allocations, unnamed lines stay as unstaffed demand. Jira actuals attach once a Jira key is mapped to the project.

### 3.7 Allocation — from `app/seed.json`, sprint, and manual edits

| Field | Type | Notes |
|---|---|---|
| `email` | string | FK → Person. |
| `projectId` | string | FK → Project (signed or internal). |
| `hoursPerWeek` | number | Rate for a 5-day week; pro-rated (§1). |
| `fromWeek`, `toWeek` | weekStart | Inclusive range. |
| `source` | `seed` \| `sprint` \| `manual` | Shown in the person panel. |

Seed allocations also cover the **past 5 weeks** (plan of record, needed for plan vs actual). Manual assignment of a person to a signed project in Admin creates an allocation with `source: manual`; manual allocations apply to future weeks only (C19).

**Precedence per person, project and week:** `manual` override > `sprint` (W45–W46) > `seed`.

### 3.8 Mapping tables (Admin)

| Table | Columns | Why |
|---|---|---|
| `JiraAccountMap` | `accountId` → `email` | Jira does not export emails reliably [assumption]. |
| `JiraProjectMap` | `jiraProjectKey` → `projectId` | Conversion table in Admin; one project may have several keys. An unmapped key is F2. |

[suggestion] Read-only in the prototype with unmapped rows flagged; editing one row (the MRD key) is the stretch goal.

### 3.9 Settings (Admin, read-only in the prototype [suggestion])

| Setting | Value |
|---|---|
| `overloadPct` | 100 (over = load > 100%) |
| `idlePct` | 50 (idle = load ≤ 50%) [suggestion] |
| `availableMinHours` | 8 (free ≥ 8 h in a week = "available") [suggestion] |
| `billableTargetPct` | 80, share of logged time [assumption: no target was given] |
| `spareMinFte` | 0.2 (smaller spare is not shown in the skill matrix) [suggestion] |

---

## 4. Calculation rules (implemented once, in `src/core`, tested)

For person *p*, week *w*, scenario *sc*:

| Measure | Formula |
|---|---|
| `workingDays(w)` | Mon–Fri minus public holidays and bridge days, plus working Saturdays (§1). |
| `employedDays(p,w)` | Working days in *w* between `start_date` and `end_date`. |
| `absenceDays(p,w)` | Absence days in *w* that are also employed working days. |
| `availableHours(p,w)` | `weekly_hours / 5 × (employedDays − absenceDays)`. |
| `plannedHours(p,w,sc)` | Allocations (after precedence) pro-rated + named demand lines of pipeline projects switched on in *sc*, pro-rated. |
| `load%(p,w,sc)` | `plannedHours / availableHours`. Available = 0 and planned > 0 → "planned while away", flagged. |
| `freeHours(p,w,sc)` | `max(0, availableHours − plannedHours)`. |
| `actualHours(p,w)` | Sum of worklogs whose author is mapped, whatever the project key (C15). Past weeks only. |
| `drift(p or project, w)` | `actualHours − plannedHours` (plan of record, baseline scenario). Past weeks only. |
| `unlogged(p,w)` | `availableHours − actualHours`. Shown on Reports. |
| `fteHours(w)` | `8 × workingDays(w)`. |
| `demandFte(s,w,sc)` | Unstaffed demand in stack *s*: signed and internal demand lines with no email (C17) + unassigned sprint estimates + (if on) pipeline lines with no email, each ÷ `fteHours(w)`. Future weeks only. |
| `supplyFte(s,w,sc)` | Free hours of people whose **main stack** is *s*, ÷ `fteHours(w)` (§8 item 1). |
| `balance(s,w,sc)` | `supplyFte − demandFte`. **Negative = shortage, positive = spare.** Spare below `spareMinFte` shown as 0. |
| `billable` | Two numbers, both labelled: **share of logged time** = hours on `signed` projects ÷ all logged hours; **utilisation** = hours on `signed` projects ÷ available hours. Unmapped-key hours count as non-billable; unmapped-person hours count on their project. |
| `burn(project)` | Actual hours to date; × `costPerHour`; % of `hourBudget` if set; remaining planned hours to `endDate`; remaining unstaffed demand hours; forecast = all three. |

**Scenario** = `{ projects: {projectId: {on: bool, startShiftWeeks: int}}, alignStarts?: bool }`. Default: all pipeline **off** (baseline = signed + internal). Shifting moves `startDate` and every demand line's `fromWeek`/`toWeek` by the same number of weeks. **Align starts** sets every switched-on pipeline project's start to the earliest start among them (C13). Pipeline demand counts only from today onwards. Every function takes the scenario as an input, so pages and Ask always show the same numbers.

---

## 5. Import and override rules

1. On start, read `manifest.json`, load the files it lists from `public/data/`, run importers, collect data issues.
2. An upload of the same file type merges by key: worklogs by `id`, people by `email`, absences by (`email`, `start_date`, `type`), sprint by `sprint.id`.
3. **Overrides** (projects added or edited, allocations, Mark as signed, Admin fields, scenario) live in `localStorage` as a separate layer, applied after imports, so a re-import never wipes planning edits. **Reset** clears the layer.
4. Data issues are listed on Home: severity (`error` = row skipped, `warning` = default applied, `info` = handled silently), source file, row/id, rule applied, and a link to where it is fixed (Admin) when there is one.

---

## 6. Seeded flaws and expected handling

| # | Flaw (file) | Handling | Severity |
|---|---|---|---|
| F1 | Jira author not in HR or account map (worklogs) | Hours kept on the project (burn stays correct) under "Unmapped person"; excluded from people views; flagged. | warning |
| F2 | Unmapped Jira project key `MRD` (worklogs) | Hours kept under "Unmapped key MRD", **non-billable** until converted; flagged with a link to the Admin conversion table. | warning |
| F3 | Worklog with no FE/BE label (worklogs) | No effect (actuals use the main stack); counted as info. | info |
| F4 | Pipeline project with no win chance (seed) | Shown as "not set", still switchable. | info |
| F5 | Sprint issue with no estimate (sprint) | Counted as 0 h; flagged so the planned load is not trusted blindly. | warning |
| F6 | Absence overlapping a public holiday (absences) | Holiday day not deducted twice. | info |
| F7 | Blank `weekly_hours` (people CSV) | Default 40; flagged so HR can fix the source. | warning |
| F8 | Mixed date format (people CSV): `2026.12.01.` or `01/12/2026` | Accepts ISO, `YYYY.MM.DD.` and `DD/MM/YYYY`; non-ISO rows flagged; unparseable → row skipped. | warning / error |

Expected results for each flaw are in `answer_key.json` (`flaws`, `dataIssues`).

---

## 7. How the brief's five questions are answered

| Brief question | Function | Computation | Where in the UI |
|---|---|---|---|
| Who will be available in 4 weeks? | `freeCapacity(week, stack?, sc)` | `freeHours(p, 30 Nov)` per person, sorted; people with ≥ `availableMinHours`; shown in FTE and hours. | Home tile; Plan People grid, column 30 Nov; Ask |
| What happens if two pipeline projects start at the same time? | `scenarioImpact(sc)` | Both on, starts aligned; **delta vs baseline**: people newly over 100% (first week, peak), stacks with a new or larger shortage (first week, peak FTE). | Home tile; Plan pipeline card (switches, shift, align starts, change chips); Ask |
| Which skill will we run short of? | `skillGap(fromWeek, toWeek, sc, stack?)` | `balance(s,w)` per stack and week; stacks with any shortage, first week and peak FTE; spare shown too. | Home tile; Plan skill matrix; Ask |
| Who is over 100%, and who is idle? | `loadByPerson(fromWeek, toWeek, sc)` | `load%` per person and week; over > `overloadPct`, idle ≤ `idlePct`. | Home tile and table; Plan People grid; Ask |
| How much of our time went to billable work? | `billableSplit(fromWeek, toWeek, groupBy)` | Both definitions (§4), by company, person or project, against `billableTargetPct`. | Home tile; Reports gauge and tables; Ask |

Further functions (cover "similar" questions): `planVsActual(fromWeek, toWeek, groupBy)` (drift by person or project; Reports tables, Plan past cells), `projectBurn(projectId)` (Reports, project panel).

### Ask page rule
Claude only chooses a function and its arguments, then phrases the result; it never calculates. Each answer shows: the conclusion, the numbers table returned by the function, the function name and arguments (including the scenario), and the **data read** (source files and row counts, e.g. "Jira worklogs W40–W44, 605 rows"). No database and no SQL (decision in the planning chat). An answer is stored when given and does not change if the scenario changes later. Questions outside the data (salaries, performance, reasons for absence) get "I can't answer that from this data".

---

## 8. Decisions

Decided by Tamas, 1 Nov 2026, 22:10:
1. **Supply counts the main stack only.** Secondary stacks are shown as tags, not counted. The canvas's "cover from a secondary stack" logic is not built.
2. **Ask:** two Claude calls per question (choose the function, then write the conclusion from its result). One question and one answer at a time, no chat thread.
3. **Scope:** everything on the canvas is built, except the Gantt tab in Plan (cut; People is the main Plan view) and the Ask thread. Per-line demand dates are editable as on the canvas.
4. The canvas is not updated; the build plan lists where the build differs from it (Gantt, SQL → data read, align starts, past weeks shown by default).

Decided by Tamas, 1 Nov 2026, 22:29: the sample data and the changes C12–C19.

Still open, defaults applied unless Tamas changes them:
5. Optional `hourBudget` on projects (C7) [suggestion].
6. Worklog labels ignored for actuals (§3.4) [suggestion].
7. Settings read-only, as on the canvas; Jira conversion table editable for unmapped keys, as on the canvas.
8. Billable target 80% [assumption].
9. EUR, one currency; pipeline off by default; idle ≤ 50%; available ≥ 8 h (unchanged from v1).
