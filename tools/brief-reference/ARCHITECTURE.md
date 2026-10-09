# SiteTech Intelligence Layer: Architecture (v0.1)

**Owner:** AI & Agent Systems Engineer (intelligence layer) · **Date:** 2026-10-06 · **Status:** Draft for CTO / Lead Engineer review
**Companions:** `DAILY_BRIEF_SPEC.md` · `CORRELATION_PLAYBOOK.md` · `prompts/` · `tools/tool_schemas.json` · `RECONCILE.md` · `evals/`

---

## 0. Inputs this design takes as given

These decisions are fixed. This document builds on them and does not reopen them.

| Given decision (CTO / Lead Engineer, 2026-10-06) | What it means for the intelligence layer |
|---|---|
| Next.js + Supabase (Postgres, Auth, Vault, Storage, RLS) + Vercel | All intelligence state lives in Supabase tables, **including LLM tracing and audit**. **V1 adds no separate observability vendor.** |
| Inngest runs the nightly and on-demand jobs | The brief pipeline is one Inngest function. Each stage is a `step.run`, so a failure retries only that stage, and stages are idempotent. |
| Direct Procore OAuth through a **DMSA** with a read-only permission template and a GET-only client | The intelligence layer **cannot write to Procore** in V1. The T2 tools exist only as disabled stubs (§11). |
| Microsoft Graph: **one mailbox** (Exchange RBAC for Applications / application access policy) and **one SharePoint site** (Sites.Selected) | Email intelligence sees only mail that reaches the project mailbox, and every brief says so. There is no `Mail.ReadWrite` or `Mail.Send`, so "drafts" are records inside SiteTech, not Outlook drafts. |
| If the schedule lives in P6, it arrives as a **weekly XER upload** (no P6 API). Whether the source is Procore or P6 is still undecided | Schedule tools and rules don't depend on the source. Every schedule claim carries `data_date` and `uploaded_at`, and its confidence drops as that data ages (§12.2). |
| Three layers: **(1)** deterministic code writes flagged items into `findings`, **(2)** the model ranks and connects them, **(3)** a verifier drops any claim without a record ID | This is the spine of the design. LLMs never compute overdue days, float, dollars, or dates. They select, connect, and explain. |
| A model-agnostic LLM layer through the Vercel AI SDK. Model IDs live in config. Every call is logged. Only **no-training model APIs** are allowed | §10 routes by task class behind one provider interface. Each call writes an `llm_traces` row. A provider is only enabled once its no-training / zero-retention terms have been confirmed. |
| Milestones: **M1** Procore RFIs + submittals with overdue rules → **M2** email + first written brief → **M3** budget, commitments, change events, daily logs, schedule, and the chat box | §17 maps every component to a milestone. |
| **Data policy (CTO-approved: Mode A).** Store the approved structured text fields: RFI subject, question, and answer, plus submittal title and spec section. Store **no attachments, drawings, or files**. Deletions carry through nightly. Everything is purged **within 30 days of a disconnect**. `raw_records` keeps only an **approved per-record-type field list plus a change-detection fingerprint**, and a purge job enforces retention (Lead Engineer) | Entity linking runs in **Mode A** (§5.4). **Mode B** (fetch text live, hold it in memory only, persist only derived keys) is the documented fallback if Procore or a customer objects. Intelligence tables obey the same purge (§16). |

### 0.1 Ownership boundaries (designed to; please confirm)

The teammate profile.json files contain only names, with no descriptions. The boundaries below come from the artifacts in `/workspace/sitetech/`.

| Area | Owner | Interface with this layer |
|---|---|---|
| Connectors (`authorize`, `backfill`, `incrementalSync`, `listAllIds`, `mapToNormalized`), Vault tokens, sync cursors, normalized source tables, the append-only `event_log`, and the canonical **read tools** `get_project`, `get_rfis`, `get_submittals`, `get_schedule`, `get_budget`, `get_change_orders`, `get_pay_apps`, `get_contracts`, `get_daily_reports`, `get_drawings`, `get_documents`, `get_project_emails`, `get_procurement_status`, `get_project_activity` | **Integrations Engineer** (`integrations/sitetech-tool-layer.json`) | Intelligence **consumes these and never redefines them**. Gaps and mismatches are listed in `RECONCILE.md`. |
| App repo, table DDL, RLS, migrations, `raw_records` approved-field lists, the purge job, Inngest wiring, UI | **Lead Engineer** (`sitetech-app`) | Intelligence specifies the tables it needs (§3.3) and supplies seed rows (`evals/fixture/m1/`). **The Lead Engineer's committed DDL wins.** |
| Architecture approval | **CTO** | This doc proposes; the CTO decides. |
| **Intelligence layer:** link keys, entity links, the deterministic rule library and finding lifecycle, snapshots and diffs, analysts, correlator, verifier, brief composer, prompts, model routing, confidence policy, approval/audit model for agent actions, evals | **AI & Agent Systems Engineer (this doc)** | Writes `link_keys`, `entity_links`, `findings`, `project_snapshots`, `insights`, `claims`, `brief_runs`, `briefs`, `decisions_register`, `approvals`, `audit_log`, `llm_traces`. |
| What the brief is for (reader, length, ranking philosophy) | **Sean / PM**: `daily-project-brief-spec.md` v0.1 | `DAILY_BRIEF_SPEC.md` implements that spec. If the two disagree, the product spec wins unless the difference is flagged. |

> **Overlap to resolve:** a "Sitetech AI Agent Engineer" agent also exists, and its title overlaps with this role. Suggested split: Agent Engineer owns the agent runtime (Inngest step wiring, the tool-calling loop, the chat box UX), and this role owns rules, linking, prompts, confidence, verifier, and evals. See README, Open questions.

---

## 1. "Palantir for GCs and developers": how the design maps

- **Ontology = typed project objects + links.** The canonical entities (§3.1) are the object types: Activity, RFI, Submittal, Commitment, ChangeEvent, BudgetLine, PayApp, Email, Decision, Drawing, DailyLog, Person/Company. They are joined through normalized link keys and an `entity_links` graph (§3.2, §5). The objects come from the systems of record. Nobody re-keys them.
- **Actions with permissions and approvals.** Every capability is a typed tool with a tier: T0 read, T1 internal write, T2 external write behind approval, T3 never autonomous (§11). Each T2 action is a payload with a hash, an expiry, and an audit trail. A V1 tenant sees only T0 and T1 enabled.
- **Agents reason over the linked objects.** Deterministic rules turn objects into findings. LLM analysts and a correlator connect findings across object types into cited insights. A verifier enforces "no record ID, no claim." The Daily Brief is the first application built on this, and the M3 chat box is the second.
- **What sets it apart from generic ontology platforms:** construction semantics are built in from the start (float, ball-in-court, ROS minus lead time, notice windows, pay-app vs. earned value), and the platform overlays the customer's existing systems rather than replacing them.

