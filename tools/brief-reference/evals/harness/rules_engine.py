"""Layer 1 deterministic rules (DAILY_BRIEF_SPEC §4.2–4.7, M3/M2-structured) implemented over the normalized fixture records.
The fixture ships M1 findings (RFI/submittal rules) in m1/<day>/findings.json; this module adds the schedule, cost, procurement,
decision and notice-language rules so every reportable condition starts as a CODE finding (models filter/merge/explain only).
Generic: no fixture ids, names or dates appear here; thresholds are the spec's. Every rule is evaluated per day (as_of and
compare_to) from records visible on that day, so lifecycle (NEW / WORSE / UNCHANGED / resolved) is computed the same way as M1."""
import re, json, datetime as dt
from .calendar_util import d_

SEV = ["low", "medium", "high", "critical"]
HUB_TYPES = {"budget_snapshot", "schedule_update", "document", "meeting"}
NOTICE_RE = re.compile(
    r"notice of (?:delay|claim|additional cost|cost|default)|reserves? (?:our|its|the) right|pursuant to (?:section|article|clause)|"
    r"\bclaim for (?:delay|additional)|formal notice|written notice of|"
    r"formal (?:cost )?claim|constitutes (?:our|my|the) formal|"
    r"this (?:is|constitutes) (?:our |my )?(?:formal )?(?:notice|claim)|"
    r"accept this as (?:our |my )?(?:formal )?(?:notice|claim|cost claim)|"
    r"please (?:accept|take) this as (?:our |my )?(?:formal )?(?:notice|claim|cost claim)|"
    r"cure notice|notice to cure|notice of default|stop work (?:order|notice)|"
    r"suspend(?:ing|ed)? performance unless", re.I)
DISCIPLINE_DIVS = {"Structural": ["03", "05"], "Mechanical": ["23"], "Plumbing": ["22"], "Electrical": ["26"], "Fire Protection": ["21"],
                   "Civil": ["31", "32", "33"], "Architectural": ["06", "07", "08", "09", "10", "12", "14", "32"]}
APPROVED = {"Approved", "Approved as Noted"}

class DayView:
    """Records as visible on `day` (end of day)."""
    def __init__(self, T, day):
        self.T, self.day = T, d_(day) if isinstance(day, str) else day
        ds = self.day.isoformat()
        ups = sorted([u for u in T.sched["updates"] if u["uploaded_at"][:10] <= ds], key=lambda u: u["data_date"])
        self.u_cur = ups[-1] if ups else None; self.u_prev = ups[-2] if len(ups) > 1 else None
        self.acts = {a["activity_id"]: a for a in T.sched["activities"] if self.u_cur and a["schedule_update_id"] == self.u_cur["schedule_update_id"]}
        self.acts_prev = {a["activity_id"]: a for a in T.sched["activities"] if self.u_prev and a["schedule_update_id"] == self.u_prev["schedule_update_id"]}
        self.logs = [l for l in T.logs if l["log_date"] <= ds]
        bs = [b for b in T.budget if b["snapshot_date"] <= ds]; self.budget = bs[-1] if bs else None; self.budget_prev = bs[-2] if len(bs) > 1 else None
        cs = [c for c in T.ces if c["snapshot_date"] <= ds]; self.ces = cs[-1]["change_events"] if cs else []
        self.ces_prev = cs[-2]["change_events"] if len(cs) > 1 else []
        self.emails = [e for e in T.emails["emails"] if T.local_date(e["received_at"]).isoformat() <= ds]   # project time zone
        self.meetings = [m for m in T.meetings if m["date"] <= ds]
        key = ds if ds in T.subs else max(k for k in T.subs if k <= ds)
        self.subs = [T._sub(s) for s in T.subs[key]]; self.rfis = [T._rfi(r) for r in T.rfis[key]]
        self.dd = d_(self.u_cur["data_date"]) if self.u_cur else None

    def started(self, a):
        if a.get("actual_start"): return True
        return any(l.get("activity_id_hint") == a["activity_id"] and d_(l["log_date"]) > self.dd for l in self.logs)

    def projected_tf(self, a, to=None):
        to = to or self.day
        if self.started(a) or d_(a["early_start"]) > to: return a["total_float_wd"]
        return a["total_float_wd"] - self.T.cal.wd_between(self.dd, to)

    def company_of_email(self, e):
        frm = e.get("from")
        if isinstance(frm, dict):
            addr = frm.get("email") or ""
        else:
            import re as _re
            m = _re.search(r"<([^>]+)>", str(frm) or "")
            addr = m.group(1) if m else (str(frm).split()[-1] if frm else "")
        dom = addr.split("@")[-1].lower() if "@" in addr else ""
        return next((c["name"] for c in self.T.project.get("companies", []) if c.get("domain", "").lower() == dom), None) if dom else None

def _f(V, rule, key, label, title, sev, refs, evidence, gov=None, gov_kind=None, bic=None, spec=None, days=0, deadline=None, metrics=None):
    fp = f"{rule}|{key}"
    cites = [{"ref": r} for r in dict.fromkeys(refs) if r and r in V.T.index]
    return {"finding_id": fp, "fingerprint": fp, "rule_id": rule, "rule_version": "harness-m3-0.1", "record_label": label, "title": title,
            "severity": sev, "status": "open", "days_overdue": days, "governing_date": gov, "governing_date_kind": gov_kind,
            "decision_deadline": deadline, "ball_in_court": bic, "spec_section": spec, "evidence": evidence, "metrics": metrics or {},
            "citations": cites, "source": "harness_rules"}

def _act_ref(a): return a["ref"]
def _company_acts(V, company): return [a for a in V.acts.values() if a.get("company") == company]

