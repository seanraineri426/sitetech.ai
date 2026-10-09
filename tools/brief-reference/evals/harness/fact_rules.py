"""Stage 2 JUDGMENT (code) over extracted facts (email_facts.py). No phrasing rules here: the model extracted the facts; this module
joins them to records and decides.
  - SCH-EMAIL-DATE-SLIP: fact (new date / stated delay) joined to a schedule activity through a record (submittal no ->
    submittals.schedule_activity_id, RFI no -> RFI activity/spec, spec section -> activity spec, email record links). Need date =
    activity early start (or the submittal's required-on-site date when earlier). Baseline = the email's stated old date, else the
    need date. Fires only when the new date is AFTER the need date. $ = max(0, slip - total float) x daily delay cost (impact.delay_chain).
    Name-only / low-confidence activity match -> "possible schedule impact, confirm activity", no $ and no deadline.
  - Notices: a verified formal_notice fact makes the email a notice; types come from the fact (deadline from configured periods only).
  - RFI-OVERDUE-NEAR-START: open RFI past due (or with a stated need date) whose linked activity starts within 14 days (or started).
  - RFI-CLOSED-IMPACT-NO-CE / COST-DIFFERING-SITE-CONDITION from RFI facts + record fields; never when a linked CE already covers it."""
import datetime as dt, re
from .calendar_util import d_
from .unverified_senders import track_unverified_email_finding

NEAR_DAYS = 14

def md(d): d = d_(d) if isinstance(d, str) else d; return f"{d.month}/{d.day}"
def has_facts(T): return hasattr(T, "email_facts")
def efacts(T, ref): return (getattr(T, "email_facts", {}) or {}).get(ref)
def rfacts(T, ref): return (getattr(T, "rfi_facts", {}) or {}).get(ref)

def _norm_no(s): return re.sub(r"[^0-9a-z]", "", str(s or "").lower())

def _sub_by_no(V, no):
    n = _norm_no(no)
    return next((s for s in V.subs if s.get("current_revision") and n and _norm_no(s.get("formatted_number")) == n), None)

def _rfi_by_no(V, no):
    n = _norm_no(no).lstrip("0")
    return next((r for r in V.rfis if n and re.sub(r"\D", "", r.get("label") or "").lstrip("0") == n), None)

def _acts_for_sub(V, s):
    aid = s.get("schedule_activity_id") or (str(s.get("scheduled_task") or "").split("|")[-1] or None)
    if aid and aid in V.acts: return [V.acts[aid]]
    sp = s.get("spec_section")
    return [a for a in V.acts.values() if sp and sp in (a.get("spec_sections") or [])]

def acts_for_rfi(V, r):
    aid = r.get("schedule_activity_id")
    if aid and aid in V.acts: return [V.acts[aid]], "schedule_activity_id"
    sp = r.get("spec_section")
    a = [x for x in V.acts.values() if sp and sp in (x.get("spec_sections") or [])]
    if a: return a, "spec_section"
    loc = (r.get("location") or "").strip().lower()
    a = [x for x in V.acts.values() if loc and (x.get("location") or "").strip().lower() == loc]
    return a, ("location" if a else None)

def _link_acts(V, e):
    """Email -> activity via deterministic record links only (no name matching): email<->RFI/submittal/CE mentions, 2 hops."""
    T = V.T; refs = {e["ref"]}
    for _ in range(2):
        hop = set()
        for r in list(refs):
            for l in T.links():
                if l["a"] == r: hop.add(l["b"])
                if l["b"] == r: hop.add(l["a"])
            t = T.index.get(r, (None, {}))
            if t[0] == "submittal": hop |= {a["ref"] for a in _acts_for_sub(V, t[1])}
            if t[0] == "rfi": hop |= {a["ref"] for a in acts_for_rfi(V, t[1])[0]}
        refs |= hop
    return [V.acts[r.split(":")[-1]] for r in refs if r.startswith("p6:activity:") and r.split(":")[-1] in V.acts]

