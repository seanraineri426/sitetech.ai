#!/usr/bin/env python3
"""Independent cross-check for compute.py (different method: integer working-day indices + fixpoint relaxation).

1. Proves fixture.json is self-consistent: re-derives early dates (forward pass from the data date) and late dates +
   total float (backward pass from the completion activity; open ends take the project finish) and compares every field.
2. Re-implements the slip propagation and compares every scenario number with expected.json (written by compute.py).
Exit 1 on any difference.
"""
import json, os, sys, datetime as dt
HERE = os.path.dirname(os.path.abspath(__file__))
F = json.load(open(os.path.join(HERE, "fixture.json"))); E = json.load(open(os.path.join(HERE, "expected.json")))
cal = F["calendars"][0]; HOL = {dt.date.fromisoformat(h) for h in cal["holidays"]}; WD = set(cal["work_days"])
DD = dt.date.fromisoformat(F["schedule_snapshot"]["data_date"]); HPD = F["schedule_snapshot"]["hours_per_day"]
COMP = F["schedule_snapshot"]["completion_activity_id"]
# working-day index: idx 0 = data date; idx k>0 = k-th working day after it; negative going back
days = {}; d = DD; k = 0
while d <= dt.date(2027, 12, 31):
    d += dt.timedelta(1)
    if d.isoweekday() in WD and d not in HOL: k += 1; days[k] = d
d = DD; k = 0
while d >= dt.date(2026, 1, 1):
    d -= dt.timedelta(1)
    if d.isoweekday() in WD and d not in HOL: k -= 1; days[k] = d
days[0] = DD; IDX = {v: k for k, v in days.items()}
I = lambda s: IDX[dt.date.fromisoformat(s)]
fails = []
def eq(what, a, b):
    if a != b: fails.append(f"{what}: {a!r} != {b!r}")

A = {a["id"]: a for a in F["activities"]}; R = F["relationships"]
# ---- 1. fixture self-consistency
for a in A.values():
    for f in ("early_start", "early_finish", "late_start", "late_finish", "actual_start"):
        if a.get(f): eq(f"{a['id']} {f} is a working day", dt.date.fromisoformat(a[f]) in IDX, True)
    eq(f"{a['id']} float hours->days", a["total_float_hr_cnt"] / HPD, a["total_float_days"])
    eq(f"{a['id']} remaining duration = ES..EF", I(a["early_finish"]) - I(a["early_start"]) + 1, a["remaining_duration_days"])
    eq(f"{a['id']} late span", I(a["late_finish"]) - I(a["late_start"]) + 1, a["remaining_duration_days"])
    if a["status"] == "in_progress":
        eq(f"{a['id']} original = actual start..EF", I(a["early_finish"]) - I(a["actual_start"]) + 1, a["original_duration_days"])
        eq(f"{a['id']} remaining counted from data date", I(a["early_finish"]), a["remaining_duration_days"])
    else:
        eq(f"{a['id']} original = remaining", a["original_duration_days"], a["remaining_duration_days"])
        eq(f"{a['id']} not started after data date", I(a["early_start"]) > 0, True)
dur = {k: a["remaining_duration_days"] for k, a in A.items()}
es = {k: 1 for k in A}
for _ in range(len(A) + 1):  # forward pass by relaxation
    for r in R:
        p, s, L = r["predecessor_id"], r["successor_id"], r["lag_hours"] // HPD
        ef_p = es[p] + dur[p] - 1
        need = {"FS": ef_p + 1 + L, "SS": es[p] + L, "FF": ef_p + L - dur[s] + 1, "SF": ef_p + 1 + L}[r["type"]]
        es[s] = max(es[s], need)
for k in A: eq(f"{k} early start (forward pass)", days[es[k]].isoformat(), A[k]["early_start"]); eq(f"{k} early finish", days[es[k] + dur[k] - 1].isoformat(), A[k]["early_finish"])
pf = es[COMP] + dur[COMP] - 1; lf = {k: pf for k in A}
for _ in range(len(A) + 1):  # backward pass from the completion activity
    for r in R:
        p, s, L = r["predecessor_id"], r["successor_id"], r["lag_hours"] // HPD
        ls_s = lf[s] - dur[s] + 1
        lim = {"FS": ls_s - 1 - L, "SS": ls_s - L + dur[p] - 1, "FF": lf[s] - L, "SF": ls_s - 1 - L}[r["type"]]
        lf[p] = min(lf[p], lim)
