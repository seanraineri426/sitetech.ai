"""Part 2: M1 deterministic finding rules + M3 data (schedule, daily logs, commitments, budget, change events, drawings).
*** ALL DATA FICTIONAL ***"""
from p1_core import *

SEV = ["low", "medium", "high", "critical"]
def bump(s, n=1): return SEV[min(SEV.index(s) + n, 3)]
def base_by_days(d): return "high" if d >= 10 else "medium" if d >= 5 else "low"

def ros_margin(s, as_of):
    """Rule SUB-ROS-RISK (see DAILY_BRIEF_SPEC.md 4.5). Returns (margin_days, latest_return, projected_return) or None.
    latest_return = required_on_site_date - lead_time - buffer_time   (Procore 'planned return date' math + buffer)
    projected_return: in review -> max(due_date, as_of); draft -> max(submit_by, as_of) + design_team_review_time + internal_review_time"""
    ros, lead = d_(s["required_on_site_date"]), s["lead_time"]
    if not ros or lead is None: return None
    latest = ros - dt.timedelta(days=lead + (s.get("buffer_time") or 0))
    st = s["status"]["name"]
    if st == "Open" and s["received_date"]:
        projected = max(d_(s["due_date"]), as_of)
    elif st == "Draft":
        projected = max(d_(s["submit_by"]), as_of) + dt.timedelta(days=(s["design_team_review_time"] or 10) + (s["internal_review_time"] or 0))
    else:
        return None
    return (latest - projected).days, latest, projected

def finding(as_of, rule_id, row, title, severity, days_overdue, gov_date, gov_kind, evidence, label, bic=None, extra_refs=(), fp_key=None):
    ext, et = row["external_id"], row["entity_type"]
    fp = f"{rule_id}|{et}|{fp_key or ext}"
    return {
     "id": uid(f"finding:{fp}:{as_of}"), "org_id": ORG_ID, "project_id": PROJECT_ID, "run_date": iso(as_of),
     "rule_id": rule_id, "rule_version": "1.0.0", "entity_type": et, "entity_id": row["id"],
     "source": "procore", "external_id": ext, "record_label": label, "title": title,
     "severity": severity, "status": "open", "days_overdue": days_overdue,
     "governing_date": iso(gov_date), "governing_date_kind": gov_kind,
     "ball_in_court": bic, "spec_section": (row.get("specification_section") or {}).get("number"),
     "fingerprint": fp, "first_detected_on": None, "last_seen_on": iso(as_of), "resolved_on": None,
     "change_since_prior_run": None, "evidence": evidence,
     "citations": [{"ref": f"procore:{et}:{ext}", "fields": list(evidence.keys())}] + list(extra_refs),
    }

