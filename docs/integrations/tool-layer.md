# Standardized Construction Tool Layer

The SiteTech agent exposes a unified tool layer that abstracts across integrated systems (Procore, Microsoft Graph, Primavera P6). All tools are called by the single "Ask SiteTech" agent. This layer enforces data provenance: **every date, dollar figure, and record number must come from stored records**; the verifier checks compliance.

## READ Tools

### get_project

**Purpose**: Retrieve project metadata and key stakeholders.

**Inputs**:
- `project_id` (string, required): Internal SiteTech project identifier

**Outputs**:
- `project_id` (string)
- `name` (string)
- `address` (string)
- `start_date` (date, ISO 8601)
- `planned_completion_date` (date, ISO 8601)
- `contract_value` (decimal, USD)
- `general_contractor` (object): `{name, contact_email}`
- `owner` (object): `{name, contact_email}`
- `architect` (object): `{name, contact_email}`
- `project_executive` (object): `{user_id, name, email}` (SiteTech PX role)
- `project_manager` (object): `{user_id, name, email}` (SiteTech PM role)
- `superintendent` (object): `{user_id, name, email}` (SiteTech Super role)

**Source Tables**:
- `projects`
- `project_parties`
- `project_members` (filtered by `role` in ['PX', 'PM', 'Super'])

**Validation Rule**: All date and currency values must reference `projects` table records; verifier checks `source_project_id` matches query.

---

### get_rfis

**Purpose**: Retrieve Request for Information (RFI) records for a project.

**Inputs**:
- `project_id` (string, required)
- `status` (string, optional): Filter by status (`open`, `closed`, `overdue`)
- `assigned_to` (string, optional): Filter by SiteTech user_id or role (`PE`, `Super`, `PM`, `PX`)
- `updated_since` (date, optional, ISO 8601): Return only RFIs updated after this date

**Outputs**: Array of RFI objects
- `rfi_number` (string): Procore RFI number
- `subject` (string)
- `question` (string): Question body text
- `status` (string): `draft`, `open`, `closed`, `void`
- `priority` (string): `low`, `normal`, `high`
- `assignee` (object): `{user_id, name, email}` (Procore assignee mapped to SiteTech user)
- `rfi_manager` (object): `{user_id, name, email}`
- `created_date` (date, ISO 8601)
- `due_date` (date, ISO 8601)
- `response_date` (date, ISO 8601, nullable)
- `days_open` (integer): Calculated from created_date and current date or response_date
- `source_system` (string): `procore`
- `source_url` (string): Deep link to Procore RFI

**Source Tables**:
- `rfis` (synced from Procore `/projects/{id}/rfis`)
- `project_members` (for assignee/manager mapping)

**Validation Rule**: All RFI numbers, dates, and assignee IDs must exist in `rfis` table; verifier checks `rfi_number` and `source_system='procore'`.

---

### get_submittals

**Purpose**: Retrieve submittal tracking records for a project.

**Inputs**:
- `project_id` (string, required)
- `status` (string, optional): Filter by status (`pending`, `approved`, `rejected`, `revise_and_resubmit`)
- `spec_section` (string, optional): Filter by specification section (e.g., "03 30 00 - Cast-in-Place Concrete")
- `overdue_only` (boolean, optional): Return only overdue submittals

**Outputs**: Array of submittal objects
- `submittal_number` (string): Procore submittal number
- `title` (string)
- `spec_section` (string): Specification section code and title
- `status` (string): `for_information`, `pending`, `approved`, `approved_as_noted`, `revise_and_resubmit`, `rejected`
- `revision_number` (string): Current revision (e.g., "Rev 02")
- `received_from` (object): `{vendor_id, vendor_name}` (subcontractor/vendor)
- `responsible_contractor` (object): `{vendor_id, vendor_name}`
- `assignee` (object): `{user_id, name, email}` (Procore assignee mapped to SiteTech user)
- `received_date` (date, ISO 8601)
- `due_date` (date, ISO 8601)
- `approved_date` (date, ISO 8601, nullable)
- `days_pending` (integer): Calculated from received_date
- `source_system` (string): `procore`
- `source_url` (string): Deep link to Procore submittal

