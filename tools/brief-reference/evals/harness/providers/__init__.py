"""Provider registry: one config value selects adapter + model, like AI SDK's createProviderRegistry().languageModel('id')."""
import os
from .base import LanguageModel, GenerateResult, Usage, ProviderError
from .openrouter import OpenRouterModel
from .anthropic_direct import AnthropicDirectModel
from .mock import MockModel

ADAPTERS = {"openrouter": OpenRouterModel, "anthropic": AnthropicDirectModel, "mock": MockModel}


def resolve_model_spec(cfg: dict) -> str:
    if os.environ.get("MODEL"):
        return os.environ["MODEL"]
    if os.environ.get("MODEL_PROVIDER") and os.environ.get("MODEL_ID"):
        return f'{os.environ["MODEL_PROVIDER"]}:{os.environ["MODEL_ID"]}'
    return cfg["model"]


def get_model(spec: str, cfg: dict) -> LanguageModel:
    adapter, _, model_id = spec.partition(":")
    if adapter not in ADAPTERS:
        raise ProviderError(f"unknown adapter {adapter}")
    est = (cfg["cost"]["est_prompt_usd_per_token"], cfg["cost"]["est_completion_usd_per_token"])
    return ADAPTERS[adapter](model_id, cfg.get(adapter, {}), est)
