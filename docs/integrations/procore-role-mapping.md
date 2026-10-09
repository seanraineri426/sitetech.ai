# Procore Role Mapping to SiteTech Roles

How Procore's project directory and role system map onto SiteTech's four core roles (PE, Super, PM, PX), enabling automatic assignment of findings to the appropriate team member.

## SiteTech Roles

- **PE (Project Engineer)**: Technical coordination, RFIs, submittals, shop drawings
- **Super (Superintendent)**: Field operations, daily reports, schedule coordination, subcontractor management
- **PM (Project Manager)**: Overall project delivery, budget, schedule, client relations, change management
- **PX (Project Executive)**: Senior oversight, owner relations, major decisions, notices, dispute resolution

## Procore Project Directory Structure

### Project Users Endpoint

`GET /rest/v1.0/projects/{project_id}/users` ([docs](https://developers.procore.com/reference/rest/v1/project-users?version=1.0))

**Available Fields** (verified from official API docs):
- `id` (integer): Globally unique Procore user ID
- `name` (string): Full name
- `first_name` (string)
- `last_name` (string)
- `email` (string): Unique across Procore accounts
- `job_title` (string): Free-text job title entered by user or admin
- `vendor` (object): `{id, name}` - Company/subcontractor affiliation
- `party_id` (integer): Directory party ID, null if no person record associated
- `is_employee` (boolean): Employee vs. external contractor
- `initials` (string)

**Note**: Use `view=normal` query parameter to retrieve full field set. Users without Directory read permissions are limited to compact view.

### Project Roles Endpoint

`GET /rest/v1.0/project_roles?project_id={project_id}` ([docs](https://www.withone.ai/knowledge/procore/conn_mod_def%3A%3AGLdYJEcYNCA%3A%3AkJG3bSnBQ1m0dd4VDihDGQ))

**Structure**: Returns relationships between users and roles for a specific project.

**Fields**:
- `user_id` (integer): References user from Project Users endpoint
- `role` (string): **Company-configurable role name** (e.g., "Project Engineer", "Superintendent", "Project Manager", "Project Executive")
- `project_id` (integer): Project context
- `add_to_project_team` (boolean): Whether user is part of core team

**Critical Distinction**: Procore Project Roles are **company-specific**. Role names like "Project Engineer" or "Senior PM" are defined by each company and vary across organizations. There is no standard Procore role taxonomy.

### RFI and Submittal Assignee Fields

**RFI Endpoint**: `GET /rest/v1.0/projects/{project_id}/rfis` ([docs](https://developers.procore.com/reference/rest/rfis?version=latest))

**UNVERIFIED** (needs sandbox check): Specific assignee field names in RFI response object. Expected fields based on create endpoint:
- `assignee_id` (integer): Single assignee (deprecated in favor of `assignee_ids`)
- `assignee_ids` (array of integers): Multiple assignees
- `required_assignee_ids` (array of integers): Assignees required to respond
- `rfi_manager_id` (integer): RFI manager (typically PM or PE)

**Submittal Endpoint**: `GET /rest/v1.1/projects/{project_id}/submittals` ([docs](https://developers.procore.com/reference/rest/submittals))

**UNVERIFIED** (needs sandbox check): Specific assignee/manager field names in submittal response. Expected fields:
- `received_from_id` (integer): Vendor/subcontractor who submitted
- `responsible_contractor_id` (integer): Vendor responsible for the submittal
- **UNVERIFIED**: Assignee or approver field name for internal reviewer

## Role Mapping Resolution Order

When a Procore user is synced to SiteTech, their role is determined by this precedence:

### 1. Explicit SiteTech Role (Manual Override) - **ALWAYS WINS**

**Source**: `project_members.sitetech_role_override` (set by PM during project setup or user invite)

**Method**: PM explicitly assigns a SiteTech role when inviting a user to the SiteTech project.

**Storage**:
```sql
-- project_members table
sitetech_role_override TEXT CHECK (sitetech_role_override IN ('PE', 'Super', 'PM', 'PX')),
role_source TEXT DEFAULT 'manual' -- 'manual' when override is set
```

**Rationale**: PM knows the team structure and can override any automatic mapping. This is the source of truth.

---

### 2. Procore Project Role Mapping (Company-Specific)

**Source**: Procore `project_roles` endpoint → company-specific role name → SiteTech role via lookup table

**Method**: 
1. Fetch user's Procore project role(s) from `GET /rest/v1.0/project_roles?project_id={id}`
2. Look up role name in `procore_role_mappings` table (per-company configuration)
3. Assign mapped SiteTech role

**Storage**:
```sql
-- procore_role_mappings table (per-company configuration)
CREATE TABLE procore_role_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  procore_role_name TEXT NOT NULL, -- e.g., "Project Engineer", "Assistant PM"
  sitetech_role TEXT NOT NULL CHECK (sitetech_role IN ('PE', 'Super', 'PM', 'PX')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, procore_role_name)
);
```

**Example Mappings**:
| Procore Role Name (Company-Specific) | SiteTech Role |
|--------------------------------------|---------------|
| "Project Engineer"                   | PE            |
| "Assistant Project Engineer"         | PE            |
| "APE"                                | PE            |
| "Superintendent"                     | Super         |
| "Assistant Superintendent"           | Super         |
| "General Superintendent"             | Super         |
| "Project Manager"                    | PM            |
| "Senior Project Manager"             | PM            |
| "PM"                                 | PM            |
| "Project Executive"                  | PX            |
| "VP Operations"                      | PX            |
| "Senior Project Executive"           | PX            |

**Implementation Notes**:
- Each company configures their own mapping table during onboarding
- Admin interface allows adding/editing role mappings: "When Procore role is X, treat as SiteTech role Y"
- Case-insensitive matching: "project engineer" matches "Project Engineer"
- Multiple Procore roles can map to the same SiteTech role
- If a user has multiple Procore project roles, the **highest precedence** SiteTech role wins (PX > PM > Super > PE)

**CTO Approval Status**: Pending CTO approval to access `project_roles` endpoint and `role` field (not included in base permission template).

---

### 3. Job Title Keyword Match (Suggested, Not Final)

**Source**: Procore `job_title` field (from Project Users endpoint) → keyword pattern match → suggested SiteTech role

**Method**:
1. Extract `job_title` from Procore user record
2. Match against keyword patterns (case-insensitive)
3. Assign role with `role_source='job_title'` and **flag as "suggested, confirm"**

**Keyword Patterns**:
| Keywords (case-insensitive, partial match) | SiteTech Role |
|--------------------------------------------|---------------|
| "project engineer", " PE ", "APE"          | PE            |
| "superintendent", "super", "field super"   | Super         |
| "project manager", " PM ", "senior PM"     | PM            |
| "project executive", " PX ", "VP operations" | PX          |

**Storage**:
```sql
-- project_members table
role TEXT CHECK (role IN ('PE', 'Super', 'PM', 'PX')),
role_source TEXT DEFAULT 'job_title', -- 'job_title' when matched from title
role_confirmed BOOLEAN DEFAULT FALSE -- FALSE when job_title match, requires PM confirmation
```

**User Experience**:
- Job title matches are marked as **"Suggested"** in the SiteTech UI
- PM sees: "John Doe - Suggested Role: PE (based on job title 'Project Engineer') - [Confirm] [Change]"
- Until confirmed, findings assigned to this role are escalated to PM instead

**Rationale**: Job titles are less reliable than explicit role assignments (they vary widely, may be outdated, and are free-text). Use as a suggestion only, require PM confirmation.

**CTO Approval Status**: Pending CTO approval to access `job_title` field (not included in base permission template).

---

### 4. No Role Assigned (Fallback)

**Condition**: User exists in Procore project directory but:
- No explicit SiteTech role override
- No Procore project role, or role name not in mapping table
- Job title is null or doesn't match keyword patterns

**Result**:
```sql
role = NULL
role_source = 'none'
```

**Routing Rule**: Findings for users with no assigned role are **escalated to the PM** by default.

**User Experience**:
- PM sees: "Jane Smith - No Role Assigned - [Assign Role]"
- PM can manually assign a role at any time

---

## Finding Assignment Rules

When a finding is generated, it is assigned to a SiteTech user or role based on these rules:

### 1. RFI/Submittal Findings

**Assignment Logic**:
1. If RFI/submittal has a Procore `assignee_id` or `assignee_ids`:
   - Look up Procore user ID → SiteTech user via `procore_user_mappings`
   - If SiteTech user exists and has a confirmed role → assign finding to that user
   - If SiteTech user exists but role is unconfirmed (job_title match) → assign to **PE role** (any user with PE role)
   - If Procore user not linked to SiteTech → assign to **PE role**
2. If no assignee → assign to **PE role** (default for RFIs/submittals)

**Example**:
- Procore RFI assignee: User ID 12345 (John Doe)
- Lookup: `procore_user_mappings` shows Procore user 12345 → SiteTech user `abc-123` (John Doe, role=PE, confirmed)
- Finding assigned to: SiteTech user `abc-123`

**Fallback**: If no PE role exists on the project → escalate to **PM role**.

---

### 2. Schedule Slip Findings

**Assignment Logic**:
- All schedule-related findings (critical path activities, negative float, missed milestones) → **PM role**
- Rationale: PM owns the schedule and recovery plans

---

### 3. Change Event Findings

**Assignment Logic**:
- Change events (potential change orders, cost impacts, scope changes) → **PM role**
- Rationale: PM manages contract changes and budget

---

### 4. Notice Findings

**Assignment Logic**:
- Formal notices from owner, lender, or regulatory agencies → **PX role**
- Rationale: PX handles senior-level communications and disputes

---

### 5. Email-Based Findings

**Assignment Logic**:
1. If email fact references a specific RFI/submittal → use RFI/Submittal assignment logic above
2. If email fact references schedule → assign to **PM role**
3. If email fact is a notice or owner communication → assign to **PX role**
4. Otherwise → assign to **PM role** (default)

---

## Linking Procore Users to SiteTech Users

**Matching Method**: **Email-only match** (code-level, RLS-protected, never exposed to AI model)

### Implementation

```sql
-- procore_user_mappings table
CREATE TABLE procore_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  procore_user_id INTEGER NOT NULL, -- Globally unique Procore user ID
  sitetech_user_id UUID REFERENCES users(id),
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  match_method TEXT DEFAULT 'email', -- Always 'email' for automatic matches
  UNIQUE(project_id, procore_user_id)
);

-- Matching query (executed server-side, never in AI context)
INSERT INTO procore_user_mappings (project_id, procore_user_id, sitetech_user_id, match_method)
SELECT 
  p.project_id,
  pu.procore_user_id,
  u.id AS sitetech_user_id,
  'email' AS match_method
FROM procore_users pu
JOIN users u ON LOWER(pu.email) = LOWER(u.email) -- Case-insensitive email match
JOIN projects p ON pu.project_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM procore_user_mappings m 
  WHERE m.project_id = p.project_id AND m.procore_user_id = pu.procore_user_id
);
```

**Security Rules**:
1. Email addresses are **never sent to the AI model** in any tool output
2. Email matching is performed **server-side only** in Supabase RLS policies or Edge Functions
3. AI tools receive only:
   - `user_id` (SiteTech internal UUID)
   - `name` (full name, non-sensitive)
   - `role` (PE/Super/PM/PX)
4. Procore API email field is stored in RLS-protected `procore_users` table and accessed only for matching logic

**RLS Policy Example**:
```sql
-- procore_users table is RLS-protected
ALTER TABLE procore_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON procore_users
  FOR ALL USING (auth.role() = 'service_role'); -- Only server-side access

-- AI tools query project_members (email excluded)
CREATE VIEW project_members_safe AS
SELECT 
  user_id,
  name,
  role,
  role_source,
  job_title,
  vendor_id,
  vendor_name,
  is_active
FROM project_members
-- email column intentionally excluded from view
```

---

## Additional Procore Fields Required (Pending CTO Approval)

The following Procore fields are **not included in the base read-only permission template** and require CTO approval to add to the allowlist:

### From Project Users Endpoint:
- `email` (for email-based user matching; RLS-protected, never exposed to model)
- `job_title` (for job title keyword matching; exposed to model for role suggestion)
- `vendor.id` (for subcontractor affiliation; exposed to model)
- `vendor.name` (for subcontractor affiliation; exposed to model)

### From Project Roles Endpoint:
- `role` (Procore project role name; for company-specific role mapping; exposed to model)
- `user_id` (to link roles to users)

### Security Justification:
- **Email**: Server-side only, never sent to model, used solely for linking Procore users to SiteTech users via code-level match
- **Job Title, Vendor, Role**: Used for role assignment logic; non-sensitive business data necessary for core functionality

---

## Role Mapping Admin Interface (Future Implementation)

**Company Onboarding Flow**:
1. PM connects Procore account
2. SiteTech fetches project roles from `GET /rest/v1.0/project_roles?project_id={id}` and extracts unique role names
3. Admin interface shows:
   ```
   Map Procore Roles to SiteTech Roles
   
   Procore Role Name          → SiteTech Role
   ────────────────────────────────────────────
   Project Engineer           → [PE ▼]
   Assistant PE               → [PE ▼]
   Superintendent             → [Super ▼]
   Assistant Superintendent   → [Super ▼]
   Project Manager            → [PM ▼]
   Senior PM                  → [PM ▼]
   Project Executive          → [PX ▼]
   VP Operations              → [PX ▼]
   Estimator                  → [No Role ▼]
   Safety Manager             → [No Role ▼]
   ```
4. PM reviews and edits mappings, clicks **Save**
5. Mappings stored in `procore_role_mappings` table
6. Role assignment runs automatically on next sync

---

## Example Workflow

**Scenario**: Overdue RFI finding needs assignment

1. **Finding Generated**: "RFI 023 is overdue by 14 days"
2. **Fetch RFI Data**: Query `rfis` table → `rfi_number='RFI-023'`, `assignee_id=12345` (Procore user ID)
3. **Look Up Assignee**:
   - Query `procore_user_mappings` WHERE `procore_user_id=12345` → `sitetech_user_id='abc-123'`
   - Query `project_members` WHERE `user_id='abc-123'` → `name='John Doe'`, `role='PE'`, `role_source='procore_role'`, `role_confirmed=TRUE`
4. **Assign Finding**: Finding assigned to SiteTech user `abc-123` (John Doe, PE)
5. **Tool Output** (`get_findings`):
   ```json
   {
     "finding_id": "...",
     "category": "overdue_rfi",
     "assigned_to": {
       "user_id": "abc-123",
       "name": "John Doe",
       "role": "PE"
     }
   }
   ```
   (Email address **not included** in tool output)

---

## Summary

- **Three-tier role resolution**: Manual override (always wins) → Procore project role mapping (company-configurable) → Job title keyword match (suggested, requires confirmation)
- **Routing rules**: RFI/submittal → assignee or PE role; schedule slip → PM; change event → PM; notice → PX
- **Email matching**: Server-side only, RLS-protected, never exposed to AI model
- **CTO approval needed**: Access to `email`, `job_title`, `vendor`, and `project_roles` endpoint fields
