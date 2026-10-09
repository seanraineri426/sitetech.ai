# SiteTech eval harness (v0.3, iteration 3): model pipeline for the Daily Project Brief

**Fixture only.** OpenRouter is approved for evals on the fictional Linden Yard fixture ONLY (CTO, 2026-10-06). No real customer or
Procore data is used anywhere.

> **Real pilot data must use the direct Anthropic adapter (`anthropic:<model>`, `providers/anthropic_direct.py`) under Anthropic's
> org-level Zero Data Retention agreement, NOT OpenRouter.** The OpenRouter route (Amazon Bedrock endpoint, `zdr:true`,
> `data_collection:"deny"`, Claude only, no fallbacks) is acceptable for the fictional fixture only. Switching is the single
> `model:` value in `config.yaml`; nothing else in the pipeline changes.

**Holdout.** `evals/holdout/` is the untouched pass/fail set: nothing in this harness reads it, and it was never opened or tuned against.
The harness takes `--fixture <dir>` so it can run on another project unchanged (see Run).

## Run
```bash
cd /workspace/sitetech/intelligence/evals
/tmp/stvenv/bin/pip install jsonschema pyyaml            # once (venv: python3 -m venv /tmp/stvenv)
/tmp/stvenv/bin/python harness/check_spend.py            # GET /api/v1/key: prints usage/limit only, never the key
/tmp/stvenv/bin/python harness/smoke_routing.py          # 16-token routing/privacy smoke test
/tmp/stvenv/bin/python -m harness.pipeline               # full run (five stages) on Linden Yard -> evals/runs/<timestamp>/
/tmp/stvenv/bin/python -m harness.pipeline --fixture <dir> [--as-of D --compare-to D --cutoff-at TS --procore-sync TS --mailbox-sync TS]
#   any project with the same layout. Run settings: CLI flags > <dir>/harness_fixture.yaml > derived from the fixture (as_of/compare_to
#   = run_date of m1/day2 / m1/day1 findings; sync/cutoff simulated as as_of+1 04:45 project time). project.json must have `timezone`,
#   `holidays` (may be empty) and, for notice deadlines, `notice_periods` (else every notice shows "deadline unknown, check the contract").
#   Scoring runs automatically when <dir>/expected_findings.json exists; standalone: score_brief.py <run>/brief_verified.json --fixture <dir>
#   A full run counts against cost.max_full_runs (config.yaml); raise it deliberately before running another fixture.
/tmp/stvenv/bin/python -m harness.tests_zero_cost        # zero-cost unit checks (SSE, contracts, S7 gate, ranker, verifier, scorer)
/tmp/stvenv/bin/python -m harness.tests_iter3            # synthetic scorer tests + notice guardrails + PM rules + de-hardcoding
# offline code-path test with canned responses (zero cost, never scored):
HARNESS_MOCK_DIR=/tmp/mock HARNESS_RUNS_DIR=/tmp/mockruns MODEL=mock:canned /tmp/stvenv/bin/python -m harness.pipeline
# resume (Inngest-style memoized steps; NOT a full run, not counted against max_full_runs): re-execute deliver only
/tmp/stvenv/bin/python -m harness.pipeline --resume runs/<ts or replay dir> --from deliver
# zero-cost replay of a past run's raw model responses through the current code:
/tmp/stvenv/bin/python harness/make_replay.py runs/<ts> /tmp/replay && HARNESS_MOCK_DIR=/tmp/replay HARNESS_RUNS_DIR=/tmp/replayruns MODEL=mock:replay /tmp/stvenv/bin/python -m harness.pipeline
```
`OPENROUTER_API_KEY` is read from the environment at call time. It is never printed, logged, or written (raw request records store
the routing/privacy block, model, and messages only; no headers).

