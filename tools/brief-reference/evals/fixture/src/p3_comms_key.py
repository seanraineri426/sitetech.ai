"""Part 3: M2 data (emails, meetings) + answer key.  *** ALL DATA FICTIONAL ***"""
from p2_rules_m3 import *

def _addr(p): return {"name": "Linden Yard Project", "email": MAILBOX} if p == "mailbox" else {"name": people[p]["name"], "email": email_of(p)}
def _e(eid, d, hhmm, frm, to, cc, subject, body, attachments=(), thread=None):
    return {"id": f"msg_{eid}", "ref": f"msgraph_outlook:message:msg_{eid}", "mailbox": MAILBOX,
            "conversation_id": thread or f"conv_{eid}", "received_at": ts(d, hhmm),
            "from": _addr(frm), "to": [_addr(p) for p in to], "cc": [_addr(p) for p in cc],
            "subject": subject, "body_text": body, "attachments": list(attachments)}

def emails():
    return {"_FICTIONAL": FICT, "coverage_note": f"Only messages delivered to {MAILBOX} are visible (Exchange RBAC for Applications / application access policy scope). Threads that never copy the project mailbox are invisible.", "emails": [
     _e("E101", DAY1, "11:20", "nina", ["lauren"], ["mike", "mailbox"], "Linden Yard - Main Switchgear Quote Q-55120 - pricing expiry",
        "Lauren, reminder that quote Q-55120 for the main switchgear and switchboards ($486,500) is held through Friday 10/9. Current factory lead time is 30 weeks from released PO with approved drawings. After 10/9 we have to re-quote: expect about +4% and a 32-week lead time based on the latest factory allocation. Approved submittal is on file. Please send the PO when ready. - Nina", ["Q-55120_rev2.pdf"]),
     _e("E102", DAY1, "15:05", "hannah", ["kevin"], ["mailbox"], "RE: Linden Yard - Window submittal rev 2 status",
        "Kevin, window rev 2 review is underway. Comments will be out tomorrow. Heads up that anchorage calcs still look unstamped. - Hannah", thread="conv_WIN"),
     _e("E103", DAY1, "16:45", "kevin", ["mailbox"], [], "Lunch & learn delayed to 1pm Thursday",
        "Team - the Thursday lunch & learn on the new punch app is delayed to 1pm. Food arrives at 12:45. No action needed."),
     _e("E104", DAY2, "08:12", "gus", ["priya", "kevin"], ["raj", "dana", "mailbox"], "Linden Yard - Transfer steel shop release / RFI 42",
        "Priya, we still cannot release transfer girder connections to the shop. Embed layout at Grid C/4-7 is open on RFI 42 and our rev 1 shop drawings have been with Tandem since 9/17. To hold our Oct 12 shop slot we need approved drawings (with the RFI 42 embed dimensions resolved) released to us by end of day Friday Oct 9. If we miss it, the next available slot is Oct 26, which pushes delivery of the transfer steel from Nov 9 to approximately Nov 23. Please advise. - Gus Moreno, Bayline Steel"),
     _e("E105", DAY2, "10:31", "sandra", ["priya"], ["mailbox"], "Linden Yard - Notice of delay and additional cost - ASI-07 duct shaft revisions",
        "Priya, please accept this letter as Polar Mechanical's written notice under Subcontract Section 9.3 of delay and additional cost arising from ASI-07 (issued 9/24), which enlarged the duct shaft at Unit Stack 07 after our ductwork shop drawings were approved on 9/15 against Rev 2. Approximately 40% of the Stack 07 duct for L2-L4 is already fabricated to the prior size. We have stopped installation at Stack 07 pending RFI 43. We reserve our right to claim time and cost; pricing will follow within 10 days. - Sandra Kim, Polar Mechanical", ["Polar_Notice_ASI-07.pdf"]),
     _e("E106", DAY2, "11:02", "jake", ["priya"], ["mailbox"], "Pay app 6 - request for expedited payment and retainage reduction",
        "Priya, we need pay app 6 processed early this cycle and are requesting retainage be reduced to 5%. Cash is tight with two jobs starting at once. We had to move part of the crew this week but will be back at full strength soon. - Jake"),
     _e("E107", DAY2, "14:40", "hannah", ["kevin"], ["eli", "mailbox"], "RE: Linden Yard - Window submittal rev 2 status - REVISE AND RESUBMIT",
        "Kevin, window submittal 08 53 13-001 rev 2 is returned Revise and Resubmit. Open items: (1) anchorage calcs must be stamped by a licensed engineer; (2) NFRC labels/certs missing for types W3 and W5; (3) sill flashing must follow new A-501 Rev 4 (ASI-08 issued today). This is the third cycle. Happy to do a 30-minute pre-review call before rev 3 goes in. - Hannah", ["085313-001_rev2_comments.pdf"], thread="conv_WIN"),
     _e("E108", DAY2, "15:30", "priya", ["dana", "marcus"], ["mailbox"], "Linden Yard - 2-week lookahead (wk of 10/5)",
        "Attached is the 2-week lookahead. Framing continues on Wing A L4. L2 close-in pending re-inspection. Elevator pit excavation paused at rock; RFI 41 with Tandem. Steel shop drawings still with Tandem. - Priya", ["LY_Lookahead_wk1005.pdf"]),
     _e("E109", DAY2, "16:05", "carol", ["dana"], ["priya", "mailbox"], "Linden Yard - Draw 9 site visit",
        "Dana, confirming our site visit for Draw #9 on Tuesday 10/13 at 9am. Please have the GC's pay app with sub requisitions and the current schedule update available. - Carol Diaz, Ridgeway CM"),
     _e("E110", DAY2, "16:40", "bill", ["priya"], ["kevin", "mailbox"], "Wing B elevator pit - rock removal pricing",
        "Priya, rock removal pricing for the Wing B elevator pit will come Friday. Hoe-ram and haul-off; our crew is idle on the east half until we hear from Tandem on RFI 41. - Bill"),
     _e("E111", DAY2, "17:10", "dana", ["priya"], ["marcus", "mailbox"], "PCO-014 storefront upgrade - approved",
        "Priya, Larkspur approves PCO-014 (retail storefront upgrade) at $118,000. Please issue the change order for signature. Still working through the paver selection internally. - Dana"),
     # Trap N7: automated delivery-delay, later GC email confirms material on site (email-received path; no delivery_log).
     _e("E112", DAY1, "07:05", "nina", ["lauren"], ["mailbox"], "Delivery delayed - Sales Order SO-44108",
        "This is an automated notice. Sales Order SO-44108 (Linden Yard - conduit and cable tray accessories) delivery status: DELAYED. Revised ship date: 10/10/2026. Please do not reply.",
        thread="conv_SO44108"),
     _e("E113", DAY2, "07:40", "tom", ["lauren"], ["priya", "mailbox"], "RE: Delivery delayed - Sales Order SO-44108",
        "Lauren - ignore this notice. Material on site and inventoried this morning; SO-44108 tagged in the west laydown. - Tom",
        thread="conv_SO44108"),
    ]}

