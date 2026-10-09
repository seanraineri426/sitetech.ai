# Granola as a SiteTech data source: one-pager
*Integrations Engineer, Oct 9, 2026. Sources: Granola's official docs, pricing, security, terms and DPA. Anything not confirmed in those sources is marked **UNVERIFIED**.*

**Bottom line:** Granola has an official, read-only REST API and signed webhooks. A **workspace API key** (created by an admin, Business plan or higher) can read every note in an admin-created **Space** that has API access turned on. That lets one GC admin grant us one project's meetings without each employee connecting their own account. The MCP is per-user OAuth only, so it suits people chatting with their own notes, not a server-side sync. The integration order is therefore: **official API + webhooks** (primary), MCP (not usable for a server-side sync), Zapier (only if a customer can't use the API), and browser automation (never).

## 1. Access options
| Option | What it is | Fit for SiteTech |
|---|---|---|
| **Official MCP** `https://mcp.granola.ai/mcp` | Streamable HTTP. Browser OAuth or Enterprise-Managed Auth (EMA) via the IdP. "There is no API key or service account access method for MCP." [mcp] | Per user and conversational only. Not suitable for a background sync. |
| **Public REST API** `https://public-api.granola.ai/v1` | Endpoints: list/get notes, paginated transcript, folders, spaces, webhook endpoints; plus audit and legal-hold endpoints [openapi]. Read-only for notes. | **Primary.** |
| **Webhooks** | Events: `note.generated`, `note.edited` (summary changes only) and `note.access_granted`. Payloads carry IDs only, signed per the Standard Webhooks spec, retried for 4 days. Business plan or higher. [webhooks] | **Primary trigger.** |
| **Zapier** | Per-note or per-folder Zap that sends title, attendees, summary, transcript and link [zapier]. Business plan or higher [pricing]. | Fallback only. It adds Zapier as a data processor. |
| **CSV export** | Per-user, emailed, includes only notes you own. There is no admin export, and export is off by default on Enterprise [export]. | Not usable. |

## 2. Org-level vs per-user access
- **Org-level access is possible.** On Business and Enterprise, admins can create **workspace API keys**. These belong to the workspace, **don't expire**, survive the admin leaving, and can read (a) public, team-space notes and (b) notes in **Spaces where "Allow access with a workspace API key" is on**. They **cannot read private notes** [api-help].
- **Per-user keys:** any Business member can create a personal key with "Personal notes" and/or "Public notes" scope. On Enterprise, admins choose which scopes members may use [intro].
- **Scoping to one project:** admins can create custom Spaces "to share notes and folders with a specific group, department, region, or project team." API access is on by default for new Spaces, and only admins can change it [spaces]. **One Space per project = our scope boundary.** UNVERIFIED: whether custom Spaces require Enterprise.
- **Pricing (published):** Basic $0 (30-day history, no API). **Business $14/user/mo** (API, MCP, webhooks, Zapier). **Enterprise $35/user/mo** (adds admin controls for API/MCP, SSO, org-wide training opt-out and retention, audit API) [pricing]. SSO and SCIM need about 50 seats [sso].
- **Notes are private by default.** A GC employee has to move or record a meeting into the project Space before we can see it [api-help]. This is the main adoption risk.

## 3. Auth
- **API:** bearer API key (`grn_…`) only. The OpenAPI defines no OAuth flow or third-party app authorization [intro][openapi]. Scopes: `personal`, `public`, `workspace`. Personal keys expire, but their lifetime is **UNVERIFIED**; workspace keys don't expire [api-help]. Revocation is permanent [intro].
- **Narrowing:** for a key, the narrowest scope is the Space boundary; for a webhook, it is `folder_ids` [webhooks]. Filtering by folder or Space on list calls is a query filter, **not** an access restriction [openapi].
- **MCP:** OAuth 2.1 with PKCE, dynamic client registration, refresh tokens, resource scope `mcp` [OAuth metadata]. Token lifetime is **UNVERIFIED**.

