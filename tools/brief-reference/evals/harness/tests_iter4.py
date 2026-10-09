"""Zero-cost checks for iteration 4 (held-out gaps). No network. Run: /tmp/stvenv/bin/python -m harness.tests_iter4"""
import copy, datetime as dt, json, sys
from .fixture_tools import FixtureTools
from .rules_engine import run_rules, DayView, email_rfi_rules, sch_rules, cost_rules
from .candidates import default_impacts, far_float_overdue_reason
from .stages.rank import rfi_answered_in_procore
from .rules_engine import sub_rr_rules
from .verifier import rfi_overdue_claim_contradicted
from .parties import parties_of, display_from, party_for_email_addr, label
from .notices import for_notice_email
from .stages.rank import delivery_complete_for, DELIVERY_DELAY_RE
from .verifier import delivery_received_any, DELIVERY_DELAY_CLAIM, verify_insights

ok = lambda c, m: print(("PASS " if c else "FAIL ") + m) or bool(c)
res = []
T = FixtureTools()

# --- project_parties ---
ps = parties_of(T.project)
res.append(ok(all(p["role"] in ("owner","architect_engineer","gc","sub") for p in ps) and len(ps) >= 4, f"project_parties roles ok ({len(ps)})"))
res.append(ok("@" not in display_from(T.project, T.emails["emails"][0]) and "Ampere" in display_from(T.project, T.emails["emails"][0]),
              "model-facing From has Company (role), no raw address"))
res.append(ok(party_for_email_addr(T.project, "x@unknown.example") is None, "unknown domain → no party"))
# notice from unknown party
T2 = FixtureTools(); rec = T2.index["msgraph_outlook:message:msg_E105"][1]
saved = rec["from"]; rec["from"] = "Stranger <x@unknown.example>"
n = for_notice_email(T2, "msgraph_outlook:message:msg_E105"); rec["from"] = saved
res.append(ok(n["deadline"] is None and "not a configured project party" in n["display"], "notice from unknown party → deadline unknown"))

# --- Linden: email schedule slip + line overrun + review exposure ---
fs = run_rules(T, T.as_of); by = {f["rule_id"]: f for f in fs}
res.append(ok("SCH-EMAIL-DATE-SLIP" in by and by["SCH-EMAIL-DATE-SLIP"]["evidence"]["slip_cd"] == 14
              and "A1225" in by["SCH-EMAIL-DATE-SLIP"]["evidence"]["activity_ids"] or "A1230" in by["SCH-EMAIL-DATE-SLIP"]["evidence"]["activity_ids"],
              f"Linden: Bayline email → SCH-EMAIL-DATE-SLIP 14 cd on steel: {by.get('SCH-EMAIL-DATE-SLIP',{}).get('title','')[:80]}"))
imps = default_impacts(T, by["SCH-EMAIL-DATE-SLIP"])
res.append(ok(any(x.get("type")=="delay_chain" and x.get("delay_usd",0) >= 100000 for x in imps), f"email slip has $ exposure: {[x.get('delay_usd') for x in imps]}"))
res.append(ok("COST-LINE-OVERRUN" not in by, "M1/M2 trim: COST-LINE-OVERRUN deferred to M3 (does not fire)"))
# SUB-REVIEW-OVERDUE on steel has delay exposure
from .stages import rules as RS
out,_ = RS.run(T)
rev = next(c for c in out["candidates"] if c["finding_id"].startswith("SUB-REVIEW-OVERDUE|submittal:6103") or "6103" in c["finding_id"] and c["rule_id"]=="SUB-REVIEW-OVERDUE")
res.append(ok(any(x.get("type")=="delay_chain" and x.get("delay_usd") for x in rev["default_impacts"]),
              f"SUB-REVIEW-OVERDUE 6103 has code $ exposure: {[(x.get('type'),x.get('delay_usd')) for x in rev['default_impacts']]}"))
# toilet accessories should NOT get large exposure without near-critical float
rev2 = next((c for c in out["candidates"] if "6601" in c["finding_id"] and c["rule_id"]=="SUB-REVIEW-OVERDUE"), None)
res.append(ok(rev2 is None or not any((x.get("delay_usd") or 0) > 50000 for x in rev2["default_impacts"]),
              "low-priority SUB-REVIEW-OVERDUE does not invent large $ exposure"))