def m1_findings(as_of, rfis, subs):
    out = []
    for r in rfis:
        if r["status"] != "open": continue
        due = d_(r["due_date"])
        if due and due < as_of:
            days = (as_of - due).days
            sev = base_by_days(days)
            if r["schedule_impact"]["status"] in ("yes_known", "yes_unknown"): sev = bump(sev)
            bic = r["ball_in_court"]["name"] if r["ball_in_court"] else None
            out.append(finding(as_of, "RFI-OVERDUE", r, f"RFI #{r['number']} overdue {days}d: {r['subject']}", sev, days, due, "due_date",
                {"status": r["status"], "due_date": r["due_date"], "ball_in_court": bic,
                 "schedule_impact.status": r["schedule_impact"]["status"], "cost_impact.status": r["cost_impact"]["status"]},
                f"RFI #{r['number']}", bic))
    ros_sev = {}
    for s in subs:
        if not s["current_revision"]: continue
        m = ros_margin(s, as_of)
        if m and m[0] <= 14:
            margin, latest, projected = m
            sev = "critical" if margin < 0 else "high" if margin <= 5 else "medium"
            ros_sev[s["external_id"]] = sev
            bic = ", ".join(b["name"] for b in s["ball_in_court"]) or None
            out.append(finding(as_of, "SUB-ROS-RISK", s,
                f"Submittal {s['formatted_number']} rev {s['revision']}: {margin}d margin to drop-dead return date ({s['title']})",
                sev, max(0, -margin), latest, "latest_return_date",
                {"required_on_site_date": s["required_on_site_date"], "lead_time": s["lead_time"], "buffer_time": s["buffer_time"],
                 "design_team_review_time": s["design_team_review_time"], "internal_review_time": s["internal_review_time"],
                 "status.name": s["status"]["name"], "due_date": s["due_date"], "submit_by": s["submit_by"],
                 "computed.latest_return_date": iso(latest), "computed.projected_return_date": iso(projected), "computed.margin_days": margin},
                f"Submittal {s['formatted_number']} rev {s['revision']}", bic))
    for s in subs:
        if not s["current_revision"]: continue
        bic = ", ".join(b["name"] for b in s["ball_in_court"]) or None
        label = f"Submittal {s['formatted_number']} rev {s['revision']}"
        if s["status"]["name"] == "Open" and s["received_date"] and d_(s["due_date"]) < as_of:
            days = (as_of - d_(s["due_date"])).days
            sev = base_by_days(days)
            if ros_sev.get(s["external_id"]) in ("high", "critical"): sev = bump(sev)
            out.append(finding(as_of, "SUB-REVIEW-OVERDUE", s, f"{label} review overdue {days}d ({s['title']})", sev, days,
                d_(s["due_date"]), "due_date", {"status.name": "Open", "due_date": s["due_date"], "ball_in_court": bic}, label, bic))
        if s["status"]["name"] == "Draft" and s["submit_by"] and d_(s["submit_by"]) < as_of and not s["received_date"]:
            days = (as_of - d_(s["submit_by"])).days
            sev = base_by_days(days)
            if ros_sev.get(s["external_id"]) in ("high", "critical"): sev = bump(sev)
            out.append(finding(as_of, "SUB-SUBMIT-BY-MISSED", s, f"{label} not submitted; submit-by passed {days}d ago ({s['title']})", sev, days,
                d_(s["submit_by"]), "submit_by", {"status.name": "Draft", "submit_by": s["submit_by"], "received_date": None, "ball_in_court": bic}, label, bic))
    series = {}
    for s in subs: series.setdefault(s["formatted_number"], []).append(s)
    for fn, revs in series.items():
        rr = [s for s in revs if s["approvers"][0]["response"]["name"] == "Revise and Resubmit"]
        if len(rr) >= 2:
            cur = [s for s in revs if s["current_revision"]][0]
            sev = "high" if ros_sev.get(cur["external_id"]) in ("high", "critical") else "medium"
            sb = d_(cur["submit_by"])
            days = max(0, (as_of - sb).days) if (sb and not cur["received_date"]) else 0  # only overdue if the next rev is not yet submitted
            bic = ", ".join(b["name"] for b in cur["ball_in_court"]) or None
            out.append(finding(as_of, "SUB-REV-LOOP", cur, f"Submittal {fn}: {len(rr)} revise-and-resubmit cycles; rev {cur['revision']} with {bic}",
                sev, days, sb, "submit_by",
                {"rr_count": len(rr), "rr_revisions": [x["revision"] for x in rr], "current_revision": cur["revision"],
                 "current_status": cur["status"]["name"], "submit_by": cur["submit_by"]},
                f"Submittal {fn}", bic, fp_key=fn,
                extra_refs=[{"ref": f"procore:submittal:{x['external_id']}", "fields": ["approvers[0].response.name"]} for x in rr]))
    return out

def carry_lifecycle(prev, cur, as_of):
    pmap = {f["fingerprint"]: f for f in prev}; cmap = {f["fingerprint"]: f for f in cur}
    for f in cur:
        p = pmap.get(f["fingerprint"])
        f["first_detected_on"] = p["first_detected_on"] if p else iso(as_of)
        f["change_since_prior_run"] = ("new" if not p else "worse" if SEV.index(f["severity"]) > SEV.index(p["severity"])
            else "better" if SEV.index(f["severity"]) < SEV.index(p["severity"]) else "unchanged")
    resolved = []
    for fp, p in pmap.items():
        if fp not in cmap and p["status"] == "open":
            r = dict(p); r.update({"id": uid(f"finding:{fp}:{as_of}"), "run_date": iso(as_of), "status": "resolved",
                                   "resolved_on": iso(as_of), "last_seen_on": p["run_date"], "change_since_prior_run": "resolved"})
            resolved.append(r)
    return cur + resolved