---

## 2. Design principles

1. **The brief is a compiler, not a chatbot.** V1 is a fixed nightly pipeline with LLM calls at four narrow points. There are no free-roaming agents deciding what to look at. Bounded steps are cheaper, reproducible, and testable against fixtures. Agentic tool loops are reserved for the M3 chat box, and even there only T0 tools are allowed.
2. **Rules find; models connect; code checks.** Every number in a brief (days overdue, float, $, dates, %) comes from deterministic code over a cited record, or code recomputes it before publishing. A model may say "these five findings are one steel problem." It may never be the source of "7 days."
3. **Findings are the contract between layers.** A finding is a typed, fingerprinted, cited row. Analysts take findings plus records and produce claims, and the verifier checks those claims against the records. This keeps models swappable and makes recall measurable.
4. **Cite down to the record ID, and to the field where possible.** A citation `ref` is `source:entity_type:external_id`, with optional `field`, `value`, `as_of`, and `quote`. The format mirrors the scaffold's uniqueness rule `(org_id, project_id, source, entity_type, external_id)` and the integrations `SourceRef.system` names (`procore`, `msgraph_outlook`, `msgraph_sharepoint`, `p6`).
5. **Freshness is an input to confidence.** A 9-day-old XER is evidence, not today's truth. Every section header says which data it rests on, and confidence is capped to match.
6. **Missing data is reported, never filled in.** A missing source, permission, or field produces a `gap`, not a guess.
7. **Nothing is written outside SiteTech in V1.** SiteTech drafts. Humans send, submit, approve, and change schedules. The tiers in §11 let V2 enable writes one action type at a time, with the approval trail already built.

---

## 3. Canonical project data model

### 3.1 Entities (normalized by integrations; these are the fields intelligence depends on)

Every row carries `org_id, project_id, source, entity_type, external_id, source_url, synced_at, deleted_at`. **Bold** = link-key source (§3.2). `†` = free text stored under Mode A (CTO-approved), within `raw_records` approved-field lists.

| Entity | `entity_type` | Fields intelligence uses | V1 source |
|---|---|---|---|
| Activity | `activity` | **activity_id**, name†, early/late start/finish, baseline start/finish, total_float_wd, free_float_wd, is_critical, on_driving_path, pct_complete, predecessors[], **WBS/area codes**, planned crew, `schedule_update_id`, `data_date`, `uploaded_at` | XER weekly upload, or Procore Scheduling v2 (verify float/baseline availability) |
| RFI | `rfi` | number, status, due_date, initiated_at, time_resolved, ball_in_court[], assignees[], rfi_manager, received_from, responsible_contractor, **specification_section**, **location**, **cost_code**, **drawing_number**, schedule_impact{status,value}, cost_impact{status,value}, subject†, question†, answer† | Procore `GET /rest/v1.0/projects/{id}/rfis` |
| Submittal | `submittal` | formatted_number, revision, current_revision, status, ball_in_court[], approvers[] (response, returned_date), **specification_section**, **location_id**, **cost_code_id**, submit_by, received_date, due_date, required_on_site_date, lead_time, design_team_review_time, internal_review_time, buffer_time, **scheduled_task**, title† | Procore `GET /rest/v1.1/projects/{id}/submittals` |
| Commitment / PO | `commitment` | number, type, **vendor**, status, amount, executed_date, retainage, **cost_codes[]**, SOV lines | Procore (M3) |
| Change event / PCO / CO | `change_event`, `pco`, `change_order` | number, status, ROM/amount, priced?, funding, **linked RFIs**, **cost_codes**, dates, claimed schedule impact | Procore (M3; tier configuration varies by project) |
| Budget line / snapshot | `budget_line`, `budget_snapshot` | **cost_code**, original, approved changes, revised, committed, pending, projected; contingency lines | Procore budget view (M3; columns are configurable) |
| Pay app | `requisition` (sub), `payment_application` (owner) | period, SOV line % (previous / to date), retainage, status | Procore (integrations marks this post-M3; the fixture includes one so correlation can be tested) |
| Email / thread | `message`, `thread` | conversation_id, from/to/cc, received_at, subject†, body†, attachment *names* only, **extracted keys** | Graph mail delta (M2) |
| Meeting / decision | `meeting`, `meeting_item`, `decision` | item number, type (decision_pending / decision_made / action), assignee, due_date, status, carried_from[] | Procore Meetings or minutes in SharePoint |
| Document / drawing / spec | `document`, `drawing_revision`, `spec_section` | **sheet number**, revision, issued_date, issued_via (ASI/bulletin), **spec number**, doc_class (metadata only; no files) | Procore drawing metadata; SharePoint metadata/text |
| Daily log | `manpower_log`, `weather_log`, `inspection_log`, `delay_log`, `notes_log`, `delivery_log` | log_date, **vendor**, workers, hours, **location**, result, delay type, comment† | Procore daily logs (M3) |
| Person / company | `person`, `company` | name, email(s), company, role, **trade** | Procore directory + email headers |
| Contract term | `contract_term` | clause, notice_days, party, doc_ref + page, `confirmed_by_human` | SharePoint (extracted, then human-confirmed) |

### 3.2 Link keys: the join vocabulary

Every entity gets zero or more normalized **link keys**. Most linking reduces to key equality plus a little structure. That keeps it cheap and explainable.

| Key | Normal form | Example | Derived from |
|---|---|---|---|
| `spec` | `NN NN NN` (MasterFormat, 6 digits) | `05 12 00` | Procore spec section; submittal number prefix; regex over text with a context check |
| `csi_div` | `NN` | `05` | the `spec` key; cost-code prefix |
| `loc` | hierarchical `wing:B/lvl:L2/grid:C/4-7/area:<name>`. Partial values are allowed, and matching is prefix/containment | `wing:B/lvl:L2/grid:C/4-7` | Procore location tree; XER WBS/activity codes; text ("grid C", "C/4-7", "garage entry transfer") through the per-project **alias table** |
| `trade` | controlled vocabulary (~40 values) | `structural_steel` | company role, spec-division map, cost-code map |
| `cost_code` | project cost-code string | `05-1200` | Procore, commitments, budget |
| `activity` | XER activity_id / Procore task id | `A1230` | XER; `submittal.scheduled_task`; the onboarding activity↔spec/area map |
| `company`, `person` | SiteTech directory ids | `co:7005` | Procore directory; email-domain→company map |
| `rec` | native record number | `RFI-42`, `SUB-05 12 00-003`, `PCO-014`, `PO-0117`, `ASI-07`, `S-301` | fields, plus regex over text (`RFI\s?#?\s?(\d+)`, `ASI[-\s]?(\d+)`, sheet `[A-Z]{1,2}-\d{3}`) |