def meetings():
    return {"_FICTIONAL": FICT, "meetings": [
     {"id": 9914, "ref": "procore:meeting:9914", "title": "OAC Meeting #14", "date": "2026-09-29",
      "attendees": ["Dana Whitfield", "Marcus Bell", "Priya Nair", "Tom Alvarez", "Hannah Cole", "Raj Mehta"], "items": [
       {"id": 991401, "ref": "procore:meeting_item:991401", "number": "14.03", "type": "decision_pending", "text": "Owner to confirm amenity deck paver selection (base vs Alt 2, +$22k ROM) so GC can submit and buy out pavers.", "assignee": "Dana Whitfield", "due_date": "2026-10-03", "status": "open", "carried_from": ["12.09", "13.07"]},
       {"id": 991402, "ref": "procore:meeting_item:991402", "number": "14.05", "type": "action", "text": "Architect/SEOR to answer RFI 42 (embed layout Grid C/4-7) and return steel shop drawings rev 1.", "assignee": "Raj Mehta", "due_date": "2026-10-02", "status": "open"},
       {"id": 991403, "ref": "procore:meeting_item:991403", "number": "14.06", "type": "action", "text": "GC to issue switchgear PO now that submittal is approved.", "assignee": "Lauren Pike", "due_date": "2026-09-30", "status": "open"},
       {"id": 991404, "ref": "procore:meeting_item:991404", "number": "14.08", "type": "decision_made", "text": "Owner accepts VE: corridor LVT in lieu of carpet. Credit of $38,000 to be issued as a deductive CO.", "assignee": "Priya Nair", "due_date": "2026-10-13", "status": "open"}]},
     {"id": 9915, "ref": "procore:meeting:9915", "title": "OAC Meeting #15", "date": "2026-10-13", "status": "scheduled", "items": []},
    ]}

