"""Minimal FICTIONAL fixture builder for the recall pack. Same layout as evals/fixture (so FixtureTools / rules_engine run unchanged),
with the Lead's 0002 shape mirrored: schedule activities carry dates + total float + predecessors, and submittals / RFIs carry
`schedule_activity_id` (submittals.schedule_activity_id in 0002). Every name, domain and number here is invented."""
import copy, json, os, tempfile

AS_OF, COMPARE_TO = "2026-10-08", "2026-10-07"
TZ = "America/New_York"
OFF = "-04:00"
DAILY = 12000

PARTIES = [
    {"name": "Kestrel Development (FICTIONAL)", "role": "owner", "domain": "kestreldev.example", "company_id": 9001},
    {"name": "Northgate Builders (FICTIONAL)", "role": "gc", "domain": "northgatebuild.example", "company_id": 9002},
    {"name": "Fieldline Architects (FICTIONAL)", "role": "architect_engineer", "domain": "fieldline.example", "company_id": 9003},
    {"name": "Voltline Electric (FICTIONAL)", "role": "sub", "domain": "voltline.example", "company_id": 9004},
    {"name": "Apex Switchgear Supply (FICTIONAL)", "role": "sub", "domain": "apexgear.example", "company_id": 9005},
    {"name": "Crestline Glass (FICTIONAL)", "role": "sub", "domain": "crestglass.example", "company_id": 9006},
    {"name": "Ridgeback Concrete (FICTIONAL)", "role": "sub", "domain": "ridgebackconc.example", "company_id": 9007},
]
PEOPLE = {"apex": ("Rita Vance", "rvance@apexgear.example"), "volt": ("Omar Hale", "ohale@voltline.example"),
          "crest": ("Lena Brooks", "lbrooks@crestglass.example"), "ridge": ("Sam Ortiz", "sortiz@ridgebackconc.example"),
          "gc": ("Jo Park", "jpark@northgatebuild.example"), "owner": ("Dee Marsh", "dmarsh@kestreldev.example"),
          "arch": ("Ian Cole", "icole@fieldline.example"), "stranger": ("Pat Quinn", "pquinn@unmapped-co.example")}

NOTICE_PERIODS = [
    {"id": "NP-OG-delay", "contract": "owner-GC", "sub_name": None, "notice_type": "delay", "days": 21, "day_basis": "calendar",
     "trigger": "notice_received", "contract_section": "Prime 8.3 (fictional)", "doc_ref": None},
    {"id": "NP-OG-cost", "contract": "owner-GC", "sub_name": None, "notice_type": "cost_or_change_claim", "days": 21, "day_basis": "calendar",
     "trigger": "notice_received", "contract_section": "Prime 15.1 (fictional)", "doc_ref": None},
    {"id": "NP-OG-dsc", "contract": "owner-GC", "sub_name": None, "notice_type": "differing_site_condition", "days": 7, "day_basis": "calendar",
     "trigger": "event", "contract_section": "Prime 3.7.4 (fictional)", "doc_ref": None},
    {"id": "NP-GS-delay", "contract": "GC-sub", "sub_name": "*", "notice_type": "delay", "days": 7, "day_basis": "calendar",
     "trigger": "notice_received", "contract_section": "Subcontract 9.3 (fictional)", "doc_ref": None},
    {"id": "NP-GS-cost", "contract": "GC-sub", "sub_name": "*", "notice_type": "cost_or_change_claim", "days": 7, "day_basis": "calendar",
     "trigger": "notice_received", "contract_section": "Subcontract 9.4 (fictional)", "doc_ref": None},
]

def act(aid, name, es, ef, tf, spec=None, loc=None, driving=False, started=None, preds=()):
    return {"activity_id": aid, "name": name, "early_start": es, "early_finish": ef, "total_float_wd": tf, "free_float_wd": 0,
            "is_critical": tf <= 0, "near_critical": 0 < tf <= 5, "pct_complete": 10 if started else 0, "actual_start": started,
            "actual_finish": None, "on_driving_path_to_tco": driving, "spec_sections": [spec] if spec else [], "cost_code": None,
            "location": loc, "company": None, "predecessors": list(preds), "planned_crew_size": None, "note": None,
            "original_duration_wd": 5, "wing": "-"}

