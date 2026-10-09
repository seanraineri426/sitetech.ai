"""Part 1: helpers, project directory, RFIs, submittals.  *** ALL DATA FICTIONAL ***"""
import json, uuid, datetime as dt, os

D = dt.date
NS = uuid.UUID("6f1c2a3e-0000-4000-8000-517e7ec4a100")
def uid(s): return str(uuid.uuid5(NS, s))

DAY1, DAY2 = D(2026, 10, 5), D(2026, 10, 6)
TZ = "-04:00"
HOLIDAYS = {D(2026,9,7), D(2026,11,26), D(2026,11,27), D(2026,12,24), D(2026,12,25), D(2027,1,1),
            D(2027,5,31), D(2027,7,5), D(2027,9,6)}
def is_wd(d): return d.weekday() < 5 and d not in HOLIDAYS
def add_wd(d, n):
    step = 1 if n >= 0 else -1; k = 0
    while k != n:
        d += dt.timedelta(days=step)
        if is_wd(d): k += step
    return d
def finish(es, dur): return add_wd(es, dur - 1)
def wd_between(a, b):
    n, d = 0, a
    while d < b:
        d += dt.timedelta(days=1)
        if is_wd(d): n += 1
    return n
def iso(d): return d.isoformat() if d else None
def ts(d, hhmm="09:00"): return f"{d.isoformat()}T{hhmm}:00{TZ}"
def d_(s): return D.fromisoformat(s) if s else None

ORG_ID = uid("org:larkspur-fictional")
PROJECT_ID = uid("project:linden-yard")
PROCORE_COMPANY_ID, PROCORE_PROJECT_ID = 4400123, 8800123
MAILBOX = "lindenyard@larkspurdev.example"
FICT = "ALL DATA IN THIS FIXTURE IS FICTIONAL. Not a real project, company, or person."

