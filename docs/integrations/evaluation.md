# Integration Evaluation

MVP integration evaluation for SiteTech construction management system. Integration preference order: official MCP server > official API > webhooks > trusted third-party connector > browser automation (fallback only).

## Procore

### API/MCP Availability
- **API**: Official REST API v1.0 available ([docs](https://developers.procore.com/reference/rest/v1/project-users?version=1.0))
- **MCP Server**: None identified
- **Recommended**: Direct REST API integration

### Authentication
- **Method**: OAuth 2.0 Client Credentials grant via Developer Managed Service Account (DMSA) ([docs](https://procore.github.io/documentation/oauth-client-credentials))
- **Implementation**: 
  - POST to `https://login.procore.com/oauth/token` with `grant_type=client_credentials`, `client_id`, `client_secret`
  - Returns bearer access token
  - Include `Procore-Company-Id` header in all API requests
- **Security**: Client credentials stored in Supabase Vault, rotated regularly per best practices
- **Permissions**: Read-only permission template, GET-only client operations

### Data Access
**Project Users** (Directory):
- **Endpoint**: `GET /rest/v1.0/projects/{project_id}/users` ([docs](https://developers.procore.com/reference/rest/v1/project-users?version=1.0))
- **Fields**: `id`, `name`, `first_name`, `last_name`, `email`, `job_title`, `vendor` (id, name), `is_employee`, `party_id`
- **Filtering**: By vendor_id, trade_id, employee status, search term

**Project Roles**:
- **Endpoint**: `GET /rest/v1.0/project_roles?project_id={project_id}` ([docs](https://www.withone.ai/knowledge/procore/conn_mod_def%3A%3AGLdYJEcYNCA%3A%3AkJG3bSnBQ1m0dd4VDihDGQ))
- **Fields**: User-to-role relationships, company-configurable role names
- **Note**: Role names are company-specific (e.g., "Project Engineer", "Superintendent")

**RFIs**:
- **Endpoint**: `GET /rest/v1.0/projects/{project_id}/rfis` ([docs](https://developers.procore.com/reference/rest/rfis?version=latest))
- **Fields**: `subject`, `rfi_manager_id`, `assignee_id`, `assignee_ids`, `required_assignee_ids`, `question.body`, status, dates
- **Attachments**: Excluded from MVP per security requirements

**Submittals**:
- **Endpoint**: `GET /rest/v1.1/projects/{project_id}/submittals` ([docs](https://developers.procore.com/reference/rest/submittals))
- **Fields**: `number`, specification area, received_from_id, assignee, status, dates
- **Attachments**: Excluded from MVP per security requirements

### Read Capabilities
- ✅ Project users and directory
- ✅ Project roles (user-to-role mappings)
- ✅ RFIs with questions and assignees
- ✅ Submittals with tracking information
- ✅ Pagination support (page, per_page parameters)
- ✅ Filtering by date ranges (ISO 8601), vendor, trade, search terms

### Write Capabilities
- ❌ No write operations in MVP (M2)
- 📝 M3 will add write-back via approvals queue

### Webhooks
- **UNVERIFIED** (needs sandbox check): Procore webhook support for real-time notifications
- **Alternative**: Polling with `filters[updated_at]` date range queries

### Restrictions
- **Permission Template**: Read-only access only
- **Attachments**: Excluded from all endpoints to minimize data exposure
- **Projects**: Access controlled via DMSA permitted projects list
- **Data Retention**: 30-day purge after disconnect
- **Company ID**: Required in all requests via `Procore-Company-Id` header

### Difficulty
- **Low-Medium**: Well-documented REST API with OAuth 2.0 standard
- **Considerations**:
  - DMSA setup requires company admin approval
  - Permitted projects must be explicitly configured
  - Company-specific role naming requires mapping configuration

### Security
- ✅ OAuth 2.0 with client credentials (no user passwords)
- ✅ Token storage in Supabase Vault with encryption at rest
- ✅ Read-only permission template prevents data modification
- ✅ 30-day automatic purge on disconnect
- ✅ Row-level security (RLS) on all stored data
- ✅ No attachment downloads reduce attack surface
- ⚠️ Client credentials require secure rotation schedule

### Recommended Architecture
1. **Auth Layer**: DMSA credentials in Supabase Vault, token refresh service
2. **Sync Service**: Scheduled jobs pull project users, roles, RFIs, submittals
3. **Storage**: Postgres tables with RLS, automatic 30-day TTL
4. **Role Mapping**: Per-company configuration table mapping Procore roles to SiteTech roles
5. **API Layer**: Supabase Edge Functions expose standardized tool endpoints
6. **Incremental Sync**: Use `filters[updated_at]` for efficient delta updates

---

## Microsoft Graph (Outlook Mail + SharePoint)

### API/MCP Availability
- **API**: Official Microsoft Graph REST API v1.0 ([docs](https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0))
- **MCP Server**: None identified
- **Recommended**: Direct Graph API integration

### Authentication
- **Method**: OAuth 2.0 with two multi-tenant Entra ID applications:
  1. **"SiteTech Sign-in"**: Delegated auth for user login
     - Scopes: `openid`, `profile`, `email`, `User.Read`
  2. **"SiteTech Data Connector"**: Application-level data access
     - **Mail**: `Mail.Read` (application permission)
     - **SharePoint**: `Sites.Selected` (application permission)

**Mail Access Control**:
- **Restriction**: Scoped to one project mailbox via Exchange Online RBAC for Applications ([docs](https://learn.microsoft.com/en-us/graph/auth-limit-mailbox-access))
- **Setup**:
  1. Remove unscoped `Mail.Read` consent from Entra ID
  2. Create management scope: `New-ManagementScope -Name "SiteTech-Mailbox" -RecipientRestrictionFilter "Guid -eq '<mailbox-guid>'"`
  3. Assign role: `New-ManagementRoleAssignment -App "<app-id>" -Role "Application Mail.Read" -CustomResourceScope "SiteTech-Mailbox"`

**SharePoint Access Control**:
- **Restriction**: Scoped to one SharePoint site via Sites.Selected ([docs](https://learn.microsoft.com/en-us/graph/permissions-selected-overview))
- **Setup**:
  1. Grant Sites.Selected consent (grants no access by default)
  2. Assign site permission: `POST /sites/{siteId}/permissions` ([docs](https://learn.microsoft.com/en-us/graph/api/site-post-permissions?view=graph-rest-1.0))
     ```json
     {
       "roles": ["read"],
       "grantedToIdentities": [{
         "application": {
           "id": "app-id",
           "displayName": "SiteTech Data Connector"
         }
       }]
     }
     ```

### Data Access
**Email Messages**:
- **Endpoint**: `GET /v1.0/users/{mailbox-id}/messages` ([docs](https://learn.microsoft.com/en-us/graph/api/message-get?view=graph-rest-1.0))
- **Fields**: 
  - `id`, `subject`, `from`, `toRecipients`, `ccRecipients`
  - `body` (itemBody with `contentType`, `content`)
  - `conversationId` (string, groups related messages)
  - `receivedDateTime`, `sentDateTime`
  - `hasAttachments` (boolean)
- **Body Format**: Request plain text via header `Prefer: outlook.body-content-type="text"`
- **Storage Decision**: Full plain-text body with quoted history stored (CTO approval 2026-10-09)
- **Attachments**: Excluded from download per security requirements

**SharePoint Sites**:
- **UNVERIFIED** (needs sandbox check): Specific endpoints for document library access
- **Expected**: `GET /v1.0/sites/{site-id}/drive/root/children`

### Read Capabilities
- ✅ Email messages from single project mailbox
- ✅ Plain-text body content with quote history
- ✅ Conversation threading via `conversationId`
- ✅ Sender, recipients, timestamps
- ✅ Attachment detection (flag only, no downloads)
- ✅ SharePoint site content (one site)
- ✅ Pagination via `@odata.nextLink`
- ✅ Filtering via `$filter` OData queries

### Write Capabilities
- ❌ No write operations in MVP (M2)
- 📝 M3 will add draft creation via approvals queue

### Webhooks
- **UNVERIFIED** (needs sandbox check): Microsoft Graph webhooks/subscriptions for mail and SharePoint changes
- **Alternative**: Delta query API for efficient change tracking

### Restrictions
- **Mailbox Scope**: Exactly one project mailbox via RBAC for Applications
- **SharePoint Scope**: Exactly one site via Sites.Selected
- **Attachments**: Detection only, no content download
- **Data Retention**: 30-day purge after disconnect
- **RLS**: All stored email data protected by row-level security

### Difficulty
- **Medium**: Multi-tenant Entra ID apps, RBAC/Sites.Selected scoping complexity
- **Considerations**:
  - Exchange Online RBAC requires PowerShell configuration
  - Sites.Selected requires SharePoint admin role to assign
  - Scoped permissions must be verified per-tenant

### Security
- ✅ OAuth 2.0 with application-level credentials
- ✅ Mailbox access restricted via Exchange RBAC (no tenant-wide access)
- ✅ SharePoint access restricted to single site
- ✅ Token storage in Supabase Vault
- ✅ No attachment downloads
- ✅ 30-day automatic purge
- ✅ RLS on all stored messages
- ⚠️ Ensure unscoped permissions are removed from Entra ID to prevent privilege escalation

### Recommended Architecture
1. **Auth Layer**: Separate Entra apps for sign-in vs. data access, tokens in Supabase Vault
2. **Sync Service**: 
   - Mail: Poll `/messages` endpoint with delta query or `$filter` on receivedDateTime
   - SharePoint: Poll site drive for changes
3. **Storage**: 
   - Postgres tables: `emails` (full body, conversationId, participants, timestamps)
   - RLS by project membership
   - 30-day TTL via cron
4. **Processing**: Extract email facts (decisions, questions, commitments) for AI context
5. **API Layer**: Supabase Edge Functions expose `get_email_facts` tool

---

## Primavera P6 (Schedule Data)

### API/MCP Availability
- **API**: P6 EPPM Web Services (SOAP-based) - **Not recommended** for MVP
- **MCP Server**: None identified
- **XER File Format**: Tab-delimited proprietary text format ([docs](https://docs.oracle.com/cd/F25600_01/English/admin/p6_pro_importing_exporting/export_projects_to_an_xer_file.htm))
- **Recommended**: Weekly XER file upload (manual or automated export)

### Authentication
- **Method**: File upload only (no API integration in MVP)
- **Delivery**: 
  - Option 1: Manual upload via SiteTech interface
  - Option 2: Automated weekly export + cloud storage pickup (e.g., S3, Azure Blob)
  - Option 3: Email attachment to project inbox (parsed by mail integration)

### Data Access
**XER File Contents** ([data map](https://docs.oracle.com/cd/E90746_01/English/Mapping_and_Schema/xer_import_export_data_map_project/xer_import_export_data_map_project.pdf)):
- **PROJECT**: Project metadata, dates, calendar assignments
- **PROJWBS**: Work Breakdown Structure hierarchy
- **TASK**: Activities with start/finish dates, duration, status, percent complete
- **TASKPRED**: Activity relationships (predecessors/successors)
- **TASKRSRC**: Resource assignments to activities
- **CALENDAR**: Project calendars and working days
- **SCHEDOPTIONS**: Schedule calculation settings (critical path, float calculations)
- **ACTVCODE**: Activity codes and user-defined fields (via UDFVALUE table)

**Key Schedule Fields**:
- Activity ID, name, WBS path
- Planned start/finish, actual start/finish, remaining duration
- Total float, free float (critical path indicators)
- Status (not started, in progress, completed)
- Resource assignments

### Read Capabilities
- ✅ Full project schedule snapshot
- ✅ Activity dates and durations
- ✅ Critical path via float calculations
- ✅ WBS hierarchy
- ✅ Activity relationships (predecessors, successors, lags)
- ✅ Resource assignments
- ⚠️ **Note**: Baselines NOT included in XER (use P6 XML if baseline comparison required)

### Write Capabilities
- ❌ No write-back to P6
- 📝 Read-only schedule analysis

### Webhooks
- ❌ Not applicable (file-based)

### Restrictions
- **Frequency**: Weekly manual/automated uploads
- **Format**: XER only (P6 version 5.0+)
- **Baselines**: Not included in XER exports
- **Real-time**: Not available; data is point-in-time snapshot

### Difficulty
- **Low**: Well-documented tab-delimited format, parser libraries available
- **Considerations**:
  - XER parsing requires handling multi-table relationships
  - Activity codes are user-defined (schema varies by company)
  - Float calculations may need recalculation if schedule logic changes
  - Weekly cadence means ~3-7 day data lag

### Security
- ✅ File upload only (no persistent connection)
- ✅ XER file deleted after parsing
- ✅ Parsed schedule data stored with RLS
- ✅ 30-day automatic purge
- ⚠️ Ensure uploaded files are scanned for malware
- ⚠️ Validate XER structure before parsing to prevent injection attacks

### Recommended Architecture
1. **Upload Interface**: Secure file upload endpoint (Supabase Storage with virus scanning)
2. **Parser Service**: 
   - Parse XER tab-delimited tables
   - Build relational data model (projects, activities, relationships, resources)
   - Calculate derived metrics (critical path, schedule slippage vs. baseline dates)
3. **Storage**: 
   - Postgres tables: `p6_activities`, `p6_relationships`, `p6_resources`
   - Store upload timestamp for version tracking
   - RLS by project
   - 30-day TTL
4. **API Layer**: Edge Functions expose `get_schedule` tool (activities + float calculations)
5. **Alerting**: Compare current vs. previous week to detect new schedule slips

---

## Future Integrations (Post-MVP)

The following systems are **not built before MVP** but are documented for future reference:

- **Autodesk Construction Cloud (ACC)**: Official API available, similar to Procore integration complexity
- **BuildingConnected**: API available for bid management, prequalification
- **Bluebeam Studio**: API for drawing markups, RFIs on plans
- **Microsoft Teams**: Graph API for channel messages, file shares (similar to Outlook/SharePoint pattern)
- **Sage 300 Construction**: API available for job costing, billing data
- **Viewpoint**: API for ERP data, change orders, subcontract management
- **CMiC**: API for integrated project management, accounting
- **Permitting Systems**: Varies by jurisdiction; typically browser automation or email parsing as fallback
- **Lender Portals**: Varies by lender; browser automation likely required due to lack of APIs