# --- synthetic: closed RFI impact no CE ---
V = DayView(T, T.as_of)
fake_rfi = {"ref": "procore:rfi:9999", "label": "RFI #99", "subject": "Hidden conduit", "status": "closed", "cost_impact": "yes_unknown",
            "schedule_impact": "no_impact", "time_resolved": "2026-10-05T12:00:00-04:00", "ball_in_court": None, "spec_section": "26 05 00",
            "created_at": "2026-10-01", "due_date": "2026-10-04", "citations": []}
V.rfis = list(V.rfis) + [fake_rfi]
# inject into index for citations check
T.index["procore:rfi:9999"] = ("rfi", fake_rfi)
out_e = email_rfi_rules(V)
res.append(ok(any(f["rule_id"]=="RFI-CLOSED-IMPACT-NO-CE" and "9999" in f["finding_id"] for f in out_e),
              f"closed RFI with cost impact and no CE → finding: {[f['rule_id'] for f in out_e]}"))

# --- synthetic: owner directive no CE ---
fake_email = {"ref": "msgraph_outlook:message:msg_SYN1", "received_at": "2026-10-06T15:00:00-04:00",
              "from": {"name": "Dana Whitfield", "email": "dwhitfield@larkspurdev.example"},
              "subject": "Rooftop lounge - teak decking upgrade",
              "body_text": "Priya, please proceed with the rooftop lounge teak decking upgrade at $42,000. Issue the change when ready. - Dana"}
T.index[fake_email["ref"]] = ("email", {**fake_email, "from": "Dana Whitfield <dwhitfield@larkspurdev.example>", "body_text": fake_email["body_text"], "subject": fake_email["subject"], "received_at": fake_email["received_at"]})
V.emails = list(V.emails) + [fake_email]
out_e2 = email_rfi_rules(V)
res.append(ok(any(f["rule_id"]=="COST-OWNER-DIRECTIVE-NO-CE" and f["evidence"]["amount_usd"]==42000 for f in out_e2),
              f"owner directive $42k with no CE → finding: {[(f['rule_id'], f.get('evidence',{}).get('amount_usd')) for f in out_e2 if 'OWNER' in f['rule_id'] or 'DIRECT' in f['rule_id']]}"))
# E111 (PCO-014 approved) must NOT fire — matching CE exists
res.append(ok(not any(f["rule_id"]=="COST-OWNER-DIRECTIVE-NO-CE" and "E111" in f["finding_id"] for f in run_rules(T, T.as_of)),
              "owner approval of existing PCO-014 does not fire COST-OWNER-DIRECTIVE-NO-CE"))

# --- M1/M2 trim (2026-10-06): SCH-MANPOWER-TREND and notes-based SCH-INSPECTION-FAIL deferred to M3 ---
aid = "A1510"
logs_extra = [
    {"type":"manpower_log","ref":"procore:manpower_log:syn1","log_date":"2026-10-05","activity_id_hint":aid,"num_workers":10,"vendor":"Timberline Framing (FICTIONAL)"},
    {"type":"manpower_log","ref":"procore:manpower_log:syn2","log_date":"2026-10-06","activity_id_hint":aid,"num_workers":9,"vendor":"Timberline Framing (FICTIONAL)"},
]
for L in logs_extra: T.index[L["ref"]] = ("manpower_log", L)
T.logs = list(T.logs) + logs_extra
fs2 = run_rules(T, T.as_of)
res.append(ok(not any(f["rule_id"]=="SCH-MANPOWER-TREND" for f in fs2), "M1/M2 trim: SCH-MANPOWER-TREND deferred (does not fire)"))
res.append(ok(any(f["rule_id"]=="SCH-MANPOWER-ACUTE" and "A1500" in f["finding_id"] for f in fs), "SCH-MANPOWER-ACUTE unchanged on Linden A1500"))
T.logs = [l for l in T.logs if not str(l.get("ref","")).endswith(("syn1","syn2"))]
note = {"type":"notes_log","ref":"procore:notes_log:syn_insp","log_date":"2026-10-06","location":"Wing A > Level 2",
        "comment":"AHJ failed punch list on L2 MEP rough-in; reinspection needed before close-in."}
