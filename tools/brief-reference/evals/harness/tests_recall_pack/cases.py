"""Pack cases (verbatim pack wording, wrapped in minimal FICTIONAL fixtures; builder.py). Each case:
  id, pattern, pol: pos (must fire) | neg (must NOT fire) | guard (fires, but only with the safe shape the pack names),
  fx: builder spec, expect: what counts as caught (rule ids, cited record refs, types), gold: extraction gold per email ref."""
from .builder import email, eref, rfi, rref, ce, act, PARTIES

APEX = "Apex Switchgear Supply (FICTIONAL) (sub)"; VOLT = "Voltline Electric (FICTIONAL) (sub)"; CREST = "Crestline Glass (FICTIONAL) (sub)"
RIDGE = "Ridgeback Concrete (FICTIONAL) (sub)"; UNKNOWN = "unknown party"
GEAR_SUBJ = "RE: Main switchgear 26 24 13-001 - release and delivery"
SLIP = "SCH-EMAIL-DATE-SLIP"
NOTICE = {"EMAIL-NOTICE-LANGUAGE", "EMAIL-FORMAL-NOTICE"}
CASES = []

def P1(n, body, date, *, subj=GEAR_SUBJ, who="apex", pol="pos", act_id="A100", sub_no="26 24 13-001", day=None, kind="schedule_date_change",
       extra_emails=(), tol=0, party=APEX, label=None, as_of=None, date_hi=None):
    eid = f"msg_P1_{n}"
    e = email(eid, who, subj, body, **({"day": day} if day else {}))
    fx = {"emails": [e] + list(extra_emails)}
    if as_of: fx["as_of"] = as_of; fx["compare_to"] = as_of
    CASES.append({"id": f"P1-{n}", "pattern": "P1", "pol": pol, "fx": fx,
                  "expect": {"rules": {SLIP}, "cite": [eref(eid), "p6:activity:" + act_id], "need_date_or_usd": True, "label": label},
                  "gold": {eref(eid): {"kind": kind, "date": date, "date_hi": date_hi, "date_tol": tol, "ref_key": sub_no, "sender_party": party}}})

# ---------------- P1 email_schedule_slip ----------------
P1("01", "Factory just pushed our ship date to Nov 30.", "2026-11-30")
P1("02", "Realistically we're looking at the week of 11/30 for delivery now.", "2026-11-30")
P1("03", "Lead time on the gear is now 4 weeks longer than quoted.", "2026-11-30")
P1("04", "We lost our production slot \u2014 earliest we can ship is four weeks out from the original.", "2026-11-30")
P1("05", "Heads up: ETA slid to end of November.", "2026-11-30")
P1("06", "Can't make the 11/2 date. Best we can do is 12/1.", "2026-12-01")
P1("07", "Tempering line is down; add about a month to delivery.", "2026-12-02", subj="RE: Storefront glazing 08 41 13-001 - delivery",
   who="crest", act_id="A130", sub_no="08 41 13-001", tol=3, party=CREST)
P1("08", "Revised schedule attached \u2014 first truck now 11/28.", "2026-11-28")
# pack: "earliest end of month" — sent 11/1 so "end of month" resolves to 11/30 (sent in October it would resolve to 10/31, before the 11/2 need date)
P1("09", "Ship is TBD, earliest end of month, I'll confirm next week.", "2026-11-30", day="2026-11-01", as_of="2026-11-01", label="Likely")
P1("10", "Due to the backlog we will be approx. 3-4 wks late on the switchboards.", "2026-11-23", subj="RE: Switchboards 26 24 16-001 - status",
   act_id="A110", sub_no="26 24 16-001", date_hi="2026-11-30")
P1("11", "Jo - see thread below re: the feeder schedule.\n\n> From: Omar Hale\n> Gear pads are poured, thanks.\n\n> From: Rita Vance\n> Confirming switchboard paperwork is in. "
         "...also FYI the panels are slipping to 12/1, sorry for the late notice.", "2026-12-01",
   subj="RE: RE: RE: Panelboards 26 24 19-001 - coordination", act_id="A120", sub_no="26 24 19-001")