companies = {
 "owner":  {"id": 7001, "name": "Larkspur Development Partners (FICTIONAL)", "role": "Owner/Developer", "domain": "larkspurdev.example"},
 "gc":     {"id": 7002, "name": "Ironbridge Builders (FICTIONAL)", "role": "General Contractor", "domain": "ironbridgebuild.example"},
 "arch":   {"id": 7003, "name": "Arcwell Design Studio (FICTIONAL)", "role": "Architect of Record", "domain": "arcwell.example"},
 "seor":   {"id": 7004, "name": "Tandem Structural Engineers (FICTIONAL)", "role": "Structural EOR", "domain": "tandemse.example"},
 "steel":  {"id": 7005, "name": "Bayline Steel Fabricators (FICTIONAL)", "role": "Structural steel fabricator/erector", "domain": "baylinesteel.example"},
 "window": {"id": 7006, "name": "ClearSpan Windows (FICTIONAL)", "role": "Window supplier/installer", "domain": "clearspan.example"},
 "framer": {"id": 7007, "name": "Timberline Framing (FICTIONAL)", "role": "Wood framing sub", "domain": "timberlineframing.example"},
 "mech":   {"id": 7008, "name": "Polar Mechanical (FICTIONAL)", "role": "HVAC sub", "domain": "polarmech.example"},
 "elec":   {"id": 7009, "name": "Current Electric (FICTIONAL)", "role": "Electrical sub", "domain": "currentelectric.example"},
 "plumb":  {"id": 7010, "name": "Brightwater Plumbing (FICTIONAL)", "role": "Plumbing sub", "domain": "brightwaterplumb.example"},
 "conc":   {"id": 7011, "name": "Granite Line Concrete (FICTIONAL)", "role": "Concrete/foundations sub", "domain": "granitelineconc.example"},
 "gear":   {"id": 7012, "name": "Ampere Supply Co. (FICTIONAL)", "role": "Switchgear distributor (GC-direct PO)", "domain": "amperesupply.example"},
 "paver":  {"id": 7013, "name": "Halcyon Hardscapes (FICTIONAL)", "role": "Paver supplier (not yet bought out)", "domain": "halcyonhardscapes.example"},
 "lender": {"id": 7014, "name": "Ridgeway Construction Monitoring (FICTIONAL)", "role": "Lender's construction monitor", "domain": "ridgewaycm.example"},
 "elev":   {"id": 7015, "name": "Ascend Elevator Co. (FICTIONAL)", "role": "Elevator sub", "domain": "ascendelevator.example"},
}
people = {
 "dana":   {"id": 5001, "name": "Dana Whitfield", "title": "Development Director (owner rep)", "co": "owner"},
 "marcus": {"id": 5002, "name": "Marcus Bell", "title": "VP Construction (brief reader)", "co": "owner"},
 "priya":  {"id": 5003, "name": "Priya Nair", "title": "Senior Project Manager", "co": "gc"},
 "tom":    {"id": 5004, "name": "Tom Alvarez", "title": "Superintendent", "co": "gc"},
 "kevin":  {"id": 5005, "name": "Kevin Osei", "title": "Project Engineer", "co": "gc"},
 "lauren": {"id": 5006, "name": "Lauren Pike", "title": "Procurement Manager", "co": "gc"},
 "hannah": {"id": 5007, "name": "Hannah Cole", "title": "Project Architect", "co": "arch"},
 "raj":    {"id": 5008, "name": "Raj Mehta", "title": "Structural EOR", "co": "seor"},
 "gus":    {"id": 5009, "name": "Gus Moreno", "title": "Project Manager", "co": "steel"},
 "eli":    {"id": 5010, "name": "Eli Novak", "title": "Project Manager", "co": "window"},
 "jake":   {"id": 5011, "name": "Jake Rourke", "title": "Owner / PM", "co": "framer"},
 "luis":   {"id": 5012, "name": "Luis Pena", "title": "Framing Foreman", "co": "framer"},
 "sandra": {"id": 5013, "name": "Sandra Kim", "title": "Project Manager", "co": "mech"},
 "mike":   {"id": 5014, "name": "Mike Dunn", "title": "Project Manager", "co": "elec"},
 "ray":    {"id": 5015, "name": "Ray Ortiz", "title": "Plumbing Foreman", "co": "plumb"},
 "bill":   {"id": 5016, "name": "Bill Hart", "title": "Project Manager", "co": "conc"},
 "nina":   {"id": 5017, "name": "Nina Shah", "title": "Inside Sales", "co": "gear"},
 "carol":  {"id": 5018, "name": "Carol Diaz", "title": "Construction Monitor", "co": "lender"},
}
def email_of(p):
    n = people[p]["name"].lower().split(" ")
    return f"{n[0][0]}{n[-1]}@{companies[people[p]['co']]['domain']}"
def puser(p): return {"id": people[p]["id"], "login": email_of(p), "name": people[p]["name"]}
def pvendor(c): return {"id": companies[c]["id"], "name": companies[c]["name"]}

