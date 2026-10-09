# Pilot model path: direct Anthropic ZDR vs Bedrock in our AWS

**Audience:** SiteTech CTO · **Before:** M2 / real pilot data · **Date:** 2026-10-06

For the real pilot (never OpenRouter), two paths both keep customer project data off third-party training and can meet a written zero-retention bar: **(A) direct Anthropic** under an org ZDR agreement, calling the Messages API from our app with `ANTHROPIC_API_KEY`, or **(B) Claude on Amazon Bedrock in our own AWS account** with Bedrock’s no-training / account-scoped logging controls. Direct Anthropic is the shorter path to ship (one vendor, one key, the same Messages shape our Vercel AI SDK swap already targets, and ZDR is contractual rather than a per-request routing flag), but it depends on Anthropic confirming ZDR in writing for our org and leaves data-plane telemetry mostly on Anthropic’s side. Bedrock puts inference inside our AWS boundary (VPC endpoints, IAM, CloudTrail, our region choice, and clearer SOC 2 evidence later), at the cost of Bedrock model IDs, IAM/network setup, and slightly different request/response mapping—ops we already proved workable in evals when OpenRouter could only satisfy ZDR via Bedrock. OpenRouter stays **evals-only** on fictional fixtures (current setup: `zdr:true`, `data_collection:deny`, `provider.only: amazon-bedrock`, no fallbacks); it must not touch pilot data.

**Recommendation for M2 pilot:** prefer **direct Anthropic with written ZDR** as the default production path (implement the existing `anthropic:` provider stub), and keep **Bedrock in our AWS** as the fallback if Anthropic ZDR paperwork slips or a customer/contract requires data to stay in our AWS account. Do not use OpenRouter for pilot or production data.

---

**CTO decision (2026-10-06):** Approved. M2 pilot default is direct Anthropic with written ZDR (finish the `anthropic:` provider stub). Bedrock in our AWS is the fallback if ZDR paperwork slips or a customer needs data in our account. OpenRouter stays evals-only on fixtures — never pilot or production data. Before any real project data touches Anthropic: confirm ZDR in writing for our org, and set a spend cap on that key ($50 pattern). Keep the provider behind the AI SDK–shaped swap so flipping to Bedrock is still one config change.


---

## Implementation status (2026-10-06)

`evals/harness/providers/anthropic_direct.py` implements `AnthropicDirectModel.generate_text` against the Anthropic Messages API (`POST /v1/messages`, headers `x-api-key` + `anthropic-version`). Same `LanguageModel` call shape as OpenRouter (`system`, `messages`, `max_tokens`, `reasoning_effort` / `reasoning_max_tokens`, `response_format`, optional `stream`). Registry: `get_model("anthropic:claude-sonnet-5-5", cfg)`.

| Concern | Behavior |
| --- | --- |
| system / messages / max_tokens | Top-level `system`; `messages` (user/assistant); `max_tokens` |
| reasoning | Adaptive models (e.g. `claude-sonnet-5-5`): `thinking.type=adaptive` + `output_config.effort`. Extended-thinking models (e.g. `claude-sonnet-4-5`): `thinking.type=enabled` + `budget_tokens` from `reasoning_max_tokens` or an effort→budget table |
| `response_format: json_object` | Anthropic has no OpenAI-style json_object mode — system suffix instructs JSON-only; `llm_runner` already embeds the schema in the system prompt (same production shape). `json_schema` maps to `output_config.format` when a schema is present |
| usage / cost | Token usage from the response; `cost_usd` from a local price table (API does not return USD) |
| Safety | Live HTTP refused unless `ALLOW_ANTHROPIC_PILOT=1`. Evals stay on `openrouter:*`. No Anthropic call required in CI |
| Streaming | SSE assembled to the non-streaming Message shape (default `stream: true`) |

### How to flip providers

```yaml
# config.yaml — single switch (env MODEL overrides)
model: "openrouter:anthropic/claude-sonnet-5.5"   # evals / fictional fixture ONLY
model: "anthropic:claude-sonnet-5-5"              # M2 pilot (direct Anthropic ZDR)
# model: "bedrock:<bedrock-model-id>"             # future fallback in our AWS (adapter not landed yet)
```

Pilot live call also needs: `ALLOW_ANTHROPIC_PILOT=1` and `ANTHROPIC_API_KEY` (never commit / never log).

### Remaining blockers before real / pilot project data

1. **Written ZDR confirmation** for our Anthropic org (contractual; not a request field).
2. **$50 spend cap** on the Anthropic API key (console / billing limit).
3. **`ANTHROPIC_API_KEY` via secret box** when Sean is ready — then set `ALLOW_ANTHROPIC_PILOT=1` only for intentional pilot runs.

Until those three clear: do not call Anthropic with real or pilot project data. Fixture evals continue on OpenRouter.