**Onboarding artifacts.** These are the most valuable hours of the install. A human confirms each one, and the system bootstraps a draft with an LLM.
1. **Location alias table:** "garage entry transfer", "grid C 4 thru 7" → `wing:B/lvl:L2/grid:C/4-7`.
2. **Activity↔spec/area map** for the roughly 60 activities that matter: long-lead items plus the critical and near-critical paths.
3. **Company↔trade↔cost-code map.**
4. **Contract terms:** notice days, pay-app clauses, LDs. A notice-window rule never uses a term until a human has confirmed it.

### 3.3 Tables owned by the intelligence layer

These are proposals. The Lead Engineer's DDL wins. Every table has `org_id`, `project_id`, `created_at`, and RLS on `org_id`, and every table falls under the 30-day disconnect purge.

```
link_keys         (id, source, entity_type, external_id, key_type, key_value, derivation[field|regex|alias|llm], confidence, run_id)
entity_links      (id, a_ref, b_ref, link_type, method[key|structural|heuristic|llm|human], confidence, evidence jsonb,
                   status[proposed|accepted|rejected|superseded], decided_by[rule|model|human], run_id)
findings          (id, run_date, rule_id, rule_version, entity_type, entity_id, source, external_id, record_label, title, severity,
                   status[open|resolved|suppressed], days_overdue int NOT NULL DEFAULT 0, governing_date, governing_date_kind,
                   ball_in_court, spec_section, fingerprint, first_detected_on, last_seen_on, resolved_on,
                   change_since_prior_run, evidence jsonb, citations jsonb)      -- seed shape: evals/fixture/m1/SCHEMA_NOTES.md
project_snapshots (id, as_of, cutoff_at, snapshot jsonb, source_freshness jsonb, hash)   -- DAILY_BRIEF_SPEC §6
insights          (id, run_id, kind, playbook_rule_id, title, finding_ids uuid[], record_refs text[], impact jsonb,
                   confidence numeric, confidence_label, owner jsonb, status, fingerprint)
claims            (id, run_id, insight_id, text, claim_type[fact|computed|inference|recommendation], citations jsonb,
                   numeric_assertions jsonb, verifier_status[pass|downgraded|dropped], verifier_notes)
brief_runs        (id, as_of, status, stage_status jsonb, gaps jsonb, cost_usd, tokens jsonb, idempotency_key UNIQUE, started_at, finished_at)
briefs            (id, run_id, version, brief_json jsonb, rendered_md, word_count, delivered_at)
decisions_register(id, decision_ref, kind[pending|made], summary, owner, needed_by, made_on, source_refs text[],
                   follow_through_refs text[], status, carried_count)
approvals         (§11.2)    audit_log (§14)    llm_traces (§14)
```

---

## 4. Ingestion modes, the integrations boundary, and freshness

**Boundary rules**
- Intelligence reads source data **only through the integrations layer**: server-side repositories over the normalized tables, or the `get_*` tools during agentic calls. It never calls Procore or Graph itself and never mutates source tables. Its outputs live in its own tables, keyed back by `(source, entity_type, external_id)`.
- `event_log` (integrations-owned) is an input. It records how things changed. `project_snapshots` (intelligence-owned) is a frozen copy of what the brief asserted at cutoff. The two do different jobs and are both kept.

| Mode | V1? | Owner | Intelligence-layer handling |
|---|---|---|---|
| **Scheduled sync (nightly)** | **Yes (primary)** | Integrations | `incrementalSync` + `listAllIds` run at about 04:30 project-local time. The brief run starts on `sync.completed` for all required sources, or at a hard deadline (05:20) with gaps declared. |
| **On-demand sync** | Yes | Integrations | Fires before a manual "regenerate brief", and from the M3 chat box when data is more than 6 h old. |
| **File upload (XER)** | Yes (weekly) | Integrations parses TASK/TASKPRED/PROJWBS/CALENDAR into `activity` rows tagged `schedule_update_id` | `schedule.updated` re-runs only the schedule rules (float diff between the two latest updates). The brief shows both `data_date` and `uploaded_at`. |
| **Document parse** | M2 (SharePoint) | Integrations handles text and metadata. Intelligence classifies documents and extracts contract terms, minutes items, and procurement-log rows | Every extraction is a proposal until a human confirms it. No files are stored, only the approved derived fields. |
| **Webhook / event** | V2 | Integrations | Feeds the same `event_log`, so it enables intra-day hot alerts (§7.3) without changing brief code. |
| **Browser / computer-use fallback** | **No** | — | **Never for Procore**: its policy bans undocumented access. Only for systems with no API, with written customer consent, T0 only, and post-MVP. |

**Freshness bands.** Integrations exposes `Freshness {system, last_successful_sync, mode, stale}`. Intelligence adds `data_date`, `uploaded_at`, and `schedule_update_id` for schedules (RECONCILE R6, R7).

| Source | Fresh | Aging | Stale | Missing |
|---|---|---|---|---|
| Procore objects | sync < 26 h | 26–50 h | > 50 h | never synced / 403 on tool |
| Project mailbox | delta < 26 h | 26–50 h | > 50 h | consent or scope missing |
| Schedule (XER or Procore) | data_date ≤ 7 d old | 8–14 d | 15–28 d | > 28 d or none |
| Budget / change events | snapshot < 26 h | 26–50 h | > 50 h | — |
| Contract terms | human-confirmed | extracted, unconfirmed | — | not extracted |

§12.2 covers how these bands affect confidence. Every brief section header prints its sources' freshness, for example *"Schedule as of XER data date Sep 28 (uploaded Oct 2): aging"*.

---

## 5. Entity resolution and linking

### 5.1 Strategy: deterministic first, then structural, then model, and always with a confidence

| Tier | Method | Typical confidence | Example |
|---|---|---|---|
| L0 Native | Source system foreign keys | 0.99 | `submittal.scheduled_task → A1230`; change event `linked_rfis` |
| L1 Exact key | Equality on `rec` (record number in text), `spec`, `activity`, `cost_code` | 0.95 (rec) / 0.85 (spec alone) | Email subject "RFI 42" → `procore:rfi:9042` |
| L2 Structural | Two or more independent keys agree (`spec` + `loc`, `company` + `trade` + `loc`), within a time window | 0.80–0.90 | Bayline email (company=steel) + "Grid C/4-7" + "embed" → RFI 42 even without the number |
| L3 Heuristic text | Mode A only: lexical + embedding similarity over approved text fields, candidates limited to L1/L2 neighbors | 0.60–0.80 | "connection plates at the garage entry transfer" → RFI 42 (alias table maps "garage entry transfer") |
| L4 Model adjudication | Small/medium model chooses among at most 5 candidates from L1–L3, or picks "none". Structured output with a quoted rationale | model-reported, capped at 0.85 | Ambiguous "steel" email with two open steel RFIs |
| L5 Human | Accept or reject in the UI. The decision becomes training data for thresholds only. **No model training on Procore data.** | 1.0 | — |