spec = {
 "051200": {"id": 31001, "number": "05 12 00", "description": "Structural Steel Framing"},
 "085313": {"id": 31002, "number": "08 53 13", "description": "Vinyl Windows"},
 "262413": {"id": 31003, "number": "26 24 13", "description": "Switchboards"},
 "233113": {"id": 31004, "number": "23 31 13", "description": "Metal Ducts"},
 "102813": {"id": 31005, "number": "10 28 13", "description": "Toilet Accessories"},
 "321400": {"id": 31006, "number": "32 14 00", "description": "Unit Paving"},
 "142100": {"id": 31007, "number": "14 21 00", "description": "Electric Traction Elevators"},
 "221116": {"id": 31008, "number": "22 11 16", "description": "Domestic Water Piping"},
 "061100": {"id": 31010, "number": "06 11 00", "description": "Wood Framing"},
 "221426": {"id": 31011, "number": "22 14 26", "description": "Facility Storm Drains"},
 "084113": {"id": 31012, "number": "08 41 13", "description": "Aluminum-Framed Entrances and Storefronts"},
 "312316": {"id": 31013, "number": "31 23 16", "description": "Excavation"},
 "055100": {"id": 31014, "number": "05 51 00", "description": "Metal Stairs"},
}
loc = {
 "wingB_podium_C47": {"id": 41001, "name": "Wing B > Podium L2 > Grid C/4-7"},
 "wingA_L2": {"id": 41002, "name": "Wing A > Level 2"},
 "wingA_L3": {"id": 41003, "name": "Wing A > Level 3"},
 "wingA_L4": {"id": 41004, "name": "Wing A > Level 4"},
 "stack07": {"id": 41005, "name": "Wing A > Unit Stack 07 (L2-L6)"},
 "elev_pit_B": {"id": 41006, "name": "Wing B > Elevator Pit"},
 "amenity_deck": {"id": 41007, "name": "Podium L2 > Amenity Deck"},
 "roof_A": {"id": 41008, "name": "Wing A > Roof"},
 "stair2": {"id": 41009, "name": "Wing A > Stair 2"},
 "retail_A": {"id": 41010, "name": "Wing A > Retail > Grid A"},
 "unit3B": {"id": 41011, "name": "Wing A > Level 3 > Unit 3B"},
}
cost_code = {
 "01-5000": {"id": 51001, "full_code": "01-5000", "name": "General Conditions"},
 "05-1200": {"id": 51002, "full_code": "05-1200", "name": "Structural Steel"},
 "06-1100": {"id": 51003, "full_code": "06-1100", "name": "Wood Framing"},
 "08-5313": {"id": 51004, "full_code": "08-5313", "name": "Vinyl Windows"},
 "23-3113": {"id": 51005, "full_code": "23-3113", "name": "HVAC Ductwork"},
 "26-2413": {"id": 51006, "full_code": "26-2413", "name": "Switchgear (GC-direct)"},
 "32-1400": {"id": 51007, "full_code": "32-1400", "name": "Unit Paving / Amenity Deck"},
 "31-2316": {"id": 51008, "full_code": "31-2316", "name": "Excavation"},
 "22-1116": {"id": 51009, "full_code": "22-1116", "name": "Plumbing"},
 "10-2813": {"id": 51010, "full_code": "10-2813", "name": "Toilet Accessories"},
}

