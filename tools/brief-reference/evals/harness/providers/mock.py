"""Offline mock adapter (zero cost) used ONLY to exercise the code paths (parsing, S7, verifier, render, score) before a paid run.
Canned responses are keyed by trace stage and read from HARNESS_MOCK_DIR/<stage>.json (raw text). Never used for scored results."""
import os, json
from .base import LanguageModel, GenerateResult, Usage

class MockModel(LanguageModel):
    provider_id = "mock"
    def __init__(self, model_id, cfg, est_prices=(0, 0)): self.model_id = model_id; self._est = est_prices
    def price_per_token(self): return (0.0, 0.0)
    def generate_text(self, *, system, messages, max_tokens, trace=None, **kw):
        stage = (trace or {}).get("stage", "")
        p = os.path.join(os.environ["HARNESS_MOCK_DIR"], stage + ".json")
        txt = open(p).read() if os.path.exists(p) else ""
        mp = os.path.join(os.environ["HARNESS_MOCK_DIR"], stage + ".meta.json")   # replay: original finish_reason
        fin = json.load(open(mp)).get("finish_reason", "stop") if os.path.exists(mp) else "stop"
        return GenerateResult(text=txt, usage=Usage(10, 10, 0, 0, 0.0), finish_reason=fin, model_id="mock", served_by="mock",
                              request_meta={"mock": True})