Rules:
- A link is **accepted** automatically at ≥ 0.80. At 0.60–0.80 it is stored as `proposed` and can be used only in Signal-level claims. Below 0.60 it is discarded and its candidates are logged.
- Links are **typed** (`about`, `blocks`, `supersedes`, `responds_to`, `funds`, `bills_against`, `located_at`, `decided_in`), because the correlator reasons differently over "blocks" than over "mentions."
- Links never cross projects. Email attribution to the project is integrations' job (D6 in their report). Intelligence links only within a project.

### 5.2 Worked example: "embeds at grid C"

The email arrives Oct 6 from `gmoreno@baylinesteel.example`, subject "Transfer steel shop release / RFI 42".
1. **Key extraction** (regex plus small model, Mode A text): `rec=RFI-42`; `loc=grid:C/4-7` (alias table); `company=co:7005 (Bayline, trade=structural_steel)`; dates `Oct 9`, `Oct 12`, `Oct 26`, `Nov 9`, `Nov 23`; intent `schedule_slip_conditional`.
2. **L1:** `rec=RFI-42` → `procore:rfi:9042` (0.95, `about`).
3. **L0 / L1 through the RFI:** RFI 9042 has `spec=05 12 00`, `loc=wing:B/lvl:L2/grid:C/4-7`. Submittal 6103 has the same `spec` and `loc`, and its `scheduled_task` is A1230 (0.99). The onboarding activity map links A1225 (fabrication) as A1230's predecessor.
4. **Commitment:** company `co:7005` + `cost_code 05-1200` → `procore:commitment:3309` (SC-009, 0.95).
5. **Meeting:** OAC item 14.05 names RFI 42 (`rec`, 0.95, `decided_in`).
6. **Result:** a connected component {email E104, RFI 9042, submittal 6103, A1225, A1230, SC-009, OAC 14.05}. Rule `PB-01` (CORRELATION_PLAYBOOK) fires on that component.

### 5.3 Where linking runs

Linking runs in stage S2 every night, incrementally: only entities changed since the last run, plus their L1 neighbors. Link keys are recomputed whenever a record's fingerprint changes.

### 5.4 Data-retention modes for linking

**Mode A (CTO-approved, default).** The approved text fields are stored in normalized tables, inside the Lead Engineer's per-type `raw_records` allow-list, with a change fingerprint: RFI subject, question, and answer; submittal title and spec section; email subject and body from the one mailbox; daily-log comments. Retention: deletions carry through nightly (`listAllIds`), and all data, intelligence tables included, is purged within 30 days of a disconnect. No attachments, drawings, or files are kept. Embeddings of approved text are allowed. They live in a `text_embeddings` table (pgvector), are dropped whenever the source row is deleted or its fingerprint changes, and are covered by the purge.

**Mode B (documented fallback).** Use it if Procore's written position (integrations D2) or a customer forbids stored Procore text. During the nightly run, `fetchTextEphemeral()` (an integrations function, RECONCILE R17) pulls subject, question, and title into memory. Stage S1 extracts link keys from that text, and the text is then discarded. **Only derived keys persist:** `spec`, `loc`, `csi_div`, `trade`, `rec` ids, `activity`, `company`, and link confidence. **No Procore raw text and no embeddings of Procore text are kept.** Email text, which comes from the customer's own M365, is not affected.

**Accuracy lost in Mode B.** These are hypotheses, to be measured by running the eval in both modes (EVALS.md §5):

| Capability | Mode A | Mode B | Why |
|---|---|---|---|
| Email→Procore link when the email **cites the record number** | ~98% | ~98% | L1 `rec` match needs no Procore text |
| Email→Procore link with **no number** but shared spec/location/company | ~85–90% | ~75–85% | L2 still works from persisted keys. The loss comes from text-only cues the key extractor didn't anticipate |
| Email→Procore link that is **paraphrase-only** ("connection plates at the garage entry") | ~70–80% | ~35–50% | No L3 semantic similarity against Procore text. Recovery depends entirely on the alias table |
| Duplicate / shadow-RFI detection (email question vs. an existing RFI) | good | weak | Needs text similarity |
| Repeat-question pattern (3+ RFIs on the same detail, PB-17) | good | key-only | Clusters only by spec/loc/drawing, not by wording |
| Brief prose quoting the RFI subject | yes | only at run time | The brief can quote during the run. The stored brief must hold record numbers plus SiteTech-written summaries, and whether quoted Procore text in a stored brief is itself a "copy" becomes a policy question |
| M3 chat answering "what did the architect say on RFI 42?" | instant | live fetch | Adds latency and Procore rate-limit cost. Needs a GET-through tool |
| Re-linking history after a rule improves | cheap | expensive | Requires re-fetching text across the project history |
| Verifier quote checks on Procore text after the run | yes | no | Citations become field-level, not quote-level, for Procore records |

Net: Mode B keeps nearly all of the deterministic value (M1 overdue/ROS rules need no text) and most of the structured correlation. It mostly loses **paraphrase-level recall**, the part of the "excellent PM" pattern that reads between the lines.

---

## 6. Project memory

| Store | What it holds | Stored or re-retrieved | Why |
|---|---|---|---|
| **Knowledge graph** (`link_keys` + `entity_links`, Postgres, no graph DB) | Typed links between canonical records, with confidence and evidence | **Stored**, recomputed incrementally | Joins are cheap. Recursive CTEs over about 10⁴ links per project are trivial. A graph DB adds ops cost for no V1 benefit |
| **Event log** (`event_log`, integrations-owned) | Typed diff events (`rfi.status_changed`, `submittal.returned`, …) | Stored (append-only, subject to purge) | The source of "what happened" and of activity counts |
| **Project state snapshot** (`project_snapshots`) | At cutoff: open-item sets, per-entity material-field hashes, KPI roll-ups (contingency %, overdue counts, float on watched activities), source freshness | **Stored daily**. Keep 30 daily snapshots plus weekly ones for the project's life (until purge) | Yesterday vs. today diffs; "NEW / WORSE / closed" tags; reproducing exactly what the brief saw |
| **Decisions register** (`decisions_register`) | Pending and made decisions, owner, needed-by, carried count, follow-through refs | **Stored**, updated nightly | Decisions live in minutes and email, not in any system of record. This register is the product's memory of who promised what |
| **Findings + insights + claims** | Everything asserted, with citations and verifier status | **Stored** | Audit, evals, "why is this here?", and finding lifecycle (first_detected_on drives age-based ranking) |
| **Source records themselves** | Canonical rows (Mode A approved fields) | **Re-retrieved** through repositories/tools at run time. Never copied into intelligence tables | One copy only, so purge and delete propagation happen in one place |
| **Rolling project narrative** | A ≤ 400-word "state of the job" summary that the next run's correlator reads as context | **Stored** with its citations. It is never used as evidence | Gives the correlator continuity ("steel has been the issue for 2 weeks") without letting a summary pose as a source. The verifier rejects any citation to the narrative itself |

