#!/usr/bin/env python3
"""LEGACY monolithic orchestrator (produced runs 20261006-192551 and 20261006-192806; superseded by the five-stage pipeline.py).
SiteTech Daily Brief eval pipeline on the FICTIONAL Linden Yard fixture.
S0 freshness (code) -> S3 findings (fixture m1/day2, code) -> S4 diff (code) -> S5 five analysts (LLM, parallel, context-packed
T0 tool results) -> S6 correlator (LLM; links + proposes rank) -> S7 compute_impact (code) -> S8 verifier (code) -> S9 brief writer
(LLM, closed book) -> S8b brief verifier (code) -> render (examples/render_brief.py) -> score (evals/score_brief.py).
Usage: /tmp/stvenv/bin/python -m harness.pipeline   (from evals/)"""
import json, os, re, sys, time, subprocess, hashlib, datetime as dt, concurrent.futures as cf, importlib.util, copy
import yaml
from .providers import get_model, resolve_model_spec, ProviderError
from .cost_guard import CostGuard, BudgetExceeded, estimate_cost
from .fixture_tools import FixtureTools, INTEL
from . import context as C
from .verifier import verify_insights, verify_brief, word_count_main, SCHEMA, walk_refs
from .calendar_util import d_

HERE = os.path.dirname(os.path.abspath(__file__)); EVALS = os.path.dirname(HERE); RUNS = os.environ.get("HARNESS_RUNS_DIR") or os.path.join(EVALS, "runs")
ANALYSTS = ["schedule_analyst", "cost_analyst", "rfi_submittal_analyst", "procurement_analyst", "comms_decisions_analyst"]

def prompt(name): return open(os.path.join(INTEL, "prompts", name + ".md")).read()
SHARED = prompt("_shared_rules")

def parse_json(text):
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t); t = re.sub(r"\s*```\s*$", "", t)
    best = None
    for m in re.finditer(r"\{", t):          # tolerate prose before/after: take the largest decodable top-level object
        try: obj, end = json.JSONDecoder().raw_decode(t[m.start():])
        except json.JSONDecodeError: continue
        if isinstance(obj, dict) and (best is None or end > best[1]): best = (obj, end)
        if best and best[1] > len(t) * 0.5: break
    if best is None: raise ValueError("no JSON object in response")
    return best[0]

class Runner:
    def __init__(self, cfg, run_dir):
        self.cfg = cfg; self.dir = run_dir; os.makedirs(os.path.join(run_dir, "raw"), exist_ok=True)
        self.spec = resolve_model_spec(cfg); self.model = get_model(self.spec, cfg)
        self.guard = CostGuard(os.path.join(RUNS, "_spend_ledger.json"), cfg["cost"]["hard_cap_usd"])
        self.calls = []; self.run_id = os.path.basename(run_dir)

    def llm(self, stage, system, user_obj, stage_cfg, parse=True):
        user = json.dumps(user_obj, ensure_ascii=False, separators=(",", ":")) if not isinstance(user_obj, str) else user_obj
        msgs = [{"role": "user", "content": user}]
        mt = stage_cfg["max_tokens"]; est = estimate_cost(self.model, system, msgs, mt)
        self.guard.reserve(est, stage); t0 = time.time()
        try:
            r = self.model.generate_text(system=system, messages=msgs, max_tokens=mt, reasoning_effort=stage_cfg.get("reasoning_effort"), reasoning_max_tokens=stage_cfg.get("reasoning_max_tokens"),
                                         trace={"run_id": self.run_id, "stage": stage})
        except ProviderError as e:
            self.guard.record(est, {"run_id": self.run_id, "stage": stage, "error": str(e)[:500], "cost_usd": 0.0}); raise
        u = r.usage
        self.guard.record(est, {"run_id": self.run_id, "stage": stage, "model": r.model_id, "served_by": r.served_by, "cost_usd": u.cost_usd,
                                "in": u.input_tokens, "out": u.output_tokens})
        rec = {"stage": stage, "adapter": self.model.provider_id, "model_requested": self.model.model_id, "model_served": r.model_id,
               "served_by": r.served_by, "finish_reason": r.finish_reason, "latency_s": round(time.time() - t0, 1),
               "usage": {"input_tokens": u.input_tokens, "output_tokens": u.output_tokens, "reasoning_tokens": u.reasoning_tokens,
                         "cached_input_tokens": u.cached_input_tokens, "cost_usd": u.cost_usd},
               "request_meta": r.request_meta, "est_worst_case_usd": round(est, 4),
               "system_prompt_sha256": hashlib.sha256(system.encode()).hexdigest()[:16], "system_prompt": system, "user_message": user,
               "response_text": r.text, "openrouter_generation_id": r.provider_metadata.get("id")}
        json.dump(rec, open(os.path.join(self.dir, "raw", f"{stage}.json"), "w"), indent=1, ensure_ascii=False)
        self.calls.append({k: rec[k] for k in ("stage", "model_served", "served_by", "finish_reason", "latency_s", "usage")})
        print(f"  [{stage}] {r.served_by} in={u.input_tokens} out={u.output_tokens} cost=${u.cost_usd} finish={r.finish_reason} "
              f"({rec['latency_s']}s) | run spend ${sum((c['usage']['cost_usd'] or 0) for c in self.calls):.4f}", flush=True)
        if not parse: return r.text
        if not r.text.strip():
            raise ValueError(f"{stage}: empty response text (finish={r.finish_reason}; reasoning_tokens={u.reasoning_tokens})")
        try:
            return parse_json(r.text)
        except Exception as e:
            print(f"  [{stage}] JSON parse failed ({e}); one repair call", flush=True)
            fix = self.llm(stage + "__json_repair", "Return the user's content as ONE valid JSON object. Fix syntax only (close brackets, "
                           "escape quotes, drop trailing prose). Do not add, remove, or change any facts. Output JSON only.",
                           r.text[-60000:], self.cfg["stages"]["repair"], parse=False)
            return parse_json(fix)

