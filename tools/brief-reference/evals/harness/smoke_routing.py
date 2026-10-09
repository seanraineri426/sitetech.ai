#!/usr/bin/env python3
"""Tiny routing smoke test (max_tokens 5): proves the pinned model + routing/privacy block is accepted before a full run."""
import json, os, sys, yaml
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from harness.providers import get_model, resolve_model_spec, ProviderError
from harness.cost_guard import CostGuard, estimate_cost
HERE = os.path.dirname(os.path.abspath(__file__)); cfg = yaml.safe_load(open(os.path.join(HERE, "config.yaml")))
if len(sys.argv) > 1: cfg["openrouter"]["provider_only"] = sys.argv[1].split(",")
m = get_model(resolve_model_spec(cfg), cfg)
g = CostGuard(os.path.join(HERE, "..", "runs", "_spend_ledger.json"), cfg["cost"]["hard_cap_usd"])
sysmsg, msgs = "Reply with the single word OK.", [{"role": "user", "content": "ping (fictional eval smoke test)"}]
est = estimate_cost(m, sysmsg, msgs, 16); g.reserve(est, "smoke")
try:
    r = m.generate_text(system=sysmsg, messages=msgs, max_tokens=16)
    g.record(est, {"stage": "smoke_routing", "served_by": r.served_by, "model": r.model_id, "cost_usd": r.usage.cost_usd,
                   "in": r.usage.input_tokens, "out": r.usage.output_tokens})
    print(json.dumps({"ok": True, "served_by": r.served_by, "model": r.model_id, "text": r.text, "cost": r.usage.cost_usd,
                      "request_provider_block": r.request_meta["provider"]}))
except ProviderError as e:
    g.record(est, {"stage": "smoke_routing", "error": str(e)[:300], "cost_usd": 0.0})
    print(json.dumps({"ok": False, "error": str(e)[:1500], "provider_only": cfg["openrouter"]["provider_only"]}))