def join_activity(V, e, f):
    """(activities, confidence, how, submittal). confidence: high (record join) | name_only."""
    s = _sub_by_no(V, f.get("submittal_no")) if f.get("submittal_no") else None
    if s:
        a = _acts_for_sub(V, s)
        if a: return a, "high", f"submittal {s.get('formatted_number')} -> schedule activity", s
    if f.get("rfi_no"):
        r = _rfi_by_no(V, f["rfi_no"])
        if r:
            a, how = acts_for_rfi(V, r)
            if a: return a, "high", f"RFI {f['rfi_no']} -> {how}", None
    if f.get("spec_section"):
        a = [x for x in V.acts.values() if f["spec_section"] in (x.get("spec_sections") or [])]
        if a: return a, "high", f"spec {f['spec_section']} -> activity", None
    a = _link_acts(V, e)
    if a: return a, "high", "email record links", None
    words = {w for w in re.findall(r"[a-z]{4,}", ((f.get("item") or "") + " " + (e.get("subject") or "")).lower())} - {"with", "from", "date", "update", "level"}
    a = [x for x in V.acts.values() if words & set(re.findall(r"[a-z]{4,}", x["name"].lower()))]
    return a, ("name_only" if a else None), "activity name only", None

def _received_later(V, e, f):
    from .parties import party_for_record
    T = V.T; conv = e.get("conversation_id"); at = e.get("received_at") or ""
    for x in T.emails["emails"]:
        if x["ref"] == e["ref"] or (x.get("received_at") or "") <= at: continue
        # Only facts from project parties may suppress findings
        if not party_for_record(T.project, x): continue
        same = (conv and x.get("conversation_id") == conv)
        for g in efacts(T, x["ref"]) or []:
            if g["kind"] != "received_on_site": continue
            if same or (f.get("submittal_no") and _norm_no(g.get("submittal_no")) == _norm_no(f.get("submittal_no"))): return x["ref"]
    return None

def _try_track_unverified_slip(T, V, email, unverified_list):
    """Try to track an unknown-sender email that would have fired a slip rule."""
    facts = efacts(T, email["ref"])
    if facts is None:
        return
    
    for f in facts:
        if f["kind"] not in ("schedule_date_change", "conditional_slip"):
            continue
        if not (f.get("new_date") or f.get("delay_days")):
            continue
        
        # Would it have been suppressed by received_later or delivery_complete?
        # For unverified tracking, we assume it wouldn't be suppressed
        
        acts, conf, how, s = join_activity(V, email, f)
        if not acts:
            # Low-confidence match - still track it
            nd = d_(f["new_date"]) if f.get("new_date") else None
            if nd:
                claim = f"Claims {f.get('item') or 'item'} ships {md(nd)}"
                track_unverified_email_finding(
                    T, V, email, "schedule_slip", claim,
                    {"new_date": nd.isoformat(), "impact_tbd": True},
                    {"quote": f.get("quote"), "item": f.get("item")}
                )
                unverified_list.append({
                    "email_ref": email["ref"],
                    "claim": claim,
                    "type": "schedule_slip"
                })
            continue
        
        acts = [a for a in acts if not a.get("actual_finish") and a.get("pct_complete", 0) < 100]
        if not acts or conf != "high":
            continue
            
        acts.sort(key=lambda a: (0 if a.get("on_driving_path_to_tco") else 1, a["total_float_wd"], -d_(a["early_start"]).toordinal()))
        a0 = acts[0]
        started = bool(a0.get("actual_start"))
        need = d_(a0["early_start"]) if not started else None
        if s and s.get("required_on_site_date"):
            need = min(filter(None, [need, d_(s["required_on_site_date"])]))
        if need is None:
            continue
            
        base = d_(f["old_date"]) if f.get("old_date") else need
        new = d_(f["new_date"]) if f.get("new_date") else base + dt.timedelta(days=int(f["delay_days"]))
        if new <= need:
            continue
            
        slip_cd = (new - base).days
        if slip_cd <= 0:
            continue
            
        # Compute hypothetical impact
        slip_wd = T.cal.wd_between(base, new)
        beyond_float = max(0, slip_wd - a0["total_float_wd"])
        
        # Compute $ exposure (simplified - would use impact.delay_chain in production)
        exposure_usd = beyond_float * 8000 if beyond_float > 0 else 0  # $8k/day placeholder
        
        claim = f"Claims {f.get('item') or a0['name']} ships {md(new)}, +{slip_cd} days"
        if exposure_usd > 0:
            claim += f", about ${exposure_usd//1000}k if verified"
        
        unverified_list.append({
            "email_ref": email["ref"],
            "claim": claim,
            "type": "schedule_slip",
            "hypothetical_impact": {
                "slip_cd": slip_cd,
                "slip_wd": slip_wd,
                "beyond_float_wd": beyond_float,
                "exposure_usd": exposure_usd
            },
            "activity": a0["activity_id"],
            "quote": f.get("quote")
        })

