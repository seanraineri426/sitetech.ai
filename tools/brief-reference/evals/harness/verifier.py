"""S8 code verifier (plain code, no model). (a) insight claims: cited + resolvable refs, numbers grounded in cited records /
findings / code impacts, freshness caps, weather-blame control. (b) final brief: unresolvable or out-of-evidence citations dropped,
units left without citations dropped, <=7 top items, recomputed word count, WORSE needs delta_text, deterministic fields
overwritten from code, JSON Schema validation."""
import json, re, copy, os
import jsonschema
from .fixture_tools import INTEL

SCHEMA = json.load(open(os.path.join(INTEL, "schemas", "brief.schema.json")))
REF_RE = re.compile(SCHEMA["$defs"]["ref"]["pattern"])
BLAME = re.compile(r"(due to|because of|caused by|owing to|attributed to)\s+(the\s+)?(rain|weather|storm|wind|snow)", re.I)
# numbers in prose. Iteration 2 fixes: a k/M suffix must be attached and not start a word ("1500 manpower" was read as 1.5e9), and
# digits glued to an identifier (A1500, PO-0117, CE-031, msg_E104) are record IDs, not quantities.
NUM = re.compile(r"(?<![A-Za-z0-9_\-/.])~?\$?\d[\d,]*\.?\d*(?:[kKmM](?![A-Za-z])|\s?%)?")
LABELS = ["Signal", "Likely", "Confirmed"]
# CTO guardrail (2026-10-06): flag risk ("response window may be running"), never legal conclusions about notices/claims/rights.
BANNED_LEGAL = re.compile(
    r"\b(?:rights?\s+(?:(?:is|are|was|were|have been|has been|now|being)\s+)?waived|waiv(?:e|es|ed|ing)\s+(?:(?:its|their|our|the|any|all)\s+)?(?:rights?|claims?)|"
    r"waiver of (?:rights?|claims?)|claims?\s+(?:(?:is|are|was|were|has been|have been)\s+)?(?:accepted|rejected|valid|invalid|denied|meritorious|barred)|"
    r"(?:valid|invalid|meritorious|legitimate)\s+claims?|time[- ]barred|(?:is|are|was|were)\s+barred|entitle(?:d|ment)|forfeit\w*|liabl\w*|liabilit\w*|"
    r"in breach|breach(?:ed|es)?\s+(?:of\s+)?(?:the\s+)?(?:contract|subcontract)|untimely notice|defective notice|"
    r"notices?\s+(?:is|was|are|were)\s+(?:late|untimely|defective|invalid|valid|timely|sufficient|insufficient|void))\b", re.I)

def legal_hits(text): return [m.group(0) for m in BANNED_LEGAL.finditer(text or "")]

def nums(text):
    out = []
    for m in NUM.findall(text or ""):
        s = m.replace("$", "").replace(",", "").replace("~", "").strip(); mult = 1
        if s[-1:] in "kK": mult, s = 1e3, s[:-1]
        elif s[-1:] in "mM": mult, s = 1e6, s[:-1]
        pct = s.endswith("%"); s = s.rstrip("%").strip().rstrip(".")
        try: v = float(s) * mult
        except ValueError: continue
        out.append((m.strip(), v, pct))
    return out

def pool_from(obj):
    vals = set()
    for _, v, _p in nums(json.dumps(obj)):
        vals |= {round(v, 4), round(v * 100, 4), round(v / 100, 6)}
    return vals

def grounded(v, pct, pool, approx=False):
    if approx:   # "~35%": approximate figures may round a code value by up to 5%
        cands = [v] + ([v / 100] if pct else [])
        if any(any(abs(c - p) <= abs(p) * 0.05 for p in pool if p) for c in cands): return True
    if v <= 31 and float(v).is_integer(): return True       # small ints: day counts/dates/record numbers, checked by humans (H2)
    cands = [v] + ([v / 100] if pct else [])
    return any(any(abs(c - p) <= max(1e-9, abs(p) * 0.005) or (abs(p) >= 1000 and abs(c - p) <= abs(p) * 0.02) for p in pool) for c in cands)

def cap(label, maxlabel):
    if label not in LABELS: return maxlabel
    return LABELS[min(LABELS.index(label), LABELS.index(maxlabel))]

