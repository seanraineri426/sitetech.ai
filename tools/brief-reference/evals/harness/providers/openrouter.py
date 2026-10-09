"""OpenRouter adapter (evals on the FICTIONAL fixture only). Every request carries the routing/privacy block below.
Fields verified 2026-10-06 against https://openrouter.ai/docs/features/provider-routing and https://openrouter.ai/docs/features/zdr:
  provider.order / provider.only (string[] provider slugs), provider.allow_fallbacks (bool), provider.require_parameters (bool),
  provider.data_collection ("allow"|"deny"), provider.zdr (bool).
The API key is read from OPENROUTER_API_KEY at call time and is never printed, logged, or written."""
import json, os, time, urllib.request, urllib.error
from .base import LanguageModel, GenerateResult, Usage, ProviderError


class OpenRouterModel(LanguageModel):
    provider_id = "openrouter"

    def __init__(self, model_id: str, cfg: dict, est_prices=(0.000002, 0.00001)):
        if not model_id.startswith("anthropic/"):
            raise ProviderError(f"eval policy: model must be pinned to Anthropic Claude, got {model_id}")
        self.model_id = model_id
        self.cfg = cfg
        self.base_url = cfg.get("base_url", "https://openrouter.ai/api/v1")
        self.timeout_s = int(cfg.get("timeout_s", 1800))   # long reasoning calls took up to ~17 min (non-streaming)
        self._est = est_prices

    def routing_block(self) -> dict:
        only = list(self.cfg["provider_only"])
        block = {"order": only, "only": only, "allow_fallbacks": bool(self.cfg["allow_fallbacks"]),
                 "data_collection": self.cfg["data_collection"], "zdr": bool(self.cfg["zdr"]),
                 "require_parameters": bool(self.cfg.get("require_parameters", True))}
        # Hard assertions: privacy fields can never be silently dropped or weakened by config edits.
        assert block["data_collection"] == "deny" and block["zdr"] is True and block["allow_fallbacks"] is False, \
            "privacy/routing policy violated in config"
        return block

    def price_per_token(self):
        return self._est

    def generate_text(self, *, system, messages, max_tokens, reasoning_effort=None, reasoning_max_tokens=None, response_format=None,
                      trace=None, stream=None):
        """reasoning: claude-sonnet-5.5 has MANDATORY reasoning on OpenRouter (GET /api/v1/models: reasoning.mandatory=true,
        efforts max..low, no 'none'), so it cannot be turned off; we send effort or a max_tokens budget (see probe_reasoning.py).
        stream=True uses SSE so long generations never hit an idle read timeout; usage/cost arrive in the final chunk."""
        key = os.environ.get("OPENROUTER_API_KEY")
        if not key:
            raise ProviderError("OPENROUTER_API_KEY not set")
        stream = self.cfg.get("stream", True) if stream is None else stream
        body = {"model": self.model_id, "messages": [{"role": "system", "content": system}] + messages,
                "max_tokens": max_tokens, "provider": self.routing_block(), "stream": bool(stream)}
        if reasoning_max_tokens:
            body["reasoning"] = {"max_tokens": int(reasoning_max_tokens), "exclude": True}
        elif reasoning_effort:
            body["reasoning"] = {"effort": reasoning_effort, "exclude": True}
        if response_format:
            body["response_format"] = response_format
        if stream:
            body["usage"] = {"include": True}
        request_meta = {"model": body["model"], "provider": body["provider"], "max_tokens": max_tokens, "stream": bool(stream),
                        "reasoning": body.get("reasoning"), "response_format": (response_format or {}).get("type")}
        req = urllib.request.Request(self.base_url + "/chat/completions", data=json.dumps(body).encode(), method="POST",
                                     headers={"Authorization": "Bearer " + key, "Content-Type": "application/json",
                                              "X-Title": "SiteTech eval harness (fictional fixture)"})
        last = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=self.timeout_s) as r:
                    data = self._read_stream(r) if stream else json.loads(r.read().decode())
                break
            except urllib.error.HTTPError as e:
                msg = e.read().decode(errors="replace")[:2000]
                last = ProviderError(f"HTTP {e.code}: {msg}")
                if e.code in (429, 500, 502, 503, 504) and attempt < 2:
                    time.sleep(5 * (attempt + 1)); continue
                raise last
            except (urllib.error.URLError, TimeoutError) as e:
                last = ProviderError(f"network: {e}")
                # Do NOT retry a read timeout: the first generation keeps running (and billing) server-side, so a retry double-bills
                # outside the ledger (seen in run 20261006-192806: correlator timed out at 600s and was retried). Retry connect errors only.
                if isinstance(e, TimeoutError) or "timed out" in str(e):
                    raise last
                if attempt < 2:
                    time.sleep(5 * (attempt + 1)); continue
                raise last
        if "error" in data:
            raise ProviderError(f"api error: {json.dumps(data['error'])[:2000]}")
        ch = data["choices"][0]
        u = data.get("usage") or {}
        usage = Usage(input_tokens=u.get("prompt_tokens", 0), output_tokens=u.get("completion_tokens", 0),
                      reasoning_tokens=(u.get("completion_tokens_details") or {}).get("reasoning_tokens", 0) or 0,
                      cached_input_tokens=(u.get("prompt_tokens_details") or {}).get("cached_tokens", 0) or 0,
                      cost_usd=u.get("cost"))
        return GenerateResult(text=ch["message"].get("content") or "", usage=usage, finish_reason=ch.get("finish_reason"),
                              model_id=data.get("model"), served_by=data.get("provider"),
                              provider_metadata={"id": data.get("id"), "usage": u}, request_meta=request_meta,
                              raw_response={k: v for k, v in data.items() if k != "choices"})

    @staticmethod
    def _read_stream(r):
        """Assemble an SSE chat-completions stream into the non-streaming response shape."""
        text, out = [], {"choices": [{"message": {"content": ""}, "finish_reason": None}]}
        for raw in r:
            line = raw.decode("utf-8", errors="replace").strip()
            if not line or line.startswith(":") or not line.startswith("data:"):
                continue                      # keep-alive comments (": OPENROUTER PROCESSING")
            payload = line[5:].strip()
            if payload == "[DONE]":
                break
            ev = json.loads(payload)
            if "error" in ev:
                return {"error": ev["error"]}
            for k in ("id", "model", "provider"):
                if ev.get(k): out[k] = ev[k]
            if ev.get("usage"): out["usage"] = ev["usage"]
            for c in ev.get("choices") or []:
                d = c.get("delta") or {}
                if d.get("content"): text.append(d["content"])
                if c.get("finish_reason"): out["choices"][0]["finish_reason"] = c["finish_reason"]
        out["choices"][0]["message"]["content"] = "".join(text)
        return out