## 4. Data
- **Get Note** returns: id, title, owner, `created_at`/`updated_at`/`deleted_at`, `web_url`, calendar event (invitees, organiser, scheduled start/end), **attendees (name, email)**, folder and space membership, summary (text and markdown), and transcript [get-note]. Private notes come back **null for workspace keys** [get-note].
- **Transcript** items contain text, `start_time`/`end_time` and `speaker` {source mic/speaker, attribution `me`/`them`, `name` only "when a speaker could be identified", iOS `Speaker A/B`}. Large transcripts return 413 and must be paged through `/transcript` [get-note][intro].
- **Format:** JSON. Only notes that already have a generated summary and transcript are returned [intro].
- **Incremental sync:** `updated_after`, `created_after`, `space_id`, `folder_id` and cursor pagination [openapi], plus webhooks. `deleted_at` is visible "only [to] keys with access to all workspace notes" [get-note]. Whether a workspace key qualifies is **UNVERIFIED**.

## 5. Restrictions
- **Rate limits:** API 25-request burst per 5 s, 5 req/s sustained, per user or workspace, 429 on breach [intro]. MCP about 100 req/min [mcp].
- **No sandbox.** Test with a dedicated folder [api-help].
- **Platform ToS §3.4:** no "use [of] the Services for the benefit of a third-party," and no building "a product that is competitive with any Granola product or service or has similar … features" [ptos]. §3.5 treats customer-enabled integrations as "Non-Granola Applications," governed by our own agreement with the GC [ptos]. The DPA allows the customer to let third parties access its data [dpa §E]. **How this applies to a vendor pulling a GC's data (and to "Ask SiteTech" over meetings) is UNVERIFIED. Get it in writing from Granola.**
- **AI training:** Granola doesn't let third parties train on Customer Data. Granola itself trains on de-identified data unless the customer opts out (Basic/Business) or opts in (Enterprise) [ptos §6.2.2][model-training].

## 6. Data terms and security
- **SOC 2 Type II.** The report is available from trust.granola.ai on request. No ISO 27001 [faq].
- **Storage:** AWS, US only, encrypted at rest and in transit, daily backups. No EU residency [security][faq].
- **Retention:** notes and transcripts are kept **indefinitely** unless a retention policy is set. Per-user transcript auto-delete runs 1 day to 1 year. Enterprise can set a workspace-wide policy through Granola support [faq][auto-delete]. Audio is deleted after transcription [security].
- **DPA:** standard DPA with EU and UK SCCs; no custom DPAs [faq][dpa]. 10 days' notice of new subprocessors [dpa]. Subprocessors include Deepgram, AssemblyAI, OpenAI and Anthropic [security].
- **Recording consent:** no bot joins; the user clicks start and Granola captures mic and system audio [security]. Consent is **the customer's responsibility** under the Recording Laws clauses [ptos §3.4, §12.3][consent]. Optional chat-message and watermark notices are per-user on Business and admin-enforceable on Enterprise [pricing]. In-person trailer and OAC meetings on mobile get no in-meeting notice. Ties to the PM's onboarding consent item.