project = {
 "_FICTIONAL": FICT, "org_id": ORG_ID, "project_id": PROJECT_ID,
 "name": "Linden Yard Apartments", "location": "Riverton (fictional city), USA", "timezone": "America/New_York",
 "description": "186-unit mid-rise multifamily. Two wings (A and B). 5 stories Type IIIA wood frame over a 1-level concrete podium (retail + structured parking). Wing B has a steel transfer zone at Grid C/4-7 over the garage entry.",
 "procore": {"company_id": PROCORE_COMPANY_ID, "project_id": PROCORE_PROJECT_ID, "auth": "DMSA (read-only permission template)"},
 "project_mailbox": MAILBOX, "sharepoint_site": "Linden Yard Project Site (Sites.Selected)",
 "schedule_source": "p6_xer_weekly_upload",
 "contract": {"type": "GMP (fictional AIA-style prime contract)", "gmp_usd": 48600000, "ntp": "2026-03-02",
              "tco_contract_date": "2027-08-27", "owner_contingency_usd": 1250000, "gc_contingency_in_gmp_usd": 900000},
 "percent_complete_cost": 0.46, "percent_complete_basis": "Owner draw #8 (through 2026-08-31), fictional",
 "delay_cost_basis": {"gc_general_conditions_per_calendar_day_usd": 8400, "owner_carry_per_calendar_day_usd": 7600,
                      "daily_delay_cost_usd": 16000, "source": "Onboarding config (illustrative, fictional)"},
 "calendar": {"type": "5-day", "holidays": sorted(iso(h) for h in HOLIDAYS)},
 "key_milestones": [{"activity_id": "A4000", "name": "TCO", "baseline": "2027-08-27"}],
 "long_lead_spec_sections": ["05 12 00", "08 53 13", "26 24 13", "14 21 00", "08 41 13"],
 "contract_terms": [
   {"id": "CT-1", "doc_ref": "msgraph_sharepoint:document:SP-DOC-PRIME-001", "page": 31, "clause": "Prime Contract 15.1.2 (fictional)",
    "text": "Claims by Contractor must be initiated by written notice within 21 days after occurrence of the event giving rise to the claim.",
    "notice_days": 21, "party": "GC->Owner", "confirmed_by_human": True, "confirmed_by": "Priya Nair", "confirmed_on": "2026-09-15"},
   {"id": "CT-2", "doc_ref": "msgraph_sharepoint:document:SP-DOC-SUBFORM-001", "page": 9, "clause": "Subcontract form 9.3 (fictional)",
    "text": "Subcontractor shall give written notice of any claim for delay or additional cost within 7 days of the event.",
    "notice_days": 7, "party": "Sub->GC", "confirmed_by_human": True, "confirmed_by": "Priya Nair", "confirmed_on": "2026-09-15"},
   {"id": "CT-3", "doc_ref": "msgraph_sharepoint:document:SP-DOC-PRIME-001", "page": 44, "clause": "Prime Contract 9.3.1 (fictional)",
    "text": "Applications for Payment shall reflect work actually in place; Owner may withhold for overbilled amounts.",
    "notice_days": None, "party": "GC->Owner", "confirmed_by_human": False, "confirmed_by": None, "confirmed_on": None},
 ],
 "holidays": sorted(iso(h) for h in HOLIDAYS),
 "notice_periods": [
   {"id": "NP-1-delay", "contract": "owner-GC", "sub_name": None, "notice_type": "delay", "days": 21, "day_basis": "calendar",
    "trigger": "event", "contract_section": "Prime Contract 15.1.2 (fictional), p.31",
    "doc_ref": "msgraph_sharepoint:document:SP-DOC-PRIME-001", "source_term": "CT-1",
    "entered_by": "Priya Nair", "entered_at": "2026-09-15",
    "note": "transcribed from contract_terms CT-1; no new contract facts"},
   {"id": "NP-1-cost_or_change_claim", "contract": "owner-GC", "sub_name": None, "notice_type": "cost_or_change_claim", "days": 21,
    "day_basis": "calendar", "trigger": "event", "contract_section": "Prime Contract 15.1.2 (fictional), p.31",
    "doc_ref": "msgraph_sharepoint:document:SP-DOC-PRIME-001", "source_term": "CT-1",
    "entered_by": "Priya Nair", "entered_at": "2026-09-15",
    "note": "transcribed from contract_terms CT-1; no new contract facts"},
   {"id": "NP-2-delay", "contract": "GC-sub", "sub_name": "*", "notice_type": "delay", "days": 7, "day_basis": "calendar",
    "trigger": "event", "contract_section": "Subcontract form 9.3 (fictional), p.9",
    "doc_ref": "msgraph_sharepoint:document:SP-DOC-SUBFORM-001", "source_term": "CT-2",
    "entered_by": "Priya Nair", "entered_at": "2026-09-15",
    "note": "transcribed from contract_terms CT-2; sub_name '*' = every subcontract on this form"},
   {"id": "NP-2-cost_or_change_claim", "contract": "GC-sub", "sub_name": "*", "notice_type": "cost_or_change_claim", "days": 7,
    "day_basis": "calendar", "trigger": "event", "contract_section": "Subcontract form 9.3 (fictional), p.9",
    "doc_ref": "msgraph_sharepoint:document:SP-DOC-SUBFORM-001", "source_term": "CT-2",
    "entered_by": "Priya Nair", "entered_at": "2026-09-15",
    "note": "transcribed from contract_terms CT-2; sub_name '*' = every subcontract on this form"},
 ],
 # Explicit parties (iteration 4). Lender monitor omitted — not one of the four roles. Derived from companies.
 "project_parties": [
   {"name": companies[k]["name"], "role": role, "domain": companies[k]["domain"], "company_id": companies[k]["id"]}
   for k, role in [
     ("owner", "owner"), ("gc", "gc"), ("arch", "architect_engineer"), ("seor", "architect_engineer"),
     ("steel", "sub"), ("window", "sub"), ("framer", "sub"), ("mech", "sub"), ("elec", "sub"),
     ("plumb", "sub"), ("conc", "sub"), ("gear", "sub"), ("paver", "sub"), ("elev", "sub"),
   ]
 ],
 "companies": list(companies.values()),
 "people": [{**v, "key": k, "company": companies[v["co"]]["name"], "email": email_of(k)} for k, v in people.items()],
 "spec_sections": list(spec.values()), "locations": list(loc.values()), "cost_codes": list(cost_code.values()),
}

