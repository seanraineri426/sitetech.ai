# M1 Findings Columns
**Owner:** Engineering  
**Status:** Draft, Oct 9 2026  
**Purpose:** Document the `findings` table structure for AI-detected issues. Written only by service role, read by org members via RLS.

---

## Note

**As of Oct 9 2026:** This table does not yet exist in `supabase/migrations`. This document describes the planned schema. Once the migration is created, reconcile this doc against actual DDL (main wins).

---

## Table: `findings`

Service-role-written findings detected by AI rules, with citations and evidence.

### Schema

```sql
CREATE TABLE public.findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID NOT NULL,
  entity_type TEXT NOT NULL, -- 'rfi', 'submittal', 'email', 'meeting', etc.
  
  -- Nullable FKs: exactly one must be set for the entity_type (enforced by CHECK)
  rfi_id UUID REFERENCES public.rfis(id) ON DELETE CASCADE,
  submittal_id UUID REFERENCES public.submittals(id) ON DELETE CASCADE,
  
  source TEXT NOT NULL, -- 'procore', 'msgraph_mail', 'p6_xer', 'granola'
  external_id TEXT NOT NULL,
  rule_id TEXT NOT NULL, -- e.g. 'rfi_overdue', 'submittal_chase'
  rule_version TEXT NOT NULL,
  fingerprint TEXT NOT NULL, -- Deterministic hash for deduplication
  
  title TEXT NOT NULL,
  record_label TEXT NOT NULL, -- Human-readable label, e.g. "RFI 112: Shaft wall fire rating"
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'suppressed')),
  severity TEXT NOT NULL, -- OPEN: enum values
  
  days_overdue INT,
  governing_date DATE, -- Due date, start date, or other controlling date
  governing_date_kind TEXT, -- 'due_date', 'start_date', 'deadline', etc.
  spec_section TEXT,
  responsible_party TEXT, -- Company name or role, NEVER an email address
  
  citations JSONB NOT NULL DEFAULT '[]', -- [{source, entity_type, external_id, label?}]
  evidence JSONB NOT NULL DEFAULT '{}',
  
  change_since_prior_run TEXT, -- 'new', 'updated', 'unchanged'
  first_detected_on DATE NOT NULL,
  last_seen_on DATE NOT NULL,
  resolved_on DATE,
  run_date DATE NOT NULL, -- Detection run date
  
  cost_exposure_usd NUMERIC,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Composite FK to projects for cross-org integrity
  CONSTRAINT findings_org_project_fk 
    FOREIGN KEY (project_id, org_id) 
    REFERENCES public.projects(id, org_id),
  
  -- Exactly one entity FK must be set for the entity_type
  CONSTRAINT findings_one_entity_fk CHECK (
    (entity_type = 'rfi' AND rfi_id IS NOT NULL AND submittal_id IS NULL) OR
    (entity_type = 'submittal' AND submittal_id IS NOT NULL AND rfi_id IS NULL) OR
    (entity_type NOT IN ('rfi', 'submittal') AND rfi_id IS NULL AND submittal_id IS NULL)
  ),
  
  -- Unique per fingerprint within project
  CONSTRAINT findings_unique_fingerprint 
    UNIQUE (org_id, project_id, fingerprint)
);
```

### Indexes

```sql
CREATE INDEX idx_findings_org_project_status_severity 
  ON public.findings(org_id, project_id, status, severity);

CREATE INDEX idx_findings_org_project_entity_type 
  ON public.findings(org_id, project_id, entity_type);

CREATE INDEX idx_findings_org_project_run_date 
  ON public.findings(org_id, project_id, run_date);
```

### RLS Policies

```sql
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;

-- Org members can view findings
CREATE POLICY "Org members can view findings"
  ON public.findings FOR SELECT
  TO authenticated
  USING (public.is_org_member(org_id));

-- No insert/update/delete policies for authenticated - service role only
```

---

## Citations Structure

```typescript
type FindingCitation = {
  source: 'procore' | 'msgraph_mail' | 'p6_xer' | 'granola' | 'project_settings' | 'manual';
  entity_type: string;
  external_id: string;
  label?: string;
};
```

Stored as JSONB array in `findings.citations`. Does NOT include `connection_id`, `data_date`, or `quote` (those are in the UI Citation type for client-side enrichment).

---

## Evidence Structure

OPEN: evidence schema not yet defined. Will include excerpts, computed values, and provenance.

---

## Notes

- **No `location` column**: Join `rfis.location` or `submittals.spec_section` instead when location is needed
- **Composite FKs**: All FKs to projects carry both `org_id` and `project_id` for cross-org integrity
- **Service role writes only**: Findings are written by the detection service, never by authenticated users
- **Fingerprint deduplication**: Deterministic hash prevents duplicate findings across runs

---

## Differences from Original Spec

None yet - table does not exist in migrations. When migration is created, note differences here (main wins).
