"""Contractual notice windows: CODE ONLY (CTO guardrails 2026-10-06).
- Periods come ONLY from the project's configured notice periods (fixture: project.json `notice_periods`, mirroring the planned
  `project_notice_periods` table: contract owner-GC | GC-sub (+ sub_name), notice_type delay | cost_or_change_claim |
  differing_site_condition | other, days, day_basis calendar|business, contract_section, entered_by/at; extension `trigger`
  event | notice_received). There is NO default number of days anywhere: no matching row -> deadline None + "deadline unknown, check
  the contract".
- The model may only classify an email as a formal notice (and cite it); it never supplies a deadline.
- Notice timestamps are converted to the project time zone before counting; business days use the project holiday list.
- A notice that reached the mailbox via forward/BCC fallback (record `source_flag`, or a forwarded subject) gets "verify notice date"
  instead of a firm deadline.
- Wording flags risk only ("response window may be running"); no legal conclusions (see verifier BANNED_LEGAL)."""
import datetime as dt, re

# Period-row names in project_notice_periods (fixtures / planned DB).
NOTICE_TYPES = ("delay", "cost_or_change_claim", "differing_site_condition", "other", "cure_default")
# Product-facing notice types (PM clarifications 2026-10-06). Map to period rows via PERIOD_TYPE.
PRODUCT_NOTICE_TYPES = ("delay_time_extension", "cost_change_claim", "cure_default", "differing_site_condition", "other")
PERIOD_TYPE = {
    "delay_time_extension": "delay",
    "delay": "delay",
    "cost_change_claim": "cost_or_change_claim",
    "cost_or_change_claim": "cost_or_change_claim",
    "cure_default": "cure_default",
    "differing_site_condition": "differing_site_condition",
    "other": "other",
}
# Deterministic single-type map (PM): first-match order is not used — collect hits; 0 or >1 → other + deadline unknown.
TYPE_RE = [
    ("cure_default", re.compile(
        r"\b(?:stop\s+work(?:\s+order|\s+notice)?|cure\s+notice|notice\s+to\s+cure|"
        r"notice\s+of\s+default|declaration\s+of\s+default|in\s+default\s+under|"
        r"suspend\s+performance\s+unless|suspend(?:ing|ed)?\s+performance)\b", re.I)),
    ("delay_time_extension", re.compile(
        r"\b(?:delay|time\s+extension|extension\s+of\s+time|liquidated\s+damages?|\bLD\b|"
        r"article\s+\d+[^.]{0,40}(?:delay|time)|(?:delay|time)\s+(?:under\s+)?article)\b", re.I)),
    ("cost_change_claim", re.compile(
        r"\b(?:cost\s+claim|additional\s+compensation|claim\s+for\s+(?:extras?|costs?|additional)|"
        r"formal\s+cost\s+claim|additional\s+cost|extra\s+costs?|price\s+adjustment)\b", re.I)),
    ("differing_site_condition", re.compile(
        r"\b(?:differing\s+site|concealed\s+condition|unsuitable\s+site|unforeseen\s+(?:site|condition)|"
        r"subsurface)\b", re.I)),
]
FWD_SUBJ = re.compile(r"^\s*(fw|fwd)\s*:", re.I)

def code_types(text):
    """Deterministic product notice type(s) from wording map.
    Zero hits → `other` (deadline unknown). One or more clear hits → those types (multi-typed
    notice is OK; never invent a type that is not in the text)."""
    hits = [k for k, rx in TYPE_RE if rx.search(text or "")]
    return hits or ["other"]

def period_types_for(product_types, ambiguous_or_other=False):
    """Map product types to notice_periods.notice_type values. Sole `other` → no typed row (deadline unknown)."""
    pts = [t for t in product_types if t != "other"]
    if ambiguous_or_other or not pts:
        return []  # force deadline unknown
    out = []
    for t in pts:
        pt = PERIOD_TYPE.get(t)
        if pt and pt != "other":
            out.append(pt)
    return sorted(set(out))

def source_flag(rec):
    f = str(rec.get("source_flag") or rec.get("ingest_path") or rec.get("ingested_via") or "").lower()
    if "forward" in f or "bcc" in f: return f
    if FWD_SUBJ.match(rec.get("subject") or ""): return "forwarded_copy"
    return None