BASE_ACTS = [
    act("A100", "Gear set - main switchgear", "2026-11-02", "2026-11-02", 0, "26 24 13", "Electrical room", True),
    act("A110", "Set switchboards", "2026-11-02", "2026-11-04", 5, "26 24 16", "Electrical room"),
    act("A120", "Install panelboards L1-L3", "2026-11-09", "2026-11-13", 3, "26 24 19", "Levels 1-3"),
    act("A130", "Install storefront glazing", "2026-11-02", "2026-11-06", 0, "08 41 13", "Level 1 retail", True),
    act("A200", "Site utilities - north", "2026-10-13", "2026-10-30", 2, "33 10 00", "Site > North"),
    act("A210", "Slab on grade pour - Area B", "2026-10-13", "2026-10-13", 1, "03 30 00", "Bldg > Area B"),
    act("A220", "L2 wall framing", "2026-10-09", "2026-10-23", 4, "06 10 00", "Level 2"),
    act("A230", "Roof drains", "2027-03-10", "2027-03-17", 45, "22 14 26", "Roof"),
    act("A240", "Mechanical rough-in L3", "2026-10-12", "2026-10-30", 3, "23 31 00", "Level 3"),
    act("A245", "Electrical rough-in L3", "2026-10-12", "2026-10-30", 3, "26 05 00", "Level 3"),
    act("A250", "Curtain wall anchors", "2026-11-09", "2026-11-13", 10, "08 44 13", "Facade"),
    act("A260", "Elevator pit forming", "2026-10-01", "2026-10-14", 2, "14 21 00", "Elevator 1", started="2026-10-01"),
    act("A270", "Drywall L2", "2026-10-16", "2026-11-06", 4, "09 21 16", "Level 2"),
    act("A280", "Excavation Area C", "2026-10-14", "2026-10-21", 2, "31 23 00", "Bldg > Area C"),
    act("A290", "Roof insulation", "2026-10-15", "2026-10-22", 6, "07 21 00", "Roof"),
    act("A9000", "Substantial Completion (milestone)", "2027-03-01", "2027-03-01", 0, None, None, True),
]

def sub(num, title, spec, aid, ros=None, ext=None):
    ext = ext or num.replace(" ", "").replace("-", "")
    return {"external_id": ext, "formatted_number": num, "revision": 0, "current_revision": True, "title": title,
            "status": {"name": "Open"}, "specification_section": {"number": spec}, "approvers": [], "ball_in_court": [],
            "scheduled_task": {"key": f"p6|{aid}"} if aid else None, "schedule_activity_id": aid,
            "required_on_site_date": ros, "lead_time": None, "submit_by": None, "received_date": "2026-09-01", "due_date": None,
            "closed_at": None}

BASE_SUBS = [sub("26 24 13-001", "Main switchgear", "26 24 13", "A100", "2026-11-02"),
             sub("26 24 16-001", "Switchboards", "26 24 16", "A110", "2026-11-02"),
             sub("26 24 19-001", "Panelboards", "26 24 19", "A120", "2026-11-09"),
             sub("08 41 13-001", "Storefront glazing", "08 41 13", "A130", "2026-11-02")]

def rfi(num, subject, status="open", due=None, created="2026-09-28", spec=None, loc=None, question="", answers=(), bic=None,
        cost=None, cost_val=None, sched=None, sched_val=None, resolved=None, aid=None, **extra):
    r = {"external_id": str(9000 + int(num)), "number": str(num), "subject": subject, "status": status, "created_at": created + "T09:00:00" + OFF,
         "due_date": due, "time_resolved": resolved, "ball_in_court": {"name": bic} if bic else None,
         "specification_section": {"number": spec} if spec else None, "location": {"name": loc} if loc else None,
         "schedule_impact": {"status": sched, "value": sched_val} if sched else None,
         "cost_impact": {"status": cost, "value": cost_val} if cost else None, "schedule_activity_id": aid,
         "questions": [{"plain_text_body": question, "answers": [
             {"answer_date": a.get("date", "2026-10-06") + "T10:00:00" + OFF, "plain_text_body": a["text"], "created_by": a.get("by", "Ian Cole"),
              "official": a.get("official", True)} for a in answers]}]}
    r.update(extra); return r

def rref(num): return f"procore:rfi:{9000 + int(num)}"

def email(eid, who, subject, body, day=AS_OF, time="09:00", conv=None):
    name, addr = PEOPLE[who]
    return {"id": eid, "ref": f"msgraph_outlook:message:{eid}", "conversation_id": conv or f"conv_{eid}",
            "received_at": f"{day}T{time}:00{OFF}", "from": {"name": name, "email": addr},
            "to": [{"name": "Jo Park", "email": "jpark@northgatebuild.example"}], "cc": [], "subject": subject, "body_text": body}

def eref(eid): return f"msgraph_outlook:message:{eid}"