---

## 7. Event-driven execution (Inngest)

### 7.1 Functions

| Function | Trigger | Concurrency / idempotency | Notes |
|---|---|---|---|
| `brief.nightly` | cron at 05:00 project-local, gated on `sync.completed` (hard deadline 05:20) | `concurrency: {key: project_id, limit: 1}`; idempotency key `brief:{project_id}:{as_of}:{pipeline_version}` | Stages S0–S10 (§9). Each stage is a `step.run` whose output persists before the next stage starts |
| `brief.regenerate` | user button | same key + `:v{n}` | Re-runs S3–S10 on the latest synced data. Keeps the earlier brief version |
| `schedule.updated` | XER upload parsed | debounce 10 min per project (verify Inngest debounce config) | Recomputes float diffs and schedule findings. **No brief is sent.** Results feed the next nightly run |
| `findings.recompute` | `sync.completed` for M1 resources | debounce 5 min | M1 can run rules without a brief, so the overdue list in the UI stays current |
| `question.asked` (M3 chat) | user message | per-user concurrency 2; 60 s budget | Agentic loop limited to T0 tools. Same citation and verifier rules as the brief (§9.3) |
| `approval.expire` | cron every 15 min | idempotent | Expires stale approvals (§11) |
| `purge.project` | disconnect + 30 days, or admin action | idempotent | Deletes intelligence rows for the project. Runs alongside the Lead Engineer's purge job |
| `hot.alert` (V2) | webhook-fed `event_log` event matching a hot rule | debounce 30 min per (project, rule) | Intra-day ping for notice-window or critical-path-threat items only |

### 7.2 Debouncing and noise control
- Findings are **fingerprinted** (`rule_id|entity_type|key`), so a re-run never duplicates them.
- An insight re-surfaces as **NEW** only if its fingerprint is new. **WORSE** requires a severity increase, an impact increase of at least 20% or at least 2 days, or a deadline crossing (e.g. days_to_deadline ≤ 2).
- A muted item stays muted until it gets WORSE. Mutes are logged as feedback.

### 7.3 Hot alerts (V2)
Allowed only for notice windows closing in ≤ 2 business days and for critical-path threats with ≥ 5 days of exposure that first appear mid-day. Everything else waits for the morning brief.

---

## 8. Agent roster and agent-to-agent contracts (MVP)

"Agent" here means a bounded LLM step with a fixed system prompt (`prompts/`), a fixed tool allow-list, and a JSON-schema output. Only the orchestrator is code, and only the M3 chat agent loops.

| # | Agent | Kind | Model tier (§10) | Inputs | Output contract | Tools | Tier |
|---|---|---|---|---|---|---|---|
| 0 | **Orchestrator** | Code (Inngest), plus a model only for chat planning | — / M | run context | stage results, gaps | all T0 (chat) | T0 |
| 1 | **Schedule analyst** | LLM step | M | schedule findings, float diffs, linked records, freshness | `AnalystOutput` | T0 schedule + links | T0 |
| 2 | **Cost analyst** | LLM step | M | budget/contingency findings, change events, pay-app findings | `AnalystOutput` | T0 cost | T0 |
| 3 | **RFI / submittal analyst** | LLM step (M1 rules are pure code; this step explains and groups) | S→M | RFI/submittal findings, linked activities | `AnalystOutput` | `get_rfis`, `get_submittals`, links | T0 |
| 4 | **Procurement analyst** | LLM step | M | ROS/lead-time findings, commitments, vendor emails | `AnalystOutput` | T0 | T0 |
| 5 | **Communications & decisions analyst** | LLM extraction (per email) + LLM step (per run) | S (extract) / M (reason) | emails, meeting items, decisions register | `EmailExtraction[]`, `AnalystOutput` | `get_project_emails`, `get_decisions_register` (+ requested `get_meetings`) | T0 / T1 (register update) |
| 6 | **Correlator ("project executive")** | LLM step | **L** | all `AnalystOutput`s, the link graph, the playbook, the prior narrative | `CorrelatedInsight[]` | T0 read + `get_entity_links`, `diff_snapshots` | T0 |
| 7 | **Verifier / critic** | Code first, then an LLM | code + M (different provider from the correlator when available) | claims + cited records | `VerifierVerdict[]` | `resolve_refs`, `compute_impact` | T0 |
| 8 | **Brief writer** | LLM step | M | verified insights, ranking, length budget | `BriefDocument` (DAILY_BRIEF_SPEC §7) | none (no tools: it may only use what it is handed) | T1 (save brief) |

### 8.1 Contracts (abbreviated; the full JSON schemas live in the prompt files)

```jsonc
// Finding (layer 1, deterministic) -- see evals/fixture/m1/day2/findings.json
{ "id", "rule_id", "fingerprint", "severity", "days_overdue", "governing_date", "evidence": {...}, "citations": [{"ref","fields"}] }

// AnalystOutput (one per domain analyst)
{ "domain": "schedule|cost|rfi_submittal|procurement|comms",
  "candidates": [{ "candidate_id", "headline", "finding_ids": [], "record_refs": [],
                   "mechanism": "why this matters, construction logic",       // reasoning, not a claim
                   "claims": [{ "text", "claim_type", "citations": [{"ref","field","value","as_of","quote"}] }],
                   "impact_inputs": { "activity_ids": [], "delay_days_basis": "...", "usd_basis": "..." },  // inputs, not numbers
                   "suggested_owner_role", "suggested_action", "self_confidence": 0.0 }],
  "gaps": [{ "source", "reason" }] }

// CorrelatedInsight (correlator)
{ "insight_id", "playbook_rule_ids": ["PB-01"], "merged_candidate_ids": [], "headline", "narrative_claims": [Claim],
  "impact_request": { "type": "delay_chain|usd_sum|contingency|notice_window|ros_margin", "params": {...} },  // code computes
  "owner": {"person_ref","role"}, "action": {"text","due_by_rule"}, "confidence_factors": {...} }

// VerifierVerdict
{ "claim_id", "status": "pass|downgraded|dropped", "reasons": ["uncited|ref_not_found|value_mismatch|stale_source|overreach"],
  "corrected_value": null, "final_confidence": 0.0, "final_label": "Confirmed|Likely|Signal|suppressed" }
```

**Why analysts emit `impact_inputs` and never numbers:** a model is good at "this RFI blocks A1225, which drives A1230." It is bad at counting working days across Labor Day. Code owns the arithmetic (§9, S7).

---

