#!/usr/bin/env python3
"""Reference ranking for the Day-2 (2026-10-06) brief under DAILY_BRIEF_SPEC.md section 5.  *** ALL DATA FICTIONAL ***
Writes ../reference_ranking.json. Every input below traces to a fixture record (see 'basis')."""
import json, os
from p1_core import D, DAY2, add_wd, wd_between
HERE = os.path.dirname(os.path.abspath(__file__))
TCO = D(2027, 8, 27); DELAY_CD = 16000                        # project.json delay_cost_basis
P = {"Confirmed": 0.9, "Likely": 0.6, "Signal": 0.3}
def urgency(deadline):
    if deadline is None: return 1.0
    bd = wd_between(DAY2, deadline) if deadline > DAY2 else 0
    return 1.5 if bd <= 2 else 1.25 if bd <= 5 else 1.1 if bd <= 10 else 1.0
def tco_cd(wd_beyond_float): return (add_wd(TCO, wd_beyond_float) - TCO).days if wd_beyond_float > 0 else 0

items = []
def item(fid, title, wd_beyond, impact_label, usd_direct=0.0, usd_label="Confirmed", deadline=None, floor=None, basis=""):
    cd = tco_cd(wd_beyond)
    sched_usd = cd * DELAY_CD
    score = (P[impact_label] * sched_usd + P[usd_label] * usd_direct) * urgency(deadline)
    items.append(dict(fid=fid, title=title, tco_wd=max(wd_beyond, 0), tco_cd=cd, schedule_usd=sched_usd, impact_label=impact_label,
                      direct_usd=round(usd_direct), direct_label=usd_label, deadline=deadline.isoformat() if deadline else None,
                      urgency=urgency(deadline), score=round(score), floor=floor, basis=basis))

# F3 switchgear: TF 10 wd at DD 9/28, erodes 1 wd/workday unstarted -> 1 wd by 10/9; missing 10/9 adds 2 weeks (10 wd) of lead
tf_at_deadline = 10 - wd_between(D(2026, 9, 28), D(2026, 10, 9))
item("F3", "Switchgear PO-0117 not issued; quote expires 10/9", 10 - tf_at_deadline, "Likely", usd_direct=486500 * 0.04,
     deadline=D(2026, 10, 9), basis="A3050 TF (U2) 10 wd; msg_E101 +4% / 30->32 wk; PO-0117 Draft")
# F1 steel: missed 10/9 release -> delivery 11/9 -> ~11/23 = 10 wd; A1225/A1230 TF 3 wd -> 7 wd beyond float
item("F1", "Transfer steel release by 10/9 (RFI 42 + SUB 05 12 00-003 rev 1)", 10 - 3, "Likely", deadline=D(2026, 10, 9), floor="critical_path",
     basis="msg_E104 slot Oct 12 -> Oct 26, delivery Nov 9 -> ~Nov 23; A1230 TF 3 (U2)")
# F4 contingency: newly recognized exposure today = CE-031 ROM entering pending
item("F4", "Owner contingency 92.4% used incl. pending at 46% complete", 0, "Confirmed", usd_direct=145000, floor="owner_escalation",
     basis="budget_snapshot 20261006 vs 20261005; CE-031 ROM $145k")
# F5 pay app: net cash ahead of earned = overbilled x (1 - retainage); x P(non-recovery) default 0.25
over = 2600000 * (0.62 - 0.35)
item("F5", "Timberline pay app 6 ahead of schedule-earned; retainage cut requested", 0, "Likely",
     usd_direct=over * (1 - 0.10) * 0.25, usd_label="Likely", deadline=D(2026, 10, 13),
     basis="requisition 33056 Wing A 62% vs A1490/A1500 schedule-earned ~35%; SV $2.6M; P(non-recovery)=0.25 default")
# F2 windows: scenario = one more R&R cycle (14 cd resubmit + 14 cd review = 20 wd); A2400 TF 12 -> 8 wd beyond
item("F2", "Window submittal 3rd R&R; rev 3 due 10/7 with zero ROS margin", 20 - 12, "Signal", deadline=D(2026, 10, 7),
     basis="SUB 6202 R&R 10/6; 6203 submit_by 10/7, review 14 cd, lead 112, buffer 5; A2400 TF 12")
# F6 manpower: shortfall persists 5 wd horizon -> 5 x (1 - 6/16) = 3.1 wd on TF-0 activity
item("F6", "Framing manpower 6 vs 16 planned on critical A1500", round(5 * (1 - 6 / 16)), "Likely", floor="critical_path",
     basis="manpower_log 80105 (6) vs 80104 (14); A1500 TF 0; planned crew 16")
# F8 notice window: unpriced -> score 0; contractual-notice floor (window <= 10 business days)
item("F8", "Polar formal notice of delay/cost (ASI-07); owner notice by 10/15", 0, "Confirmed", deadline=D(2026, 10, 15), floor="notice_window",
     basis="msg_E105; CT-1 21-day prime clause; event 9/24")
for fid, t in [("F7", "Owner paver decision late"), ("F9", "Duct shop drawings vs M-401 Rev 3"), ("F10", "L2 plumbing inspection failed"),
               ("F11", "Wing B pit rock: RFI 41 / CE-031 (exposure counted in F4)")]:
    item(fid, t, 0, "Confirmed", basis="float absorbs modeled delay; $ unpriced or already recognized")

scored = sorted([i for i in items if i["score"] > 0], key=lambda i: -i["score"])
floors = sorted([i for i in items if i["score"] == 0 and i["floor"]], key=lambda i: i["deadline"] or "9999")
rest = [i for i in items if i not in scored and i not in floors]
order = scored + floors
top7 = order[:7]
missing_floor = [i for i in order[7:] if i["floor"]]
assert not missing_floor, "floor item fell outside top 7; spec says floors displace the lowest non-floor item"
for r, i in enumerate(order + rest, 1): i["rank"] = r if i in top7 else None
out = {"_FICTIONAL": "ALL DATA IN THIS FIXTURE IS FICTIONAL.", "as_of": DAY2.isoformat(), "daily_delay_cost_usd": DELAY_CD,
       "top7": [i["fid"] for i in top7], "items": order + rest}
json.dump(out, open(os.path.join(HERE, "..", "reference_ranking.json"), "w"), indent=2)
for i in order + rest:
    print(f'{str(i["rank"] or "-"):>2} {i["fid"]:<4} score=${i["score"]:>9,}  tco+{i["tco_wd"]}wd/{i["tco_cd"]}cd  direct=${i["direct_usd"]:,}  urg={i["urgency"]}  floor={i["floor"]}')