for k in A:
    eq(f"{k} late finish (backward pass)", days[lf[k]].isoformat(), A[k]["late_finish"])
    eq(f"{k} late start", days[lf[k] - dur[k] + 1].isoformat(), A[k]["late_start"])
    eq(f"{k} total float = LF-EF", lf[k] - (es[k] + dur[k] - 1), A[k]["total_float_days"])
eq("completion activity has zero float", A[COMP]["total_float_days"], 0)

# ---- 2. independent propagation
def bday(s, n):
    d = dt.date.fromisoformat(s)
    while n:
        d += dt.timedelta(1); n -= (d.weekday() < 5 and d not in HOL)
    return d.isoformat()
for sc, ex in zip(F["scenarios"], E["scenarios"]):
    sid = sc["id"]; eq(f"{sid} id", sc["id"], ex["id"])
    ov = sc.get("override", {}); types = {(r["predecessor_id"], r["successor_id"]): r["type"] for r in R}
    for k2, t in ov.get("relationship_type", {}).items(): types[tuple(k2.split("->"))] = t
    x, n = sc["activity_id"], sc["slip_working_days"]
    S0 = {k: I(a["early_start"]) for k, a in A.items()}; F0 = {k: I(a["early_finish"]) for k, a in A.items()}
    S1, F1 = dict(S0), dict(F0)
    if sc["mode"] == "shift": S1[x] += n; F1[x] += n
    else: F1[x] += n
    moved = {x}
    for _ in range(len(A) + 1):
        for r in R:
            p, s, L = r["predecessor_id"], r["successor_id"], r["lag_hours"] // HPD
            if s == x or p not in moved: continue
            # requirement from ALL predecessors of s
            reqs = []
            for r2 in R:
                if r2["successor_id"] != s: continue
                q, L2, t = r2["predecessor_id"], r2["lag_hours"] // HPD, types[(r2["predecessor_id"], s)]
                reqs.append({"FS": F1[q] + 1 + L2, "SF": F1[q] + 1 + L2, "SS": S1[q] + L2, "FF": F1[q] + L2 - dur[s] + 1}[t])
            st = max(reqs); st = max(st, S0[s]) if n >= 0 else max(st, 1)
            if st != S1[s]: S1[s] = st; F1[s] = st + dur[s] - 1; moved.add(s)
    got = {}
    for k in A:
        delay = F1[k] - F0[k]
        if k != x and delay == 0 and S1[k] == S0[k]: continue
        tf = A[k]["total_float_days"]
        got[k] = {"new_start": days[S1[k]].isoformat(), "new_finish": days[F1[k]].isoformat(), "propagated_delay_wd": delay,
                  "resulting_float_days": tf - delay, "float_consumed_days": min(delay, tf) if delay > 0 else 0, "on_critical_path": tf - delay <= 0}
    exp = {a["id"]: a for a in [ex["primary"]] + ex["successors"]}
    eq(f"{sid} impacted set", sorted(got), sorted(exp))
    for k in got:
        for f, v in got[k].items(): eq(f"{sid} {k} {f}", v, exp.get(k, {}).get(f))
    wd = F1[COMP] - F0[COMP]; cd = (days[F1[COMP]] - days[F0[COMP]]).days
    eq(f"{sid} completion wd", wd, ex["completion"]["slip_working_days"]); eq(f"{sid} completion cd", cd, ex["completion"]["slip_calendar_days"])
    eq(f"{sid} completion new finish", days[F1[COMP]].isoformat(), ex["completion"]["new_finish"])
    cost = ov.get("daily_delay_cost_usd", F["project"]["daily_delay_cost_usd"]) if "daily_delay_cost_usd" in ov else F["project"]["daily_delay_cost_usd"]
    usd = None if (n < 0 or cost is None) else max(cd, 0) * cost
    eq(f"{sid} $", usd, ex["dollars"]["dollar_impact"])
    np_ = F["notice_periods"][0]
    want = [] if wd <= 0 else [(bday(sc["event_date"], np_["days"]), bday(sc["event_date"], np_["days"]) < F["as_of"])]
    eq(f"{sid} notices", want, [(x2["deadline"], x2["passed"]) for x2 in ex["notices"]])
    eq(f"{sid} SF flag", any(t == "SF" for t in types.values()), bool(ex["flags"]))
eq("date fact Nov 18 + 10 wd", days[IDX[dt.date(2026, 11, 18)] + 10].isoformat(), E["date_facts"]["Nov 18 + 10 working days"])
print(f"fixture checks + {len(F['scenarios'])} scenarios: " + ("ALL MATCH" if not fails else f"{len(fails)} MISMATCHES"))
for f in fails: print("  ", f)
sys.exit(1 if fails else 0)
