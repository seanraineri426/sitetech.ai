# M1 seed tables: assumed columns (for reconciliation with the Lead Engineer's DDL)

*** ALL ROWS ARE FICTIONAL. *** Generated deterministically by `../build_fixture.py` (uuid5 IDs, no randomness). Files: `day1/` = as_of 2026-10-05, `day2/` = as_of 2026-10-06. Each file is a JSON array of table rows.

**Conventions**
- Every row has `id uuid` (SiteTech), `org_id uuid`, `project_id uuid`, `source text` (`procore`), `entity_type text` (`rfi` | `submittal`), `external_id text` (Procore id as string), and `source_url text`. Uniqueness: `(org_id, project_id, source, entity_type, external_id)` (scaffold rule).
- Nested Procore objects (`ball_in_court`, `specification_section`, `approvers`, …) are kept as **jsonb in Procore's shape**, so the mapping is reviewable. The Lead Engineer may flatten them. Flattened names suggested below.
- **Mode A allow-list (CTO-approved 2026-10-06):** the only free text stored is RFI `subject`, `questions[].plain_text_body` (question), `questions[].answers[].plain_text_body` (answer), and submittal `title`; spec section is stored as number + description. **No attachments, drawings, files, or descriptions.** The submittal `description` column was removed for this reason. Other Procore fields not listed here are not stored.
- `verify` = field name or shape not confirmed against the current Procore REST reference for this tenant's API version or configuration.

## `rfis` (`day*/rfis.json`)

| Column | Type | Procore source (RFI v1.0 `GET /rest/v1.0/projects/{id}/rfis/{id}`) | Notes |
|---|---|---|---|
| number, full_number, prefix | text | `number`, `full_number`, `prefix` | |
| revision, current_revision | text, bool | RFI revision fields | **verify** (RFI revisioning may be config-dependent) |
| subject | text | `subject` | Mode A text |
| status | text | `status` (`draft`/`open`/`closed` in fixture) | **verify** full enum. Integrations normalizes to include `answered` (RECONCILE R3) |
| draft, private, accepted | bool | `draft`, `private`, `accepted` | `accepted` **verify** |
| initiated_at, created_at | timestamptz | `initiated_at`, `created_at` | |
| due_date | date | `due_date` | Drives `RFI-OVERDUE` |
| time_resolved | timestamptz | `time_resolved` | **verify** name |
| ball_in_court_role | text | `ball_in_court_role` | **verify** |
| ball_in_court | jsonb `{id,login,name}` or null | `ball_in_court` | Integrations returns `Person[]` (RECONCILE R3). Suggested flat: `bic_person_ids int[]` |
| ball_in_courts | jsonb[] | `ball_in_courts` | **verify** (present in some API versions) |
| assignees, rfi_manager, received_from | jsonb | same | |
| responsible_contractor | jsonb `{id,name}` | `responsible_contractor` | |
| specification_section | jsonb `{id,number,description}` | `specification_section` | Link key `spec` |
| location | jsonb `{id,name}` | `location` | Link key `loc` (via alias table) |
| cost_code | jsonb or null | `cost_code` | Link key `cost_code` |
| drawing_number | text | `drawing_number` | **verify**. Link key `rec` (sheet) |
| reference | text | `reference` | |
| schedule_impact, cost_impact | jsonb `{status,value}` | `schedule_impact`, `cost_impact` | status ∈ `yes_known`/`yes_unknown`/`no_impact`/`tbd` (**verify** enum and per-company configurable fieldsets) |
| questions | jsonb[] `{id,question_date,plain_text_body,created_by,answers[{id,official,answer_date,plain_text_body,created_by}]}` | `questions[]` | Mode A text. `plain_text_body` **verify** (vs `body`). Suggested flat: `question_text`, `official_answer_text`, `answered_at` |

## `submittals` (`day*/submittals.json`), one row per revision

| Column | Type | Procore source (Submittals v1.1) | Notes |
|---|---|---|---|
| number, formatted_number | text | `number`, `formatted_number` | Series key = `formatted_number` |
| revision, current_revision | text, bool | `revision`, `current_revision` | **verify** `current_revision` name |
| title | text | `title` | Mode A text |
| status | jsonb `{id,name}` | `status` (`Draft`/`Open`/`Closed`) | Statuses are company-configurable (**verify**). R&R lives in `approvers[].response`, not `status` |
| type | jsonb or text | `type` | |
| specification_section | jsonb `{id,number,description}` | `specification_section` | |
| location_id, cost_code_id | int | `location_id`, `cost_code_id` | **verify** (some versions return nested objects) |
| responsible_contractor, received_from, submittal_manager | jsonb | same | |
| ball_in_court | jsonb[] `{id,login,name}` | `ball_in_court` | |
| approvers | jsonb[] `{id,user,workflow_group_number,sent_date,due_date,returned_date,response{id,name}}` | `approvers[]` | Needed for `SUB-REV-LOOP`. **verify** shape (workflow v2 may differ) |
| submit_by, issue_date, received_date, distributed_at, due_date, closed_at | date / timestamptz | same | `received_date` = GC received from sub |
| required_on_site_date | date | `required_on_site_date` | Integrations calls it `required_on_site` (RECONCILE R4) |
| lead_time, design_team_review_time, internal_review_time, buffer_time | int (days) | same | Calendar vs working days **verify** per tenant setting |
| is_rejected | bool | | **verify** |
| actual_delivery_date, confirmed_delivery_date | date | same | |
| scheduled_task | jsonb `{id,name,key}` | `scheduled_task` | Fixture `key` = `p6|A1230`, a SiteTech-added crosswalk (not Procore) |
| created_at | timestamptz | | |

## `findings` (`day*/findings.json`), intelligence-owned

| Column | Type | Notes |
|---|---|---|
| id | uuid | uuid5(fingerprint + run_date) |
| run_date | date | `as_of` of the run |
| rule_id, rule_version | text | `RFI-OVERDUE`, `SUB-REVIEW-OVERDUE`, `SUB-SUBMIT-BY-MISSED`, `SUB-ROS-RISK`, `SUB-REV-LOOP` (DAILY_BRIEF_SPEC §4.4–4.5) |
| entity_type, entity_id, source, external_id | text, uuid, text, text | Points at the `rfis`/`submittals` row |
| record_label, title | text | Human label. The title may include the RFI subject or submittal title (Mode A) |
| severity | text | low / medium / high / critical |
| status | text | open / resolved / suppressed |
| **days_overdue** | int NOT NULL DEFAULT 0 | Calendar days past `governing_date`. 0 for non-date rules |
| governing_date, governing_date_kind | date, text | `due_date` / `submit_by` / `latest_return_date` |
| ball_in_court | text | Display names (comma-separated). Could become person ids |
| spec_section | text | |
| fingerprint | text | `rule_id|entity_type|key`. **Unique per (project_id, run_date, fingerprint)** |
| first_detected_on, last_seen_on, resolved_on | date | Lifecycle (`carry_lifecycle`) |
| change_since_prior_run | text | new / worse / better / unchanged / resolved |
| evidence | jsonb | Field values the rule used (and `computed.*` values) |
| citations | jsonb[] `{ref, fields[]}` | `ref = source:entity_type:external_id` |

**Day 2 expected rows:** 11 findings (10 open + RFI 38 resolved). See the build output and `../expected_findings.json`.