**Source Tables**:
- `submittals` (synced from Procore `/projects/{id}/submittals`)
- `project_members` (for assignee mapping)
- `vendors` (for vendor details)

**Validation Rule**: All submittal numbers, dates, and vendor IDs must exist in `submittals` table; verifier checks `submittal_number` and `source_system='procore'`.

---

### get_schedule

**Purpose**: Retrieve project schedule data including activities, critical path, and float analysis.

**Inputs**:
- `project_id` (string, required)
- `filter` (string, optional): `critical_path_only`, `in_progress_only`, `overdue_only`
- `wbs_path` (string, optional): Filter by WBS path (e.g., "Project > Structural > Foundations")
- `min_total_float` (integer, optional): Return activities with total float >= this value (in days)
- `max_total_float` (integer, optional): Return activities with total float <= this value (in days)

**Outputs**: Object with schedule summary + array of activities
- `schedule_summary` (object):
  - `project_name` (string)
  - `data_date` (date, ISO 8601): As-of date for schedule snapshot (XER upload timestamp)
  - `planned_completion` (date, ISO 8601)
  - `forecasted_completion` (date, ISO 8601): Latest finish date of all incomplete activities
  - `days_behind_schedule` (integer): Delta between planned and forecasted
  - `critical_path_activities` (integer): Count of activities with total float <= 0
- `activities` (array):
  - `activity_id` (string): P6 activity ID
  - `activity_name` (string)
  - `wbs_path` (string): Full WBS hierarchy path
  - `status` (string): `not_started`, `in_progress`, `completed`
  - `planned_start` (date, ISO 8601)
  - `planned_finish` (date, ISO 8601)
  - `actual_start` (date, ISO 8601, nullable)
  - `actual_finish` (date, ISO 8601, nullable)
  - `remaining_duration` (integer, days)
  - `total_float` (integer, days): Positive = slack time, zero or negative = critical path
  - `free_float` (integer, days)
  - `is_critical` (boolean): total_float <= 0
  - `percent_complete` (integer): 0-100
  - `predecessors` (array): `[{activity_id, relationship_type, lag_days}]`
  - `successors` (array): `[{activity_id, relationship_type, lag_days}]`

**Source Tables**:
- `p6_activities` (parsed from weekly XER uploads)
- `p6_relationships` (predecessors/successors)
- `p6_wbs` (WBS hierarchy)
- `xer_uploads` (upload timestamp for data_date)

**Validation Rule**: All activity IDs, dates, float values, and duration calculations must come from `p6_activities` table; verifier checks `activity_id` and `data_date` matches latest upload.

---

### get_email_facts

**Purpose**: Retrieve extracted facts from project email conversations (decisions, action items, questions, commitments).

**Inputs**:
- `project_id` (string, required)
- `participant_email` (string, optional): Filter emails involving this participant
- `date_range` (object, optional): `{start_date, end_date}` (ISO 8601)
- `fact_type` (string, optional): `decision`, `action_item`, `question`, `commitment`
- `conversation_id` (string, optional): Microsoft Graph conversationId to get full thread

**Outputs**: Array of email fact objects
- `fact_id` (string): Internal identifier
- `fact_type` (string): `decision`, `action_item`, `question`, `commitment`
- `summary` (string): AI-extracted summary of the fact (1-2 sentences)
- `extracted_from` (object):
  - `message_id` (string): Microsoft Graph message ID
  - `conversation_id` (string): Microsoft Graph conversationId for threading
  - `subject` (string)
  - `from` (string): Sender email
  - `to` (array): Recipient emails
  - `date` (date, ISO 8601)
- `context` (string): Relevant excerpt from email body (plain text, ~200 chars)
- `participants` (array): All unique email addresses in the conversation thread
- `related_entities` (array): `[{type, identifier, name}]` where type in [`rfi`, `submittal`, `activity`] if detected in email
- `confidence` (string): `high`, `medium`, `low` (AI extraction confidence)

**Source Tables**:
- `email_facts` (AI-extracted facts)
- `emails` (raw message data from Microsoft Graph)
- `email_participants` (sender/recipient mapping)

