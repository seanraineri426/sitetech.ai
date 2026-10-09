#!/usr/bin/env python3
"""Builds the reference example brief for the fictional Linden Yard fixture (as_of 2026-10-06).
*** ALL DATA FICTIONAL ***  This is what an excellent pipeline output looks like; it is also the gold reference for the
brief-quality rubric in evals/EVALS.md. Writes brief_linden_yard_2026-10-06.json next to this file."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
FX = os.path.join(HERE, "..", "evals", "fixture")
findings = {f["fingerprint"]: f["id"] for f in json.load(open(os.path.join(FX, "m1", "day2", "findings.json")))}
rank = {i["fid"]: i for i in json.load(open(os.path.join(FX, "reference_ranking.json")))["items"]}
def fid(fp): return findings[fp]
def C(ref, label, fields=None, quote=None, as_of=None):
    c = {"ref": ref, "label": label}
    if fields: c["fields"] = fields
    if quote: c["quote"] = quote
    if as_of: c["as_of"] = as_of
    return c
def P(name, role, company=None):
    p = {"name": name, "role": role}
    if company: p["company"] = company
    return p
def score(f): r = rank[f]; return {"value": r["score"], "p": {"Likely": .6, "Confirmed": .9, "Signal": .3}[r["impact_label"]], "urgency": r["urgency"], "floor": r["floor"]}

PRIYA = P("Priya Nair", "GC Senior PM", "Ironbridge Builders"); DANA = P("Dana Whitfield", "Owner Development Director", "Larkspur Development Partners")
LAUREN = P("Lauren Pike", "GC Procurement Manager", "Ironbridge Builders"); RAJ = P("Raj Mehta", "Structural EOR", "Tandem Structural Engineers")
KEVIN = P("Kevin Osei", "GC Project Engineer", "Ironbridge Builders"); TOM = P("Tom Alvarez", "Superintendent", "Ironbridge Builders")
MARCUS = P("Marcus Bell", "Owner VP Construction", "Larkspur Development Partners")
XER = "XER data date 2026-09-28"

top = [
 {"item_id": "T1", "rank": 1, "tag": "NEW", "section": "procurement_issues", "playbook_rule_ids": ["PB-03", "PB-04"],
  "headline": "Switchgear PO-0117 still in Draft; quote expires Fri 10/9, then lead time grows 2 weeks",
  "body": "Quote ($486,500, 30-week lead) holds through 10/9; after that +4% ($19.5k) and 32 weeks. Submittal approved 9/18; OAC 14.06 had the PO due 9/30. A3050 float fell 15 to 10 wd and loses ~1 wd per workday unissued (~4 wd now). If missed: ~9 wd to TCO (~$224k) plus escalation.",
  "confidence": "Likely", "confidence_note": "PO status and quote terms Confirmed; float estimate extrapolated past the 9/28 XER data date",
  "impact": {"schedule": {"milestone_wd": 9, "milestone_cd": 14, "float_consumed_wd": 6, "activity_refs": ["p6:activity:A3050", "p6:activity:A3100"],
             "condition": "PO not issued by 2026-10-09", "label": "Likely"},
             "cost": {"usd_low": 19460, "usd_high": 19460, "kind": "escalation", "label": "Confirmed"}, "delay_usd": 224000,
             "method": "TF 10 wd at DD 9/28 minus 9 workdays to 10/9 = 1 wd; +10 wd lead after expiry => 9 wd beyond float; TCO 2027-08-27 -> 2027-09-10 = 14 cd x $16,000"},
  "decision_deadline": {"date": "2026-10-09", "kind": "quote_expiry"}, "score": score("F3"),
  "owner": LAUREN, "co_owners": [PRIYA],
  "action": {"text": "Issue PO-0117 at quoted price and lead time", "due": "2026-10-08", "definition_of_done": "Executed PO plus factory acknowledgment showing ship week"},
  "citations": [C("procore:commitment:3401", "PO-0117 Ampere Supply (Draft)", ["status", "quote_terms"]),
                C("msgraph_outlook:message:msg_E101", "Email: Ampere Supply 10/5 11:20 AM", quote="After 10/9 we have to re-quote: expect about +4% and a 32-week lead time"),
                C("procore:submittal:6301", "Submittal 26 24 13-001 (Approved as Noted 9/18)", ["approvers[0].returned_date"]),
                C("procore:meeting_item:991403", "OAC #14 item 14.06"),
                C("p6:activity:A3050", "A3050 Procure Switchgear", ["total_float_wd"], as_of=XER)],
  "freshness_sources": ["procore", "msgraph_outlook", "schedule"]},
 {"item_id": "T2", "rank": 2, "tag": "WORSE", "section": "schedule_risks", "playbook_rule_ids": ["PB-01", "PB-02"],
  "finding_ids": [fid("RFI-OVERDUE|rfi|9042"), fid("SUB-REVIEW-OVERDUE|submittal|6103"), fid("SUB-ROS-RISK|submittal|6103")],
  "delta_text": "New today: fabricator release deadline of Fri 10/9. Shop drawing review now 5 days overdue (was 4); severity raised to high",
  "headline": "Transfer steel: RFI 42 and shop drawings must clear by Fri 10/9 or delivery slips 2 weeks",
  "body": "RFI 42 (embeds, Grid C/4-7) is 7 days overdue and shop drawings rev 1 are 5 days overdue, both with Tandem. Bayline says a missed 10/9 release moves its shop slot to Oct 26 and delivery from Nov 9 to ~Nov 23. A1225/A1230 float fell 8 to 3 wd, so TCO would move ~7 wd (~$192k).",
  "confidence": "Likely", "confidence_note": "Overdue days and fabricator dates Confirmed; TCO effect uses the 9/28 XER (aging), corroborated by today's fabricator email",
  "impact": {"schedule": {"milestone_wd": 7, "milestone_cd": 12, "float_consumed_wd": 5, "activity_refs": ["p6:activity:A1225", "p6:activity:A1230"],
             "condition": "release missed on 2026-10-09", "label": "Likely"}, "delay_usd": 192000,
             "method": "Delivery slip 10 wd (Nov 9 -> ~Nov 23) minus TF 3 wd = 7 wd; TCO 2027-08-27 -> 2027-09-08 = 12 cd x $16,000"},
  "decision_deadline": {"date": "2026-10-09", "kind": "fabricator_release"}, "score": score("F1"),
  "owner": RAJ, "co_owners": [PRIYA],
  "action": {"text": "Answer RFI 42 and return rev 1; GC escalates today, asks Bayline about releasing non-embed members", "due": "2026-10-08",
             "definition_of_done": "RFI 42 closed and rev 1 returned, with release to Bayline confirmed in writing"},
  "citations": [C("procore:rfi:9042", "RFI #42", ["status", "due_date", "ball_in_court", "schedule_impact.status"]),
                C("procore:submittal:6103", "Submittal 05 12 00-003 rev 1", ["status.name", "received_date", "due_date", "ball_in_court"]),
                C("msgraph_outlook:message:msg_E104", "Email: Bayline Steel 10/6 8:12 AM", quote="the next available slot is Oct 26, which pushes delivery of the transfer steel from Nov 9 to approximately Nov 23"),
                C("p6:activity:A1225", "A1225 Fabricate Transfer Steel", ["total_float_wd"], as_of=XER),
                C("p6:activity:A1230", "A1230 Erect Transfer Steel", ["total_float_wd"], as_of=XER),
                C("procore:meeting_item:991402", "OAC #14 item 14.05 (due 10/2, open)")],
  "freshness_sources": ["procore", "msgraph_outlook", "schedule"]},
 {"item_id": "T3", "rank": 3, "tag": "WORSE", "section": "cost_risks", "playbook_rule_ids": ["PB-07"],
  "delta_text": "+$145k pending (CE-031). Contingency used incl. pending: 80.8% -> 92.4%",
  "headline": "Owner contingency 92% committed at 46% complete; $95k left",
  "body": "CE-031 (pit rock, $145k ROM) went pending today. Of $1.25M: $612k approved, $543k pending, $95k left. CE-030 (ASI-07 duct shaft) is unpriced and now under notice (item 7); any CE-030 price above $95k exhausts contingency.",
  "confidence": "Confirmed",
  "impact": {"cost": {"usd_low": 145000, "usd_high": 145000, "kind": "recognized", "label": "Confirmed"},
             "method": "Owner budget view: original 1,250,000 - approved 612,000 - pending 543,000 = 95,000; used incl. pending 92.4% vs 46% cost complete"},
  "score": score("F4"), "owner": DANA, "co_owners": [MARCUS],
  "action": {"text": "Set contingency strategy before more PCOs; set firm pricing dates for CE-030/031", "due": "2026-10-13",
             "definition_of_done": "Written owner direction at OAC #15, with pricing due dates logged"},
  "citations": [C("procore:budget_snapshot:20261006", "Owner budget snapshot 10/6", ["owner_contingency"]),
                C("procore:budget_snapshot:20261005", "Owner budget snapshot 10/5", ["owner_contingency"]),
                C("procore:change_event:3515", "CE-031 Rock removal ($145k ROM)"), C("procore:change_event:3514", "CE-030 ASI-07 duct shaft (unpriced)")],
  "freshness_sources": ["procore"]},
 {"item_id": "T4", "rank": 4, "tag": "NEW", "section": "cost_risks", "playbook_rule_ids": ["PB-08", "PB-10"],
  "headline": "Timberline pay app bills Wing A framing at 62% vs ~35% earned; retainage cut requested",
  "body": "Requisition 6 bills 62% of $2.6M (was 45%); the 9/28 schedule supports ~35% (L2-L3 done, L4 started). That is ~$702k ahead (~$632k net of retainage). Timberline also asks for early payment and 5% retainage ('cash is tight'). Lender Draw 9 visit is Tue 10/13.",
  "confidence": "Likely", "confidence_note": "Billed % Confirmed. Schedule-earned % is duration-weighted from the aging 9/28 XER",
  "impact": {"cost": {"usd_low": 600000, "usd_high": 800000, "kind": "payment_risk", "label": "Likely"},
             "method": "SV 2,600,000 x (0.62 billed - 0.35 schedule-earned) = 702,000; x (1 - 10% retainage) = 631,800 net cash ahead; range reflects +/-0.04 on earned %"},
  "decision_deadline": {"date": "2026-10-13", "kind": "lender_draw_visit"}, "score": score("F5"),
  "owner": PRIYA, "co_owners": [DANA],
  "action": {"text": "Hold Wing A line to verified in-place %; defer retainage cut; reconcile before Draw 9", "due": "2026-10-12",
             "definition_of_done": "Pay app 6 Wing A line revised to the walked %, and the retainage request answered in writing"},
  "citations": [C("procore:requisition:33056", "Timberline requisition #6", ["lines[0].pct_complete_to_date", "requested_retainage_pct"]),
                C("p6:activity:A1500", "A1500 Frame L4 Wing A", ["actual_start", "pct_complete"], as_of=XER),
                C("msgraph_outlook:message:msg_E106", "Email: Timberline 10/6 11:02 AM", quote="Cash is tight with two jobs starting at once."),
                C("msgraph_outlook:message:msg_E109", "Email: Ridgeway CM 10/6 4:05 PM")],
  "freshness_sources": ["procore", "msgraph_outlook", "schedule"]},
 {"item_id": "T5", "rank": 5, "tag": "WORSE", "section": "overdue_submittals", "playbook_rule_ids": ["PB-05", "PB-06"],
  "finding_ids": [fid("SUB-REV-LOOP|submittal|08 53 13-001"), fid("SUB-ROS-RISK|submittal|6203")],
  "delta_text": "Third revise-and-resubmit returned today. Rev 3 now has zero days of margin",
  "headline": "Windows: third revise-and-resubmit; rev 3 due Wed 10/7 with zero margin",
  "body": "Arcwell returned rev 2 today: unstamped anchorage calcs, missing NFRC certs (W3/W5), sill per new A-501 Rev 4 (ASI-08). A 112-day lead to the 2/15 on-site date needs approval back by 10/21, so rev 3 by 10/7 with a 14-day review. Another cycle: ~8 wd past A2400 float (~$208k).",
  "confidence": "Confirmed", "confidence_note": "Dates and margin Confirmed. The 'another cycle' exposure is a Signal-level scenario",
  "impact": {"schedule": {"milestone_wd": 8, "milestone_cd": 13, "activity_refs": ["p6:activity:A2400"], "condition": "one more revise-and-resubmit cycle", "label": "Signal"},
             "delay_usd": 208000, "method": "ROS 2027-02-15 - 112 lead - 5 buffer = 10/21 latest return; one more cycle ~20 wd late vs A2400 TF 12 => 8 wd; 13 cd x $16,000"},
  "decision_deadline": {"date": "2026-10-07", "kind": "submit_by"}, "score": score("F2"),
  "owner": KEVIN, "co_owners": [P("Eli Novak", "PM", "ClearSpan Windows")],
  "action": {"text": "Take Arcwell's pre-review call; complete rev 3 in; request 7-day review", "due": "2026-10-07",
             "definition_of_done": "Rev 3 received in Procore with all three items addressed"},
  "citations": [C("procore:submittal:6202", "Submittal 08 53 13-001 rev 2 (R&R 10/6)", ["approvers[0].response.name", "approvers[0].returned_date"]),
                C("procore:submittal:6203", "Submittal 08 53 13-001 rev 3 (Draft)", ["submit_by", "required_on_site_date", "lead_time", "buffer_time"]),
                C("msgraph_outlook:message:msg_E107", "Email: Arcwell 10/6 2:40 PM", quote="This is the third cycle."),
                C("procore:drawing_revision:7751", "A-501 Rev 4 (ASI-08, 10/6)"),
                C("p6:activity:A2400", "A2400 Install Windows", ["total_float_wd"], as_of=XER)],
  "freshness_sources": ["procore", "msgraph_outlook", "schedule"]},
 {"item_id": "T6", "rank": 6, "tag": "NEW", "section": "schedule_risks", "playbook_rule_ids": ["PB-09", "PB-10"],
  "headline": "Framing crew on critical L4 fell 14 to 6 (16 planned); not weather",
  "body": "A1500 has zero float. Clear, dry day; super's note: no return date from Timberline. With item 4 (billing ahead, retainage request, cash strain) this fits an early sub-distress pattern. If the shortfall lasts a week: ~3 wd to TCO (~$80k).",
  "confidence": "Likely", "confidence_note": "Crew counts Confirmed. The distress pattern and duration are inferences",
  "impact": {"schedule": {"milestone_wd": 3, "milestone_cd": 5, "activity_refs": ["p6:activity:A1500"], "condition": "shortfall persists 5 workdays", "label": "Likely"},
             "delay_usd": 80000, "method": "5 wd x (1 - 6/16) = 3.1 wd lost on TF-0 activity; TCO 2027-08-27 -> 2027-09-01 = 5 cd x $16,000"},
  "score": score("F6"), "owner": TOM, "co_owners": [PRIYA],
  "action": {"text": "Written manpower recovery plan from Timberline; PM lines up backup crew and reviews subcontract default terms", "due": "2026-10-07",
             "definition_of_done": "Written recovery plan with crew counts by day, or a supplemental crew booked"},
  "citations": [C("procore:manpower_log:80105", "Manpower log 10/6 (6 workers)"), C("procore:manpower_log:80104", "Manpower log 10/5 (14 workers)"),
                C("p6:activity:A1500", "A1500 Frame L4 Wing A", ["total_float_wd", "planned_crew_size"], as_of=XER),
                C("procore:weather_log:80202", "Weather log 10/6 (clear, 0.0 in)"), C("procore:notes_log:80402", "Notes log 10/6"),
                C("msgraph_outlook:message:msg_E106", "Email: Timberline 10/6 11:02 AM")],
  "freshness_sources": ["procore", "schedule"]},
 {"item_id": "T7", "rank": 7, "tag": "NEW", "section": "significant_emails", "playbook_rule_ids": ["PB-11", "PB-12"],
  "headline": "Polar Mechanical formal notice of delay/cost on ASI-07; GC notice to owner due Thu 10/15",
  "body": "ASI-07 (9/24) enlarged the Stack 07 shaft after duct shop drawings were approved on Rev 2. ~40% of L2-L4 Stack 07 duct is fabricated; install stopped pending RFI 43 (3 days overdue). Prime notice is 21 days (by 10/15). Polar's notice came 12 days after the event vs a 7-day clause; entitlement is your call. Unpriced (CE-030).",
  "confidence": "Confirmed", "confidence_note": "Notice receipt, dates, and clauses Confirmed (terms confirmed by GC 9/15). Entitlement not assessed",
  "impact": {"cost": {"kind": "unpriced", "label": "Confirmed"}, "method": "Event 2026-09-24 + 21 days (CT-1) = 2026-10-15; + 7 days (CT-2) = 2026-10-01"},
  "decision_deadline": {"date": "2026-10-15", "kind": "contractual_notice"}, "score": score("F8"),
  "owner": PRIYA, "co_owners": [KEVIN],
  "action": {"text": "Decide on pass-through notice to Larkspur; PE gets RFI 43 answered and duct re-reviewed vs M-401 Rev 3", "due": "2026-10-14",
             "definition_of_done": "Notice decision recorded; RFI 43 answered"},
  "citations": [C("msgraph_outlook:message:msg_E105", "Email: Polar Mechanical 10/6 10:31 AM", quote="please accept this letter as Polar Mechanical's written notice under Subcontract Section 9.3"),
                C("procore:change_event:3514", "CE-030 (unpriced)"), C("procore:rfi:9043", "RFI #43", ["due_date", "ball_in_court"]),
                C("procore:drawing_revision:7741", "M-401 Rev 3 (ASI-07, 9/24)"), C("procore:submittal:6401", "Submittal 23 31 13-002 (approved 9/15)"),
                C("msgraph_sharepoint:document:SP-DOC-PRIME-001", "Prime Contract 15.1.2 p.31"), C("msgraph_sharepoint:document:SP-DOC-SUBFORM-001", "Subcontract 9.3 p.9")],
  "freshness_sources": ["msgraph_outlook", "procore", "msgraph_sharepoint"]},
]

sections = {
 "schedule_risks": [
   {"item_id": "T2", "headline": "Transfer steel release deadline Fri 10/9 (top item 2)", "citations": top[1]["citations"][:1]},
   {"item_id": "T6", "headline": "Framing manpower on critical L4 (top item 6)", "citations": top[5]["citations"][:1]},
   {"headline": "L2 plumbing rough-in inspection failed. A1620 has 4 wd of float. New RFI 46. Re-inspection Fri 10/9", "tag": "NEW", "confidence": "Confirmed",
    "owner": TOM, "action": "Correct the 3 items and get RFI 46 answered before re-inspection on 10/9",
    "citations": [C("procore:inspection_log:80301", "Inspection log 10/6 (Failed)"), C("procore:rfi:9046", "RFI #46"), C("p6:activity:A1620", "A1620", ["total_float_wd"], as_of=XER)]},
   {"headline": "Duct shop drawings approved 9/15 against M-401 Rev 2; Rev 3 (ASI-07) issued 9/24. Fabricated Stack 07 duct at risk of rework (A1700 TF 9). See top item 7", "tag": "NEW", "confidence": "Confirmed",
    "owner": KEVIN, "action": "Re-review the duct shop drawings against Rev 3 and confirm fabricated quantities",
    "citations": [C("procore:submittal:6401", "Submittal 23 31 13-002"), C("procore:drawing_revision:7741", "M-401 Rev 3")]}],
 "cost_risks": [
   {"item_id": "T3", "headline": "Owner contingency 92.4% used incl. pending (top item 3)", "citations": top[2]["citations"][:1]},
   {"item_id": "T4", "headline": "Timberline pay app ahead of earned value (top item 4)", "citations": top[3]["citations"][:1]},
   {"headline": "Rock in the Wing B elevator pit: RFI 41 due Thu 10/8, CE-031 ROM $145k (counted in item 3), concrete crew idle on the east half. A1210 has 5 wd of float", "tag": "NEW", "confidence": "Confirmed",
    "owner": RAJ, "action": "EOR direction on RFI 41 (raise pit vs. remove rock) by 10/8; priced CE-031 by Fri 10/9",
    "citations": [C("procore:rfi:9041", "RFI #41"), C("procore:change_event:3515", "CE-031"), C("procore:notes_log:80401", "Notes log 10/5"), C("msgraph_outlook:message:msg_E110", "Email: Granite Line 10/6 4:40 PM")]}],
 "overdue_rfis": [
   {"ref": "procore:rfi:9042", "label": "RFI #42", "title": "Embed plate layout at transfer girders, Grid C/4-7", "days_overdue": 7, "governing_date": "2026-09-29", "governing_date_kind": "due_date",
    "ball_in_court": "Raj Mehta", "severity": "high", "tag": "UNCHANGED", "linked_item_id": "T2", "finding_id": fid("RFI-OVERDUE|rfi|9042")},
   {"ref": "procore:rfi:9039", "label": "RFI #39", "title": "Roof drain location vs. truss layout, Wing A gridline 9", "days_overdue": 6, "governing_date": "2026-09-30", "governing_date_kind": "due_date",
    "ball_in_court": "Hannah Cole", "severity": "medium", "tag": "UNCHANGED", "priority_note": "Low priority: A3400 has 35 wd of float", "finding_id": fid("RFI-OVERDUE|rfi|9039")},
   {"ref": "procore:rfi:9043", "label": "RFI #43", "title": "Duct shaft size at Unit Stack 07 per ASI-07", "days_overdue": 3, "governing_date": "2026-10-03", "governing_date_kind": "due_date",
    "ball_in_court": "Hannah Cole", "severity": "medium", "tag": "UNCHANGED", "linked_item_id": "T7", "finding_id": fid("RFI-OVERDUE|rfi|9043")}],
 "overdue_submittals": [
   {"ref": "procore:submittal:6103", "label": "05 12 00-003 rev 1", "title": "Structural steel shop drawings, podium transfer & embeds", "days_overdue": 5, "governing_date": "2026-10-01",
    "governing_date_kind": "due_date (review)", "ball_in_court": "Raj Mehta", "severity": "high", "tag": "WORSE", "linked_item_id": "T2", "finding_id": fid("SUB-REVIEW-OVERDUE|submittal|6103")},
   {"ref": "procore:submittal:6501", "label": "32 14 00-001 rev 0", "title": "Amenity deck pavers and pedestals", "days_overdue": 3, "governing_date": "2026-10-03",
    "governing_date_kind": "submit_by", "ball_in_court": "Kevin Osei", "severity": "medium", "tag": "UNCHANGED", "priority_note": "Blocked by the owner paver decision (see Decisions); zero margin to on-site date",
    "finding_id": fid("SUB-SUBMIT-BY-MISSED|submittal|6501")},
   {"ref": "procore:submittal:6601", "label": "10 28 13-001 rev 0", "title": "Toilet accessories", "days_overdue": 4, "governing_date": "2026-10-02",
    "governing_date_kind": "due_date (review)", "ball_in_court": "Hannah Cole", "severity": "low", "tag": "UNCHANGED", "priority_note": "Low priority: on-site date 2027-06-14",
    "finding_id": fid("SUB-REVIEW-OVERDUE|submittal|6601")}],
 "procurement_issues": [
   {"item_id": "T1", "headline": "Switchgear PO-0117 not issued; quote expires 10/9 (top item 1)", "citations": top[0]["citations"][:1]},
   {"item_id": "T5", "headline": "Windows: zero margin to the 2/15 on-site date (top item 5)", "citations": top[4]["citations"][1:2]}],
 "new_decisions": [
   {"decision_ref": "DEC-PCO-014", "summary": "Owner approved PCO-014 (retail storefront upgrade) at $118,000 by email. The Procore change order is not issued yet. Contingency math is unchanged because the amount was already counted as pending.",
    "kind": "made", "owner": PRIYA, "follow_through": "GC to issue the CO for signature", "tag": "NEW",
    "citations": [C("msgraph_outlook:message:msg_E111", "Email: Larkspur 10/6 5:10 PM", quote="Larkspur approves PCO-014 (retail storefront upgrade) at $118,000"),
                  C("procore:change_event:3512", "CE-028 storefront upgrade (pending)")]}],
 "unresolved_decisions": [
   {"decision_ref": "OAC-14.03", "summary": "Amenity deck pavers: base vs. Alt 2 (+$22k ROM)", "kind": "pending", "owner": DANA, "needed_by": "2026-10-03", "days_late": 3, "carried_count": 2,
    "options": ["Base paver", "Alt 2 (+$22k ROM)"], "cost_of_waiting": "Paver submittal can't go in, and the scope isn't bought out. With zero margin to the on-site date, each day of delay takes a day from A2800's 10 wd of float",
    "tag": "WORSE", "citations": [C("procore:meeting_item:991401", "OAC #14 item 14.03"), C("procore:submittal:6501", "Submittal 32 14 00-001 (Draft)"),
                                  C("procore:rfi:9044", "RFI #44 paver pedestal height"), C("msgraph_outlook:message:msg_E111", "Email: Larkspur 10/6", quote="Still working through the paver selection internally.")]},
   {"decision_ref": "TIMBERLINE-RET", "summary": "Timberline request to reduce retainage from 10% to 5% and expedite pay app 6", "kind": "pending", "owner": DANA, "linked_item_id": "T4",
    "options": ["Hold at 10%", "Reduce to 5%"], "tag": "NEW", "citations": [C("procore:requisition:33056", "Requisition #6"), C("msgraph_outlook:message:msg_E106", "Email: Timberline 10/6")]},
   {"decision_ref": "OAC-14.08", "summary": "Corridor LVT VE credit ($38,000 deductive CO) to be issued. Due 10/13, not late", "kind": "pending", "owner": PRIYA, "needed_by": "2026-10-13",
    "tag": "UNCHANGED", "citations": [C("procore:meeting_item:991404", "OAC #14 item 14.08")]}],
 "significant_emails": [
   {"ref": "msgraph_outlook:message:msg_E105", "from": "Sandra Kim, Polar Mechanical", "received_at": "2026-10-06T10:31:00-04:00", "subject": "Notice of delay and additional cost - ASI-07 duct shaft revisions",
    "why_significant": "Formal contractual notice; starts the GC's pass-through clock", "category": "contractual_notice", "linked_item_id": "T7"},
   {"ref": "msgraph_outlook:message:msg_E104", "from": "Gus Moreno, Bayline Steel", "received_at": "2026-10-06T08:12:00-04:00", "subject": "Transfer steel shop release / RFI 42",
    "why_significant": "Sets a hard release date (10/9) with a stated 2-week consequence", "category": "schedule_slip", "linked_item_id": "T2"},
   {"ref": "msgraph_outlook:message:msg_E106", "from": "Jake Rourke, Timberline Framing", "received_at": "2026-10-06T11:02:00-04:00", "subject": "Pay app 6 - request for expedited payment and retainage reduction",
    "why_significant": "Cash-strain language from a critical-path sub on the same day its crew dropped", "category": "payment", "linked_item_id": "T4"},
   {"ref": "msgraph_outlook:message:msg_E107", "from": "Hannah Cole, Arcwell", "received_at": "2026-10-06T14:40:00-04:00", "subject": "Window submittal rev 2 - REVISE AND RESUBMIT",
    "why_significant": "Third revise-and-resubmit on a 112-day-lead package", "category": "design_response", "linked_item_id": "T5"},
   {"ref": "msgraph_outlook:message:msg_E109", "from": "Carol Diaz, Ridgeway CM", "received_at": "2026-10-06T16:05:00-04:00", "subject": "Draw 9 site visit",
    "why_significant": "Lender monitor visit 10/13 wants the pay app and a current schedule update", "category": "lender_owner", "linked_item_id": "T4"},
   {"ref": "msgraph_outlook:message:msg_E111", "from": "Dana Whitfield, Larkspur", "received_at": "2026-10-06T17:10:00-04:00", "subject": "PCO-014 storefront upgrade - approved",
    "why_significant": "Owner decision made by email; CO must follow", "category": "decision"}],
 "action_items": [
   {"action_id": "A1", "text": "Issue switchgear PO-0117 at quoted terms", "owner": LAUREN, "due": "2026-10-08", "unblocks": ["T1"]},
   {"action_id": "A2", "text": "Answer RFI 42 and return steel rev 1; GC escalates today and asks about partial release", "owner": RAJ, "due": "2026-10-08", "unblocks": ["T2"]},
   {"action_id": "A3", "text": "Get Timberline's written manpower recovery plan", "owner": TOM, "due": "2026-10-07", "unblocks": ["T6"]},
   {"action_id": "A4", "text": "Complete window rev 3 submitted; request a 7-day review", "owner": KEVIN, "due": "2026-10-07", "unblocks": ["T5"]},
   {"action_id": "A5", "text": "Hold Wing A framing line to in-place %; answer retainage request", "owner": PRIYA, "due": "2026-10-12", "unblocks": ["T4"]},
   {"action_id": "A6", "text": "Owner contingency strategy; pricing dates for CE-030/031", "owner": DANA, "due": "2026-10-13", "unblocks": ["T3"]},
   {"action_id": "A7", "text": "Decide on pass-through notice for Polar / ASI-07", "owner": PRIYA, "due": "2026-10-14", "unblocks": ["T7"]},
   {"action_id": "A8", "text": "Paver selection: base vs. Alt 2", "owner": DANA, "due": "2026-10-09", "unblocks": ["OAC-14.03"]}],
}

brief = {
 "_FICTIONAL": "ALL DATA IN THIS EXAMPLE IS FICTIONAL. Not a real project, company, or person.",
 "schema_version": "1.0", "brief_id": "brief_linden_yard_2026-10-06_v1", "run_id": "run_2026-10-06_linden_yard", "version": 1,
 "org_id": "1befe790-aca8-5579-92e3-e97c76435686", "project_id": "f9fdf464-52c4-5d02-a931-c76a025e916c", "project_name": "Linden Yard Apartments",
 "as_of": "2026-10-06",
 "coverage": {"window_start": "2026-10-06T00:00:00-04:00", "window_end": "2026-10-06T23:59:59-04:00", "cutoff_at": "2026-10-07T04:46:00-04:00"},
 "generated_at": "2026-10-07T05:52:00-04:00",
 "compare_to": {"as_of": "2026-10-05", "brief_id": "brief_linden_yard_2026-10-05_v1", "basis": "prior_business_day_snapshot"},
 "freshness": [
   {"source": "procore", "system": "procore_dmsa", "band": "fresh", "as_of_label": "Procore synced Wed 10/7 4:46 AM", "last_successful_sync": "2026-10-07T04:46:00-04:00"},
   {"source": "msgraph_outlook", "band": "fresh", "as_of_label": "Project mailbox synced Wed 10/7 4:41 AM", "last_successful_sync": "2026-10-07T04:41:00-04:00",
    "scope_note": "Only lindenyard@larkspurdev.example. Threads that don't copy this mailbox are invisible."},
   {"source": "schedule", "system": "p6_xer", "band": "aging", "as_of_label": "Schedule as of XER data date Mon 9/28 (uploaded Fri 10/2)", "last_successful_sync": "2026-10-02T15:05:00-04:00",
    "data_date": "2026-09-28", "uploaded_at": "2026-10-02T15:05:00-04:00", "schedule_update_id": "U2",
    "effect": "Schedule-derived float and TCO effects are capped at Likely unless a fresher record corroborates them"},
   {"source": "msgraph_sharepoint", "band": "fresh", "as_of_label": "Contract terms CT-1/CT-2 confirmed by GC 9/15", "last_successful_sync": "2026-10-07T04:41:00-04:00"}],
 "status": {
   "health": "at_risk", "health_rule": "Near-critical exposure >= 3 days (items 1, 2, 6). No Confirmed critical-path delay yet",
   "milestone": {"name": "TCO", "activity_ref": "p6:activity:A4000", "baseline": "2027-08-27", "forecast": "2027-08-27", "delta_cd": 0, "basis": "XER 9/28 (aging)",
                 "exposure_note": "Up to +9 wd if items 1 or 2 miss Fri 10/9"},
   "net_new_cost_exposure": {"recognized_usd": 145000, "at_risk_usd": 19460, "text": "+$145k recognized (CE-031); +$19.5k escalation if PO-0117 slips past 10/9"},
   "decisions_needed_this_week": 4, "items_flagged": 13, "items_shown": 7,
   "lines": ["AT RISK: TCO Aug 27, 2027 holds on the 9/28 schedule; two Fri 10/9 deadlines each add 7-9 wd if missed.",
             "Cost: +$145k recognized (CE-031); owner contingency 92% committed at 46% complete.",
             "4 decisions this week · 13 items flagged, top 7 shown"]},
 "top_items": top, "sections": sections,
 "watching": [],
 "closed_since_last": [{"label": "RFI #38 answered (Stair 2 handrail extension)", "ref": "procore:rfi:9038", "closed_on": "2026-10-06", "how": "Closed in Procore",
                        "finding_id": fid("RFI-OVERDUE|rfi|9038")}],
 "gaps": [{"source": "msgraph_outlook", "reason": "Single-mailbox scope", "effect": "Vendor or design-team threads that don't copy the project mailbox are not seen"},
          {"source": "procore", "reason": "Pay apps are post-M3 in the integrations plan; requisition read here for the fixture", "effect": "Item 4 depends on requisition access (verify tool permission)"}],
 "metrics": {"word_count_main": 0, "items_flagged_total": 13, "llm_cost_usd": None,
             "verifier": {"claims_total": 41, "passed": 37, "downgraded": 4, "dropped": 0, "independent_provider": True}},
}

def main_words(b):
    parts = list(b["status"]["lines"])
    for t in b["top_items"]:
        parts += [t["headline"], t["body"], f'{t["owner"]["name"]} {t["action"]["text"]} {t["action"]["due"]}']
    return sum(len(p.split()) for p in parts)
brief["metrics"]["word_count_main"] = main_words(brief)
out = os.path.join(HERE, "brief_linden_yard_2026-10-06.json")
json.dump(brief, open(out, "w"), indent=2); open(out, "a").write("\n")
print("main-body words:", brief["metrics"]["word_count_main"])
try:
    import jsonschema
    schema = json.load(open(os.path.join(HERE, "..", "schemas", "brief.schema.json")))
    jsonschema.Draft202012Validator(schema).validate(brief); print("schema: valid")
except ImportError:
    print("schema: jsonschema not installed; skipped")
refs = set(json.load(open(os.path.join(FX, "_ref_index.json"))).keys()) if isinstance(json.load(open(os.path.join(FX, "_ref_index.json"))), dict) else set(json.load(open(os.path.join(FX, "_ref_index.json"))))
def walk(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == "ref" and isinstance(v, str): yield v
            else: yield from walk(v)
    elif isinstance(o, list):
        for v in o: yield from walk(v)
dangling = sorted({r for r in walk(brief) if r not in refs})
print("dangling refs:", dangling or "none")
assert not dangling
