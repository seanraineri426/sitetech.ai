"""LLM call wrapper shared by the rank and deliver stages: cost guard (reserve worst case -> record usage.cost), raw request/response
record per call (no credentials), JSON parsing with one syntax-repair call."""
import json, os, re, time, hashlib
from .providers import get_model, resolve_model_spec, ProviderError
from .cost_guard import CostGuard, estimate_cost

def parse_json(text):
    """Parse the model's JSON answer. The top-level object must start at the first '{' (prose before it is tolerated).
    If that outermost object does not decode (e.g. output truncated at max_tokens) we RAISE so the caller runs a repair
    pass, instead of silently returning some smaller nested object (bug seen in run 20261006-192806: the truncated comms
    analyst output was parsed as an inner object, losing all candidates)."""
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t); t = re.sub(r"\s*```\s*$", "", t)
    i = t.find("{")
    if i < 0: raise ValueError("no JSON object in response")
    try: obj, _ = json.JSONDecoder().raw_decode(t[i:])
    except json.JSONDecodeError as e: raise ValueError(f"top-level JSON object does not decode (truncated?): {e}")
    if not isinstance(obj, dict): raise ValueError("top-level JSON is not an object")
    return obj

def salvage_truncated(text):
    """Recover the complete part of a JSON object cut off at max_tokens: cut after the last COMPLETE member of the top-level
    object or the last complete element of a top-level array member, then close the open brackets. Deterministic, adds nothing."""
    t = text[text.find("{"):]
    stack, in_str, esc, cut = [], False, False, None
    for i, ch in enumerate(t):
        if in_str:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == '"': in_str = False
            continue
        if ch == '"': in_str = True
        elif ch in "{[": stack.append(ch)
        elif ch in "}]":
            stack.pop()
            if not stack: return json.loads(t[:i + 1])
        elif ch == "," and (len(stack) == 1 or (len(stack) == 2 and stack[1] == "[")):
            cut = (i, list(stack))
    if cut is None: raise ValueError("nothing salvageable")
    i, st = cut
    return json.loads(t[:i] + "".join("}" if c == "{" else "]" for c in reversed(st)))

class Runner:
    def __init__(self, cfg, run_dir, runs_root):
        self.cfg = cfg; self.dir = run_dir; os.makedirs(os.path.join(run_dir, "raw"), exist_ok=True)
        self.spec = resolve_model_spec(cfg); self.model = get_model(self.spec, cfg)
        self.guard = CostGuard(os.path.join(runs_root, "_spend_ledger.json"), cfg["cost"]["hard_cap_usd"],
                               run_id=os.path.basename(run_dir), run_cap_usd=cfg["cost"].get("run_cap_usd"))
        self.calls = []; self.run_id = os.path.basename(run_dir)

    def cost(self): return sum((c["usage"]["cost_usd"] or 0) for c in self.calls)

    def llm_contract(self, stage, system, user_obj, stage_cfg, schema):
        """Structured call: response_format json_object + schema in the prompt; parse (salvage if truncated); clamp per-field caps;
        validate. If errors remain, one cheap repair call (effort low) listing the errors; result is clamped/validated again.
        Returns (obj, report)."""
        from .contracts import clamp, validate, prompt_schema
        sysmsg = system + "\n\n## Output contract (overrides any output format described above)\nReturn ONE JSON object that validates against this JSON Schema (maxLength / maxItems are hard caps; " \
                 "stay well under them):\n" + prompt_schema(schema)
        obj = self.llm(stage, sysmsg, user_obj, stage_cfg)
        rep = {"stage": stage, "clamped": [], "errors_first": [], "repaired": False, "truncated": bool(isinstance(obj, dict) and obj.get("_truncated_salvaged"))}
        trunc = obj.pop("_truncated_salvaged", None) if isinstance(obj, dict) else None
        if isinstance(obj, dict):   # missing top-level arrays (e.g. after truncation salvage) default to [] in code, no paid repair for that
            for k, sp in schema.get("properties", {}).items():
                if k not in obj and sp.get("type") == "array": obj[k] = []; rep["clamped"].append({"path": k, "fix": "missing array -> []"})
        obj = clamp(obj, schema, "", rep["clamped"]); errs = validate(obj, schema); rep["errors_first"] = errs[:30]
        if errs and stage_cfg.get("repair", True):
            try:
                fix = self.llm(stage + "__repair", "You fix JSON to satisfy a schema. Change only what the listed errors require; never add facts, refs or "
                               "numbers; drop an invalid array item rather than invent content. Output JSON only.",
                               {"errors": errs[:30], "schema": schema, "json": obj}, {**self.cfg["stages"]["repair"], "response_format": {"type": "json_object"}})
                obj2 = clamp(fix, schema, "", rep["clamped"]); errs2 = validate(obj2, schema)
                if len(errs2) < len(errs): obj, errs = obj2, errs2; rep["repaired"] = True
            except Exception as e:
                rep["repair_error"] = str(e)[:300]
        rep["errors_final"] = errs[:30]
        if trunc: rep["truncated_detail"] = trunc
        return obj, rep

    def llm(self, stage, system, user_obj, stage_cfg, parse=True):
        user = json.dumps(user_obj, ensure_ascii=False, separators=(",", ":")) if not isinstance(user_obj, str) else user_obj
        msgs = [{"role": "user", "content": user}]
        mt = stage_cfg["max_tokens"]; est = estimate_cost(self.model, system, msgs, mt)
        self.guard.reserve(est, stage); t0 = time.time()
        try:
            r = self.model.generate_text(system=system, messages=msgs, max_tokens=mt, reasoning_effort=stage_cfg.get("reasoning_effort"),
                                         reasoning_max_tokens=stage_cfg.get("reasoning_max_tokens"), response_format=stage_cfg.get("response_format"),
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
              f"({rec['latency_s']}s) | run spend ${self.cost():.4f}", flush=True)
        if not parse: return r.text
        if not r.text.strip():
            raise ValueError(f"{stage}: empty response text (finish={r.finish_reason}; reasoning_tokens={u.reasoning_tokens})")
        try:
            return parse_json(r.text)
        except Exception as e:
            if r.finish_reason == "length":
                # truncated at max_tokens: a repair call cannot restore missing content, so keep the complete part and disclose it
                obj = salvage_truncated(r.text)
                kept = {k: len(v) for k, v in obj.items() if isinstance(v, list)}
                obj["_truncated_salvaged"] = {"finish_reason": "length", "kept_items": kept}
                obj.setdefault("gaps", []); obj["gaps"] = list(obj["gaps"]) + [
                    f"{stage} output was truncated at max_tokens; only complete items were kept ({kept}); later items are missing"]
                print(f"  [{stage}] truncated output salvaged: {kept}", flush=True)
                return obj
            print(f"  [{stage}] JSON parse failed ({e}); one repair call", flush=True)
            fix = self.llm(stage + "__json_repair", "Return the user's content as ONE valid JSON object. Fix syntax only (close brackets, "
                           "escape quotes, drop trailing prose). Do not add, remove, or change any facts. Output JSON only.",
                           r.text[-60000:], self.cfg["stages"]["repair"], parse=False)
            return parse_json(fix)