def company_of(T, rec):
    """Legacy companies row (for sub_name matching). Prefer parties.party_for_record for role."""
    from .parties import party_for_record
    p = party_for_record(T.project, rec)
    if p:
        return next((c for c in T.project.get("companies", []) if c.get("id") == p.get("company_id") or c.get("domain", "").lower() == p.get("domain")),
                    {"name": p["name"], "role": p["role"], "domain": p.get("domain")})
    m = re.search(r"@([A-Za-z0-9.\-]+)", rec.get("from") if isinstance(rec.get("from"), str) else (rec.get("from") or {}).get("email", ""))
    dom = m.group(1).lower() if m else ""
    return next((c for c in T.project.get("companies", []) if c.get("domain", "").lower() == dom), None)

def contract_side(company):
    from .parties import _role
    if not company: return "unknown"
    r = _role(company) or (company.get("role") or "").lower()
    if r == "owner" or "owner" in r or "developer" in r: return "owner"
    if r == "gc" or "general contractor" in r: return "gc"
    if r == "architect_engineer" or any(k in r for k in ("architect", "engineer", "design", "consultant", "lender", "monitor")): return "other"
    if r == "sub": return "sub"
    return "sub" if company else "unknown"

def event_from_records(T, text, upto):
    """Event date for 'event'-triggered periods: issue date of design-change instruments (drawing revisions) named in the notice."""
    t = (text or "").lower()
    dws = [d for d in T.drawings if d.get("issued_via") and d["issued_via"].lower() in t and d.get("issued_date") and d["issued_date"] <= upto]
    if not dws: return None, [], None
    d0 = min(dws, key=lambda d: d["issued_date"])
    return dt.date.fromisoformat(d0["issued_date"]), [d["ref"] for d in dws], f'{d0["issued_via"]} issue date (named in the notice)'

def _add(T, start, row):
    if row.get("day_basis") == "calendar": return start + dt.timedelta(days=int(row["days"]))
    if row.get("day_basis") == "business": return T.cal.add_wd(start, int(row["days"]))
    raise ValueError("day_basis must be calendar or business")

def windows(T, types, contract, sub_name, starts):
    """starts: {'event': (date|None, basis), 'notice_received': (date|None, basis)}. Returns (rows_out, unknown_reasons)."""
    rows = [r for r in T.project.get("notice_periods") or [] if r.get("notice_type") in types and r.get("contract") == contract
            and (contract != "GC-sub" or r.get("sub_name") in ("*", sub_name))]
    out, unknown = [], []
    if not rows: unknown.append(f"no {contract} notice period configured for {'/'.join(types)}")
    for r in rows:
        trig = r.get("trigger")
        if trig not in starts or r.get("days") in (None, "") or r.get("day_basis") not in ("calendar", "business"):
            unknown.append(f"{r.get('id')}: incomplete row (days/day_basis/trigger)"); continue
        start, basis = starts[trig]
        if not start: unknown.append(f"{r.get('id')}: {trig} date not determinable from records"); continue
        dl = _add(T, start, r)
        out.append({"row_id": r.get("id"), "contract": contract, "notice_type": r["notice_type"], "contract_section": r.get("contract_section"),
                    "doc_ref": r.get("doc_ref"), "days": r["days"], "day_basis": r["day_basis"], "trigger": trig, "start_date": start.isoformat(),
                    "start_basis": basis, "deadline": dl.isoformat(), "calendar_days_remaining": (dl - T.as_of).days,
                    "business_days_remaining": T.cal.wd_between(T.as_of, dl) if dl > T.as_of else 0})
    return out, unknown

def md(d): d = dt.date.fromisoformat(d) if isinstance(d, str) else d; return f"{d.month}/{d.day}"