P1("12", "Pushed. New target 30-Nov.", "2026-11-30")
# negatives
P1("N1", "Ship date unchanged, still 10/28.", None, pol="neg", kind="no_change")
P1("N2", "We can ship early, 10/20, if you want it.", None, pol="neg", kind="schedule_date_change")
P1("N3", "Slipping to 10/30.", None, pol="neg", kind="schedule_date_change")
CASES.append({"id": "P1-N4", "pattern": "P1", "pol": "neg", "fx": {"emails": [
    email("msg_P1_N4a", "apex", "Main switchgear 26 24 13-001 - delivery delayed", "Delivery delayed - new delivery date 11/20.", day="2026-10-06", conv="conv_N4"),
    email("msg_P1_N4b", "gc", "RE: Main switchgear 26 24 13-001 - delivery delayed", "Update: gear received on site this morning and inventoried in the east laydown.",
          day="2026-10-07", conv="conv_N4")]},
    "expect": {"rules": {SLIP}, "cite": [eref("msg_P1_N4a")]},
    "gold": {eref("msg_P1_N4b"): {"kind": "received_on_site", "ref_key": "26 24 13-001"}}})
CASES.append({"id": "P1-N5", "pattern": "P1", "pol": "neg", "fx": {"emails": [
    email("msg_P1_N5", "apex", "Quick question", "What's the lead time on gear these days? Asking for a future job.")]},
    "expect": {"rules": {SLIP}, "cite": [eref("msg_P1_N5")]},
    "gold": {eref("msg_P1_N5"): {"kind": "inquiry_or_hypothetical", "date": None}}})
P1("N6", "If we don't get approval by Friday, ship could slip.", None, pol="neg", kind="conditional_risk")

# ---------------- P2 rfi_overdue_near_term_start ----------------
NEAR = "RFI-OVERDUE-NEAR-START"
def P2(n, rfis, pol="pos", cite=(), emails=(), gold=None, each=None, **fx):
    CASES.append({"id": f"P2-{n}", "pattern": "P2", "pol": pol, "fx": dict(rfis=rfis, emails=list(emails), **fx),
                  "expect": {"rules": {NEAR}, "cite": list(cite), "need_date_or_usd": True, "each": each}, "gold": gold or {}})
P2("01", [rfi(101, "Storm tie-in invert", due="2026-09-28", spec="33 10 00", question="Confirm storm tie-in invert at MH-3.")], cite=[rref(101), "p6:activity:A200"])
P2("02", [rfi(102, "Slab edge embeds Area B", due=None, created="2026-09-28", spec="03 30 00", question="Confirm slab edge embed spacing at Area B.")],
   cite=[rref(102), "p6:activity:A210"],
   emails=[email("msg_P2_02", "ridge", "RFI 102 - slab edge embeds Area B", "Jo, need this answered before we pour Tuesday. - Sam")],
   gold={eref("msg_P2_02"): {"kind": "need_by_date", "date": "2026-10-13", "ref_key": "102", "sender_party": RIDGE}})
P2("03", [rfi(103, "L2 header sizes", due="2026-10-05", spec="06 10 00", bic="Ian Cole (architect)", question="Confirm header sizes at L2 corridor.")],
   cite=[rref(103), "p6:activity:A220"])
P2("04", [rfi(104, "Duct routing at L3 beam", due="2026-10-01", spec="23 31 00", question="Duct conflicts with beam B3-7.",
              answers=[{"text": "Draft response: lower duct 4 in. (not official)", "official": False}])], cite=[rref(104), "p6:activity:A240"])
P2("05", [rfi(112, "L3 conduit routing", due="2026-10-02", spec="26 05 00", question="Confirm conduit routing above L3 corridor.")],
   cite=[rref(112), "p6:activity:A245"],
   emails=[email("msg_P2_05", "volt", "RFI 112", "Still waiting on the answer to RFI 112, crew mobilizes Monday.")],
   gold={eref("msg_P2_05"): {"kind": "need_by_date", "date": "2026-10-12", "ref_key": "112", "sender_party": VOLT}})
P2("06", [rfi(106, "Hydrant relocation", due="2026-10-01", spec=None, loc="Site > North", question="Relocate hydrant H-2 per civil comments?")],
   cite=[rref(106), "p6:activity:A200"])
P2("07", [rfi(107, "L2 drywall type at shaft", due="2026-10-02", spec="09 21 16", question="Shaft wall type at L2?")],
   cite=[rref(107), "p6:activity:A270"], acts_prev_override={"A270": {"early_start": "2026-11-20", "early_finish": "2026-12-10"}})