T.index[note["ref"]] = ("notes_log", note); T.logs = list(T.logs) + [note]
fs3 = run_rules(T, T.as_of)
res.append(ok(not any(f["rule_id"]=="SCH-INSPECTION-FAIL" and "syn_insp" in f["finding_id"] for f in fs3),
              "M1/M2 trim: failed-inspection language in notes_log no longer fires SCH-INSPECTION-FAIL (typed inspection_log only)"))
T.logs = [l for l in T.logs if l.get("ref") != note["ref"]]

# --- delivery trap ---
dlog = {"type":"delivery_log","ref":"procore:delivery_log:syn1","log_date":"2026-10-05","status":"received",
        "order_number":"PO-9999","description":"Switchgear crate received complete on site"}
T.index[dlog["ref"]] = ("delivery_log", dlog); T.logs = list(T.logs) + [dlog]
em = {"ref":"msgraph_outlook:message:msg_SYN_DEL","received_at":"2026-10-06T08:00:00-04:00",
      "from":"Tracking <noreply@carrier.example>","subject":"Delivery delayed for PO-9999",
      "body_text":"Your shipment PO-9999 has a delivery delay. Tracking update: exception."}
T.index[em["ref"]] = ("email", em)
res.append(ok(delivery_complete_for(T, em["ref"]) and delivery_complete_for(T, em["ref"])["ref"]==dlog["ref"],
              "delivery_complete_for matches PO when log shows received"))
res.append(ok(DELIVERY_DELAY_CLAIM.search("the delivery is delayed pending carrier") and delivery_received_any(T, [dlog["ref"]]),
              "verifier helpers: delivery-delay claim + received log"))
# claim dropped
kept, verdicts, _ = verify_insights([{"insight_id":"i","narrative_claims":[
    {"text":"Switchgear delivery is delayed per carrier notice", "citations":[{"ref":em["ref"]},{"ref":dlog["ref"]}]},
    {"text":"PO-0117 still Draft", "citations":[{"ref":"procore:commitment:3401"}]}]}], T, {}, [])
res.append(ok(any("contradicted_by_record" in v.get("reasons",[]) for v in verdicts) and
              all("delayed" not in c.get("text","").lower() for c in (kept[0]["narrative_claims"] if kept else [])),
              "verifier drops delivery-delay claim contradicted by received delivery_log"))
T.logs = [l for l in T.logs if l.get("ref") != dlog["ref"]]

# --- submittal rules do not reference location/cost_code ---
src = open(__file__.replace("tests_iter4.py","rules_engine.py")).read() + open(__file__.replace("tests_iter4.py","candidates.py")).read()
# crude: SUB- / submittal handling shouldn't read sub['location'] or sub['cost_code']
import re as _re
bad = _re.findall(r"sub\[['\"]location['\"]\]|sub\[['\"]cost_code['\"]\]|sub\.get\(['\"]location|sub\.get\(['\"]cost_code", src)
res.append(ok(not bad, f"submittal rules do not use location/cost_code: {bad}"))
res.append(ok("location" in open(__file__.replace("tests_iter4.py","fixture_tools.py")).read().split("def _rfi")[1].split("def _sub")[0],
              "RFI location field stays in _rfi projection"))


# --- email-confirmed delivery trap (no delivery_log) ---
em_delay = {"ref":"msgraph_outlook:message:msg_SYN_DEL2","received_at":"2026-10-05T07:00:00-04:00",
            "conversation_id":"conv_SYN_SO1",
            "from":"Orders <noreply@vendor.example>","subject":"Delivery delayed - Sales Order SO-77801",
            "body_text":"Automated notice: Sales Order SO-77801 delivery status DELAYED. Revised ship date 10/12/2026."}
em_ok = {"ref":"msgraph_outlook:message:msg_SYN_DEL2b","received_at":"2026-10-06T07:30:00-04:00",
         "conversation_id":"conv_SYN_SO1",
         "from":"Tom Alvarez <talvarez@timberlinegc.example>","subject":"RE: Delivery delayed - Sales Order SO-77801",
         "body_text":"Ignore this notice. Material on site and inventoried this morning; SO-77801 tagged in west laydown."}