def for_notice_email(T, email_ref, model_types=None):
    """Formal notice received by email -> response window(s) (owner-GC pass-through / response) and, for a sub's notice, the subcontract
    period as a fact for human review. Everything from configured rows; None deadline when unknown."""
    rec = T.index[email_ref][1]
    text = (rec.get("subject") or "") + "\n" + (rec.get("body_text") or "")
    # Code types are authoritative for period selection (PM: never wrong typed row). Model may refine only within enum.
    from .fact_rules import notice_fact
    nf = notice_fact(T, email_ref)
    code = nf[1] if (nf and nf[0]) else code_types(text)   # extracted facts (verified quote) are authoritative when present
    model_ok = [t for t in (model_types or []) if t in NOTICE_TYPES or t in PRODUCT_NOTICE_TYPES]
    # Prefer code's single type; if model agrees on the period mapping keep product label from code.
    types_product = code
    if code == ["other"] and len(model_ok) == 1 and PERIOD_TYPE.get(model_ok[0]) not in (None, "other"):
        # Model alone is not enough to pick a typed row when code says other (ambiguous / no keywords).
        types_product = ["other"]
    elif code != ["other"] and model_ok:
        # If model picks a conflicting typed class vs code → other (wrong typed deadline worse than unknown).
        code_period = {PERIOD_TYPE.get(t) for t in code}
        model_period = {PERIOD_TYPE.get(t) for t in model_ok if PERIOD_TYPE.get(t)}
        if model_period and code_period and not (model_period & code_period):
            types_product = ["other"]
    types = types_product  # product-facing labels on the result
    period_types = period_types_for(types_product)
    recv = T.local_date(rec["received_at"])
    ev, ev_refs, ev_basis = event_from_records(T, text, T.as_of.isoformat())
    starts = {"event": (ev, ev_basis), "notice_received": (recv, f"notice received {md(recv)} ({T.tz})")}
    comp = company_of(T, rec); side = contract_side(comp)
    if not period_types:
        resp, unknown = [], ["notice type other/ambiguous or no typed period row — deadline unknown"]
        sub = []
    else:
        resp, unknown = windows(T, period_types, "owner-GC", None, starts)
        sub = []
        if side == "sub":
            sub, u2 = windows(T, period_types, "GC-sub", comp["name"], starts)
            unknown += u2
    flag = source_flag(rec)
    open_resp = [w for w in resp if w["deadline"] >= T.as_of.isoformat()]
    deadline = min((w["deadline"] for w in open_resp), default=None)
    from .parties import party_for_record
    party = party_for_record(T.project, rec)
    if not party:
        # CTO: notice from an unknown party (domain not in project_parties) → deadline unknown (do not apply owner-GC periods)
        status, text_out = "deadline_unknown", "Deadline unknown, check the contract (sender is not a configured project party)."
        deadline = None; resp, unknown = [], ["sender domain not in project_parties"]
    elif flag:
        status, text_out = "verify_notice_date", f"Notice arrived via {flag.replace('_', ' ')}: verify notice date before relying on any response deadline."
        deadline = None
    elif deadline:
        w = min(open_resp, key=lambda w: w["deadline"])
        status = "computed"
        text_out = (f"Response window may be running: {w['contract_section']}, {w['days']} {w['day_basis']} days from {w['trigger'].replace('_', ' ')} "
                    f"{md(w['start_date'])} -> {md(w['deadline'])} ({w['business_days_remaining']} business days left).")
    elif resp:
        status, text_out = "window_passed_per_config", "Configured response window end date is before today; verify dates with the contract."
    else:
        status, text_out = "deadline_unknown", "Deadline unknown, check the contract (" + "; ".join(unknown)[:160] + ")."
    sub = list({(w["contract_section"], w["days"], w["day_basis"], w["start_date"]): w for w in sub}.values())
    sub_txt = "; ".join(f"Subcontract notice period ({w['contract_section']}): {w['days']} {w['day_basis']} days from {w['trigger'].replace('_', ' ')} "
                        f"{md(w['start_date'])} -> {md(w['deadline'])}; notice received {md(recv)}; timing for the project team to review" for w in sub)
    return {"type": "notice_window", "notice_ref": email_ref, "notice_types": types, "notice_received_local": recv.isoformat(), "sender_side": side,
            "sender_company": (comp or {}).get("name"), "event_date": ev and ev.isoformat(), "event_refs": ev_refs, "source_flag": flag,
            "windows": resp, "sub_windows": sub, "unknown": unknown, "status": status, "deadline": deadline,
            "method": text_out + (" " + sub_txt + "." if sub_txt else ""), "display": text_out,
            "note": "Facts only; code-computed from configured notice periods. Timing assessment belongs to the project team."}

def for_site_condition(T, event_date, refs):
    """Differing site condition: flag that owner notice MAY be required, with the configured owner-GC period if one exists."""
    ev = dt.date.fromisoformat(event_date) if event_date else None
    resp, unknown = windows(T, ["differing_site_condition"], "owner-GC", None, {"event": (ev, "first record of the condition"), "notice_received": (None, None)})
    open_resp = [w for w in resp if w["deadline"] >= T.as_of.isoformat()]
    if open_resp:
        w = min(open_resp, key=lambda w: w["deadline"])
        disp = (f"Owner notice may be required (differing site condition): {w['contract_section']}, {w['days']} {w['day_basis']} days from "
                f"{md(w['start_date'])} -> {md(w['deadline'])}.")
        dl = w["deadline"]
    else:
        disp = "Owner notice may be required (differing site condition): deadline unknown, check the contract."; dl = None
    return {"type": "notice_window", "kind": "site_condition_owner_notice_flag", "event_date": event_date, "event_refs": refs, "windows": resp,
            "unknown": unknown, "deadline": dl, "status": "computed" if dl else "deadline_unknown", "method": disp, "display": disp}