P2("08", [rfi(108, "Area C shoring", due="2026-09-30", spec="31 23 00", question="Shoring at Area C east?"),
          rfi(109, "Area C dewatering", due="2026-09-30", spec="31 23 00", question="Dewatering discharge point at Area C?")],
   cite=[rref(108), rref(109), "p6:activity:A280"], each=[rref(108), rref(109)])
P2("09", [rfi(110, "Roof insulation taper", due="2026-10-02", spec="07 21 00", question="Taper layout at RTU-2?",
              answers=[{"text": "Official response pending owner input.", "official": False}])], cite=[rref(110), "p6:activity:A290"])
P2("10", [rfi(111, "Pit sump size", due="2026-10-03", spec="14 21 00", question="Sump pit size per elevator vendor?")], cite=[rref(111), "p6:activity:A260"])
P2("N1", [rfi(120, "Roof drain body", due="2026-09-25", spec="22 14 26", question="Drain body type at roof?")], pol="neg", cite=[rref(120)])
P2("N2", [rfi(121, "Storm structure lid", status="closed", due="2026-10-01", spec="33 10 00", resolved="2026-10-07T15:00:00-04:00",
              question="Lid type at CB-4?", answers=[{"text": "Use traffic-rated lid per detail 4/C-501.", "date": "2026-10-07"}])], pol="neg", cite=[rref(121)],
   emails=[email("msg_P2_N2", "volt", "RFI 121 overdue", "Jo - RFI 121 is overdue and still unanswered, please push the architect.")])
P2("N3", [rfi(122, "Anchor embed depth", due="2026-10-20", spec="08 44 13", question="Embed depth at slab edge?")], pol="neg", cite=[rref(122)])
P2("N4", [rfi(123, "Pour break location", status="closed", due="2026-09-20", spec="03 30 00", resolved="2026-09-25T12:00:00-04:00",
              question="Pour break at grid 4?", answers=[{"text": "Grid 4 pour break acceptable.", "date": "2026-09-25"}], overdue=True)], pol="neg", cite=[rref(123)])

# ---------------- P3 closed_rfi_cost_no_ce ----------------
CLOSED = "RFI-CLOSED-IMPACT-NO-CE"
def P3(n, answer, pol="pos", ces=(), drawings=(), gold_scope=None, **kw):
    num = 300 + int(n) if str(n).isdigit() else 340 + int(str(n)[1:])
    r = rfi(num, kw.pop("subject", f"RFI {num} question"), status="closed", due="2026-10-02", resolved="2026-10-06T10:00:00-04:00",
            question=kw.pop("question", "Please clarify."), answers=[{"text": answer}], **kw)
    CASES.append({"id": f"P3-{n}", "pattern": "P3", "pol": pol, "fx": {"rfis": [r], "ces": list(ces), "drawings": list(drawings)},
                  "expect": {"rules": {CLOSED}, "cite": [rref(num)], "need_date_or_usd": True},
                  "rfi_gold": {rref(num): {"scope_change": gold_scope or ("adds" if pol == "pos" else "none")}}})
P3("01", "Provide solid-core doors at all unit entries.", cost="yes_unknown", subject="Unit entry door core")
P3("02", "Add one layer 5/8 Type X to corridor side.", subject="Corridor wall rating")
P3("03", "Contractor to furnish and install blocking at all grab bars.", subject="Grab bar backing")
P3("04", "See attached revised detail", cost="tbd", subject="Parapet coping detail", gold_scope="unclear")
P3("05", "Use stainless in lieu of galvanized.", subject="Exterior fasteners")
P3("06", "Increase footing size to 4'x4'.", subject="Footing F-7 size")
P3("07", "Owner accepts substitution; any cost to be addressed separately.", subject="Lighting fixture substitution")
P3("08", "Revise per ASI-07 (attached)", subject="Lobby ceiling layout", drawings=[{"ref": "procore:drawing_revision:7707", "number": "A-301",
   "revision": "3", "issued_date": "2026-10-05", "issued_via": "ASI-07", "discipline": "Architectural", "title": "Lobby RCP",
   "description": "ASI-07 adds acoustic cloud ceilings and two additional soffits in the lobby", "spec_sections": ["09 51 13"]}])
