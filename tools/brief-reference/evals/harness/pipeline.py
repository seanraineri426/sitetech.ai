#!/usr/bin/env python3
"""SiteTech Daily Brief eval pipeline on the FICTIONAL Linden Yard fixture, as the five production stages:
    read -> rules -> rank -> verify -> deliver      (+ eval-only `score` after deliver)
Each stage is a plain function in harness/stages/<name>.py; its return value is saved to runs/<ts>/stages/<n>_<name>.json and is the only
thing the next stage reads, so each maps 1:1 to an Inngest `step.run('<name>', ...)` (memoized step output). No workflow engine.
Usage (from evals/): /tmp/stvenv/bin/python -m harness.pipeline [--fixture <dir>] [--as-of YYYY-MM-DD --compare-to YYYY-MM-DD]
    --fixture: any project fixture with the Linden Yard layout (project.json, m1/day1|day2, m2/, m3/); default evals/fixture (Linden Yard).
    Nothing in the pipeline is project-specific; per-fixture run settings (as_of, compare_to, sync times, cutoff) come from CLI flags
    (--as-of --compare-to --cutoff-at --procore-sync --mailbox-sync) > <fixture>/harness_fixture.yaml > derived from the fixture
    (m1 snapshot run_dates; simulated sync/cutoff = as_of+1 04:45 project time). Scoring runs only if <fixture>/expected_findings.json exists.
Resume (Inngest-style: re-execute later steps from memoized earlier step outputs; NOT a full run):
    /tmp/stvenv/bin/python -m harness.pipeline --resume <run_dir_with_stages/> --from deliver"""
import argparse, json, os, sys, subprocess, datetime as dt
import yaml
from .fixture_tools import FixtureTools, fixture_settings
from .llm_runner import Runner
from .cost_guard import BudgetExceeded
from .stages import save, read, rules, rank, verify, deliver

HERE = os.path.dirname(os.path.abspath(__file__)); EVALS = os.path.dirname(HERE)
RUNS = os.environ.get("HARNESS_RUNS_DIR") or os.path.join(EVALS, "runs")

def score(run_dir, brief_path, fixture_dir):
    """Eval-only step (not a production stage): evals/score_brief.py (crash fixed in place, iteration 2) on the delivered brief."""
    if not os.path.exists(os.path.join(fixture_dir, "expected_findings.json")):
        print("no expected_findings.json in fixture: scoring skipped", flush=True); return None
    scorer = os.path.join(EVALS, "score_brief.py"); used = "evals/score_brief.py"
    sc = subprocess.run([sys.executable, scorer, brief_path, "--json", "--fixture", fixture_dir], capture_output=True, text=True)
    if not sc.stdout.strip().startswith("{"): open(os.path.join(run_dir, "score_crash.txt"), "w").write(sc.stderr)
    open(os.path.join(run_dir, "score_report.json"), "w").write(sc.stdout)
    st = subprocess.run([sys.executable, scorer, brief_path, "--fixture", fixture_dir], capture_output=True, text=True)
    open(os.path.join(run_dir, "score_report.txt"), "w").write(f"# scorer: {used}\n" + st.stdout + st.stderr); print(st.stdout + st.stderr, flush=True)
    return used

def spend(run_dir, name):
    if os.environ.get("MODEL", "").startswith("mock:"): return "skipped (mock run, zero cost)"
    return subprocess.run([sys.executable, os.path.join(HERE, "check_spend.py"), os.path.join(run_dir, name)], capture_output=True, text=True).stdout.strip()

ORDER = ["read", "rules", "rank", "verify", "deliver"]