# ---------------- §4.2 schedule ----------------
def sch_rules(V):
    out = []; T = V.T
    if not V.u_cur: return out
    milestones = {m["activity_id"] for m in T.project.get("key_milestones", [])}
    for aid, a in V.acts.items():
        if aid in milestones or a.get("actual_finish") or a.get("pct_complete", 0) >= 100: continue
        p = V.acts_prev.get(aid)
        if p:
            t1, t2 = p["total_float_wd"], a["total_float_wd"]
            if (t1 - t2 >= 3) or (t1 > 5 >= t2):
                sev = "critical" if t2 <= 0 else "high" if t2 <= 5 else "medium"
                out.append(_f(V, "SCH-FLOAT-EROSION", aid, aid, f"{aid} {a['name']}: total float {t1} -> {t2} wd between schedule updates", sev,
                              [a["ref"], V.u_cur["ref"], V.u_prev["ref"]], {"tf_before_wd": t1, "tf_after_wd": t2, "data_date_before": p["data_date"], "data_date_after": a["data_date"]},
                              metrics={"tf_wd": -t2}))
        if a["total_float_wd"] < 0:
            out.append(_f(V, "SCH-NEG-FLOAT", aid, aid, f"{aid} {a['name']}: negative float {a['total_float_wd']} wd", "critical", [a["ref"]], {"tf_wd": a["total_float_wd"]}))
        if d_(a["early_start"]) <= V.day and not V.started(a):
            ptf = V.projected_tf(a)
            if ptf <= 5:
                out.append(_f(V, "SCH-UNSTARTED-ERODING", aid, aid, f"{aid} {a['name']} not started (early start {a['early_start']}); projected float {ptf} wd",
                              "critical" if ptf <= 0 else "high", [a["ref"], V.u_cur["ref"]],
                              {"early_start": a["early_start"], "tf_at_data_date_wd": a["total_float_wd"], "workdays_since_data_date": T.cal.wd_between(V.dd, V.day),
                               "projected_tf_wd": ptf}, metrics={"projected_tf_wd": -ptf}))
    # manpower (acute / sustained) on watched activities
    by = {}
    for l in V.logs:
        if l["type"] == "manpower_log" and l.get("activity_id_hint") in V.acts: by.setdefault(l["activity_id_hint"], []).append(l)
    wx = {l["log_date"]: l for l in V.logs if l["type"] == "weather_log"}
    for aid, ls in by.items():
        a = V.acts[aid]; plan = a.get("planned_crew_size"); ls.sort(key=lambda l: l["log_date"])
        if not plan: continue
        last = ls[-1]; prev = ls[-2] if len(ls) > 1 else None; tf = a["total_float_wd"]
        if last["log_date"] == V.day.isoformat() and prev and tf <= 5:
            drop = 1 - last["num_workers"] / prev["num_workers"] if prev["num_workers"] else 0
            w = wx.get(last["log_date"])
            if drop >= 0.40 and last["num_workers"] < 0.5 * plan and not (w and w.get("weather_delay")):
                out.append(_f(V, "SCH-MANPOWER-ACUTE", aid, aid, f"{last['vendor']} on {aid} {a['name']}: {prev['num_workers']} -> {last['num_workers']} workers vs {plan} planned (TF {tf} wd)",
                              "high", [last["ref"], prev["ref"], a["ref"]] + ([w["ref"]] if w else []),
                              {"workers_prior": prev["num_workers"], "workers_latest": last["num_workers"], "planned_crew": plan, "drop_pct": round(drop, 3),
                               "weather_delay_that_day": bool(w and w.get("weather_delay")), "tf_wd": tf, "company": last["vendor"]},
                              metrics={"shortfall": plan - last["num_workers"]}))
        run = 0
        for l in reversed(ls):
            if l["num_workers"] < 0.7 * plan: run += 1
            else: break
        if run >= 3:
            out.append(_f(V, "SCH-MANPOWER-SUSTAINED", aid, aid, f"{ls[-1]['vendor']} on {aid}: below 70% of planned crew for {run} logged days",
                          "high" if tf <= 5 else "medium", [l["ref"] for l in ls[-run:]] + [a["ref"]], {"days_below_70pct": run, "planned_crew": plan, "company": ls[-1]["vendor"]}))
    # inspections (typed inspection_log only; daily-log notes parsing deferred to M3)
    for l in V.logs:
        if l["type"] != "inspection_log" or str(l.get("result", "")).lower() != "failed": continue
        if T.cal.wd_between(d_(l["log_date"]), V.day) > 5: continue
        a = V.acts.get(l.get("activity_id_hint") or "")
        tf = a["total_float_wd"] if a else None
        re_d = l.get("reinspection_requested_for")
        if a and (tf <= 10 or (re_d and T.cal.wd_between(V.day, d_(re_d)) <= 5)):
            out.append(_f(V, "SCH-INSPECTION-FAIL", l["ref"], l.get("inspection_type", "Inspection"),
                          f"{l.get('inspection_type')} failed {l['log_date']} on {a['activity_id']} {a['name']} (TF {tf} wd); re-inspection {re_d}",
                          "high" if tf <= 5 else "medium", [l["ref"], a["ref"]], {"items": l.get("items"), "reinspection": re_d, "tf_wd": tf},
                          gov=re_d, gov_kind="reinspection_date", deadline=re_d))
    # delay log on near-critical work
    for l in V.logs:
        if l["type"] != "delay_log": continue
        cands = [V.acts[l["activity_id_hint"]]] if l.get("activity_id_hint") in V.acts else \
                [a for a in _company_acts(V, l.get("vendor")) if not a.get("actual_finish") and d_(a["early_start"]) <= T.cal.add_wd(V.day, 10)]
        cands = [a for a in cands if a["total_float_wd"] <= 5]
        if cands:
            a = min(cands, key=lambda a: a["total_float_wd"])
            out.append(_f(V, "SCH-DELAY-LOG", l["ref"], f"Delay log {l['log_date']}", f"{l.get('delay_type')} delay logged {l['log_date']} ({l.get('vendor')}) on {a['activity_id']} {a['name']} (TF {a['total_float_wd']} wd)",
                          "medium", [l["ref"], a["ref"]], {"description": l.get("description"), "duration_hours": l.get("duration_hours"), "tf_wd": a["total_float_wd"]}))
    # drawing revision after an approved submittal (link by spec section / sheet / description; RFI/CE bridge; discipline+corroboration)
    # Standalone fabrication-hold candidate (code-owned in rank); never merged into another finding.
    rfis = V.rfis
    STOP = {"level", "floor", "plans", "sheet", "drawing", "revision", "issued", "enlarged", "details", "revised",
            "title", "section", "unit", "wing", "tower", "building", "project", "shop", "drawings"}
    def _tok(s): return {t.lower() for t in re.findall(r"[A-Za-z]{5,}", s or "") if t.lower() not in STOP}
    for d in T.drawings:
        if d["issued_date"] > V.day.isoformat(): continue
        keys = [k for k in (d.get("issued_via"), d.get("number")) if k]
        specs = {r["spec_section"] for r in rfis if r.get("spec_section") and any(k in json.dumps(r) for k in keys)}
        for c in V.ces:
            if d["ref"] in (c.get("linked_drawings") or []):
                specs |= {r["spec_section"] for r in rfis if r["ref"] in (c.get("linked_rfis") or []) and r.get("spec_section")}
        for sp in (d.get("spec_sections") or []):
            if sp: specs.add(sp)
        dw_tok = _tok((d.get("title") or "") + " " + (d.get("description") or ""))
        divs = DISCIPLINE_DIVS.get(d.get("discipline") or "", [])
        for s in V.subs:
            resp = [a["response"] for a in s["approvers"] if a.get("response")]
            if not s["current_revision"] or not (set(resp) & APPROVED) or not s.get("closed_at") or s["closed_at"][:10] >= d["issued_date"]: continue
            sp = s.get("spec_section") or ""
            s_blob = " ".join(str(s.get(k) or "") for k in ("title", "label", "description", "notes", "comment", "number"))
            sw_tok = _tok(s_blob)
            sheet_hit = bool(d.get("number") and d["number"] in s_blob)
            overlap = len(dw_tok & sw_tok)
            div_hit = bool(sp and any(sp.replace(" ", "").startswith(div) for div in divs))
            # Prefer zero false alarms: discipline-alone is not enough (needs sheet or token corroboration).
            linked = (sp in specs) or sheet_hit or overlap >= 2 or (div_hit and (sheet_hit or overlap >= 1))
            if not linked: continue
            acts = [a for a in V.acts.values() if sp and sp in (a.get("spec_sections") or []) and a.get("pct_complete", 0) < 100]
            if not acts and s.get("scheduled_task"):
                aid = str(s["scheduled_task"]).split("|")[-1]
                if aid in V.acts and V.acts[aid].get("pct_complete", 0) < 100:
                    acts = [V.acts[aid]]
            # Strong links (spec bridge / sheet / explicit drawing.spec_sections) may fire even without a mapped open activity.
            strong = (sp in specs) or sheet_hit or (sp and sp in (d.get("spec_sections") or []))
            if not acts and not strong: continue
            fab = any("fabricat" in (e.get("body_text") or "").lower() and any(k in (e.get("body_text") or "") for k in keys) for e in V.emails)
            out.append(_f(V, "SCH-DWG-REV-AFTER-APPROVAL", f'{d["ref"]}|{s["ref"]}', f'{d["number"]} Rev {d["revision"]}',
                          f'{d["number"]} Rev {d["revision"]} ({d.get("issued_via")}, {d["issued_date"]}) issued after {s["label"]} was approved {s["closed_at"][:10]}; work not installed — confirm fabrication hold',
                          "high" if fab else "medium", [d["ref"], s["ref"]] + [a["ref"] for a in acts],
                          {"drawing_issued": d["issued_date"], "submittal_approved": s["closed_at"][:10],
                           "fabricated_material_mentioned": fab, "standalone_fabrication_hold": True}, spec=sp))
    return out