# ---------------- schedule: two weekly XER updates
def act(aid, name, wing, es, dur, tf1, tf2, ff2, act_start=None, act_finish=None, pct1=0, pct2=0, spec_=None, cc=None,
        lo=None, co=None, preds=(), crew=None, dur1=None, es1=None, driving=False, note=None):
    return dict(aid=aid, name=name, wing=wing, es=es, dur=dur, tf1=tf1, tf2=tf2, ff2=ff2, act_start=act_start, act_finish=act_finish,
                pct1=pct1, pct2=pct2, spec_=spec_, cc=cc, lo=lo, co=co, preds=list(preds), crew=crew, dur1=dur1 or dur,
                es1=es1 or es, driving=driving, note=note)
ACTS = [
 act("A1450", "Frame L2 - Wing A", "A", D(2026,8,21), 15, 0, 0, 0, act_start=D(2026,8,21), act_finish=D(2026,9,11), pct1=100, pct2=100, spec_="061100", cc="06-1100", co="framer", crew=16, driving=True),
 act("A1490", "Frame L3 - Wing A", "A", D(2026,9,14), 10, 0, 0, 0, act_start=D(2026,9,14), act_finish=D(2026,9,25), pct1=60, pct2=100, spec_="061100", cc="06-1100", co="framer", crew=16, preds=["A1450"], driving=True),
 act("A1500", "Frame L4 - Wing A", "A", D(2026,9,28), 15, 0, 0, 0, act_start=D(2026,9,28), spec_="061100", cc="06-1100", lo="wingA_L4", co="framer", crew=16, preds=["A1490"], driving=True),
 act("A1510", "Frame L5 - Wing A", "A", D(2026,10,19), 15, 0, 0, 0, spec_="061100", cc="06-1100", co="framer", crew=16, preds=["A1500"], driving=True),
 act("A1520", "Frame L6 - Wing A", "A", D(2026,11,9), 15, 0, 0, 0, spec_="061100", cc="06-1100", co="framer", crew=16, preds=["A1510"], driving=True),
 act("A1530", "Roof Trusses & Sheathing - Wing A", "A", D(2026,12,2), 10, 0, 0, 0, spec_="061100", cc="06-1100", co="framer", crew=16, preds=["A1520"], driving=True),
 act("A1620", "L2 MEP Rough-in Inspections & Close-in - Wing A", "A", D(2026,10,5), 5, 6, 4, 0, lo="wingA_L2", co="plumb", preds=["A1450"]),
 act("A1630", "L2 Insulation & Drywall - Wing A", "A", D(2026,10,12), 10, 6, 4, 4, lo="wingA_L2", preds=["A1620"]),
 act("A1700", "HVAC Duct Rough-in L3 - Wing A (incl. Stack 07)", "A", D(2026,10,5), 10, 9, 9, 2, spec_="233113", cc="23-3113", lo="stack07", co="mech", preds=["A1490"]),
 act("A1210", "Elevator Pit Excavation & Foundations - Wing B", "B", D(2026,10,1), 8, 5, 5, 0, act_start=D(2026,10,1), spec_="312316", cc="31-2316", lo="elev_pit_B", co="conc"),
 act("A1225", "Fabricate Podium Transfer Steel - Wing B", "B", D(2026,10,12), 20, 8, 3, 0, dur1=15, spec_="051200", cc="05-1200", co="steel",
     note="Duration revised 15->20 wd in UPD-39 per fabricator queue update; start contingent on approved shop drawings (Submittal 05 12 00-003)"),
 act("A1230", "Erect Podium Transfer Steel - Wing B (Grid C/4-7)", "B", D(2026,11,9), 8, 8, 3, 0, spec_="051200", cc="05-1200", lo="wingB_podium_C47", co="steel", preds=["A1225"]),
 act("A1240", "Form/Reinforce/Pour Podium Transfer Deck - Wing B", "B", D(2026,11,19), 10, 8, 3, 0, lo="wingB_podium_C47", co="conc", preds=["A1230"]),
 act("A1260", "Frame L2 - Wing B", "B", D(2026,12,7), 15, 8, 3, 0, spec_="061100", cc="06-1100", co="framer", preds=["A1240"]),
 act("A2400", "Install Windows L2-L6", "A+B", D(2027,2,22), 30, 12, 12, 0, spec_="085313", cc="08-5313", co="window"),
 act("A2800", "Amenity Deck Pavers - Podium L2", "B", D(2026,12,15), 8, 10, 10, 10, spec_="321400", cc="32-1400", lo="amenity_deck"),
 act("A3050", "Procure Switchgear (PO to delivery)", "-", D(2026,9,28), 150, 15, 10, 0, es1=D(2026,9,21), spec_="262413", cc="26-2413", co="gear",
     note="Not started: PO not issued. Early start moves with the data date each update."),
 act("A3100", "Permanent Power Energized", "-", D(2027,5,17), 1, 15, 10, 0, preds=["A3050"]),
 act("A3400", "Roof Drains & Roofing - Wing A", "A", D(2026,12,15), 12, 35, 35, 35, spec_="221426", lo="roof_A"),
 act("A4000", "TCO (milestone)", "-", D(2027,8,27), 0, 0, 0, 0, driving=True),
]
UPDATES = [
 {"schedule_update_id": "U1", "source": "p6_xer", "file_name": "LindenYard_UPD-38_DD2026-09-21.xer", "data_date": "2026-09-21",
  "uploaded_at": "2026-09-25T16:40:00-04:00", "uploaded_by": "Priya Nair", "ref": "p6:schedule_update:U1"},
 {"schedule_update_id": "U2", "source": "p6_xer", "file_name": "LindenYard_UPD-39_DD2026-09-28.xer", "data_date": "2026-09-28",
  "uploaded_at": "2026-10-02T15:05:00-04:00", "uploaded_by": "Priya Nair", "ref": "p6:schedule_update:U2"},
]
def schedule_doc():
    out = []
    for u in UPDATES:
        dd = d_(u["data_date"]); U1 = u["schedule_update_id"] == "U1"
        for a in ACTS:
            es, dur = (a["es1"], a["dur1"]) if U1 else (a["es"], a["dur"])
            ef = es if dur == 0 else finish(es, dur)
            out.append({"schedule_update_id": u["schedule_update_id"], "data_date": u["data_date"], "external_id": a["aid"],
              "ref": f"p6:activity:{a['aid']}", "activity_id": a["aid"], "name": a["name"], "wing": a["wing"],
              "early_start": iso(es), "early_finish": iso(ef), "original_duration_wd": dur,
              "total_float_wd": a["tf1"] if U1 else a["tf2"], "free_float_wd": None if U1 else a["ff2"],
              "is_critical": (a["tf1"] if U1 else a["tf2"]) <= 0, "near_critical": 0 < (a["tf1"] if U1 else a["tf2"]) <= 5,
              "pct_complete": a["pct1"] if U1 else a["pct2"],
              "actual_start": iso(a["act_start"]) if a["act_start"] and a["act_start"] <= dd else None,
              "actual_finish": iso(a["act_finish"]) if a["act_finish"] and a["act_finish"] <= dd else None,
              "on_driving_path_to_tco": a["driving"], "spec_sections": [spec[a["spec_"]]["number"]] if a["spec_"] else [],
              "cost_code": a["cc"], "location": loc[a["lo"]]["name"] if a["lo"] else None,
              "company": companies[a["co"]]["name"] if a["co"] else None, "predecessors": a["preds"],
              "planned_crew_size": a["crew"], "note": None if U1 else a["note"]})
    return {"_FICTIONAL": FICT, "calendar": project["calendar"], "updates": UPDATES, "activities": out}