T.emails = dict(T.emails); T.emails["emails"] = list(T.emails.get("emails") or []) + [em_delay, em_ok]
T.index[em_delay["ref"]] = ("email", em_delay); T.index[em_ok["ref"]] = ("email", em_ok)
res.append(ok(delivery_complete_for(T, em_delay["ref"]) and delivery_complete_for(T, em_delay["ref"])["ref"] == em_ok["ref"],
              "delivery_complete_for: later same-thread on-site email suppresses delay (no delivery_log)"))
kept2, verdicts2, _ = verify_insights([{"insight_id":"i2","narrative_claims":[
    {"text":"SO-77801 delivery is delayed per vendor notice", "citations":[{"ref":em_delay["ref"]},{"ref":em_ok["ref"]}]}]}], T, {}, [])
res.append(ok(any("contradicted_by_record" in v.get("reasons",[]) for v in verdicts2),
              "verifier drops delivery-delay claim contradicted by later on-site email"))

# --- mid-thread formal cost claim (body, not subject) ---
from .rules_engine import NOTICE_RE
buried = "Logistics ok. (3) please accept this as our formal cost claim for the added grounding directed Thursday. Pricing follows."
res.append(ok(bool(NOTICE_RE.search(buried)) and not NOTICE_RE.search("weekly look-ahead attached"),
              "NOTICE_RE matches buried formal cost claim; ignores ordinary email"))

# Rebuild fixture-backed tools after email plants land on disk (rebuild happens below in CI); for in-memory, check rule on synthetic as_of email:
em_mid = {"ref":"msgraph_outlook:message:msg_SYN_MID","id":"msg_SYN_MID",
          "received_at":"2026-10-06T09:20:00-04:00","conversation_id":"conv_SYN_MID",
          "from":{"name":"Mike Dunn","email":"mdunn@ampereelectric.example"},
          "subject":"Linden Yard - L3 feeders / as-built",
          "body_text":buried + " Crew continues L3 rough-in."}
T.index[em_mid["ref"]] = ("email", {**em_mid, "from":"Mike Dunn <mdunn@ampereelectric.example>"})
Vmid = DayView(T, T.as_of); Vmid.emails = list(Vmid.emails) + [em_mid]
from .rules_engine import dec_rules
mid_fs = dec_rules(Vmid)
res.append(ok(any(f["rule_id"]=="EMAIL-NOTICE-LANGUAGE" and "SYN_MID" in f["finding_id"] for f in mid_fs),
              f"mid-thread body formal claim fires EMAIL-NOTICE-LANGUAGE: {[f['finding_id'] for f in mid_fs if 'NOTICE' in f['rule_id']]}"))

# --- owner directive with no dollar amount ---
fake_nodollar = {"ref": "msgraph_outlook:message:msg_SYN_OD", "received_at": "2026-10-06T16:00:00-04:00",
                 "from": {"name": "Dana Whitfield", "email": "dwhitfield@larkspurdev.example"},
                 "subject": "Bike room padding",
                 "body_text": "Priya, please add wall padding in the amenity bike room and go ahead — price later. - Dana"}
T.index[fake_nodollar["ref"]] = ("email", {**fake_nodollar, "from": "Dana Whitfield <dwhitfield@larkspurdev.example>"})
V5 = DayView(T, T.as_of); V5.emails = list(V5.emails) + [fake_nodollar]
out_od = email_rfi_rules(V5)
res.append(ok(any(f["rule_id"]=="COST-OWNER-DIRECTIVE-NO-CE" and f["evidence"].get("amount_usd") is None and "SYN_OD" in f["finding_id"] for f in out_od),
              f"owner go-ahead / price later with no $ → COST-OWNER-DIRECTIVE-NO-CE"))

# --- fabrication-hold without RFI/CE bridge (drawing.spec_sections + description overlap) ---
syn_sub = {"ref":"procore:submittal:syn_light","label":"26 51 00-001 Lighting Fixture Package","title":"Lighting Fixture Package",
           "spec_section":"26 51 00","current_revision":True,"status":{"name":"Closed"},
           "approvers":[{"response":{"name":"Approved"}}],"closed_at":"2026-09-20T12:00:00-04:00",
           "scheduled_task":None, "external_id":"syn_light"}