# ---------------- §4.3 cost ----------------
def cost_rules(V):
    out = []; T = V.T; b = V.budget
    if b:
        c = b["owner_contingency"]; gap = c["pct_used_incl_pending"] - b["percent_complete_cost"]
        new_exp = (c["pending_pcos_usd"] - V.budget_prev["owner_contingency"]["pending_pcos_usd"]) if V.budget_prev else 0
        why = []
        if gap >= 0.30: why.append(f"used incl. pending {c['pct_used_incl_pending']:.1%} vs {b['percent_complete_cost']:.0%} complete ({gap * 100:.1f} pts)")
        if c["remaining_after_pending_usd"] < 0.10 * c["owner_contingency_original_usd"]: why.append(f"remaining ${c['remaining_after_pending_usd']:,} < 10% of original")
        if new_exp > 0.10 * c["remaining_after_pending_usd"]: why.append(f"net new pending ${new_exp:,} > 10% of remaining")
        # the records behind the movement: change events new or re-estimated since the prior CE snapshot, and the ones the budget view
        # itself lists as unpriced (provenance for "pending rose $X")
        prev = {e["ref"]: e for e in V.ces_prev}
        movers = [e["ref"] for e in V.ces if e["status"] not in ("approved", "void") and (e["ref"] not in prev or prev[e["ref"]].get("rom_usd") != e.get("rom_usd")
                                                                                        or prev[e["ref"]]["status"] != e["status"])]
        listed = [e["ref"] for e in V.ces if any(u.split(" ")[0] == e["number"] for u in c.get("unpriced_change_events", []))]
        drivers = list(dict.fromkeys(movers + listed))[:4]
        if why:
            out.append(_f(V, "COST-CONTINGENCY-BURN", "owner_contingency", "Owner contingency", "Owner contingency burn: " + "; ".join(why),
                          "critical" if c["remaining_after_pending_usd"] < 0.10 * c["owner_contingency_original_usd"] else "high", [b["ref"]] + drivers,
                          {**c, "percent_complete_cost": b["percent_complete_cost"], "gap_points": round(gap * 100, 1), "pending_delta_usd": new_exp},
                          metrics={"pct_used_incl_pending": c["pct_used_incl_pending"], "remaining_neg": -c["remaining_after_pending_usd"]}))
    # COST-LINE-OVERRUN + contingency pairing deferred to M3 (CTO/Lead/Integrations 2026-10-06)
    for ce in V.ces:
        if ce["status"] in ("approved", "void") or ce.get("priced"): continue
        age = (V.day - d_(ce["created_date"])).days
        if (ce.get("rom_usd") is None and age > 7) or (ce.get("rom_usd") is not None and age > 14):
            out.append(_f(V, "COST-CE-UNPRICED", ce["ref"], ce["number"], f'{ce["number"]} {ce["title"]}: {"no ROM" if ce.get("rom_usd") is None else "ROM, not priced"} after {age} days',
                          "medium", [ce["ref"]] + (ce.get("linked_rfis") or []) + (ce.get("linked_drawings") or []), {"age_days": age, "rom_usd": ce.get("rom_usd"), "note": ce.get("note")},
                          metrics={"age_days": age}))
    for cm in T.commitments:
        for inv in cm.get("invoices", []):
            if inv["submitted_date"] > V.day.isoformat(): continue
            for ln in inv["lines"]:
                wing = re.search(r"\bWing ([A-Z])\b", ln["sov_line"])
                acts = [a for a in V.acts.values() if any(cc in (a.get("cost_code") or "") for cc in cm["cost_codes"]) and (not wing or a.get("wing") == wing.group(1))]
                dur = sum(a["original_duration_wd"] for a in acts)
                if not dur: continue
                earned = sum(a["original_duration_wd"] * a["pct_complete"] / 100 for a in acts) / dur
                over = ln["pct_complete_to_date"] - earned; usd = round(ln["scheduled_value_usd"] * over)
                if over >= 0.15 and usd >= 100000:
                    ids = [a["activity_id"] for a in acts]
                    out.append(_f(V, "COST-PAYAPP-AHEAD", f'{inv["ref"]}|{ln["sov_line"]}', f'Pay app #{inv["number"]} {cm["vendor"]}',
                                  f'{cm["vendor"]} pay app #{inv["number"]} bills "{ln["sov_line"]}" at {ln["pct_complete_to_date"]:.0%} vs {earned:.1%} schedule-earned (${usd:,} ahead)',
                                  "high" if usd >= 250000 else "medium", [inv["ref"], cm["ref"]] + [a["ref"] for a in acts],
                                  {"sov_line": ln["sov_line"], "billed_pct": ln["pct_complete_to_date"], "schedule_earned_pct": round(earned, 3), "overbilled_usd": usd,
                                   "activity_ids": ids, "company": cm["vendor"], "retainage_pct": cm["retainage_pct"], "requested_retainage_pct": inv.get("requested_retainage_pct")},
                                  metrics={"overbilled_usd": usd}))
    return out