## 9. Reasoning pipeline for the Daily Brief (step by step)

| Stage | What happens | Owner | Model? | Persisted |
|---|---|---|---|---|
| **S0 Freshness gate** | Read `Freshness` for every source and compute bands (§4). If Procore is missing or stale, the run continues but marks Procore sections partial. If every source is stale, publish a "data outage" brief and stop | code | no | `brief_runs.gaps` |
| **S1 Link keys** | Extract keys for entities changed since the last run (regex, alias table, field mapping; small model for email key/intent extraction) | code + S | S (emails only) | `link_keys` |
| **S2 Entity linking** | Tiers L0–L4 (§5.1), incremental | code + S/M | L4 only | `entity_links` |
| **S3 Deterministic rules** | Run the rule library: M1 RFI/submittal rules; M3 schedule float/driving-path, manpower, budget/contingency, PO-vs-ROS, pay-app-vs-earned, notice-window clocks. Rules emit **findings** with `days_overdue` and evidence | code | **no** | `findings` |
| **S4 Snapshot + diff** | Freeze today's snapshot. Diff against the prior business day's snapshot to label findings NEW / WORSE / UNCHANGED / RESOLVED | code | no | `project_snapshots` |
| **S5 Domain analysts** | Five parallel LLM steps. Each gets *its* findings plus their 1-hop linked records (trimmed to approved fields) plus freshness. Each groups, explains mechanism, proposes owner/action, cites | LLM | M | `insights` (draft), `claims` |
| **S6 Correlator** | One L-tier step. Gets all analyst outputs, the link components, the CORRELATION_PLAYBOOK, the prior rolling narrative, and the decisions register. Merges cross-domain candidates into insights (e.g. RFI + submittal + email + activity → PB-01), names composites (sub-distress PB-10), states mechanism, requests impact computations | LLM | **L** | `insights`, `claims` |
| **S7 Impact math** | Code fulfils each `impact_request`: working-day delay chains over the schedule network (float absorption, then the TCO shift), $ = calendar days × the configured daily delay cost, contingency math, notice deadlines from confirmed contract terms, ROS margins. Each result carries a `method` string | code | no | `insights.impact` |
| **S8 Verifier** | (a) **Code:** every claim has ≥ 1 citation; every ref resolves to a live, non-deleted row; every numeric assertion matches a recomputation (exact for ints/dates, ±0.5% for $); freshness caps applied. (b) **LLM (different provider):** does each cited record actually support the claim text (entailment)? Are there overreaches such as entitlement assertions, blame, or "will" vs. "may"? Claims that fail are dropped or downgraded. Insights left with no passing claim are dropped | code + M | M | `claims.verifier_status` |
| **S9 Rank + compose** | Code ranks with the product-spec impact score (DAILY_BRIEF_SPEC §5) and applies the 7-item and 700-word budgets. The brief writer turns verified insights into the JSON brief. Code re-checks that every rendered sentence maps to a verified claim (the writer may not add facts) | code + M | M | `briefs` |
| **S10 Deliver** | Store `brief_json` + rendered markdown, show in-app (M2), write audit. Email delivery needs a separate decision (no `Mail.Send` in V1; a SiteTech-domain sender would have to be approved) | code | no | `briefs`, `audit_log` |

### 9.1 Budgets
- Latency: the whole pipeline in **≤ 12 min** for one project.
- Cost target (hypothesis): **≤ $1.50 per project-day** at M3 data volumes (~30–80 emails/day, ~20 findings).
- LLM calls per run: about 1 (S1 batch) + ≤ 3 (L4) + 5 (S5) + 1 (S6) + 1–2 (S8) + 1 (S9) ≈ 12–15.

### 9.2 Context discipline
Each analyst sees only its findings, their linked records, and the approved fields of those records. That is typically 5–25 k tokens. The correlator sees analyst outputs, not raw records, plus a records index (`ref → label, key fields`) so it can cite. Raw email bodies reach S1 and S5-comms only.

### 9.3 On-demand questions (M3 chat box)
Plan → T0 tool calls (integrations `get_*` + intelligence tools) → draft answer with claims → the same S8 verifier → answer. If the answer needs data the tools can't reach, it says "not in connected systems" and names the gap. **Scope note:** the product spec v0.1 limits MVP Q&A to "why is this here / show me the source", while the CTO's M3 includes "the chat box." The design supports both. Sean should confirm the M3 scope (README).

---

## 10. Model routing (provider-neutral)

### 10.1 Provider interface
All calls go through one internal module built on the Vercel AI SDK (scaffold rule). Model IDs are configuration, never code.

```ts
interface LlmTask {
  task_class: "extract" | "classify" | "link_adjudicate" | "analyze" | "correlate" | "verify" | "write" | "chat_plan";
  messages: Message[]; tools?: ToolRef[];            // T0/T1 tools only; the T-tier allow-list is enforced here
  output_schema: JSONSchema;                         // structured output is mandatory, except for chat_plan
  max_tokens: number; temperature: number;           // 0 for extract/classify/verify, 0.2 for analyze/correlate/write
  trace: { org_id, project_id, run_id, stage, prompt_id, prompt_version };
}
// route(task_class) -> ordered list of {provider, model_id} from config; try in order on 429/5xx/timeout/schema-fail (1 repair retry)
```

### 10.2 Routing table

The tiers are capability classes, not vendors. Concrete IDs live in `config/models.ts` and must be confirmed against Sean's provider accounts (README, Open questions). Only no-training / zero-data-retention API terms are allowed.

| Task class | Tier | Why this tier | Primary → fallback (pattern) | Temp | Notes |
|---|---|---|---|---|---|
| Email key/intent extraction (S1), classification | **S** (small, fast, cheap) | High volume, narrow schema, easy to eval | Provider A small → Provider B small | 0 | Batch 10–20 emails per call |
| Link adjudication (L4) | **S→M** | Choosing among at most 5 candidates | A small → A medium | 0 | Escalate to M if the S result has confidence < 0.7 |
| Domain analysts (S5) | **M** (strong general model) | Construction reasoning over 5–25k tokens | A medium → B medium | 0.2 | |
| Correlator (S6) | **L** (frontier reasoning) | The product's differentiator: multi-hop cross-system inference | A large → B large | 0.2 | The single most expensive call, one per run |
| Verifier entailment (S8b) | **M**, **different provider from the correlator** | Avoids a model grading its own reasoning style | B medium → C medium | 0 | Falls back to the same provider if no second one is configured, with a `verifier_independence=false` flag on the run |
| Brief writer (S9) | **M** | Tone and length control | A medium → B medium | 0.2 | Writes only from verified claims |
| Chat planning (M3) | **L** | Tool-use planning | A large → B large | 0.2 | T0 tools only |
| Contract-term extraction (onboarding) | **L** | Rare, high stakes, human-confirmed | A large | 0 | |
| Embeddings (Mode A) | one pinned model per tenant | Changing models means a full re-embed | — | — | Dropped on delete or fingerprint change |

