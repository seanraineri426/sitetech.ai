# SiteTech Connector Building Blocks

Standalone, pure-TypeScript connector modules for Procore, Microsoft Graph (Mail/SharePoint), and P6 XER parsing. These will be wired into the shared connector interface once it lands.

## Structure

```
lib/connectors/
├── types.ts                 # Provisional normalized types
├── procore/                 # Procore REST API connector
│   ├── client.ts           # GET-only HTTP client with OAuth
│   ├── types.ts            # Procore API response types
│   ├── mappers.ts          # Field allowlists and mapping functions
│   ├── fetchers.ts         # Typed fetchers for RFIs and Submittals
│   └── __tests__/          # Full test coverage
├── msgraph/                # Microsoft Graph connector
│   ├── client.ts           # GET-only HTTP client with delta sync
│   ├── types.ts            # Graph API response types
│   ├── fetchers.ts         # Mail and SharePoint delta fetchers
│   └── __tests__/          # Full test coverage
└── p6/                     # P6 XER parser
    ├── parser.ts           # Tab-delimited XER format parser
    └── __tests__/          # Full test coverage
```

## Features Implemented

### 1. Procore Client (`lib/connectors/procore/`)

**OAuth & HTTP:**
- ✅ Client credentials flow (DMSA) with in-memory token caching
- ✅ Sandbox and production base URLs configurable via env
- ✅ GET-only enforcement (throws on POST/PUT/PATCH/DELETE)
- ✅ Required `Procore-Company-Id` header on all requests
- ✅ Pagination handling via Link headers
- ✅ Rate limit handling (429 + `X-Rate-Limit-*` headers with exponential backoff)
- ✅ 503 with `Retry-After` support
- ✅ Record mode for fixture generation (writes to `fixtures/procore/`)

**Typed Fetchers:**
- ✅ `fetchRFIs()` - paginated RFI fetch with `updated_since` filter
- ✅ `fetchSubmittals()` - paginated Submittal fetch with `updated_since` filter
- ✅ `listRFIIds()` - ID-only listing for deletion detection
- ✅ `listSubmittalIds()` - ID-only listing for deletion detection

**Field Allowlists (CTO-approved 2026-10-06):**

**RFI:**
- Core: `id`, `number`, `subject`, `question`, `official_response`, `status`
- Location/Classification: `location`, `cost_code`, `specification_section`, `drawing_number`
- People: `ball_in_court`, `assignees`, `responsible_contractor`, `rfi_manager`, `received_from`
- Dates: `initiated_at`, `due_date`, `created_at`, `updated_at`
- Impact: `cost_impact` (raw structure: `{status, value}`), `schedule_impact` (raw structure: `{status, value}`)
- **Never stored:** attachments, file data
- **Not computed here:** `is_overdue`, `days_overdue` (rules layer owns these)

**Submittal:**
- Core: `id`, `number`, `title`, `revision`, `status`, `specification_section`
- Location/Classification: `location`, `cost_code`
- People: `responsible_contractor`, `ball_in_court`, `approvers[]` (with full revision history)
- Dates: `created_at`, `updated_at`, `received_date`, `due_date`, `required_on_site_date`
- Timing: `lead_time`, `design_team_review_time`, `internal_review_time`, `buffer_time`
- Schedule: `scheduled_task` (linked activity)
- **Explicitly excluded:** `description` field
- **Never stored:** attachments, file data
- **Preserves:** `revise_resubmit` as an approver response (not collapsed)

**Fingerprinting:**
- ✅ SHA-256 hash of allowlisted fields (sorted keys for stability)
- ✅ Used for change detection
- ✅ Tested for stability (same input → same hash)

### 2. Microsoft Graph Client (`lib/connectors/msgraph/`)

**OAuth & HTTP:**
- ✅ App-only client credentials (multi-tenant support)
- ✅ GET-only enforcement (throws on write verbs)
- ✅ Throttling handling (429, 503 with `Retry-After`)
- ✅ `@odata.nextLink` pagination
- ✅ `ISV|SiteTech|1.0` User-Agent for SharePoint throttling optimization

**Delta Sync:**
- ✅ `delta()` method with `@odata.deltaLink` state management
- ✅ Tracks `@removed` items for deletions
- ✅ Supports starting from previous `deltaLink` or fresh sync
- ✅ `getLatestDeltaLink()` for initializing without full fetch

**Fetchers:**
- ✅ `fetchMailFolderDelta()` - per-folder mail delta (Inbox, Sent Items)
- ✅ `fetchMailDelta()` - combined multi-folder delta with state per folder
- ✅ `fetchDriveDelta()` - SharePoint drive delta (Sites.Selected model)
- ✅ `$select` parameter to fetch only allowlisted fields (no attachment content)

**Field Allowlists:**
- **Message:** `id`, `conversationId`, `subject`, `bodyPreview`, `from`, `to/ccRecipients`, `receivedDateTime`, `hasAttachments`, `categories` (no `body.content` or attachment data)
- **DriveItem:** `id`, `name`, `webUrl`, `size`, `createdDateTime`, `lastModifiedDateTime`, `file/folder`, `parentReference` (no file content)

### 3. P6 XER Parser (`lib/connectors/p6/`)