def cost_followups(V, found):
    """Rules that depend on other findings (COST-RETAINAGE-REQUEST)."""
    out = []; T = V.T
    open_cos = {f["evidence"].get("company") for f in found if f["rule_id"] in ("COST-PAYAPP-AHEAD", "SCH-MANPOWER-ACUTE", "SCH-MANPOWER-SUSTAINED")}
    for cm in T.commitments:
        for inv in cm.get("invoices", []):
            if inv["submitted_date"] > V.day.isoformat(): continue
            rq = inv.get("requested_retainage_pct")
            if rq is not None and rq < cm["retainage_pct"] and cm["vendor"] in open_cos:
                em = [e["ref"] for e in V.emails if V.company_of_email(e) == cm["vendor"] and re.search(r"retainage|expedit", e["body_text"] + e["subject"], re.I)]
                out.append(_f(V, "COST-RETAINAGE-REQUEST", inv["ref"], f'Pay app #{inv["number"]} {cm["vendor"]}',
                              f'{cm["vendor"]} requests retainage {cm["retainage_pct"]:.0%} -> {rq:.0%} while a pay-app-ahead or manpower rule is open on the same company',
                              "high", [inv["ref"], cm["ref"]] + em, {"retainage_pct": cm["retainage_pct"], "requested_retainage_pct": rq, "company": cm["vendor"]}))
    return out

# ---------------- §4.6 procurement + buyout ----------------
# PM clarifications: held-out M1/M2 catch shapes are email slip $, long-lead review $, ASI fab-hold only.
# Do not plant buyout/PO/quote-expiry in held-outs. Rules below remain for Linden training-fixture parity
# (mock replay / F3 / decision blocking dates). COST-BUYOUT-GAP is budget-adjacent — still Linden-only.
def proc_rules(V):
    out = []; T = V.T
    subs = {s["spec_section"]: s for s in V.subs if s["current_revision"]}
    for cm in T.commitments:
        if cm["status"] == "Executed" or (cm.get("created_date") and cm["created_date"] > V.day.isoformat()): continue
        acts = [a for a in V.acts.values() if set(cm["spec_sections"]) & set(a.get("spec_sections") or [])]
        for sp in cm["spec_sections"]:
            s = subs.get(sp)
            if not s: continue
            resp = {a["response"] for a in s["approvers"] if a.get("response")}
            if resp & APPROVED and s.get("closed_at"):
                bd = T.cal.wd_between(d_(s["closed_at"]), V.day)
                if bd > 10:
                    out.append(_f(V, "PROC-PO-NOT-ISSUED", cm["ref"], cm["number"], f'{cm["number"]} {cm["vendor"]} still {cm["status"]} {bd} business days after {s["label"]} approval ({s["closed_at"][:10]})',
                                  "high", [cm["ref"], s["ref"]] + [a["ref"] for a in acts], {"status": cm["status"], "approved_on": s["closed_at"][:10], "business_days_since": bd,
                                                                                           "amount_usd": cm["contract_amount_usd"]}, metrics={"bd": bd}))
        q = cm.get("quote_terms") or {}
        exp = q.get("price_valid_through")
        if exp and exp >= V.day.isoformat() and T.cal.wd_between(V.day, d_(exp)) <= 10:
            post = q.get("post_expiry") or ""; m_w = re.search(r"(\d+)[- ]week", post); m_p = re.search(r"\+\s*(\d+(?:\.\d+)?)\s*%", post)
            post_wk = int(m_w.group(1)) if m_w else None; lead = q.get("lead_time_weeks")
            worse = bool(post_wk and lead and post_wk > lead)
            out.append(_f(V, "PROC-QUOTE-EXPIRY", cm["ref"], cm["number"], f'{cm["number"]} {cm["vendor"]} unissued; quote valid through {exp}; after expiry: {post or "n/a"}',
                          "high" if worse else "medium", [cm["ref"], cm.get("quote_ref")] + [a["ref"] for a in acts],
                          {"price_valid_through": exp, "lead_time_weeks": lead, "post_expiry_lead_weeks": post_wk, "escalation_pct": float(m_p.group(1)) if m_p else None,
                           "amount_usd": cm["contract_amount_usd"], "activity_ids": [a["activity_id"] for a in acts], "business_days_to_expiry": T.cal.wd_between(V.day, d_(exp))},
                          gov=exp, gov_kind="quote_expiry", deadline=exp))
    b = V.budget
    if b:
        pend = [it for m in V.meetings for it in m.get("items", []) if it["type"] == "decision_pending" and it["status"] == "open"]
        for ln in b["lines"]:
            if ln["committed_costs_usd"] or not ln["original_budget_usd"]: continue
            if any(cm["status"] == "Executed" and ln["cost_code"] in cm["cost_codes"] for cm in T.commitments): continue
            acts = [a for a in V.acts.values() if (a.get("cost_code") or "") == ln["cost_code"] or ln["cost_code"].replace("-", " ")[:5] in " ".join(a.get("spec_sections") or [])]
            spec = ln["cost_code"][:2] + " " + ln["cost_code"][3:5] + " " + ln["cost_code"][5:7] if re.match(r"^\d\d-\d{4}$", ln["cost_code"]) else None
            acts = acts or [a for a in V.acts.values() if spec and spec in (a.get("spec_sections") or [])]
            s = next((x for x in V.subs if x["current_revision"] and spec and x["spec_section"] == spec), None)
            lead = (s or {}).get("lead_time") or 0
            words = [w for w in re.findall(r"[A-Za-z]{5,}", ln["description"]) if w.lower() not in ("level", "plant")]
            blocking = [it for it in pend if any(w.lower() in it["text"].lower() for w in words)]
            soon = [a for a in acts if not a.get("actual_start") and (d_(a["early_start"]) - V.day).days <= lead + 30]
            draft_po = any(ln["cost_code"] in cm["cost_codes"] for cm in T.commitments)
            if (soon or blocking) and not draft_po:
                out.append(_f(V, "COST-BUYOUT-GAP", ln["cost_code"], ln["description"], f'{ln["description"]} ({ln["cost_code"]}) not bought out' +
                              (f'; install {soon[0]["activity_id"]} starts {soon[0]["early_start"]}' if soon else "") + ("; owner selection pending" if blocking else ""),
                              "high" if blocking else "medium", [b["ref"]] + [a["ref"] for a in acts] + [it["ref"] for it in blocking] + ([s["ref"]] if s else []),
                              {"budget_usd": ln["original_budget_usd"], "lead_time_days": lead, "blocking_decisions": [it["ref"] for it in blocking]}))
    return out