def freshness(T, cfg):
    upd = T.sched["updates"][-1]; dd = d_(upd["data_date"]); age = (T.as_of - dd).days
    band = "fresh" if age <= 7 else "aging" if age <= 14 else "stale" if age <= 28 else "missing"
    f = cfg["fixture"]; mb = T.project["project_mailbox"]
    def lab(ts): x = dt.datetime.fromisoformat(ts); return f"{x.strftime('%a')} {x.month}/{x.day} {x.strftime('%-I:%M %p')}"
    up = dt.datetime.fromisoformat(upd["uploaded_at"])
    return [
        {"source": "procore", "system": "procore_dmsa", "band": "fresh", "as_of_label": f"Procore synced {lab(f['procore_last_sync'])}",
         "last_successful_sync": f["procore_last_sync"]},
        {"source": "msgraph_outlook", "band": "fresh", "as_of_label": f"Project mailbox synced {lab(f['mailbox_last_sync'])}",
         "last_successful_sync": f["mailbox_last_sync"], "scope_note": f"Only {mb} is covered; threads that never copy it are invisible"},
        {"source": "schedule", "system": upd["source"], "band": band,
         "as_of_label": f"Schedule as of {T.sched_label()} data date {dd.strftime('%a')} {dd.month}/{dd.day} (uploaded {up.strftime('%a')} {up.month}/{up.day})",
         "last_successful_sync": upd["uploaded_at"], "data_date": upd["data_date"], "uploaded_at": upd["uploaded_at"],
         "schedule_update_id": upd["schedule_update_id"],
         "effect": f"Schedule is {age} days past its data date ({band}): float and {T.milestone_name} impacts are capped at Likely unless corroborated by fresher records" if band != "fresh" else ""},
        {"source": "msgraph_sharepoint", "band": "fresh", "as_of_label": "Contract notice terms CT-1/CT-2 confirmed by GC 9/15",
         "last_successful_sync": f["mailbox_last_sync"]}]

def record_rows(T):
    rows = {"overdue_rfis": [], "overdue_submittals": []}; seen = set()
    sev = ["low", "medium", "high", "critical"]
    for f in sorted(T.t_list_findings(status=["open"]), key=lambda f: (-sev.index(f["severity"]), -f["days_overdue"])):
        ref = f["citations"][0]["ref"]
        key = "overdue_rfis" if f["rule_id"] == "RFI-OVERDUE" else "overdue_submittals" if f["rule_id"] in ("SUB-REVIEW-OVERDUE", "SUB-SUBMIT-BY-MISSED") else None
        if not key or ref in seen: continue
        seen.add(ref)
        rec = T.index[ref][1]
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

