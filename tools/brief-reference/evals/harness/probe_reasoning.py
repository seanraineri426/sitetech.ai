#!/usr/bin/env python3
"""~$0.05 probe (fictional toy prompt): which reasoning controls and output-format controls the routed endpoint honours.
Variants: effort=low; reasoning.max_tokens=1024; enabled=false (expected reject: reasoning is mandatory for this model);
response_format json_schema; all streamed. Records to the spend ledger as run_id=probe-<ts>. Writes runs/_probes/<ts>.json."""
import json, os, sys, time, datetime as dt, yaml
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from harness.providers import get_model, resolve_model_spec, ProviderError
from harness.cost_guard import CostGuard, estimate_cost
HERE = os.path.dirname(os.path.abspath(__file__)); cfg = yaml.safe_load(open(os.path.join(HERE, "config.yaml")))
m = get_model(resolve_model_spec(cfg), cfg)
rid = "probe-" + dt.datetime.now().strftime("%Y%m%d-%H%M%S")
g = CostGuard(os.path.join(HERE, "..", "runs", "_spend_ledger.json"), cfg["cost"]["hard_cap_usd"], run_id=rid, run_cap_usd=0.10)
SYS = "You extract facts from fictional construction records. Output JSON only."
USER = ("Records (FICTIONAL): RFI 42 open, due 2026-09-29, ball in court Raj Mehta. Submittal 05 12 00-003 rev 1 due 2026-10-01, "
        "with Raj Mehta. Email from fabricator: needs approved drawings by 2026-10-09 to hold the Oct 12 shop slot, else next slot Oct 26. "
        'Return {"items":[{"ref":"...","fact":"<=20 words"}], "deadline":"YYYY-MM-DD"} with 3 items.')
SCHEMA = {"type": "json_schema", "json_schema": {"name": "probe", "strict": True, "schema": {
    "type": "object", "additionalProperties": False, "required": ["items", "deadline"],
    "properties": {"items": {"type": "array", "items": {"type": "object", "additionalProperties": False, "required": ["ref", "fact"],
                                                         "properties": {"ref": {"type": "string"}, "fact": {"type": "string"}}}},
                   "deadline": {"type": "string"}}}}}
V = [("effort_low", dict(reasoning_effort="low")),
     ("budget_1024", dict(reasoning_max_tokens=1024)),
     ("effort_low_json_schema", dict(reasoning_effort="low", response_format=SCHEMA)),
     ("effort_low_json_object", dict(reasoning_effort="low", response_format={"type": "json_object"}))]
out = []
for name, kw in V:
    msgs = [{"role": "user", "content": USER}]; est = estimate_cost(m, SYS, msgs, 1500); g.reserve(est, name); t0 = time.time()
    try:
        r = m.generate_text(system=SYS, messages=msgs, max_tokens=1500, trace={"stage": name}, **kw)
        g.record(est, {"run_id": rid, "stage": name, "served_by": r.served_by, "cost_usd": r.usage.cost_usd, "in": r.usage.input_tokens, "out": r.usage.output_tokens})
        try: json.loads(r.text.strip().strip("`").removeprefix("json")); ok = True
        except Exception: ok = False
        row = {"variant": name, "ok": True, "served_by": r.served_by, "finish": r.finish_reason, "out_tokens": r.usage.output_tokens,
               "reasoning_tokens": r.usage.reasoning_tokens, "visible_tokens": r.usage.output_tokens - r.usage.reasoning_tokens,
               "cost": r.usage.cost_usd, "json_parses": ok, "latency_s": round(time.time() - t0, 1), "text": r.text[:400], "request": r.request_meta}
    except ProviderError as e:
        g.record(est, {"run_id": rid, "stage": name, "error": str(e)[:300], "cost_usd": 0.0})
        row = {"variant": name, "ok": False, "error": str(e)[:600]}
    print(json.dumps({k: v for k, v in row.items() if k not in ("text", "request")})); out.append(row)
os.makedirs(os.path.join(HERE, "..", "runs", "_probes"), exist_ok=True)
json.dump(out, open(os.path.join(HERE, "..", "runs", "_probes", rid + ".json"), "w"), indent=1)
print("probe spend $%.4f" % g.run_spent)