# ---------------- §4.7 decisions (meeting register) + §4.9 notice language ----------------
def dec_rules(V):
    out = []; T = V.T
    for m in V.meetings:
        for it in m.get("items", []):
            if it["status"] != "open": continue
            nb = d_(it.get("due_date")); carried = len(it.get("carried_from") or [])
            if it["type"] == "decision_pending":
                fired = []
                if nb and nb < V.day: fired.append("DEC-OVERDUE")
                if carried >= 2: fired.append("DEC-CARRIED")
                if nb and nb >= V.day and T.cal.wd_between(V.day, nb) <= 10: fired.append("DEC-DUE-SOON")
                if not fired: continue
                late = (V.day - nb).days if nb and nb < V.day else 0
                out.append(_f(V, fired[0], it["ref"], f'{m["title"]} item {it["number"]}', f'Decision {it["number"]} ({it["assignee"]}): {it["text"][:120]}' + (f"; {late} days late" if late else ""),
                              "high" if ("DEC-OVERDUE" in fired and "DEC-CARRIED" in fired) else "medium", [it["ref"]],
                              {"rules": fired, "needed_by": it.get("due_date"), "days_late": late, "carried_count": carried, "owner": it["assignee"]},
                              gov=it.get("due_date"), gov_kind="needed_by", days=late, bic=it["assignee"], deadline=it.get("due_date"), metrics={"days_late": late}))
            elif it["type"] == "decision_made" and T.cal.wd_between(d_(m["date"]), V.day) >= 5:
                out.append(_f(V, "DEC-NO-FOLLOW-THROUGH", it["ref"], f'{m["title"]} item {it["number"]}', f'Decision made at {m["title"]} item {it["number"]} still open (follow-through due {it.get("due_date")}): {it["text"][:120]}',
                              "medium", [it["ref"]], {"needed_by": it.get("due_date"), "owner": it["assignee"]}, gov=it.get("due_date"), gov_kind="follow_through_due",
                              bic=it["assignee"], deadline=it.get("due_date")))
    for e in V.emails:
        if T.local_date(e["received_at"]) != V.day: continue
        from .fact_rules import notice_fact
        nf = notice_fact(T, e["ref"])
        if nf is not None:   # extraction ran for this email: the verified facts decide (no phrasing rules)
            if nf[0]:
                out.append(_f(V, "EMAIL-NOTICE-LANGUAGE", e["ref"], f'Email: {e["from"]["name"]}', f'Contractual notice in email from {e["from"]["name"]} ({V.company_of_email(e) or "unknown company"}): "{(nf[2] or "")[:140]}"',
                              "high", [e["ref"]], {"phrase": nf[2], "received_at": e["received_at"], "company": V.company_of_email(e),
                                                   "notice_types": nf[1], "source": "email_facts"}))
            continue
        m = NOTICE_RE.search(e["subject"] + "\n" + e["body_text"])
        if m:
            from .notices import code_types
            out.append(_f(V, "EMAIL-NOTICE-LANGUAGE", e["ref"], f'Email: {e["from"]["name"]}', f'Contractual notice language in email from {e["from"]["name"]} ({V.company_of_email(e) or "unknown company"}): "{m.group(0)}"',
                          "high", [e["ref"]], {"phrase": m.group(0), "received_at": e["received_at"], "company": V.company_of_email(e),
                                               "notice_types": code_types(e["subject"] + "\n" + e["body_text"])}))
    return out

# ---------------- PM rule 3 (2026-10-06): differing site condition ----------------
DSC_RE = re.compile(r"\b(rock|unforeseen|differing site|concealed condition|existing conditions?|unsuitable soils?|soft soils?|groundwater|"
                    r"contaminat\w*|obstructions?|buried|boulders?)\b", re.I)
def _txt(r): return " ".join(str(r.get(k) or "") for k in ("subject", "question", "title", "description", "comment", "delay_type", "location"))