def expected():
    F = []
    def f(**k): F.append(k)
    f(id="F1", title="Transfer steel critical-path threat: RFI 42 overdue 7d + steel shop drawings rev 1 overdue 5d with SEOR + fabricator needs release by Fri 10/9 or shop slot slips 2 weeks + A1230 total float eroded 8 -> 3 wd",
      section="schedule_risks", must_surface=True, reference_rank=2, rank_expectation="top 2", min_severity="critical",
      required_citations=["procore:rfi:9042", "procore:submittal:6103", "msgraph_outlook:message:msg_E104", "p6:activity:A1230", "p6:activity:A1225", "procore:meeting_item:991402"], min_citations_matched=3,
      key_facts={"decision_deadline": "2026-10-09", "rfi_days_overdue": 7, "submittal_days_overdue": 5, "tf_wd_u1_u2": [8, 3], "delivery_slip_if_missed_cd": 14,
                 "delivery_slip_if_missed_wd": 10, "tco_impact_wd_if_missed": {"value": 7, "tolerance": 3},
                 "usd_exposure_if_missed": {"value": 192000, "tolerance_pct": 35, "method": "TCO 2027-08-27 -> 2027-09-08 = 12 calendar days x $16,000/cd"}},
      expected_owner_roles=["Structural EOR (Raj Mehta, Tandem)", "GC Sr PM (Priya Nair)"],
      expected_action="Get RFI 42 answered and rev 1 returned by Thu 10/8 so Bayline can release by Fri 10/9; ask Bayline about partial release of non-embed members",
      confidence_expectation="Confirmed for dates/overdue facts; Likely for TCO impact (schedule source is aging)", new_or_worse="WORSE")
    f(id="F2", title="Window submittal 08 53 13-001: third revise-and-resubmit; rev 3 must be submitted by 10/7 to hold ROS 2027-02-15 (112-day lead); must incorporate A-501 Rev 4 issued today",
      section="overdue_submittals", must_surface=True, reference_rank=5, rank_expectation="top 7", min_severity="high",
      required_citations=["procore:submittal:6202", "procore:submittal:6203", "msgraph_outlook:message:msg_E107", "procore:drawing_revision:7751", "p6:activity:A2400"], min_citations_matched=2,
      key_facts={"rr_cycles": 3, "latest_return_date": "2026-10-21", "rev3_submit_by": "2026-10-07", "margin_days": 0, "lead_time_days": 112, "a2400_tf_wd": 12},
      expected_owner_roles=["GC PE (Kevin Osei)", "ClearSpan PM (Eli Novak)", "Architect (Hannah Cole)"],
      expected_action="Take the architect's pre-review call; resubmit with stamped calcs, NFRC certs and the A-501 Rev 4 sill detail by 10/7; ask for a 7-day review",
      confidence_expectation="Confirmed", new_or_worse="WORSE (R&R returned today)")
    f(id="F3", title="Switchgear PO-0117 still Draft 18 days after submittal approval; quote expires Fri 10/9 (+4%, lead time 30 -> 32 wk); A3050 float 15 -> 10 wd and eroding ~1 wd per workday",
      section="procurement_issues", must_surface=True, reference_rank=1, rank_expectation="top 2", min_severity="high",
      required_citations=["procore:commitment:3401", "procore:submittal:6301", "msgraph_outlook:message:msg_E101", "p6:activity:A3050", "procore:meeting_item:991403"], min_citations_matched=3,
      key_facts={"po_status": "Draft", "quote_expiry": "2026-10-09", "escalation_usd": {"value": 19460, "tolerance_pct": 5}, "tf_wd_u1_u2": [15, 10],
                 "est_tf_wd_as_of_2026_10_06": {"value": 4, "tolerance": 1}, "lead_time_after_expiry_weeks": 32},
      expected_owner_roles=["GC Procurement Manager (Lauren Pike)", "GC Sr PM (Priya Nair)"],
      expected_action="Issue PO-0117 before Fri 10/9 at the quoted price and lead time",
      confidence_expectation="Confirmed (PO status, quote terms); Likely (float estimate past XER data date)", new_or_worse="NEW")
    f(id="F4", title="Owner contingency 92.4% used incl. pending at 46% complete; $95k left; CE-030 and CE-031 unpriced",
      section="cost_risks", must_surface=True, reference_rank=3, rank_expectation="top 7", min_severity="high",
      required_citations=["procore:budget_snapshot:20261006", "procore:change_event:3515", "procore:change_event:3514"], min_citations_matched=2,
      key_facts={"contingency_original_usd": 1250000, "approved_usd": 612000, "pending_usd": 543000, "remaining_usd": 95000, "pct_used": {"value": 0.924, "tolerance": 0.005}, "pct_complete": 0.46},
      expected_owner_roles=["Owner Development Director (Dana Whitfield)", "VP Construction (Marcus Bell)"],
      expected_action="Owner to set contingency strategy before approving more PCOs; require priced CE-030/CE-031 by a date",
      confidence_expectation="Confirmed", new_or_worse="WORSE (+$145k CE-031 today)")
    f(id="F5", title="Timberline pay app 6 bills Wing A framing at 62% vs ~35% schedule-earned (~$700k ahead of schedule-earned value); asks to cut retainage to 5%; lender Draw 9 visit Tue 10/13",
      section="cost_risks", must_surface=True, reference_rank=4, rank_expectation="top 7", min_severity="high",
      required_citations=["procore:requisition:33056", "p6:activity:A1500", "msgraph_outlook:message:msg_E106", "msgraph_outlook:message:msg_E109"], min_citations_matched=2,
      key_facts={"billed_pct": 0.62, "schedule_earned_pct": {"value": 0.35, "tolerance": 0.05}, "overbilling_usd": {"value": 702000, "tolerance_pct": 15}, "lender_visit": "2026-10-13"},
      expected_owner_roles=["GC Sr PM (Priya Nair)", "Owner (Dana Whitfield)"],
      expected_action="Hold the Wing A framing line to verified in-place %; defer the retainage reduction; reconcile before the Draw 9 visit",
      confidence_expectation="Likely (schedule-earned % uses an aging XER and duration weighting)", new_or_worse="NEW")
    f(id="F6", title="Framing manpower on critical A1500 (TF 0) fell 14 -> 6 vs 16 planned; not weather; with F5 + E106 this is a subcontractor financial-distress pattern",
      section="schedule_risks", must_surface=True, reference_rank=6, rank_expectation="top 7", min_severity="high",
      required_citations=["procore:manpower_log:80105", "procore:manpower_log:80104", "p6:activity:A1500", "procore:weather_log:80202", "msgraph_outlook:message:msg_E106", "procore:notes_log:80402"], min_citations_matched=3,
      key_facts={"workers_day1": 14, "workers_day2": 6, "planned_crew": 16, "a1500_tf_wd": 0, "weather_delay": False},
      expected_owner_roles=["Superintendent (Tom Alvarez)", "GC Sr PM (Priya Nair)"],
      expected_action="Get a written manpower recovery commitment from Timberline; line up a supplemental crew; review subcontract default/notice provisions",
      confidence_expectation="Confirmed (manpower); Likely (distress inference)", new_or_worse="NEW", composite_with=["F5"])
    f(id="F7", title="Owner paver decision (OAC 14.03) 3 days late and carried forward from 2 prior OAC meetings (on 3 agendas); paver submittal not submitted (submit-by 10/3); zero ROS margin; scope not bought out",
      section="unresolved_decisions", must_surface=True, rank_expectation="any", min_severity="medium",
      required_citations=["procore:meeting_item:991401", "procore:submittal:6501", "procore:rfi:9044", "msgraph_outlook:message:msg_E111"], min_citations_matched=2,
      key_facts={"decision_due": "2026-10-03", "days_late": 3, "carried_from_meetings": 2, "submit_by_days_overdue": 3, "ros_margin_days": 0},
      expected_owner_roles=["Owner Development Director (Dana Whitfield)"],
      expected_action="Owner to choose base vs Alt 2 by a stated date; cost of waiting = day-for-day erosion of A2800 float (10 wd)",
      confidence_expectation="Confirmed", new_or_worse="WORSE")
    f(id="F8", title="Polar Mechanical formal notice of delay/cost (ASI-07); GC's 21-day notice window to owner runs to 10/15; CE-030 unpriced; Polar's own notice looks late vs the 7-day subcontract clause",
      section="significant_emails", must_surface=True, reference_rank=7, rank_expectation="top 7", min_severity="high",
      required_citations=["msgraph_outlook:message:msg_E105", "procore:change_event:3514", "procore:rfi:9043", "procore:drawing_revision:7741"], min_citations_matched=2,
      key_facts={"event_date": "2026-09-24", "owner_notice_deadline": "2026-10-15", "sub_notice_deadline": "2026-10-01", "sub_notice_timely": False},
      expected_owner_roles=["GC Sr PM (Priya Nair)", "Owner (Dana Whitfield) informed of potential claim"],
      expected_action="GC decides whether to send a pass-through notice by 10/15. Flag Polar's notice timing for a human to decide; do NOT assert entitlement",
      confidence_expectation="Confirmed (notice received, dates); entitlement NOT asserted", new_or_worse="NEW")
    f(id="F9", title="Duct shop drawings approved 9/15 against M-401 Rev 2; Rev 3 (ASI-07) issued 9/24 -> Stack 07 duct already fabricated is at risk of rework",
      section="procurement_issues", must_surface=True, rank_expectation="any (standalone fabrication-hold; never merge)", min_severity="medium",
      required_citations=["procore:submittal:6401", "procore:drawing_revision:7741"], min_citations_matched=2,
      key_facts={"submittal_approved": "2026-09-15", "drawing_rev_issued": "2026-09-24", "a1700_tf_wd": 9},
      required_elements=[
        {"section": "procurement_issues", "value": "approved before revision, confirm fabrication hold", "scope": "related", "gate": True,
         "basis": "PM §5.5 rule 2: standalone fabrication-hold item with dates; never merged into another finding"},
        {"section": "procurement_issues", "value": "9/15", "scope": "related", "gate": False},
        {"section": "procurement_issues", "value": "9/24", "scope": "related", "gate": False}],
      expected_owner_roles=["GC PE (Kevin Osei)"], expected_action="Confirm fabrication hold; re-review the duct shop drawings against M-401 Rev 3 and confirm fabricated quantities",
      confidence_expectation="Confirmed", new_or_worse="NEW")
    f(id="F10", title="L2 plumbing rough-in inspection failed on near-critical A1620 (TF 4); new RFI 46; re-inspection 10/9",
      section="schedule_risks", must_surface=True, rank_expectation="any", min_severity="medium",
      required_citations=["procore:inspection_log:80301", "procore:rfi:9046", "p6:activity:A1620"], min_citations_matched=2,
      key_facts={"result": "Failed", "reinspection": "2026-10-09", "a1620_tf_wd": 4},
      expected_owner_roles=["Superintendent (Tom Alvarez)", "Brightwater foreman (Ray Ortiz)"],
      expected_action="Correct the 3 items and get RFI 46 answered before the 10/9 re-inspection", confidence_expectation="Confirmed", new_or_worse="NEW")
    f(id="F11", title="Rock in Wing B elevator pit: RFI 41 open (due 10/8), CE-031 $145k ROM unpriced, crew idle on east half; A1210 TF 5",
      section="cost_risks", must_surface=True, rank_expectation="any", min_severity="medium",
      required_citations=["procore:rfi:9041", "procore:change_event:3515", "procore:notes_log:80401", "msgraph_outlook:message:msg_E110"], min_citations_matched=2,
      key_facts={"rom_usd": 145000, "a1210_tf_wd": 5, "rfi_due": "2026-10-08"},
      expected_owner_roles=["Structural EOR (Raj Mehta)", "GC Sr PM (Priya Nair)"],
      expected_action="EOR direction on RFI 41 by 10/8 (raise the pit vs remove rock); priced CE-031 by Friday", confidence_expectation="Confirmed", new_or_worse="NEW")
    return {"_FICTIONAL": FICT, "brief_date": iso(DAY2), "compare_to": iso(DAY1),
     "scoring": {"match_rule": "A brief item matches an expected finding if it cites >= min_citations_matched of required_citations AND its numeric key_facts fall within tolerance (exact match where no tolerance given).",
                 "recall_denominator": "findings with must_surface=true",
        "rank_rule": "rank_expectation 'top N' = the matched item must appear within the first N ranked items. reference_rank = position under the DAILY_BRIEF_SPEC.md section 5 reference scoring (informational; used for the rank-correlation metric in EVALS.md, not pass/fail)",
        "merge_rule": "One brief item may satisfy several expected findings (e.g. F5+F6 as a distress composite; F9 is standalone and must not merge) if it meets each one's citation and key_fact criteria"},
     "required_freshness_disclosures": [
        {"source": "schedule", "must_state": "XER data date 2026-09-28, uploaded 2026-10-02", "freshness_band": "aging (8 days since data date)",
         "effect": "Schedule-derived float/forecast claims capped at 'Likely' unless corroborated by fresher records"},
        {"source": "email", "must_state": f"Only {MAILBOX} is covered"},
        {"source": "procore", "must_state": "Nightly DMSA sync time"}],
     "findings": F,
     "status_items": [
      {"id": "S1", "expectation": "RFI 38 appears under 'Closed since last brief' (answered 10/6), NOT in the overdue list", "refs": ["procore:rfi:9038"]},
      {"id": "S2", "expectation": "RFI 39 listed as overdue (6d) but low priority (A3400 TF 35); not in top 7", "refs": ["procore:rfi:9039"]},
      {"id": "S3", "expectation": "Toilet accessories submittal listed as overdue (4d) but low priority (ROS 2027-06-14)", "refs": ["procore:submittal:6601"]},
      {"id": "S4", "expectation": "New decision: owner approved PCO-014 ($118k) by email; Procore CO not yet issued; contingency math unchanged (already counted as pending)", "refs": ["msgraph_outlook:message:msg_E111", "procore:change_event:3512"]},
      {"id": "S5", "expectation": "Unresolved: OAC 14.08 VE credit CO ($38k) due 10/13, not yet late", "refs": ["procore:meeting_item:991404"]}],
     "must_not_flag": [
      {"id": "N1", "ref": "msgraph_outlook:message:msg_E103", "reason": "'delayed' refers to a lunch & learn, not project work"},
      {"id": "N2", "ref": "procore:rfi:9045", "reason": "Closed 10/2; not overdue"},
      {"id": "N3", "ref": "procore:submittal:6701", "reason": "Elevator submittal approved; no risk signal"},
      {"id": "N4", "ref": "procore:drawing_revision:7731", "reason": "S-301 Rev 2 (9/10) predates steel rev 1 receipt (9/17), so it is NOT a revision-after-approval conflict"},
      {"id": "N5", "ref": "procore:weather_log:80202", "reason": "Weather did not cause the manpower drop (clear, no precipitation); the brief must not blame weather"},
      {"id": "N6", "ref": "procore:submittal:6801", "reason": "Storefront in review, not overdue (due 10/12)"},
      {"id": "N7", "ref": "msgraph_outlook:message:msg_E112", "related_refs": ["msgraph_outlook:message:msg_E113"],
       "reason": "Automated delivery-delay for SO-44108; later GC email confirms material on site and inventoried — must not flag as a delivery problem",
       "scope": "anywhere"}]}