# ---------------- RFIs (Procore-shaped)
def rfi(id_, num, subject, status, created, due, mgr, assignee_p, bic_p, received_p, rc, sp, lo, cc, drawing,
        sched_imp, cost_imp, question, answers=(), time_resolved=None):
    return {
     "id": uid(f"rfi:{id_}"), "org_id": ORG_ID, "project_id": PROJECT_ID,
     "source": "procore", "entity_type": "rfi", "external_id": str(id_),
     "source_url": f"https://app.procore.com/{PROCORE_PROJECT_ID}/project/rfi/show/{id_}",
     "number": str(num), "full_number": str(num), "prefix": None, "revision": "0", "current_revision": True,
     "subject": subject, "status": status, "draft": False, "private": False, "accepted": status == "closed",
     "initiated_at": ts(created, "10:00"), "created_at": ts(created, "10:00"),
     "due_date": iso(due), "time_resolved": time_resolved, "ball_in_court_role": "assignees",
     "ball_in_court": puser(bic_p) if bic_p and status == "open" else None,
     "ball_in_courts": [puser(bic_p)] if bic_p and status == "open" else [],
     "assignees": [puser(assignee_p)], "rfi_manager": puser(mgr), "received_from": puser(received_p),
     "responsible_contractor": pvendor(rc), "specification_section": spec[sp], "location": loc[lo],
     "cost_code": cost_code[cc] if cc else None, "drawing_number": drawing, "reference": None,
     "schedule_impact": sched_imp, "cost_impact": cost_imp,
     "questions": [{"id": id_ * 10, "question_date": ts(created, "10:00"), "plain_text_body": question,
                    "created_by": people[received_p]["name"], "answers": list(answers)}],
    }
def ans(aid, d, hhmm, by, body):
    return {"id": aid, "official": True, "answer_date": ts(d, hhmm), "plain_text_body": body, "created_by": people[by]["name"]}

NOI = {"status": "no_impact", "value": 0}; TBD = {"status": "tbd", "value": None}; YU = {"status": "yes_unknown", "value": None}