def dsc_rules(V):
    """Differing/unforeseen site condition recorded via an open RFI (or a CE / delay log without one). Its own item with its own exposure
    line (linked CE ROM); owner-notice flag is attached in candidates from configured notice periods only."""
    T = V.T; covered = set()
    def num(r): m = re.search(r"#\s*(\d+)", r.get("label") or ""); return m and m.group(1)
    from .fact_rules import dsc_fact_rules
    out, handled = dsc_fact_rules(V)
    covered |= {c for f in out for c in f["evidence"].get("ce_refs") or []}
    for r in [x for x in V.rfis if x["ref"] not in handled and x.get("status") != "closed" and DSC_RE.search(_txt(x))]:
        ces = [c for c in V.ces if r["ref"] in (c.get("linked_rfis") or []) and c.get("status") not in ("void", "approved")]
        lref = {x for c in ces for x in c.get("linked_daily_logs") or []}
        n = num(r)
        logs = [l for l in V.logs if DSC_RE.search(_txt(l)) and (l["ref"] in lref or (n and re.search(rf"\bRFI\s*#?\s*{n}\b", _txt(l))))]
        dates = sorted([l["log_date"] for l in logs] + [str(r.get("created_at") or "")[:10]])
        ev = next((d for d in dates if d), None)
        rom = sum(c.get("rom_usd") or 0 for c in ces)
        covered |= {c["ref"] for c in ces}
        m = DSC_RE.search(_txt(r))
        out.append(_f(V, "COST-DIFFERING-SITE-CONDITION", r["ref"], r.get("label") or r["ref"],
                      f'Site condition ({m.group(0).lower()}) via {r.get("label")}: {r.get("subject")}' + (f'; linked CE ROM ${rom:,.0f}' if rom else "; no CE / price yet"),
                      "high" if rom or any(l["type"] == "delay_log" for l in logs) else "medium",
                      [r["ref"]] + [c["ref"] for c in ces] + [l["ref"] for l in logs],
                      {"event_date": ev, "rfi_due": r.get("due_date"), "ce_refs": [c["ref"] for c in ces], "rom_usd": rom or None,
                       "condition": m.group(0), "location": r.get("location")},
                      gov=r.get("due_date"), gov_kind="due_date", bic=r.get("ball_in_court"), spec=r.get("spec_section"), deadline=r.get("due_date"),
                      days=max(0, (V.day - d_(r["due_date"])).days) if r.get("due_date") else 0))
    for c in V.ces:
        if c["ref"] in covered or c.get("status") in ("void", "approved") or not DSC_RE.search(_txt(c)): continue
        out.append(_f(V, "COST-DIFFERING-SITE-CONDITION", c["ref"], c.get("number") or c["ref"], f'Site condition via {c.get("number")}: {c.get("title")}',
                      "high" if c.get("rom_usd") else "medium", [c["ref"]] + (c.get("linked_daily_logs") or []),
                      {"event_date": c.get("created_date"), "ce_refs": [c["ref"]], "rom_usd": c.get("rom_usd"), "condition": DSC_RE.search(_txt(c)).group(0)}))
    return out


# ---------------- email / RFI product gaps (iteration 4, 2026-10-06) ----------------
DATE_TOKEN = re.compile(r"\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}|\d{1,2}/\d{1,2}(?:/\d{2,4})?|\d{4}-\d{2}-\d{2})\b", re.I)
DELIVERY_DELAY_RE_LOCAL = re.compile(r"\b(delivery\s+(?:has\s+been\s+)?delay\w*|delayed\s+delivery|shipment\s+delay\w*)\b", re.I)
SLIP_RE = re.compile(
    r"(?:push(?:es|ing)?|move[sd]?|slip(?:s|ped)?|delay(?:s|ed)?|reschedul\w*|next (?:available )?slot|delivery\s+(?:of\s+[\w\s\-]{0,40}?)?(?:from|moves?|now))\s+"
    r".{0,80}?(?:from\s+)?(?P<d1>(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}|\d{1,2}/\d{1,2})(?:\s*(?:to|until|->)\s+)"
    r"(?:approximately\s+|about\s+|approx\.?\s+|~)?(?P<d2>(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}|\d{1,2}/\d{1,2})",
    re.I)
OWNER_DIR_RE = re.compile(
    r"\b((?:please|kindly)\s+(?:issue|proceed|install|change|use|switch|replace|upgrade|revise|provide|add)|"
    r"approves?\s+(?:the\s+)?(?:change|pco|co|upgrade|finish|scope|selection)|"
    r"(?:owner|we|i)\s+(?:directs?|directed|requir(?:e|es|ed)|want(?:s|ed)?|select(?:s|ed)|has selected|chose|chosen)\b|"
    r"direct(?:s|ed|ing)\s+(?:you\s+)?to|"
    r"go ahead(?:\s+and)?(?:\s+\w+){0,6}\s+(?:price|proceed|install|order|start)|"
    r"add\s+(?:\d+|six|seven|eight|nine|ten|[a-z]+)\s+[\w\s\-]{0,40}(?:charger|ev\b|finish|scope|unit)|"
    r"price later|proceed(?:\s+with)?|do not hold\b)\b", re.I)
GO_AHEAD_RE = re.compile(r"\b(go ahead|proceed|price later|do not hold|start (?:the )?work|issue the change|authorized to proceed|you(?:'re| are) authorized)\b", re.I)
MONEY_RE = re.compile(r"\$\s?([\d,]+(?:\.\d+)?)\s*([kKmM])?")

def _parse_md(token, year):
    token = token.strip(); m = re.match(r"(\d{4})-(\d{2})-(\d{2})$", token)
    if m: return d_(token)
    m = re.match(r"(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?$", token)
    if m:
        y = int(m.group(3)) if m.group(3) else year
        if y < 100: y += 2000
        return __import__("datetime").date(y, int(m.group(1)), int(m.group(2)))
    m = re.match(r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})", token, re.I)
    if m:
        mo = {"jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,"jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}[m.group(1).lower()[:3]]
        return __import__("datetime").date(year, mo, int(m.group(2)))
    return None