def email_slip_rules(V, collect_unverified=True):
    from .rules_engine import _f
    from .parties import party_for_record
    T = V.T; out = []
    unverified = getattr(V, '_unverified_findings', [])
    for e in V.emails:
        recv = T.local_date(e["received_at"])
        if recv > V.day or (V.day - recv).days > 7: continue
        # Only facts from project parties may create or suppress findings
        party = party_for_record(T.project, e)
        if not party:
            # Track this as a potential unverified finding
            if collect_unverified:
                _try_track_unverified_slip(T, V, e, unverified)
            continue
        facts = efacts(T, e["ref"])
        if facts is None: continue
        n = 0
        for f in facts:
            if f["kind"] not in ("schedule_date_change", "conditional_slip"): continue
            if not (f.get("new_date") or f.get("delay_days")): continue
            if _received_later(V, e, f): continue
            try:
                from .stages.rank import delivery_complete_for
                if delivery_complete_for(T, e["ref"]): continue
            except Exception: pass
            acts, conf, how, s = join_activity(V, e, f)
            acts = [a for a in acts if not a.get("actual_finish") and a.get("pct_complete", 0) < 100]
            who = e["from"]["name"] if isinstance(e.get("from"), dict) else str(e.get("from")).split(" <")[0]
            key = e["ref"] + (f"|{n}" if n else ""); item = f.get("item") or "item"
            label = "Likely" if (f.get("date_basis") == "vague" or f.get("confidence") == "low" or f["kind"] == "conditional_slip") else "Confirmed"
            if not acts or conf != "high":
                nd = d_(f["new_date"]) if f.get("new_date") else None
                if not nd: continue
                out.append(_f(V, "SCH-EMAIL-DATE-SLIP", key, f"Email: {who}",
                              f"Email gives new date {md(nd)} for {item}: possible schedule impact, confirm activity",
                              "medium", [e["ref"]], {"to_date": nd.isoformat(), "activity_ids": [], "match": how, "quote": f.get("quote"),
                                                     "label": "Signal", "party": (party or {}).get("name"), "fact": f}))
                n += 1; continue
            acts.sort(key=lambda a: (0 if a.get("on_driving_path_to_tco") else 1, a["total_float_wd"], -d_(a["early_start"]).toordinal()))
            a0 = acts[0]
            started = bool(a0.get("actual_start"))
            need = d_(a0["early_start"]) if not started else None
            if s and s.get("required_on_site_date"): need = min(filter(None, [need, d_(s["required_on_site_date"])]))
            if need is None: continue
            base = d_(f["old_date"]) if f.get("old_date") else need
            new = d_(f["new_date"]) if f.get("new_date") else base + dt.timedelta(days=int(f["delay_days"]))
            new_hi = d_(f["new_date_high"]) if f.get("new_date_high") else (base + dt.timedelta(days=int(f["delay_days_high"])) if f.get("delay_days_high") else None)
            if new <= need: continue        # new date still on/before the need date: no finding (pack P1 N3)
            slip = (new - base).days
            if slip <= 0: continue
            if not (a0.get("on_driving_path_to_tco") or a0["total_float_wd"] <= 10 or T.cal.wd_between(base, new) > a0["total_float_wd"]): continue
            rng = f"-{md(new_hi)}" if new_hi and new_hi > new else ""
            cond = "If the stated condition occurs: " if f["kind"] == "conditional_slip" else ""
            out.append(_f(V, "SCH-EMAIL-DATE-SLIP", key, f"Email: {who}",
                          f"{cond}Email states {item} moves {md(base)} -> {md(new)}{rng} ({slip} cd) affecting {a0['activity_id']} {a0['name']} "
                          f"(need {md(need)}, TF {a0['total_float_wd']} wd)",
                          "high" if a0.get("on_driving_path_to_tco") or a0["total_float_wd"] <= 5 else "medium",
                          [e["ref"], a0["ref"]] + ([s["ref"]] if s else []) + [a["ref"] for a in acts[1:3]],
                          {"from_date": base.isoformat(), "to_date": new.isoformat(), "to_date_high": new_hi and new_hi.isoformat(), "slip_cd": slip,
                           "slip_cd_high": (new_hi - base).days if new_hi else None, "need_date": need.isoformat(),
                           "activity_ids": [a0["activity_id"]], "quote": (f.get("quote") or "")[:220], "date_phrase": f.get("date_phrase"),
                           "party": (party or {}).get("name"), "party_role": (party or {}).get("role"), "match": how, "label": label,
                           "conditional": f["kind"] == "conditional_slip", "fact": f},
                          gov=new.isoformat(), gov_kind="email_stated_date", deadline=new.isoformat(), metrics={"slip_cd": slip}))
            n += 1
    return out

