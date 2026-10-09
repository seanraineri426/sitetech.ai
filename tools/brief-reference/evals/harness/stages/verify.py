"""Stage 4 `verify` (Inngest step "verify"): layer 3, plain code, no model.
  - claim checks on every insight (refs cited, resolvable and inside the insight's evidence pack; numbers grounded in cited records /
    findings / S7 impacts; freshness caps; weather-blame control) via verifier.verify_insights
  - insights whose claims all fail are dropped; their findings fall back to a code-worded insight (coverage: nothing silently dropped)
  - re-rank in code (ranker.rank) after drops
  - section materials from the comms extraction (decisions, significant emails), numbers grounded or replaced by record text
  - coverage report: every finding -> top / section / set_aside(reason) / auto_included, high+critical must not be 'missing'
Input: read + rules + rank outputs. Output: {verified_insights, top_keys, order, verdicts, summary, materials, coverage, gaps}. Tier: T0."""
from . import Actions
from .rank import auto_insight
from ..verifier import verify_insights, nums, grounded, pool_from, schedule_band
from ..ranker import rank, cap

def to_claim_form(ins):
    allowed = set(ins.get("allowed_refs") or [])
    out = []
    for c in ins.get("claims") or []:
        refs = [r for r in c.get("refs") or []]
        out.append({"text": c.get("text", ""), "label": c.get("label"), "kind": c.get("kind"),
                    "citations": [{"ref": r} for r in refs if not allowed or r in allowed],
                    "_outside_pack": [r for r in refs if allowed and r not in allowed]})
    return dict(ins, insight_id=ins["key"], narrative_claims=out)

def ground_text(text, evidence, fallback):
    pool = pool_from(evidence)
    miss = [s for s, v, p in nums(text) if not grounded(v, p, pool, s.startswith("~"))]
    return (fallback, miss) if miss else (text, [])

