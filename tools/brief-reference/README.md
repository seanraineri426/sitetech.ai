# SiteTech Intelligence Layer: MVP Daily Project Brief

Owner: AI and Agent Systems Engineer · v0.1 · 2026-10-06
This folder holds the reasoning layer that turns synced project records into a cited, ranked Daily Project Brief. It **builds on** the integrations engineer's `get_*` tools (documented in `tools/tool_schemas.json`) and the CTO's stack (Next.js + Supabase + Vercel, Procore DMSA, Microsoft Graph, Inngest, a model-agnostic LLM layer). **All example and fixture data is fictional.**

## Money Representation

**Python (this reference implementation):** Dollar amounts use whole-dollar floats (e.g., `42000.0` = $42,000).  
**TypeScript (production port):** Dollar amounts will use integer cents (e.g., `4200000` = $42,000.00) to avoid floating-point precision issues.

**Core idea in one line:** *rules find, models connect, code checks.* Deterministic rules write a `findings` table (record IDs plus `days_overdue`). Models rank and connect findings into insights. A verifier drops any claim that lacks a resolvable record ID. Then a closed-book writer and a deterministic renderer produce the page.

## Index

### Design documents
| File | What it is |
|---|---|
| `ARCHITECTURE.md` | Full design: givens and ownership; the "Palantir for GCs and developers" mapping; data model and link keys; ingestion and freshness; entity resolution with Mode A (approved) / Mode B (fallback) and the accuracy-loss table; memory; Inngest functions; agent roster and contracts; the S0–S10 pipeline; model routing; tiers T0–T3 and approvals; confidence and freshness caps; hallucination defenses; audit/LLM tracing in Supabase; failure recovery; security; milestones; risks |
| `DAILY_BRIEF_SPEC.md` | Brief sections, inclusion rules and thresholds (SCH/COST/RFI/SUB/PROC/DEC rule IDs, email significance), severity, the ranking formula with a worked table, snapshot diff and lifecycle, JSON schema notes, the embedded rendered example, pre-publish checks, and deviations D1–D6 from the product spec |
| `CORRELATION_PLAYBOOK.md` | 27 cross-source patterns (PB-01…PB-27): signals and sources, join keys, confidence modifiers, impact math, action template, false-positive guards, and fixture mapping |
| `RECONCILE.md` | R1–R24: field and ownership mismatches with the integrations tool layer, the M1 scaffold, the product spec, and the pilot one-pager, each with a proposed resolution and owner |

### Contracts
| File | What it is |
|---|---|
| `schemas/brief.schema.json` | JSON Schema (2020-12) for the brief: ≤ 7 top items, ≤ 700 main-section words, ref pattern, WORSE requires `delta_text`, freshness block |
| `tools/build_tool_schemas.py` | Generates and validates `tool_schemas.json`: meta-schema, no name collision with the 14 integrations tools, allow-lists resolve, fixture findings validate against `list_findings` |
| `tools/tool_schemas.json` | 24 agent-layer tools (11 T0 reads, 9 T1 internal writes, 4 T2 actions **disabled in V1**), shared `$defs`, per-agent allow-lists, and requested data tools (`get_meetings`, message-level email) |

### Prompts (provider-neutral; one per MVP agent)
| File | Agent |
|---|---|
| `prompts/_shared_rules.md` | R1–R10 rules every agent inherits: evidence-only, numbers come from code, missing-data handling, labels, no legal conclusions, untrusted content, permissions, JSON-only output, freshness disclosure, calendar discipline |
| `prompts/schedule_analyst.md` | Float erosion, critical/near-critical slips, data-date staleness (source-agnostic: P6 XER or Procore schedule) |
| `prompts/cost_analyst.md` | Contingency burn vs. % complete, unpriced CEs, pay-app vs. schedule-earned, no double-counting |
| `prompts/rfi_submittal_analyst.md` | Overdue RFIs and submittals, ROS risk, revise-and-resubmit loops, ball-in-court |
| `prompts/procurement_analyst.md` | PO-not-issued, quote expiry, lead time vs. ROS |
| `prompts/comms_decisions_analyst.md` | Email extraction mode plus reason mode: notices, vendor deadlines, decisions register |
| `prompts/correlator.md` | Joins findings into insights using the playbook; ranks with the spec §5 inputs |
| `prompts/verifier.md` | Claim-by-claim check against cited records; drops or downgrades |
| `prompts/brief_writer.md` | Closed-book writer; output goes only to `save_brief` |
| `prompts/orchestrator.md` | M3 on-demand Q&A, T0 tools only |

