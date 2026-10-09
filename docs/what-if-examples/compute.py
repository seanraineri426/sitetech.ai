#!/usr/bin/env python3
"""SiteTech what-if reference computation (docs/what-if-math.md).

Usage:
  python3 compute.py            print every number the doc cites; if expected.json exists, compare and exit 1 on mismatch
  python3 compute.py --write    also (re)write expected.json

Rules implemented (the doc must state the same ones):
  * Counting rule: day 1 is the first working day AFTER the start date; the start date itself is not counted.
    Activity dates are inclusive (a 4-day activity starting Mon Nov 9 finishes Thu Nov 12).
  * No CPM recalculation. Early/late dates and total float come from the P6 snapshot as given. A slip is pushed
    forward through every successor of the slipped activity:
        FS+lag: successor start >= predecessor finish + (1 + lag) working days
        SS+lag: successor start >= predecessor start + lag working days
        FF+lag: successor finish >= predecessor finish + lag working days (start back-calculated from remaining duration)
        SF    : treated as FS and flagged "SF relationship detected, check in P6"
    Lags are hours / hours_per_day, counted on the SUCCESSOR's calendar. With several predecessors the latest
    (driving) requirement wins. For a slip an activity never moves earlier than its P6 date; for an acceleration
    successors move earlier only as far as all their predecessors allow (and not before the data date).
  * Slip modes: "shift" = a not-started activity starts N working days later (start and finish move);
    "extend" = finish moves N working days (start fixed; in-progress = remaining duration from the data date grows).
    Negative N = acceleration.
  * Propagated delay of an activity = working days its early finish moved. Resulting float = P6 total float - delay
    (no clamp; negative means it now drives completion late). Float consumed = min(delay, P6 float) for delay > 0.
  * Completion slip = working days the completion activity's early finish moved. Calendar days = calendar-date
    difference between the old and new completion finish. $ = calendar days x daily delay cost (calendar-day unit).
    No $ when delay cost is not set; acceleration reports days recovered only (no $ savings).
  * Notice deadline (only when completion slips) = event date + notice period in business days (skip weekends and
    project holidays; same counting rule). Passed if deadline < as_of.
"""
import json, os, sys, copy
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = os.path.join(HERE, "fixture.json")
EXPECTED = os.path.join(HERE, "expected.json")

D = date.fromisoformat
def fmt(d): return d.isoformat() if d else None
def short(d): return d.strftime("%b %-d") if d else "-"

class Cal:
    def __init__(self, c):
        self.work = set(c["work_days"]); self.hol = {D(h) for h in c["holidays"]}
    def is_work(self, d): return d.isoweekday() in self.work and d not in self.hol
    def add(self, d, n):
        """Move n working days from d (day 1 = first working day after d). n=0 returns d."""
        step = 1 if n > 0 else -1
        while n:
            d += timedelta(days=step)
            if self.is_work(d): n -= step
        return d
    def diff(self, a, b):
        """Signed working days from a to b (count of working days in (a, b])."""
        if b == a: return 0
        lo, hi, s = (a, b, 1) if b > a else (b, a, -1)
        n, d = 0, lo
        while d < hi:
            d += timedelta(days=1); n += self.is_work(d)
        return s * n
    def span(self, a, b):  # inclusive working days a..b
        return self.diff(a, b) + (1 if self.is_work(a) else 0)

def business_add(d, n, holidays):
    while n:
        d += timedelta(days=1)
        if d.weekday() < 5 and d not in holidays: n -= 1
    return d

def topo(acts, rels):
    indeg = {a: 0 for a in acts}; succ = {a: [] for a in acts}
    for r in rels: indeg[r["successor_id"]] += 1; succ[r["predecessor_id"]].append(r["successor_id"])
    q = [a for a in acts if indeg[a] == 0]; out = []
    while q:
        a = q.pop(0); out.append(a)
        for s in succ[a]:
            indeg[s] -= 1
            if indeg[s] == 0: q.append(s)
    if len(out) != len(acts): raise ValueError("relationship loop")
    return out

