"""Code-generated candidates (one per deterministic finding) + issue clusters for the per-cluster model step + default S7 impacts.
Clustering: union-find over findings that share a record (hub records such as budget snapshots, schedule updates, contract documents
and the key milestone are excluded), or whose records are joined by a deterministic L1/L2 link (spec section, scheduled_task crosswalk,
log->activity hint, record-number mentions in CE/commitment/log text). Emails and meeting minutes never bridge clusters (one email can
mention many records); they are attached to every cluster they link to as context."""
import json, re
from .rules_engine import HUB_TYPES
from .impact import compute_impact

BRIDGE_LINKS = {"same_spec", "submittal_activity", "spec_activity", "log_activity", "mentions_record", "explicit_ref"}

def _type(T, ref): return T.index.get(ref, (None,))[0]

def _bridgeable(T, ref, milestones):
    t = _type(T, ref)
    return t and t not in HUB_TYPES and t not in ("email", "meeting_item") and not any(ref.endswith(":" + m) for m in milestones)

PORTFOLIO_RULES = {"COST-CONTINGENCY-BURN"}   # project-wide roll-ups citing many records; clustering them would merge unrelated issues

def clusters(T, findings, max_size=9):
    milestones = [m["activity_id"] for m in T.project.get("key_milestones", [])]
    links = [l for l in T.links() if l["type"] in BRIDGE_LINKS]
    adj = {}
    for l in links:
        if _bridgeable(T, l["a"], milestones) and _bridgeable(T, l["b"], milestones) and _type(T, l["a"]) not in ("email", "meeting_item"):
            adj.setdefault(l["a"], set()).add(l["b"]); adj.setdefault(l["b"], set()).add(l["a"])
    keys = {}
    for f in findings:
        own = {c["ref"] for c in f["citations"]}
        k = {r for r in own if _bridgeable(T, r, milestones) or _type(T, r) in ("email", "meeting_item")}
        if own and all(_type(T, r) == "email" for r in own):   # email-born finding (e.g. notice language): bridge via that email's record mentions
            k |= {(l["b"] if l["a"] in own else l["a"]) for l in links if (l["a"] in own or l["b"] in own) and l["type"] in ("mentions_record", "explicit_ref")}
        for r in list(k):
            if _bridgeable(T, r, milestones): k |= adj.get(r, set())
        if f["rule_id"] in PORTFOLIO_RULES: k = set()   # portfolio-level roll-up: its driver records are context, not bridges
        keys[f["finding_id"]] = k
    parent = {f["finding_id"]: f["finding_id"] for f in findings}
    def find(x):
        while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
        return x
    ids = [f["finding_id"] for f in findings]
    # schedule-logic chain: float findings on a predecessor and its successor are the same mechanism (only between schedule findings,
    # so the whole activity network does not collapse into one cluster)
    F = {f["finding_id"]: f for f in findings}
    def act_of(f): return next((c["ref"] for c in f["citations"] if c["ref"].startswith("p6:activity:")), None)
    SCH_CHAIN = ("SCH-FLOAT-EROSION", "SCH-UNSTARTED-ERODING", "SCH-NEG-FLOAT")
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            if keys[a] & keys[b]: parent[find(a)] = find(b); continue
            fa, fb = F[a], F[b]
            if fa["rule_id"] in SCH_CHAIN and fb["rule_id"] in SCH_CHAIN:
                ra, rb = act_of(fa), act_of(fb)
                pa = [str(p).split(":")[-1] for p in (T.index[ra][1].get("predecessors") or [])] if ra else []
                pb = [str(p).split(":")[-1] for p in (T.index[rb][1].get("predecessors") or [])] if rb else []
                if ra and rb and (ra.split(":")[-1] in pb or rb.split(":")[-1] in pa): parent[find(a)] = find(b)
    groups = {}
    for i in ids: groups.setdefault(find(i), []).append(i)
    out = []
    for g in groups.values():
        # oversized clusters are split by finding family so one model call stays small (keeps output well under max_tokens)
        if len(g) <= max_size: out.append(g); continue
        fam = {}
        for i in g: fam.setdefault(i.split("|")[0].split("-")[0], []).append(i)
        for v in fam.values():
            for k in range(0, len(v), max_size): out.append(v[k:k + max_size])
    out.sort(key=lambda g: g[0])
    return [{"cluster_id": f"C{n + 1:02d}", "finding_ids": g, "keys": sorted(set().union(*(keys[i] for i in g)))} for n, g in enumerate(out)]