def status_facts(T, impacts_all):
    cont = T.t_compute_impact("contingency", {}, ["procore:budget_snapshot:20261006"])
    tco = T.index["p6:activity:" + T.project["key_milestones"][0]["activity_id"]][1]
    floor = (cont["pct_used_incl_pending"] - cont["pct_complete_cost"]) >= 0.30 or cont["remaining_usd"] < 0.10 * cont["original_usd"]
    health = "slipping" if tco["early_finish"] > T.project["key_milestones"][0]["baseline"] else "at_risk" if floor else "on_track"
    rule = ("Key milestone forecast later than baseline" if health == "slipping" else
            "COST-CONTINGENCY-BURN on owner contingency (used incl. pending - % complete >= 30 pts)" if health == "at_risk" else "none fired")
    reg = T.t_get_decisions_register()["entries"]
    return {"health": health, "health_rule": rule, "milestone": {"name": T.milestone_name, "activity_ref": "p6:activity:" + T.project["key_milestones"][0]["activity_id"],
            "baseline": T.project["key_milestones"][0]["baseline"], "forecast": tco["early_finish"], "basis": f'{T.sched_label()} {T.cur_update} data date {tco.get("data_date")}'},
            "contingency": cont, "decisions_pending_register": [e for e in reg if e["kind"] == "pending" or e["status"] == "open"],
            "largest_conditional_exposures": sorted([{"insight_id": k, "delay_usd": i.get("delay_usd"), "condition": i.get("condition"), "method": i.get("method")}
                                                     for k, v in impacts_all.items() for i in v if i.get("delay_usd")], key=lambda x: -x["delay_usd"])[:3]}

def run_impacts(T, insights):
    out = {}
    for ins in insights:
        reqs = ins.get("impact_request")
        reqs = [reqs] if isinstance(reqs, dict) else (reqs or [])
        res = []
        for q in reqs:
            if not isinstance(q, dict) or not q.get("type"): continue
            r = T.call("correlator", "compute_impact", {"type": q["type"], "params": q.get("params") or {}, "inputs_refs": q.get("inputs_refs") or []})
            res.append(r)
        out[ins.get("insight_id")] = res
    return out

def verify_materials(T, comms):
    """Code checks on comms-analyst section materials: refs must resolve; drop entries without a resolvable citation."""
    regs, emails, flags = [], [], []
    for d in (comms or {}).get("register_updates", []) or []:
        cs = [c for c in d.get("citations", []) if isinstance(c, dict) and T.resolvable(c.get("ref", ""))]
        if cs: regs.append(dict(d, citations=cs))
        else: flags.append({"drop_register_update": d.get("summary", "")[:80]})
    for e in (comms or {}).get("significant_emails", []) or []:
        if T.resolvable(e.get("ref", "")) and e["ref"].startswith("msgraph_outlook:message:"): emails.append(e)
        else: flags.append({"drop_email": e.get("ref")})
    return regs, emails, flags

def trim_bodies(brief, limit=700):
    """Last-resort deterministic trim: drop trailing sentences from the longest top-item bodies until within budget."""
    while word_count_main(brief) > limit:
        t = max(brief["top_items"], key=lambda t: len(t["body"].split()))
        s = re.split(r"(?<=[.;])\s+", t["body"].strip())
        if len(s) <= 1: break
        t["body"] = " ".join(s[:-1])
    brief["metrics"]["word_count_main"] = word_count_main(brief)

