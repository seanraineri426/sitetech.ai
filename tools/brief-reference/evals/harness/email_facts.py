"""Two-stage email / RFI handling (CTO architecture decision 2026-10-09).
  Stage 1 EXTRACTION (model, reads but does not judge): each email -> structured facts (strict JSON schema), each citing the email
  and quoting the span it came from; each RFI -> answer scope / site-condition facts. Outputs are cached on disk keyed by
  sha256(prompt + schema + model + input), so re-scoring is free and a mock/replay run reuses them.
  Stage 2 JUDGMENT (code, harness/fact_rules.py): join facts to records, compare dates with activity dates and float, $ exposure, rank.
Code verification here (no judgment): quote must be verbatim in the record (else the fact is dropped), sender_party is replaced by the
code's project_parties label (models only ever see that label, never an address), enum/type checks via the schema.
CLI (paid; only on FICTIONAL fixtures): python -m harness.email_facts --fixture <dir> [--as-of D --compare-to D] [--cap 1.0]"""
import hashlib, json, os, datetime as dt
from .contracts import O, A, S, DATE, clamp, validate
from .parties import party_for_record, label as party_label

HERE = os.path.dirname(os.path.abspath(__file__)); INTEL = os.path.dirname(os.path.dirname(HERE))
CACHE = os.path.join(os.path.dirname(HERE), "fact_cache")
PROMPT_VERSION = "facts-v1"
EMAIL_KINDS = ["schedule_date_change", "conditional_slip", "conditional_risk", "no_change", "need_by_date", "received_on_site",
               "formal_notice", "pricing_or_change_request", "inquiry_or_hypothetical", "other"]
NOTICE_TYPES = ["delay_time_extension", "cost_change_claim", "cure_default", "differing_site_condition", "other"]
NDATE = {"anyOf": [{"type": "null"}, DATE]}
NSTR = lambda n: {"anyOf": [{"type": "null"}, S(n)]}
NINT = {"anyOf": [{"type": "null"}, {"type": "integer", "minimum": -400, "maximum": 400}]}
NNUM = {"anyOf": [{"type": "null"}, {"type": "number", "minimum": 0}]}
CONF = {"enum": ["high", "medium", "low"]}
EMAIL_FACT = O({"kind": {"enum": EMAIL_KINDS}, "item": S(80), "spec_section": NSTR(20), "submittal_no": NSTR(30), "rfi_no": NSTR(12),
                "ce_no": NSTR(20), "old_date": NDATE, "new_date": NDATE, "new_date_high": NDATE, "delay_days": NINT, "delay_days_high": NINT,
                "date_phrase": NSTR(120), "date_basis": {"enum": ["explicit", "relative_to_sent", "relative_to_original", "range", "vague", "none"]},
                "amount_usd": NNUM, "notice_types": A({"enum": NOTICE_TYPES}, 3), "sender_party": S(90), "quote": S(220), "confidence": CONF})
EMAIL_FACTS = O({"emails": A(O({"ref": S(120), "facts": A(EMAIL_FACT, 6)}), 12)})
RFI_FACT = O({"ref": S(60), "scope_change": {"enum": ["adds", "none", "unclear"]}, "scope_quote": S(220), "differing_site_condition": {"type": "boolean"},
              "condition": S(80), "condition_quote": S(220), "amount_usd": NNUM, "schedule_days": NINT, "confidence": CONF})
RFI_FACTS = O({"rfis": A(RFI_FACT, 12)})
SCHEMAS = {"email": EMAIL_FACTS, "rfi": RFI_FACTS}
STAGE_CFG = {"max_tokens": 6000, "reasoning_effort": "low", "response_format": {"type": "json_object"}, "repair": True}

def _prompt(kind): return open(os.path.join(INTEL, "prompts", f"{kind}_facts_extractor.md")).read()

def email_input(T, rec):
    d = T.local_date(rec["received_at"])
    p = party_for_record(T.project, rec)
    return {"ref": rec["ref"], "sent_local_date": f"{d.isoformat()} ({d.strftime('%A')})", "from_party": party_label(p) if p else "unknown party",
            "subject": rec.get("subject") or "", "body": rec.get("body_text") or ""}

def rfi_input(T, rec):
    txt = " ".join([rec.get("question") or ""] + [a.get("text") or "" for a in rec.get("answers") or []])
    inst = [{"issued_via": d.get("issued_via"), "number": d.get("number"), "description": d.get("description")}
            for d in T.drawings if d.get("issued_via") and d["issued_via"] in txt]
    return {"ref": rec["ref"], "label": rec.get("label"), "subject": rec.get("subject"), "status": rec.get("status"), "question": rec.get("question"),
            "answers": [{"official": a.get("official"), "text": a.get("text")} for a in rec.get("answers") or []],
            "cost_impact": rec.get("cost_impact"), "cost_impact_value": rec.get("cost_impact_value"), "schedule_impact": rec.get("schedule_impact"),
            "schedule_impact_value": rec.get("schedule_impact_value"), "referenced_instruments": inst}