def schedule_band(freshness):
    return next((f["band"] for f in freshness if f["source"] == "schedule"), "fresh")

def weather_delay_any(T):
    return any(l.get("weather_delay") for l in T.logs if l["type"] == "weather_log")

DELIVERY_DELAY_CLAIM = re.compile(r"\b(delivery\s+(?:is\s+|has\s+been\s+)?delay\w*|delayed\s+delivery|shipment\s+delay\w*)\b", re.I)

RFI_OVERDUE_IN_CLAIM = re.compile(
    r"\bRFI\s*#?\s*(\d+)\b[\s\S]{0,60}?\b(?:overdue|unanswered|still\s+open|past\s+due)\b|"
    r"\b(?:overdue|unanswered|still\s+open|past\s+due)\b[\s\S]{0,60}?\bRFI\s*#?\s*(\d+)\b", re.I)

def rfi_overdue_claim_contradicted(T, text, refs):
    """False-alarm rule 10: claim says RFI overdue/open but Procore shows answered/closed → contradicted."""
    nums = set()
    for m in RFI_OVERDUE_IN_CLAIM.finditer(text or ""):
        nums.add(m.group(1) or m.group(2))
    if not nums: return False
    want = set(refs or [])
    for ref, (typ, r) in T.index.items():
        if typ != "rfi": continue
        m = re.search(r"#\s*(\d+)", str(r.get("label") or ""))
        if not m or m.group(1) not in nums: continue
        # Prefer cited RFI; also accept any matching closed/answered RFI (Procore wins)
        st = str(r.get("status") or "").lower()
        closed = st in ("closed", "resolved", "answered") or bool(r.get("time_resolved")) or bool(r.get("answers"))
        if closed and (ref in want or True):
            return True
    return False


def delivery_received_any(T, refs):
    """A cited/linked delivery_log OR a later email/Procore confirmation shows the order received/on-site."""
    want = set(refs or [])
    for d in T.logs:
        if d.get("type") != "delivery_log": continue
        st = str(d.get("status") or d.get("delivery_status") or "").lower()
        if st not in ("received", "complete", "completed", "delivered", "received_complete", "received complete"): continue
        if d["ref"] in want: return True
        for l in T.links():
            if d["ref"] in (l["a"], l["b"]) and (l["a"] in want or l["b"] in want): return True
    # Email-confirmed path: any cited delay email whose thread/PO has a later received/on-site confirmation.
    try:
        from .stages.rank import delivery_complete_for
    except Exception:
        delivery_complete_for = None
    if delivery_complete_for:
        for r in want:
            if r in T.index and T.index[r][0] == "email" and delivery_complete_for(T, r):
                return True
            # confirmation email itself cited next to a delay claim
            if r in T.index and T.index[r][0] == "email":
                rec = T.index[r][1]
                from .stages.rank import MATERIAL_RECEIVED_RE
                if MATERIAL_RECEIVED_RE.search((rec.get("subject") or "") + " " + (rec.get("body_text") or "")):
                    return True
    return False