# ---------------- daily logs (Procore per-type log shapes, simplified)
def daily_logs():
    logs, i = [], 80100
    def mp(d, co, n, lo, a, note=None):
        nonlocal i; i += 1
        return {"id": i, "type": "manpower_log", "ref": f"procore:manpower_log:{i}", "log_date": iso(d), "vendor": companies[co]["name"],
                "num_workers": n, "num_hours": 8.0, "location": loc[lo]["name"], "activity_id_hint": a, "notes": note}
    for d, n in [(D(2026,9,30), 15), (D(2026,10,1), 15), (D(2026,10,2), 13), (DAY1, 14), (DAY2, 6)]:
        logs.append(mp(d, "framer", n, "wingA_L4", "A1500",
            "Timberline foreman: 8 framers reassigned to another project today; expect back 'later this week'" if d == DAY2 else None))
    for d in (DAY1, DAY2):
        logs.append(mp(d, "mech", 4, "stack07", "A1700", "Holding duct install at Stack 07 pending RFI 43 / ASI-07 shaft size" if d == DAY2 else None))
        logs.append(mp(d, "plumb", 5, "wingA_L2", "A1620"))
        logs.append(mp(d, "conc", 6, "elev_pit_B", "A1210", "East half idle (rock)" if d == DAY2 else None))
    logs += [
     {"id": 80201, "type": "weather_log", "ref": "procore:weather_log:80201", "log_date": iso(DAY1), "conditions": "Clear", "temp_high_f": 64, "temp_low_f": 47, "precipitation_in": 0.0, "weather_delay": False},
     {"id": 80202, "type": "weather_log", "ref": "procore:weather_log:80202", "log_date": iso(DAY2), "conditions": "Clear", "temp_high_f": 61, "temp_low_f": 44, "precipitation_in": 0.0, "weather_delay": False},
     {"id": 80301, "type": "inspection_log", "ref": "procore:inspection_log:80301", "log_date": iso(DAY2), "inspection_type": "Plumbing rough-in (AHJ)",
      "location": loc["wingA_L2"]["name"], "inspector": "City of Riverton Building Dept. (fictional)", "result": "Failed",
      "items": ["Missing nail plates at 6 locations", "Vent clearance at chase C2-07", "Test did not hold at riser P-3"],
      "reinspection_requested_for": "2026-10-09", "activity_id_hint": "A1620"},
     {"id": 80401, "type": "notes_log", "ref": "procore:notes_log:80401", "log_date": iso(DAY1), "location": loc["elev_pit_B"]["name"],
      "comment": "Granite Line hit rock at approx El. 92.5 in Wing B elevator pit. Excavation stopped on east half. See RFI 41."},
     {"id": 80402, "type": "notes_log", "ref": "procore:notes_log:80402", "log_date": iso(DAY2), "location": loc["wingA_L4"]["name"],
      "comment": "Framing crew short on L4. Super called Jake Rourke; no commitment on return date."},
     {"id": 80501, "type": "delay_log", "ref": "procore:delay_log:80501", "log_date": iso(DAY1), "delay_type": "Unforeseen condition",
      "vendor": companies["conc"]["name"], "duration_hours": 4, "description": "Rock in elevator pit east half; awaiting EOR direction (RFI 41)."},
    ]
    return {"_FICTIONAL": FICT, "logs": logs}