def rfis_for(day):
    r = []
    closed38 = day == DAY2
    r.append(rfi(9038, 38, "Stair 2 handrail extension at intermediate landing", "closed" if closed38 else "open",
        D(2026,9,24), D(2026,10,1), "kevin", "hannah", "hannah", "tom", "gc", "055100", "stair2", None, "A-601", NOI, NOI,
        "Handrail extension at Stair 2 intermediate landing conflicts with door swing. Confirm extension may return to post per 4/A-601.",
        answers=[ans(90381, DAY2, "10:12", "hannah", "Return to post per 4/A-601 is acceptable. No change to stair fabrication.")] if closed38 else [],
        time_resolved=ts(DAY2, "10:12") if closed38 else None))
    r.append(rfi(9039, 39, "Roof drain location vs. truss layout at Wing A gridline 9", "open",
        D(2026,9,23), D(2026,9,30), "kevin", "hannah", "hannah", "tom", "gc", "221426", "roof_A", "22-1116", "P-501", TBD, TBD,
        "RD-4 lands on a truss bearing point at gridline 9. Can RD-4 shift 18 in. east?"))
    r.append(rfi(9040, 40, "Retail storefront head detail at Grid A", "open",
        D(2026,9,28), D(2026,10,9), "kevin", "hannah", "hannah", "kevin", "gc", "084113", "retail_A", None, "A-511", NOI, TBD,
        "Storefront head detail 6/A-511 shows no deflection header. Confirm deflection allowance."))
    r.append(rfi(9041, 41, "Elevator pit depth vs. encountered rock elevation (Wing B)", "open",
        D(2026,10,1), D(2026,10,8), "kevin", "raj", "raj", "bill", "conc", "312316", "elev_pit_B", "31-2316", "S-101", YU, YU,
        "Rock encountered at El. 92.5 vs. geotech El. 88. Confirm whether pit may be raised 6 in. or rock removal is required."))
    r.append(rfi(9042, 42, "Embed plate layout at transfer girders, Grid C/4-7 (S-301 vs A-201)", "open",
        D(2026,9,22), D(2026,9,29), "kevin", "hannah", "raj", "gus", "steel", "051200", "wingB_podium_C47", "05-1200", "S-301", YU, TBD,
        "Embed plate EP-7 spacing on S-301 Rev 2 does not match architectural column centerlines on A-201 at Grid C/4-7. Fabricator cannot detail transfer girder connections until resolved. Confirm governing dimensions."))
    r.append(rfi(9043, 43, "Duct shaft size at Unit Stack 07 per ASI-07", "open",
        D(2026,9,26), D(2026,10,3), "kevin", "hannah", "hannah", "sandra", "mech", "233113", "stack07", "23-3113", "M-401", YU, YU,
        "ASI-07 enlarges shaft at Stack 07 to 24x30. Framed openings L2-L4 are built to 18x24 per prior set. Confirm whether reframing is required or duct may transition."))
    r.append(rfi(9044, 44, "Amenity deck paver pedestal height at drains", "open",
        D(2026,9,30), D(2026,10,7), "kevin", "hannah", "hannah", "kevin", "gc", "321400", "amenity_deck", "32-1400", "L-301", TBD, TBD,
        "Pedestal heights at deck drains exceed manufacturer max for the base paver. Is Alt 2 (thicker paver) intended?"))
    r.append(rfi(9045, 45, "Unit 3B kitchen layout dimension conflict", "closed",
        D(2026,9,18), D(2026,9,25), "kevin", "hannah", None, "tom", "gc", "061100", "unit3B", None, "A-412", NOI, NOI,
        "Kitchen wall dimension on A-412 conflicts with enlarged plan. Which governs?",
        answers=[ans(90451, D(2026,10,2), "15:30", "hannah", "Enlarged plan governs.")], time_resolved=ts(D(2026,10,2), "15:30")))
    if day == DAY2:
        r.append(rfi(9046, 46, "L2 plumbing chase clearance after failed rough-in inspection", "open",
            DAY2, D(2026,10,13), "kevin", "hannah", "hannah", "ray", "plumb", "221116", "wingA_L2", "22-1116", "P-202", YU, NOI,
            "Inspector requires 1-1/2 in. clearance for vent at chase C2-07; chase framed at 3-1/2 in. Can chase be furred 2 in. into the unit closet?"))
    return r

