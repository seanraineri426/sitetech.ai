# SiteTech Connector Building Blocks

Standalone, pure-TypeScript connector modules for Procore, Microsoft Graph (Mail/SharePoint), and P6 XER parsing.

---

## Test Status

✅ **178/178 tests passing** (9 test files)
- Procore client: 27 tests
- Procore mappers: 41 tests  
- Procore fetchers: 8 tests
- Graph client: 30 tests
- Graph mappers: 25 tests
- Graph fetchers: 12 tests
- P6 parser: 30 tests
- Shared retry: 15 tests
- Canonical stringify: 7 tests

---

## Structure

```
lib/connectors/
├── types.ts                 # Normalized types
├── shared/
│   ├── retry.ts            # Shared retry with Retry-After + backoff
│   └── canonical-stringify.ts  # Deterministic fingerprinting
├── procore/
│   ├── client.ts           # GET-only OAuth client
│   ├── types.ts            # Zod schemas (docs-derived, sandbox pending)
│   ├── mappers.ts          # Allowlist + fingerprinting
│   ├── fetchers.ts         # RFI/Submittal/Project fetchers
│   └── __tests__/
├── msgraph/
│   ├── client.ts           # GET-only client with delta sync
│   ├── types.ts            # Zod schemas  
│   ├── mappers.ts          # Email mapper with domain fingerprinting
│   ├── fetchers.ts         # Page-by-page delta fetchers
│   └── __tests__/
└── p6/
    ├── parser.ts           # Streaming XER parser
    └── __tests__/
```

---

## Features

### Procore Client

**Security:**
- ✅ GET-only enforcement at request chokepoint (before token attached)
- ✅ Foreign origin URLs blocked before token reaches fetch
- ✅ Token endpoint pinned (`PROCORE_AUTH_URL`)
- ✅ `redirect: 'error'` (no silent redirects)
- ✅ Request timeout via AbortSignal

**OAuth:**
- ✅ Client credentials (DMSA) with in-memory token cache (5min buffer)

**Resilience:**
- ✅ Retry-After (seconds + HTTP-date), exponential backoff with jitter
- ✅ 60s max wait cap, RateLimitError when Retry-After exceeds cap
- ✅ Response body cancellation on retry
- ✅ Procore rate limit header logging

**Validation:**
- ✅ Zod validation for ALL API responses (RFI, Submittal, Project)
- ✅ Tolerant schemas (`.passthrough()`) allow new provider fields
- ✅ Malformed payloads yield ZodError without body exposure

**Pagination:**
- ✅ Link header parsing with per-page Zod validation

### Microsoft Graph Client

**Security:**
- ✅ GET-only enforcement (PUT/PATCH/DELETE blocked before token attached)
- ✅ Scoped to `/users/{mailbox}/` and `/sites/{siteId}/` (decoded path segments)
- ✅ Foreign host and foreign nextLink blocked before token attached
- ✅ Handles nextLinks with plain commas/@ signs (not just URL-encoded)
- ✅ `redirect: 'error'`
- ✅ Request timeout via AbortSignal

**OAuth:**
- ✅ App-only client credentials with in-memory token cache

**Resilience:**
- ✅ Retry-After, backoff, 60s cap, RateLimitError
- ✅ 410 detection by HTTP status (not error text)
- ✅ Response body cancellation on retry

**Validation:**
- ✅ Zod validation for paginate and delta pages (Message, DriveItem, MailFolder, Site)

**Delta Sync:**
- ✅ Returns ONE page with checkpoint (nextLink or deltaLink)
- ✅ Fetcher drives the loop page-by-page for mid-run resumability
- ✅ Handles `@removed` and `deleted` facet for deletions

### P6 XER Parser

**Format:**
- ✅ Tab-delimited XER (`%T`, `%F`, `%R`)
- ✅ Streaming via readline over decoded text (not buffered)
- ✅ Encoding detection: UTF-8 BOM or windows-1252
- ✅ True `TextDecoder('windows-1252')` for bytes 0x80-0x9F (smart quotes, en-dash)

**Mapping:**
- ✅ External ID: `{proj_short_name}:{task_code}` composite
- ✅ task_id: Internal P6 ID (output field, NOT in fingerprint)
- ✅ Predecessors mapped to composite IDs, not raw P6 task_id
- ✅ Guards empty task_code: skip + warning, never emit colliding `PROJ:` IDs
- ✅ XER dates are project-local wall-clock times with NO timezone (rules layer applies projects.timezone)
- ✅ Single-pass TASKPRED indexing