P3("09", "Accepted as proposed by the sub.", cost="yes_known", cost_val=18400, subject="Added cleanouts", question="Sub quote $18,400 per sub quote for added cleanouts; confirm.")
P3("10", "Approved; add the two transfer beams shown on SK-12.", cost="yes_unknown", sched="yes_known", sched_val=5, subject="Transfer beams at L2")
P3("N1", "Provide solid-core doors at all unit entries.", pol="neg", cost="yes_unknown", subject="Unit entry door core",
   ces=[ce(4401, "Solid-core unit entry doors", status="pending", rom=22000, priced=True, linked_rfis=["procore:rfi:9341"])], gold_scope="adds")
P3("N2", "Proceed as drawn.", pol="neg", subject="Stair nosing")
P3("N3", "Clarification only, no change to contract.", pol="neg", cost="no_impact", subject="Paint sheen")
P3("N4", "Use either option at contractor's discretion, no cost to owner.", pol="neg", subject="Sealant color")

# ---------------- P4 rfi_differing_site_condition ----------------
DSC = "COST-DIFFERING-SITE-CONDITION"
def P4(n, q, loc, pol="pos", status="open", ces=(), subject=None, gold=None):
    num = 400 + int(n) if str(n).isdigit() else 440 + int(str(n)[1:])
    r = rfi(num, subject or q[:60], status=status, due="2026-10-12", created="2026-10-05", loc=loc, question=q,
            **({"resolved": "2026-10-07T10:00:00-04:00", "answers": [{"text": "Proceed per geotech recommendation.", "date": "2026-10-07"}]} if status == "closed" else {}))
    CASES.append({"id": f"P4-{n}", "pattern": "P4", "pol": pol, "fx": {"rfis": [r], "ces": list(ces)},
                  "expect": {"rules": {DSC}, "cite": [rref(num)], "need_date_or_usd": True, "location": loc if pol == "pos" else None},
                  "rfi_gold": {rref(num): {"differing_site_condition": gold if gold is not None else (pol == "pos")}}})
P4("01", "Encountered rock at elevator pit, 4' above geotech assumption.", "Elevator 1 pit")
P4("02", "Unmarked abandoned oil tank found under play court.", "Site > Play court")
P4("03", "Existing footing in conflict with new grade beam, not shown on survey.", "Grid B/3")
P4("04", "Groundwater at 6' vs 14' in boring logs.", "Bldg > Area C", status="closed")
P4("05", "Buried concrete debris throughout garage SOG area.", "Garage SOG")
P4("06", "Unsuitable soils, over-ex required beyond spec limits.", "Bldg > Area B")
P4("07", "Live gas line not on utility locate.", "Site > North")
P4("08", "Asbestos-wrapped pipe found in chase during demo.", "Level 1 chase C-2")
P4("09", "Contaminated soil per field screening; awaiting lab results.", "Site > East")
P4("10", "Existing slab thickness is 4\" not 6\" as shown.", "Level 1 retail")
P4("N1", "Grid line dimension conflict between A-101 and S-101 at grid 7.", "Grid 7", pol="neg")
P4("N2", "Field note: soils as expected per geotech. Confirm proof-roll sequence for Area A.", "Bldg > Area A", pol="neg")
P4("N3", "Encountered rock at footing F-12 below 6'.", "Grid F/12", pol="neg", gold=True,
   ces=[ce(4501, "Rock removal at F-12 (owner allowance)", status="approved", rom=9000, priced=True, linked_rfis=["procore:rfi:9443"])])

# ---------------- P5 / P6 formal notice mid-thread ----------------
def PN(pat, n, body, types, pol="pos", subj="RE: Level 3 coordination", who="volt", party=VOLT, guard=None):
    eid = f"msg_{pat}_{n}"
    CASES.append({"id": f"{pat}-{n}", "pattern": pat, "pol": pol, "fx": {"emails": [email(eid, who, subj, body)]},
                  "expect": {"rules": NOTICE, "cite": [eref(eid)], "types": set(types or []), "need_date_or_usd": True, "guard": guard},
                  "gold": {eref(eid): {"kind": "formal_notice" if (pol == "pos" or guard) else "not_notice", "notice_types": set(types or []),
                                       "sender_party": party}}})