# ---------------- Submittals (Procore-shaped, one row per revision)
RESP_ID = {"Approved": 81, "Approved as Noted": 82, "Revise and Resubmit": 83, None: 80}
def sub(id_, num, rev, title, sp, status, bic, received, distributed, due, closed_at, response, ros, lead, design_rt,
        internal_rt, buffer, submit_by, rc, recv_from, mgr, approver, current=True, cc=None, lo=None, task=None,
        is_rejected=False, returned=None, desc=None):
    return {
     "id": uid(f"submittal:{id_}"), "org_id": ORG_ID, "project_id": PROJECT_ID,
     "source": "procore", "entity_type": "submittal", "external_id": str(id_),
     "source_url": f"https://app.procore.com/{PROCORE_PROJECT_ID}/project/submittal_logs/{id_}",
     "number": num, "formatted_number": f"{spec[sp]['number']}-{num}", "revision": str(rev), "current_revision": current,
     "title": title, "private": False,  # description omitted: not on the CTO-approved Mode A field list
     "status": {"id": {"Open": 61, "Closed": 62, "Draft": 63}[status], "name": status},
     "type": {"id": 70, "name": "Shop Drawings"},
     "specification_section": spec[sp], "location_id": loc[lo]["id"] if lo else None,
     "cost_code_id": cost_code[cc]["id"] if cc else None,
     "responsible_contractor": pvendor(rc), "received_from": puser(recv_from), "submittal_manager": puser(mgr),
     "ball_in_court": [{**puser(b), "vendor": pvendor(people[b]["co"])} for b in bic],
     "approvers": [{"id": id_ * 10 + 1, "user": puser(approver), "workflow_group_number": 1,
                    "sent_date": iso(distributed), "due_date": iso(due), "returned_date": iso(returned),
                    "response": {"id": RESP_ID[response], "name": response or "Pending"}}],
     "submit_by": iso(submit_by), "issue_date": iso(distributed), "received_date": iso(received),
     "distributed_at": ts(distributed, "11:00") if distributed else None, "due_date": iso(due),
     "closed_at": closed_at, "required_on_site_date": iso(ros), "lead_time": lead,
     "design_team_review_time": design_rt, "internal_review_time": internal_rt, "buffer_time": buffer,
     "is_rejected": is_rejected, "actual_delivery_date": None, "confirmed_delivery_date": None,
     "scheduled_task": task, "created_at": ts(received or submit_by or D(2026,6,1), "08:00"),
    }