## Email/RFI facts split (2026-10-09, CTO architecture decision)
Email and RFI text handling is two stages. **Extraction** (`email_facts.py`, prompts `email_facts_extractor.md` / `rfi_facts_extractor.md`):
the model turns each email into structured facts (kind, item, spec/submittal/RFI/CE no, old/new date incl. relative + range, delay days,
amount, notice_types, sender_party = project_parties label, verbatim quote, confidence) and each RFI into answer-scope / site-condition
facts; strict JSON schema; outputs cached in `evals/fact_cache/` by input hash (re-scoring and mock replays are $0). **Judgment**
(`fact_rules.py`, code): joins facts to records (submittal no -> `schedule_activity_id`, RFI no, spec, record links; name-only = "possible
schedule impact, confirm activity", no $), compares against the activity need date and total float, `$ = max(0, slip - float) x daily
delay cost`, zero-float slip with $ ranks #1 (`ranker.rank`), notices typed from facts with deadlines from configured periods only. Records
without cached facts keep the old code paths. New code rule `RFI-OVERDUE-NEAR-START` (open RFI past due / stated need date, linked activity
starts within 14 days or started). Pack suite: `python -m harness.tests_recall_pack` (see its README). Field list: `docs/email-facts-fields.md`.

## Iteration 3 (2026-10-06): what changed and why
| Change | Where |
|---|---|
| **Notice guardrails (CTO).** Response deadlines only from configured notice periods (`project.json.notice_periods`, mirror of `project_notice_periods`); no default days anywhere; no row → deadline null + "deadline unknown, check the contract"; UTC receipt → project tz; business days on `holidays`; forward/BCC source flag → "verify notice date"; the model only classifies + quotes (COMMS `formal_notice`), never a deadline; model notice-window requests rejected | `notices.py`, `impact.notice_window`, `candidates.py`, `ranker.verify_request/deadline_of`, `stages/rank.py` |
| **Legal-conclusion ban.** Claims with "rights waived", "claim accepted", "entitled", "time-barred", "liable", "breach", "notice was late"... dropped; brief sentences removed (record quotes exempt); reported as `legal_conclusions_removed` | `verifier.BANNED_LEGAL` |
| **PM rule 1:** every formal notice pinned (floor `notice_window`) with its computed response deadline in the item and its action | `ranker.floors`, `stages/deliver.py` |
| **PM rule 2:** submittal approved before a later design revision = one code-owned item per submittal, "approved before revision, confirm fabrication hold"; never merged | `stages/rank.code_item`, `context.CLUSTER_RT` |
| **PM rule 3:** COST-DIFFERING-SITE-CONDITION rule: own item, own exposure line (linked CE ROM), owner-notice flag from configured DSC periods (none in Linden → "deadline unknown, check the contract") | `rules_engine.dsc_rules`, `notices.for_site_condition` |
| **PM rule 4:** open owner decisions show the date they start/started blocking procurement or schedule | `stages/verify.materials` |
| **Task 1:** section entries and top items carry record facts (due date, days overdue, BIC, TF + schedule basis, slip basis, own $ lines); an RFI/log linked to a CE with a ROM carries its own `at_risk` line (totals still count it once: D3 amendment) | `stages/deliver.entry_facts`, `candidates.default_impacts`, `ranker.exposures` |
| **Task 2:** no-$ items rank below any $ item, then severity, then due date | `ranker.rank` |
| **Task 3:** generic scorer (required_elements, expected/forbidden label, trap scope, gated rank constraints, generic freshness, optional status items/ref index/reference ranking) + expected findings schema + synthetic tests | `../score_brief.py`, `../../schemas/expected_findings.schema.json`, `tests_iter3.py`, EVALS.md §3.1 |
| **Task 4:** no "TCO"/"XER"/fixture dates in code: milestone name from `key_milestones`, schedule-source label from the schedule update; per-fixture settings via CLI > `harness_fixture.yaml` > derived; coverage window offsets from the project tz | `fixture_tools.py`, `impact.py`, `stages/read.py`, `stages/rules.py`, `pipeline.py` |
| Unaddressed finding whose anchor record a model insight in the same cluster already cites is attached to that insight (no duplicate item) | `stages/rank.cluster_step` |

## Iteration 2 (2026-10-06): what changed and why
Run 2 failed mostly on **truncation** (reasoning tokens ate `max_tokens`; the correlator and comms outputs were lost) and on the model
doing jobs code does better (ranking, numbers, coverage). Iteration 2 moves every deterministic decision into code:

| Step | Who | What |
|---|---|---|
| rules | code (`rules_engine.py`) | M1 record findings + 24 M3 rules (schedule float/manpower/inspection/drawing-after-approval, contingency, CE, pay app, procurement quote expiry / PO / buyout, decisions, notice language), lifecycle vs compare-to |
| candidates | code (`candidates.py`) | **one candidate per finding**, with default S7 impacts where the record states the inputs (quote expiry → delay chain + escalation; manpower → shortfall; contingency; pay app) |
| clusters | code | union-find on shared records + explicit links → 12 issue clusters on Linden Yard (portfolio roll-ups such as contingency stay alone) |
| cluster analysts | LLM, one call per cluster, parallel | group findings into insights, cited claims, owner/action, optional scenario requests **with a verbatim basis quote**; every finding must be in an insight or `set_aside` with a reason |
| comms | LLM, one call | per-email booleans/decision/links/quote; **code** scores significance (spec §4.9) |
| S7 | code (`ranker.verify_request`) | a model scenario is accepted only if `basis_quote` is a verbatim substring of `basis_ref` and the slip is derivable from the quote (stated number, weeks×5 wd / ×7 cd, or a date difference) |
| rank | code (`ranker.rank`) | **PM rule** (overrides spec §5 where they differ): schedule $ = days of possible TCO slip × project daily delay cost (project.json), desc; tie → earlier deadline; then cost exposure (escalation + at-risk + payment risk + recognized once, D3); then the rest by deadline. Spec floors kept (critical_path, notice_window, owner_escalation), Signal cap, ≤7 |
| verify | code | claim checks (refs in the cluster's evidence pack, numbers grounded, freshness caps); dropped insights fall back to a code-worded insight; re-rank |
| writer | LLM, effort low | wording only (headline/body/action/done) for code-chosen items; sentences with ungrounded numbers removed in code |
| assemble + gate | code | status lines (templates), impact/score/owner/due/tag/delta/citations, sections, decisions, emails, action items; `verify_brief` gate (incl. ID-shaped-string scrub) |
| coverage | code | `coverage_report.json`: every high/critical finding is top / section / set aside with reason; `missing` must be empty |

**Truncation controls.** Per-agent output contracts (`contracts.py`, JSON Schema with per-field `maxLength`/`maxItems`) are shown to the
model, requested with `response_format: json_object`, clamped and validated in code, with one cheap repair call only if errors remain
(missing top-level arrays default to `[]` in code). SSE streaming (`openrouter.stream: true`) so long generations never hit idle read
timeouts; usage/cost come from the final chunk. Outputs are small by construction (one cluster per call), so `max_tokens` 12–16k leaves
>10× room for reasoning.
**Probe (runs/_probes/probe-20261006-195744.json, $0.0089):** `claude-sonnet-5.5` reasoning is **mandatory** on OpenRouter
(`GET /models`: `reasoning.mandatory=true`, efforts max/xhigh/high/medium/low, no "none"), so it cannot be turned off. `effort:"low"`
gave 0 reasoning tokens on an extraction probe; `reasoning.max_tokens:1024` gave 233. Strict `json_schema` response_format returns
HTTP 404 on the Bedrock endpoint (no `structured_outputs` param with `require_parameters:true`); `json_object` is accepted. Hence:
effort low for comms/writer/repair, medium for cluster analysts, json_object + code-side schema validation.
**Cost guard.** `run_cap_usd` (per run, entries tagged with run_id) plus `hard_cap_usd` over the whole ledger; a cap hit aborts the run
(never silently replaced by code fallbacks).
**Scorer.** The Kendall-tau crash in `evals/score_brief.py` is fixed in place (matched top items whose finding has no
`reference_rank` are skipped); `--fixture <dir>` added; `--json` output is pure JSON (GATE line on stderr). The patched copy is deleted.
`expected_findings.json` / `reference_ranking.json` untouched.

## Layout
| File | Role |
|---|---|
| `config.yaml` | **Single model switch** `model: "<adapter>:<model_id>"` (env `MODEL`, or `MODEL_PROVIDER`+`MODEL_ID`, overrides), routing/privacy, per-stage token / reasoning-effort / response_format, run cap $3 + ledger cap $8, max full runs, fixture constants |
| `providers/` | Provider-neutral `LanguageModel.generate_text()` (AI SDK shape) · `openrouter.py` (evals) · `anthropic_direct.py` (M2 pilot Messages API; ALLOW_ANTHROPIC_PILOT=1) · `mock.py` (offline tests) · registry `get_model(spec)` |
| `cost_guard.py` | Ledger `evals/runs/_spend_ledger.json`; reserves worst-case cost before each call, records OpenRouter `usage.cost` after; aborts over cap |
| `fixture_tools.py` | Tool layer answered from `evals/fixture/` files: agent-layer T0 tools from `tools/tool_schemas.json` + integrations `get_*` reads; per-agent allow-lists enforced; T1 not exposed; T2 return `disabled_in_v1`; every call audited |
| `impact.py` | S7 `compute_impact` (delay_chain, usd_sum, contingency, notice_window, ros_margin, payapp_earned, manpower_shortfall) on the project calendar |
| `context.py` | Context packing per agent; sanitized playbook (answer-key mapping removed); spec §5.1–5.3 only (the §5.4 worked fixture ranking is withheld); runtime contracts appended to the existing prompts |
| `verifier.py` | S8 code verifier for insight claims and for the final brief |
| `rules_engine.py`, `candidates.py` | Deterministic findings (M3 rules over any fixture) · candidates + default impacts · issue clusters |
| `contracts.py`, `packs.py` | Output contracts (JSON Schema with caps, clamp, validate) · per-cluster / comms evidence packs |
| `ranker.py` | S7 gate for model scenarios · exposure (schedule $ / cost $ with D3 dedupe) · PM-rule ranking, floors, Signal cap |
| `probe_reasoning.py`, `tests_zero_cost.py` | ~$0.01 reasoning/format probe · zero-cost unit checks |
| `llm_runner.py` | `Runner.llm()`: one model call = cost-guard reserve → adapter → raw record `raw/<stage>.json` → strict JSON parse → one repair pass |
| `stages/{read,rules,rank,verify,deliver}.py` | The five production stages (below); `stages/__init__.py` has the tier table, `Actions` (approval tier on every action) and `save()` |
| `pipeline.py` | Thin orchestrator: calls the five stages in order, saves each stage's output, then the eval-only `score` step, usage/cost and spend checks |
| `pipeline_legacy.py` | Monolithic orchestrator that produced runs `20261006-192551` and `20261006-192806` (kept for provenance; same logic, pre-split) |

## Five stages ↔ Inngest steps (CTO, 2026-10-06)
Each stage is a plain function `run(...) -> (outputs, actions)`. Its outputs are saved to `runs/<ts>/stages/<n>_<name>.json` as
`{stage, inputs_from, actions, outputs}` and are the **only** input the later stages read, so each maps 1:1 to
`await step.run('<name>', () => ...)` in an Inngest function (the saved JSON is the memoized step result). There is no workflow engine
or config language; the order lives in `pipeline.py` as five lines of code.

| # | Stage / Inngest step | Module | Inputs | Outputs | Actions (tier → approval) |
|---|---|---|---|---|---|
| 1 | `read` | `stages/read.py` | fixture (production: Procore/M365 sync) | freshness bands; per-agent packed T0 reads; shared context (project, records index, decisions register, contract terms, entity links) | `get_*` reads **T0** → none |
| 2 | `rules` | `stages/rules.py` | `read` data | findings (M1 + M3 rules) with lifecycle, candidates + default impacts, clusters, overdue rows, closed-since-last, status facts | reads **T0**; `upsert_findings` **T1** (recorded) |
| 3 | `rank` | `stages/rank.py` | `read`, `rules` | comms extraction (LLM) + code significance; per-cluster insights (LLM, parallel); S7 (code, quote-verified scenarios); code ranking; coverage pre-check | LLM calls → `save_insights` **T1** → none |
| 4 | `verify` | `stages/verify.py` | `read`, `rules`, `rank` | verified insights, per-claim verdicts, re-rank, decisions/emails materials, coverage | code checks **T0** → none |
| 5 | `deliver` | `stages/deliver.py` | `read`, `rules`, `rank`, `verify` | writer wording (LLM), code assembly, gate report, `brief_verified.json`, `brief_rendered.md`, `coverage_report.json` | writer **T1**; `save_brief` **T1**; `send_brief_email`/Slack **T2 → approval required, `disabled_in_v1`** (recorded, never executed) |
| – | `score` (eval only) | `pipeline.score` | `deliver` | `score_report.{json,txt}` | – |

Tiers: **T0** read (no approval) · **T1** internal write (no approval, audited) · **T2** external/irreversible (human approval; disabled in
v1, `Actions.add` returns False) · **T3** never (raises). Every action a stage takes is recorded with its tier in that stage's JSON.

## Pipeline detail, iteration 1 (runs 1-2; superseded by the iteration-2 table above, kept for provenance)
S0 freshness bands (code) → S3 findings = `fixture/m1/day2/findings.json` (rules layer) → S4 diff vs day 1 (`diff_snapshots`: finding lifecycle,
contingency, CE changes, float U1→U2) → **S5 five analysts** (LLM, parallel; existing prompts + `_shared_rules`) → **S6 correlator** (LLM; links
across sources and, in this eval, proposes the rank) → S7 `compute_impact` (code fulfils the correlator's `impact_request`s) → S8a claim verifier
(code) → **S9 brief writer** (LLM, closed book; sees only verified insights + code-built section rows) → S8b brief verifier (code) → render with
`examples/render_brief.py` → score with `evals/score_brief.py`. (S0 + reads = `read`; S3/S4 = `rules`; S5–S7 = `rank`; S8a = `verify`;
S9 + S8b + render = `deliver`.)

**Design choice: context packing, not model-driven function calling.** The orchestrator (code) calls each agent's allow-listed T0 tools with
fixed arguments and packs the results into the agent's message. Why: (1) the whole fixture fits in ~10–15k tokens per analyst, so there is
nothing to search; (2) deterministic and reproducible inputs make eval deltas attributable to prompts/models, not to tool-call variance;
(3) one round trip per stage (cost and latency predictable; the $5 cap is easy to guarantee); (4) the architecture already has models
*request* numbers (`impact_request`) and code compute them (S7), so a tool loop adds nothing for the brief. The same `FixtureTools.call()`
dispatcher (allow-list + tier checks + audit) is what a function-calling loop would use, so the M3 chat orchestrator can switch to
AI SDK tool calling without changing the tool layer.

## Verifier (plain code)
Claims: ≥1 citation; every ref matches the schema pattern and resolves in the fixture data (index built from fixture records, not from the
answer key); numbers in claim text must appear in the cited records / their findings / the code impacts (else downgraded, `value_mismatch`);
weather-blame text is dropped when the weather log shows no delay; schedule-only claims capped at Likely while the XER is aging.
Brief: citations must resolve **and** come from verified claims or code-built rows; units left with no citation are dropped; ≤ 7 top items;
WORSE needs `delta_text`; overdue-row numbers, email sender/time/subject, freshness, coverage, closed list and metrics are overwritten from
code; word count is recomputed by code (status lines + top headlines + bodies + actions); JSON Schema validated; one writer repair pass on
schema errors or > 700 words, then deterministic body trimming as a last resort.

## Robustness rules learned from runs 1–2
- `parse_json` takes the **outermost** object only; a truncated answer raises instead of silently returning a nested fragment
  (run 2 lost the whole correlator and comms output this way).
- `finish_reason == "length"` → `salvage_truncated()` keeps complete items only, closes brackets, and adds a gap; no model repair call.
- Read timeouts are never retried (`openrouter.timeout_s`, default 1800s): the server keeps generating and billing the first attempt.
- `reasoning.max_tokens` is **not** a hard cap on Bedrock-served Claude (4k budget → 11–20k reasoning tokens seen), so `max_tokens`
  must leave room for reasoning + answer; per-agent overrides live in `config.yaml stages`.
- Brief verifier also scrubs ref-shaped strings outside `ref` fields (e.g. `gaps[].source: "procore:rfi:41"`).
- Scoring: `pipeline.score()` runs `evals/score_brief.py` (crash fixed in place in iteration 2; no patched copy).
- Verifier number parsing (iteration 2): a k/M suffix must be attached ("1500 manpower" was read as 1.5e9) and digits glued to an ID
  (A1500, PO-0117, CE-031) are not quantities.

## Privacy and routing (sent on every OpenRouter request)
`provider: {order:[slug], only:[slug], allow_fallbacks:false, data_collection:"deny", zdr:true, require_parameters:true}`; model pinned to
`anthropic/*` (the adapter refuses anything else; no `models` fallback array). Field names verified 2026-10-06 against
openrouter.ai/docs/features/provider-routing and /docs/features/zdr.
**Finding:** `only:["anthropic"]` + `zdr:true` is unsatisfiable today: OpenRouter's ZDR endpoint list (`GET /api/v1/endpoints/zdr`) has no
first-party Anthropic endpoint for any Claude model, and the request fails with HTTP 404 "No endpoints found matching your data policy
(Zero data retention)". Because ZDR/no-training are non-negotiable, the eval routes the same pinned Claude model to the ZDR-listed
**Amazon Bedrock** endpoint, single provider, no fallbacks. To pin first-party Anthropic you must drop ZDR on OpenRouter (not allowed) or use
the direct Anthropic adapter with an org-level ZDR agreement (the pilot path).
**Account settings (Sean, cannot be verified from the API):** OpenRouter account-level prompt/input logging must be OFF in
Settings → Privacy, and ideally the account-level ZDR toggles ON as a second guard.

## Porting to the Vercel AI SDK (production)
- `config.yaml model` ↔ `createProviderRegistry({ openrouter, anthropic }).languageModel('openrouter:anthropic/claude-sonnet-5.5')`.
- `LanguageModel.generate_text(system, messages, max_tokens, reasoning_max_tokens)` ↔ `generateText({ model, system, messages, maxOutputTokens,
  providerOptions })`. OpenRouter routing/privacy go in `providerOptions.openrouter.provider` (with `@openrouter/ai-sdk-provider`);
  reasoning budget ↔ `providerOptions.openrouter.reasoning` or `providerOptions.anthropic.thinking.budgetTokens` on the direct provider.
- Result fields ↔ `result.text`, `result.usage.{inputTokens,outputTokens,reasoningTokens}`, `result.providerMetadata.openrouter.usage.cost`.
- Prompts are plain markdown (`prompts/*.md` + runtime contract strings in `context.py`): load as `system` strings unchanged.
- Output contracts: today parsed from text; in TS use `generateObject({ schema })` with Zod/JSON Schema from `schemas/brief.schema.json`
  (AnalystOutput / CorrelatedInsight schemas should be extracted from the prompt files into JSON Schema first).
- Tools: `tools/tool_schemas.json` is MCP/OpenAI-compatible (`name`, `description`, `inputSchema`) → `tool({ description, inputSchema:
  jsonSchema(t.inputSchema), execute })`, filtered by `x-agent-allowlists[agent]` and `x-tier == 'T0'` (+ T1 for internal writes),
  with `disabled_in_v1` tools omitted. `FixtureTools.call()` mirrors that filter.