def run(F, sc):
    F = copy.deepcopy(F); ov = sc.get("override", {}); flags = []
    for k, t in ov.get("relationship_type", {}).items():
        p, s = k.split("->")
        for r in F["relationships"]:
            if r["predecessor_id"] == p and r["successor_id"] == s: r["type"] = t
    proj = F["project"]; snap = F["schedule_snapshot"]
    cost = ov["daily_delay_cost_usd"] if "daily_delay_cost_usd" in ov else proj.get("daily_delay_cost_usd")
    cals = {c["id"]: Cal(c) for c in F["calendars"]}
    A = {a["id"]: a for a in F["activities"]}; hpd = snap["hours_per_day"]; dd = D(snap["data_date"])
    cal = lambda aid: cals[A[aid]["calendar_id"]]
    ES = {k: D(a["early_start"]) for k, a in A.items()}; EF = {k: D(a["early_finish"]) for k, a in A.items()}
    nES, nEF = dict(ES), dict(EF); changed = set(); driving = {}
    x, n, mode = sc["activity_id"], sc["slip_working_days"], sc["mode"]
    c = cal(x)
    if mode == "shift":
        if A[x]["status"] != "not_started": raise ValueError("shift mode needs a not-started activity; use extend")
        nES[x] = c.add(ES[x], n); nEF[x] = c.add(EF[x], n)
    elif mode == "extend":
        nEF[x] = c.add(EF[x], n)
        if nEF[x] < nES[x]: raise ValueError("acceleration longer than remaining duration")
    else: raise ValueError(mode)
    changed.add(x); accel = n < 0
    preds = {}
    for r in F["relationships"]: preds.setdefault(r["successor_id"], []).append(r)
    for s in topo(list(A), F["relationships"]):
        if s == x or not any(r["predecessor_id"] in changed for r in preds.get(s, [])): continue
        cs = cal(s); dur = cs.span(ES[s], EF[s]); started = A[s]["status"] != "not_started"
        best_start, best_finish, best_by = None, None, None
        for r in preds[s]:
            p = r["predecessor_id"]; lag = r["lag_hours"] / hpd
            if lag != int(lag): raise ValueError("fractional-day lag not supported in reference")
            lag = int(lag); t = r["type"]; label = f"{p} {r['type']}{'+%d' % lag if lag else ''}"
            if t == "SF": flags.append(f"SF relationship detected ({p}->{s}), check in P6"); t = "FS"
            if started:                                   # in progress: start is fixed; only FF can move the finish
                if t == "FF":
                    fin = cs.add(nEF[p], lag)
                    if best_finish is None or fin > best_finish: best_finish, best_by = fin, label
                continue
            if t == "FS": st = cs.add(nEF[p], 1 + lag)
            elif t == "SS": st = cs.add(nES[p], lag)
            else: st = cs.add(cs.add(nEF[p], lag), -(dur - 1))   # FF: finish requirement, start back-calculated
            if best_start is None or st > best_start: best_start, best_by = st, label
        if started:
            if best_finish is None: continue
            nEF[s] = max(EF[s], best_finish) if not accel else max(best_finish, cs.add(dd, dur))
        else:
            floor_ = ES[s] if not accel else cs.add(dd, 1)   # slips never pull earlier than P6; accelerations stop at the data date
            nES[s] = max(best_start, floor_); nEF[s] = cs.add(nES[s], dur - 1)
            if best_start < floor_: best_by = "own P6 date" if not accel else "data date"
        driving[s] = best_by
        if nES[s] != ES[s] or nEF[s] != EF[s]: changed.add(s)
    acts = []
    for k in A:
        if k not in changed and k != x: continue
        delay = cal(k).diff(EF[k], nEF[k]); tf = A[k]["total_float_days"]; res = tf - delay
        acts.append({"id": k, "name": A[k]["name"], "original_start": fmt(ES[k]), "original_finish": fmt(EF[k]),
                     "new_start": fmt(nES[k]), "new_finish": fmt(nEF[k]), "propagated_delay_wd": delay,
                     "p6_total_float_days": tf, "float_consumed_days": max(0, min(delay, tf)) if delay > 0 else 0,
                     "resulting_float_days": res, "on_critical_path": res <= 0, "driven_by": driving.get(k, "scenario input")})
    primary = acts.pop(next(i for i, a in enumerate(acts) if a["id"] == x))
    acts.sort(key=lambda a: (not a["on_critical_path"], a["resulting_float_days"], a["id"]))
    comp = snap["completion_activity_id"]; cc = cal(comp)
    slip_wd = cc.diff(EF[comp], nEF[comp]); slip_cd = (nEF[comp] - EF[comp]).days
    if accel: dollars, note = None, "acceleration: days recovered reported, no $ savings computed"
    elif cost is None: dollars, note = None, "Set delay cost in settings to see $ impact"
    elif slip_cd <= 0: dollars, note = 0, "slip absorbed by float"
    else:
        if proj["delay_cost_unit"] != "calendar_day": raise ValueError("reference fixture uses calendar_day")
        dollars, note = slip_cd * cost, f"{slip_cd} calendar days x ${cost:,}/calendar day"
    notices = []
    if slip_wd > 0:
        hol = set().union(*(c.hol for c in cals.values()))
        for npd in F["notice_periods"]:
            if npd["notice_type"] != "delay_time_extension": continue
            ev = D(sc["event_date"])
            dl = business_add(ev, npd["days"], hol) if npd["day_basis"] == "business" else ev + timedelta(days=npd["days"])
            passed = dl < D(F["as_of"])
            text = (f"Deadline per project settings was {short(dl)}; confirm with PX" if passed else
                    f"If this happens: notice period per settings is {npd['days']} {npd['day_basis']} days (\u00a7{npd['contract_section']}), deadline {short(dl)}. Confirm with PX.")
            notices.append({"notice_type": npd["notice_type"], "event_date": sc["event_date"], "notice_period_days": npd["days"],
                            "day_basis": npd["day_basis"], "deadline": fmt(dl), "passed": passed, "card_text": text})
    return {"id": sc["id"], "title": sc["title"], "intent": sc["intent"],
            "input": {k: sc[k] for k in ("activity_id", "mode", "slip_working_days", "event_date")} | ({"override": ov} if ov else {}),
            "primary": primary, "successors": acts,
            "completion": {"activity_id": comp, "original_finish": fmt(EF[comp]), "new_finish": fmt(nEF[comp]),
                           "slip_working_days": slip_wd, "slip_calendar_days": slip_cd},
            "dollars": {"daily_delay_cost_usd": cost, "unit": proj["delay_cost_unit"], "dollar_impact": dollars, "note": note},
            "notices": notices, "flags": sorted(set(flags)), "estimate_label": "estimate, confirm in P6"}