def materials(T, comms, rules_out, top_by_ref):
    flags = []
    def link_for(refs):
        return next((top_by_ref[r] for r in refs if r in top_by_ref), None)
    new, unresolved, emails = [], [], []
    for e in comms.get("rows", []):
        rec = T.index[e["ref"]][1]; d = e.get("decision") or {}
        ld = T.local_date(rec["received_at"]); lbl = f"Email: {rec['from'].split(' <')[0]} {ld.month:02d}/{ld.day:02d}"
        if d.get("kind") == "made":
            s, miss = ground_text(d.get("summary") or "", [rec], rec["subject"])
            if miss: flags.append({"email": e["ref"], "decision_summary_ungrounded": miss})
            x = {"summary": s or rec["subject"], "kind": "made", "citations": [{"ref": e["ref"], "label": lbl}]}
            if e.get("quote"): x["citations"][0]["quote"] = e["quote"][:300]
            if d.get("decider"): x["owner"] = {"name": d["decider"], "role": "decider"}
            l = link_for([e["ref"]] + e.get("links", []))
            if l: x["linked_item_id"] = l
            new.append(x)
        elif d.get("kind") == "requested":
            s, miss = ground_text(d.get("summary") or "", [rec], rec["subject"])
            x = {"summary": s or rec["subject"], "kind": "pending", "citations": [{"ref": e["ref"], "label": lbl}]}
            if d.get("needed_by"): x["needed_by"] = d["needed_by"]
            if d.get("decider"): x["owner"] = {"name": d["decider"], "role": "decider"}
            l = link_for([e["ref"]] + e.get("links", []))
            if l: x["linked_item_id"] = l
            unresolved.append(x)
        if e.get("significant"):
            why, miss = ground_text(e.get("why") or "", [rec], rec["subject"])
            if miss: flags.append({"email": e["ref"], "why_ungrounded": miss})
            x = {"ref": e["ref"], "from": rec["from"].split(" <")[0], "received_at": rec["received_at"], "subject": rec["subject"],
                 "why_significant": why, "category": e.get("category") or "other", "_points": e["code_score"]["points"] + (10 if e["code_score"]["auto_include_notice"] else 0)}
            l = link_for([e["ref"]] + e.get("links", []))
            if l: x["linked_item_id"] = l
            emails.append(x)
    emails = sorted(emails, key=lambda x: -x["_points"])[:6]
    for x in emails: x.pop("_points")
    F = {f["finding_id"]: f for f in rules_out["findings"]}
    BLOCK_KINDS = {"submit_by", "latest_return", "required_on_site", "po_needed", "po_needed_by", "release_by", "early_start", "need_by", "ros",
                   "quote_expiry", "price_valid_through"}
    def blocking(dref):
        """PM rule 4: the date an open owner decision starts blocking procurement/schedule = earliest governing date of the non-decision
        findings in the same issue cluster as the decision (submit-by, latest return, PO-needed, quote expiry ...)."""
        dec = [f["finding_id"] for f in F.values() if f["rule_id"].startswith("DEC-") and any(c["ref"] == dref for c in f["citations"])]
        cl = next((c for c in rules_out["clusters"] if set(dec) & set(c["finding_ids"])), None)
        if not cl: return None
        ds = [(F[i]["governing_date"], F[i]) for i in cl["finding_ids"] if i in F and not F[i]["rule_id"].startswith("DEC-") and F[i].get("governing_date")
              and (F[i].get("governing_date_kind") in BLOCK_KINDS or F[i]["rule_id"].split("-")[0] in ("SUB", "PROC", "SCH"))]
        if not ds: return None
        d0, f0 = min(ds, key=lambda x: x[0]); md = f"{int(d0[5:7])}/{int(d0[8:10])}"
        what = f'{f0["record_label"]} {(f0.get("governing_date_kind") or "date").replace("_", "-")}'
        return f"blocking since {md} ({what})" if d0 <= T.as_of.isoformat() else f"starts blocking {md} ({what})"
    for r in rules_out["status_facts"]["decisions_open_register"]:
        ft = next((f["title"] for f in F.values() if f["rule_id"] == "DEC-NO-FOLLOW-THROUGH" and any(c["ref"] == r["decision_ref"] for c in f["citations"])), None)
        x = {"decision_ref": r["decision_ref"], "summary": r["text"], "kind": r["kind"] if r["kind"] in ("made", "pending") else "pending",
             "owner": {"name": r["owner"], "role": "decision owner"}, "needed_by": r["needed_by"], "days_late": r.get("days_late", 0),
             "carried_count": r.get("carried_count", 0), "citations": [{"ref": r["decision_ref"], "label": r["source"]}]}
        if ft: x["follow_through"] = ft
        if x["kind"] == "pending":
            b = blocking(r["decision_ref"])
            if b: x["cost_of_waiting"] = b
        l = link_for([r["decision_ref"]])
        if l: x["linked_item_id"] = l
        unresolved.append(x)
    return {"new_decisions": new, "unresolved_decisions": unresolved, "significant_emails": emails, "flags": flags}