**Validation Rule**: All message IDs, conversation IDs, dates, and participant emails must exist in `emails` table; verifier checks `message_id` and `conversation_id` are valid.

**Note**: Email body content and participant emails are RLS-protected and never sent to the model directly; only extracted facts are exposed.

---

### get_findings

**Purpose**: Retrieve AI-generated findings (issues requiring attention) for a project.

**Inputs**:
- `project_id` (string, required)
- `severity` (string, optional): Filter by `critical`, `high`, `medium`, `low`
- `category` (string, optional): Filter by `schedule_slip`, `overdue_rfi`, `overdue_submittal`, `change_event`, `notice`
- `assigned_to` (string, optional): Filter by SiteTech role (`PE`, `Super`, `PM`, `PX`) or user_id
- `status` (string, optional): `new`, `acknowledged`, `in_progress`, `resolved`, `dismissed`

**Outputs**: Array of finding objects
- `finding_id` (string): Internal identifier
- `category` (string): `schedule_slip`, `overdue_rfi`, `overdue_submittal`, `change_event`, `notice`
- `severity` (string): `critical`, `high`, `medium`, `low`
- `title` (string): Short description (e.g., "RFI 023 overdue by 14 days")
- `description` (string): Detailed explanation with facts and record references
- `assigned_to` (object): `{user_id, name, role}` (SiteTech user or role; defaults to PM if no specific assignee)
- `created_date` (date, ISO 8601)
- `due_date` (date, ISO 8601, nullable): When action is required
- `status` (string): `new`, `acknowledged`, `in_progress`, `resolved`, `dismissed`
- `evidence` (array): Supporting records
  - `{type, record_id, record_number, source_system, source_url}`
  - Example: `{type: 'rfi', record_id: '12345', record_number: 'RFI-023', source_system: 'procore', source_url: 'https://...'}`
- `suggested_actions` (array of strings): Recommended next steps

**Source Tables**:
- `findings` (AI-generated issues)
- `finding_evidence` (links to source records)
- `project_members` (for assignment)

**Validation Rule**: All record IDs, record numbers, dates, and user assignments in `evidence` array must reference existing records in source tables (rfis, submittals, p6_activities, emails); verifier checks foreign key integrity.

---

### get_project_parties

**Purpose**: Retrieve project stakeholder organizations (owner, GC, architects, engineers, subcontractors).

**Inputs**:
- `project_id` (string, required)
- `party_type` (string, optional): Filter by `owner`, `general_contractor`, `architect`, `engineer`, `subcontractor`, `vendor`

**Outputs**: Array of party objects
- `party_id` (string): Internal identifier
- `party_type` (string): `owner`, `general_contractor`, `architect`, `engineer`, `subcontractor`, `vendor`
- `company_name` (string)
- `contact_name` (string, nullable): Primary contact
- `contact_email` (string, nullable)
- `contact_phone` (string, nullable)
- `address` (string, nullable)
- `vendor_id` (string, nullable): Procore vendor ID if applicable
- `source_system` (string): `procore`, `manual`

**Source Tables**:
- `project_parties` (company stakeholders)
- `vendors` (synced from Procore)

**Validation Rule**: All party IDs and vendor IDs must exist in `project_parties` or `vendors` tables; verifier checks `party_id` is valid.

---

### get_project_members

**Purpose**: Retrieve project team members with their SiteTech roles.

**Inputs**:
- `project_id` (string, required)
- `role` (string, optional): Filter by SiteTech role (`PE`, `Super`, `PM`, `PX`)
- `vendor_id` (string, optional): Filter by Procore vendor (subcontractor team members)

**Outputs**: Array of member objects
- `user_id` (string): Internal SiteTech user identifier
- `name` (string)
- `email` (string)
- `role` (string): SiteTech role (`PE`, `Super`, `PM`, `PX`, or null if no role assigned)
- `role_source` (string): `manual`, `procore_role`, `job_title` (how role was determined; see procore-role-mapping.md)
- `job_title` (string, nullable): From Procore or manual entry
- `vendor` (object, nullable): `{vendor_id, vendor_name}` if subcontractor
- `procore_user_id` (integer, nullable): Procore user ID if linked
- `is_active` (boolean): Active on project