def context_refs(T, cluster, extra_links=()):
    """Records the cluster model may read and cite: all finding refs + one-hop deterministic links + linked emails/meeting items."""
    refs = set(cluster["keys"])
    for l in list(T.links()) + list(extra_links):
        if l["a"] in refs or l["b"] in refs:
            for r in (l["a"], l["b"]):
                if _type(T, r) in ("email", "meeting_item", "change_event", "drawing_revision", "commitment", "requisition", "rfi", "submittal", "activity") or ":log" in r or "_log:" in r:
                    refs.add(r)
    return sorted(r for r in refs if r in T.index)


def submittal_schedule_context(T, sref):
    """Return (sub, acts, margin_days, long_lead) for a submittal ref. Margin = latest_return - as_of (calendar days)."""
    if not sref or sref not in T.index: return None, [], None, False
    sub = T.index[sref][1]
    from .rules_engine import DayView
    import datetime as _dt
    from .calendar_util import d_ as _d
    V = DayView(T, T.as_of); acts = []
    st = sub.get("scheduled_task")
    if st:
        aid = st.split("|")[-1] if "|" in str(st) else str(st)
        if aid in V.acts: acts = [V.acts[aid]]
    if not acts and sub.get("spec_section"):
        acts = [a for a in V.acts.values() if sub["spec_section"] in (a.get("spec_sections") or []) and not a.get("actual_finish")]
    margin = None
    if sub.get("required_on_site_date") is not None and sub.get("lead_time") is not None:
        latest = _d(sub["required_on_site_date"]) - _dt.timedelta(days=int(sub["lead_time"]) + int(sub.get("buffer_time") or 0))
        margin = (latest - T.as_of).days
    lead = int(sub.get("lead_time") or 0)
    return sub, acts, margin, lead >= 21


def far_float_overdue_reason(T, f):
    """False-alarm rule 9: overdue submittal whose activity is far out and float is large → drop/rank-low with reason.
    Prefer zero traps: long-lead with thin ROS / near-critical TF still surfaces (not far-float)."""
    if f.get("rule_id") not in ("SUB-REVIEW-OVERDUE", "SUB-SUBMIT-BY-MISSED"): return None
    sref = next((c["ref"] for c in f.get("citations") or [] if ":submittal:" in c["ref"]), None)
    sub, acts, margin, long_lead = submittal_schedule_context(T, sref)
    if sub is None: return None
    min_tf = min((a["total_float_wd"] for a in acts), default=None)
    # Near-term / material exposure paths that must NOT demote:
    if min_tf is not None and min_tf <= 20: return None
    if margin is not None and margin <= 10: return None
    if long_lead and margin is not None and margin <= 21: return None
    # Far: no mapped activity with large ROS, or mapped activity with large TF + comfortable ROS/no ROS.
    far_ros = margin is None or margin > 21
    far_act = min_tf is None or min_tf > 20
    if far_ros and far_act:
        bits = []
        if min_tf is None: bits.append("no near-term mapped activity")
        else: bits.append(f"activity TF {min_tf} wd")
        if margin is None: bits.append("ROS/lead unknown or far")
        else: bits.append(f"ROS margin {margin}d")
        return "far-float overdue submittal: " + "; ".join(bits) + " — drop or rank-low"
    return None