Model choice is driven by the evals: a model moves up or down a tier only on EVALS.md metrics, never on vibes. Each task class has a frozen eval subset, and a model swap must not lower citation precision or recall of planted risks.

---

## 11. Permission tiers, approvals, and audit

### 11.1 Tiers

| Tier | Meaning | Examples | V1 status |
|---|---|---|---|
| **T0 Read** | Read normalized data, compute, summarize, flag | all integrations `get_*`, plus `get_project_snapshot`, `diff_snapshots`, `get_float_changes`, `list_findings`, `get_entity_links`, `resolve_refs`, `compute_impact`, `get_decisions_register`, `get_contract_terms` | **On** |
| **T1 Internal write** | Writes inside SiteTech only. No external side effects | `upsert_findings`, `link_entities`, `save_brief`, `update_decisions_register`, `save_insights`, `create_draft_message` (a SiteTech draft record the user copies), `log_audit_event` | **On** |
| **T2 External / system-of-record write, requires approval** | Changes something outside SiteTech, or sends on someone's behalf | `send_email`, `submit_rfi`, `propose_schedule_change` (→ P6/Procore), `create_change_event`, Outlook draft creation (needs `Mail.ReadWrite`) | **Defined, disabled.** The tool returns `{status:"disabled_in_v1"}`. Read-only Procore client; no Graph write scopes |
| **T3 Never autonomous** | Money, contractual commitments, approvals of record | approve CO, approve pay app or payment, execute a commitment, issue a contractual notice, accept a substitution, release retainage | **Not tools at all.** The model may recommend; a human acts in the source system |

### 11.2 Approval workflow (for T2, built now so V2 can enable actions one type at a time)