P5 = lambda n, b, **k: PN("P5", n, b, k.pop("types", ["delay_time_extension"]), **k)
P6 = lambda n, b, **k: PN("P6", n, b, k.pop("types", ["cost_change_claim"]), **k)
P5("01", "Please accept this as formal notice of delay under Article 8.")
P5("02", "This email serves as our written notice of a delay to the critical path.")
P5("03", "We hereby provide notice of a claim for time extension.")
P5("04", "Consider this our notice per \u00a78.3 that we are impacted by the late shaft turnover.")
P5("05", "Jo - parking for the crane day: we'll use the north lot and keep the fire lane clear, flaggers at both gates from 6am. "
         "Deliveries will stage on 3rd St. ...Separately, this constitutes formal notice of delay due to late RTU pads.")
P5("06", "Formal notice: work on Level 3 is delayed due to unresolved RFI 088. We reserve the right to seek additional time.")
P5("07", "Per the subcontract, notice is hereby given of an excusable delay.")
P5("08", "We are formally notifying you of a 10-working-day impact.")
P5("09", "Level 3 rough-in stopped Tuesday when the shaft was not turned over; crews demobilized and we lost 4 days on the L3 sequence.",
   subj="Notice of Delay \u2014 see below.")
P5("10", "Jo, letter below.\n\nNOTICE OF DELAY\nVoltline Electric (fictional)\nDate: 10/8/2026\nRe: Pack Yard - Level 3 electrical\n"
         "Voltline Electric is delayed in the performance of its work at Level 3 due to the late turnover of the electrical room. "
         "Impact to date is 6 working days and continuing.\nSincerely,\nOmar Hale, Project Manager")
P5("N1", "We might be running a bit behind, let's discuss at OAC.", pol="neg", types=[])
P5("N2", "We need to discuss timing.", pol="neg", types=[])
P5("N3", "Reminder that notice periods are 7 days per the contract.", pol="neg", types=[])
P5("N4", "Please accept this as formal notice of delay under Article 8.", pol="guard", who="stranger", party=UNKNOWN, guard="unknown_party")
P6("01", "This is our formal notice of cost claim for the added feeder length.")
P6("02", "Please accept this as notice of a claim for additional compensation.")
P6("03", "We hereby reserve our right to recover costs associated with the directive of 10/2.")
P6("04", "Formal notice: the added blast film is extra work and will be billed as a change.")
P6("05", "Notice of claim for extra costs due to owner-directed resequencing.")
P6("06", "Jo - thanks for the walk. Agree on the sleeve layout.\n\n> On Tue, Omar wrote:\n> Underslab is complete in Area B.\n\n"
         "...and per Article 15 please treat this as our claim for the cost of the underslab drainage.")
P6("07", "We are providing written notice that we consider this a change to our scope and will seek compensation.")
P6("08", "Notice of delay and associated costs", types=["delay_time_extension", "cost_change_claim"])
P6("09", "Formal notice of extra work: overtime required to recover schedule, costs to follow.")
P6("10", "Jo, see below.\n\nNOTICE OF CLAIM\nVoltline Electric (fictional)\nRe: Pack Yard - added feeders\nVoltline Electric hereby submits notice of its claim for "
         "the added cost of the extended feeders directed by field instruction FI-09. Pricing to follow.\nOmar Hale")
P6("N1", "Can you send a CE number so we can price this?", pol="neg", types=[])
P6("N2", "PCO #14 attached for review.", pol="neg", types=[])
P6("N3", "We may submit a claim if this continues.", pol="neg", types=[])

# ---------------- extra guard: name-only activity match -> 'possible schedule impact, confirm activity', no $ ----------------
GUARDS = [{"id": "G-name-only", "fx": {"emails": [email("msg_G1", "apex", "Gear update", "The gear set is late; best we can do is 12/1.")]}}]

def mixed_case():
    """P1 zero-float item (#6) + one item each from P2..P6 in one fixture."""
    pick = {"P1-06", "P2-01", "P3-09", "P4-01", "P5-01", "P6-01"}
    fx = {"emails": [], "rfis": [], "ces": [], "drawings": []}
    for c in CASES:
        if c["id"] in pick:
            for k in fx: fx[k] += c["fx"].get(k, [])
    return {"id": "MIXED", "fx": fx, "p1_ref": eref("msg_P1_06")}
