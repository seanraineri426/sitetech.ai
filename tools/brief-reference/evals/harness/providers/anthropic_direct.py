"""Direct Anthropic Messages API adapter for the M2 pilot path (real project data under written org ZDR).

Drop-in: set config.yaml `model: "anthropic:<model-id>"` (e.g. anthropic:claude-sonnet-5-5) or env MODEL.
The pipeline only calls LanguageModel.generate_text(); nothing else changes.

Evals stay on openrouter:* (fictional fixture / ZDR via amazon-bedrock). Do NOT flip the default
config model to anthropic for CI or fixture evals — that would route pilot-path code at OpenRouter-budget
data and needs ALLOW_ANTHROPIC_PILOT=1 plus a real key.

Live HTTP calls require ALLOW_ANTHROPIC_PILOT=1. ANTHROPIC_API_KEY is read at call time and never logged.
ZDR is contractual (org agreement), not a request field — confirm in writing before real data.

API: POST {base_url}/messages  headers: x-api-key, anthropic-version, content-type
  system              -> top-level `system`
  messages            -> `messages` (user/assistant only)
  max_tokens          -> `max_tokens`
  reasoning_max_tokens-> thinking {type:enabled, budget_tokens}  (Sonnet 4.5 / extended-thinking models)
  reasoning_effort    -> thinking {type:adaptive} + output_config.effort  (Sonnet 5.5+ / adaptive models);
                         on extended-thinking-only models, effort maps to a budget_tokens table
  response_format
    json_object       -> instruct in system (Anthropic has no OpenAI-style json_object mode);
                         llm_runner already puts the schema in the system prompt
    json_schema       -> output_config.format {type:json_schema, schema:...} when a schema is present
  usage               -> Usage(input/output/...); cost_usd from local PRICE_PER_TOKEN (API returns no USD)
"""
from __future__ import annotations

import json, os, time, urllib.error, urllib.request
from typing import Any, Optional
from .base import LanguageModel, GenerateResult, Usage, ProviderError

ANTHROPIC_VERSION_DEFAULT = "2023-06-01"

# USD per token (input, output). Messages API does not return cost; keep in sync with
# https://platform.claude.com/docs/en/about-claude/pricing (checked 2026-10-06).
PRICE_PER_TOKEN = {
    "claude-sonnet-5-5": (0.000002, 0.00001),
    "claude-sonnet-5": (0.000002, 0.00001),
    "claude-sonnet-4-6": (0.000003, 0.000015),
    "claude-sonnet-4-5": (0.000003, 0.000015),
    "claude-sonnet-4-5-20250929": (0.000003, 0.000015),
    "claude-haiku-4-5": (0.000001, 0.000005),
    "claude-haiku-4-5-20251001": (0.000001, 0.000005),
    "claude-opus-4-5": (0.000005, 0.000025),
    "claude-opus-4-5-20251101": (0.000005, 0.000025),
    "claude-opus-4-6": (0.000005, 0.000025),
}

# OpenRouter-style effort -> extended-thinking budget (min API budget is 1024).
EFFORT_BUDGET = {"low": 1024, "medium": 4096, "high": 8192, "xhigh": 16000, "max": 16000}

# Models that use adaptive thinking (effort via output_config). Others get budget_tokens.
_ADAPTIVE_MARKERS = ("-5-5", "-5.", "sonnet-5", "opus-5", "fable-5", "mythos-5", "sonnet-4-6", "opus-4-6", "opus-4-7", "opus-4-8")


def _uses_adaptive_thinking(model_id: str) -> bool:
    m = (model_id or "").lower()
    return any(tok in m for tok in _ADAPTIVE_MARKERS)


def _price_for(model_id: str, fallback: tuple) -> tuple:
    if model_id in PRICE_PER_TOKEN:
        return PRICE_PER_TOKEN[model_id]
    # prefix match (dated ids, aliases)
    for k, v in PRICE_PER_TOKEN.items():
        if model_id.startswith(k):
            return v
    return fallback


def _finish_reason(stop_reason: Optional[str]) -> Optional[str]:
    if stop_reason is None:
        return None
    return {"end_turn": "stop", "max_tokens": "length", "stop_sequence": "stop",
            "tool_use": "tool_calls", "pause_turn": "stop", "refusal": "content_filter"}.get(stop_reason, stop_reason)


def _normalize_messages(messages: list) -> list:
    """Anthropic messages[] is user/assistant only; system belongs at top-level."""
    out = []
    for m in messages or []:
        role = m.get("role")
        if role == "system":
            continue
        if role not in ("user", "assistant"):
            raise ProviderError(f"anthropic messages role must be user|assistant, got {role!r}")
        out.append({"role": role, "content": m.get("content", "")})
    return out


