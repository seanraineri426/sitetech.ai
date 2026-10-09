"""S7 deterministic impact math (compute_impact). Models request; code computes from records it re-reads (never caller values,
except scenario parameters such as slip_wd, which are echoed in `method` and labelled as scenario inputs)."""
import datetime as dt
from .calendar_util import d_

PNR_DEFAULT = 0.25  # DAILY_BRIEF_SPEC 5.2 payment_risk default P(non-recovery)

def _rec(T, ref, typ=None):
    if ref not in T.index: raise ValueError(f"ref_not_found: {ref}")
    t, r = T.index[ref]
    if typ and t != typ: raise ValueError(f"{ref} is {t}, expected {typ}")
    return r

def _act(T, aid):
    aid = aid.split(":")[-1]
    return _rec(T, "p6:activity:" + aid, "activity")

def _tco(T):
    m = T.project["key_milestones"][0]; return m["activity_id"], d_(m["baseline"])

def delay_chain(T, p, refs):
    """milestone_wd = max(0, slip_wd - TF_ref); TF_ref = min TF over activity_ids (U2), projected forward for unstarted
    activities to `tf_as_of` (TF - workdays since data date). milestone_cd on the project calendar from the key milestone date (project.json key_milestones)."""
    ids = p.get("activity_ids") or [r.split(":")[-1] for r in refs if r.startswith("p6:activity:")]
    if not ids: raise ValueError("delay_chain needs activity_ids")
    acts = [_act(T, a) for a in ids]
    dd = d_(acts[0]["data_date"])
    tf_as_of = d_(p.get("tf_as_of")) if p.get("tf_as_of") else None
    tfs = {}
    for a in acts:
        tf = a["total_float_wd"]
        if tf_as_of and tf_as_of > dd and not a.get("actual_start") and d_(a["early_start"]) <= tf_as_of:
            tf = tf - T.cal.wd_between(dd, tf_as_of)
        tfs[a["activity_id"]] = tf
    tf_ref = min(tfs.values())
    if p.get("slip_wd") is not None: slip = int(p["slip_wd"]); slip_basis = f"{slip} wd (scenario input)"
    elif p.get("slip_cd") is not None:
        anchor = d_(p.get("anchor_date")) or T.as_of
        slip = T.cal.wd_between(anchor, anchor + dt.timedelta(days=int(p["slip_cd"])))
        slip_basis = f'{p["slip_cd"]} cd from {anchor} = {slip} wd (scenario input)'
    else: raise ValueError("delay_chain needs slip_wd or slip_cd")
    mwd = max(0, slip - tf_ref)
    mid, tco = _tco(T)
    mcd = (T.cal.add_wd(tco, mwd) - tco).days if mwd > 0 else 0
    rate = T.project["delay_cost_basis"]["daily_delay_cost_usd"]
    return {"type": "delay_chain", "activity_tf_wd": tfs, "tf_ref_wd": tf_ref, "tf_as_of": (tf_as_of or dd).isoformat(), "slip_wd": slip,
            "milestone_wd": mwd, "milestone_cd": mcd, "milestone": mid, "milestone_baseline": tco.isoformat(),
            "milestone_forecast_if_condition": T.cal.add_wd(tco, mwd).isoformat() if mwd else tco.isoformat(),
            "delay_usd": mcd * rate, "condition": p.get("condition"),
            "method": f"slip {slip_basis} - TF {tf_ref} wd ({'projected to ' + tf_as_of.isoformat() if tf_as_of else T.sched_label() + ' data date ' + dd.isoformat()}) "
                      f"= {mwd} wd beyond float -> {T.milestone_name} +{mcd} cd x ${rate:,}/cd = ${mcd * rate:,}"}

def usd_sum(T, p, refs):
    items = p.get("items") or [{"ref": r, "field": p.get("field", "rom_usd")} for r in refs]
    tot, parts = 0.0, []
    for it in items:
        rec = _rec(T, it["ref"]); f = it.get("field") or ("rom_usd" if "rom_usd" in rec else "contract_amount_usd")
        v = rec
        for k in f.split("."): v = v.get(k) if isinstance(v, dict) else None
        if v is None: parts.append({"ref": it["ref"], "field": f, "value": None, "note": "unpriced / missing"}); continue
        mult = float(it.get("multiplier", 1)); tot += v * mult
        parts.append({"ref": it["ref"], "field": f, "value": v, "multiplier": mult, "contrib": round(v * mult, 2)})
    return {"type": "usd_sum", "total_usd": round(tot, 2), "parts": parts, "kind": p.get("kind"),
            "method": " + ".join(f'{x["field"]}({x["ref"].split(":")[-1]}){"" if x.get("multiplier", 1) == 1 else " x " + str(x["multiplier"])}' for x in parts) + f" = ${tot:,.0f}"}

