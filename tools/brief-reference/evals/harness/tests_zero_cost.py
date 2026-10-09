"""Zero-cost checks for iteration 2 (no network, no model). Run from evals/: /tmp/stvenv/bin/python -m harness.tests_zero_cost
Covers: SSE stream assembly, contract clamp/validate, S7 model-scenario gate, PM-rule ranker, verifier number parsing, verify_brief on the
saved iteration-1 writer output (ID-shaped-string scrub kept), the fixed scorer on saved briefs."""
import json, os, subprocess, sys, copy
from .fixture_tools import FixtureTools
from .providers.openrouter import OpenRouterModel
from .contracts import CLUSTER, clamp, validate
from .ranker import verify_request, rank
from .verifier import nums, verify_brief
EVALS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok = lambda c, m: print(("PASS " if c else "FAIL ") + m) or c
res = []
# 1 SSE
lines = [b": OPENROUTER PROCESSING\n", b"\n", b'data: {"id":"g1","model":"anthropic/claude","provider":"Amazon Bedrock","choices":[{"delta":{"content":"{\\"a\\":"}}]}\n',
         b": OPENROUTER PROCESSING\n", b'data: {"choices":[{"delta":{"content":"1}"},"finish_reason":"stop"}]}\n',
         b'data: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":3,"cost":0.0001}}\n', b"data: [DONE]\n"]
o = OpenRouterModel._read_stream(lines)
res.append(ok(o["choices"][0]["message"]["content"] == '{"a":1}' and o["usage"]["cost"] == 0.0001 and o["provider"] == "Amazon Bedrock", "SSE assembly with keep-alives + usage chunk"))
# 2 clamp
log = []; x = clamp({"cluster_id": "C1", "insights": [{"key": "k", "headline": "x" * 400, "zzz": 1}] * 9, "set_aside": [], "proposed_links": [], "gaps": []}, CLUSTER, log=log)
res.append(ok(len(x["insights"]) == 6 and len(x["insights"][0]["headline"]) <= 150 and "zzz" not in x["insights"][0], f"clamp caps arrays/strings, drops unknown fields ({len(log)} fixes)"))
# 3 S7 gate
T = FixtureTools(); E = "msgraph_outlook:message:msg_E104"; allowed = {E, "p6:activity:A1225"}
good = {"type": "delay_chain", "params": {"slip_cd": 14, "anchor_date": "2026-11-09", "activity_ids": ["A1225"]}, "inputs_refs": ["p6:activity:A1225"], "basis_ref": E,
        "basis_quote": "pushes delivery of the transfer steel from Nov 9 to approximately Nov 23"}