# ---------------- commitments (+ sub requisition), budget, change events, drawings
def commitments():
    def c(i, num, typ, co, title, status, amt, executed, ret, ccs, specs_, invoices=(), **extra):
        r = {"id": i, "ref": f"procore:commitment:{i}", "number": num, "type": typ, "vendor": companies[co]["name"], "title": title,
             "status": status, "contract_amount_usd": amt, "executed_date": executed, "retainage_pct": ret,
             "cost_codes": ccs, "spec_sections": specs_, "invoices": list(invoices)}
        r.update(extra); return r
    payapp6 = {"id": 33056, "ref": "procore:requisition:33056", "number": 6, "period_end": "2026-09-30", "submitted_date": "2026-10-03",
               "status": "under_review", "requested_retainage_pct": 0.05, "notes": "Sub requests retainage reduction from 10% to 5%.",
               "lines": [{"sov_line": "Wood framing - Wing A", "scheduled_value_usd": 2600000, "pct_complete_prev": 0.45, "pct_complete_to_date": 0.62},
                         {"sov_line": "Wood framing - Wing B", "scheduled_value_usd": 1280000, "pct_complete_prev": 0.0, "pct_complete_to_date": 0.0},
                         {"sov_line": "Blocking & backing", "scheduled_value_usd": 300000, "pct_complete_prev": 0.25, "pct_complete_to_date": 0.30}]}
    return {"_FICTIONAL": FICT, "commitments": [
      c(3305, "SC-005", "subcontract", "framer", "Wood Framing", "Executed", 4180000, "2026-05-12", 0.10, ["06-1100"], ["06 11 00"], [payapp6]),
      c(3309, "SC-009", "subcontract", "steel", "Structural Steel - Podium Transfer & Misc", "Executed", 1940000, "2026-05-20", 0.10, ["05-1200"], ["05 12 00"]),
      c(3312, "SC-012", "subcontract", "mech", "HVAC", "Executed", 3620000, "2026-05-28", 0.10, ["23-3113"], ["23 31 13"]),
      c(3314, "SC-014", "subcontract", "elec", "Electrical (excludes main switchgear; gear by GC PO-0117)", "Executed", 3350000, "2026-06-02", 0.10, [], ["26 05 00"]),
      c(3318, "SC-018", "subcontract", "window", "Vinyl Windows - Supply & Install", "Executed", 1280000, "2026-06-15", 0.10, ["08-5313"], ["08 53 13"]),
      c(3401, "PO-0117", "purchase_order", "gear", "Main Switchgear & Switchboards (GC-direct)", "Draft", 486500, None, 0.0, ["26-2413"], ["26 24 13"],
        created_date="2026-09-19", quote_ref="msgraph_outlook:message:msg_E101",
        quote_terms={"price_valid_through": "2026-10-09", "lead_time_weeks": 30, "post_expiry": "+4% and 32-week lead time (per vendor email)"}),
    ]}

