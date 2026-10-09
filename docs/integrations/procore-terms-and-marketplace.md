# Procore: terms compliance, change history, change events and drawings, and Marketplace (SiteTech AI)

Prepared by: SiteTech Integrations · Researched: Fri Oct 9, 2026 (ET) · Status: **research and draft only. Nothing has been submitted to Procore and no one has been contacted.**

**Sources.** I used only official Procore sources:
- Procore API Terms of Use (effective Sept 30, 2025): https://procore.pactsafe.io/legal.html#contract-hymckkfc9 (Procore's own docs link to this URL).
- Procore Developer Policy (effective Sept 30, 2025) and other developer docs on developers.procore.com/documentation. I read them from Procore's public source repo for that site (github.com/procore/documentation, snapshot of Oct 8, 2026).
- The REST API reference on developers.procore.com/reference/rest. Endpoint paths and fields come from the OpenAPI JSON that the reference pages load.
- Procore Partner Program Guide and Partner Framework Agreement (PDFs linked from Procore's Technology Partner Overview).
    10|- support.procore.com (v2) permission matrices.

**Markings.** Anything I could not confirm in one of those sources is marked **UNVERIFIED**. All endpoints listed below appear in the official reference. I did not infer or make up any paths.

---

## 0. Bottom line (read this first)

1. **The biggest risk is that we store data at all, not how much.** Developer Policy §2(h) bars apps from "build[ing] databases ... or otherwise creat[ing] copies of any API Data ... without Procore's express consent." Our default design stores allowlisted fields plus our own dated history, which is a copy. **Only Procore's express written consent cures this.** That matches the CTO's "get it in writing" gate. The in-memory fallback lowers the risk, but it still stores a small copy, so we should ask about both modes (see §5).
2. **Our dated history may conflict with Developer Policy §2(n),** which forbids apps to "fail to erase or update Customer Data if the Customer modifies their data." Keeping old values after a customer edits a record needs to be disclosed and explicitly approved. Otherwise we have to drop it or tightly limit it.
    20|3. **AI positioning.** API Terms §5.4(a) and Developer Policy §2(g) ban training, fine-tuning, *and benchmarking* AI on API data. We don't train, so we comply on training. **But if the Linden eval fixtures were derived from Procore API data, using them to score our detectors is "benchmarking."** Confirm where Linden came from. Separately, Procore's docs now say AI-powered use cases built on REST "are intended for Agentic APIs." That's a positioning risk, not an outright ban.
4. **Competing products.** API Terms §3(j) and Developer Policy §4(b) are broad: no product that "substantially replicates any features ... in whole or in part," unless Procore authorizes it in writing. Procore now ships overlapping AI features. We should describe SiteTech plainly as an action layer that doesn't replicate Procore tools, and ask Procore to confirm.
5. **Marketplace path.** Procore says a product piloting with a single customer still belongs on the **Marketplace Partner** path, not Private Developer. That path is: application → Technical Feasibility → build and Certification → Framework Agreement + Technology Partner Addendum → listing review. **Program fees are $0 "at this time"** (2024 Program Guide). There is **no published end-to-end timeline**.
6. **History APIs.** None of RFIs, submittals, change events or drawings has a public `change_history` endpoint. A point-in-time view has to come from Procore's own timestamps (answer dates, approver sent and returned dates, revisions, `updated_at` and `deleted_at`) plus history we record ourselves from the day we connect.

---

## 1. Terms compliance

Key: **API Terms** = Procore API Terms of Use (https://procore.pactsafe.io/legal.html#contract-hymckkfc9). **Dev Policy** = Procore Developer Policy (https://developers.procore.com/documentation/marketplace-policy), which applies to apps that are "Commercially Distribute[d]." That includes us: API Terms §5.1 defines it as "any situation where a Customer could pay fees for your product."
    30|
### 1.1 Bulk extraction

| Exact text | Source |
|---|---|
| "You may not: ... (b) bulk export API Data except where expressly allowed by an additional agreement with Procore" | API Terms §5.4 |
| "Request from the APIs more than the minimum amount of data or permissions needed for the Application's intended functionality." (prohibited) | API Terms §3(p) |
| "Scrape, parse, harvest, build databases, bulk export, or otherwise create copies of any API Data accessed or obtained using the APIs by your Application or otherwise without Procore's express consent." (prohibited) | Dev Policy §2(h) |
| "You must not use Procore APIs for large-scale data extraction, bulk export, or data harvesting beyond your app's core functionality." | Marketplace requirements, https://developers.procore.com/documentation/marketplace-requirements |
| REST APIs are "not intended for: Large-scale data extraction or bulk export for purposes outside of your app's core integration ... Scraping, harvesting, or creating copies of Procore data ... High-volume data retrieval to power non-complementary analytics or intelligence solutions" | API Usage Guidelines, https://developers.procore.com/documentation/api-usage-guidelines |
    40|| "Request only the data you need. Use filters, pagination, and targeted queries rather than broad data pulls." | same |

**Our design:** we read only the projects the customer permitted, only allowlisted objects and fields, with incremental `filters[updated_at]` syncs, and we never pull company-wide data.
**Compliance:** *Likely compliant* with §3(p) and the Marketplace "beyond core functionality" test, because every field feeds a card or an outcome check. **At risk** under Dev Policy §2(h) ("build databases ... or otherwise create copies ... without Procore's express consent"). Any persistent store is a copy, so our default mode needs express consent.
**Where the risk is:**
- The initial backfill of an enabled project, which pulls every RFI, submittal, change event and drawing revision.
- Storing RFI question and answer text, which is the largest free-text field.

**Mitigations:**
- Backfill only open items plus a bounded lookback.
    50|- Use webhooks plus a reconciliation sync instead of polling (https://developers.procore.com/documentation/webhooks).
- Get §2(h) consent in writing.

### 1.2 Storage and caching

| Exact text | Source |
|---|---|
| "you must obtain explicit authorization from the organization installing your Application for the use, processing, and storage of data obtained from the APIs ('API Data'). You must limit your use, processing, and retention of API Data to the minimum necessary to develop, test, operate, and support your Application's functionality" | API Terms §5.4 |
| "Collect, store, and/or use API Data without obtaining proper, explicit consent from Customers." (prohibited) | Dev Policy §2(a) |
| "Fail to be transparent about the collection, use, and sharing of API Data, limiting your use of API Data to the practices you disclose." (prohibited) | Dev Policy §2(b) |
    60|| "all Data must be stored within your system using strong encryption." | Dev Policy §1 |
| "Store data responsibly. Only retain Procore data that is necessary for your app's operation." | API Usage Guidelines |
| Privacy policy must "describe your access, collection, and processing of Customer Data, with whom you share Customer Data, and in which country or countries the Customer Data will be stored ... [and] notify Customers that you (and not Procore) are responsible for the privacy, security, and integrity of any Customer Data" | API Terms §5.2 |

**Compliance:** *Compliant if* the following are true:
- (a) Install-time consent explicitly covers storage (a consent screen in our onboarding, not just Procore's install).
- (b) The data is encrypted at rest.
- (c) Our privacy policy names the storage country and all subprocessors, including any LLM provider.

Express consent under §2(h) remains the open item from 1.1. **Gap:** we haven't confirmed that a privacy policy covering these points is published (**UNVERIFIED** for SiteTech).
    70|
### 1.3 Data retention and deletion

| Exact text | Source |
|---|---|
| "Ignore a Customer's or individual's request for deletion of their API Data or content." (prohibited) | Dev Policy §2(l) |
| "Store Data for longer than is reasonably necessary or legally allowed." (prohibited) | Dev Policy §2(m) |
| "Fail to erase or update Customer Data if the Customer modifies their data." (prohibited) | Dev Policy §2(n) |
| retention limited "to the minimum necessary" | API Terms §5.4 |

    80|Procore sets **no fixed retention period** in these documents. I could not read a post-termination data-deletion clause in the API Terms past §9 because the page is script-rendered (**UNVERIFIED** whether one exists).

**Our design:** purge 30 days after disconnect, plus our own dated history of allowlisted fields.
**Compliance:**
- The 30-day purge after disconnect fits §2(m).
- **Gap 1, while connected:** there's no cap on how long history is kept. Add a cap, e.g. delete a project's data N days after the project closes or the customer removes it from permitted projects. The DMSA lets an admin remove projects (https://developers.procore.com/documentation/developer-managed-service-accounts), so purge on project removal too, not only on full uninstall.
- **Gap 2, §2(n):** when a customer edits a record we update the current value, which complies. But our history keeps the *old* value, which arguably fails to "erase" modified data. When a record is deleted in Procore (`deleted_at`, `filters[include_deleted]`, or a webhook `delete`), we must delete our copy *and its history*.
- **Ask Procore** to confirm in writing that a dated history of allowlisted fields is acceptable (see §5).

### 1.4 AI and ML training
    90|
| Exact text | Source |
|---|---|
| "You may not: (a) use API Data to train, re-train, fine-tune or benchmark any machine learning or artificial intelligence algorithm, software, or system" | API Terms §5.4 |
| "Use API Data to train, re-train, fine-tune, or benchmark any machine learning or artificial intelligence algorithm, model, software, or system." (prohibited) | Dev Policy §2(g) |
| "You must not use Procore data to train, fine-tune, or benchmark AI/ML models (including LLMs)." | Marketplace requirements |
| "If your app currently uses REST APIs for AI-powered features or large-scale data workloads, those use cases are intended for Agentic APIs" | Agentic APIs, https://developers.procore.com/documentation/agentic-apis |
| REST is not for "Building datasets for training, fine-tuning, or benchmarking AI/ML models (including LLMs)" | API Usage Guidelines |

**Our design:** we never train.
   100|**Compliance:**
- **Compliant on training and fine-tuning.**
- **Benchmarking risk:** our accuracy gate ("10 of 11 on Linden," held-out tests) is benchmarking an AI system. That's allowed only if the eval data did **not** come from the Procore API. Keep eval fixtures synthetic, or from customer-owned non-Procore sources, and document that.
- **Inference:** the terms don't ban sending API data to an LLM at inference time. But the Agentic APIs page says REST-based AI features "are intended for Agentic APIs." That's a policy direction, not a stated prohibition. Our answer should be that decisions are made by deterministic code on structured fields. If any Procore field is sent to an LLM, the LLM vendor must be disclosed as a subprocessor and contractually bound not to train.

### 1.5 Competing products

| Exact text | Source |
|---|---|
| "Access or use the APIs to replicate or compete with the APIs or Procore Services, in whole or in part." (prohibited) | API Terms §3(j) |
   110|| "Access or use the APIs for competitive analysis, the monitoring or dissemination of performance information ..." (prohibited) | API Terms §3(i) |
| "Use the Procore APIs to create, develop, or build a competitive product or offering, or a product or offering that substantially replicates any features or functionality of the Procore Services or Procore's other products or services (in whole or in part), except as expressly authorized by Procore in writing." (prohibited) | Dev Policy §4(b) |
| "Migrate or attempt to migrate Customers of your Application away from any Procore Service" (prohibited) | Dev Policy §4(c) |
| "Use API Data collected from one organization to directly benefit a different organization or any third party." (prohibited) | API Terms §5.4(c); Dev Policy §2(i) |
| "Combine API Data with data gathered from other sources for any purposes unrelated to the use of the Application." (prohibited) | Dev Policy §2(j) |
| "Nothing limits Procore from creating ... products ... similar to yours" | API Terms §7.4 |
| "either Party may ... develop, market, and sell competing products." | Partner Framework Agreement §15.1 (PDF linked from https://developers.procore.com/documentation/procore-partner-overview) |

**Compliance:**
- *Defensible but not safe.* SiteTech doesn't replicate RFIs, submittals, change events or drawings. It reads them, writes nothing back, and points users to the live Procore page.
   120|- **Risk:** "in whole or in part," together with Procore's own AI features (CTO's list: Change Analysis, Schedule Analyst, Datagrid). Procore could read our "unpriced change" detection as replicating part of one. Mitigate by asking for written authorization under §4(b) in the disclosure.
- **Our combination of Procore data with email, meetings and P6** is for the app's core purpose, so it complies with §2(j).
- **§2(i) and §5.4(c):** setup templates, benchmarks and "case studies" must **never** carry one customer's Procore data into another customer's setup or marketing. Templates hold only configuration shapes. A scorecard PDF goes only to the customer who owns the data.

### 1.6 Other clauses that bite
- **§2.1 / §4.3, "You may not directly or indirectly charge Customers for use of, or access to, the functionality of the Procore Services or APIs, but this does not limit you from charging a standard overall fee."** Price SiteTech as a product fee, never "Procore access."
- **§6.3, Security incidents:** notify security@procore.com "in no event later than 24 hours," and get Procore's approval before sending customer breach notices that mention Procore.
- **Dev Policy §1(j):** no "calls to the APIs that are not driven by a request from a Customer or the Application itself." Scheduled syncs by the app are fine. Testing against customer production is not.
- **Dev Policy §1(h):** use only published APIs.

   130|---

## 2. Change history and audit data

### 2.1 What exists, per object

**RFIs** (reference: https://developers.procore.com/reference/rest/rfis?version=latest, https://developers.procore.com/reference/rest/replies?version=latest)
- **No `change_history` endpoint** in the public reference for RFIs.
- Timestamps available:
  - `GET /rest/v1.0/projects/{project_id}/rfis` and `/rfis/{id}`: `created_at`, `updated_at`, `initiated_at`, `due_date`, `time_resolved` ("Time RFI was closed"), `deleted_at`, `revision`, `current_revision`, `source_rfi_header_id`.
   140|  - `questions[].question_date`, and `questions[].answers[]` with `official` and `answer_date`.
  - List filters: `filters[updated_at]`, `filters[created_at]`, `filters[initiated_at]`, `filters[status]`, `filters[overdue]`.
- `GET /rest/v1.0/projects/{project_id}/rfis/{rfi_id}/replies`: `official`, `answer_date`, `plain_text_body`, `created_by_id`.
- Deleted items: `GET /rest/v1.0/projects/{project_id}/rfis/recycle_bin` (accepts `filters[updated_at]`).
- **Can reconstruct:** when it was opened, each answer and the official answer with timestamps, when it closed, revision chain, deletion.
- **Can't reconstruct:** past values of `status` (other than via `time_resolved`), `due_date`, `cost_impact`, `schedule_impact`, assignees, ball-in-court, cost code or location. Only current values are returned.

**Submittals** (reference: https://developers.procore.com/reference/rest/submittals?version=latest)
- **No `change_history` endpoint.**
- `GET /rest/v1.1/projects/{project_id}/submittals/{id}` returns `approvers[]` with `sent_date`, `returned_date`, `due_date`, `response`, `workflow_group_number`, `days_to_respond`. It also returns `distributed_at`, `closed_at`, `issue_date`, `received_date`, `open_date`, `submit_by`, `required_on_site_date`, `confirmed_delivery_date`, `actual_delivery_date`, `distributed_submittals[].sent_at`, `submittal_workflow_template_applied_at`, `is_rejected`, and `created_at`/`updated_at`.
   150|- **`GET /rest/v1.1/projects/{project_id}/submittals/{id}/revisions`** returns every revision with its own approvers and dates, and with `scheduled_task.start_date`/`finish_date`.
- `GET /rest/v1.1/projects/{project_id}/submittals/{id}/workflow_data` returns workflow steps and approvers (current structure, not an event log).
- List filters: `filters[updated_at]`, `filters[created_at]`, `filters[status_id]`, `filters[task_id]`, `filters[required_on_site_date]`. Deleted items: `/rest/v1.1/projects/{project_id}/submittals/recycle_bin`.
- **Can reconstruct:** each review round, meaning when it went to each approver, when it came back, and with what response, across revisions. That covers most of "stuck in revise-and-resubmit."
- **Can't reconstruct:** past `status`, `lead_time` and other planning-field edits, or ball-in-court changes between responses.

**Change events** (reference: https://developers.procore.com/reference/rest/change-events?version=1.1 and ?version=1.0)
- **No `change_history` endpoint** in the API. Procore's UI does have "View the Change History of a Change Event" (https://v2.support.procore.com/product-manuals/change-events-project/tutorials).
- `created_at`, `updated_at`, `deleted_at` on the event. Each line item (`change_items[]`) has `created_at`/`updated_at`/`deleted_at`, `line_aging`, and the downstream objects' `in_status_since` and `days_in_stage` (commitment, change order package, RFQ, budget change).
- Filters: `filters[updated_at]`, `filters[created_at]`, `filters[include_deleted]` (`only`/`with`). `include_deleted_change_event_line_items` on Show.
   160|- Per the v1.1 changelog, timestamps were added Dec 17, 2024.
- Change event comments: `GET /rest/v2.0/companies/{company_id}/projects/{project_id}/change_events/{change_event_id}/comments` (https://developers.procore.com/reference/rest/change-event-comments?version=latest). We don't plan to store these.
- **Can reconstruct:** creation date, line items added or removed (with `deleted_at`), how long downstream items have sat in their current stage.
- **Can't reconstruct:** previous status values, previous amounts, or when the status changed.

**Drawings** (reference: https://developers.procore.com/reference/rest/drawings?version=latest)
- **No `change_history` endpoint** in the API. The UI's "View Change History" requires **Admin** on Drawings (https://v2.support.procore.com/product-manuals/drawings-project/permissions).
- Each revision is its own record. `GET /rest/v1.0/projects/{project_id}/drawing_revisions` (filters `filters[updated_at]`, `filters[deleted]`, `with_obsolete`) returns `revision_number`, `drawing_date`, `received_date`, `updated_at`, `current`, `obsolete`, `status`, `drawing_set.id`. `drawing_sets` returns `name`, `date`, `created_at`.
- **Can reconstruct:** the full revision sequence per sheet with issue and received dates. This is real history, because Procore keeps every revision.

   170|### 2.2 Change-history endpoints that exist for other tools (not usable for ours)
These show what Procore offers elsewhere, so they're useful when asking. All are from the reference index:
- `/rest/v2.1/companies/{company_id}/projects/{project_id}/specification_section_revisions/{id}/change_history`
- `/rest/v2.0/companies/{company_id}/projects/{project_id}/meetings/{id}/change_history`
- `/rest/v2.0/companies/{company_id}/projects/{project_id}/budget_change_history`
- `/rest/v1.0/coordination_issues/{id}/change_history`
- `/rest/v1.0/projects/{project_id}/time_and_material_entries/{id}/change_history`

The Workflows tool has `/rest/v2.0/companies/{company_id}/projects/{project_id}/workflows/instances/{id}/history` (event types such as WorkflowStarted), plus legacy `/rest/v1.0/workflow_activity_histories` and `/rest/v1.0/projects/{project_id}/workflow_permanent_logs` (https://developers.procore.com/reference/rest/workflow-instances-history?version=latest). **UNVERIFIED** whether any of the four tools we read runs on these workflow engines. The only hint is an example template name "Submittal Approval." Don't rely on it.

   180|### 2.3 Webhooks (for capturing change times going forward)
Webhook events carry `event_type`/`reason` (create, update, delete), `resource_name`, `resource_id`, and a UTC `timestamp`. Delivery is "best-effort, not guaranteed," and after "12 hours of continuous failure the queue is flushed." Procore recommends pairing webhooks with a periodic `updated_at` reconciliation (https://developers.procore.com/documentation/webhooks). Webhooks tell us *when* something changed, not *what* changed, so we still read the record and compare it to our stored copy.

### 2.4 What a point-in-time reconstruction can and can't use

| Can use (Procore-native, any date) | Can only come from our own history (from connection date forward) |
|---|---|
| RFI question and answer dates, official flag, `time_resolved`, revisions, `deleted_at` | Past RFI `status`, `due_date`, `cost_impact`/`schedule_impact`, assignees, ball-in-court |
| Submittal approver `sent_date`/`returned_date`/`response` per revision; `distributed_at`, `closed_at`, `issue_date`, `received_date` | Past submittal `status`, `lead_time`/review-time edits, `required_on_site_date` edits |
| Change event and line item `created_at`/`deleted_at`; downstream `in_status_since` (current stage only) | Past change event status and amounts, and status-change dates |
   190|| Drawing revisions (`revision_number`, `drawing_date`, `received_date`), drawing set dates | Which revision was "current" on a given past date (derivable from dates, but not stated by Procore) |
| `updated_at` (last change only) | Anything about intermediate edits |

Implications:
- **The 90-day replay** in the onboarding sprint can only use the left column. It must not claim to know a past due date or status that Procore doesn't timestamp.
- **In fallback (in-memory) mode** we keep no field history, so the right column is unavailable. Outcome checks must re-read the live record.

---

## 3. Change events and drawings: endpoints, fields, permissions
   200|
### 3.1 Change events: read endpoints (GET only)
From https://developers.procore.com/reference/rest/change-events?version=1.1 and ?version=1.0. Neither version is marked deprecated in the spec.

| Path | Use |
|---|---|
| `GET /rest/v1.1/change_events?project_id=` | List (filters `created_at`, `updated_at`, `include_deleted`, `search`; changelog: search added Jul 14, 2026) |
| `GET /rest/v1.1/change_events/{id}?project_id=` | Show (`include_deleted_change_event_line_items`) |
| `GET /rest/v1.0/change_events?project_id=` | List (also `filters[origin_type][]`, `filters[change_event_status_id][]`, `filters[id]`) |
| `GET /rest/v1.0/change_events/{id}?project_id=` | Show |
   210|| `GET /rest/v1.0/change_event/statuses` · `GET /rest/v2.0/companies/{company_id}/change_events/statuses` | Status list for the source mapping (https://developers.procore.com/reference/rest/change-event-statuses?version=latest) |

All require the `Procore-Company-Id` header.

**Allowlist mapping (v1.1 unless noted):**
- **number:** `number` (string, e.g. "A056"). v1.0 has `number` (int) + `alphanumeric_number`.
- **status:** `status.id`, `status.name`, `status.mapped_to_status`. Map `mapped_to_status` through our source mapping layer.
- **created date:** `created_at`. Also keep `updated_at` and `deleted_at` for sync and purge.
- **linked RFI:**
  - v1.1: `event_origin.origin_type` (example `"Rfi::Header"`), `event_origin.origin_id`, `event_origin.display_name`, `event_origin.web_page_url`.
   220|  - v1.0: `rfi.{id, number, full_number, status, due_date}` and `change_event_origin_type`/`change_event_origin_id`.
  - An event has a single *origin*. Other "related items" links have no field in these responses (**UNVERIFIED** whether any API exposes them).
- **amounts:** there is **no header-level total** in the spec, so we compute totals from line items.
  - v1.1 `change_items[]`: `cost_impact.estimate.amount`, `revenue_impact` (object), `budget_impact.estimate.amount`, `latest_cost_values`, `latest_revenue_values`, `currency_configuration`.
  - v1.0 `change_event_line_items[]`: `estimated_cost_amount`, `rom`, `prime_pco_cost`, `commitment_pco_cost`, `rfq_amount`.
  - Store only the per-event totals we need (ROM/revenue, latest cost), not line-item vendor or commitment detail.
- **Don't store:** `attachments[]` (contains file URLs), `description` free text (add it only if a card needs it), `created_by.login` (an email address, which is PII).

### 3.2 Drawings: read endpoints (GET only)
From https://developers.procore.com/reference/rest/drawings?version=latest and https://developers.procore.com/reference/rest/drawing-areas?version=latest.
   230|
| Path | Use |
|---|---|
| `GET /rest/v1.0/projects/{project_id}/drawing_revisions` | **Main feed.** Filters `filters[updated_at]`, `filters[deleted]`, `with_obsolete`, `drawing_set_id`, `drawing_area_id`, `drawing_id`; `view` enum includes `only_ids` |
| `GET /rest/v1.0/projects/{project_id}/drawing_revisions/{id}` | Show revision |
| `GET /rest/v1.0/projects/{project_id}/drawing_sets` (and `/{id}`) | Set `name`, `date` (where ASI/bulletin labels usually live) |
| `GET /rest/v1.1/projects/{project_id}/drawing_areas`; `GET /rest/v1.1/drawing_areas/{drawing_area_id}/drawings` | Areas and sheets |

**Allowlist mapping:**
- **sheet:** `drawing_number`, `title`, `discipline.name`, `drawing_id`.
   240|- **revision:** `revision_number`, `current`, `obsolete`, `status`.
- **date:** `drawing_date`, `received_date`, `updated_at`.
- **spec sections:** **not a field** on drawing revisions in the spec. Only obtainable from `custom_fields` if the customer configured them (handled by our per-client source mapping) or from extracted text via `GET /rest/v1.1/projects/{project_id}/drawing_revision_terms`. Recommend we do **not** use `drawing_revision_terms`: it is extracted sheet text, which drifts toward "creating copies."
- **ASI/bulletin number:** **not a field.** It usually appears in `drawing_set.name` by customer convention (**UNVERIFIED** as a Procore convention), or in a revision custom field. Source mapping again.
- **No files:** never store or fetch `pdf_url`, `png_url`, `zip_url`, thumbnails, or `drawing_tiles`.

### 3.3 Permission template: tool names and levels

- **How DMSA permissions work:** they are **not** set through a Directory permissions template. The developer declares company- and project-level tool permissions in the app manifest using the **Permissions Builder**. Procore applies them at install, and the admin picks permitted projects (https://developers.procore.com/documentation/building-data-connection-apps; https://developers.procore.com/documentation/developer-managed-service-accounts).
- Procore discourages editing DMSA permissions by hand in Directory ("Avoid Manual Updates to DMSA Permissions"). Adding tools later (change events, drawings) means a new app version through "the upgrade process to be reviewed and approved."
   250|
| Tool (project level) | Level we request | Evidence |
|---|---|---|
| **Change Events** | **Read Only** | "View a Change Event" is allowed at Read Only, Standard and Admin (https://v2.support.procore.com/product-manuals/change-events-project/permissions). The tool is in the "PM Essentials" / "Construction Financials" product lines per the API spec. A customer without it enabled returns nothing. |
| **Drawings** | **Read Only** | "View Drawings (Published)" and "View Drawing Areas" are allowed at Read Only (https://v2.support.procore.com/product-manuals/drawings-project/permissions). "View Drawings (Reviewed)" needs the "Upload and Review Drawings" granular permission. "View Change History" and "View Deleted Drawings Revision" are Admin-only, so we can't get them and shouldn't ask. |
| RFIs (existing) | Read Only | Read Only sees non-private, non-draft RFIs. **Private RFIs and responses need extra granular permissions or Admin** (https://v2.support.procore.com/product-manuals/rfi-project/permissions). Our counts will exclude private RFIs, and we should say so to customers. |
| Submittals (existing) | Read Only | Same pattern: private submittals need granular permissions or Admin (https://v2.support.procore.com/product-manuals/submittals-project/permissions). |

**Company vs project nuance for a DMSA:**
1. Change Events and Drawings are **project-level** tools. Grants apply only in projects the admin permitted: "The App will only have access to the data in these permitted projects." This matches our "only enabled projects" rule (DMSA doc).
   260|2. "Each time an app is updated or reinstalled, Company Administrators must reconfigure the list of permitted projects. Future projects requiring DMSA access must also be manually added." Shipping the change events and drawings version will therefore force every customer to re-pick projects. Plan the release and support script around that (DMSA doc).
3. Change event **statuses** are company-scoped endpoints. **UNVERIFIED** which company-level permission (if any) a DMSA needs to read them. Test in the sandbox before requesting anything company-level.
4. Don't request company-level Directory Admin: "Avoid granting admin-level access to the Company-level Directory tool for the DMSA user" (DMSA doc).
5. Calls to `/rest/v1.0/me` and `/rest/v1.0/companies` need the `Procore-Company-Id` header with DMSA credentials (DMSA doc).

---

## 4. Marketplace: application, review, listing, security, data usage, timeline, fees

**Which path:** a "product or SaaS that connects to Procore, even if only one customer uses it today," and "piloting with a single customer before listing publicly," both belong on the **Marketplace Partner** path. Requirements are a business email, "Complete technical feasibility," and "Sign a Partnership Agreement." Each app also needs its own production-credential approval (https://developers.procore.com/documentation/verification-and-production-access). The Partner Program Guide (2024) also says "Technology Partners must use Procore's Developer Managed Service Accounts." We do.
   270|
**Steps** (https://developers.procore.com/documentation/procore-partner-overview):
1. **Partner Application:** a Google Form, including a "Better Together" story, followed by a vetting review.
2. **Technical Feasibility Assessment:** sent only if the application is approved; "documenting your integration's architecture and data flows". **This is where our data-usage disclosure belongs.**
3. **Build, Test & Certify:** a Certification Assessment, described as "a production-readiness review of security, API efficiency, and reliability". You submit an integration diagram and a demo video. Passing grants "temporary partner status" for production and beta customers.
4. **Partner Agreement:** Procore Framework Agreement + Technology Partner Addendum.
5. **Launch:** listing content, then final review (https://developers.procore.com/documentation/marketplace-checklist).

**App review requirements** (https://developers.procore.com/documentation/marketplace-requirements):
- Installable in a customer account; production-ready (no demo or trial apps); passes functional testing.
   280|- Step-by-step onboarding and support docs.
- Transactional REST use only: no bulk extraction, no AI training or benchmarking, no private APIs, no ads or push notifications.
- At least 1 active customer in any rolling 12 months.
- The checklist adds: production client ID and secret, `login.procore.com`/`api.procore.com` base URLs, correct `Procore-Company-Id` handling, "Least privilege applied to access scopes," rate limits handled without degradation, Post Installation Notes in the Configuration Builder.

**Listing** (https://developers.procore.com/documentation/marketplace-listing-guidelines):
- Name ≤30 characters, tagline ≤40, integration summary 200–2,000, "How it Works" ≤500, features ≤200 characters each.
- Logo 200×200; 3+ screenshots at 720×480–1920×1080; 1 video (MP4/MOV).
- Pricing scenarios; "Allow" vs "Disallow Installations." Disallow fits a paid setup sprint, using the Custom App Install key.
- Listings "are manually reviewed."
   290|
**Security questionnaire:**
- I found **no published Procore security questionnaire** in the developer docs, Program Guide or Framework Agreement. The documented security review is the **Certification Assessment** (security, API efficiency, reliability) plus Technical Feasibility (architecture and data flows). Treat a formal questionnaire as **UNVERIFIED**: expect one during certification, but its contents aren't public.
- The binding security obligations are API Terms §6.2 (reasonable safeguards meeting industry standards), §6.3 (24-hour incident notice) and Dev Policy §1 (strong encryption at rest, enforced authentication and login auditing for our app).

**Data-usage disclosure requirements:**
- API Terms §5.2: a public privacy policy covering access, collection, processing, sharing, storage country, and the line that "you (and not Procore) are responsible."
- API Terms §5.4: explicit authorization from the installing organization for use, processing and storage.
- Dev Policy §2(a)–(c): consent, transparency, and limiting use to what we disclose.
- Support page: "Privacy policy (in English) that details how the App will be using any third-party data" (https://developers.procore.com/documentation/partner-support-content-reqs). That page is archived and redirects to the listing guidelines, so it is **UNVERIFIED** as a current requirement.
   300|- No Procore form named "data-usage disclosure" was found. Our draft below is meant for the Technical Feasibility submission and the partner team.

**Timeline:**
- **No published end-to-end SLA** (**UNVERIFIED**).
- Published response times: marketing material review "within 7-10 business days" (https://developers.procore.com/documentation/market-your-app); Program Guide (2024) partner-team questions "within 5 business days." The Agentic API pilot is reviewed "on a rolling basis."
- Procore avoids announcements during quarterly quiet periods.

**Fees:**
- "At this time, there are no fees associated with participation in any Procore Partner Programs. Procore reserves the right to make changes to this in the future." (Partner Program Guide 2024, https://downloads.ctfassets.net/8pep15rt0kef/3cqMPZK5V9dt5VM9WvL4hA/9489b69ecdf426bd957f7fdb2ce541d6/Procore_Partner_Program_Guide.pdf).
- API Terms §2.4: "Procore reserves the right to charge fees for use of or access to all or part of the APIs. Any fees must be agreed to in writing."
   310|- **UNVERIFIED** whether the Technology Partner Addendum, which I did not see, adds revenue share or fees.

---

## 5. DRAFT: Marketplace data-usage disclosure (not submitted)

> **To:** Procore Technology Partner Programs / Ecosystem team
> **From:** SiteTech AI, Inc.
> **Re:** Data-usage disclosure and request for written confirmation: SiteTech AI (read-only DMSA data connector)
>
   320|> **What SiteTech does.** SiteTech is an action layer for general contractors. It reviews a project's RFIs, submittals, change events and drawing revisions together with the customer's own email, meeting notes and P6 schedule. It then puts short action cards in front of the project team, such as "RFI 112 answer is due before activity 3040 starts; no response yet." Each card links to the live record in Procore. SiteTech never writes to Procore and never sends anything on a user's behalf. A person reviews and sends every action from their own tools. We don't replicate Procore's RFI, submittal, change event or drawing tools, and we don't move customers off Procore.
>
> **How we access Procore.** We use a Developer Managed Service Account with client credentials. Our manifest requests **Read Only** project-level permissions on RFIs, Submittals, Change Events and Drawings, and nothing at company level beyond what is required to list companies and projects. Our client issues GET requests only. We read only the projects the customer's admin has permitted, sync incrementally using `filters[updated_at]` and webhooks, and respect rate limits. We never pull company-wide data and never use undocumented endpoints.
>
> **What we read and store (allowlisted fields only).**
> - *RFIs:* number, subject, question, official answer, status, cost and schedule impact, dates, location, cost code, assignees, responsible contractor.
> - *Submittals:* number, title, spec section, status, dates, lead and review times, revisions, approvers and their sent/returned dates and responses, linked schedule task (id, key, name).
> - *Change events:* number, status, created date, linked RFI (origin), and per-event cost and revenue totals.
> - *Drawing revisions:* sheet number and title, revision number, drawing and received dates, drawing set name, and, where the customer has configured them, spec-section or ASI/bulletin custom fields.
>
   330|> We **do not** store attachments, drawing files or images, PDFs, comments, or Procore login emails. We don't use extracted drawing text.
>
> **Two storage modes. We ask which one Procore will confirm.**
> 1. **Default mode:** we store the allowlisted fields above, plus a dated history of changes to those fields only (for example, "status changed from Open to Closed on Oct 3"). The history lets us confirm outcomes, for example that an RFI was answered before the activity it blocked started, without re-reading the whole project.
> 2. **Fallback mode (minimal storage), which can be enabled per customer:** Procore data is processed in memory and not retained. We keep only what a user's action card shows: the record number, the specific dates and amounts behind the card's days-and-dollars figures, one quoted line, and stable Procore IDs. Source links open the live Procore page. We keep no field history; outcome checks re-read the live record.
>
> **If Procore prefers, we will run Fallback mode by default for all customers** and offer Default mode only where Procore confirms it.
>
> **Why we keep it.** Only to show that customer's own team their open actions and the confirmed results of actions they approved. One customer's data is never used for, shown to, or combined with another customer's data, and never used in templates, benchmarks or marketing.
>
   340|> **No AI training.** We do not use Procore API data to train, re-train, fine-tune or benchmark any machine-learning or AI model. Our evaluation datasets do not contain Procore API data. Decisions about which actions to show are made by deterministic code on the structured fields above. *[Confirm before sending: whether any Procore field is ever sent to an LLM at inference time. If yes, name the provider here as a subprocessor and state its contractual no-training and no-retention terms.]*
>
> **Retention and deletion.**
> - Data is encrypted in transit and at rest and stored in *[country/region, to confirm]*.
> - When a record is deleted in Procore, we delete our copy and its history.
> - When an admin removes a project from the app, we delete that project's data within 30 days.
> - When the app is uninstalled or the customer disconnects, we delete all of their Procore-derived data within 30 days.
> - We honor customer deletion requests.
> - Security incidents are reported to security@procore.com within 24 hours, per the API Terms.
>
   350|> **Consent.** Before any sync, the installing organization explicitly authorizes the reads, processing and storage described here. Our public privacy policy describes the same practices.
>
> **What we're asking Procore to confirm in writing:**
> 1. That the storage described above is permitted. Under Developer Policy §2(h) ("build databases ... or otherwise create copies ... without Procore's express consent") we ask for express consent for **(a) Default mode** or, if not, **(b) Fallback mode**.
> 2. That keeping a dated history of the allowlisted fields while connected is consistent with Developer Policy §2(n), given that we delete the history when a record is deleted and on disconnect.
> 3. That the initial sync of a newly enabled project, limited to the allowlisted fields and a bounded lookback, is not "bulk export" under API Terms §5.4(b).
> 4. That SiteTech, as described, is not a competitive or replicating product under API Terms §3(j) and Developer Policy §4(b), or Procore's written authorization if it considers one necessary.
> 5. Whether Procore would rather we use any other API (including Agentic APIs) for part of this use case.
>
> We're happy to walk through our architecture and data-flow diagram during Technical Feasibility.
   360|
*(End of draft. Before anyone sends it, fill in the bracketed items, have counsel review it, and get Sean's approval. It belongs in the Technical Feasibility Assessment or the partner-team thread.)*

---

## 6. Actions for the team (not done; for decision)
1. **Integrations:**
   - Add purge-on-project-removal and purge-on-Procore-delete (record + history) to the connector.
   - Make the storage mode a per-customer setting.
   - Exclude `attachments`, `created_by.login` and file URLs at the serializer.
   370|2. **Agent Engineer:** confirm the Linden and held-out eval fixtures contain no Procore API data (§1.4 benchmarking).
3. **Lead / security:** confirm encryption at rest, the storage region, and the LLM subprocessor list for the privacy policy.
4. **CTO / Sean:**
   - The Marketplace Partner application is a Google Form submission (https://developers.procore.com/documentation/procore-partner-overview). Submitting it is an external action that needs Sean's approval.
   - Send the disclosure in Technical Feasibility.
   - Release the change events and drawings manifest version knowing that admins must re-pick permitted projects.