# _sub uses approvers with response as string sometimes — sch_rules expects a["response"] in APPROVED set of strings
syn_sub["approvers"] = [{"response":"Approved"}]
syn_dwg = {"ref":"procore:drawing_revision:syn_asi12","number":"E-201","revision":"2","issued_date":"2026-09-26",
           "issued_via":"ASI-12","discipline":"Electrical","title":"Lighting Fixture Plans Level 2",
           "description":"ASI-12 revises lighting fixture package types LF-1 and LF-2",
           "spec_sections":["26 51 00"]}
T.index[syn_sub["ref"]] = ("submittal", syn_sub); T.index[syn_dwg["ref"]] = ("drawing_revision", syn_dwg)
T.drawings = list(T.drawings) + [syn_dwg]
V6 = DayView(T, T.as_of); V6.subs = list(V6.subs) + [syn_sub]
dw_fs = sch_rules(V6)
res.append(ok(any(f["rule_id"]=="SCH-DWG-REV-AFTER-APPROVAL" and "syn_light" in f["finding_id"] and f["evidence"].get("standalone_fabrication_hold") for f in dw_fs),
              f"ASI-after-approval via drawing.spec_sections → standalone SCH-DWG-REV-AFTER-APPROVAL: {[f['finding_id'] for f in dw_fs if f['rule_id']=='SCH-DWG-REV-AFTER-APPROVAL']}"))
# N4 control: pre-approval S-301 must still not fire against post-receipt steel (existing Linden behavior)
res.append(ok(not any("7731" in f["finding_id"] and "6103" in f["finding_id"] for f in run_rules(T, T.as_of) if f["rule_id"]=="SCH-DWG-REV-AFTER-APPROVAL"),
              "N4 control: S-301 before steel approval does not false-alarm fabrication-hold"))

# --- long-lead SUB-REVIEW-OVERDUE must carry delay_chain $ when ROS known (prefer zero FA on far-float) ---
_ll = next((c for c in out["candidates"] if c["rule_id"]=="SUB-REVIEW-OVERDUE" and "6103" in c["finding_id"]), None)
res.append(ok(_ll and any(x.get("type")=="delay_chain" and (x.get("delay_usd") or 0) > 0 for x in _ll["default_impacts"]),
              "long-lead steel SUB-REVIEW-OVERDUE surfaces delay_chain $"))
_far = next((c for c in out["candidates"] if c["rule_id"]=="SUB-REVIEW-OVERDUE" and "6601" in c["finding_id"]), None)
res.append(ok(_far is None or not any((x.get("delay_usd") or 0) >= 50000 for x in _far.get("default_impacts") or []),
              "far-out toilet accessories SUB-REVIEW does not invent large $ (zero FA)"))


# --- FA rule 9: far_float_overdue_submittal demote with reason (T3 class); steel not demoted ---
_f6601 = next(f for f in out["findings"] if f["rule_id"]=="SUB-REVIEW-OVERDUE" and "6601" in f["finding_id"])
_f6103 = next(f for f in out["findings"] if f["rule_id"]=="SUB-REVIEW-OVERDUE" and "6103" in f["finding_id"])
res.append(ok(far_float_overdue_reason(T, _f6601) and "far-float" in far_float_overdue_reason(T, _f6601),
              f"6601 far-float demote reason: {far_float_overdue_reason(T, _f6601)}"))
res.append(ok(far_float_overdue_reason(T, _f6103) is None, "6103 long-lead steel is NOT far-float demoted"))

# --- FA rule 10: stale email vs Procore answered RFI (T6 class) ---
em_stale = {"ref":"msgraph_outlook:message:msg_SYN_STALE","received_at":"2026-10-05T11:00:00-04:00",
            "from":"Carlos Rivera <mdunn@ampereelectric.example>","subject":"RFI 38 still open?",
            "body_text":"Priya — RFI #38 is overdue and unanswered on our end. Please advise so we can release stair fab."}