r, v = verify_request(T, good, allowed); res.append(ok(r and r["milestone_cd"] > 0 and v["status"] == "accepted", f"S7 accepts quote-derivable slip (14 cd) -> {r and r['delay_usd']}"))
bad = dict(good, params={"slip_wd": 25, "activity_ids": ["A1225"]}); r, v = verify_request(T, bad, allowed); res.append(ok(r is None, "S7 rejects slip not derivable from quote: " + v.get("reason", "")[:60]))
bad = dict(good, basis_quote="delivery slips two months"); r, v = verify_request(T, bad, allowed); res.append(ok(r is None, "S7 rejects non-verbatim quote"))
bad = dict(good, basis_ref="msgraph_outlook:message:msg_E101"); r, v = verify_request(T, bad, allowed); res.append(ok(r is None, "S7 rejects basis_ref outside the cluster pack"))
# 4 ranker (PM rule): schedule $ first (desc), tie -> earlier deadline; then cost $; then the rest; floors pull into top 7
F = {f"f{i}": {"finding_id": f"f{i}", "rule_id": "SCH-X", "severity": "high", "citations": []} for i in range(12)}
F["fc"] = {"finding_id": "fc", "rule_id": "COST-CONTINGENCY-BURN", "severity": "critical", "citations": []}
mk = lambda k, sched=0, cost=0, dl=None, fid=None: {"key": k, "finding_ids": [fid or "f0"], "confidence": "Likely", "decision_deadline_verified": {"date": dl, "kind": "x"} if dl else None,
    "impacts": ([{"type": "delay_chain", "delay_usd": sched, "milestone_cd": sched // 16000, "tf_ref_wd": 1}] if sched else []) + ([{"type": "usd_sum", "kind": "payment_risk", "total_usd": cost}] if cost else [])}
ins = [mk("cost_big", cost=500000), mk("sched_small", sched=80000), mk("sched_big_late", sched=224000, dl="2026-10-20"), mk("sched_big_early", sched=224000, dl="2026-10-09"),
       mk("none_a", dl="2026-10-07")] + [mk(f"filler{i}", cost=1000 * i) for i in range(1, 6)] + [mk("contingency", fid="fc")]
top, order = rank(T, ins, F)
res.append(ok(order[:5] == ["sched_big_early", "sched_big_late", "sched_small", "cost_big", "filler5"] and "contingency" in top and len(top) == 7,
              f"PM rule order {order[:5]}; floor keeps contingency in top: {top}"))
# 5 number parsing
res.append(ok([n[1] for n in nums("A1500 manpower 6 vs 16; PO-0117 by 10/9 costs $224,000 or $145k; 92.4%")] == [6, 16, 10, 224000, 145000, 92.4], "verifier nums ignores IDs and word-initial k/m"))
# 6 verify_brief replay on saved iteration-1 writer output (zero cost)
sd = os.path.join(EVALS, "runs", "20261006-195143-resume-deliver", "stages")
if os.path.isdir(sd):
    d = json.load(open(os.path.join(sd, "5_deliver.json")))["outputs"]; raw = copy.deepcopy(d["writer_raw"])
    raw.setdefault("gaps", []).append({"source": "procore:rfi:41", "reason": "leak test", "effect": ""})
    rows = json.load(open(os.path.join(sd, "2_rules.json")))["outputs"]["record_rows"]
    allowed = {r for r in json.dumps(raw).split('"') if T.resolvable(r)}
    det = {k: v for k, v in d["brief"].items() if k not in ("status", "top_items", "sections", "watching", "gaps")}
    b, rep = verify_brief(raw, T, allowed, det, rows)
    res.append(ok("procore:rfi:41" in rep["unresolvable_ref_strings_in_text"] and not rep["invented_refs_after"], "verify_brief scrubs ID-shaped unresolvable strings (saved writer output + injected leak)"))
# 7 fixed scorer on saved briefs (no crash, valid JSON)
for b in ["20261006-195143-resume-deliver", "20261006-192806"]:
    p = os.path.join(EVALS, "runs", b, "brief_verified.json")
    if os.path.exists(p):
        sc = subprocess.run([sys.executable, os.path.join(EVALS, "score_brief.py"), p, "--json"], capture_output=True, text=True)
        try: s = json.loads(sc.stdout)["summary"]; res.append(ok(True, f"scorer on {b}: recall {s['recall_must_surface']} tau {s['kendall_tau_vs_reference']}"))
        except Exception as e: res.append(ok(False, f"scorer on {b}: {e} {sc.stderr[-300:]}"))

# 8 Anthropic direct adapter (mocked HTTP; no live call, no key required for gate/mapping tests)
from .providers import get_model, ProviderError
from .providers.anthropic_direct import AnthropicDirectModel, _normalize_messages, _finish_reason, _uses_adaptive_thinking
res.append(ok(get_model("anthropic:claude-sonnet-5-5", {"cost": {"est_prompt_usd_per_token": 2e-6, "est_completion_usd_per_token": 1e-5},
                                                          "anthropic": {"base_url": "https://api.anthropic.com/v1"}}).provider_id == "anthropic",
              "get_model('anthropic:claude-sonnet-5-5') resolves AnthropicDirectModel"))
m = AnthropicDirectModel("claude-sonnet-5-5", {"base_url": "https://api.anthropic.com/v1", "stream": False})
try:
    m.generate_text(system="s", messages=[{"role": "user", "content": "hi"}], max_tokens=16)
    res.append(ok(False, "anthropic refuses without ALLOW_ANTHROPIC_PILOT=1"))
except ProviderError as e:
    res.append(ok("ALLOW_ANTHROPIC_PILOT" in str(e), "anthropic hard-gates on ALLOW_ANTHROPIC_PILOT"))
os.environ["ALLOW_ANTHROPIC_PILOT"] = "1"
try:
    m.generate_text(system="s", messages=[{"role": "user", "content": "hi"}], max_tokens=16)
    res.append(ok(False, "anthropic refuses without API key when ALLOW set"))
except ProviderError as e:
    res.append(ok("ANTHROPIC_API_KEY" in str(e), "anthropic requires ANTHROPIC_API_KEY after ALLOW"))
finally:
    os.environ.pop("ALLOW_ANTHROPIC_PILOT", None)
thinking, oc, suf = m._thinking_and_output_config(max_tokens=8000, reasoning_effort="low", reasoning_max_tokens=None,
                                                   response_format={"type": "json_object"})
res.append(ok(thinking == {"type": "adaptive"} and oc and oc.get("effort") == "low" and "JSON object" in suf,
              "sonnet-5-5: adaptive thinking + effort + json_object system suffix"))
m45 = AnthropicDirectModel("claude-sonnet-4-5", {})
th2, oc2, _ = m45._thinking_and_output_config(max_tokens=8000, reasoning_effort="medium", reasoning_max_tokens=None, response_format=None)
res.append(ok(th2 and th2.get("type") == "enabled" and th2.get("budget_tokens") == 4096 and oc2 is None,
              "sonnet-4-5: effort maps to extended-thinking budget_tokens"))
th3, _, _ = m45._thinking_and_output_config(max_tokens=5000, reasoning_effort=None, reasoning_max_tokens=4000, response_format=None)
res.append(ok(th3 == {"type": "enabled", "budget_tokens": 4000}, "reasoning_max_tokens -> budget_tokens"))
_, oc3, _ = m._thinking_and_output_config(max_tokens=1000, reasoning_effort=None, reasoning_max_tokens=None,
                                          response_format={"type": "json_schema", "schema": {"type": "object", "properties": {"a": {"type": "number"}}}})
res.append(ok(oc3 and oc3.get("format", {}).get("type") == "json_schema", "json_schema -> output_config.format"))
res.append(ok(_normalize_messages([{"role": "system", "content": "x"}, {"role": "user", "content": "y"}]) == [{"role": "user", "content": "y"}],
              "system role stripped from messages[]"))
res.append(ok(_finish_reason("end_turn") == "stop" and _finish_reason("max_tokens") == "length", "stop_reason mapping"))
res.append(ok(_uses_adaptive_thinking("claude-sonnet-5-5") and not _uses_adaptive_thinking("claude-sonnet-4-5"),
              "adaptive vs extended model detection"))
# Mocked HTTP: monkeypatch urlopen; still no real network
class _FakeResp:
    def __init__(self, payload): self._payload = payload
    def __enter__(self): return self
    def __exit__(self, *a): pass
    def read(self): return json.dumps(self._payload).encode()
fake = {"id": "msg_test", "type": "message", "role": "assistant", "model": "claude-sonnet-5-5",
        "content": [{"type": "thinking", "thinking": "plan", "signature": "sig"},
                    {"type": "text", "text": '{"ok":true}'}],
        "stop_reason": "end_turn",
        "usage": {"input_tokens": 12, "output_tokens": 8, "cache_read_input_tokens": 2,
                  "output_tokens_details": {"thinking_tokens": 3}}}
import urllib.request as _ur
_orig = _ur.urlopen
os.environ["ALLOW_ANTHROPIC_PILOT"] = "1"
os.environ["ANTHROPIC_API_KEY"] = "sk-ant-test-not-real"
try:
    captured = {}
    def _fake_urlopen(req, timeout=None):
        captured["url"] = req.full_url
        captured["headers"] = {k.lower(): v for k, v in req.header_items()}
        captured["body"] = json.loads(req.data.decode())
        # never echo key into assertions beyond presence
        return _FakeResp(fake)
    _ur.urlopen = _fake_urlopen
    r = m.generate_text(system="SYS", messages=[{"role": "user", "content": "hi"}], max_tokens=100,
                        reasoning_effort="low", response_format={"type": "json_object"}, stream=False)
    hdrs = captured["headers"]
    body = captured["body"]
    res.append(ok(captured["url"].endswith("/messages") and "x-api-key" in hdrs and hdrs.get("anthropic-version") == "2023-06-01",
                  "POST /v1/messages with x-api-key + anthropic-version"))
    res.append(ok(body.get("system", "").startswith("SYS") and "JSON object" in body.get("system", "") and body["messages"] == [{"role": "user", "content": "hi"}]
                  and body["max_tokens"] == 100 and body.get("thinking", {}).get("type") == "adaptive"
                  and (body.get("output_config") or {}).get("effort") == "low",
                  "request maps system/messages/max_tokens/thinking/effort"))
    res.append(ok(r.text == '{"ok":true}' and r.finish_reason == "stop" and r.served_by == "anthropic"
                  and r.usage.input_tokens == 12 and r.usage.output_tokens == 8 and r.usage.reasoning_tokens == 3
                  and r.usage.cached_input_tokens == 2 and r.usage.cost_usd is not None and r.usage.cost_usd > 0
                  and "sk-ant" not in json.dumps(r.request_meta) and "sk-ant" not in json.dumps(r.provider_metadata),
                  "response text/usage/cost; key never in metadata"))
    # SSE assembly
    sse = [b'event: message_start\n',
           b'data: {"type":"message_start","message":{"id":"msg_s","type":"message","role":"assistant","content":[],"model":"claude-sonnet-5-5","usage":{"input_tokens":5,"output_tokens":0}}}\n',
           b'\n',
           b'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n',
           b'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"{\\"a\\":"}}\n',
           b'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"1}"}}\n',
           b'data: {"type":"content_block_stop","index":0}\n',
           b'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":4}}\n',
           b'data: {"type":"message_stop"}\n']
    assembled = AnthropicDirectModel._read_stream(sse)
    res.append(ok(assembled["content"][0]["text"] == '{"a":1}' and assembled["stop_reason"] == "end_turn"
                  and assembled["usage"].get("input_tokens") == 5 and assembled["usage"].get("output_tokens") == 4,
                  "Anthropic SSE assembly"))
finally:
    _ur.urlopen = _orig
    os.environ.pop("ALLOW_ANTHROPIC_PILOT", None)
    os.environ.pop("ANTHROPIC_API_KEY", None)


print(f"{sum(res)}/{len(res)} passed"); sys.exit(0 if all(res) else 1)