**Format Support:**
- ✅ Tab-delimited XER format (`%T`, `%F`, `%R` lines)
- ✅ Extracts `PROJECT`, `PROJWBS`, `TASK`, `TASKPRED` tables
- ✅ Handles Windows (CRLF) and Unix (LF) line endings
- ✅ Validates XER format before parsing

**Mapping:**
- ✅ Builds full WBS paths (e.g., "Project Root / Phase 1")
- ✅ Parses XER dates (ISO date only, no time)
- ✅ Converts percent complete (0-100 → 0-1 decimal)
- ✅ Converts float hours to days (÷8)
- ✅ Identifies critical activities (total float ≤ 0)
- ✅ Maps predecessors with type (FS/SS/FF/SF) and lag

**Output:**
- ✅ `NormalizedScheduleActivity[]` with all required fields
- ✅ Stable fingerprints for change detection
- ✅ Source metadata (`source_system: "p6_xer"`, `source_file`, `parsed_at`)

## Provisional Normalized Types

Defined in `lib/connectors/types.ts`:

- `NormalizedRFI` - with fingerprint, all allowlisted fields, source metadata
- `NormalizedSubmittal` - with fingerprint, approver revision history, timing fields
- `NormalizedScheduleActivity` - with WBS, dates, float, criticality, predecessors
- `ConnectorContract<T>` - interface contract for `authorize`, `backfill`, `incrementalSync`, `listAllIds`, `mapToNormalized`

These types will be reconciled with the actual DB tables once the shared schema lands.

## Environment Variables

See `.env.example`:

```bash
# Procore
PROCORE_CLIENT_ID=
PROCORE_CLIENT_SECRET=
PROCORE_COMPANY_ID=
PROCORE_BASE_URL=https://api.procore.com
PROCORE_AUTH_URL=https://login.procore.com
PROCORE_RECORD_MODE=false

# Microsoft Graph
GRAPH_TENANT_ID=
GRAPH_CLIENT_ID=
GRAPH_CLIENT_SECRET=
```

**Never commit secrets.** Use Supabase Vault for production.

## Testing

All connectors have comprehensive test coverage:

```bash
npm run test        # Run all tests
npm run typecheck   # TypeScript strict mode
npm run lint        # ESLint
npm run build       # Production build
```

**Test Coverage:**
- ✅ GET-only enforcement (throws on write verbs)
- ✅ Pagination (Link headers, `@odata.nextLink`)
- ✅ Rate limiting (429, 503 with retry and backoff)
- ✅ Token caching
- ✅ Field allowlists
- ✅ Fingerprint stability (same input → same hash, different input → different hash)
- ✅ Mapping accuracy (all allowlisted fields preserved)
- ✅ XER parsing (tables, WBS paths, dates, float, criticality, predecessors)
- ✅ Edge cases (empty fields, null dates, Windows line endings)

## Glue Needed for Shared Connector Interface

When the shared connector interface lands, wire these modules in:

1. **Config mapping:** Map `ConnectorConfig` → `ProcoreConfig` / `GraphConfig`
2. **State storage:** Store Procore cursors and Graph delta links in Vault-adjacent sync state
3. **Error handling:** Wrap client errors in `ConnectorError` with retry metadata
4. **Batching:** Chunk `backfill()` results by page for Inngest step boundaries
5. **ID normalization:** String IDs are already used; no conversion needed
6. **Fingerprint comparison:** Compare `fingerprint` field to detect changes

Example glue layer:

```typescript
import { Procore } from "@/lib/connectors";

class ProcoreRFIConnector implements ConnectorContract<NormalizedRFI> {
  async authorize(config: ConnectorConfig) {
    const client = new Procore.ProcoreClient({
      clientId: config.credentials.clientId,
      clientSecret: config.credentials.clientSecret,
      companyId: config.companyId,
    });
    // Test with GET /rest/v1.0/companies
    // ...
  }

  async *backfill(config, since) {
    const client = new Procore.ProcoreClient(config.credentials);
    for await (const rfis of Procore.fetchRFIs(client, config.projectId, { updatedSince: since })) {
      yield rfis; // Already normalized
    }
  }

  // incrementalSync, listAllIds, mapToNormalized similarly
}
```

## Unverified Items (from evaluation doc)

These were called out as unverified and should be confirmed against official docs when integrating:

- Procore: exact field names for `cost_impact`, `schedule_impact`, submittal `lead_time` / `required_on_site_date`
- Graph: Teams protected-API requirement post-metering removal (Aug 2025)
- P6: Primavera Cloud API capabilities (not used in V1; V1 uses weekly XER upload)

## Next Steps

1. ✅ **Done:** Connector building blocks with GET-only enforcement, pagination, rate limiting, field allowlists, fingerprinting, and tests
2. **Next (other engineer):** Shared connector interface (`authorize`, `backfill`, `incrementalSync`, `listAllIds`, `mapToNormalized`)
3. **Next (other engineer):** DB tables (`connections`, `sync_runs`, `raw_records`, `rfis`, `submittals`)
4. **Then:** Wire these modules into the shared interface with minimal glue
5. **Then:** Inngest nightly sync job calling the connectors
6. **Then:** Brief generation from normalized records

## Contributing

- Follow strict TypeScript mode (already configured)
- Add tests for new features
- Update field allowlists only with CTO approval
- Never store attachments or file data
- Keep dependencies minimal