def ce(num, title, status="pending", rom=None, priced=False, linked_rfis=(), created="2026-10-01"):
    return {"ref": f"procore:change_event:{num}", "number": f"CE-{num}", "title": title, "status": status, "rom_usd": rom, "priced": priced,
            "linked_rfis": list(linked_rfis), "linked_drawings": [], "linked_daily_logs": [], "created_date": created, "note": None}

def build(case, root=None):
    """case keys (all optional): acts_override {aid: {field: v}}, acts_prev_override, extra_acts, subs, rfis, rfis_day1, emails, ces,
    drawings, as_of. Returns the fixture dir."""
    root = root or tempfile.mkdtemp(prefix="pack_")
    as_of = case.get("as_of", AS_OF); cmp = case.get("compare_to", COMPARE_TO)
    J = lambda p, o: (os.makedirs(os.path.dirname(os.path.join(root, p)), exist_ok=True), json.dump(o, open(os.path.join(root, p), "w"), indent=1))
    project = {"_FICTIONAL": True, "name": "Pack Yard (FICTIONAL)", "location": "Anytown", "timezone": TZ, "description": "recall pack fixture",
               "project_mailbox": "packyard@northgatebuild.example", "schedule_source": "p6_xer", "contract": {}, "percent_complete_cost": 0.3,
               "percent_complete_basis": "cost", "delay_cost_basis": {"daily_delay_cost_usd": DAILY, "source": "pack (fictional)"},
               "key_milestones": [{"activity_id": "A9000", "name": "Substantial Completion", "baseline": "2027-03-01"}],
               "long_lead_spec_sections": ["26 24 13"], "contract_terms": [], "holidays": [], "notice_periods": case.get("notice_periods", NOTICE_PERIODS),
               "project_parties": PARTIES, "companies": [{"id": p["company_id"], "name": p["name"], "role": p["role"], "domain": p["domain"]} for p in PARTIES],
               "people": [], "spec_sections": [], "locations": [], "cost_codes": []}
    J("project.json", project)
    acts = [dict(a) for a in BASE_ACTS] + [dict(a) for a in case.get("extra_acts", [])]
    cur, prev = [], []
    for a in acts:
        c = dict(a, **case.get("acts_override", {}).get(a["activity_id"], {}))
        p = dict(a, **case.get("acts_prev_override", {}).get(a["activity_id"], {}))
        cur.append(dict(c, schedule_update_id="U2", data_date="2026-10-05", external_id=c["activity_id"], ref="p6:activity:" + c["activity_id"]))
        prev.append(dict(p, schedule_update_id="U1", data_date="2026-09-28", external_id=p["activity_id"], ref="p6:activity:" + p["activity_id"]))
    J("m3/schedule.json", {"calendar": {"workdays": "Mon-Fri"}, "updates": [
        {"schedule_update_id": "U1", "source": "p6_xer", "data_date": "2026-09-28", "uploaded_at": "2026-09-29T10:00:00" + OFF, "ref": "p6:schedule_update:U1"},
        {"schedule_update_id": "U2", "source": "p6_xer", "data_date": "2026-10-05", "uploaded_at": "2026-10-06T10:00:00" + OFF, "ref": "p6:schedule_update:U2"}],
        "activities": prev + cur})
    subs = BASE_SUBS + case.get("subs", [])
    rfis = case.get("rfis", [])
    for d, day in (("day1", cmp), ("day2", as_of)):
        J(f"m1/{d}/rfis.json", case.get("rfis_day1", rfis) if d == "day1" else rfis)
        J(f"m1/{d}/submittals.json", subs)
        J(f"m1/{d}/findings.json", [{"run_date": day, "rule_id": "_none", "status": "resolved", "fingerprint": "_", "citations": [],
                                     "change_since_prior_run": "resolved", "severity": "low"}][:0] or [])
    J("m2/emails.json", {"coverage_note": "pack", "emails": case.get("emails", [])})
    J("m2/meetings.json", {"meetings": []})
    J("m3/budget.json", {"snapshots": []})
    ces = case.get("ces", [])
    J("m3/change_events.json", {"snapshots": [{"snapshot_date": cmp, "change_events": ces}, {"snapshot_date": as_of, "change_events": ces}]})
    J("m3/commitments.json", {"commitments": []})
    J("m3/daily_logs.json", {"logs": case.get("logs", [])})
    J("m3/drawing_revisions.json", {"drawing_revisions": case.get("drawings", [])})
    open(os.path.join(root, "harness_fixture.yaml"), "w").write(f"as_of: '{as_of}'\ncompare_to: '{cmp}'\n")
    return root