def verify_insights(insights, T, impacts, freshness, extra_findings=None):
    band = schedule_band(freshness); wx = weather_delay_any(T)
    verdicts, kept = [], []
    for ins in insights:
        iid = ins.get("insight_id"); claims_out = []
        imp = impacts.get(iid, [])
        for k, cl in enumerate(ins.get("narrative_claims") or []):
            cid = f"{iid}.c{k + 1}"; reasons = []
            refs = [c.get("ref") for c in cl.get("citations") or [] if isinstance(c, dict)]
            if not refs: reasons.append("uncited")
            bad = [r for r in refs if not isinstance(r, str) or not REF_RE.match(r) or not T.resolvable(r)]
            good = [r for r in refs if r not in bad]
            if bad: reasons.append("ref_not_found")
            text = cl.get("text", "")
            if BLAME.search(text) and not wx: reasons.append("contradicted_by_record")
            if DELIVERY_DELAY_CLAIM.search(text) and delivery_received_any(T, good): reasons.append("contradicted_by_record")
            if rfi_overdue_claim_contradicted(T, text, good): reasons.append("contradicted_by_record")
            if legal_hits(text): reasons.append("legal_conclusion")
            status = "pass"
            if not good or "contradicted_by_record" in reasons or "legal_conclusion" in reasons: status = "dropped"
            else:
                ev = [T.index[r][1] for r in good] + [f for f in T.t_list_findings() + (extra_findings or []) if set(good) & {c["ref"] for c in f["citations"]}] + imp
                pool = pool_from(ev)
                miss = [s for s, v, p in nums(text) if not grounded(v, p, pool, s.startswith("~"))]
                if miss: reasons.append("value_mismatch"); status = "downgraded"; cl["_ungrounded_numbers"] = miss
                if bad and status == "pass": status = "downgraded"
            label = cl.get("label") or ins.get("score_basis", {}).get("impact_label") or "Likely"
            sched_only = good and all(r.startswith("p6:") for r in good)
            if sched_only and band == "aging": label = cap(label, "Likely")
            if sched_only and band in ("stale", "missing"): label = cap(label, "Signal")
            if status == "downgraded": label = cap(label, "Signal" if "value_mismatch" in reasons else "Likely")
            verdicts.append({"claim_id": cid, "insight_id": iid, "status": status, "reasons": reasons, "bad_refs": bad,
                             "final_label": "suppressed" if status == "dropped" else label, "text": text})
            if status != "dropped":
                c2 = dict(cl); c2["citations"] = [c for c in cl["citations"] if isinstance(c, dict) and c.get("ref") in good]
                c2["claim_id"] = cid; c2["final_label"] = label; c2["verifier_status"] = status; claims_out.append(c2)
        if claims_out:
            k2 = dict(ins); k2["narrative_claims"] = claims_out; k2["computed_impacts"] = imp
            # schedule-derived impact label capped by freshness (ARCHITECTURE 12.2)
            sb = dict(k2.get("score_basis") or {}); 
            if band == "aging" and any(i.get("type") in ("delay_chain", "manpower_shortfall") for i in imp):
                sb["schedule_impact_label_cap"] = "Likely"
            k2["score_basis"] = sb; kept.append(k2)
        else:
            verdicts.append({"insight_id": iid, "status": "insight_dropped", "reasons": ["no_passing_claims"]})
    summ = {"claims_total": sum(1 for v in verdicts if "claim_id" in v), "passed": sum(1 for v in verdicts if v.get("status") == "pass"),
            "downgraded": sum(1 for v in verdicts if v.get("status") == "downgraded"), "dropped": sum(1 for v in verdicts if v.get("status") == "dropped"),
            "insights_in": len(insights), "insights_kept": len(kept)}
    return kept, verdicts, summ