**Source Tables**:
- `project_members` (project team)
- `users` (SiteTech user accounts)
- `vendors` (company affiliations)
- `procore_user_mappings` (linking SiteTech users to Procore users)

**Validation Rule**: All user IDs, emails, vendor IDs, and Procore user IDs must exist in respective tables; verifier checks foreign key integrity. Emails are RLS-protected and only used for code-level matching, never sent to model.

---

## DRAFT Tools

**DRAFT tools produce text only and never send.** They generate paste-ready content for manual review and action. M2 has no send or write tools; write-back is deferred to M3 via an approvals queue.

### draft_rfi_escalation

**Purpose**: Draft an escalation message for an overdue RFI.

**Inputs**:
- `rfi_number` (string, required): Must exist in `rfis` table
- `escalation_reason` (string, required): Why escalation is needed
- `suggested_due_date` (date, optional, ISO 8601): Proposed new due date

**Outputs**:
- `draft_text` (string): Formatted escalation message with RFI details (number, subject, assignee, days overdue, reason)
- `recipient_suggestions` (array): `[{name, email, role}]` (RFI manager, PM, PX)
- `source_data` (object): RFI record fields used in draft (for verifier)

**Validation Rule**: Verifier confirms all RFI details (number, dates, assignee names) in `draft_text` and `source_data` match `rfis` table records exactly.

---

### draft_submittal_chase

**Purpose**: Draft a follow-up message for a pending submittal.

**Inputs**:
- `submittal_number` (string, required): Must exist in `submittals` table
- `chase_reason` (string, required): Why follow-up is needed (e.g., "approaching due date", "blocking activity")

**Outputs**:
- `draft_text` (string): Formatted chase message with submittal details (number, title, spec section, responsible contractor, days pending)
- `recipient_suggestions` (array): `[{name, email, role}]` (responsible contractor, assignee, PE)
- `source_data` (object): Submittal record fields used in draft (for verifier)

**Validation Rule**: Verifier confirms all submittal details (number, dates, vendor names) in `draft_text` and `source_data` match `submittals` table records exactly.

---

### draft_change_event

**Purpose**: Draft a change event notice (Procore paste-ready format for potential change order).

**Inputs**:
- `event_description` (string, required): Description of the change event
- `related_records` (array, required): Supporting evidence
  - `[{type, record_id, record_number}]` where type in [`rfi`, `submittal`, `email_fact`, `activity`]
- `cost_impact` (string, required): `potential_increase`, `potential_decrease`, `neutral`, `unknown`
- `schedule_impact` (string, required): `delay_expected`, `acceleration_required`, `neutral`, `unknown`

**Outputs**:
- `draft_text` (string): Formatted change event notice (Procore-compatible)
  - Includes: title, description, related record references, cost impact statement, schedule impact statement
  - Explicitly states: "DRAFT - Review before pasting into Procore"
- `related_record_details` (array): Full details of related records (for context)
- `source_data` (object): All record fields referenced in draft (for verifier)

**Validation Rule**: Verifier confirms all record IDs and numbers in `related_records` exist in their respective source tables. Verifier checks that no specific cost amounts or schedule durations are stated unless they are verbatim from source records.

---

### draft_recovery_options

**Purpose**: Draft schedule recovery options for activities on the critical path or with negative float.

**Inputs**:
- `activity_ids` (array of strings, required): Must exist in `p6_activities` table
- `target_completion_date` (date, optional, ISO 8601): Desired project finish date

**Outputs**:
- `draft_text` (string): Analysis of schedule issues and recovery options
  - Lists affected activities (ID, name, current dates, float)
  - Suggests recovery strategies (fast-track, overtime, resequencing, resource addition)
  - Notes predecessors/successors impacting float
  - Explicitly states: "DRAFT - Verify with project scheduler before implementation"
- `activity_details` (array): Full activity records from schedule (for verifier)
- `source_data` (object): All activity fields and float calculations used (for verifier)