def submittals_for(day):
    s = []
    steel_task = {"id": 1230, "name": "A1230 Erect Podium Transfer Steel - Wing B", "key": "p6|A1230"}
    T = "Structural Steel Shop Drawings - Podium Transfer & Embeds"
    s.append(sub(6102, "003", 0, T, "051200", "Closed", [], D(2026,8,27), D(2026,8,27), D(2026,9,10), ts(D(2026,9,10), "16:00"),
        "Revise and Resubmit", D(2026,11,9), 28, 14, 0, 3, D(2026,8,27), "steel", "gus", "kevin", "raj", current=False,
        cc="05-1200", lo="wingB_podium_C47", task=steel_task, is_rejected=True, returned=D(2026,9,10)))
    s.append(sub(6103, "003", 1, T, "051200", "Open", ["raj"], D(2026,9,17), D(2026,9,17), D(2026,10,1), None, None,
        D(2026,11,9), 28, 14, 0, 3, D(2026,9,17), "steel", "gus", "kevin", "raj", cc="05-1200", lo="wingB_podium_C47", task=steel_task))
    win_task = {"id": 2400, "name": "A2400 Install Windows L2-L6", "key": "p6|A2400"}
    W = "Vinyl Windows - Product Data, Shop Drawings, Anchorage Calcs"
    s.append(sub(6200, "001", 0, W, "085313", "Closed", [], D(2026,7,20), D(2026,7,21), D(2026,8,4), ts(D(2026,8,4), "15:00"),
        "Revise and Resubmit", D(2027,2,15), 112, 14, 0, 5, D(2026,7,17), "window", "eli", "kevin", "hannah", current=False,
        cc="08-5313", task=win_task, is_rejected=True, returned=D(2026,8,4)))
    s.append(sub(6201, "001", 1, W, "085313", "Closed", [], D(2026,8,18), D(2026,8,19), D(2026,9,2), ts(D(2026,9,2), "15:00"),
        "Revise and Resubmit", D(2027,2,15), 112, 14, 0, 5, D(2026,8,18), "window", "eli", "kevin", "hannah", current=False,
        cc="08-5313", task=win_task, is_rejected=True, returned=D(2026,9,2)))
    if day == DAY1:
        s.append(sub(6202, "001", 2, W, "085313", "Open", ["hannah"], D(2026,9,21), D(2026,9,22), D(2026,10,6), None, None,
            D(2027,2,15), 112, 14, 0, 5, D(2026,9,21), "window", "eli", "kevin", "hannah", cc="08-5313", task=win_task))
    else:
        s.append(sub(6202, "001", 2, W, "085313", "Closed", [], D(2026,9,21), D(2026,9,22), D(2026,10,6), ts(DAY2, "14:40"),
            "Revise and Resubmit", D(2027,2,15), 112, 14, 0, 5, D(2026,9,21), "window", "eli", "kevin", "hannah", current=False,
            cc="08-5313", task=win_task, is_rejected=True, returned=DAY2))
        s.append(sub(6203, "001", 3, W, "085313", "Draft", ["eli"], None, None, None, None, None,
            D(2027,2,15), 112, 14, 0, 5, D(2026,10,7), "window", "eli", "kevin", "hannah", cc="08-5313", task=win_task))
    s.append(sub(6301, "001", 0, "Switchboards and Main Switchgear", "262413", "Closed", [], D(2026,9,2), D(2026,9,3), D(2026,9,17),
        ts(D(2026,9,18), "12:00"), "Approved as Noted", D(2027,5,3), 210, 14, 0, 10, D(2026,9,1), "elec", "mike", "kevin", "hannah",
        cc="26-2413", task={"id": 3050, "name": "A3050 Procure Switchgear (PO to delivery)", "key": "p6|A3050"}, returned=D(2026,9,18)))
    s.append(sub(6401, "002", 0, "HVAC Ductwork Shop Drawings L2-L6", "233113", "Closed", [], D(2026,9,1), D(2026,9,1), D(2026,9,15),
        ts(D(2026,9,15), "13:00"), "Approved", D(2026,10,1), 21, 14, 0, 0, D(2026,9,1), "mech", "sandra", "kevin", "hannah",
        cc="23-3113", lo="stack07", desc="Ductwork shop drawings L2-L6, based on M-401/M-402 Rev 2", returned=D(2026,9,15)))
    s.append(sub(6501, "001", 0, "Amenity Deck Pavers and Pedestals", "321400", "Draft", ["kevin"], None, None, None, None, None,
        D(2026,12,14), 56, 10, 0, 3, D(2026,10,3), "gc", "kevin", "kevin", "hannah", cc="32-1400", lo="amenity_deck",
        desc="Held by GC pending owner paver selection (base vs Alt 2)"))
    s.append(sub(6601, "001", 0, "Toilet Accessories", "102813", "Open", ["hannah"], D(2026,9,18), D(2026,9,18), D(2026,10,2), None, None,
        D(2027,6,14), 42, 14, 0, 5, D(2026,9,18), "gc", "kevin", "kevin", "hannah", cc="10-2813"))
    s.append(sub(6701, "001", 0, "Elevator Equipment and Cab", "142100", "Closed", [], D(2026,8,10), D(2026,8,11), D(2026,8,25),
        ts(D(2026,8,28), "10:00"), "Approved", D(2027,3,1), 140, 14, 0, 5, D(2026,8,10), "elev", "kevin", "kevin", "hannah", returned=D(2026,8,28)))
    s.append(sub(6801, "001", 0, "Storefront System - Retail", "084113", "Open", ["hannah"], D(2026,9,28), D(2026,9,28), D(2026,10,12), None, None,
        D(2027,3,15), 84, 14, 0, 5, D(2026,9,28), "gc", "kevin", "kevin", "hannah"))
    return s