class AnthropicDirectModel(LanguageModel):
    provider_id = "anthropic"

    def __init__(self, model_id: str, cfg: dict, est_prices=(0.000002, 0.00001)):
        self.model_id = model_id
        self.cfg = cfg or {}
        self.base_url = self.cfg.get("base_url", "https://api.anthropic.com/v1").rstrip("/")
        self.timeout_s = int(self.cfg.get("timeout_s", 1800))
        self.api_version = self.cfg.get("anthropic_version", ANTHROPIC_VERSION_DEFAULT)
        self._est = est_prices

    def price_per_token(self):
        return _price_for(self.model_id, self._est)

    def _thinking_and_output_config(self, *, max_tokens: int, reasoning_effort, reasoning_max_tokens, response_format):
        """Build thinking + output_config fragments. Returns (thinking|None, output_config|None, system_suffix)."""
        thinking = None
        output_config: dict = {}
        system_suffix = ""

        if reasoning_max_tokens:
            budget = int(reasoning_max_tokens)
            budget = max(1024, budget)
            if budget >= max_tokens:
                budget = max(1024, max_tokens - 1)
            thinking = {"type": "enabled", "budget_tokens": budget}
        elif reasoning_effort:
            effort = str(reasoning_effort).lower()
            if _uses_adaptive_thinking(self.model_id):
                thinking = {"type": "adaptive"}
                output_config["effort"] = effort
            else:
                budget = EFFORT_BUDGET.get(effort, 4096)
                budget = max(1024, min(budget, max_tokens - 1))
                thinking = {"type": "enabled", "budget_tokens": budget}

        # Structured output: no OpenAI json_object; instruct in system. json_schema -> output_config.format.
        if response_format:
            rtype = (response_format or {}).get("type")
            if rtype == "json_schema":
                schema = response_format.get("schema") or (response_format.get("json_schema") or {}).get("schema")
                if schema:
                    output_config["format"] = {"type": "json_schema", "schema": schema}
                else:
                    system_suffix = ("\n\nRespond with one JSON object only. No markdown fences, no prose before or after the object.")
            elif rtype == "json_object":
                # Production path matches llm_runner: schema lives in the system prompt; we reinforce JSON-only output.
                system_suffix = ("\n\nRespond with one JSON object only. No markdown fences, no prose before or after the object.")

        return thinking, (output_config or None), system_suffix

    def generate_text(self, *, system, messages, max_tokens, reasoning_effort=None, reasoning_max_tokens=None,
                      response_format=None, trace=None, stream=None):
        if os.environ.get("ALLOW_ANTHROPIC_PILOT") != "1":
            raise ProviderError(
                "direct Anthropic is the M2 pilot path only; set ALLOW_ANTHROPIC_PILOT=1 to enable live calls. "
                "Fixture evals must keep model: openrouter:anthropic/... (see docs/pilot-model-path.md). "
                "Blockers before real data: written ZDR, $50 spend cap on the key, ANTHROPIC_API_KEY in secret box."
            )
        key_env = self.cfg.get("api_key_env", "ANTHROPIC_API_KEY")
        key = os.environ.get(key_env)
        if not key:
            raise ProviderError(f"{key_env} not set")

        stream = self.cfg.get("stream", True) if stream is None else stream
        thinking, output_config, sys_suffix = self._thinking_and_output_config(
            max_tokens=max_tokens, reasoning_effort=reasoning_effort,
            reasoning_max_tokens=reasoning_max_tokens, response_format=response_format)

        sys_text = (system or "") + sys_suffix
        body: dict[str, Any] = {
            "model": self.model_id,
            "max_tokens": int(max_tokens),
            "messages": _normalize_messages(messages),
            "stream": bool(stream),
        }
        if sys_text:
            body["system"] = sys_text
        if thinking:
            body["thinking"] = thinking
        if output_config:
            body["output_config"] = output_config

        request_meta = {
            "model": body["model"], "max_tokens": max_tokens, "stream": bool(stream),
            "thinking": body.get("thinking"),
            "output_config": {k: (v if k != "format" else {"type": (v or {}).get("type")})
                              for k, v in (output_config or {}).items()} if output_config else None,
            "response_format": (response_format or {}).get("type"),
            "adapter": "anthropic_direct",
            # ZDR is org-level, not a request field — recorded for the audit log.
            "zdr": "org_agreement_required",
        }

        # Never put the key into request_meta, logs, or exceptions beyond a bool presence check.
        req = urllib.request.Request(
            self.base_url + "/messages",
            data=json.dumps(body).encode(),
            method="POST",
            headers={
                "x-api-key": key,
                "anthropic-version": self.api_version,
                "Content-Type": "application/json",
            },
        )
        last = None
        data = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=self.timeout_s) as r:
                    data = self._read_stream(r) if stream else json.loads(r.read().decode())
                break
            except urllib.error.HTTPError as e:
                msg = e.read().decode(errors="replace")[:2000]
                last = ProviderError(f"HTTP {e.code}: {msg}")
                if e.code in (429, 500, 502, 503, 504) and attempt < 2:
                    time.sleep(5 * (attempt + 1))
                    continue
                raise last
            except (urllib.error.URLError, TimeoutError) as e:
                last = ProviderError(f"network: {e}")
                if isinstance(e, TimeoutError) or "timed out" in str(e):
                    raise last
                if attempt < 2:
                    time.sleep(5 * (attempt + 1))
                    continue
                raise last
        if data is None:
            raise last or ProviderError("no response")
        if data.get("type") == "error" or "error" in data:
            raise ProviderError(f"api error: {json.dumps(data.get('error') or data)[:2000]}")

        text_parts = []
        reasoning_chars = 0
        for block in data.get("content") or []:
            btype = block.get("type")
            if btype == "text":
                text_parts.append(block.get("text") or "")
            elif btype == "thinking":
                reasoning_chars += len(block.get("thinking") or "")

        u = data.get("usage") or {}
        in_tok = int(u.get("input_tokens") or 0)
        out_tok = int(u.get("output_tokens") or 0)
        details = u.get("output_tokens_details") or {}
        reasoning_tok = int(details.get("thinking_tokens") or 0)
        cached = int(u.get("cache_read_input_tokens") or 0)
        pin, pout = self.price_per_token()
        cost = round(in_tok * pin + out_tok * pout, 6)
        usage = Usage(input_tokens=in_tok, output_tokens=out_tok, reasoning_tokens=reasoning_tok,
                      cached_input_tokens=cached, cost_usd=cost)
        return GenerateResult(
            text="".join(text_parts),
            usage=usage,
            finish_reason=_finish_reason(data.get("stop_reason")),
            model_id=data.get("model") or self.model_id,
            served_by="anthropic",
            provider_metadata={"id": data.get("id"), "usage": u, "stop_reason": data.get("stop_reason"),
                               "reasoning_chars": reasoning_chars},
            request_meta=request_meta,
            raw_response={k: v for k, v in data.items() if k != "content"},
        )

    @staticmethod
    def _read_stream(r):
        """Assemble Anthropic SSE message stream into the non-streaming Message shape."""
        out: dict[str, Any] = {"content": [], "usage": {}, "stop_reason": None, "model": None, "id": None, "type": "message"}
        # index -> accumulating block
        blocks: dict[int, dict] = {}
        for raw in r:
            line = raw.decode("utf-8", errors="replace").strip()
            if not line or line.startswith(":") or not line.startswith("data:"):
                continue
            payload = line[5:].strip()
            if payload == "[DONE]":
                break
            try:
                ev = json.loads(payload)
            except json.JSONDecodeError:
                continue
            et = ev.get("type")
            if et == "error":
                return {"type": "error", "error": ev.get("error") or ev}
            if et == "message_start":
                msg = ev.get("message") or {}
                for k in ("id", "model", "role", "type"):
                    if msg.get(k) is not None:
                        out[k] = msg[k]
                if msg.get("usage"):
                    out["usage"] = dict(msg["usage"])
            elif et == "content_block_start":
                idx = ev["index"]
                block = dict(ev.get("content_block") or {})
                blocks[idx] = block
            elif et == "content_block_delta":
                idx = ev["index"]
                delta = ev.get("delta") or {}
                block = blocks.setdefault(idx, {"type": delta.get("type", "text")})
                dtype = delta.get("type")
                if dtype == "text_delta":
                    block["type"] = "text"
                    block["text"] = (block.get("text") or "") + (delta.get("text") or "")
                elif dtype == "thinking_delta":
                    block["type"] = "thinking"
                    block["thinking"] = (block.get("thinking") or "") + (delta.get("thinking") or "")
                elif dtype == "signature_delta":
                    block["signature"] = (block.get("signature") or "") + (delta.get("signature") or "")
            elif et == "content_block_stop":
                idx = ev.get("index")
                if idx in blocks:
                    out["content"].append(blocks[idx])
            elif et == "message_delta":
                delta = ev.get("delta") or {}
                if delta.get("stop_reason") is not None:
                    out["stop_reason"] = delta["stop_reason"]
                if ev.get("usage"):
                    # message_delta usage is typically output_tokens (cumulative); merge.
                    out["usage"] = {**out.get("usage", {}), **ev["usage"]}
            elif et == "message_stop":
                break
        # Preserve content order by index if any blocks were left without stop (defensive).
        if not out["content"] and blocks:
            out["content"] = [blocks[i] for i in sorted(blocks)]
        return out