---

## CTO-Approved Allowlists (2026-10-07)

### RFI
```typescript
[
  "id", "number", "subject",
  "questions", // Array with answers[] - derived: question, official_response
  "status",
  "location", // Object: {id, name} - KEEP per CTO
  "cost_code", // Object: {id, code, name}
  "assignees", // Array: {id, name} NO login/email
  "responsible_contractor", // Object: {id, name}
  "initiated_at", "due_date", "created_at", "updated_at",
  "cost_impact", // Object: {status, value}
  "schedule_impact", // Object: {status, value}
  "project.id", "company.id"
]
```

**DROPPED:** `drawing_number`, `rfi_manager`, `received_from`, `ball_in_court`, `specification_section`, ALL emails (assignee.login, etc.)

### Submittal
```typescript
[
  "id", "number", "title", "revision", "status",
  "specification_section", // KEEP per CTO
  // location DROPPED per CTO 2026-10-07
  // cost_code DROPPED per CTO 2026-10-07
  "created_at", "updated_at", "received_date", "due_date",
  "required_on_site_date", "lead_time",
  "design_team_review_time", "internal_review_time", "buffer_time",
  "approvers", // Array: {id, name, revision, response, responded_at} NO emails
  "scheduled_task", // Object: {id, name} KEEP per CTO
  "project.id", "company.id"
]
```

**DROPPED:** `location`, `cost_code`, `responsible_contractor`, `ball_in_court`, `description`, ALL emails

### Graph Mail
```typescript
[
  "id", "conversationId", "subject", "bodyPreview",
  "from", "toRecipients", "ccRecipients", // Stored (approved for email records)
  "receivedDateTime", "sentDateTime",
  "hasAttachments", "importance", "categories"
  // isRead: stored but NOT fingerprinted
]
```

**Fingerprint:** id + received_at + subject + body + **domains** (not full addresses) + categories

**NOT fingerprinted:** isRead (read status), raw email addresses (only domains)

### Graph DriveItem
```typescript
[
  "id", "name", "webUrl", "size",
  "createdDateTime", "lastModifiedDateTime",
  "createdBy", // user: {displayName, id} NO email
  "lastModifiedBy", // user: {displayName, id} NO email
  "file", "folder", "parentReference", "deleted"
]
```

**DROPPED:** `createdBy.email`, `lastModifiedBy.email` per CTO

---

## Fingerprinting

**Procore:**
- SHA-256 of exact allowlisted payload (nested objects built from allowlisted subfields only)
- Recursive canonical stringify (sorted keys at every depth, Date → ISO string)
- Internal P6 task_id NOT in fingerprint

**Graph Mail:**
- Fingerprint: id + received_at + subject + body + **participant domains** + categories
- Raw addresses stored but NOT fingerprinted as content (RLS + 30-day purge)
- Model layer maps addresses → company+role

---

## Environment Variables

```bash
# Procore
PROCORE_CLIENT_ID=
PROCORE_CLIENT_SECRET=
PROCORE_COMPANY_ID=
PROCORE_BASE_URL=https://api.procore.com
PROCORE_AUTH_URL=https://login.procore.com

# Microsoft Graph
GRAPH_TENANT_ID=
GRAPH_CLIENT_ID=
GRAPH_CLIENT_SECRET=
GRAPH_MAILBOX=
GRAPH_SITE_ID=
```

**Never commit secrets.** Use Cursor Cloud Agents > Secrets or Supabase Vault.

---

## Testing

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

All commands must exit 0 before merge.

---

## Procore Schemas Status

**Docs-derived (NOT VERIFIED AGAINST SANDBOX)**

RFI and Submittal schemas rebuilt from official Procore REST API docs:
- developers.procore.com
- RFI v1.0, Submittal v1.1

Real API shape:
- RFI: `questions[]` with nested `answers[]`
- Derived fields: `question` = first question body, `official_response` = first answer marked `official: true`

**Sandbox verification pending** - Sean is creating free developer account.

Fixtures: `fixtures/procore/docs/` (header notes docs-derived)

---

## Contributing

- Strict TypeScript mode
- 175/175 tests must pass
- Update allowlists only with CTO approval
- Never store attachments or file content
- Keep dependencies minimal