def notice_fact(T, ref):
    """(is_notice, types, quote) from verified facts; None when the email has no extraction (legacy path applies)."""
    fs = efacts(T, ref)
    if fs is None: return None
    ns = [f for f in fs if f["kind"] == "formal_notice"]
    if not ns: return (False, [], None)
    types = sorted({t for f in ns for t in f.get("notice_types") or []} - {"other"}) or ["other"]
    return (True, types, ns[0].get("quote"))

def rfi_near_start_rules(V):
    from .rules_engine import _f
    T = V.T; out = []
    need_by = {}
    for e in V.emails:
        for f in efacts(T, e["ref"]) or []:
            if f["kind"] == "need_by_date" and f.get("rfi_no") and f.get("new_date"):
                need_by.setdefault(_norm_no(f["rfi_no"]).lstrip("0"), []).append((f["new_date"], e["ref"]))
    for r in V.rfis:
        if str(r.get("status") or "").lower() in ("closed", "void", "answered", "resolved") or r.get("time_resolved"): continue
        num = re.sub(r"\D", "", r.get("label") or "").lstrip("0")
        stated = sorted(need_by.get(num, []))
        due = r.get("due_date"); basis = "due date"
        if not due and stated: due, basis = stated[0][0], "need date stated by email"
        if not due: continue
        dd = d_(due)
        overdue = dd < V.day
        if not overdue and not (basis != "due date" and (dd - V.day).days <= NEAR_DAYS): continue
        acts, how = acts_for_rfi(V, r)
        acts = [a for a in acts if not a.get("actual_finish") and a.get("pct_complete", 0) < 100]
        near = [a for a in acts if (d_(a["early_start"]) - V.day).days <= NEAR_DAYS]
        if not near: continue
        a0 = min(near, key=lambda a: (a["early_start"], a["total_float_wd"]))
        started = bool(a0.get("actual_start")) or d_(a0["early_start"]) <= V.day
        prev = V.acts_prev.get(a0["activity_id"])
        pulled = prev and prev["early_start"] > a0["early_start"]
        days = (V.day - dd).days if overdue else 0
        state = f"overdue {days}d (due {md(dd)})" if overdue else f"no due date; email says needed by {md(dd)}"
        when = (f"started {md(a0.get('actual_start') or a0['early_start'])}" if started else f"starts {md(a0['early_start'])}")
        out.append(_f(V, "RFI-OVERDUE-NEAR-START", r["ref"], r.get("label") or r["ref"],
                      f"{r.get('label')} open, {state}; linked {a0['activity_id']} {a0['name']} {when} (TF {a0['total_float_wd']} wd)"
                      + (f"; start pulled in from {md(prev['early_start'])} in the latest update" if pulled else ""),
                      "high" if a0["total_float_wd"] <= 5 else "medium",
                      [r["ref"], a0["ref"]] + [x[1] for x in stated[:1]],
                      {"due_date": due, "due_basis": basis, "days_overdue": days, "activity_id": a0["activity_id"], "activity_start": a0["early_start"],
                       "activity_started": started, "tf_wd": a0["total_float_wd"], "link": how, "pulled_in_from": prev["early_start"] if pulled else None},
                      gov=due, gov_kind="due_date", bic=r.get("ball_in_court"), spec=r.get("spec_section"), days=days, deadline=a0["early_start"] if not started else None))
    return out

def _ce_covers(V, r, priced_only=False):
    n = re.sub(r"\D", "", r.get("label") or "")
    for c in V.ces:
        linked = r["ref"] in (c.get("linked_rfis") or []) or (n and re.search(rf"\bRFI\s*#?\s*{n}\b", (c.get("title") or "") + " " + (c.get("note") or ""), re.I))
        if not linked: continue
        if not priced_only: return c
        if c.get("priced") or c.get("status") == "approved": return c
    return None