T.index[em_stale["ref"]] = ("email", em_stale)
# RFI 9038 is closed/answered on Linden as of 10/6
hit = rfi_answered_in_procore(T, em_stale["ref"])
res.append(ok(hit and "9038" in hit["ref"], f"stale email claiming RFI 38 overdue suppressed vs Procore answered: {hit}"))
res.append(ok(rfi_overdue_claim_contradicted(T, "RFI #38 is overdue and blocking stair fab", ["procore:rfi:9038"]),
              "verifier drops overdue-RFI claim contradicted by answered Procore RFI"))
# control: open overdue RFI should NOT suppress
em_open = {"ref":"msgraph_outlook:message:msg_SYN_OPENRFI","received_at":"2026-10-06T09:00:00-04:00",
           "from":"x <a@b.example>","subject":"RFI 42",
           "body_text":"RFI #42 is overdue — need answer on switchgear pads."}
T.index[em_open["ref"]] = ("email", em_open)
res.append(ok(rfi_answered_in_procore(T, em_open["ref"]) is None,
              "email about still-open overdue RFI 42 is NOT stale-suppressed"))

# --- Pattern 6: rr_not_resubmitted_near_term (synthetic near-term); Linden windows far → no FA ---
res.append(ok(not any(f["rule_id"]=="SUB-RR-NOT-RESUBMITTED" for f in run_rules(T, T.as_of)),
              "Linden window R&R draft (far start) does not false-alarm SUB-RR-NOT-RESUBMITTED"))
# plant a synthetic near-term R&R draft on steel-like activity A1225
syn_rr_prior = {"ref":"procore:submittal:syn_rr0","label":"Submittal 05 12 00-099 rev 0","formatted_number":"05 12 00-099",
                "revision":0,"current_revision":False,"title":"Embed Plates","status":"Closed","spec_section":"05 12 00",
                "approvers":[{"response":"Revise and Resubmit"}],"closed_at":"2026-09-20T12:00:00-04:00",
                "received_date":"2026-09-01","due_date":"2026-09-15","scheduled_task":"p6|A1225",
                "required_on_site_date":"2026-11-09","lead_time":28,"buffer_time":3}
syn_rr_cur = {"ref":"procore:submittal:syn_rr1","label":"Submittal 05 12 00-099 rev 1","formatted_number":"05 12 00-099",
              "revision":1,"current_revision":True,"title":"Embed Plates","status":"Draft","spec_section":"05 12 00",
              "approvers":[{"response":"Pending"}],"closed_at":None,"received_date":None,"submit_by":"2026-09-28",
              "due_date":None,"scheduled_task":"p6|A1225","required_on_site_date":"2026-11-09","lead_time":28,"buffer_time":3,
              "ball_in_court":["Bayline"]}
T.index[syn_rr_prior["ref"]]=("submittal", syn_rr_prior); T.index[syn_rr_cur["ref"]]=("submittal", syn_rr_cur)
Vrr = DayView(T, T.as_of); Vrr.subs = list(Vrr.subs) + [syn_rr_prior, syn_rr_cur]
rr_fs = sub_rr_rules(Vrr)
res.append(ok(any(f["rule_id"]=="SUB-RR-NOT-RESUBMITTED" and "syn_rr1" in f["finding_id"] for f in rr_fs),
              f"near-term R&R without resubmittal → SUB-RR-NOT-RESUBMITTED: {[f['finding_id'] for f in rr_fs]}"))




# --- PM clarifications (notice typing, procurement disable, noise_email) ---
from .notices import code_types, period_types_for, for_notice_email
res.append(ok(code_types("please accept this as formal notice of delay and request for time extension under Article 8 due to late pads.")
              == ["delay_time_extension"], "notice type delay_time_extension"))
res.append(ok(code_types("this is our formal notice of cost claim for the added feeder length directed last Monday.")
              == ["cost_change_claim"], "notice type cost_change_claim"))
res.append(ok(code_types("this cure notice: suspend performance unless the default is cured within 48 hours.")
              == ["cure_default"], "notice type cure_default"))
res.append(ok(code_types("please accept this as formal notice regarding coordination on site.")
              == ["other"], "ambiguous formal notice → other"))
res.append(ok(set(code_types("formal notice of delay and cost claim for extras under Article 8"))
              == {"delay_time_extension", "cost_change_claim"},
              "delay+cost both clearly present → both types (not wrong-typed)"))