**Validation Rule**: Verifier confirms all activity IDs, dates, durations, float values, and relationships in `draft_text` match `p6_activities` and `p6_relationships` tables exactly. No hypothetical dates or durations unless clearly marked as "proposed."

---

### draft_notice_response

**Purpose**: Draft a response to a notice or formal communication (e.g., owner notice, lender request).

**Inputs**:
- `notice_summary` (string, required): Summary of the notice content
- `response_type` (string, required): `acknowledge`, `provide_info`, `dispute`, `request_clarification`
- `supporting_records` (array, optional): Evidence to reference
  - `[{type, record_id, record_number}]`

**Outputs**:
- `draft_text` (string): Formal response letter
  - Professional tone, references notice date/subject
  - Includes relevant project record citations if `supporting_records` provided
  - Explicitly states: "DRAFT - Legal and PM review required before sending"
- `supporting_record_details` (array): Full details of supporting records
- `source_data` (object): All record fields referenced (for verifier)

**Validation Rule**: Verifier confirms all record IDs, numbers, dates, and figures in `draft_text` match source tables. Verifier flags any unsupported factual claims for human review.

---

### draft_owner_decision_request

**Purpose**: Draft a request to the owner for a decision or direction.

**Inputs**:
- `decision_needed` (string, required): What decision is required
- `background` (string, required): Context and why decision is needed
- `options` (array of strings, optional): Decision options to present
- `deadline` (date, optional, ISO 8601): When decision is needed by
- `related_records` (array, optional): Supporting evidence
  - `[{type, record_id, record_number}]`

**Outputs**:
- `draft_text` (string): Decision request letter
  - Clear statement of decision needed, background, options (if provided), deadline (if provided)
  - References related records (RFIs, submittals, schedule impacts)
  - Professional tone suitable for owner communication
  - Explicitly states: "DRAFT - PX and PM review required before sending"
- `related_record_details` (array): Full details of related records
- `source_data` (object): All record fields referenced (for verifier)

**Validation Rule**: Verifier confirms all record IDs, numbers, dates in `draft_text` match source tables. Verifier flags deadline dates not tied to contract milestones or source records.

---

## Verifier Rules (Applied to All Tools)

The AI verifier enforces these rules **after every tool invocation** before results are returned to the agent:

1. **Date Provenance**: Every date mentioned in tool outputs must be traceable to a source table record. Calculated dates (e.g., `days_open`, `days_pending`) must show the calculation formula.

2. **Dollar Figure Provenance**: Every cost, contract value, or financial amount must reference a `projects`, `change_orders`, or financial source table. No estimated or hypothetical amounts unless explicitly labeled "ESTIMATE (not from records)."

3. **Record Number Provenance**: Every RFI number, submittal number, activity ID, or other identifier must exist in the corresponding source table. Verifier checks foreign key integrity.

4. **Draft Text Accuracy**: For DRAFT tools, verifier performs a line-by-line check:
   - Extract all dates, numbers, names, record IDs from `draft_text`
   - Cross-reference against `source_data` object
   - Flag any discrepancies or unsupported facts
   - Confirm "DRAFT" warning is present in output

5. **RLS Compliance**: Email addresses and personal information retrieved from RLS-protected tables are included in outputs only when necessary for routing. Email content bodies are never included verbatim; only AI-extracted `email_facts` summaries are exposed.

6. **No Hallucination**: If a requested record (e.g., `rfi_number='RFI-999'`) does not exist in the database, the tool returns an error immediately rather than fabricating data.

---

## M3 Write-Back Architecture (Future)

**Not implemented in M2.** M3 will add:

1. **Approvals Queue**: DRAFT outputs are stored in `pending_actions` table with status `pending_approval`.
2. **Human Review Interface**: PM/PX reviews, edits, and approves drafts.
3. **Write Tools** (post-approval):
   - `send_rfi_escalation`: POST to Procore RFI endpoint or send email via Graph
   - `create_change_event`: POST to Procore change events API
   - `send_email`: POST via Microsoft Graph `/sendMail`
4. **Audit Log**: Every write action logs (timestamp, user, tool, payload, response).