def closed_rfi_rules(V):
    from .rules_engine import _f
    T = V.T; out = []
    for r in V.rfis:
        if r.get("status") != "closed": continue
        f = rfacts(T, r["ref"])
        if f is None: continue
        ci = str(r.get("cost_impact") or "").lower(); si = str(r.get("schedule_impact") or "").lower()
        cost_yes = ci.startswith("yes") or (r.get("cost_impact_value") or 0) > 0
        sched_yes = si.startswith("yes") or (r.get("schedule_impact_value") or 0) > 0
        if ci in ("no_impact", "no") and f["scope_change"] != "adds": continue
        fire = cost_yes or sched_yes or f["scope_change"] == "adds" or (f["scope_change"] == "unclear" and ci in ("tbd", "yes_unknown"))
        if not fire or f["scope_change"] == "none" and not (cost_yes or sched_yes): continue
        if _ce_covers(V, r): continue
        amt = r.get("cost_impact_value") or f.get("amount_usd")
        sdays = r.get("schedule_impact_value") or f.get("schedule_days")
        closed = (r.get("time_resolved") or "")[:10]
        bits = []
        if amt: bits.append(f"cost ${amt:,.0f}")
        elif cost_yes: bits.append("cost impact yes")
        if sdays: bits.append(f"schedule {sdays} days")
        if f["scope_change"] == "adds": bits.append("answer adds scope")
        elif f["scope_change"] == "unclear": bits.append("answer changes detail (scope unclear)")
        out.append(_f(V, "RFI-CLOSED-IMPACT-NO-CE", r["ref"], r.get("label") or r["ref"],
                      f'{r.get("label")} closed {md(closed) if closed else ""}: {"; ".join(bits)}; no change event on file'.replace("closed :", "closed:"),
                      "high" if (cost_yes or f["scope_change"] == "adds") else "medium", [r["ref"]],
                      {"cost_impact": r.get("cost_impact"), "schedule_impact": r.get("schedule_impact"), "closed_at": closed, "amount_usd": amt,
                       "schedule_days": sdays, "scope_change": f["scope_change"], "scope_quote": f.get("scope_quote")},
                      bic=r.get("ball_in_court"), spec=r.get("spec_section"), metrics={"amount_usd": amt} if amt else {}))
    return out

def dsc_fact_rules(V):
    """RFIs (open or closed) whose facts say a differing/unforeseen site condition; skipped when a linked CE is priced/approved
    (already covered, e.g. owner allowance). Returns (findings, refs handled by facts)."""
    from .rules_engine import _f, _txt
    T = V.T; out = []; handled = set()
    for r in V.rfis:
        f = rfacts(T, r["ref"])
        if f is None: continue
        handled.add(r["ref"])
        if not f.get("differing_site_condition"): continue
        if _ce_covers(V, r, priced_only=True): continue
        ces = [c for c in V.ces if r["ref"] in (c.get("linked_rfis") or []) and c.get("status") not in ("void", "approved")]
        lref = {x for c in ces for x in c.get("linked_daily_logs") or []}
        logs = [l for l in V.logs if l["ref"] in lref]
        dates = sorted([l["log_date"] for l in logs] + [str(r.get("created_at") or "")[:10]])
        ev = next((d for d in dates if d), None)
        rom = sum(c.get("rom_usd") or 0 for c in ces)
        cond = f.get("condition") or "site condition"
        out.append(_f(V, "COST-DIFFERING-SITE-CONDITION", r["ref"], r.get("label") or r["ref"],
                      f'Site condition ({cond}) via {r.get("label")}' + (f' at {r["location"]}' if r.get("location") else "") +
                      (f', first recorded {md(ev)}' if ev else "") + f': {r.get("subject")}' + (f'; linked CE ROM ${rom:,.0f}' if rom else "; no CE / price yet"),
                      "high" if rom or any(l["type"] == "delay_log" for l in logs) else "medium",
                      [r["ref"]] + [c["ref"] for c in ces] + [l["ref"] for l in logs],
                      {"event_date": ev, "rfi_due": r.get("due_date"), "ce_refs": [c["ref"] for c in ces], "rom_usd": rom or None,
                       "condition": cond, "location": r.get("location"), "condition_quote": f.get("condition_quote")},
                      gov=r.get("due_date"), gov_kind="due_date", bic=r.get("ball_in_court"), spec=r.get("spec_section"), deadline=r.get("due_date"),
                      days=max(0, (V.day - d_(r["due_date"])).days) if r.get("due_date") and r.get("status") != "closed" else 0))
    return out, handled