### Examples
| File | What it is |
|---|---|
| `examples/example_brief.py` | Builds the fictional Linden Yard brief JSON for Tue 10/6, schema-validates it, and checks every ref against the fixture |
| `examples/brief_linden_yard_2026-10-06.json` | The example brief (586 words, 7 top items, 8 actions) |
| `examples/render_brief.py` | Deterministic JSON → Markdown renderer (models never write the final page) |
| `examples/brief_linden_yard_2026-10-06.md` | Rendered example (identical to DAILY_BRIEF_SPEC §8) |

### Evals and fixture
| File | What it is |
|---|---|
| `evals/EVALS.md` | Metrics (citation precision, claim accuracy, recall of planted risks, false alarms, action usefulness rubric, calibration, latency/cost), Mode A/B runs, robustness variants, CI gates, chat evals |
| `evals/score_brief.py` | Automated scorer: recall, rank, Kendall τ, false alarms, status items, freshness disclosures, fabricated refs; exits 1 if the gate fails |
| `evals/fixture/FICTIONAL.md` | Fictional-data label for the whole fixture (covers the bare-array M1 seed files) |
| `evals/fixture/build_fixture.py` | Regenerates and validates the whole fixture from `src/` |
| `evals/fixture/src/p1_core.py` | Project, RFIs, submittals, M1 rule outputs |
| `evals/fixture/src/p2_rules_m3.py` | Schedule (U1/U2), daily logs, commitments, budget, CEs, drawing revisions |
| `evals/fixture/src/p3_comms_key.py` | Emails, OAC minutes, answer key |
| `evals/fixture/src/reference_ranking.py` | Applies the spec §5 ranking formula to the answer key → `reference_ranking.json` |
| `evals/fixture/project.json` | Fictional project config: GMP, contingency, delay cost basis, calendar, mailbox, schedule source |
| `evals/fixture/m1/SCHEMA_NOTES.md` | Column notes for the M1 seed tables (rfis, submittals, findings) with Procore sources (vendor details marked "verify") and the Mode A allow-list |
| `evals/fixture/m1/day{1,2}/{rfis,submittals,findings}.json` | M1 seed data and exact-match expectations for the rules engine |
| `evals/fixture/m2/{emails,meetings}.json` | 11 project-mailbox emails (incl. a decoy) and OAC #12–14 minutes |
| `evals/fixture/m3/*.json` | Schedule, daily logs, commitments, budget, change events, drawing revisions |
| `evals/fixture/expected_findings.json` | Answer key: 11 planted findings (F1–F11), 5 status items, 6 must-not-flag controls, freshness disclosures |
| `evals/fixture/reference_ranking.json` | Reference top 7 and scores |
| `evals/fixture/_ref_index.json` | Every valid ref in the fixture (fabrication check) |

## How to run
```bash
cd /workspace/sitetech/intelligence
python3 -m venv /tmp/stvenv && /tmp/stvenv/bin/pip install jsonschema   # once
python3 evals/fixture/build_fixture.py
python3 evals/fixture/src/reference_ranking.py
/tmp/stvenv/bin/python examples/example_brief.py
python3 examples/render_brief.py examples/brief_linden_yard_2026-10-06.json examples/brief_linden_yard_2026-10-06.md
/tmp/stvenv/bin/python tools/build_tool_schemas.py
python3 evals/score_brief.py examples/brief_linden_yard_2026-10-06.json
```

## Key design decisions
1. **Three layers, with findings as the contract.** Deterministic rules write `findings` (rule ID, fingerprint, `days_overdue` in calendar days, lifecycle). Models only rank and connect. A verifier drops claims that don't resolve to record IDs. M1 ships the rules layer with no model at all.
2. **Numbers come from code.** Every day count, dollar figure, float value, and percentage is computed in stage S7 (`compute_impact`) or by the rules. Prompts forbid arithmetic in prose.
3. **Closed-book writer, deterministic renderer, schema limits.** The writer sees only verified claims. The schema caps length and enforces ref format. A ref check blocks fabricated record numbers.
4. **Freshness is first-class.** Every section shows source freshness. A weekly XER that is 8 or more days old caps schedule-only claims at Likely; stale caps them at Signal. Email coverage always names the single mailbox.
5. **Linking Mode A (approved) with Mode B ready.** Approved text fields allow paraphrase linking. Mode B keeps only derived keys. The eval runs both modes and measures the loss rather than guessing.
6. **Ranking by expected exposure, with floors.** P × (delay $ + direct $) × urgency. Exposure kinds (recognized, at_risk, escalation, payment_risk, unpriced) prevent double-counting. Floors guarantee a slot to critical-path items, open notice windows (≤ 10 business days), and owner-contingency burn.
7. **Actions are defined now but switched off.** T2 tools (submit RFI, send email, schedule change, CE) exist with hashed, expiring approval payloads and a hash-chained audit log. All are `disabled_in_v1`, which matches the pilot promise that SiteTech "never writes to Procore, never sends external messages."
8. **No extra vendors in V1.** LLM traces, audit, approvals, and eval runs live in Supabase tables. Model IDs live in config, behind one provider interface, restricted to no-training APIs.