def budget():
    def line(code, desc, orig, committed, pending, proj):
        return {"cost_code": code, "description": desc, "original_budget_usd": orig, "approved_changes_usd": 0, "revised_budget_usd": orig,
                "committed_costs_usd": committed, "pending_changes_usd": pending, "projected_cost_usd": proj}
    def snap(d, ce31):
        p31 = 145000 if ce31 else 0
        cont = {"owner_contingency_original_usd": 1250000, "approved_change_orders_usd": 612000, "pending_pcos_usd": 398000 + p31,
                "unpriced_change_events": ["CE-030"] + (["CE-031 (GC ROM only)"] if ce31 else [])}
        cont["remaining_after_pending_usd"] = 1250000 - 612000 - cont["pending_pcos_usd"]
        cont["pct_used_incl_pending"] = round((612000 + cont["pending_pcos_usd"]) / 1250000, 4)
        return {"snapshot_date": iso(d), "ref": f"procore:budget_snapshot:{d.strftime('%Y%m%d')}", "budget_view": "Owner Budget (configured view, fictional)",
                "percent_complete_cost": 0.46, "owner_contingency": cont, "lines": [
                 line("01-5000", "General Conditions", 3920000, 3920000, 0, 3920000),
                 line("05-1200", "Structural Steel", 1940000, 1940000, 0, 1940000),
                 line("06-1100", "Wood Framing", 4180000, 4180000, 0, 4180000),
                 line("08-5313", "Vinyl Windows", 1280000, 1280000, 0, 1280000),
                 line("23-3113", "HVAC", 3620000, 3620000, 0, 3620000),
                 line("26-2413", "Switchgear (GC-direct)", 486500, 0, 0, 486500),
                 line("32-1400", "Unit Paving / Amenity Deck", 210000, 0, 0, 210000),
                 line("31-2316", "Excavation", 1460000, 1460000, p31, 1460000 + p31)]}
    return {"_FICTIONAL": FICT, "snapshots": [snap(DAY1, False), snap(DAY2, True)]}

