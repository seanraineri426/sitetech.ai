# M1 findings table — column contract (Lead-aligned 2026-10-06)

**Context:** CTO 2026-10-06 — M1 ships without the brief 10/11 gate. M1 = deterministic findings from RFIs and submittals, findings page, citations. PM acceptance: a PE opens the findings page, sees overdue/blocking RFIs and submittals with citations, and trusts every item maps to a real record.

**Sources of truth for shapes:** Linden fixture `m1/*/findings.json` row keys; intelligence `rule_id`s already emitting RFI/submittal findings. Email/schedule correlation stays M2 brief layer (not required for this table).

**Status:** Lead reviewed the proposal; this file matches their migration conventions. Findings is its own migration after 0002 (rfis/submittals + connector tables). Does not block PR #2 / Task 3.

## Columns (v1 — Lead-aligned)

| Column | Type / notes | Required |
|--------|----------------|----------|
| `id` | uuid | yes |
| `org_id` | uuid | yes |
| `project_id` | uuid | yes |
| `entity_type` | `rfi` \| `submittal` | yes |
| `rfi_id` | uuid nullable FK → `rfis`; exactly one of `rfi_id` / `submittal_id` set per `entity_type` (check constraint) | when `entity_type=rfi` |
| `submittal_id` | uuid nullable FK → `submittals`; same exclusivity check | when `entity_type=submittal` |
| `external_id` | Procore id (string/int as stored) | yes |
| `source` | e.g. `procore` | yes |
| `rule_id` | e.g. `RFI-OVERDUE`, `SUB-REVIEW-OVERDUE`, `SUB-RR-NOT-RESUBMITTED`, `SUB-ROS-RISK`, `SUB-SUBMIT-BY-MISSED`, `RFI-CLOSED-IMPACT-NO-CE` | yes |
| `rule_version` | string | yes |
| `fingerprint` | stable dedupe key for carry-forward | yes |
| `title` | short PE-facing title | yes |
| `record_label` | e.g. `RFI 42`, `Submittal 12` | yes |
| `status` | `open` \| `resolved` \| `suppressed` (lifecycle) | yes |
| `severity` | `critical` \| `high` \| `medium` \| `low` (or existing enum) | yes |
| `days_overdue` | int ≥ 0 | when applicable |
| `governing_date` | date | when applicable |
| `governing_date_kind` | e.g. `due` \| `responsible` \| `ros` \| `install_start` (not Procore ball_in_court) | when applicable |
| `responsible_party` | text PE-facing label only (assignee / responsible contractor name); **never** an email | optional |
| `spec_section` | text | optional |
| `citations` | jsonb array of `{ source, entity_type, external_id, label? }` — API rejects any citation that does not resolve to a synced row | yes |
| `evidence` | jsonb (computed fields used by the rule; PE may see a subset) | yes |
| `change_since_prior_run` | `new` \| `worsened` \| `unchanged` \| `improved` \| `resolved` | yes |
| `first_detected_on` | date | yes |
| `last_seen_on` | date | yes |
| `resolved_on` | date nullable | no |
| `run_date` | date of the deterministic pass that wrote/updated the row | yes |
| `cost_exposure_usd` | numeric nullable — **only** from RFI/submittal impact fields and/or slip × `daily_delay_cost` (no budget lines in M1/M2) | no |

**Dropped vs first proposal:** denormalized `location` (join `rfis.location` on the page); polymorphic `entity_id` (replaced by typed FKs); `ball_in_court` (renamed `responsible_party`, no email).

## Indexes / constraints
- CTO 2026-10-09: every cross-table link is a composite FK on `(org_id, id)` (plus `project_id` where both sides are project-scoped) — so `rfi_id`/`submittal_id` FKs are `(org_id, project_id, rfi_id)` → rfis, etc. Covered by Lead's standing catalog-driven isolation test.
- Unique `(org_id, project_id, fingerprint)` — `org_id` on every unique constraint (same as rfis/submittals). Partial unique while `status=open` is fine if reopen history is needed; otherwise fingerprint alone across the project + soft-resolve old rows.
- Indexes: `(org_id, project_id, status, severity)`, `(org_id, project_id, entity_type)`, `(org_id, project_id, run_date)`
- RLS: `is_org_member` / `has_org_role`. Writes only from the service-role job that runs the rules pass.
- Citations: API layer rejects any citation whose `(source, entity_type, external_id)` does not resolve to a synced row.

## Out of M1 findings table
- Email-only findings, notices, owner directives, schedule-slip from mail (M2 brief)
- Daily logs, inspections, budget/contingency (M3)
- Raw email addresses (never); party labels via `project_parties` when M2 needs them
- Procore `ball_in_court` / emails (Integrations allowlist dropped them)

## API / page behavior (Product + Lead)
- List: open findings for a project, default sort severity then days_overdue desc
- Each row links to the underlying RFI/submittal record (deep link or drawer); RFI location from join, not denormalized
- Resolved findings available behind a filter, not on the default PE view

## Emitter handoff
No extra columns needed from current M1 `rule_id`s beyond this list. When Lead opens the findings migration after 0002, Agent Engineer maps emitters → columns from this contract.