```jsonc
// approvals.payload: what the human sees and signs off on; hashed so execution matches what was approved
{ "action_type": "submit_rfi", "tier": "T2", "target": {"system":"procore","project_external_id":"8800123"},
  "proposed_by": {"agent":"rfi_submittal_analyst","run_id":"..."},
  "summary": "Submit RFI: L2 chase clearance (draft from finding f_...)",
  "body": { /* exact API payload that would be sent */ },
  "rationale_claims": [ {"text":"...", "citations":[...] } ],
  "risk_notes": ["Creates a record visible to the architect"],
  "reversible": false, "expires_at": "2026-10-08T17:00:00-04:00" }
```
- **Approvers:** project-configured roles. V1 default: the brief reader (PX or Development Director) for the brief, and the GC PM for GC-side actions.
- **Expiry:** 48 h by default. If the action is tied to a deadline (a notice window, a quote expiry), expiry is min(48 h, deadline − 1 business day). An expired approval is never executed and must be re-proposed with fresh data.
- **Execution:** re-validates the `payload_hash` and re-checks the preconditions (the record still exists, its state hasn't changed since the proposal). It executes once, keyed by `approval_id` for idempotency, and writes `execution_result`.
- **Audit:** request, decision, execution, and failure each write an `audit_log` row.

---

## 12. Confidence, escalation, and freshness downgrades

### 12.1 Confidence score → label (aligned with the product spec labels)

The score is computed by code from the evidence:
`score = min(premise_scores) × corroboration × freshness_cap`
- **Premise scores:** system-of-record field 1.0; deterministic computation over SoR fields 0.95; L0/L1 link 0.95; L2 link 0.85; LLM extraction from email 0.75; L3/L4 link ≤ 0.8; LLM cross-record inference 0.65; single uncorroborated mention 0.45.
- **Corroboration:** ×1.1 per independent corroborating source, capped at 1.0.

| Score | Label (product spec) | How it may be stated | Ranking rule |
|---|---|---|---|
| ≥ 0.85 | **Confirmed** | As fact, with citations ("RFI 42 is 7 days overdue") | P(occurs)=0.9 |
| 0.65–0.85 | **Likely** | "Likely", with the evidence named ("likely slips TCO ~7 working days if the Oct 9 release is missed") | P=0.6 |
| 0.45–0.65 | **Signal** | "Needs verification", with the specific question for the owner | P=0.3; cannot be item #1 unless impact > 5 days or > $100k (product spec) |
| < 0.45 | **suppressed** | Not shown. Logged in `insights` with status `suppressed` | — |

### 12.2 Freshness caps
- **Schedule aging** (8–14 days since data_date): any claim whose *numbers* come from float or dates is capped at **Likely**, unless a fresher record independently corroborates it (e.g. a fabricator email dated today). The section header shows "aging".
- **Schedule stale** (15–28 d): capped at **Signal**, and the brief adds an action "request current XER".
- **Missing** (> 28 d): schedule impact is not computed at all; the brief prints "schedule impact unknown: no current schedule."
- **Procore or mailbox stale** (> 50 h): every claim relying on that source is capped at Likely. The brief opens with a data-freshness warning.
- **Unconfirmed contract terms:** notice-window items are capped at Signal and say "clause extracted, not yet confirmed by your team."

### 12.3 Escalation rules (what gets pushed up)
- **Top-7 floors** (DAILY_BRIEF_SPEC §5.3): critical/near-critical activity (TF ≤ 5 wd) with ≥ 2 days of exposure (product spec); any open contractual notice window closing within ≤ 10 business days; owner-contingency escalation (below).
- **Hot (V2 intra-day):** notice window ≤ 2 business days; new critical-path threat ≥ 5 days.
- **Owner-side escalation tag** (the developer reader must act): owner decision overdue; contingency used (including pending) > (percent complete + 30 points) or remaining contingency < 2× the trailing 30-day burn; the lender's visit falls within 10 days of an overbilling signal.
- **Never escalated as fact:** entitlement, fault, or "claim validity." These are always phrased as "notice received; entitlement is a human decision."

---

## 13. Hallucination prevention (defense in depth)

1. **No-cite, no-claim.** Every claim carries ≥ 1 citation `ref` that resolves to a live row. The verifier drops uncited claims (CTO layer 3).
2. **Numbers come from code.** Analysts and the correlator emit `impact_inputs` / `impact_request`; S7 computes. The verifier recomputes every number in the final text (regex-extracts numbers and dates, then matches them to `numeric_assertions`). A mismatch drops the claim, or the number is replaced with the computed value and the claim is flagged.
3. **Closed-book writing.** The brief writer has no tools and receives only verified claims. A post-check maps every sentence to claim IDs, and an unmapped sentence is removed.
4. **Records index, not free recall.** Models cite from a provided `ref → label` index. A ref outside the index fails immediately.
5. **Explicit no-data path.** Prompts require `gaps[]` and the phrase "not in connected systems." A model that would have to guess must return a gap instead.
6. **Entailment check by a second model** (S8b) against the cited fields and quotes, different provider when available.
7. **Overreach lint** (code + LLM): flags "will", "caused by", "responsible", "liable", "breach", and "entitled" unless they are quoted from a source.
8. **Eval gates in CI** (EVALS.md): citation precision ≥ 98% and zero fabricated record numbers on the fixture, or the deploy fails.

---

## 14. Audit and LLM tracing (Supabase tables; no extra vendor in V1)

```sql
audit_log (                      -- append-only; INSERT-only RLS policy; no UPDATE/DELETE except purge job
  id uuid pk, org_id, project_id, occurred_at timestamptz, actor_type text check (actor_type in ('agent','user','system')),
  actor_id text, action text,     -- e.g. 'brief.published','finding.upserted','link.accepted','approval.requested','approval.decided',
                                  --      'tool.called','tool.denied','purge.executed','config.changed'
  tier text check (tier in ('T0','T1','T2','T3')), target_ref text, run_id uuid, approval_id uuid,
  input_hash text, output_hash text, details jsonb, prev_hash text, row_hash text   -- hash chain for tamper evidence
);
llm_traces (                     -- one row per model call
  id uuid pk, org_id, project_id, run_id, stage text, task_class text, prompt_id text, prompt_version text,
  provider text, model_id text, attempt int, fallback_from text, started_at, latency_ms int,
  input_tokens int, output_tokens int, cost_usd numeric(10,5), status text,      -- ok|schema_fail|timeout|429|5xx|refused
  request_redacted jsonb, response_redacted jsonb,   -- Mode A: approved fields only; PII redaction for logs
  output_schema_valid bool, tool_calls jsonb, error text
);
```
- **Retention:** `llm_traces` request/response bodies are kept 30 days; metadata is kept for the project's life (purged with it).
- **Views:** `v_run_cost` (cost per brief), `v_model_quality` (joins eval scores), `v_tool_denials`.
- **Reproducibility:** every brief can be traced to its exact findings, claims, verifier verdicts, prompts, and model IDs.

---

## 15. Failure recovery

| Failure | Behavior |
|---|---|
| A source sync failed or is stale | S0 marks it. Affected sections render with "partial: Procore not synced since 10/5 04:31." Claims from the stale source are capped (§12.2). The brief still ships |
| XER missing or old | Schedule section says so explicitly. No schedule $ math beyond what fresher records support |
| LLM 429/5xx/timeout | Fallback chain (§10). Schema failure gets 1 repair retry, then the fallback provider. If an analyst still fails, its findings go into the brief as a **deterministic list** (rule titles + citations), labeled "not analyzed" |
| Correlator fails | The brief ships with per-domain analyst insights, uncorrelated, and a gap note |
| Verifier fails | **The brief is held.** Nothing unverified is ever published. A deterministic findings-only brief goes out at the deadline (06:10) instead |
| Duplicate trigger | Idempotency key per (project, as_of, pipeline_version). A step that already completed is skipped |
| A deleted source record is cited in an old brief | The old brief is not changed (audit integrity). The UI shows "source record deleted" on click-through |
| Disconnect | 30-day countdown, then `purge.project` deletes intelligence rows; the Lead Engineer's purge handles the rest. Audit keeps a purge receipt with counts only |

---

## 16. Security, tenancy, and permission inheritance

- **Tenancy:** the scaffold sets `org_id` on every table and `project_id` on every domain row, with RLS on all tables. The integrations JSON says `tenant_id`; see RECONCILE R1. Service-role access happens only inside Inngest functions.
- **Permission inheritance:** the DMSA sees everything its permission template allows, which is **project-wide**, not per user. So, in V1:
  - (a) Brief audiences are limited to project leadership roles configured at onboarding.
  - (b) Procore records flagged `private: true` are excluded from briefs by default (configurable per role).
  - (c) Email content is shown only to users who would normally see the project mailbox (configured list).
  - (d) M3 chat users get the same visibility as the brief audience until per-user Procore permission mapping exists (V2: map SiteTech users to Procore directory users and filter by their tool permissions, verify the API).
- **Data minimization (Mode A):** approved fields only, no files, deletes carried through nightly, purge 30 days after a disconnect, no training, no-training model APIs only. Embeddings are derived data and follow the same lifecycle.
- **Prompt-injection hygiene:** email bodies are untrusted input. They are passed as quoted data blocks with an instruction hierarchy. Models cannot call T2 tools, and in V1 T2 is disabled anyway. Extracted "instructions" inside emails are ignored and logged.
- **Firewall:** SiteTech data and agents must never touch Sean's day-job systems or accounts (see README notes).

---

## 17. Milestone mapping

| Component | M1 (RFIs + submittals) | M2 (email + first brief) | M3 (cost, field, schedule, chat) |
|---|---|---|---|
| Rules → `findings` | RFI-OVERDUE, SUB-REVIEW-OVERDUE, SUB-SUBMIT-BY-MISSED, SUB-ROS-RISK, SUB-REV-LOOP | + email-derived findings (notice language, vendor date slips, decision requests) | + float diffs, manpower, contingency, PO-vs-ROS, pay-app-vs-earned, inspections |
| Linking | L0/L1 among RFI↔submittal (spec, location) | + email L1–L4 | + activity map, commitments, budget lines |
| Snapshots/diff | findings lifecycle only | full snapshot + NEW/WORSE/closed | + KPI roll-ups |
| Agents | none (rules only; UI list) | RFI/sub analyst, comms analyst, correlator (limited), verifier, writer | all analysts, full correlator, chat |
| Evals | M1 findings exact-match vs fixture | brief recall/precision on M1+M2 subset | full fixture |

---

## 18. Risks and how the design hedges them

1. **Procore policy** (copies/AI): Mode A approved with minimization; Mode B ready as a fallback; get Procore's written position (integrations D1/D2).
2. **Thin data:** ROS and lead time often go unfilled, and some projects carry no `scheduled_task` links. The system reports this as a gap and generates an onboarding task to fill long-lead dates.
3. **Single-mailbox blindness:** most project email may never hit the project mailbox. Measure coverage in week 1 (how many emails cite RFI numbers that exist in Procore) and recommend a CC/BCC habit or a transport rule.
4. **Schedule staleness:** a weekly XER means schedule claims are often "aging." Corroborate with fresher sources, and show the freshness, rather than pretending.
5. **Over-alerting:** the 7-item budget, the WORSE thresholds, and mute-as-feedback handle it. Measure the false-alarm rate (EVALS.md).
6. **Pilot scope drift** (`pilot-ask-one-pager.md`): the pilot's Procore read template leaves out Meetings and Drawings, and its consent text lists stored fields only for RFIs and submittals. Decisions then fall back to email plus SharePoint minutes, and the M3 record types run Mode B until their field lists are approved (RECONCILE R21–R23).