def _ces(day2):
    ce = []
    for i, (n, co, t, amt) in enumerate([("CE-020", "CO-001", "Unsuitable soils over-excavation", 140000), ("CE-021", "CO-002", "Owner-requested lobby finish upgrade", 96500),
            ("CE-022", "CO-003", "Utility transformer pad relocation", 88000), ("CE-023", "CO-004", "ASI-02 podium waterproofing revision", 121000),
            ("CE-024", "CO-005", "Added fire alarm devices per AHJ", 74500), ("CE-025", "CO-006", "Retail grease interceptor upsizing", 92000)]):
        ce.append({"id": 3500 + i, "ref": f"procore:change_event:{3500+i}", "number": n, "title": t, "status": "approved", "co_number": co,
                   "pco_number": None, "rom_usd": amt, "priced": True, "funding": "owner_contingency", "created_date": f"2026-0{4+i}-15"})
    ce += [
     {"id": 3510, "ref": "procore:change_event:3510", "number": "CE-026", "title": "Off-site utility relocation (water main)", "status": "pending", "pco_number": "PCO-017", "rom_usd": 184000, "priced": True, "funding": "owner_contingency", "created_date": "2026-08-20"},
     {"id": 3511, "ref": "procore:change_event:3511", "number": "CE-027", "title": "Bike room relocation (VOID - superseded)", "status": "void", "pco_number": None, "rom_usd": 0, "priced": False, "funding": None, "created_date": "2026-08-25"},
     {"id": 3512, "ref": "procore:change_event:3512", "number": "CE-028", "title": "Owner-requested retail storefront upgrade", "status": "pending", "pco_number": "PCO-014", "rom_usd": 118000, "priced": True, "funding": "owner_contingency", "created_date": "2026-08-02"},
     {"id": 3513, "ref": "procore:change_event:3513", "number": "CE-029", "title": "ASI-05 unit layout revisions (Units 2C/3C)", "status": "pending", "pco_number": "PCO-016", "rom_usd": 96000, "priced": True, "funding": "owner_contingency", "created_date": "2026-09-05"},
     {"id": 3514, "ref": "procore:change_event:3514", "number": "CE-030", "title": "ASI-07 duct shaft revisions, Unit Stack 07", "status": "open", "pco_number": None, "rom_usd": None, "priced": False, "funding": "TBD", "created_date": "2026-09-25",
      "linked_rfis": ["procore:rfi:9043"], "linked_drawings": ["procore:drawing_revision:7741"], "note": "Awaiting Polar Mechanical and Timberline pricing"},
    ]
    if day2:
        ce.append({"id": 3515, "ref": "procore:change_event:3515", "number": "CE-031", "title": "Rock removal - Wing B elevator pit", "status": "open", "pco_number": None,
                   "rom_usd": 145000, "priced": False, "funding": "owner_contingency (proposed)", "created_date": iso(DAY2),
                   "linked_rfis": ["procore:rfi:9041"], "linked_daily_logs": ["procore:notes_log:80401", "procore:delay_log:80501"],
                   "note": "GC ROM; sub pricing to follow (see email msg_E110)"})
    return ce
def change_events_doc():
    return {"_FICTIONAL": FICT, "snapshots": [{"snapshot_date": iso(DAY1), "change_events": _ces(False)},
                                              {"snapshot_date": iso(DAY2), "change_events": _ces(True)}]}

def drawing_revisions():
    return {"_FICTIONAL": FICT, "drawing_revisions": [
      {"id": 7731, "ref": "procore:drawing_revision:7731", "number": "S-301", "title": "Podium Framing Plan - Transfer Zone", "revision": "2", "issued_date": "2026-09-10", "issued_via": "Bulletin 3", "discipline": "Structural"},
      {"id": 7741, "ref": "procore:drawing_revision:7741", "number": "M-401", "title": "Enlarged Mechanical Shaft Plans", "revision": "3", "issued_date": "2026-09-24", "issued_via": "ASI-07", "discipline": "Mechanical",
       "description": "Shaft at Unit Stack 07 enlarged from 18x24 to 24x30, L2-L6"},
      {"id": 7742, "ref": "procore:drawing_revision:7742", "number": "M-402", "title": "Mechanical Riser Diagrams", "revision": "3", "issued_date": "2026-09-24", "issued_via": "ASI-07", "discipline": "Mechanical"},
      {"id": 7751, "ref": "procore:drawing_revision:7751", "number": "A-501", "title": "Window Head/Sill/Jamb Details", "revision": "4", "issued_date": "2026-10-06", "issued_via": "ASI-08", "discipline": "Architectural",
       "description": "Revised window sill flashing and head receptor details"},
    ]}
