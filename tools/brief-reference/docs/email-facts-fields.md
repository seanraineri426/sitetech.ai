# email_facts: field list for the Lead's migration (2026-10-09)

Source of truth: `evals/harness/email_facts.py` (`EMAIL_FACT`, `RFI_FACT`), prompt `prompts/email_facts_extractor.md` / `rfi_facts_extractor.md`.
Architecture (CTO 2026-10-09): **extraction** (model reads, never judges) writes these rows; **judgment** (code,
`evals/harness/fact_rules.py`) joins them to `schedule_activities` / `submittals.schedule_activity_id` / RFIs / change events, compares
dates with activity start and total float, computes `$ = max(0, slip - float) x daily_delay_cost`, ranks (zero-float slip with $ = #1).
A fact whose `quote` is not verbatim in the email is dropped by code before judgment. One email -> 0..6 rows.

## email_facts (one row per extracted fact)

| name | type | nullable | notes |
|---|---|---|---|
| id | uuid | no | PK |
| org_id, project_id | uuid | no | tenancy (RLS like every project table) |
| email_id | uuid / text | no | FK to the stored email (message ref `msgraph_outlook:message:<id>`) |
| fact_index | smallint | no | order within the email; (email_id, fact_index, extraction_id) unique |
| kind | text enum | no | `schedule_date_change`, `conditional_slip`, `conditional_risk`, `no_change`, `need_by_date`, `received_on_site`, `formal_notice`, `pricing_or_change_request`, `inquiry_or_hypothetical`, `other` |
| item | text (<=80) | no | free-text noun phrase as written ("switchboards", "first truck"); may be "" |
| spec_section | text (<=20) | yes | only if written in the email |
| submittal_no | text (<=30) | yes | as written (e.g. `26 24 13-001`); judgment normalizes and joins to `submittals.formatted_number` -> `schedule_activity_id` |
| rfi_no | text (<=12) | yes | as written; joins to RFI number |
| ce_no | text (<=20) | yes | as written (CE / PCO number) |
| old_date | date | yes | previous/original date if stated ("can't make the 11/2 date") |
| new_date | date | yes | new date resolved against the email's sent date (project time zone); earliest date of a range; null when only a duration is stated |
| new_date_high | date | yes | latest date of a range |
| delay_days | smallint | yes | stated delay in calendar days when given as a duration relative to an unstated original ("4 weeks longer" = 28; "about a month" = 30; low end of a range) |
| delay_days_high | smallint | yes | high end of a duration range ("3-4 wks" -> 21 / 28) |
| date_phrase | text (<=120) | yes | raw words carrying the date/duration (kept for audit) |
| date_basis | text enum | no | `explicit`, `relative_to_sent`, `relative_to_original`, `range`, `vague`, `none` (vague -> item labelled Likely) |
| amount_usd | numeric(14,2) | yes | dollar amount stated for this fact |
| notice_types | text[] enum | no (may be empty) | `delay_time_extension`, `cost_change_claim`, `cure_default`, `differing_site_condition`, `other`; `formal_notice` facts only. Both delay + cost allowed (two deadlines when both period rows exist). Maps to `project_notice_periods.notice_type` via `notices.PERIOD_TYPE` |
| sender_party_id | uuid | yes | FK `project_parties`; **set by code from the sender domain**, null = unknown party (notice deadline then unknown) |
| sender_party_label | text (<=90) | no | `Company (role)` or `unknown party`; the only sender form a model ever sees (no raw addresses) |
| sender_party_model | text | yes | what the model wrote, kept only when it differs from the code label (QA) |
| quote | text (<=220) | no | verbatim span from subject/body supporting the fact; non-verbatim -> row not written (or `verified=false`) |
| confidence | text enum | no | `high`, `medium`, `low` |
| sent_local_date | date | no | email sent date in project time zone (the resolution anchor given to the model) |
| verified | boolean | no | code checks passed (schema, verbatim quote) |
| drop_reason | text | yes | why code rejected the fact (`schema`, `quote not verbatim`) |
| extraction_id | uuid | no | FK to an extraction run row below |
| created_at | timestamptz | no | |

## email_fact_extractions (one row per model call / cache entry)

| name | type | nullable | notes |
|---|---|---|---|
| id | uuid | no | PK |
| org_id, project_id | uuid | no | |
| input_sha | text(24) | no | sha256(prompt_version + kind + model + prompt + schema + input)[:24]; cache key: same input never billed twice |
| kind | text | no | `email` or `rfi` |
| model | text | no | e.g. `anthropic:claude-sonnet-5-5` (pilot: direct Anthropic ZDR) |
| prompt_version | text | no | `facts-v1` |
| contract_errors | jsonb | yes | schema errors left after the one repair call |
| cost_usd | numeric(10,6) | yes | |
| extracted_at | timestamptz | no | |

## rfi_facts (one row per RFI version)

| name | type | nullable | notes |
|---|---|---|---|
| id, org_id, project_id | uuid | no | |
| rfi_id | uuid | no | FK RFI (current revision) |
| scope_change | text enum | no | `adds`, `none`, `unclear` (official answer vs the documents; referenced ASI descriptions are given to the model) |
| scope_quote | text (<=220) | no | verbatim from the answer; non-verbatim -> code sets scope_change `unclear` |
| differing_site_condition | boolean | no | field condition differing from documents / surveys / geotech; non-verbatim `condition_quote` -> code sets false |
| condition | text (<=80) | no | e.g. "rock at elevator pit" |
| condition_quote | text (<=220) | no | verbatim from subject/question |
| amount_usd | numeric(14,2) | yes | stated in RFI text or impact fields |
| schedule_days | smallint | yes | stated schedule impact days |
| confidence | text enum | no | |
| extraction_id | uuid | no | FK email_fact_extractions (kind `rfi`) |

## Columns the judgment reads from 0002 (Lead)
`schedule_activities`: activity_id, name, early_start, early_finish, total_float (work days), predecessors, actual_start/finish,
on_driving_path flag, spec_sections, location. `submittals.schedule_activity_id` (fixtures: `schedule_activity_id`, falling back to the
Procore `scheduled_task` key). RFIs: due_date, status, spec_section, location, optional `schedule_activity_id`, cost/schedule impact
status + value. `project_notice_periods` unchanged. `projects.daily_delay_cost_usd` (fixtures: `delay_cost_basis.daily_delay_cost_usd`).

## Tenancy (CTO 2026-10-09)
All links (email_facts → emails, → schedule_activities, → submittals/rfis) are composite FKs including `org_id` (and `project_id` where both sides are project-scoped). Lead's isolation test covers the table automatically.