def contingency(T, p, refs):
    cur = next(b for b in T.budget if b["snapshot_date"] == T.as_of.isoformat())
    prv = next(b for b in T.budget if b["snapshot_date"] == T.compare_to.isoformat())
    c, q = cur["owner_contingency"], prv["owner_contingency"]
    return {"type": "contingency", "snapshot_ref": cur["ref"], "compare_ref": prv["ref"], "original_usd": c["owner_contingency_original_usd"],
            "approved_usd": c["approved_change_orders_usd"], "pending_usd": c["pending_pcos_usd"], "remaining_usd": c["remaining_after_pending_usd"],
            "pct_used_incl_pending": c["pct_used_incl_pending"], "pct_used_prior": q["pct_used_incl_pending"], "pct_complete_cost": cur["percent_complete_cost"],
            "gap_points": round((c["pct_used_incl_pending"] - cur["percent_complete_cost"]) * 100, 1),
            "pending_delta_usd": c["pending_pcos_usd"] - q["pending_pcos_usd"], "remaining_prior_usd": q["remaining_after_pending_usd"],
            "unpriced": c["unpriced_change_events"],
            "method": f'(approved {c["approved_change_orders_usd"]:,} + pending {c["pending_pcos_usd"]:,}) / {c["owner_contingency_original_usd"]:,} = '
                      f'{c["pct_used_incl_pending"]:.1%} used vs {cur["percent_complete_cost"]:.0%} complete; remaining ${c["remaining_after_pending_usd"]:,}'}

def notice_window(T, p, refs):
    """Iteration 3 (CTO guardrails): code-only, from configured notice periods (notices.py). No default day counts anywhere."""
    from .notices import for_notice_email
    ref = p.get("notice_ref") or next((r for r in refs if r.startswith("msgraph_outlook:message:")), None)
    if not ref: raise ValueError("notice_window needs the notice email ref")
    return for_notice_email(T, ref, p.get("notice_types"))

def ros_margin(T, p, refs):
    ref = p.get("submittal_ref") or next(r for r in refs if ":submittal:" in r)
    f = [x for x in T.t_list_findings(rule_ids=["SUB-ROS-RISK"]) if any(c["ref"] == ref for c in x["citations"])]
    if f: return {"type": "ros_margin", "submittal_ref": ref, "finding": f[0]["finding_id"], **f[0]["evidence"], "method": "SUB-ROS-RISK finding evidence (M1 rule)"}
    s = _rec(T, ref, "submittal")
    if not s.get("required_on_site_date") or s.get("lead_time") is None: return {"type": "ros_margin", "submittal_ref": ref, "gap": "ROS or lead time missing"}
    latest = d_(s["required_on_site_date"]) - dt.timedelta(days=s["lead_time"] + (s.get("buffer_time") or 0))
    return {"type": "ros_margin", "submittal_ref": ref, "latest_return_date": latest.isoformat(), "method": "ROS - lead - buffer"}

def payapp_earned(T, p, refs):
    rq = _rec(T, p.get("requisition_ref") or next(r for r in refs if ":requisition:" in r), "requisition")
    line = next(l for l in rq["lines"] if not p.get("sov_line") or l["sov_line"] == p["sov_line"])
    ids = p.get("activity_ids") or [r.split(":")[-1] for r in refs if r.startswith("p6:activity:")]
    acts = [_act(T, a) for a in ids]
    dur = sum(a["original_duration_wd"] for a in acts)
    earned = sum(a["original_duration_wd"] * a["pct_complete"] / 100 for a in acts) / dur if dur else None
    billed = line["pct_complete_to_date"]; sv = line["scheduled_value_usd"]
    over = round(sv * (billed - earned)) if earned is not None else None
    ret = rq.get("retainage_pct", 0.1)
    return {"type": "payapp_earned", "requisition_ref": "procore:requisition:" + str(rq["id"]), "sov_line": line["sov_line"], "scheduled_value_usd": sv,
            "billed_pct": billed, "billed_pct_prev": line["pct_complete_prev"], "schedule_earned_pct": round(earned, 3) if earned is not None else None,
            "activities": {a["activity_id"]: {"dur_wd": a["original_duration_wd"], "pct_complete": a["pct_complete"]} for a in acts},
            "overbilled_usd": over, "net_of_retainage_usd": round(over * (1 - ret)) if over is not None else None,
            "payment_risk_usd": round(over * (1 - ret) * PNR_DEFAULT) if over is not None else None,
            "method": f"billed {billed:.0%} - schedule-earned {earned:.1%} (duration-weighted pct_complete of {', '.join(ids)} at {T.sched_label()} data date) "
                      f"x SV ${sv:,} = ${over:,} ahead; x (1-{ret:.0%} retainage) x P(non-recovery) {PNR_DEFAULT}"}

