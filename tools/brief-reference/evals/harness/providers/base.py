"""Provider-neutral LLM interface. Mirrors the Vercel AI SDK shape so the production TypeScript layer can port 1:1:
   AI SDK:   const model = registry.languageModel('openrouter:anthropic/claude-sonnet-5.5')
             const r = await generateText({ model, system, messages, maxOutputTokens, providerOptions })
             r.text, r.usage {inputTokens, outputTokens}, r.providerMetadata, r.response
   Here:     model = get_model('openrouter:anthropic/claude-sonnet-5.5'); r = model.generate_text(system=..., messages=..., ...)
The pipeline only ever talks to LanguageModel.generate_text(); swapping providers is a config change (config.yaml `model`)."""
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    reasoning_tokens: int = 0
    cached_input_tokens: int = 0
    cost_usd: Optional[float] = None  # provider-reported cost when available (OpenRouter usage.cost)


@dataclass
class GenerateResult:
    text: str
    usage: Usage
    finish_reason: Optional[str] = None
    model_id: Optional[str] = None            # model that actually served the request
    served_by: Optional[str] = None           # upstream provider that served it (OpenRouter `provider`)
    provider_metadata: dict = field(default_factory=dict)
    request_meta: dict = field(default_factory=dict)  # non-secret request fields (routing/privacy) for the audit log
    raw_response: Any = None


class LanguageModel:
    """Adapter contract. Implementations must not log or persist credentials."""
    provider_id: str = "base"
    model_id: str = ""

    def generate_text(self, *, system: str, messages: list, max_tokens: int, reasoning_effort: Optional[str] = None,
                      reasoning_max_tokens: Optional[int] = None,
                      response_format: Optional[dict] = None, trace: Optional[dict] = None, stream: Optional[bool] = None) -> GenerateResult:
        raise NotImplementedError

    def price_per_token(self) -> tuple:
        """(prompt_usd_per_token, completion_usd_per_token) for pre-call cost estimates."""
        raise NotImplementedError


class ProviderError(RuntimeError):
    pass