def run(T, read_out, rules_out, rank_out):
    A = Actions("verify")
    F = {f["finding_id"]: f for f in rules_out["findings"]}; fr = read_out["freshness"]; band = schedule_band(fr)
    ins_in = [to_claim_form(i) for i in rank_out["insights"]]
    kept, verdicts, vsum = verify_insights(ins_in, T, {i["key"]: i["impacts"] for i in ins_in}, fr, extra_findings=list(F.values()))
    for i in ins_in:
        for k, c in enumerate(i["narrative_claims"]):
            if c["_outside_pack"]: verdicts.append({"claim_id": f"{i['key']}.c{k + 1}", "note": "refs outside the evidence pack removed", "refs": c["_outside_pack"]})
    A.add("resolve_refs + numeric grounding + freshness caps (code)", "T0", {"claims": vsum["claims_total"]})
    kept_keys = {k["key"] for k in kept}; fallback = []
    for i in ins_in:
        if i["key"] in kept_keys: continue
        for fid in i["finding_ids"]:
            ai = auto_insight(F[fid], i["cluster_id"], f"model insight {i['key']} dropped by verifier (no passing claim)")
            ai.update(impacts=[x for x in i["impacts"] if x.get("source") != "model_scenario"], allowed_refs=i.get("allowed_refs"), decision_deadline_verified=None)
            fallback.append(to_claim_form(ai))
    if fallback:
        k2, v2, s2 = verify_insights(fallback, T, {i["key"]: i["impacts"] for i in fallback}, fr, extra_findings=list(F.values()))
        kept += k2; verdicts += v2
        for k in ("claims_total", "passed", "downgraded", "dropped"): vsum[k] += s2[k]
    # insight confidence (code): model label capped by evidence
    for i in kept:
        mx = "Confirmed"
        if band != "fresh" and any(x.get("type") in ("delay_chain", "manpower_shortfall") for x in i["computed_impacts"]): mx = "Likely"
        if any(x.get("source") == "model_scenario" for x in i["computed_impacts"]): mx = "Likely"
        rules = {F[f]["rule_id"] for f in i["finding_ids"] if f in F}
        if "COST-PAYAPP-AHEAD" in rules and band != "fresh": mx = cap(mx, "Likely")   # spec §4.3: Likely at best when the schedule is aging
        if "SCH-MANPOWER-ACUTE" in rules: mx = cap(mx, "Likely")                      # spec §0.1 D2: acute trigger capped at Likely until it repeats
        if i["narrative_claims"][0].get("verifier_status") == "downgraded": mx = cap(mx, "Likely")
        if all(c.get("verifier_status") == "downgraded" for c in i["narrative_claims"]): mx = "Signal"
        i["confidence"] = cap(i.get("confidence") or "Likely", mx); i["impacts"] = i["computed_impacts"]
    top, order = rank(T, kept, F)
    A.add("code re-rank after verification (PM rule)", "T0", {"top": top})
    by_key = {i["key"]: i for i in kept}
    # coverage (final, pre-writer): every finding accounted for
    where = {}
    for i in kept:
        for fid in i["finding_ids"]: where.setdefault(fid, i)
    aside = {c["finding_id"]: c for c in rank_out["coverage_precheck"] if c.get("status") == "set_aside_by_model"}
    cov = []
    for fid, f in F.items():
        if fid in where:
            i = where[fid]
            st = "top" if i["top_rank"] else "section"
            cov.append({"finding_id": fid, "severity": f["severity"], "status": st, "top_rank": i["top_rank"], "insight": i["key"],
                        "section": i.get("section"), "origin": i.get("origin")})
        elif fid in aside: cov.append({"finding_id": fid, "severity": f["severity"], "status": "set_aside", "reason": aside[fid]["reason"]})
        else: cov.append({"finding_id": fid, "severity": f["severity"], "status": "MISSING"})
    top_by_ref = {}
    for k in top:
        for c in by_key[k]["narrative_claims"]:
            for ci in c["citations"]: top_by_ref.setdefault(ci["ref"], k)
    mats = materials(T, rank_out["comms"], rules_out, top_by_ref)
    hi_missing = [c for c in cov if c["status"] == "MISSING" and c["severity"] in ("high", "critical")]
    print(f"  [verify] {vsum} top={top} coverage_missing_high={len(hi_missing)}", flush=True)
    gaps = list(rank_out["comms"].get("gaps") or []) + [g for o in rank_out["cluster_outputs"].values() for g in ((o.get("output") or {}).get("gaps") or [])]
    return {"verified_insights": [by_key[k] for k in order], "top_keys": top, "order": order, "verdicts": verdicts, "summary": vsum,
            "materials": mats, "coverage": cov, "coverage_high_missing": hi_missing, "gaps": gaps}, A
