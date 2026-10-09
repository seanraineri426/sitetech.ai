"""Stage 2 `rules` (Inngest step "rules"): layer 1, deterministic. M1 findings (fixture m1/<day>/findings.json = the implemented M1
rules) + M3/M2-structured findings from harness/rules_engine.py (schedule, cost, procurement, decisions, notice language), each
evaluated for as_of and compare_to (lifecycle NEW/WORSE/UNCHANGED + code delta text), then ONE CANDIDATE PER FINDING with its default
S7 impacts, and the issue clusters for the per-cluster model step. Also overdue record rows, closed-since-last, status facts.
Input: FixtureTools. Output: {findings, resolved, candidates, clusters, record_rows, closed_since_last, status_facts}.
Tier: T0 reads; T1 upsert_findings (production; here = this stage's saved output)."""
from . import Actions
from ..calendar_util import d_
from ..rules_engine import run_rules, lifecycle, SEV
from ..candidates import clusters, default_impacts

def record_rows(T, findings):
    rows = {"overdue_rfis": [], "overdue_submittals": []}; seen = set()
    for f in sorted(findings, key=lambda f: (-SEV.index(f["severity"]), -(f["days_overdue"] or 0))):
        ref = f["citations"][0]["ref"]
        key = "overdue_rfis" if f["rule_id"] == "RFI-OVERDUE" else "overdue_submittals" if f["rule_id"] in ("SUB-REVIEW-OVERDUE", "SUB-SUBMIT-BY-MISSED") else None
        if not key or ref in seen: continue
        seen.add(ref); rec = T.index[ref][1]
        rows[key].append({"ref": ref, "label": f["record_label"], "title": rec.get("subject") or rec.get("title"), "days_overdue": f["days_overdue"],
                          "governing_date": f["governing_date"], "governing_date_kind": f["governing_date_kind"], "ball_in_court": f["ball_in_court"],
                          "severity": f["severity"], "finding_id": f["finding_id"],
                          **({"tag": f["change_since_prior_run"].upper()} if f["change_since_prior_run"] in ("new", "worse") else {})})
    return rows

def closed_since_last(T):
    out = []
    for f in T.t_list_findings(change_since_prior_run=["resolved"]):
        ref = f["citations"][0]["ref"]; rec = T.index[ref][1]
        how = "answered" if rec.get("answers") else f"status {rec.get('status')}"
        when = (rec.get("time_resolved") or (rec.get("answers") or [{}])[-1].get("date") or "")[:10]
        out.append({"label": f'{f["record_label"]} {how}' + (f" {d_(when).month}/{d_(when).day}" if when else ""), "ref": ref, "how": how,
                    **({"closed_on": when} if when else {}), "finding_id": f["finding_id"]})
    return out

def status_facts(T):
    bref = next(b["ref"] for b in T.budget if b["snapshot_date"] == T.as_of.isoformat())
    cont = T.t_compute_impact("contingency", {}, [bref])
    km = T.project["key_milestones"][0]; mref = "p6:activity:" + km["activity_id"]; ms = T.index[mref][1]
    floor = (cont["pct_used_incl_pending"] - cont["pct_complete_cost"]) >= 0.30 or cont["remaining_usd"] < 0.10 * cont["original_usd"]
    health = "slipping" if ms["early_finish"] > km["baseline"] else "at_risk" if floor else "on_track"
    rule = ("Key milestone forecast later than baseline" if health == "slipping" else
            "COST-CONTINGENCY-BURN on owner contingency (used incl. pending - % complete >= 30 pts)" if health == "at_risk" else "none fired")
    reg = T.t_get_decisions_register()["entries"]
    return {"health": health, "health_rule": rule, "milestone": {"name": km["name"], "activity_ref": mref, "baseline": km["baseline"],
            "forecast": ms["early_finish"], "basis": f'{T.sched_label(ms["schedule_update_id"])} {ms["schedule_update_id"]} data date {ms["data_date"]}'},
            "budget_ref": bref, "contingency": cont, "decisions_open_register": [e for e in reg if e["status"] == "open"]}

def m1_with_delta(T):
    diff = {r["fingerprint"]: r for r in T.t_diff_snapshots()["findings"]}
    out = []
    for f in T.t_list_findings(status=["open"]):
        f = dict(f); d = diff.get(f["fingerprint"]); f["source"] = "fixture_m1"; f["run_date"] = T.as_of.isoformat()
        if f["change_since_prior_run"] == "worse" and d and d["before"]:
            parts = []
            if d["before"]["days_overdue"] != d["after"]["days_overdue"]: parts.append(("days_overdue", d["before"]["days_overdue"], d["after"]["days_overdue"]))
            if d["before"]["severity"] != d["after"]["severity"]: parts.append(f'severity {d["before"]["severity"]} -> {d["after"]["severity"]}')
            f["delta"] = parts
        out.append(f)
    return out

def run(T):
    A = Actions("rules")
    m1 = m1_with_delta(T); A.add("list_findings(as_of) + diff_snapshots (M1 rules, fixture)", "T0")
    cur, resolved = lifecycle(run_rules(T, T.as_of.isoformat()), run_rules(T, T.compare_to.isoformat()))
    A.add("rules_engine M3/M2-structured (as_of and compare_to) + lifecycle", "T0", {"findings": len(cur), "resolved": len(resolved)})
    findings = m1 + cur
    cands = [{"finding_id": f["finding_id"], "rule_id": f["rule_id"], "severity": f["severity"], "default_impacts": default_impacts(T, f)} for f in findings]
    A.add("candidates: one per finding + default S7 impacts (code)", "T0", {"candidates": len(cands)})
    cl = clusters(T, findings); A.add("issue clusters (code)", "T0", {"clusters": len(cl)})
    A.add("upsert_findings", "T1", {"executed": False, "note": "production writes findings; the eval saves this stage output instead"})
    return {"findings": findings, "resolved": resolved, "candidates": cands, "clusters": cl, "record_rows": record_rows(T, findings),
            "closed_since_last": closed_since_last(T), "status_facts": status_facts(T)}, A