def _email_acts(V, e):
    """Activities an email maps to via record links (email→RFI/submittal/CE→activity). Name tokens only as last resort, requiring
    an activity_id or ≥2 distinctive name tokens. Prefer driving-path / low float. Never uses submittal location/cost_code."""
    T = V.T; refs = {e["ref"]}
    for l in T.links():
        if l["a"] == e["ref"]: refs.add(l["b"])
        if l["b"] == e["ref"]: refs.add(l["a"])
    for _ in range(2):  # two hops: email→RFI→submittal / CE, and submittal→activity via scheduled_task / spec
        hop = set()
        for r in list(refs):
            for l in T.links():
                if l["a"] == r: hop.add(l["b"])
                if l["b"] == r: hop.add(l["a"])
            if r in T.index and T.index[r][0] == "submittal":
                st = T.index[r][1].get("scheduled_task")
                if st: hop.add("p6:activity:" + (st.split("|")[-1] if "|" in str(st) else str(st)))
                spec = T.index[r][1].get("spec_section")
                if spec:
                    hop |= {a["ref"] for a in V.acts.values() if spec in (a.get("spec_sections") or [])}
            if r in T.index and T.index[r][0] == "rfi":
                spec = T.index[r][1].get("spec_section")
                if spec:
                    hop |= {a["ref"] for a in V.acts.values() if spec in (a.get("spec_sections") or [])}
        refs |= hop
    acts = [V.acts[r.split(":")[-1]] for r in refs if r.startswith("p6:activity:") and r.split(":")[-1] in V.acts]
    if not acts:
        text = ((e.get("subject") or "") + " " + (e.get("body_text") or "")).lower()
        for a in V.acts.values():
            if a.get("actual_finish") or a.get("pct_complete", 0) >= 100: continue
            if a["activity_id"].lower() in text: acts.append(a); continue
            tokens = [t.lower() for t in re.findall(r"[A-Za-z]{5,}", a["name"]) if t.lower() not in
                      ("level", "wing", "floor", "phase", "rough", "install", "frame", "pour", "form")]
            if sum(1 for t in tokens if t in text) >= 2: acts.append(a)
    acts = [a for a in acts if not a.get("actual_finish")]
    acts.sort(key=lambda a: (0 if a.get("on_driving_path_to_tco") else 1, a["total_float_wd"]))
    return acts

def email_rfi_rules(V):
    out = []; T = V.T
    # 2. Closed RFI declaring cost/schedule impact with no matching CE
    from .fact_rules import rfacts, efacts, email_slip_rules, closed_rfi_rules
    out += closed_rfi_rules(V) + email_slip_rules(V)
    for r in V.rfis:
        if r.get("status") != "closed" or rfacts(T, r["ref"]) is not None: continue
        ci = str(r.get("cost_impact") or "").lower(); si = str(r.get("schedule_impact") or "").lower()
        if not (ci.startswith("yes") or si.startswith("yes")): continue
        ces = [c for c in V.ces if r["ref"] in (c.get("linked_rfis") or [])]
        if ces: continue  # any linked CE (incl. priced) → do not double-flag (rule 12)
        # also no CE that mentions the RFI number in title/note (priced or pending)
        n = re.search(r"#\s*(\d+)", r.get("label") or "")
        if n and any(re.search(rf"\bRFI\s*#?\s*{n.group(1)}\b", (c.get("title") or "") + " " + (c.get("note") or ""), re.I) for c in V.ces):
            continue
        impact = "cost and schedule" if ci.startswith("yes") and si.startswith("yes") else ("cost" if ci.startswith("yes") else "schedule")
        out.append(_f(V, "RFI-CLOSED-IMPACT-NO-CE", r["ref"], r.get("label") or r["ref"],
                      f'{r.get("label")}: closed with {impact} impact declared and no change event on file',
                      "high" if ci.startswith("yes") else "medium", [r["ref"]],
                      {"cost_impact": r.get("cost_impact"), "schedule_impact": r.get("schedule_impact"), "closed_at": (r.get("time_resolved") or "")[:10]},
                      bic=r.get("ball_in_court"), spec=r.get("spec_section")))
    # 1 + 3. Emails of the as_of day (and recently for long-lead slips still open)
    from .parties import party_for_record
    for e in V.emails:
        recv = T.local_date(e["received_at"])
        if recv > V.day or (V.day - recv).days > 7: continue
        text = (e.get("subject") or "") + "\n" + (e.get("body_text") or "")
        party = party_for_record(T.project, e)
        # 1. Email-driven schedule slip → dollar exposure (skip when a later email/log shows the material already received)
        #    Legacy phrasing path only for emails WITHOUT extracted facts (facts → fact_rules.email_slip_rules).
        m = SLIP_RE.search(text) if efacts(T, e["ref"]) is None else None
        if m:
            d1, d2 = _parse_md(m.group("d1"), V.day.year), _parse_md(m.group("d2"), V.day.year)
            if d1 and d2 and d2 > d1:
                try:
                    from .stages.rank import delivery_complete_for as _deliv_done
                    if DELIVERY_DELAY_RE_LOCAL.search(text) and _deliv_done(T, e["ref"]):
                        continue
                except Exception:
                    pass
                acts = [a for a in _email_acts(V, e) if a.get("on_driving_path_to_tco") or a["total_float_wd"] <= 10]
                if acts:
                    slip_cd = (d2 - d1).days; a0 = acts[0]
                    out.append(_f(V, "SCH-EMAIL-DATE-SLIP", e["ref"], f'Email: {e["from"]["name"] if isinstance(e.get("from"), dict) else str(e.get("from")).split(" <")[0]}',
                                  f'Email states schedule move {(d1.month)}/{d1.day} -> {(d2.month)}/{d2.day} ({slip_cd} cd) affecting {a0["activity_id"]} {a0["name"]} (TF {a0["total_float_wd"]} wd)',
                                  "high" if a0.get("on_driving_path_to_tco") or a0["total_float_wd"] <= 5 else "medium",
                                  [e["ref"], a0["ref"]] + [a["ref"] for a in acts[1:3]],
                                  {"from_date": d1.isoformat(), "to_date": d2.isoformat(), "slip_cd": slip_cd, "activity_ids": [a["activity_id"] for a in acts[:4]],
                                   "quote": m.group(0)[:220], "party": (party or {}).get("name"), "party_role": (party or {}).get("role")},
                                  gov=d2.isoformat(), gov_kind="email_stated_date", deadline=d2.isoformat(),
                                  metrics={"slip_cd": slip_cd}))
        # 3. Owner directive with no matching CE (with or without a stated $)
        if party and party.get("role") == "owner" and OWNER_DIR_RE.search(text):
            mm = MONEY_RE.search(text); amt = None
            if mm:
                amt = float(mm.group(1).replace(",", ""))
                if mm.group(2) and mm.group(2).lower() == "k": amt *= 1e3
                if mm.group(2) and mm.group(2).lower() == "m": amt *= 1e6
            ids = re.findall(r"\b(?:PCO|CE|CO)[- ]?(\d+)\b", text, re.I)
            matched = []
            subj = (e.get("subject") or "").lower()
            for c in V.ces:
                if any(str(c.get("number", "")).endswith(i) or str(c.get("pco_number") or "").endswith(i) for i in ids): matched.append(c); continue
                if amt is not None and c.get("rom_usd") and abs(c["rom_usd"] - amt) < 1: matched.append(c); continue
                # No-$ directives only: strong title overlap with an existing CE (>=3 tokens) → already recorded (prefer fewer false alarms)
                if amt is None:
                    words = [w for w in re.findall(r"[a-z]{5,}", subj) if w not in ("please", "change", "email", "project", "owner")]
                    if sum(1 for w in words if w in (c.get("title") or "").lower()) >= 3:
                        matched.append(c)
            # Dollar path: require >= $1k. No-dollar path: require clear go-ahead / proceed language (prefer fewer false alarms).
            if not matched and ((amt is not None and amt >= 1000) or (amt is None and GO_AHEAD_RE.search(text))):
                money_bit = f" with ${amt:,.0f} impact" if amt is not None else " (amount TBD / price later)"
                out.append(_f(V, "COST-OWNER-DIRECTIVE-NO-CE", e["ref"], f'Email: {(party or {}).get("name") or "owner"}',
                              f'Owner directive by email{money_bit} and no change event on file: {(e.get("subject") or "")[:80]}',
                              "high" if (amt or 0) >= 25000 else "medium", [e["ref"]],
                              {"amount_usd": amt, "party": (party or {}).get("name"), "quote": OWNER_DIR_RE.search(text).group(0)[:120],
                               "directive": True},
                              metrics={"amount_usd": amt} if amt is not None else {}))
    return out


