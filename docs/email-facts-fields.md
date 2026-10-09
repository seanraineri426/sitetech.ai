# Email Facts Fields
**Owner:** Engineering  
**Status:** Draft, Oct 9 2026  
**Purpose:** Document the `email_facts` table structure for model-extracted facts with exact quotes, then judged by code. Same pattern used for `rfi_facts`.

---

## Note

**As of Oct 9 2026:** This table does not yet exist in `supabase/migrations`. This document describes the planned schema. Once the migration is created, reconcile this doc against actual DDL (main wins).

---

## Table: `email_facts`

Per-email facts extracted by the model with exact quotes from the redacted body, then judged by code. Code performs activity joins, float math, dollar calculations, and ranking.

### Schema

```sql
CREATE TABLE public.email_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID NOT NULL,
  email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  
  item TEXT NOT NULL, -- Type of fact: 'delay', 'cost_change', 'scope_addition', etc.
  
  -- Date changes (e.g., commitments, schedule updates)
  old_date DATE,
  new_date DATE,
  
  -- Cost/budget information
  amount_usd NUMERIC,
  
  -- Notice type (can be multiple)
  notice_type TEXT[] DEFAULT '{}', 
  -- Values: 'delay_time_extension', 'cost_change_claim', 'cure_default', 
  --         'differing_site_condition', 'other'
  
  -- Party identification (ALWAYS overwritten by code via project_parties lookup)
  sender_party TEXT, -- Company name from project_parties, never email address
  
  -- Model confidence (0-1)
  confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  
  -- Verbatim quote from redacted email body
  quote TEXT NOT NULL, -- Must match token boundaries in the redacted body_text
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Composite FK to projects for cross-org integrity
  CONSTRAINT email_facts_org_project_fk 
    FOREIGN KEY (project_id, org_id) 
    REFERENCES public.projects(id, org_id),
  
  -- Composite FK to emails
  CONSTRAINT email_facts_email_fk
    FOREIGN KEY (email_id, org_id, project_id)
    REFERENCES public.emails(id, org_id, project_id)
);
```

### Indexes

```sql
CREATE INDEX idx_email_facts_org_project 
  ON public.email_facts(org_id, project_id);

CREATE INDEX idx_email_facts_email_id 
  ON public.email_facts(email_id);

CREATE INDEX idx_email_facts_item 
  ON public.email_facts(item);
```

### RLS Policies

```sql
ALTER TABLE public.email_facts ENABLE ROW LEVEL SECURITY;

-- Org members can view email facts
CREATE POLICY "Org members can view email facts"
  ON public.email_facts FOR SELECT
  TO authenticated
  USING (public.is_org_member(org_id));

-- No insert/update/delete policies for authenticated - service role only
```

---

## Table: `rfi_facts` (Same Pattern)

RFI facts follow the same structure as email facts:

```sql
CREATE TABLE public.rfi_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID NOT NULL,
  rfi_id UUID NOT NULL REFERENCES public.rfis(id) ON DELETE CASCADE,
  
  item TEXT NOT NULL,
  old_date DATE,
  new_date DATE,
  amount_usd NUMERIC,
  notice_type TEXT[] DEFAULT '{}',
  sender_party TEXT,
  confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  quote TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT rfi_facts_org_project_fk 
    FOREIGN KEY (project_id, org_id) 
    REFERENCES public.projects(id, org_id),
  
  CONSTRAINT rfi_facts_rfi_fk
    FOREIGN KEY (rfi_id, org_id, project_id)
    REFERENCES public.rfis(id, org_id, project_id)
);
```

---

## Extraction and Judgment Rules

1. **Model extracts facts** with exact quotes from the redacted email/RFI body
2. **Quote must match verbatim** on token boundaries in the redacted `body_text`
3. **Code judges facts** against rules:
   - Overwrites `sender_party` via `project_parties` lookup (domain → company name)
   - Performs activity joins for schedule-related facts
   - Computes float impact (from P6 schedule data)
   - Computes dollar impact (float × daily delay cost)
   - Ranks findings by $ exposure
4. **No model defaults**: If the model can't extract a value, it's left NULL

---

## Notice Type Values

Enum values for `notice_type` array (can be multiple per fact):

- `delay_time_extension` - Schedule delay / time extension request
- `cost_change_claim` - Cost impact / change claim
- `cure_default` - Cure notice / default notice
- `differing_site_condition` - DSC notice
- `other` - Other contractual notice

Maps to `public.notice_type` enum in the database schema.

---

## Redaction and Quotes

- Email addresses in stored `body_text` are replaced with `[email-<domain>]` placeholders
- `quote` field contains verbatim text from the **redacted** body
- UI Citation type adds `connection_id`, `data_date`, and `quote` for client-side rendering
- Server-side facts store only the quote without connection metadata

---

## Code Responsibilities

The code (not the model) is responsible for:

1. **Activity join**: Linking facts to `schedule_activities` via task codes or fuzzy matching
2. **Float math**: Computing float impact using P6 `total_float_days`
3. **Dollar calculation**: `float_impact × daily_delay_cost_usd`
4. **Ranking**: Ordering findings by cost exposure, float impact, or deadline proximity
5. **Sender party override**: Always overwriting `sender_party` via `project_parties` lookup
6. **Verification**: Ensuring quotes match verbatim on token boundaries

---

## Differences from Original Spec

None yet - table does not exist in migrations. When migration is created, note differences here (main wins).