def default_impacts(T, f):
    """Deterministic S7 impacts implied by the finding alone (no model input). Scenario parameters are derived from record fields
    and documented in `method`; models may add impacts with quoted, verified basis."""
    ev = f.get("evidence") or {}; R = lambda t, p, refs: dict(compute_impact(T, t, p, refs), source="code_default", finding_id=f["finding_id"])
    out = []
    if f["rule_id"] == "PROC-QUOTE-EXPIRY" and ev.get("activity_ids"):
        if ev.get("post_expiry_lead_weeks") and ev.get("lead_time_weeks") and ev["post_expiry_lead_weeks"] > ev["lead_time_weeks"]:
            slip = (ev["post_expiry_lead_weeks"] - ev["lead_time_weeks"]) * 5
            out.append(R("delay_chain", {"activity_ids": ev["activity_ids"], "slip_wd": slip, "tf_as_of": ev["price_valid_through"],
                                         "condition": f"if not released by quote expiry {ev['price_valid_through']}: lead time {ev['lead_time_weeks']} -> {ev['post_expiry_lead_weeks']} weeks"},
                         [c["ref"] for c in f["citations"]]))
        if ev.get("escalation_pct"):
            cm = next(c["ref"] for c in f["citations"] if ":commitment:" in c["ref"])
            out.append(R("usd_sum", {"items": [{"ref": cm, "field": "contract_amount_usd", "multiplier": ev["escalation_pct"] / 100}], "kind": "escalation"}, [cm]))
    elif f["rule_id"] in ("SCH-MANPOWER-ACUTE", "SCH-MANPOWER-SUSTAINED"):
        a = next(c["ref"] for c in f["citations"] if c["ref"].startswith("p6:activity:"))
        out.append(R("manpower_shortfall", {"activity_id": a.split(":")[-1], "horizon_wd": 5}, [a]))
    elif f["rule_id"] == "SCH-EMAIL-DATE-SLIP" and ev.get("slip_cd") and ev.get("activity_ids"):
        out.append(R("delay_chain", {"activity_ids": ev["activity_ids"][:3], "slip_cd": int(ev["slip_cd"]),
                                     "anchor_date": ev.get("from_date"), "condition": f"if email-stated date {ev.get('to_date')} stands"},
                     [c["ref"] for c in f["citations"]]))
    elif f["rule_id"] == "RFI-CLOSED-IMPACT-NO-CE" and ev.get("amount_usd"):
        out.append({"type": "usd_sum", "kind": "at_risk", "total_usd": float(ev["amount_usd"]), "source": "code_default",
                    "finding_id": f["finding_id"], "own_line": True,
                    "method": f"RFI cost impact ${float(ev['amount_usd']):,.0f} stated on the closed RFI; no CE on file"})
    elif f["rule_id"] == "COST-OWNER-DIRECTIVE-NO-CE" and ev.get("amount_usd"):
        out.append({"type": "usd_sum", "kind": "at_risk", "total_usd": float(ev["amount_usd"]), "source": "code_default",
                    "finding_id": f["finding_id"], "own_line": True,
                    "method": f"owner email directive ${ev['amount_usd']:,.0f}; no CE on file"})
    elif f["rule_id"] == "COST-CONTINGENCY-BURN":
        out.append(R("contingency", {}, [f["citations"][0]["ref"]]))
        if ev.get("pending_delta_usd"):
            out.append({"type": "usd_sum", "kind": "recognized", "total_usd": ev["pending_delta_usd"], "source": "code_default", "finding_id": f["finding_id"],
                        "method": f"pending PCOs rose ${ev['pending_delta_usd']:,} since compare-to (recognized; counted once, here)"})
    elif f["rule_id"] == "COST-PAYAPP-AHEAD":
        rq = next(c["ref"] for c in f["citations"] if ":requisition:" in c["ref"])
        x = R("payapp_earned", {"requisition_ref": rq, "sov_line": ev["sov_line"], "activity_ids": ev["activity_ids"]}, [rq])
        out.append(x)
        if x.get("payment_risk_usd") is not None:
            out.append({"type": "usd_sum", "kind": "payment_risk", "total_usd": x["payment_risk_usd"], "source": "code_default", "finding_id": f["finding_id"], "method": x["method"]})
    elif f["rule_id"] in NOTICE_RULES:
        # CTO guardrails: the window comes ONLY from configured notice periods (notices.py); no defaults; null deadline when unknown.
        em = next((c["ref"] for c in f["citations"] if _type(T, c["ref"]) == "email"), None)
        if em: out.append(R("notice_window", {"notice_ref": em, "notice_types": ev.get("notice_types")}, [em]))
    elif f["rule_id"] == "COST-DIFFERING-SITE-CONDITION":
        from .notices import for_site_condition
        out.append(dict(for_site_condition(T, ev.get("event_date"), [c["ref"] for c in f["citations"]]), source="code_default", finding_id=f["finding_id"]))
    elif f["rule_id"] == "SUB-RR-NOT-RESUBMITTED" and ev.get("activity_id"):
        # $ = possible slip to linked near-term activity × daily delay cost (no budget-line math)
        slip = 5 if (ev.get("tf_wd") is not None and ev["tf_wd"] <= 10) else 0
        if slip:
            out.append(R("delay_chain", {"activity_ids": [ev["activity_id"]], "slip_wd": slip,
                                         "condition": f"R&R not resubmitted; {ev['activity_id']} starts {ev.get('early_start')}"},
                         [c["ref"] for c in f["citations"][:4]]))
    elif f["rule_id"] == "SUB-REVIEW-OVERDUE":
        # sits with reviewer past the review period; $ exposure when an activity float (or ROS margin) is known.
        # Far-float (rule 9) gets no $ — prefer zero false alarms; long-lead / tight ROS / near-critical TF still surface.
        sref = next((c["ref"] for c in f["citations"] if ":submittal:" in c["ref"]), None)
        sub, acts, margin, long_lead = submittal_schedule_context(T, sref)
        days_od = int(f.get("days_overdue") or 0)
        if far_float_overdue_reason(T, f):
            pass  # no delay_chain $ on far-float cosmetics
        elif sub and acts and days_od > 0:
            a0 = min(acts, key=lambda a: a["total_float_wd"])
            gate = (a0["total_float_wd"] <= 20
                    or (margin is not None and margin <= 10)
                    or (long_lead and margin is not None and margin <= 21))
            if gate:
                if margin is None or margin <= 5: slip = days_od
                else: slip = max(days_od if (long_lead and margin <= 14) else 0, days_od - max(margin, 0))
                if slip <= 0 and days_od > 0 and (a0["total_float_wd"] <= 10 or (margin is not None and margin <= 7)):
                    slip = days_od
                if slip > 0:
                    out.append(R("delay_chain", {"activity_ids": [a0["activity_id"]], "slip_wd": int(slip),
                                                 "condition": f"reviewer overdue {days_od}d; ROS margin {margin}d"
                                                              + ("; long-lead" if long_lead else "")},
                                 [sref, a0["ref"]]))
    # No code default for hypothetical repeat cycles (e.g. SUB-REV-LOOP "one more R&R"): the record does not state the slip, so any
    # schedule exposure for those must come from a model scenario whose size is derivable from a quoted source (see stages/rank.py).
    if f["rule_id"] not in PORTFOLIO_RULES and not any(x.get("type") == "usd_sum" for x in out):
        cited = {c["ref"] for c in f["citations"]}
        ces = [r for r in cited if _type(T, r) == "change_event"]
        ces += [c["ref"] for c in T.ces_today() if c["ref"] not in ces and set((c.get("linked_rfis") or []) + (c.get("linked_daily_logs") or [])) & cited]
        items = [{"ref": r, "field": "rom_usd"} for r in dict.fromkeys(ces) if T.index[r][1].get("rom_usd") and T.index[r][1].get("status") not in ("approved", "void")]
        if items:
            x = R("usd_sum", {"items": items, "kind": "at_risk"}, [i["ref"] for i in items])
            x["own_line"] = True; x["dedupe_note"] = "linked CE ROM shown on this item; portfolio totals (contingency) count it once"
            out.append(x)
    return [x for x in out if not x.get("error")]

NOTICE_RULES = {"EMAIL-NOTICE-LANGUAGE", "EMAIL-FORMAL-NOTICE"}

def _d(s):
    from .calendar_util import d_
    return d_(s)