def manpower_shortfall(T, p, refs):
    aid = (p.get("activity_id") or next(r for r in refs if r.startswith("p6:activity:"))).split(":")[-1]
    a = _act(T, aid)
    logs = sorted([l for l in T.logs if l["type"] == "manpower_log" and l.get("activity_id_hint") == aid and l["log_date"] <= T.as_of.isoformat()], key=lambda l: l["log_date"])
    planned = a.get("planned_crew_size"); last, prev = logs[-1], (logs[-2] if len(logs) > 1 else None)
    horizon = int(p.get("horizon_wd", 5))
    lost = round(horizon * (1 - last["num_workers"] / planned)) if planned else None
    wx = [l for l in T.logs if l["type"] == "weather_log" and l["log_date"] == last["log_date"]]
    mwd = max(0, lost - a["total_float_wd"]) if lost is not None else None
    mid, tco = _tco(T); mcd = (T.cal.add_wd(tco, mwd) - tco).days if mwd else 0
    rate = T.project["delay_cost_basis"]["daily_delay_cost_usd"]
    return {"type": "manpower_shortfall", "activity": aid, "planned_crew": planned, "workers_latest": last["num_workers"], "latest_ref": last["ref"],
            "workers_prior": prev and prev["num_workers"], "prior_ref": prev and prev["ref"],
            "drop_pct": round(1 - last["num_workers"] / prev["num_workers"], 3) if prev else None, "pct_of_planned": round(last["num_workers"] / planned, 3) if planned else None,
            "weather_delay_that_day": wx[0]["weather_delay"] if wx else None, "weather_ref": wx[0]["ref"] if wx else None, "tf_wd": a["total_float_wd"],
            "horizon_wd": horizon, "lost_wd_if_persists": lost, "milestone_wd": mwd, "milestone_cd": mcd, "delay_usd": mcd * rate,
            "method": f"{horizon} wd x (1 - {last['num_workers']}/{planned}) = {lost} wd lost if the shortfall persists; TF {a['total_float_wd']} -> {T.milestone_name} +{mcd} cd x ${rate:,}"}

FN = {"delay_chain": delay_chain, "usd_sum": usd_sum, "contingency": contingency, "notice_window": notice_window,
      "ros_margin": ros_margin, "payapp_earned": payapp_earned, "manpower_shortfall": manpower_shortfall}

def compute_impact(T, type, params, inputs_refs):
    bad = [r for r in inputs_refs or [] if r not in T.index]
    if bad: return {"type": type, "error": "ref_not_found", "refs": bad}
    try:
        return FN[type](T, params or {}, inputs_refs or [])
    except Exception as e:  # deterministic failure is reported, never guessed
        return {"type": type, "error": f"{e.__class__.__name__}: {e}"}

PARAM_DOC = """compute_impact request formats (code computes; give params, never numbers you derived yourself):
- delay_chain: {"activity_ids":["A1230"], "slip_wd":10 | "slip_cd":14 + "anchor_date":"YYYY-MM-DD", "tf_as_of":"YYYY-MM-DD"(optional: project TF of UNSTARTED activities forward to this date, e.g. the decision deadline), "condition":"if X misses Y"}
- usd_sum: {"items":[{"ref":"procore:change_event:3515","field":"rom_usd"}, {"ref":"procore:commitment:3401","field":"contract_amount_usd","multiplier":0.04}], "kind":"recognized|at_risk|escalation|unpriced|payment_risk"}
- contingency: {} (reads owner contingency from today's and compare-to budget snapshots)
- ros_margin: {"submittal_ref":"procore:submittal:NNNN"}
- payapp_earned: {"requisition_ref":"procore:requisition:NNNNN", "sov_line":"<exact SOV line name>", "activity_ids":["A1450","A1490",...]}
- manpower_shortfall: {"activity_id":"A1500", "horizon_wd":5}
inputs_refs must list the records the inputs are read from (all must resolve)."""