def load_stage(stages_dir, n, name):
    return json.load(open(os.path.join(stages_dir, f"{n}_{name}.json")))["outputs"]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--resume"); ap.add_argument("--from", dest="frm", choices=ORDER[1:])
    ap.add_argument("--fixture", default=os.path.join(EVALS, "fixture")); ap.add_argument("--as-of"); ap.add_argument("--compare-to")
    ap.add_argument("--cutoff-at"); ap.add_argument("--procore-sync"); ap.add_argument("--mailbox-sync")
    args = ap.parse_args()
    cfg = yaml.safe_load(open(os.path.join(HERE, "config.yaml")))
    fx = os.path.abspath(args.fixture); fy = os.path.join(fx, "harness_fixture.yaml")
    # per-fixture settings (iteration 3): CLI > <fixture>/harness_fixture.yaml > derived from the fixture; nothing project-specific in config.yaml
    cfg["fixture"] = fixture_settings(fx, yaml.safe_load(open(fy)) if os.path.exists(fy) else None,
                                      {"as_of": args.as_of, "compare_to": args.compare_to, "cutoff_at": args.cutoff_at,
                                       "procore_last_sync": args.procore_sync, "mailbox_last_sync": args.mailbox_sync})
    print(f"fixture settings: { {k: v for k, v in cfg['fixture'].items() if k != '_sources'} } sources={cfg['fixture']['_sources']}", flush=True)
    os.makedirs(RUNS, exist_ok=True)
    def is_full(d):
        p = os.path.join(RUNS, d, "run_manifest.json")
        return os.path.exists(p) and json.load(open(p)).get("kind", "full") == "full"
    done = [d for d in os.listdir(RUNS) if is_full(d)]
    if not args.resume and len(done) >= cfg["cost"]["max_full_runs"] and not os.environ.get("HARNESS_MOCK_DIR"):
        sys.exit(f"max_full_runs={cfg['cost']['max_full_runs']} reached ({done}); refusing to start another full run")
    start = ORDER.index(args.frm) if args.resume else 0
    run_id = dt.datetime.now().strftime("%Y%m%d-%H%M%S") + ("-resume-" + args.frm if args.resume else "")
    run_dir = os.path.join(RUNS, run_id); os.makedirs(run_dir)
    R = Runner(cfg, run_dir, RUNS); audit = []
    T = FixtureTools(str(cfg["fixture"]["as_of"]), str(cfg["fixture"]["compare_to"]), audit=audit, fixture_dir=fx)
    manifest = {"run_id": run_id, "model_spec": R.spec, "started_at": dt.datetime.now().isoformat(timespec="seconds"), "fictional_fixture": True,
                "routing_privacy_block": R.model.routing_block() if hasattr(R.model, "routing_block") else None,
                "design": "iteration2: rules->candidates->clusters (LLM per cluster)->S7->code rank->verify->writer (wording)->code assembly",
                "fixture_dir": fx, "fixture_settings": cfg["fixture"], "as_of": str(cfg["fixture"]["as_of"]), "compare_to": str(cfg["fixture"]["compare_to"]), "stages": ORDER, "kind": "resume" if args.resume else "full",
                "resumed_from": os.path.abspath(args.resume) if args.resume else None, "executed_stages": ORDER[start:]}
    json.dump(manifest, open(os.path.join(run_dir, "run_manifest.json"), "w"), indent=1)
    manifest["spend_before"] = spend(run_dir, "spend_before.json"); print("spend before:", manifest["spend_before"], flush=True)
    status = "ok"
    try:
        sd = os.path.join(args.resume, "stages") if args.resume else None
        def memo(n, name):   # resume: earlier steps' saved outputs are reused verbatim (copied into this run for provenance)
            out = load_stage(sd, n, name); json.dump(json.load(open(os.path.join(sd, f"{n}_{name}.json"))),
                                                     open(os.path.join(run_dir, "stages", f"{n}_{name}.json"), "w"), indent=1, ensure_ascii=False)
            return out
        os.makedirs(os.path.join(run_dir, "stages"), exist_ok=True)
        if start > 0: read_out = memo(1, "read")
        else: read_out, A = read.run(T, cfg);                        save(run_dir, 1, "read", [], read_out, A)
        # email/RFI facts EXTRACTION (model; cached by input hash, so mock/replay runs reuse it at $0); JUDGMENT happens in rules
        from .email_facts import attach as _attach_facts
        facts_summary = _attach_facts(T, runner=None if os.environ.get("MODEL", "").startswith("mock:") or os.environ.get("FACTS_CACHE_ONLY") else R)
        print(f"  [facts] {({k: v for k, v in facts_summary.items() if k != 'facts_dropped'})} dropped={len(facts_summary['facts_dropped'])}", flush=True)
        if start > 1: rules_out = memo(2, "rules")
        else:
            rules_out, A = rules.run(T); rules_out["facts_summary"] = facts_summary
            rules_out["email_facts"] = getattr(T, "email_facts", {}); rules_out["rfi_facts"] = getattr(T, "rfi_facts", {})
            save(run_dir, 2, "rules", [], rules_out, A)
        if start > 2: rank_out = memo(3, "rank")
        else: rank_out, A = rank.run(T, R, cfg, read_out, rules_out); save(run_dir, 3, "rank", ["1_read", "2_rules"], rank_out, A)
        if start > 3: verify_out = memo(4, "verify")
        else: verify_out, A = verify.run(T, read_out, rules_out, rank_out); save(run_dir, 4, "verify", ["1_read", "2_rules", "3_rank"], verify_out, A)
        deliver_out, A = deliver.run(T, R, cfg, read_out, rules_out, rank_out, verify_out, run_id, run_dir)
        save(run_dir, 5, "deliver", ["1_read", "2_rules", "3_rank", "4_verify"], deliver_out, A)
        score(run_dir, deliver_out["brief_path"], fx)
    except BudgetExceeded as e:
        status = f"aborted_budget: {e}"; print("ABORT:", e, flush=True)
    except Exception as e:
        import traceback; traceback.print_exc(); status = f"error: {e.__class__.__name__}: {e}"
    finally:
        json.dump(audit, open(os.path.join(run_dir, "tool_calls_audit.json"), "w"), indent=1)
        usage = {"calls": R.calls, "totals": {"input_tokens": sum(c["usage"]["input_tokens"] for c in R.calls),
                 "output_tokens": sum(c["usage"]["output_tokens"] for c in R.calls),
                 "reasoning_tokens": sum(c["usage"]["reasoning_tokens"] or 0 for c in R.calls), "cost_usd_reported": round(R.cost(), 6)},
                 "ledger_total_all_runs_usd": round(R.guard.spent, 6), "hard_cap_usd": R.guard.cap}
        json.dump(usage, open(os.path.join(run_dir, "usage_cost.json"), "w"), indent=1)
        manifest.update({"finished_at": dt.datetime.now().isoformat(timespec="seconds"), "status": status, "run_cost_usd": round(R.cost(), 6),
                         "spend_after": spend(run_dir, "spend_after.json")})
        json.dump(manifest, open(os.path.join(run_dir, "run_manifest.json"), "w"), indent=1)
        print(f"run {run_id}: status={status} cost=${R.cost():.4f} ledger=${R.guard.spent:.4f} spend_after={manifest['spend_after']}", flush=True)

if __name__ == "__main__":
    main()
