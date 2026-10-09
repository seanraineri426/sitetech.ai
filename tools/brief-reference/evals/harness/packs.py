"""Context packs for the per-cluster model step and the comms extraction step (code builds them; the model reads only these)."""
import json
from .candidates import context_refs

def _compact(T, ref, body_chars=1800):
    t, r = T.index[ref]
    if t == "email":
        from .parties import display_from
        return {"ref": ref, "type": t, "from": display_from(T.project, r), "received_at": r["received_at"], "subject": r["subject"], "body": r["body_text"][:body_chars]}
    if t == "activity":
        return {"ref": ref, "type": t, **{k: r.get(k) for k in ("activity_id", "name", "data_date", "early_start", "early_finish", "total_float_wd", "pct_complete",
                                                              "actual_start", "on_driving_path_to_tco", "company", "planned_crew_size", "predecessors")}}
    if t == "budget_snapshot":
        return {"ref": ref, "type": t, "snapshot_date": r["snapshot_date"], "percent_complete_cost": r["percent_complete_cost"], "owner_contingency": r["owner_contingency"]}
    if t == "rfi":
        return {"ref": ref, "type": t, **{k: r.get(k) for k in ("label", "subject", "status", "due_date", "ball_in_court", "spec_section", "schedule_impact", "cost_impact",
                                                              "question", "answers")}}
    return {"ref": ref, "type": t, **{k: v for k, v in r.items() if k not in ("ref", "_FICTIONAL", "id")}}

def finding_view(f):
    return {k: f.get(k) for k in ("finding_id", "rule_id", "severity", "title", "change_since_prior_run", "delta", "days_overdue", "governing_date",
                                  "governing_date_kind", "decision_deadline", "ball_in_court", "evidence")} | {"refs": [c["ref"] for c in f["citations"]]}

def cluster_pack(T, cl, F, cands, extra_links, project_ctx, contract_terms):
    refs = sorted(set(context_refs(T, cl, extra_links)) | {c["ref"] for i in cl["finding_ids"] for c in F[i]["citations"]})
    imp = {c["finding_id"]: c["default_impacts"] for c in cands if c["finding_id"] in cl["finding_ids"]}
    return {"cluster_id": cl["cluster_id"], "project": project_ctx,
            "findings": [finding_view(F[i]) for i in cl["finding_ids"]],
            "code_impacts": {k: [{x: v.get(x) for x in ("type", "kind", "milestone_wd", "milestone_cd", "delay_usd", "total_usd", "payment_risk_usd",
                                                       "condition", "method") if v.get(x) is not None} for v in vs] for k, vs in imp.items() if vs},
            "records": [_compact(T, r) for r in refs],
            "contract_terms": contract_terms if any(T.index[r][0] == "email" for r in refs) else [],
            "allowed_refs": refs}

def comms_pack(T, project_ctx, records_index):
    em = [_compact(T, e["ref"], 2400) for e in T.emails["emails"]]
    return {"project": project_ctx, "mailbox_coverage_note": T.emails.get("coverage_note"), "emails": em,
            "records_index": {r: s for r, s in records_index.items() if not r.startswith("msgraph_outlook")}}