res.append(ok(period_types_for(["delay_time_extension"]) == ["delay"] and period_types_for(["other"]) == [],
              "period map: delay_time_extension→delay; other→no typed row"))
# deadline unknown for other
_em_other = next((e for e in T.emails["emails"] if "msg_" in e.get("ref","")), None)
if _em_other:
    # synthesize: patch body into a temp index entry
    syn_ref = "msgraph_outlook:message:msg_SYN_OTHER_N"
    syn = {"ref": syn_ref, "received_at": T.as_of.isoformat() + "T12:00:00-04:00",
           "from": "Mike Dunn <mdunn@ampereelectric.example>",
           "subject": "Coordination",
           "body_text": "Please accept this as formal notice regarding coordination on Level 3."}
    T.index[syn_ref] = ("email", syn)
    nw = for_notice_email(T, syn_ref)
    res.append(ok(nw.get("notice_types") == ["other"] and nw.get("deadline") is None and nw.get("status") == "deadline_unknown",
                  f"other/ambiguous → deadline unknown: status={nw.get('status')} types={nw.get('notice_types')}"))
# typed delay still computes when period configured
syn_d = {"ref": "msgraph_outlook:message:msg_SYN_DELAY_N", "received_at": "2026-10-06T12:00:00-04:00",
         "from": "Chris Bell <cbell@polarmech.example>",
         "subject": "RTU pads",
         "body_text": "Please accept this as formal notice of delay and request for time extension under Article 8 due to late RTU pads."}
T.index[syn_d["ref"]] = ("email", syn_d)
nw_d = for_notice_email(T, syn_d["ref"])
# Linden delay rows are event-triggered; without a named event, deadline unknown is correct — must NOT pick a cost row.
res.append(ok(nw_d.get("notice_types") == ["delay_time_extension"]
              and all(w.get("notice_type") == "delay" for w in (nw_d.get("windows") or []))
              and all(w.get("notice_type") != "cost_or_change_claim" for w in (nw_d.get("windows") or []) + (nw_d.get("sub_windows") or [])),
              f"delay_time_extension typed (no wrong cost row): types={nw_d.get('notice_types')} status={nw_d.get('status')}"))
# cost claim with notice_received trigger should compute a deadline when party known
syn_c = {"ref": "msgraph_outlook:message:msg_SYN_COST_N", "received_at": "2026-10-06T12:00:00-04:00",
         "from": "Mike Dunn <mdunn@ampereelectric.example>",
         "subject": "Feeder length",
         "body_text": "This is our formal notice of cost claim for the added feeder length directed last Monday."}
T.index[syn_c["ref"]] = ("email", syn_c)
nw_c = for_notice_email(T, syn_c["ref"])
# Linden cost rows are also event-triggered; type must be cost_change_claim and must not pick a delay row.
res.append(ok(nw_c.get("notice_types") == ["cost_change_claim"]
              and all(w.get("notice_type") == "cost_or_change_claim" for w in (nw_c.get("windows") or []) + (nw_c.get("sub_windows") or []))
              and all(w.get("notice_type") != "delay" for w in (nw_c.get("windows") or []) + (nw_c.get("sub_windows") or [])),
              f"cost_change_claim typed (no wrong delay row): types={nw_c.get('notice_types')} status={nw_c.get('status')}"))

# procurement M1/M2: no buyout/PO/quote-expiry rules
_proc_ids = {f["rule_id"] for f in run_rules(T, T.as_of)}
# Linden training still fires legacy PROC/buyout; held-outs must not plant those shapes (HX5 T8).
res.append(ok("PROC-QUOTE-EXPIRY" in _proc_ids and "PROC-PO-NOT-ISSUED" in _proc_ids,
              "Linden legacy PROC-QUOTE + PROC-PO still fire (do not plant in held-outs)"))

# noise_email_no_impact: complaint with no attach must drop
from .stages.rank import POINTS
# Direct unit: an email without notice/directive/slip/rfi-sub link is not significant
noise_body = "The construction noise from your site woke our baby again. Please be quieter after 7pm."
res.append(ok(not NOTICE_RE.search("Noise complaint\n" + noise_body),
              "parent noise complaint is not formal notice language"))

print(f"{sum(res)}/{len(res)} passed")
sys.exit(0 if all(res) else 1)