def _key(kind, model, inp):
    h = hashlib.sha256()
    for part in (PROMPT_VERSION, kind, model, _prompt(kind), json.dumps(SCHEMAS[kind], sort_keys=True), json.dumps(inp, sort_keys=True)):
        h.update(part.encode()); h.update(b"\0")
    return h.hexdigest()[:24]

def _cache_path(kind, key): return os.path.join(CACHE, kind, key + ".json")

MODEL_FOR_CACHE = os.environ.get("FACTS_MODEL", "openrouter:anthropic/claude-sonnet-5.5")

def _records(T):
    emails = [r for (t, r) in T.index.values() if t == "email"]
    rfis = [r for (t, r) in T.index.values() if t == "rfi"]
    return emails, rfis

def pending(T, kinds=("email", "rfi")):
    """[(kind, key, input)] for records in T with no cached facts."""
    emails, rfis = _records(T); out = []
    for kind, recs, mk in (("email", emails, email_input), ("rfi", rfis, rfi_input)):
        if kind not in kinds: continue
        for r in recs:
            inp = mk(T, r); k = _key(kind, MODEL_FOR_CACHE, inp)
            if not os.path.exists(_cache_path(kind, k)): out.append((kind, k, inp))
    return out

def extract_items(items, runner, batch=10):
    """Paid: extract facts for [(kind, key, input)] in batches (one model call per batch), caching each record's output."""
    n_calls = 0; seen = set(); items = [x for x in items if not (x[1] in seen or seen.add(x[1]))]
    for kind in ("email", "rfi"):
        todo = [x for x in items if x[0] == kind]
        for i in range(0, len(todo), batch):
            chunk = todo[i:i + batch]
            # refs must be unique inside one call (pack fixtures reuse none; Linden refs are unique)
            user = {"emails" if kind == "email" else "rfis": [c[2] for c in chunk]}
            obj, rep = runner.llm_contract(f"{kind}_facts_{i // batch:02d}", _prompt(kind), user, STAGE_CFG, SCHEMAS[kind]); n_calls += 1
            by = {r.get("ref"): r for r in obj.get("emails" if kind == "email" else "rfis") or []}
            for _, k, inp in chunk:
                row = by.get(inp["ref"])
                if row is None: continue   # not returned: stays uncached (legacy fallback for that record)
                os.makedirs(os.path.dirname(_cache_path(kind, k)), exist_ok=True)
                json.dump({"kind": kind, "ref": inp["ref"], "model": MODEL_FOR_CACHE, "prompt_version": PROMPT_VERSION, "input": inp,
                           "output": row, "contract_report": {k2: rep.get(k2) for k2 in ("errors_final", "repaired", "truncated")},
                           "extracted_at": dt.datetime.now().isoformat(timespec="seconds")}, open(_cache_path(kind, k), "w"), indent=1, ensure_ascii=False)
    return n_calls

def extract(T, runner, kinds=("email", "rfi")):
    return extract_items(pending(T, kinds), runner)

def _norm(s):
    import re
    return re.sub(r"\s+", " ", (s or "").replace("\u2019", "'").replace("\u2014", "-").replace("\u2013", "-").replace("\u00a0", " ")).strip().lower()

def _verbatim(q, *texts, min_len=4):
    q = _norm(q).strip(" .\"'")
    return len(q) >= min_len and any(q in _norm(t) for t in texts)

