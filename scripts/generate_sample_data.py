#!/usr/bin/env python3
"""
Task 01 (capacity planning): sample data generator and answer key.

Writes the sample files of DATA_CONTRACT v2 §2 into public/data/ and the
expected results into fixtures/answer_key.json. Deterministic: same output on
every run (fixed seed, no clock reads).

Two halves:
  1. GENERATE: the fictional agency (canvas cast and story) written as messy
     source exports, with the seeded flaws F1-F8.
  2. REFERENCE: re-reads those files the way the app must (contract §3-§6) and
     computes every expected number. The TypeScript in src/core is tested
     against this output, so the two implementations check each other.

All names, companies and e-mail addresses are fictional.

Usage:  python3 scripts/generate_sample_data.py [--root <repo root>]
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import random
import re
from datetime import date, datetime, timedelta
from pathlib import Path

D = date.fromisoformat
SEED = 20261102

# --------------------------------------------------------------------------
# Calendar (contract §1)
# --------------------------------------------------------------------------
TODAY = D("2026-11-02")
WINDOW_START = D("2026-09-28")          # W40, first past week
N_WEEKS = 17                            # 5 past + 12 future
WEEKS = [WINDOW_START + timedelta(weeks=i) for i in range(N_WEEKS)]
PAST = [w for w in WEEKS if w < TODAY]  # W40-W44
FUTURE = [w for w in WEEKS if w >= TODAY]  # W45-2027-W03
IN_4_WEEKS = D("2026-11-30")
SPRINT_WEEKS = [D("2026-11-02"), D("2026-11-09")]

# NGM decree 10/2025 (IV. 30.), as recorded in the contract
NON_WORKING = {
    D("2026-10-23"): "Public holiday (1956 Revolution)",
    D("2026-11-01"): "Public holiday (All Saints)",
    D("2026-12-24"): "Bridge rest day",
    D("2026-12-25"): "Public holiday (Christmas)",
    D("2026-12-26"): "Public holiday",
    D("2027-01-01"): "Public holiday (New Year)",
}
WORKING_SATURDAYS = {D("2026-12-12"): "Working Saturday (swap for 24 Dec)"}


def is_working_day(d: date) -> bool:
    if d in WORKING_SATURDAYS:
        return True
    if d.weekday() >= 5:
        return False
    return d not in NON_WORKING


def week_dates(ws: date) -> list[date]:
    return [ws + timedelta(days=i) for i in range(7)]


def working_dates(ws: date) -> list[date]:
    return [d for d in week_dates(ws) if is_working_day(d)]


def working_days(ws: date) -> int:
    return len(working_dates(ws))


def fte_hours(ws: date) -> float:
    return 8.0 * working_days(ws)


def iso_week(ws: date) -> str:
    y, w, _ = ws.isocalendar()
    return f"{y}-W{w:02d}"


def week_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def wk(i: int) -> date:
    """Week index on the canvas (0 = 28 Sep) to weekStart."""
    return WINDOW_START + timedelta(weeks=i)


# --------------------------------------------------------------------------
# 1. GENERATE
# --------------------------------------------------------------------------
DOMAIN = "agency.example"  # fictional agency domain

STACK_GROUPS = [
    ("Backend", ["Java", ".NET", "Node.js"]),
    ("Frontend", ["React", "Angular"]),
    ("Mobile", ["Flutter", "Native"]),
    ("QA", ["QA"]),
    ("DevOps", ["DevOps"]),
    ("UX/UI", ["UX/UI"]),
    ("Delivery", ["Delivery"]),
]
STACK_GROUP = {s: g for g, ss in STACK_GROUPS for s in ss}
ALL_STACKS = [s for _, ss in STACK_GROUPS for s in ss]
LABEL_FOR_GROUP = {"Backend": "BE", "Frontend": "FE", "Mobile": "MOB", "QA": "QA",
                   "DevOps": "OPS", "UX/UI": "UX", "Delivery": "PM"}

# Projects. Jira key -> app projectId (Admin conversion table).
PROJECTS = {
    "PRJ-NOVA": dict(name="Nova banking app", client="Lumen Bank", type="signed", origin="jira",
                     startDate="2026-07-27", endDate="2027-02-26", hourBudget=None,
                     demand=[dict(stack="Java", fte=0.5, fromWeek="2026-11-30", toWeek="2027-02-22")]),
    "PRJ-HELIX": dict(name="Helix claims portal", client="Pannon Insurance", type="signed", origin="jira",
                      startDate="2026-08-24", endDate="2026-12-11", hourBudget=None, demand=[]),
    "PRJ-ORBIT": dict(name="Orbit e-shop", client="Tisza Home", type="signed", origin="jira",
                      startDate="2026-09-28", endDate="2027-01-22", hourBudget=1300,
                      demand=[dict(stack="QA", fte=0.25, fromWeek="2026-12-14", toWeek="2027-01-18")]),
    "INT-LEDGERLY": dict(name="Ledgerly", client="", type="internal", origin="jira",
                         startDate="2025-01-06", endDate=None, hourBudget=None, demand=[]),
    "INT-PULSE": dict(name="Pulse", client="", type="internal", origin="jira",
                      startDate="2025-01-06", endDate=None, hourBudget=None, demand=[]),
    "INT-OPS": dict(name="Delivery ops", client="", type="internal", origin="jira",
                    startDate="2025-01-06", endDate=None, hourBudget=None, demand=[]),
}
JIRA_KEY = {"PRJ-NOVA": "NOVA", "PRJ-HELIX": "HELIX", "PRJ-ORBIT": "ORB",
            "INT-LEDGERLY": "LDG", "INT-PULSE": "PLS", "INT-OPS": "OPS"}
SHORT = {"NOVA": "PRJ-NOVA", "HELIX": "PRJ-HELIX", "ORBIT": "PRJ-ORBIT",
         "LEDG": "INT-LEDGERLY", "PULSE": "INT-PULSE", "OPS": "INT-OPS"}

# Pipeline projects (entered by hand in Admin). Lines: (stack, fte, person key or None, from offset, to offset or None)
PIPELINE = [
    dict(projectId="P-1", name="Fintech customer portal", client="Meridian Pay", start=9, dur=10, win=50,
         lines=[("Java", 0.5, "anna", 0, None), ("Java", 1.0, None, 0, None), ("React", 1.0, None, 0, None),
                ("UX/UI", 0.5, None, 0, 3)]),
    dict(projectId="P-2", name="Loyalty app", client="Kestrel Retail", start=10, dur=8, win=75,
         lines=[("Flutter", 1.0, "marton", 0, None), ("Node.js", 0.5, None, 0, None), ("QA", 0.5, None, 0, None)]),
    dict(projectId="P-3", name="Fleet dashboard", client="Northway Logistics", start=14, dur=6, win=None,  # F4
         lines=[("Angular", 1.0, None, 0, None), ("DevOps", 0.25, None, 0, None)]),
    dict(projectId="P-4", name="Nova phase 2", client="Lumen Bank", start=13, dur=10, win=25,
         lines=[("Java", 1.0, None, 0, None), ("React", 0.5, None, 4, None)]),
]

# People: canvas cast. alloc = (project short, h/week, from idx, to idx); drift = actual - plan, past weeks.
PEOPLE = [
    dict(key="anna", name="Kovács Anna", title="Senior Backend Developer", hours="40", start="2021-03-01", end="",
         type="employee", stacks=["Java", "DevOps"], cost=48,
         alloc=[("NOVA", 32, 0, 16), ("LEDG", 8, 0, 16)], drift=[2, -4, 0, 6, -2]),
    dict(key="bence", name="Tóth Bence", title="Backend Developer", hours="40", start="2022-09-05", end="",
         type="employee", stacks=["Java", "Node.js"], cost=38,
         alloc=[("HELIX", 24, 0, 10), ("PULSE", 8, 0, 16)], drift=[0, 1, -9, 3, -5]),  # W42: 2 sick days, not in plan
    dict(key="dora", name="Szabó Dóra", title="Backend Developer (contractor)", hours="32", start="2025-09-01",
         end="31/01/2027", type="contractor", stacks=[".NET", "Java"], cost=55,          # F8 DD/MM/YYYY
         alloc=[("ORBIT", 32, 0, 16)], drift=[-2, 0, -6, 0, 1]),
    dict(key="mate", name="Fekete Máté", title="Backend Developer", hours="40", start="2023-02-13", end="",
         type="employee", stacks=["Node.js", "React"], cost=40,
         alloc=[("PULSE", 24, 0, 16), ("LEDG", 8, 0, 16)], drift=[3, -2, 0, 1, 2]),
    dict(key="eszter", name="Nagy Eszter", title="Senior Frontend Developer", hours="40", start="2020-06-01", end="",
         type="employee", stacks=["React", "UX/UI"], cost=46,
         alloc=[("NOVA", 24, 0, 16), ("ORBIT", 16, 0, 16)], drift=[4, 2, 0, -1, 3]),
    dict(key="lili", name="Horváth Lili", title="Frontend Developer", hours="40", start="2026.11.16.", end="",
         type="employee", stacks=["React"], cost=34,                                    # F8 YYYY.MM.DD.
         alloc=[("LEDG", 16, 7, 16)], drift=[0, 0, 0, 0, 0]),
    dict(key="gergo", name="Varga Gergő", title="Frontend Developer", hours="40", start="2024-01-08", end="",
         type="employee", stacks=["Angular", "React"], cost=37,
         alloc=[("HELIX", 16, 0, 10), ("LEDG", 8, 0, 16)], drift=[-3, 0, 2, -2, 0]),
    dict(key="marton", name="Kiss Márton", title="Mobile Developer", hours="40", start="2022-04-04", end="",
         type="employee", stacks=["Flutter", "Native"], cost=42,
         alloc=[("PULSE", 20, 0, 16)], drift=[8, 6, 10, 4, 7]),  # Pulse runs over plan every week
    dict(key="petra", name="Molnár Petra", title="QA Engineer", hours="", start="2023-10-02", end="",  # F7 blank hours
         type="employee", stacks=["QA"], cost=33,
         alloc=[("NOVA", 16, 0, 16), ("HELIX", 16, 0, 10), ("ORBIT", 8, 0, 16)], drift=[0, -2, 1, 0, -4]),
    dict(key="zoltan", name="Farkas Zoltán", title="DevOps Engineer", hours="20", start="2024-05-06", end="",
         type="employee", stacks=["DevOps", "Java"], cost=52,
         alloc=[("NOVA", 8, 0, 16), ("HELIX", 6, 0, 10), ("ORBIT", 6, 0, 16)], drift=[1, 2, 0, 1, -1]),
    dict(key="reka", name="Balogh Réka", title="Product Designer", hours="40", start="2021-11-15", end="",
         type="employee", stacks=["UX/UI", "React"], cost=41,
         alloc=[("NOVA", 8, 0, 16), ("LEDG", 12, 0, 16), ("PULSE", 8, 0, 16)], drift=[-4, -6, -2, -3, -5]),
    dict(key="kinga", name="Papp Kinga", title="Delivery Lead", hours="40", start="2020-02-03", end="",
         type="employee", stacks=["Delivery", "QA"], cost=50,
         alloc=[("NOVA", 12, 0, 16), ("HELIX", 12, 0, 10), ("ORBIT", 12, 0, 16), ("OPS", 8, 0, 16)],
         drift=[2, 5, 3, 1, 4]),
]
# HR row that cannot be imported (F8, unparseable date -> error, row skipped)
BAD_HR_ROW = dict(name="Takács Ádám", email=f"adam.takacs@{DOMAIN}", title="Junior QA Engineer", hours="40",
                  start="Feb 2027", end="", type="employee")

ABSENCES = [  # (person key, type, start, end)  inclusive, full days
    ("bence", "sick", "2026-10-13", "2026-10-14"),
    ("gergo", "holiday", "2026-11-12", "2026-11-13"),
    ("anna", "holiday", "2026-11-23", "2026-11-27"),
    ("eszter", "holiday", "2026-12-21", "2026-12-25"),   # F6: overlaps 24 (bridge) and 25 Dec (holiday)
    ("petra", "holiday", "2026-12-28", "2026-12-29"),
]

# Manual override already entered in the app (seed.json, source "manual")
MANUAL_ALLOCS = [("dora", "ORBIT", 36, 6, 11)]

# Sprint SPR-31 (W45-W46): assigned estimates per person and project, hours over the whole sprint.
SPRINT_ASSIGNED = {
    ("anna", "NOVA"): [24, 24, 16],
    ("eszter", "NOVA"): [16, 16, 16], ("eszter", "ORBIT"): [16, 16],
    ("petra", "NOVA"): [16, 16], ("petra", "HELIX"): [16, 16], ("petra", "ORBIT"): [16],
    ("zoltan", "NOVA"): [8, 8], ("zoltan", "HELIX"): [12], ("zoltan", "ORBIT"): [12],
    ("reka", "NOVA"): [16],
    ("kinga", "NOVA"): [12, 12], ("kinga", "HELIX"): [12, 12], ("kinga", "ORBIT"): [12, 12],
    ("bence", "HELIX"): [16, 24, None],          # F5: one issue without an estimate
    ("gergo", "HELIX"): [16, 16, 8],             # 20 h/week: more than his 16 h seed rate
    ("dora", "ORBIT"): [32, 32],
}
SPRINT_UNASSIGNED = [("NOVA", 8), ("NOVA", 4)]  # Java (Nova's demand line stack)

UNMAPPED_ACCOUNT = "712020:9f3e7c41-5b2a-4d0e-9a61-3c8d2f4b7e19"   # F1
F1_LOGS = [("HELIX", "2026-10-20", 3.0), ("HELIX", "2026-10-21", 3.0)]
# F2: pre-sales work under an unconverted key; it replaces planned project hours that week (drift unchanged)
F2_LOGS = [("kinga", "2026-10-26", 2.0), ("kinga", "2026-10-27", 2.0), ("kinga", "2026-10-28", 2.0),
           ("kinga", "2026-10-29", 2.0), ("anna", "2026-10-27", 2.0), ("anna", "2026-10-28", 2.0),
           ("anna", "2026-10-29", 2.0)]  # MRD, 14 h
F3_UNLABELLED = 23

SUMMARIES = {
    "NOVA": ["Account overview: transaction filter", "Card freeze flow", "Login with device binding",
             "Statement PDF export", "Payee validation", "Push notification settings", "Savings goal widget",
             "Accessibility fixes on transfers", "Session timeout handling", "Regression pack update"],
    "HELIX": ["Claim intake form validation", "Document upload limits", "Adjuster dashboard filters",
              "Claim status e-mails", "Policy lookup API", "Fraud flag rules", "Audit log export"],
    "ORB": ["Checkout address autocomplete", "Product listing performance", "Basket sync", "Payment retry",
            "Promo code rules", "Stock alerts", "Order history page"],
    "LDG": ["Invoice import mapping", "Multi-currency ledger", "Onboarding checklist", "Pricing page"],
    "PLS": ["Survey builder drag and drop", "Mobile offline mode", "Team pulse charts", "Slack integration"],
    "OPS": ["Weekly staffing review", "Client status reports", "Estimation workshop"],
    "MRD": ["Discovery workshop prep", "Solution outline"],
}


def tz_offset(d: date) -> str:
    return "+0200" if d < D("2026-10-25") else "+0100"   # DST ends Sun 25 Oct 2026


def q(x: float) -> float:
    """Round to a quarter hour."""
    return round(x * 4) / 4


def generate(root: Path) -> dict:
    rng = random.Random(SEED)
    data = root / "public" / "data"
    for sub in ("hr", "jira", "app"):
        (data / sub).mkdir(parents=True, exist_ok=True)

    people = {p["key"]: p for p in PEOPLE}
    for p in PEOPLE:
        first_last = p["name"].split(" ")
        ascii_ = lambda s: s.lower().translate(str.maketrans("áéíóöőúüű", "aeiooouuu"))
        p["email"] = f"{ascii_(first_last[1])}.{ascii_(first_last[0])}@{DOMAIN}"
        p["accountId"] = "712020:" + "%08x-%04x-%04x-%04x-%012x" % (
            rng.getrandbits(32), rng.getrandbits(16), rng.getrandbits(16), rng.getrandbits(16), rng.getrandbits(48))
        p["weekly"] = float(p["hours"] or 40)
        p["start_d"] = D("2026-11-16") if p["key"] == "lili" else D(p["start"])
        p["end_d"] = D("2027-01-31") if p["key"] == "dora" else None

    # ---- hr/people.csv (data row numbers are 1-based, header excluded)
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["email", "full_name", "job_title", "weekly_hours", "start_date", "end_date", "employment_type"])
    for p in PEOPLE:
        w.writerow([p["email"], p["name"], p["title"], p["hours"], p["start"], p["end"], p["type"]])
    b = BAD_HR_ROW
    w.writerow([b["email"], b["name"], b["title"], b["hours"], b["start"], b["end"], b["type"]])
    (data / "hr" / "people.csv").write_text(buf.getvalue(), encoding="utf-8")

    # ---- hr/absences.csv
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["email", "type", "start_date", "end_date"])
    for key, typ, s, e in ABSENCES:
        w.writerow([people[key]["email"], typ, s, e])
    (data / "hr" / "absences.csv").write_text(buf.getvalue(), encoding="utf-8")

    absent = {p["key"]: set() for p in PEOPLE}
    for key, _, s, e in ABSENCES:
        d = D(s)
        while d <= D(e):
            absent[key].add(d)
            d += timedelta(days=1)

    # ---- jira/worklogs_<week>.json
    issue_no = {k: 100 + 37 * i for i, k in enumerate(SUMMARIES)}
    pools = {k: [f"{k}-{issue_no[k] + n}" for n in range(len(v))] for k, v in SUMMARIES.items()}
    worklogs_by_week: dict[date, list] = {w: [] for w in PAST}
    next_id = 10001

    def add_log(week: date, key: str, author: dict, day: date, hours: float, label: str | None):
        nonlocal next_id
        worklogs_by_week[week].append({
            "id": str(next_id), "issueKey": rng.choice(pools[key]), "projectKey": key,
            "labels": [label] if label else [],
            "author": author,
            "started": f"{day.isoformat()}T09:00:00.000{tz_offset(day)}",
            "timeSpentSeconds": int(round(hours * 3600)),
        })
        next_id += 1

    for p in PEOPLE:
        author = {"accountId": p["accountId"], "displayName": p["name"]}
        label = LABEL_FOR_GROUP[STACK_GROUP[p["stacks"][0]]]
        for i, week in enumerate(PAST):
            wd = working_days(week)
            plan = {SHORT[a[0]]: a[1] * wd / 5 for a in p["alloc"] if a[2] <= i <= a[3]}
            total_plan = sum(plan.values())
            if total_plan <= 0:
                continue
            mrd = sum(h for pk, d_, h in F2_LOGS if pk == p["key"] and week_of(D(d_)) == week)
            actual_total = total_plan + p["drift"][i] - mrd
            parts = {k: q(v * actual_total / total_plan) for k, v in plan.items()}
            biggest = max(parts, key=lambda k: parts[k])
            parts[biggest] = q(parts[biggest] + actual_total - sum(parts.values()))
            days = [d for d in working_dates(week) if d not in absent[p["key"]]]
            for pid, h in parts.items():
                if h <= 0:
                    continue
                per = q(h / len(days))
                for n, day in enumerate(days):
                    hh = per if n < len(days) - 1 else q(h - per * (len(days) - 1))
                    if hh > 0:
                        add_log(week, JIRA_KEY[pid], author, day, hh, label)

    # F1: author unknown to HR and to the account map
    for key, day, h in F1_LOGS:
        add_log(week_of(D(day)), key, {"accountId": UNMAPPED_ACCOUNT, "displayName": "j.wolf.ext"}, D(day), h, "BE")
    # F2: unmapped project key MRD (pre-sales work)
    for pk, day, h in F2_LOGS:
        p = people[pk]
        add_log(week_of(D(day)), "MRD", {"accountId": p["accountId"], "displayName": p["name"]}, D(day), h,
                LABEL_FOR_GROUP[STACK_GROUP[p["stacks"][0]]])
    # F3: strip labels from a fixed sample of worklogs
    all_logs = [l for week in PAST for l in worklogs_by_week[week]]
    for l in rng.sample(all_logs, F3_UNLABELLED):
        l["labels"] = []

    exported = {}
    for week in PAST:
        ts = f"{(week + timedelta(days=7)).isoformat()}T07:15:00+01:00"
        exported[f"jira/worklogs_{iso_week(week)}.json"] = ts
        logs = sorted(worklogs_by_week[week], key=lambda l: int(l["id"]))
        (data / "jira" / f"worklogs_{iso_week(week)}.json").write_text(
            json.dumps({"exportedAt": ts, "weekStart": week.isoformat(), "worklogs": logs},
                       ensure_ascii=False, indent=1), encoding="utf-8")

    # ---- jira/sprint_next.json
    issues = []
    counters = {k: 400 + 23 * i for i, k in enumerate(SUMMARIES)}

    def new_issue(key, assignee, est_h):
        counters[key] += 1
        issues.append({
            "key": f"{key}-{counters[key]}", "projectKey": key,
            "summary": rng.choice(SUMMARIES[key]),
            "assignee": assignee,
            "timeoriginalestimate": None if est_h is None else int(est_h * 3600),
        })

    for (pk, short), ests in SPRINT_ASSIGNED.items():
        p = people[pk]
        for est in ests:
            new_issue(JIRA_KEY[SHORT[short]], {"accountId": p["accountId"], "displayName": p["name"]}, est)
    for short, est in SPRINT_UNASSIGNED:
        new_issue(JIRA_KEY[SHORT[short]], None, est)
    sprint_ts = "2026-11-02T07:20:00+01:00"
    exported["jira/sprint_next.json"] = sprint_ts
    (data / "jira" / "sprint_next.json").write_text(json.dumps({
        "exportedAt": sprint_ts,
        "sprint": {"id": "SPR-31", "name": "SPR-31", "startDate": "2026-11-02", "endDate": "2026-11-13"},
        "issues": issues}, ensure_ascii=False, indent=1), encoding="utf-8")

    # ---- app/seed.json
    projects = []
    for pid, pr in PROJECTS.items():
        projects.append(dict(projectId=pid, name=pr["name"], client=pr["client"], type=pr["type"],
                             origin=pr["origin"], startDate=pr["startDate"], endDate=pr["endDate"],
                             durationWeeks=None, winChancePct=None, hourBudget=pr["hourBudget"],
                             demand=[dict(stack=d["stack"], fte=d["fte"], fromWeek=d["fromWeek"],
                                          toWeek=d["toWeek"], email=None) for d in pr["demand"]]))
    for pp in PIPELINE:
        start = wk(pp["start"])
        lines = []
        for stack, fte, who, o, e in pp["lines"]:
            lines.append(dict(stack=stack, fte=fte,
                              fromWeek=(start + timedelta(weeks=o)).isoformat() if o else None,
                              toWeek=(start + timedelta(weeks=e)).isoformat() if e is not None else None,
                              email=people[who]["email"] if who else None))
        projects.append(dict(projectId=pp["projectId"], name=pp["name"], client=pp["client"], type="pipeline",
                             origin="manual", startDate=start.isoformat(), endDate=None,
                             durationWeeks=pp["dur"], winChancePct=pp["win"], hourBudget=None, demand=lines))
    allocations = []
    for p in PEOPLE:
        for short, h, f, t in p["alloc"]:
            allocations.append(dict(email=p["email"], projectId=SHORT[short], hoursPerWeek=h,
                                    fromWeek=wk(f).isoformat(), toWeek=wk(t).isoformat(), source="seed"))
    for pk, short, h, f, t in MANUAL_ALLOCS:
        allocations.append(dict(email=people[pk]["email"], projectId=SHORT[short], hoursPerWeek=h,
                                fromWeek=wk(f).isoformat(), toWeek=wk(t).isoformat(), source="manual"))
    seed = {
        "savedAt": "2026-11-02T08:00:00+01:00",
        "settings": {"overloadPct": 100, "idlePct": 50, "availableMinHours": 8, "billableTargetPct": 80,
                     "spareMinFte": 0.2, "today": TODAY.isoformat()},
        "stacks": [{"group": g, "stacks": ss} for g, ss in STACK_GROUPS],
        "people": [dict(email=p["email"], stacks=p["stacks"], mainStack=p["stacks"][0], costPerHour=p["cost"])
                   for p in PEOPLE],
        "projects": projects,
        "allocations": allocations,
        "jiraAccountMap": [dict(accountId=p["accountId"], email=p["email"]) for p in PEOPLE],
        "jiraProjectMap": [dict(jiraProjectKey=JIRA_KEY[pid], projectId=pid) for pid in PROJECTS],
    }
    (data / "app" / "seed.json").write_text(json.dumps(seed, ensure_ascii=False, indent=1), encoding="utf-8")

    # ---- manifest.json: the browser cannot list a folder, so it reads this first
    manifest = {"files": (
        [{"path": "hr/people.csv", "source": "HR", "kind": "people", "exportedAt": "2026-11-02T06:45:00+01:00"},
         {"path": "hr/absences.csv", "source": "HR", "kind": "absences", "exportedAt": "2026-11-02T06:45:00+01:00"}]
        + [{"path": f"jira/worklogs_{iso_week(wk_)}.json", "source": "Jira", "kind": "worklogs",
            "exportedAt": exported[f"jira/worklogs_{iso_week(wk_)}.json"]} for wk_ in PAST]
        + [{"path": "jira/sprint_next.json", "source": "Jira", "kind": "sprint", "exportedAt": sprint_ts},
           {"path": "app/seed.json", "source": "App", "kind": "seed", "exportedAt": seed["savedAt"]}])}
    (data / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    return manifest


# --------------------------------------------------------------------------
# 2. REFERENCE: import the files and compute (contract §3-§7)
# --------------------------------------------------------------------------
class Issues:
    def __init__(self):
        self.items = []

    def add(self, sev, rule, file, row, text, fix=None):
        self.items.append(dict(severity=sev, rule=rule, file=file, row=row, text=text, fixIn=fix))


def parse_hr_date(s: str):
    """Returns (date|None, format) ; format in iso|dotted|slash|blank|bad."""
    s = (s or "").strip()
    if not s:
        return None, "blank"
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return D(s), "iso"
    m = re.fullmatch(r"(\d{4})\.(\d{2})\.(\d{2})\.?", s)
    if m:
        return date(int(m[1]), int(m[2]), int(m[3])), "dotted"
    m = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", s)
    if m:
        return date(int(m[3]), int(m[2]), int(m[1])), "slash"
    return None, "bad"


class Model:
    def __init__(self, root: Path):
        self.data = root / "public" / "data"
        self.issues = Issues()
        self.rows = {}
        man = json.loads((self.data / "manifest.json").read_text())
        self.manifest = man["files"]
        self.seed = json.loads((self.data / "app" / "seed.json").read_text())
        self.settings = self.seed["settings"]
        self._people()
        self._absences()
        self._projects()
        self._worklogs()
        self._sprint()

    # ---- importers
    def _people(self):
        f = "hr/people.csv"
        rows = list(csv.DictReader((self.data / f).read_text(encoding="utf-8").splitlines()))
        self.rows[f] = len(rows)
        enrich = {e["email"].lower(): e for e in self.seed["people"]}
        self.people = {}
        for n, r in enumerate(rows, start=1):
            email = r["email"].strip().lower()
            start, sf = parse_hr_date(r["start_date"])
            end, ef = parse_hr_date(r["end_date"])
            if sf in ("bad", "blank") or ef == "bad":
                bad = r["start_date"] if sf in ("bad", "blank") else r["end_date"]
                self.issues.add("error", "F8", f, n, f'Date "{bad}" cannot be read. Row skipped.')
                continue
            for raw, fmt in ((r["start_date"], sf), (r["end_date"], ef)):
                if fmt in ("dotted", "slash"):
                    parsed = start if raw == r["start_date"] else end
                    self.issues.add("warning", "F8", f, n, f'Date "{raw}" is not ISO. Read as {parsed.isoformat()}.')
            if not r["weekly_hours"].strip():
                hours = 40.0
                self.issues.add("warning", "F7", f, n, "Blank weekly hours. Used 40 h; fix in HR.")
            else:
                hours = float(r["weekly_hours"])
            e = enrich.get(email, {})
            self.people[email] = dict(email=email, name=r["full_name"], title=r["job_title"], weekly=hours,
                                      start=start, end=end, type=r["employment_type"],
                                      stacks=e.get("stacks", []), main=e.get("mainStack"),
                                      cost=e.get("costPerHour"), absent=set())

    def _absences(self):
        f = "hr/absences.csv"
        rows = list(csv.DictReader((self.data / f).read_text(encoding="utf-8").splitlines()))
        self.rows[f] = len(rows)
        for n, r in enumerate(rows, start=1):
            email = r["email"].strip().lower()
            if email not in self.people:
                self.issues.add("error", "absence-unknown-email", f, n, "Unknown e-mail. Row skipped.")
                continue
            p = self.people[email]
            d, end = D(r["start_date"]), D(r["end_date"])
            overlap = []
            while d <= end:
                if d.weekday() < 5 and d in NON_WORKING:
                    overlap.append(d.isoformat())
                p["absent"].add(d)
                d += timedelta(days=1)
            if overlap:
                self.issues.add("info", "F6", f, n,
                                f"Absence overlaps non-working day(s) {', '.join(overlap)}. Not deducted twice.")

    def _projects(self):
        self.projects = {p["projectId"]: p for p in self.seed["projects"]}
        self.key_map = {m["jiraProjectKey"]: m["projectId"] for m in self.seed["jiraProjectMap"]}
        self.acct_map = {m["accountId"]: m["email"].lower() for m in self.seed["jiraAccountMap"]}
        for p in self.projects.values():
            if p["type"] == "pipeline" and p["winChancePct"] is None:
                self.issues.add("info", "F4", "app/seed.json", p["projectId"],
                                f'Pipeline project "{p["name"]}" has no win chance. Shown as not set; still switchable.')

    def _worklogs(self):
        self.logs = []
        unmapped_person, unmapped_key, unlabelled = {}, {}, 0
        for m in self.manifest:
            if m["kind"] != "worklogs":
                continue
            js = json.loads((self.data / m["path"]).read_text(encoding="utf-8"))
            self.rows[m["path"]] = len(js["worklogs"])
            for l in js["worklogs"]:
                day = D(l["started"][:10])
                email = self.acct_map.get(l["author"]["accountId"])
                pid = self.key_map.get(l["projectKey"])
                h = l["timeSpentSeconds"] / 3600
                if not l["labels"]:
                    unlabelled += 1
                if email is None:
                    unmapped_person.setdefault((l["author"]["accountId"], m["path"]), []).append(h)
                if pid is None:
                    unmapped_key.setdefault((l["projectKey"], m["path"]), []).append(h)
                self.logs.append(dict(id=l["id"], week=week_of(day), email=email, projectId=pid,
                                      key=l["projectKey"], hours=h))
        for (acct, f), hs in unmapped_person.items():
            self.issues.add("warning", "F1", f, acct,
                            f'Jira author {acct[:12]}… is not in HR or the account map. {sum(hs):g} h kept on the '
                            f'project as "Unmapped person".', fix="Admin > People > Jira accounts")
        for (key, f), hs in unmapped_key.items():
            self.issues.add("warning", "F2", f, key,
                            f"Jira project key {key} is not mapped. {sum(hs):g} h counted as non-billable.",
                            fix="Admin > Projects > Jira conversion")
        self.issues.add("info", "F3", "jira/worklogs_*", None,
                        f"{unlabelled} worklogs have no FE/BE label. No effect: actuals use the main stack.")
        self.unlabelled = unlabelled

    def _sprint(self):
        f = "jira/sprint_next.json"
        js = json.loads((self.data / f).read_text(encoding="utf-8"))
        self.rows[f] = len(js["issues"])
        self.sprint = js["sprint"]
        weeks = [w for w in FUTURE if D(js["sprint"]["startDate"]) <= w <= D(js["sprint"]["endDate"])]
        self.sprint_weeks = weeks
        self.sprint_alloc = {}      # (email, projectId) -> h per sprint week
        self.sprint_unassigned = []  # (projectId, stack, h per sprint week, key)
        for it in js["issues"]:
            pid = self.key_map.get(it["projectKey"])
            est = it["timeoriginalestimate"]
            if est is None:
                self.issues.add("warning", "F5", f, it["key"],
                                f"Sprint issue {it['key']} has no estimate. Counted as 0 h; planned load may be low.")
                est = 0
            h = est / 3600 / len(weeks)
            if it["assignee"] is None:
                stacks = sorted({d["stack"] for d in self.projects[pid]["demand"]})
                if len(stacks) != 1:
                    self.issues.add("warning", "sprint-unassigned-stack", f, it["key"],
                                    "Unassigned issue but the project has no single demand stack. Not counted.")
                    continue
                self.sprint_unassigned.append((pid, stacks[0], h, it["key"]))
            else:
                email = self.acct_map.get(it["assignee"]["accountId"])
                self.sprint_alloc[(email, pid)] = self.sprint_alloc.get((email, pid), 0) + h

    # ---- per person and week
    def employed_dates(self, p, w):
        return [d for d in working_dates(w)
                if (p["start"] is None or d >= p["start"]) and (p["end"] is None or d <= p["end"])]

    def absence_days(self, p, w):
        return sum(1 for d in self.employed_dates(p, w) if d in p["absent"])

    def available(self, p, w):
        return p["weekly"] / 5 * (len(self.employed_dates(p, w)) - self.absence_days(p, w))

    def alloc_rows(self, email, w):
        """Plan of record per project after precedence manual > sprint > seed. Hours, pro-rated."""
        wd = working_days(w)
        rows = {}
        for a in self.seed["allocations"]:
            if a["email"] != email or not (D(a["fromWeek"]) <= w <= D(a["toWeek"])):
                continue
            if a["source"] == "seed":
                rows.setdefault(a["projectId"], {})["seed"] = a["hoursPerWeek"] * wd / 5
            elif a["source"] == "manual" and w >= TODAY:
                rows.setdefault(a["projectId"], {})["manual"] = a["hoursPerWeek"] * wd / 5
        if w in self.sprint_weeks:
            for (em, pid), h in self.sprint_alloc.items():
                if em == email:
                    rows.setdefault(pid, {})["sprint"] = h
        out = {}
        for pid, srcs in rows.items():
            for s in ("manual", "sprint", "seed"):
                if s in srcs:
                    out[pid] = (srcs[s], s)
                    break
        return out

    def resolve(self, sc):
        """Scenario -> {projectId: effective start date} for pipeline projects that are on."""
        sc = sc or {}
        on = {pid: cfg for pid, cfg in sc.get("projects", {}).items() if cfg.get("on")}
        starts = {pid: D(self.projects[pid]["startDate"]) + timedelta(weeks=cfg.get("startShiftWeeks", 0))
                  for pid, cfg in on.items()}
        if sc.get("alignStarts") and starts:
            first = min(starts.values())
            starts = {pid: first for pid in starts}
        return starts

    def pipe_lines(self, sc, w):
        """Active pipeline lines in week w: (projectId, line)."""
        if w < TODAY:
            return []
        out = []
        for pid, start in self.resolve(sc).items():
            p = self.projects[pid]
            shift = start - D(p["startDate"])
            last = start + timedelta(weeks=p["durationWeeks"] - 1)
            if not (start <= w <= last):
                continue
            for l in p["demand"]:
                f = D(l["fromWeek"]) + shift if l["fromWeek"] else start
                t = D(l["toWeek"]) + shift if l["toWeek"] else last
                if f <= w <= min(t, last):
                    out.append((pid, l))
        return out

    def planned_rows(self, email, w, sc=None):
        rows = {pid: h for pid, (h, _) in self.alloc_rows(email, w).items()}
        for pid, l in self.pipe_lines(sc, w):
            if l["email"] == email:
                rows[pid] = rows.get(pid, 0) + l["fte"] * fte_hours(w)
        return rows

    def planned(self, email, w, sc=None):
        return sum(self.planned_rows(email, w, sc).values())

    def load(self, email, w, sc=None):
        a, pl = self.available(self.people[email], w), self.planned(email, w, sc)
        if a == 0:
            return None if pl == 0 else "away"
        return pl / a * 100

    def free(self, email, w, sc=None):
        return max(0.0, self.available(self.people[email], w) - self.planned(email, w, sc))

    def actual(self, email, w):
        return sum(l["hours"] for l in self.logs if l["email"] == email and l["week"] == w)

    # ---- stacks
    def demand_parts(self, stack, w, sc=None):
        if w < TODAY:
            return []
        parts = []
        for p in self.projects.values():
            if p["type"] == "pipeline":
                continue
            for l in p["demand"]:
                if l["stack"] == stack and l["email"] is None and D(l["fromWeek"]) <= w <= D(l["toWeek"]):
                    parts.append((p["projectId"], "demand line", l["fte"] * fte_hours(w)))
        if w in self.sprint_weeks:
            for pid, st, h, key in self.sprint_unassigned:
                if st == stack:
                    parts.append((pid, f"sprint {key} unassigned", h))
        for pid, l in self.pipe_lines(sc, w):
            if l["stack"] == stack and l["email"] is None:
                parts.append((pid, "pipeline line", l["fte"] * fte_hours(w)))
        return parts

    def demand_fte(self, stack, w, sc=None):
        return sum(h for _, _, h in self.demand_parts(stack, w, sc)) / fte_hours(w)

    def supply_fte(self, stack, w, sc=None):
        return sum(self.free(e, w, sc) for e, p in self.people.items() if p["main"] == stack) / fte_hours(w)

    def balance(self, stack, w, sc=None):
        return self.supply_fte(stack, w, sc) - self.demand_fte(stack, w, sc)


# ---- the five questions and the further functions (contract §7)
R2 = lambda x: round(x + 0.0, 2)
R1 = lambda x: round(x + 0.0, 1)
EPS = 0.005


def weeks_between(a: str, b: str) -> list[date]:
    return [w for w in WEEKS if D(a) <= w <= D(b)]


def free_capacity(m: Model, week: str, stack=None, sc=None):
    w = D(week)
    rows = []
    for e, p in m.people.items():
        if stack and p["main"] != stack:
            continue
        fh = m.free(e, w, sc)
        if fh >= m.settings["availableMinHours"]:
            rows.append(dict(email=e, name=p["name"], mainStack=p["main"], freeHours=R2(fh),
                             freeFte=R2(fh / fte_hours(w)),
                             availableHours=R2(m.available(p, w)), plannedHours=R2(m.planned(e, w, sc))))
    rows.sort(key=lambda r: (-r["freeHours"], r["name"]))
    return dict(week=week, workingDays=working_days(w), people=rows,
                totalFreeHours=R2(sum(r["freeHours"] for r in rows)))


def load_by_person(m: Model, from_week: str, to_week: str, sc=None):
    over, idle, away, grid = [], [], [], {}
    for e, p in m.people.items():
        cells = {}
        ow, iw, aw = [], [], []
        for w in weeks_between(from_week, to_week):
            ld = m.load(e, w, sc)
            cells[w.isoformat()] = ld if ld in (None, "away") else R1(ld)
            if ld == "away":
                aw.append(w.isoformat())
            elif ld is None:
                continue
            elif ld > m.settings["overloadPct"] + EPS:
                ow.append((w.isoformat(), ld))
            elif ld <= m.settings["idlePct"] + EPS:
                iw.append((w.isoformat(), ld))
        grid[e] = cells
        if ow:
            over.append(dict(email=e, name=p["name"], weeks=[x for x, _ in ow], peakPct=R1(max(v for _, v in ow))))
        if iw:
            idle.append(dict(email=e, name=p["name"], weeks=[x for x, _ in iw], lowestPct=R1(min(v for _, v in iw))))
        if aw:
            away.append(dict(email=e, name=p["name"], weeks=aw))
    return dict(fromWeek=from_week, toWeek=to_week, over=over, idle=idle, plannedWhileAway=away, loadPct=grid)


def skill_gap(m: Model, from_week: str, to_week: str, sc=None, stack=None):
    shortages, spare, matrix = [], [], {}
    for s in ALL_STACKS:
        if stack and s != stack:
            continue
        cells, short_w, spare_w = {}, [], []
        for w in weeks_between(from_week, to_week):
            b = m.balance(s, w, sc)
            cells[w.isoformat()] = dict(supplyFte=R2(m.supply_fte(s, w, sc)), demandFte=R2(m.demand_fte(s, w, sc)),
                                        balanceFte=R2(b))
            if b < -EPS:
                short_w.append((w.isoformat(), -b))
            elif b >= m.settings["spareMinFte"] - EPS:
                spare_w.append((w.isoformat(), b))
        matrix[s] = cells
        if short_w:
            shortages.append(dict(stack=s, firstWeek=short_w[0][0], weeks=len(short_w),
                                  peakFte=R2(max(v for _, v in short_w)),
                                  shortWeeks=[x for x, _ in short_w]))
        if spare_w:
            spare.append(dict(stack=s, weeks=len(spare_w), maxSpareFte=R2(max(v for _, v in spare_w))))
    shortages.sort(key=lambda r: (r["firstWeek"], -r["peakFte"]))
    return dict(fromWeek=from_week, toWeek=to_week, shortages=shortages, spare=spare, matrix=matrix)


def scenario_impact(m: Model, sc, from_week="2026-11-02", to_week="2027-01-18"):
    resolved = {pid: d.isoformat() for pid, d in m.resolve(sc).items()}
    people = []
    for e, p in m.people.items():
        hits = []
        for w in weeks_between(from_week, to_week):
            ls, lb = m.load(e, w, sc), m.load(e, w, None)
            if isinstance(ls, float) and ls > m.settings["overloadPct"] + EPS and \
                    not (isinstance(lb, float) and lb > m.settings["overloadPct"] + EPS):
                hits.append((w.isoformat(), ls))
        if hits:
            people.append(dict(email=e, name=p["name"], firstWeek=hits[0][0], weeks=len(hits),
                               peakPct=R1(max(v for _, v in hits))))
    stacks = []
    base_short = {r["stack"]: r for r in skill_gap(m, from_week, to_week, None)["shortages"]}
    for s in ALL_STACKS:
        hits = []
        for w in weeks_between(from_week, to_week):
            bs, bb = m.balance(s, w, sc), m.balance(s, w, None)
            if bs < -EPS and bs < bb - EPS:
                hits.append((w.isoformat(), -bs))
        if hits:
            b = base_short.get(s)
            stacks.append(dict(stack=s, change="larger" if b else "new", firstWeek=hits[0][0], weeks=len(hits),
                               peakFte=R2(max(v for _, v in hits)), baselinePeakFte=b["peakFte"] if b else 0))
    return dict(scenario=sc, resolvedStarts=resolved, newlyOver=people, stackChanges=stacks)


def billable_split(m: Model, from_week: str, to_week: str, group_by="company"):
    weeks = weeks_between(from_week, to_week)
    logs = [l for l in m.logs if l["week"] in weeks]

    def is_bill(l):
        return l["projectId"] is not None and m.projects[l["projectId"]]["type"] == "signed"

    def summary(ls, avail):
        logged = sum(l["hours"] for l in ls)
        bill = sum(l["hours"] for l in ls if is_bill(l))
        return dict(loggedHours=R2(logged), billableHours=R2(bill),
                    shareOfLoggedPct=R1(bill / logged * 100) if logged else None,
                    availableHours=R2(avail) if avail is not None else None,
                    utilisationPct=R1(bill / avail * 100) if avail else None)

    total_avail = sum(m.available(p, w) for p in m.people.values() for w in weeks)
    out = dict(fromWeek=from_week, toWeek=to_week, groupBy=group_by,
               targetPct=m.settings["billableTargetPct"], company=summary(logs, total_avail))
    out["company"]["unmappedPersonHours"] = R2(sum(l["hours"] for l in logs if l["email"] is None))
    out["company"]["unmappedKeyHours"] = R2(sum(l["hours"] for l in logs if l["projectId"] is None))
    if group_by == "person":
        out["rows"] = [dict(email=e, name=p["name"],
                            **summary([l for l in logs if l["email"] == e], sum(m.available(p, w) for w in weeks)))
                       for e, p in m.people.items()]
    if group_by == "project":
        keys = sorted({l["projectId"] or f"UNMAPPED:{l['key']}" for l in logs})
        out["rows"] = [dict(projectId=k, billable=(not k.startswith("UNMAPPED")) and m.projects[k]["type"] == "signed",
                            loggedHours=R2(sum(l["hours"] for l in logs
                                               if (l["projectId"] or f"UNMAPPED:{l['key']}") == k)))
                       for k in keys]
    return out


def plan_vs_actual(m: Model, from_week: str, to_week: str, group_by="person"):
    weeks = [w for w in weeks_between(from_week, to_week) if w < TODAY]
    rows = []
    if group_by == "person":
        for e, p in m.people.items():
            pl = sum(m.planned(e, w) for w in weeks)
            ac = sum(m.actual(e, w) for w in weeks)
            av = sum(m.available(p, w) for w in weeks)
            rows.append(dict(email=e, name=p["name"], availableHours=R2(av), plannedHours=R2(pl),
                             actualHours=R2(ac), driftHours=R2(ac - pl), unloggedHours=R2(av - ac),
                             byWeek={w.isoformat(): dict(plan=R2(m.planned(e, w)), actual=R2(m.actual(e, w)))
                                     for w in weeks}))
    else:
        plan = {}
        for e in m.people:
            for w in weeks:
                for pid, h in m.planned_rows(e, w).items():
                    plan[pid] = plan.get(pid, 0) + h
        act = {}
        for l in m.logs:
            if l["week"] in weeks:
                k = l["projectId"] or f"UNMAPPED:{l['key']}"
                act[k] = act.get(k, 0) + l["hours"]
        for k in sorted(set(plan) | set(act)):
            pl, ac = plan.get(k, 0), act.get(k, 0)
            rows.append(dict(projectId=k, plannedHours=R2(pl), actualHours=R2(ac), driftHours=R2(ac - pl),
                             driftPct=R1((ac - pl) / pl * 100) if pl else None))
    return dict(fromWeek=from_week, toWeek=to_week, groupBy=group_by, rows=rows)


def project_burn(m: Model, project_id: str):
    p = m.projects[project_id]
    logs = [l for l in m.logs if l["projectId"] == project_id]
    hours = sum(l["hours"] for l in logs)
    cost = sum(l["hours"] * (m.people[l["email"]]["cost"] if l["email"] else 0) for l in logs)
    no_cost = sum(l["hours"] for l in logs if l["email"] is None)
    end = D(p["endDate"]) if p["endDate"] else WEEKS[-1]
    future = [w for w in FUTURE if w <= end]
    remaining = sum(m.alloc_rows(e, w).get(project_id, (0, ""))[0] for e in m.people for w in future)
    unstaffed = sum(h for s in ALL_STACKS for w in future for pid, _, h in m.demand_parts(s, w) if pid == project_id)
    budget = p["hourBudget"]
    return dict(projectId=project_id, name=p["name"], actualHoursToDate=R2(hours), actualCostEur=round(cost),
                hoursWithoutCost=R2(no_cost), hourBudget=budget,
                budgetUsedPct=R1(hours / budget * 100) if budget else None,
                remainingPlannedHours=R2(remaining), remainingUnstaffedHours=R2(unstaffed),
                forecastHours=R2(hours + remaining + unstaffed),
                forecastVsBudgetPct=R1((hours + remaining + unstaffed) / budget * 100) if budget else None,
                endDate=p["endDate"], note="Actuals start at the window (28 Sep); Orbit started that week.")


# --------------------------------------------------------------------------
def build_answer_key(root: Path) -> dict:
    m = Model(root)
    pair = {"projects": {"P-1": {"on": True, "startShiftWeeks": 0}, "P-2": {"on": True, "startShiftWeeks": 0}},
            "alignStarts": True}
    pair_unaligned = {"projects": {"P-1": {"on": True, "startShiftWeeks": 0},
                                   "P-2": {"on": True, "startShiftWeeks": 0}}}
    nova2 = {"projects": {"P-4": {"on": True, "startShiftWeeks": 0}}}
    F_FROM, F_TO = "2026-11-02", "2027-01-18"
    P_FROM, P_TO = "2026-09-28", "2026-10-26"
    N_FROM, N_TO = "2026-11-02", "2026-11-30"

    emails = list(m.people)
    key = {
        "meta": {
            "generatedBy": "scripts/generate_sample_data.py", "seed": SEED, "today": TODAY.isoformat(),
            "window": {"past": [P_FROM, P_TO], "future": [F_FROM, F_TO]},
            "rounding": "hours and FTE to 2 decimals, percentages to 1 decimal; tests compare with ±0.01 / ±0.1",
            "scenarios": {"baseline": None, "pairAligned": pair, "pairUnaligned": pair_unaligned, "nova2": nova2},
            "rowsRead": m.rows,
        },
        "calendar": [dict(weekStart=w.isoformat(), isoWeek=iso_week(w), workingDays=working_days(w),
                          fteHours=fte_hours(w), phase="actual" if w < TODAY else "plan") for w in WEEKS],
        "people": [dict(email=e, name=p["name"], weeklyHours=p["weekly"], start=p["start"].isoformat(),
                        end=p["end"].isoformat() if p["end"] else None, mainStack=p["main"], stacks=p["stacks"])
                   for e, p in m.people.items()],
        "matrices": {
            "availableHours": {e: [R2(m.available(m.people[e], w)) for w in WEEKS] for e in emails},
            "plannedHoursBaseline": {e: [R2(m.planned(e, w)) for w in WEEKS] for e in emails},
            "plannedHoursPairAligned": {e: [R2(m.planned(e, w, pair)) for w in WEEKS] for e in emails},
            "actualHours": {e: [R2(m.actual(e, w)) for w in PAST] for e in emails},
            "planSource": {e: [{pid: s for pid, (_, s) in m.alloc_rows(e, w).items()} for w in FUTURE[:3]]
                           for e in emails},
        },
        "questions": {
            "q1_whoIsAvailableIn4Weeks": {
                "function": "freeCapacity",
                "baseline": {"args": {"week": "2026-11-30"}, "result": free_capacity(m, "2026-11-30")},
                "pairAligned": {"args": {"week": "2026-11-30", "scenario": pair},
                                "result": free_capacity(m, "2026-11-30", sc=pair)},
            },
            "q2_twoPipelineProjectsAtOnce": {
                "function": "scenarioImpact",
                "pairAligned": {"args": {"scenario": pair}, "result": scenario_impact(m, pair)},
                "pairUnaligned": {"args": {"scenario": pair_unaligned}, "result": scenario_impact(m, pair_unaligned)},
            },
            "q3_skillShortage": {
                "function": "skillGap",
                "baseline": {"args": {"fromWeek": F_FROM, "toWeek": F_TO}, "result": skill_gap(m, F_FROM, F_TO)},
                "pairAligned": {"args": {"fromWeek": F_FROM, "toWeek": F_TO, "scenario": pair},
                                "result": skill_gap(m, F_FROM, F_TO, pair)},
            },
            "q4_overAndIdle": {
                "function": "loadByPerson",
                "baseline": {"args": {"fromWeek": N_FROM, "toWeek": N_TO}, "result": load_by_person(m, N_FROM, N_TO)},
                "pairAligned": {"args": {"fromWeek": N_FROM, "toWeek": N_TO, "scenario": pair},
                                "result": load_by_person(m, N_FROM, N_TO, pair)},
            },
            "q5_billableShare": {
                "function": "billableSplit",
                "note": "Actuals only, so the scenario has no effect.",
                "company": {"args": {"fromWeek": P_FROM, "toWeek": P_TO, "groupBy": "company"},
                            "result": billable_split(m, P_FROM, P_TO, "company")},
                "person": {"args": {"fromWeek": P_FROM, "toWeek": P_TO, "groupBy": "person"},
                           "result": billable_split(m, P_FROM, P_TO, "person")},
                "project": {"args": {"fromWeek": P_FROM, "toWeek": P_TO, "groupBy": "project"},
                            "result": billable_split(m, P_FROM, P_TO, "project")},
            },
        },
        "planVsActual": {
            "person": plan_vs_actual(m, P_FROM, P_TO, "person"),
            "project": plan_vs_actual(m, P_FROM, P_TO, "project"),
        },
        "projectBurn": project_burn(m, "PRJ-ORBIT"),
        "dataIssues": m.issues.items,
    }

    # Flaw summary: one entry per seeded flaw with the number a test can assert.
    bs = billable_split(m, P_FROM, P_TO, "company")["company"]
    key["flaws"] = {
        "F1": {"expect": "6 h on PRJ-HELIX by an unknown Jira author; in project burn and company totals, "
                         "not in any person row", "unmappedPersonHours": bs["unmappedPersonHours"],
               "countedBillable": True},
        "F2": {"expect": "14 h on key MRD; non-billable until converted", "unmappedKeyHours": bs["unmappedKeyHours"]},
        "F3": {"expect": "info only, no effect on numbers", "unlabelledWorklogs": m.unlabelled},
        "F4": {"expect": "P-3 Fleet dashboard win chance null, shown as not set, still switchable",
               "projectId": "P-3"},
        "F5": {"expect": "issue counted as 0 h; Bence's Helix sprint rate is 20 h/week, not his 24 h seed rate",
               "personEmail": f"bence.toth@{DOMAIN}", "projectId": "PRJ-HELIX",
               "sprintHoursPerWeek": R2(m.sprint_alloc[(f"bence.toth@{DOMAIN}", "PRJ-HELIX")])},
        "F6": {"expect": "Eszter's 21-25 Dec holiday deducts 3 days, not 5",
               "absenceDaysW52": m.absence_days(m.people[f"eszter.nagy@{DOMAIN}"], D("2026-12-21")),
               "availableHoursW52": m.available(m.people[f"eszter.nagy@{DOMAIN}"], D("2026-12-21"))},
        "F7": {"expect": "Petra's blank weekly hours read as 40, warning", "row": 9,
               "weeklyHours": m.people[f"petra.molnar@{DOMAIN}"]["weekly"]},
        "F8": {"expect": "2026.11.16. and 31/01/2027 read with a warning; 'Feb 2027' row skipped (error)",
               "liliStart": m.people[f"lili.horvath@{DOMAIN}"]["start"].isoformat(),
               "doraEnd": m.people[f"dora.szabo@{DOMAIN}"]["end"].isoformat(),
               "skippedRow": 13, "peopleImported": len(m.people)},
    }

    # Ask tests: question -> expected function and arguments (null function = out of scope)
    key["askTests"] = [
        {"q": "Who will be available in 4 weeks?", "function": "freeCapacity", "args": {"week": "2026-11-30"}},
        {"q": "Which React developers have free time in the week of 7 December?", "function": "freeCapacity",
         "args": {"week": "2026-12-07", "stack": "React"}},
        {"q": "What happens if the Fintech customer portal and the Loyalty app start at the same time?",
         "function": "scenarioImpact", "args": {"scenario": pair}},
        {"q": "If we win Nova phase 2, who goes over 100%?", "function": "scenarioImpact",
         "args": {"scenario": nova2}},
        {"q": "Which skill will we run short of?", "function": "skillGap",
         "args": {"fromWeek": F_FROM, "toWeek": F_TO}},
        {"q": "Do we have enough Java developers in December?", "function": "skillGap",
         "args": {"fromWeek": "2026-11-30", "toWeek": "2026-12-28", "stack": "Java"}},
        {"q": "Who is over 100%, and who is idle?", "function": "loadByPerson",
         "args": {"fromWeek": N_FROM, "toWeek": N_TO}},
        {"q": "Is anyone overbooked over Christmas?", "function": "loadByPerson",
         "args": {"fromWeek": "2026-12-21", "toWeek": "2026-12-28"}},
        {"q": "How much of our time went to billable work?", "function": "billableSplit",
         "args": {"fromWeek": P_FROM, "toWeek": P_TO, "groupBy": "company"}},
        {"q": "What was Kiss Márton's billable share over the last 5 weeks?", "function": "billableSplit",
         "args": {"fromWeek": P_FROM, "toWeek": P_TO, "groupBy": "person"}},
        {"q": "Which project drifted most from plan in the last 5 weeks?", "function": "planVsActual",
         "args": {"fromWeek": P_FROM, "toWeek": P_TO, "groupBy": "project"}},
        {"q": "Who logged less time than planned recently?", "function": "planVsActual",
         "args": {"fromWeek": P_FROM, "toWeek": P_TO, "groupBy": "person"}},
        {"q": "How much of the Orbit e-shop budget have we used?", "function": "projectBurn",
         "args": {"projectId": "PRJ-ORBIT"}},
        {"q": "What are our developers' salaries?", "function": None, "args": None},
        {"q": "Why was Tóth Bence off in October?", "function": None, "args": None},
    ]
    key["extra"] = {
        "scenarioImpactNova2": scenario_impact(m, nova2),
        "freeCapacityReact7Dec": free_capacity(m, "2026-12-07", stack="React"),
        "skillGapJavaDecember": skill_gap(m, "2026-11-30", "2026-12-28", stack="Java"),
        "loadChristmas": load_by_person(m, "2026-12-21", "2026-12-28"),
    }
    return key


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=str(Path(__file__).resolve().parent.parent))
    root = Path(ap.parse_args().root)
    generate(root)
    key = build_answer_key(root)
    (root / "fixtures").mkdir(exist_ok=True)
    (root / "fixtures" / "answer_key.json").write_text(
        json.dumps(key, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print("wrote public/data/ and fixtures/answer_key.json")


if __name__ == "__main__":
    main()