## Open questions for Sean
1. **Meetings and Drawings in the pilot (R21).** The pilot one-pager's Procore read list leaves out Meetings and Drawings. Should they be added to the DMSA template, or should OAC minutes come from the SharePoint site? Without either, the decisions register runs on email alone.
2. **Stored fields beyond RFIs and submittals (R22).** The consent text lists stored fields only for RFIs and submittals. M3 needs a small approved list for change events, commitments/requisitions, budget, daily logs, and the schedule. Otherwise those types run in Mode B.
3. **Brief delivery (R20, R24).** M365 access is Mail.Read only, so the brief can't send from the customer's tenant. Should it send from a SiteTech domain, be in-app only, or both? The pilot says 6:30 AM; the product spec default is 6:15. I've made it a per-project setting.
4. **Brief date label (D1).** I key a brief to the business day it covers ("Covers Tue 10/6", delivered Wed morning). The product spec titles it by delivery date. Which do PXs expect?
5. **Model providers.** Which provider accounts do you have, and is the no-training / zero-retention status confirmed in writing for each? Routing stays disabled for any provider without it.
6. **Daily delay cost.** Ranking in dollars needs GC general conditions per day plus owner carry. Who supplies these at onboarding? Without them, ranking falls back to schedule days alone.
7. **Contract terms (R15).** Notice windows, retainage, and the weather-day clause need a human-confirmed entry per project. Until they're confirmed, notice items are capped at Signal and read "clause extracted, not yet confirmed by your team." Who enters them, and the PM or the PX?
8. **Chat scope.** The CTO's M3 includes the chat box, but the product spec puts chat outside the MVP. I designed it as read-only T0 Q&A. Is it in or out for the pilot?
9. **Pay apps (R12).** F5 (billing ahead of schedule) needs requisition data. Are requisitions inside the "Commitments" read scope (verify the Procore permission), and is this in M3 or later?
10. **Procore's written position (integrations D1/D2).** Has Procore confirmed that storing Mode A fields and sending them to no-training model APIs is acceptable under the developer terms?
11. **Agent Engineer split.** Who owns the prompts and agent runtime versus the rules engine and evals? See the ownership note in ARCHITECTURE §0.1.
12. **First customer stack.** Is the first pilot's schedule in Procore or P6, and which accounting system do they use? This sets M3 priorities.
13. **Retention of LLM trace bodies.** I proposed 30 days for request/response bodies and purge-with-project for metadata. Is that acceptable for pilot contracts?

## 2–4 week build sequence
Assumes the Task 1 scaffold (`sitetech-app`) and Task 2 (Supabase tenancy plus RLS) are done by the Lead Engineer, and that the integrations engineer ships the RFI/submittal sync for M1.

| Week | Milestone | Intelligence deliverables | Exit test |
|---|---|---|---|
| 1 | **M1** | `findings`, `link_keys`, `entity_links` DDL proposals to the Lead Engineer (RECONCILE R1–R4 settled); TypeScript rules engine for RFI-OVERDUE, SUB-REVIEW-OVERDUE, SUB-SUBMIT-BY-MISSED, SUB-ROS-RISK, SUB-REV-LOOP with business-day calendar; finding fingerprint and lifecycle; `list_findings` / `upsert_findings` / `resolve_refs`; seed `evals/fixture/m1` into a dev project | Vitest exact-match vs. `m1/day*/findings.json`; the findings list renders in the UI |
| 2 | **M2a** | Provider interface plus `llm_traces`; comms analyst extraction mode (per email, Inngest fan-out); L0–L2 linking; decisions register; `project_snapshots` + `diff_snapshots`; deterministic verifier checks (ref resolves, numbers match S7) | Extraction schema-valid on all 11 fixture emails; N1 decoy not flagged; diff reproduces NEW/WORSE/closed for day 1 → day 2 |
| 3 | **M2b** | RFI/submittal analyst, limited correlator (PB-01/04/08/13/14…), verifier LLM pass, brief writer, renderer, `save_brief`; `score_brief.py` in CI; Mode A and Mode B runs; delivery per the Q3 decision; first shadow brief on a pilot project if access is live | Gate in EVALS §6 on the M1+M2 slice; H1 citation precision ≥ 98% on 3 shadow days |
| 4 | **M3 start** | Schedule analyst on XER-derived updates (float diffs, data-date freshness caps); cost and procurement rules; daily-log manpower and inspections; full correlator; orchestrator T0 chat (if Q8 says yes); robustness variants V1–V6 | Full fixture gate: recall ≥ 10/11, 0 false alarms, 0 fabricated refs, freshness 3/3 |

The full M3 (pay apps, drawings metadata, chat polish, a second fixture project) likely runs past week 4. It depends on Q1, Q2, and Q9.