def verify_email_facts(T, rec, facts):
    """Code checks only (no judgment). Returns (kept, dropped)."""
    p = party_for_record(T.project, rec); lab = party_label(p) if p else "unknown party"
    text = (rec.get("subject") or "") + "\n" + (rec.get("body_text") or "")
    kept, dropped = [], []
    for f in facts or []:
        f = dict(f)
        if validate(f, EMAIL_FACT): dropped.append({"fact": f, "reason": "schema"}); continue
        if not _verbatim(f.get("quote"), text): dropped.append({"fact": f, "reason": "quote not verbatim"}); continue
        # Verify numeric/ID/spec values appear verbatim in the redacted text
        # For received_on_site facts, submittal_no is used for matching and may not be explicitly stated
        check_fields = ["amount_usd", "ce_no", "spec_section", "rfi_no"]
        if f["kind"] != "received_on_site":
            check_fields.append("submittal_no")
        for key in check_fields:
            val = f.get(key)
            if val is not None and val != "":
                # For numbers, check both raw and comma-formatted versions
                if isinstance(val, (int, float)):
                    # Try raw number and common formatted versions
                    candidates = [str(int(val)), f"{int(val):,}"]
                    # Allow shorter matches for numbers (min_len=1)
                    if not any(_verbatim(c, text, min_len=1) for c in candidates):
                        dropped.append({"fact": f, "reason": f"{key} '{val}' not verbatim"}); break
                else:
                    # For strings, allow shorter matches for IDs (min_len=1) but keep min_len=4 for spec_section
                    min_len = 4 if key == "spec_section" else 1
                    if not _verbatim(val, text, min_len=min_len):
                        dropped.append({"fact": f, "reason": f"{key} '{val}' not verbatim"}); break
        else:
            # All checks passed
            if f.get("sender_party") != lab: f["sender_party_model"] = f.get("sender_party"); f["sender_party"] = lab
            f["email_ref"] = rec["ref"]
            kept.append(f)
    return kept, dropped

def verify_rfi_facts(T, rec, f):
    f = dict(f or {})
    if not f or validate(f, RFI_FACT): return None
    txt = " ".join([rec.get("subject") or "", rec.get("question") or ""] + [a.get("text") or "" for a in rec.get("answers") or []])
    if f.get("scope_change") in ("adds", "none") and f.get("scope_quote") and not _verbatim(f["scope_quote"], txt): f["scope_change"] = "unclear"; f["_scope_quote_rejected"] = True
    if f.get("differing_site_condition") and not _verbatim(f.get("condition_quote"), txt): f["differing_site_condition"] = False; f["_condition_quote_rejected"] = True
    f["rfi_ref"] = rec["ref"]
    return f

def attach(T, runner=None):
    """Load facts for every email / RFI in T from the cache (extracting misses first when a live runner is given).
    Sets T.email_facts {email_ref: [facts]} and T.rfi_facts {rfi_ref: facts} for records WITH cached extraction only; records
    without cached facts are absent (rules then use the legacy code path for that record). Returns a summary."""
    if runner is not None: extract(T, runner)
    emails, rfis = _records(T)
    T.email_facts, T.rfi_facts, T.facts_dropped = {}, {}, []
    for r in emails:
        p = _cache_path("email", _key("email", MODEL_FOR_CACHE, email_input(T, r)))
        if os.path.exists(p):
            kept, dropped = verify_email_facts(T, r, json.load(open(p))["output"].get("facts"))
            T.email_facts[r["ref"]] = kept; T.facts_dropped += [dict(d, ref=r["ref"]) for d in dropped]
    for r in rfis:
        p = _cache_path("rfi", _key("rfi", MODEL_FOR_CACHE, rfi_input(T, r)))
        if os.path.exists(p):
            f = verify_rfi_facts(T, r, json.load(open(p))["output"])
            if f: T.rfi_facts[r["ref"]] = f
    return {"emails_with_facts": len(T.email_facts), "emails_total": len(emails), "rfis_with_facts": len(T.rfi_facts), "rfis_total": len(rfis),
            "facts_dropped": T.facts_dropped}

def facts_runner(cap_usd, label="facts"):
    """Live Runner for extraction: OpenRouter -> Amazon Bedrock only, ZDR, data_collection deny, no fallbacks, Claude pinned (config.yaml).
    Shares evals/runs/_spend_ledger.json (hard cap) and enforces its own per-invocation cap."""
    import yaml
    from .llm_runner import Runner
    cfg = yaml.safe_load(open(os.path.join(HERE, "config.yaml")))
    cfg["cost"]["run_cap_usd"] = cap_usd
    runs = os.path.join(os.path.dirname(HERE), "runs")
    d = os.path.join(runs, "_facts", dt.datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + label)
    os.makedirs(d, exist_ok=True)
    return Runner(cfg, d, runs)

if __name__ == "__main__":
    import argparse
    from .fixture_tools import FixtureTools
    ap = argparse.ArgumentParser(); ap.add_argument("--fixture", required=True); ap.add_argument("--as-of"); ap.add_argument("--compare-to")
    ap.add_argument("--cap", type=float, default=0.5); a = ap.parse_args()
    if "holdout" in os.path.abspath(a.fixture): raise SystemExit("refusing: held-out fixtures are never extracted outside a frozen held-out run")
    T = FixtureTools(a.as_of, a.compare_to, fixture_dir=a.fixture); R = facts_runner(a.cap, os.path.basename(os.path.abspath(a.fixture)))
    print(json.dumps({k: v for k, v in attach(T, R).items() if k != "facts_dropped"}), f"cost=${R.cost():.4f}")