def main():
    cfg = yaml.safe_load(open(os.path.join(HERE, "config.yaml")))
    from .fixture_tools import fixture_settings, FX as _FX
    cfg["fixture"] = fixture_settings(_FX, yaml.safe_load(open(os.path.join(_FX, "harness_fixture.yaml"))))
    os.makedirs(RUNS, exist_ok=True)
    done = [d for d in os.listdir(RUNS) if os.path.exists(os.path.join(RUNS, d, "run_manifest.json"))]
    if len(done) >= cfg["cost"]["max_full_runs"]:
        sys.exit(f"max_full_runs={cfg['cost']['max_full_runs']} reached ({done}); refusing to start another full run")
    ts = dt.datetime.now().strftime("%Y%m%d-%H%M%S"); run_dir = os.path.join(RUNS, ts)
    R = Runner(cfg, run_dir); audit = []
    T = FixtureTools(cfg["fixture"]["as_of"], cfg["fixture"]["compare_to"], audit=audit)
    manifest = {"run_id": ts, "model_spec": R.spec, "started_at": dt.datetime.now().isoformat(timespec="seconds"), "fictional_fixture": True,
                "routing_privacy_block": R.model.routing_block() if hasattr(R.model, "routing_block") else None, "design": "context_packing"}
    json.dump(manifest, open(os.path.join(run_dir, "run_manifest.json"), "w"), indent=1)
    spend_before = subprocess.run([sys.executable, os.path.join(HERE, "check_spend.py"), os.path.join(run_dir, "spend_before.json")], capture_output=True, text=True).stdout.strip()
    print("spend before:", spend_before, flush=True)
    status = "ok"
    try:
        fr = freshness(T, cfg)
        # S5 analysts (parallel)
        packs = {a: C.analyst_pack(T, a, fr) for a in ANALYSTS}
        def run_a(a):
            sysmsg = SHARED + "\n\n" + prompt(a) + C.RUNTIME_ANALYST + (C.RUNTIME_COMMS if a == "comms_decisions_analyst" else "")
            try:
                return a, R.llm(a, sysmsg, packs[a], cfg["stages"]["analyst"])
            except (ValueError, json.JSONDecodeError, ProviderError) as e:   # degrade: one analyst failing must not kill the run
                print(f"  [{a}] FAILED: {e}; continuing without it (gap recorded)", flush=True)
                return a, {"domain": a, "candidates": [], "gaps": [{"source": a, "reason": f"analyst_failed: {str(e)[:200]}"}], "_failed": True}
        with cf.ThreadPoolExecutor(5) as ex: outs = dict(ex.map(run_a, ANALYSTS))
        json.dump(outs, open(os.path.join(run_dir, "analyst_outputs.json"), "w"), indent=1)
        # S6 correlator
        corr_in = {"project_context": C.project_context(T, fr), "analyst_outputs": outs,
                   "findings": T.call("correlator", "list_findings", {}), "diff_snapshots": T.call("correlator", "diff_snapshots", {}),
                   "decisions_register": T.call("correlator", "get_decisions_register", {}),
                   "contract_terms": T.call("correlator", "get_contract_terms", {"confirmed_only": False}),
                   "entity_links": T.call("correlator", "get_entity_links", {"refs": list(T.index)}), "records_index": C.records_index(T),
                   "playbook": C.sanitized_playbook(), "ranking_rules": C.spec_ranking_rules()}
        corr = R.llm("correlator", SHARED + "\n\n" + prompt("correlator") + C.RUNTIME_CORRELATOR, corr_in, cfg["stages"]["correlator"])
        json.dump(corr, open(os.path.join(run_dir, "correlator_output.json"), "w"), indent=1)
        insights = [i for i in corr.get("insights", []) if isinstance(i, dict)]
        # S7 impacts (code)
        impacts = run_impacts(T, insights)
        json.dump(impacts, open(os.path.join(run_dir, "impacts.json"), "w"), indent=1)
        # S8a verifier (code)
        kept, verdicts, vsum = verify_insights(insights, T, impacts, fr)
        kept.sort(key=lambda i: (i.get("rank") if isinstance(i.get("rank"), int) else 99))
        for n, i in enumerate(kept, 1): i["rank"] = n          # re-number after drops, preserving LLM order
        regs, emails, mflags = verify_materials(T, outs.get("comms_decisions_analyst"))
        json.dump({"summary": vsum, "verdicts": verdicts, "material_flags": mflags}, open(os.path.join(run_dir, "verifier_claims.json"), "w"), indent=1)
        print("  [verifier:claims]", vsum, flush=True)
        # S9 writer (closed book)
        rows = record_rows(T); sf = status_facts(T, impacts)
        allowed = {c["ref"] for i in kept for cl in i["narrative_claims"] for c in cl["citations"]} | {e["ref"] for e in emails} | \
                  {c["ref"] for d in regs for c in d["citations"]} | {r["ref"] for k in rows for r in rows[k]} | \
                  {e["decision_ref"] for e in sf["decisions_pending_register"]} | {"procore:budget_snapshot:20261006", "p6:activity:A4000"}
        ridx = C.records_index(T)
        writer_in = {"project": T.project["name"], "as_of": T.as_of.isoformat(), "daily_delay_cost_usd": T.project["delay_cost_basis"]["daily_delay_cost_usd"],
                     "directory": C.project_context(T, fr)["directory"], "freshness": fr, "status_facts": sf,
                     "verified_insights": [{k: i.get(k) for k in ("insight_id", "rank", "section", "tag", "delta_text", "headline", "playbook_rule_ids",
                                                                   "narrative_claims", "mechanism", "computed_impacts", "owner", "action", "decision_deadline",
                                                                   "score_basis", "interacts_with")} for i in kept],
                     "record_rows": rows, "decisions_material": {"register_from_minutes": T.t_get_decisions_register()["entries"], "verified_comms_register_updates": regs},
                     "significant_emails_material": emails, "citation_labels": {r: ridx[r] for r in sorted(allowed) if r in ridx},
                     "analyst_gaps": [g for o in outs.values() for g in (o.get("gaps") or [])] + (corr.get("gaps") or []),
                     "brief_schema": SCHEMA}
        wraw = R.llm("brief_writer", SHARED + "\n\n" + prompt("brief_writer") + C.RUNTIME_WRITER, writer_in, cfg["stages"]["writer"])
        json.dump(wraw, open(os.path.join(run_dir, "writer_output_raw.json"), "w"), indent=1)
        deterministic = {"_FICTIONAL": "ALL DATA IN THIS BRIEF IS FICTIONAL (eval fixture). Model-generated, code-verified.",
                         "schema_version": "1.0", "brief_id": f"brief-linden-yard-{T.as_of.isoformat()}-{ts}", "run_id": ts, "version": 1,
                         "org_id": T.project["org_id"], "project_id": T.project["project_id"], "project_name": T.project["name"], "as_of": T.as_of.isoformat(),
                         "coverage": {"window_start": f"{T.as_of.isoformat()}T00:00:00-04:00", "window_end": f"{T.as_of.isoformat()}T23:59:59-04:00", "cutoff_at": cfg["fixture"]["cutoff_at"]},
                         "generated_at": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
                         "compare_to": {"as_of": T.compare_to.isoformat(), "brief_id": None, "basis": "prior_business_day_snapshot"},
                         "freshness": fr, "closed_since_last": closed_since_last(T),
                         "metrics": {"word_count_main": 0, "items_flagged_total": len(kept), "llm_cost_usd": None,
                                     "verifier": {k: vsum[k] for k in ("claims_total", "passed", "downgraded", "dropped")} | {"independent_provider": False}}}
        brief, rep = verify_brief(wraw, T, allowed, copy.deepcopy(deterministic), rows)
        rep["repair_attempted"] = False
        if rep["schema_errors"] or rep["word_count_main"] > 700:
            rep["repair_attempted"] = True
            fix_in = {"problems": {"schema_errors": rep["schema_errors"][:40], "word_count_main": rep["word_count_main"], "limit": 650},
                      "your_previous_output": wraw, "brief_schema_defs": SCHEMA["$defs"]}
            wraw2 = R.llm("brief_writer_repair", SHARED + "\n\n" + prompt("brief_writer") + C.RUNTIME_WRITER +
                          "\n- REPAIR PASS: fix only the listed problems (schema errors; shorten bodies if over the word limit). Add no facts, refs, or numbers.",
                          fix_in, cfg["stages"]["repair"])
            json.dump(wraw2, open(os.path.join(run_dir, "writer_output_repair.json"), "w"), indent=1)
            brief2, rep2 = verify_brief(wraw2, T, allowed, copy.deepcopy(deterministic), rows)
            rep2["invented_refs_before"] = sorted(set(rep["invented_refs_before"]) | set(rep2["invented_refs_before"]))
            rep2["first_pass"] = {k: rep[k] for k in ("schema_errors", "word_count_main", "flags")}
            brief, rep = brief2, rep2; rep["repair_attempted"] = True
        if brief["metrics"]["word_count_main"] > 700:
            trim_bodies(brief); rep["flags"].append({"fix": f"deterministic body trim -> {brief['metrics']['word_count_main']} words"})
        cost = sum((c["usage"]["cost_usd"] or 0) for c in R.calls)
        brief["metrics"]["llm_cost_usd"] = round(cost, 4)
        import jsonschema
        rep["schema_errors_final"] = [f'{"/".join(map(str, e.path))}: {e.message[:200]}' for e in
                                      jsonschema.Draft202012Validator(SCHEMA, format_checker=jsonschema.FormatChecker()).iter_errors(brief)]
        rep["invented_refs_after"] = sorted({r for r in walk_refs(brief) if not T.resolvable(r)})
        json.dump(brief, open(os.path.join(run_dir, "brief_verified.json"), "w"), indent=1, ensure_ascii=False)
        json.dump(rep, open(os.path.join(run_dir, "verifier_brief_report.json"), "w"), indent=1)
        print(f"  [verifier:brief] schema_errors_final={len(rep['schema_errors_final'])} invented_before={rep['invented_refs_before']} "
              f"after={rep['invented_refs_after']} words={brief['metrics']['word_count_main']} flags={len(rep['flags'])}", flush=True)
        # render (existing deterministic renderer)
        spec = importlib.util.spec_from_file_location("render_brief", os.path.join(INTEL, "examples", "render_brief.py"))
        rb = importlib.util.module_from_spec(spec); spec.loader.exec_module(rb)
        open(os.path.join(run_dir, "brief_rendered.md"), "w").write(rb.render(brief))
        # score
        sc = subprocess.run([sys.executable, os.path.join(EVALS, "score_brief.py"), os.path.join(run_dir, "brief_verified.json"), "--json"], capture_output=True, text=True)
        open(os.path.join(run_dir, "score_report.json"), "w").write(sc.stdout)
        sct = subprocess.run([sys.executable, os.path.join(EVALS, "score_brief.py"), os.path.join(run_dir, "brief_verified.json")], capture_output=True, text=True)
        open(os.path.join(run_dir, "score_report.txt"), "w").write(sct.stdout + sct.stderr); print(sct.stdout + sct.stderr, flush=True)
    except BudgetExceeded as e:
        status = f"aborted_budget: {e}"; print("ABORT:", e, flush=True)
    except Exception as e:
        status = f"error: {e.__class__.__name__}: {e}"; print("ERROR:", status, flush=True); import traceback; traceback.print_exc()
    finally:
        json.dump(audit, open(os.path.join(run_dir, "tool_calls_audit.json"), "w"), indent=1)
        cost = sum((c["usage"]["cost_usd"] or 0) for c in R.calls)
        usage = {"calls": R.calls, "totals": {"input_tokens": sum(c["usage"]["input_tokens"] for c in R.calls),
                 "output_tokens": sum(c["usage"]["output_tokens"] for c in R.calls), "reasoning_tokens": sum(c["usage"]["reasoning_tokens"] or 0 for c in R.calls),
                 "cost_usd_reported": round(cost, 6)}, "ledger_total_all_runs_usd": round(R.guard.spent, 6), "hard_cap_usd": R.guard.cap}
        json.dump(usage, open(os.path.join(run_dir, "usage_cost.json"), "w"), indent=1)
        spend_after = subprocess.run([sys.executable, os.path.join(HERE, "check_spend.py"), os.path.join(run_dir, "spend_after.json")], capture_output=True, text=True).stdout.strip()
        manifest.update({"finished_at": dt.datetime.now().isoformat(timespec="seconds"), "status": status, "run_cost_usd": round(cost, 6),
                         "spend_before": spend_before, "spend_after": spend_after})
        json.dump(manifest, open(os.path.join(run_dir, "run_manifest.json"), "w"), indent=1)
        print(f"run {ts}: status={status} cost=${cost:.4f} ledger=${R.guard.spent:.4f} spend_after={spend_after}", flush=True)

if __name__ == "__main__":
    main()