def show(r):
    p = r["primary"]; c = r["completion"]; d = r["dollars"]
    print(f"\n{r['id']}: {r['title']}\n  intent: {r['intent']}\n  input: {r['input']}")
    for a in [p] + r["successors"]:
        print(f"  {a['id']:6s} {a['name'][:34]:34s} {short(D(a['original_start']))}-{short(D(a['original_finish']))} -> "
              f"{short(D(a['new_start']))}-{short(D(a['new_finish']))}  delay {a['propagated_delay_wd']:+d} wd  TF {a['p6_total_float_days']}"
              f" -> {a['resulting_float_days']:+d}  consumed {a['float_consumed_days']}  {'CRITICAL' if a['on_critical_path'] else ''}  [{a['driven_by']}]")
    print(f"  completion {c['activity_id']}: {short(D(c['original_finish']))} -> {short(D(c['new_finish']))} = "
          f"{c['slip_working_days']:+d} working days = {c['slip_calendar_days']:+d} calendar days")
    print(f"  $: {d['dollar_impact'] if d['dollar_impact'] is None else '$%s' % format(d['dollar_impact'], ',')}  ({d['note']})")
    for nt in r["notices"]: print(f"  notice: event {nt['event_date']} + {nt['notice_period_days']} {nt['day_basis']} days = {nt['deadline']} passed={nt['passed']} | {nt['card_text']}")
    for f in r["flags"]: print(f"  flag: {f}")

def main():
    F = json.load(open(FIXTURE))
    snap = F["schedule_snapshot"]; cal = Cal(F["calendars"][0])
    print("SiteTech what-if reference | data date", snap["data_date"], "| as of", F["as_of"], "| completion", snap["completion_activity_id"],
          "| delay cost $%s/%s" % (format(F["project"]["daily_delay_cost_usd"], ","), F["project"]["delay_cost_unit"]))
    print("Holidays:", ", ".join(F["calendars"][0]["holidays"]))
    for a in F["activities"]:
        print(f"  {a['id']} {a['name']}: ES {a['early_start']} EF {a['early_finish']} LS {a['late_start']} LF {a['late_finish']} "
              f"TF {a['total_float_days']}d ({a['total_float_hr_cnt']}h/{snap['hours_per_day']}) {a['status']}")
    for r in F["relationships"]: print(f"  {r['predecessor_id']} -> {r['successor_id']} {r['type']} lag {r['lag_hours']}h = {r['lag_hours']//snap['hours_per_day']}d")
    results = [run(F, sc) for sc in F["scenarios"]]
    for r in results: show(r)
    date_facts = {"Nov 18 + 10 working days": fmt(cal.add(D("2026-11-18"), 10)),
                  "Oct 9 + 7 business days": fmt(business_add(D("2026-10-09"), 7, cal.hol)),
                  "Nov 19 + 7 business days": fmt(business_add(D("2026-11-19"), 7, cal.hol)),
                  "Sep 28 + 7 business days": fmt(business_add(D("2026-09-28"), 7, cal.hol)),
                  "data date Oct 8 + 6 remaining working days (A1000 early finish)": fmt(cal.add(D("2026-10-08"), 6))}
    print("\nDate facts (counting rule: day 1 = first working day after the start date)")
    for k, v in date_facts.items(): print(f"  {k} = {v}")
    out = {"fixture": "fixture.json", "counting_rule": "day 1 is the first working day after the start date; start date not counted",
           "date_facts": date_facts, "scenarios": results}
    if "--write" in sys.argv:
        json.dump(out, open(EXPECTED, "w"), indent=2); open(EXPECTED, "a").write("\n"); print("\nwrote expected.json")
    elif os.path.exists(EXPECTED):
        same = json.load(open(EXPECTED)) == json.loads(json.dumps(out))
        print("\nexpected.json:", "MATCH" if same else "MISMATCH"); sys.exit(0 if same else 1)

if __name__ == "__main__":
    main()