## 7. Recommended architecture
1. **Customer setup (GC admin, ~10 min):** Business or Enterprise. Create Space "SiteTech – {Project}" with API access on. Create a workspace API key and paste it into our secure box. On Enterprise, also opt the workspace out of training.
2. **Connect:** we store the key encrypted per org. We call `GET /v1/spaces`, the admin picks the project Space, and we persist `space_id` ↔ `project_id`. We register a webhook with scope `["workspace"]` for `note.generated` and `note.access_granted`.
3. **Ingest:** verify the signature, return 2xx within 15 s, and enqueue an Inngest job (dedupe on `event_id`). The job calls `GET /v1/notes/{id}?include=transcript` (paging on 413) and **drops the note unless `space_membership` contains the mapped `space_id`**. A daily `GET /v1/notes?space_id=…&updated_after=…` backfill covers missed webhooks; missed events aren't replayed [webhooks].
4. **Store the minimum:** `meeting(id, org_id, project_id, granola_note_id, title, started_at, ended_at, web_url)`, `meeting_attendee(name, email)`, `transcript_segment(seq, text, start_time, end_time, speaker_attribution, speaker_name)`. **Do not store** summaries or private notes. Apply RLS by `org_id` and the same **30-day purge after disconnect** as email. A daily reconcile removes notes that leave the Space.
5. **Commitments:** the model extracts facts {who, what, due date, verbatim quote, segment id}. Code checks that the quote exists in the stored segment and maps "who" to an attendee email or a role. A fact that can't be matched gets "confirm owner"; we never guess. Code then tracks the due date and drafts the chase or the pre-filled change event. Speaker names are often missing (`me`/`them` only), so owner matching is the weak point [get-note].

## 8. Open questions for Granola sales
1. Written confirmation that a vendor reading a customer's workspace via a workspace key complies with ToS §3.4 (iv) "for the benefit of a third-party" and (vi) "competitive/similar features."
2. A partner or OAuth app path, so GCs don't have to paste keys? Is one planned?
3. Are custom Spaces available on Business, or only Enterprise? Minimum seats for Enterprise without SSO?
4. Personal-key lifetime and MCP token lifetime.
5. Can a workspace key see `deleted_at` or receive a deletion event? Is a `note.deleted` webhook on the roadmap?
6. Is there a webhook for transcript edits, not only summary edits?
7. Is a Space-only workspace key possible, i.e. one that excludes Team-space "public notes"?
8. What does `access_granted` cover when a note is moved into a Space?
9. Mobile in-person consent options. Zero retention for the LLM subprocessors?

**Sean's connected MCP (`user-Granola--sean-verticalcd-com`)**, from the tool schemas only; no tools called and no meetings read. Tools: `get_account_info` (email, workspaces, note-access scopes, `mcp_plan`); `list_meetings` (time range, `folder_id` "requires a paid Granola plan", `workspace_only`, `captured_by_me`/`listed_as_participant`); `list_meeting_folders`; `get_meetings` (≤10 IDs: private notes, AI summary, attendees, metadata; no transcript); `query_granola_meetings` (natural-language Q&A with citations); `get_meeting_transcript`, whose description says "**unavailable on this plan**"; and `sign_out`. The schemas suggest Sean's account is on the free Basic plan (inferred, not confirmed): 30-day history, no transcripts, no API. Fine for Sean's own lookups; **not a path for SiteTech's sync.**

**Sources:** [intro] docs.granola.ai/introduction · [api-help] docs.granola.ai/help-center/sharing/integrations/granola-api · [mcp] docs.granola.ai/help-center/sharing/integrations/mcp · [webhooks] docs.granola.ai/webhooks · [get-note] docs.granola.ai/api-reference/get-note · [openapi] docs.granola.ai/api-reference/openapi.json · [spaces] docs.granola.ai/help-center/sharing/folders/spaces-and-folders · [zapier] docs.granola.ai/help-center/sharing/integrations/zapier · [export] docs.granola.ai/help-center/sharing/exporting-notes · [pricing] granola.ai/pricing · [security] granola.ai/security · [faq] docs.granola.ai/help-center/consent-security-privacy/security-privacy-data-faqs · [model-training] docs.granola.ai/help-center/consent-security-privacy/model-training · [auto-delete] docs.granola.ai/help-center/consent-security-privacy/transcript-auto-deletion · [consent] docs.granola.ai/help-center/consent-security-privacy/getting-consent · [sso] docs.granola.ai/help-center/sso-setup-guide · [dpa] docs.granola.ai/help-center/policies/data-processing-addendum · [ptos] go.granola.ai/platform-tos-pdf (Dec 2025) · [OAuth metadata] mcp-auth.granola.ai/.well-known/oauth-authorization-server
