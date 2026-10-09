"""Code ranking (PM rule, 2026-10-06; wins over DAILY_BRIEF_SPEC §5 where they differ) + S7 validation of model-proposed scenarios.
  primary key  = schedule $ exposure = days of possible critical-path slip (milestone cd, S7 code) x project daily delay cost (project.json)
  tie-break    = earlier decision deadline (then governing date)
  then         = items with no schedule exposure, by cost exposure (escalation + at_risk + payment_risk + recognized-once, D3)
  then         = items with NO $ exposure, by severity, then deadline (iteration 3, task 2; a pending credit without a CO cannot
                 outrank a real risk unless a floor applies)
Floors (top-7 membership regardless of $): critical_path, owner_escalation, and notice_window: ANY formal contractual notice is pinned
(PM rule 1) with the code-computed response deadline (notices.py; configured periods only; null when unknown).
Kept from §5.3 (no conflict with the PM rule): floors guarantee top-7 membership (critical_path, notice_window, owner_escalation);
Signal items cannot be #1 unless > 5 days or > $100k; max 7 top items, overflow goes to sections. Probability weights (§5.1 P) are NOT
used for ordering under the PM rule; labels are still shown."""
import json, re, datetime as dt
from .calendar_util import d_
from .rules_engine import SEV

MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
LABELS = ["Signal", "Likely", "Confirmed"]

def norm(s): return re.sub(r"\s+", " ", (s or "").replace("\u2019", "'").replace("\u201c", '"').replace("\u201d", '"').replace("\u2013", "-").replace("\u2014", "-")).strip().lower()

def record_text(T, ref):
    t, r = T.index[ref]
    # For emails, only check subject + body_text (not full JSON which includes from.email)
    if t == "email":
        return norm(r.get("subject") or "") + " " + norm(r.get("body_text") or "")
    # For other record types, include full JSON
    return norm(json.dumps(r, ensure_ascii=False).replace("\\n", " ")) + " " + norm(r.get("body_text") or "") + " " + norm(r.get("text") or "")

def quote_ok(T, ref, quote):
    q = norm(quote).strip(" .\"'")
    return bool(q) and len(q) >= 8 and ref in T.index and q in record_text(T, ref)