def walk_refs(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == "ref" and isinstance(v, str): yield v
            else: yield from walk_refs(v)
    elif isinstance(o, list):
        for v in o: yield from walk_refs(v)

def word_count_main(b):
    parts = list(b["status"].get("lines", [])) + [t.get("headline", "") + " " + t.get("body", "") + " " + t.get("action", {}).get("text", "") for t in b["top_items"]]
    return sum(len(p.split()) for p in parts)

def verify_brief(raw, T, allowed_refs, deterministic, record_rows):
    """raw: writer JSON (status/top_items/sections/watching/gaps). allowed_refs: refs carried by verified claims + verified section
    materials. deterministic: code-owned top-level fields. Returns (brief, report)."""
    rep = {"flags": [], "invented_refs_before": sorted({r for r in walk_refs(raw) if not T.resolvable(r)}),
           "malformed_refs_before": sorted({r for r in walk_refs(raw) if not REF_RE.match(r)})}
    b = {k: copy.deepcopy(raw.get(k)) for k in ("status", "top_items", "sections", "watching", "gaps")}
    b["top_items"] = b["top_items"] or []; b["sections"] = b["sections"] or {}; b["watching"] = b["watching"] or []; b["gaps"] = b["gaps"] or []

    def clean_cites(cs, where, strict=True):
        out = []
        for c in cs or []:
            r = c.get("ref") if isinstance(c, dict) else None
            if not r or not REF_RE.match(r) or not T.resolvable(r): rep["flags"].append({"where": where, "drop_citation": r, "reason": "ref_not_found"}); continue
            if strict and r not in allowed_refs: rep["flags"].append({"where": where, "drop_citation": r, "reason": "not_in_verified_claims"}); continue
            out.append({k: v for k, v in c.items() if k in ("ref", "label", "fields", "as_of", "url", "quote")} | {"label": c.get("label") or r})
        return out

    # top items
    tops = sorted([t for t in b["top_items"] if isinstance(t, dict)], key=lambda t: t.get("rank", 99))
    kept = []
    for t in tops:
        t["citations"] = clean_cites(t.get("citations"), f'top {t.get("item_id")}')
        if not t["citations"]: rep["flags"].append({"where": t.get("item_id"), "drop_item": "no resolvable verified citation"}); continue
        txt = " ".join([t.get("headline", ""), t.get("body", ""), t.get("delta_text", ""), (t.get("action") or {}).get("text", "")])
        if BLAME.search(txt) and not weather_delay_any(T):
            rep["flags"].append({"where": t.get("item_id"), "drop_item": "weather blamed; weather log shows no delay"}); continue
        if t.get("tag") == "WORSE" and not t.get("delta_text"):
            t["tag"] = "UNCHANGED"; rep["flags"].append({"where": t.get("item_id"), "fix": "WORSE without delta_text -> UNCHANGED"})
        kept.append(t)
    if len(kept) > 7: rep["flags"].append({"fix": f"truncated top items {len(kept)} -> 7"}); kept = kept[:7]
    remap = {}
    for i, t in enumerate(kept, 1):
        remap[t.get("item_id")] = f"T{i}"; t["rank"] = i; t["item_id"] = f"T{i}"
    b["top_items"] = kept
    live = set(remap.values())

    sec = b["sections"]
    for key in SCHEMA["properties"]["sections"]["required"]: sec.setdefault(key, [])
    for key in list(sec):
        if key not in SCHEMA["properties"]["sections"]["properties"]: rep["flags"].append({"fix": f"removed unknown section {key}"}); sec.pop(key)
    for key in ("schedule_risks", "cost_risks", "procurement_issues"):
        out = []
        for e in sec[key]:
            if e.get("item_id"):
                if e["item_id"] not in remap: continue
                e["item_id"] = remap[e["item_id"]]
            e["citations"] = clean_cites(e.get("citations"), f"{key}:{e.get('headline', '')[:30]}")
            if e["citations"]: out.append(e)
            else: rep["flags"].append({"where": key, "drop_entry": e.get("headline", "")[:60]})
        sec[key] = out
    # record rows: numbers come from findings (code), never from the writer
    for key in ("overdue_rfis", "overdue_submittals"):
        canon = {r["ref"]: r for r in record_rows[key]}; out = []
        for e in sec[key]:
            r = e.get("ref")
            if r not in canon: rep["flags"].append({"where": key, "drop_row": r, "reason": "not an open overdue finding"}); continue
            row = dict(canon[r])
            if e.get("linked_item_id") in remap: row["linked_item_id"] = remap[e["linked_item_id"]]
            elif e.get("priority_note"): row["priority_note"] = e["priority_note"]
            for k in ("days_overdue", "governing_date"):
                if e.get(k) is not None and e.get(k) != row[k]: rep["flags"].append({"where": r, "fix": f"{k} {e.get(k)} -> {row[k]} (from finding)"})
            out.append(row)
        missing = [r for r in canon if r not in {x["ref"] for x in out}]
        for r in missing: out.append(dict(canon[r])); rep["flags"].append({"where": key, "added_row_from_findings": r})
        sec[key] = out
    for key in ("new_decisions", "unresolved_decisions"):
        out = []
        for d in sec[key]:
            d["citations"] = clean_cites(d.get("citations"), key)
            if d.get("linked_item_id") and d["linked_item_id"] not in remap: d.pop("linked_item_id")
            elif d.get("linked_item_id"): d["linked_item_id"] = remap[d["linked_item_id"]]
            if d["citations"]: out.append(d)
            else: rep["flags"].append({"where": key, "drop_decision": d.get("summary", "")[:60]})
        sec[key] = out
    out = []
    for e in sec["significant_emails"]:
        r = e.get("ref")
        if not r or not T.resolvable(r) or not r.startswith("msgraph_outlook:message:") or r not in allowed_refs:
            rep["flags"].append({"where": "significant_emails", "drop_row": r}); continue
        rec = T.index[r][1]   # sender/time/subject come from the record, not the writer
        e.update({"from": rec["from"].split(" <")[0], "received_at": rec["received_at"], "subject": rec["subject"]})
        if e.get("linked_item_id") in remap: e["linked_item_id"] = remap[e["linked_item_id"]]
        else: e.pop("linked_item_id", None)
        out.append(e)
    sec["significant_emails"] = out
    for a in sec["action_items"]:
        a["unblocks"] = [remap.get(u, u) for u in a.get("unblocks", []) if not (re.match(r"^T\d+$", str(u)) and u not in remap)]
    b["watching"] = [w for w in b["watching"] if (w.update(citations=clean_cites(w.get("citations"), "watching")) or True) and w["citations"]]

    # assemble with deterministic fields
    brief = {**deterministic, "status": b["status"], "top_items": b["top_items"], "sections": sec, "watching": b["watching"],
             "gaps": [g for g in b["gaps"] if isinstance(g, dict)] + deterministic.get("gaps_extra", [])}
    brief.pop("gaps_extra", None)
    for g in brief["gaps"]:
        g.setdefault("effect", g.get("effect") or ""); g.setdefault("reason", ""); g.setdefault("source", "")
        for k in list(g):
            if k not in ("source", "reason", "effect"): g.pop(k)
    st = brief["status"]; st["items_shown"] = len(brief["top_items"])
    wc = word_count_main(brief)
    brief["metrics"]["word_count_main"] = wc
    rep["word_count_main"] = wc
    # ref-shaped strings OUTSIDE citation `ref` fields (e.g. gaps[].source, free text) must resolve too (run 20261006-192806 leaked
    # "procore:rfi:41" (real id 9041) into gaps[].source; walk_refs/score only look at `ref` keys)
    loose = re.compile(r"\b(?:procore|p6|msgraph_outlook|sitetech|weather)[:][a-z_]+[:][A-Za-z0-9_.\-]*[A-Za-z0-9_]")
    rep["unresolvable_ref_strings_in_text"] = []
    def scrub(o):
        if isinstance(o, dict): return {k: (v if k == "ref" else scrub(v)) for k, v in o.items()}
        if isinstance(o, list): return [scrub(v) for v in o]
        if isinstance(o, str):
            for m in set(loose.findall(o)):
                if not T.resolvable(m): rep["unresolvable_ref_strings_in_text"].append(m); o = o.replace(m, "[unresolved reference]")
        return o
    brief = scrub(brief)
    # banned legal-conclusion phrases: sentence removed from any brief text (verbatim record quotes are exempt: they are the sender's words)
    rep["legal_conclusions_removed"] = []
    def legal(o, path=""):
        if isinstance(o, dict): return {k: (v if k in ("ref", "quote") else legal(v, path + "/" + k)) for k, v in o.items()}
        if isinstance(o, list): return [legal(v, f"{path}/{n}") for n, v in enumerate(o)]
        if isinstance(o, str) and legal_hits(o):
            keep = [x for x in re.split(r"(?<=[.;!?])\s+", o) if not legal_hits(x)]
            rep["legal_conclusions_removed"].append({"where": path, "phrases": legal_hits(o), "text": o[:160]})
            return " ".join(keep).strip() or "[removed: legal conclusion]"
        return o
    brief = legal(brief)
    if rep["legal_conclusions_removed"]: rep["flags"].append({"fix": f'{len(rep["legal_conclusions_removed"])} legal-conclusion sentence(s) removed'})
    rep["invented_refs_after"] = sorted({r for r in walk_refs(brief) if not T.resolvable(r)})
    errs = sorted(jsonschema.Draft202012Validator(SCHEMA, format_checker=jsonschema.FormatChecker()).iter_errors(brief), key=lambda e: list(e.path))
    rep["schema_errors"] = [f'{"/".join(map(str, e.path))}: {e.message[:200]}' for e in errs]
    return brief, rep