def sub_rr_rules(V):
    """Pattern 6: Revise-and-Resubmit with no resubmittal yet, linked activity within near-term window.
    Prefer zero false alarms: far-float / far-ROS R&R drafts do not fire."""
    out = []; T = V.T
    # Group by formatted_number / label stem
    series = {}
    for s in V.subs:
        key = s.get("formatted_number") or s.get("label") or s["ref"]
        series.setdefault(key, []).append(s)
    for key, revs in series.items():
        # prior R&R responses
        rr = [s for s in revs if any((a.get("response") or "") == "Revise and Resubmit" for a in (s.get("approvers") or []))]
        if not rr: continue
        cur = next((s for s in revs if s.get("current_revision")), None)
        if not cur: continue
        # No resubmittal yet: current is Draft (not received) OR still carrying R&R without a later Approved/Open-with-received
        recv = cur.get("received_date")
        resp = {(a.get("response") or "") for a in (cur.get("approvers") or [])}
        no_resub = (cur.get("status") == "Draft" and not recv) or ("Revise and Resubmit" in resp and not recv)
        if not no_resub: continue
        # Map activity
        acts = []
        st = cur.get("scheduled_task")
        if st:
            aid = str(st).split("|")[-1]
            if aid in V.acts: acts = [V.acts[aid]]
        sp = cur.get("spec_section")
        if not acts and sp:
            acts = [a for a in V.acts.values() if sp in (a.get("spec_sections") or []) and not a.get("actual_finish")]
        if not acts: continue
        a0 = min(acts, key=lambda a: a["total_float_wd"])
        # Near-term gate: early start within 45 cd OR TF <= 15
        try:
            es = d_(a0["early_start"])
        except Exception:
            continue
        # Near-term = activity starts soon (prefer zero FA: far-start R&R like toilet/windows must not fire on TF alone)
        days_to_start = (es - V.day).days
        if days_to_start > 45: continue
        margin = None
        if cur.get("required_on_site_date") is not None and cur.get("lead_time") is not None:
            import datetime as _dt
            latest = d_(cur["required_on_site_date"]) - _dt.timedelta(days=int(cur["lead_time"]) + int(cur.get("buffer_time") or 0))
            margin = (latest - V.day).days
        # Still skip comfortable float with comfortable ROS even if start is within 45d
        if a0["total_float_wd"] > 20 and (margin is None or margin > 21):
            continue
        due = cur.get("submit_by") or cur.get("due_date")
        out.append(_f(V, "SUB-RR-NOT-RESUBMITTED", cur["ref"], cur.get("label") or key,
                      f'{cur.get("label") or key}: revise-and-resubmit outstanding; no resubmittal received; '
                      f'{a0["activity_id"]} starts {a0["early_start"]} (TF {a0["total_float_wd"]} wd)',
                      "high" if a0["total_float_wd"] <= 5 else "medium",
                      [cur["ref"], a0["ref"]] + [x["ref"] for x in rr[:3]],
                      {"rr_count": len(rr), "submit_by": cur.get("submit_by"), "activity_id": a0["activity_id"],
                       "early_start": a0["early_start"], "tf_wd": a0["total_float_wd"], "ros_margin_d": margin},
                      gov=due, gov_kind="submit_by", deadline=due, bic=(cur.get("ball_in_court") or [None])[0] if isinstance(cur.get("ball_in_court"), list) else cur.get("ball_in_court"),
                      spec=sp, days=max(0, (V.day - d_(due)).days) if due else 0))
    return out

def run_rules(T, day):
    V = DayView(T, day)
    from .fact_rules import rfi_near_start_rules
    found = sch_rules(V) + cost_rules(V) + proc_rules(V) + dec_rules(V) + dsc_rules(V) + email_rfi_rules(V) + sub_rr_rules(V) + rfi_near_start_rules(V)
    found += cost_followups(V, found)
    for f in found: f["run_date"] = V.day.isoformat()
    return found

def lifecycle(cur, prev):
    """NEW / WORSE / UNCHANGED per fingerprint + code-built delta text from `metrics` (higher = worse) and severity."""
    P = {f["fingerprint"]: f for f in prev}
    for f in cur:
        p = P.get(f["fingerprint"])
        if not p: f["change_since_prior_run"] = "new"; f["first_detected_on"] = f["run_date"]; f["delta"] = None; continue
        f["first_detected_on"] = p.get("first_detected_on") or p["run_date"]
        deltas = []
        if SEV.index(f["severity"]) > SEV.index(p["severity"]): deltas.append(f'severity {p["severity"]} -> {f["severity"]}')
        for k, v in (f.get("metrics") or {}).items():
            pv = (p.get("metrics") or {}).get(k)
            if isinstance(v, (int, float)) and isinstance(pv, (int, float)) and v > pv: deltas.append((k, pv, v))
        f["change_since_prior_run"] = "worse" if deltas else "unchanged"
        f["delta"] = deltas or None
    cur_fp = {f["fingerprint"] for f in cur}
    resolved = [dict(p, change_since_prior_run="resolved") for p in prev if p["fingerprint"] not in cur_fp]
    return cur, resolved