def quoted_dates(text, year):
    out = []
    for m in re.finditer(r"\b(\d{4})-(\d{2})-(\d{2})\b", text): out.append(dt.date(int(m[1]), int(m[2]), int(m[3])))
    for m in re.finditer(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b", text):
        try: out.append(dt.date(int(m[3]) if m[3] and len(m[3]) == 4 else year, int(m[1]), int(m[2])))
        except ValueError: pass
    for m in re.finditer(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b", text, re.I):
        try: out.append(dt.date(year, MONTHS[m[1].lower()[:3]], int(m[2])))
        except ValueError: pass
    return out

def derivable_slips(T, quote):
    """(wd set, cd set) of slip sizes a reader can derive from the quote alone."""
    q = norm(quote); wd, cd = set(), set()
    for m in re.finditer(r"(\d+)\s*-?\s*(?:more\s+)?weeks?", q): w = int(m[1]); wd.add(w * 5); cd.add(w * 7)
    for m in re.finditer(r"(\d+)\s*(?:working|work|business)\s*days?", q): wd.add(int(m[1]))
    for m in re.finditer(r"(\d+)\s*(?:calendar\s*)?days?", q): cd.add(int(m[1]))
    ds = quoted_dates(quote, T.as_of.year)
    for a in ds:
        for b in ds:
            if b > a: cd.add((b - a).days); wd.add(T.cal.wd_between(a, b))
    return wd, cd, ds

def verify_request(T, q, allowed):
    """S7 gate for a model-proposed scenario. Returns (impact or None, verdict)."""
    v = {"type": q.get("type"), "basis_ref": q.get("basis_ref")}
    if q.get("basis_ref") not in allowed or not quote_ok(T, q.get("basis_ref"), q.get("basis_quote")):
        v["status"] = "rejected"; v["reason"] = "basis_quote not found verbatim in basis_ref (or ref not allowed)"; return None, v
    bad = [r for r in q.get("inputs_refs") or [] if r not in allowed or r not in T.index]
    if bad: v["status"] = "rejected"; v["reason"] = f"inputs_refs not allowed/resolvable: {bad}"; return None, v
    p = dict(q.get("params") or {})
    if q.get("type") == "notice_window":
        v["status"] = "rejected"; v["reason"] = "notice windows are computed by code from configured notice periods only (model proposals never accepted)"; return None, v
    if q["type"] == "delay_chain":
        wd, cd, ds = derivable_slips(T, q["basis_quote"])
        if p.get("slip_wd") is not None and int(p["slip_wd"]) in wd: pass
        elif p.get("slip_cd") is not None and int(p["slip_cd"]) in cd: pass
        elif p.get("slip_cd") is not None and p.get("anchor_date") and any((x - d_(p["anchor_date"])).days == int(p["slip_cd"]) for x in ds): pass
        else:
            v["status"] = "rejected"; v["reason"] = f"slip not derivable from quote (derivable wd={sorted(wd)} cd={sorted(cd)})"; return None, v
    if q["type"] == "manpower_shortfall" and int(p.get("horizon_wd", 5)) != 5:
        wd, _, _ = derivable_slips(T, q["basis_quote"])
        if int(p["horizon_wd"]) not in wd: v["status"] = "rejected"; v["reason"] = "horizon_wd not derivable from quote"; return None, v
    res = T.call("correlator", "compute_impact", {"type": q["type"], "params": p, "inputs_refs": q.get("inputs_refs") or []})
    if res.get("error"): v["status"] = "rejected"; v["reason"] = "compute_impact: " + str(res["error"])[:200]; return None, v
    res = dict(res, source="model_scenario", basis_ref=q["basis_ref"], basis_quote=q["basis_quote"]); v["status"] = "accepted"
    return res, v

def recognized_ce(T, ref):
    t, r = T.index.get(ref, (None, {}))
    if t != "change_event": return False
    b = next((x for x in T.budget if x["snapshot_date"] == T.as_of.isoformat()), None)
    listed = b and any(r.get("number", "#") in u for u in b["owner_contingency"].get("unpriced_change_events", []))
    return r.get("status") == "pending" or bool(listed and r.get("rom_usd"))

def exposures(T, ins, findings):
    rules = {findings[i]["rule_id"] for i in ins["finding_ids"] if i in findings}
    sched = [x for x in ins["impacts"] if x.get("type") in ("delay_chain", "manpower_shortfall") and x.get("delay_usd")]
    best = max(sched, key=lambda x: x["delay_usd"]) if sched else None
    cost, parts, notes, seen = 0.0, [], [], set()
    for x in ins["impacts"]:
        if x.get("type") != "usd_sum" or not x.get("total_usd"): continue
        k = x.get("kind")
        if k == "recognized" and "COST-CONTINGENCY-BURN" not in rules: notes.append("recognized $ counted once under contingency (D3)"); continue
        prefs = tuple(sorted(p.get("ref") or "" for p in x.get("parts") or []))
        if prefs and prefs in seen: continue   # same CE linked through two findings of one insight: one line
        seen.add(prefs)
        if k == "at_risk" and any(recognized_ce(T, p.get("ref")) for p in x.get("parts") or []):
            # D3 amended (PM rule 3 / task 1): the item carries its own exposure line for ranking and display; totals count it once
            notes.append("linked CE ROM also within contingency pending/unpriced: own line here, counted once in totals")
        if k in ("escalation", "at_risk", "payment_risk", "recognized"): cost += x["total_usd"]; parts.append({"kind": k, "usd": x["total_usd"], "refs": list(prefs)})
    return {"schedule_usd": best["delay_usd"] if best else 0, "milestone_cd": best.get("milestone_cd") if best else 0,
            "milestone_wd": best.get("milestone_wd") if best else 0, "schedule_basis": best and best.get("source"), "cost_usd": round(cost, 2),
            "cost_parts": parts, "dedupe_notes": notes, "rules": sorted(rules)}

NOTICE_RULES = {"EMAIL-NOTICE-LANGUAGE", "EMAIL-FORMAL-NOTICE"}

def notice_impact(ins):
    return next((x for x in ins.get("impacts", []) if x.get("type") == "notice_window" and x.get("kind") != "site_condition_owner_notice_flag"), None)

def is_notice(ins, findings):
    return any(findings[i]["rule_id"] in NOTICE_RULES for i in ins["finding_ids"] if i in findings) or bool(notice_impact(ins))

def deadline_of(T, ins, findings):
    if is_notice(ins, findings):
        # code-computed response deadline only (never a model-proposed date); None when no configured period / verify notice date
        n = notice_impact(ins)
        return {"date": n["deadline"], "kind": "notice response window (configured contract period)", "status": n["status"]} if n and n.get("deadline") else None
    dd = ins.get("decision_deadline_verified")
    if dd: return dd
    ds = [findings[i].get("decision_deadline") or findings[i].get("governing_date") for i in ins["finding_ids"] if i in findings]
    ds = sorted(d for d in ds if d and d >= T.as_of.isoformat())
    return {"date": ds[0], "kind": "finding governing date"} if ds else None

def floors(T, ins, findings, ex):
    fl = []
    if "COST-CONTINGENCY-BURN" in ex["rules"]: fl.append("owner_escalation")
    tfs = [x.get("tf_ref_wd", x.get("tf_wd")) for x in ins["impacts"] if x.get("type") in ("delay_chain", "manpower_shortfall")]
    if any(t is not None and t <= 5 for t in tfs) and (ex["milestone_cd"] or 0) >= 2: fl.append("critical_path")
    if is_notice(ins, findings): fl.append("notice_window")   # schema enum name; PM rule 1: always pinned, regardless of $ rank or window
    return fl

def rank(T, insights, findings, top_n=7):
    far = "9999-12-31"
    for ins in insights:
        ex = exposures(T, ins, findings); ins["exposure"] = ex
        ins["deadline"] = deadline_of(T, ins, findings); ins["floors"] = floors(T, ins, findings, ex)
        sev = max((SEV.index(findings[i]["severity"]) for i in ins["finding_ids"] if i in findings), default=0)
        dl = (ins["deadline"] or {}).get("date") or far
        zf = any(findings[i]["rule_id"] == "SCH-EMAIL-DATE-SLIP" for i in ins["finding_ids"] if i in findings) and any(
            x.get("type") == "delay_chain" and (x.get("delay_usd") or 0) > 0 and (x.get("tf_ref_wd") if x.get("tf_ref_wd") is not None else 99) <= 0
            for x in ins["impacts"])
        ins["zero_float_slip"] = zf
        if zf: ins["_key"] = (-1, -ex["schedule_usd"], dl, -sev)   # PM rule (2026-10-09): a zero-float email slip with $ ranks #1
        elif ex["schedule_usd"] > 0: ins["_key"] = (0, -ex["schedule_usd"], dl, -sev)
        elif ex["cost_usd"] > 0: ins["_key"] = (1, -ex["cost_usd"], dl, -sev)
        else: ins["_key"] = (2, -sev, dl, 0)
        ins["rank_basis"] = ("schedule $ = %d cd x daily delay cost" % ex["milestone_cd"]) if ex["schedule_usd"] else ("cost exposure" if ex["cost_usd"] else "no $ exposure: by severity, then due date")
    order = sorted(insights, key=lambda i: i["_key"])
    # Signal cap (§5.3)
    if len(order) > 1 and order[0].get("confidence") == "Signal" and not (order[0]["exposure"]["milestone_cd"] > 5 or max(order[0]["exposure"]["schedule_usd"], order[0]["exposure"]["cost_usd"]) > 100000):
        order[0], order[1] = order[1], order[0]
    top = order[:top_n]
    for f in [i for i in order[top_n:] if i["floors"]]:
        repl = [i for i in top if not i["floors"]]
        if not repl: break
        top.remove(repl[-1]); top.append(f)
    top.sort(key=lambda i: order.index(i))
    for n, i in enumerate(order, 1): i["order"] = n
    for i in insights: i["top_rank"] = (top.index(i) + 1) if i in top else None; i.pop("_key", None)
    return [i["key"] for i in top], [i["key"] for i in order]

def fmt_delta(delta):
    names = {"days_overdue": ("overdue", "days", 1), "projected_tf_wd": ("projected float", "wd", -1), "tf_wd": ("float", "wd", -1),
             "remaining_neg": ("remaining after pending", "$", -1), "pct_used_incl_pending": ("used incl. pending", "%", 1),
             "days_late": ("days late", "", 1), "age_days": ("age", "days", 1), "bd": ("business days since approval", "", 1),
             "overbilled_usd": ("billed ahead", "$", 1), "shortfall": ("crew shortfall", "workers", 1)}
    out = []
    for d in delta or []:
        if isinstance(d, str): out.append(d); continue
        k, a, b = d; nm, unit, sgn = names.get(k, (k, "", 1)); a, b = a * sgn, b * sgn
        if unit == "$": out.append(f"{nm} ${a:,.0f} -> ${b:,.0f}")
        elif unit == "%": out.append(f"{nm} {a:.1%} -> {b:.1%}")
        else: out.append(f"{nm} {a:g} -> {b:g} {unit}".strip())
    return "; ".join(out)

def cap(label, maxlabel):
    if label not in LABELS: return maxlabel
    return LABELS[min(LABELS.index(label), LABELS.index(maxlabel))]
