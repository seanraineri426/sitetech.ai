# UI Data Contracts
**Owner:** Product + Engineering  
**Status:** Draft, Oct 9 2026  
**Purpose:** Strict TypeScript types and Zod schemas for API responses the UI renders. No runtime logic, no fetch code, no `any`. Backend enforces permissions; UI hides controls based on these contracts.

---

## Core Principles

1. **Verified values come only from code.** An `ai_suggested` value can never be shown as `verified`.
2. **When an input is missing, value is null and confirm_required is set.** There are no defaults.
3. **Anything undefined gets marked OPEN, never guessed.**
4. **Backend enforces permissions; UI hides controls** but documents what each role can see/approve/execute.

---

## 1. Measure<T>

A measured value with provenance, confidence, and citation trail.

```typescript
type Measure<T> = {
  value: T | null;
  unit: 'usd' | 'working_days' | 'calendar_days' | 'date' | 'count' | 'percent' | 'hours';
  provenance: 'verified' | 'ai_suggested' | 'approved';
  computed_by: {
    kind: 'rule' | 'calc' | 'model' | 'human';
    id: string;
    version: string;
  };
  citations: Citation[];
  as_of: string; // ISO timestamp - snapshot data date or run time
  confidence?: number; // 0-1, only for ai_suggested
  confirm_required?: string; // e.g. 'Set delay cost', 'Confirm lead time'
};
```

**Rules:**
- `verified` values come only from code (deterministic computation)
- An `ai_suggested` value can never be shown as `verified`
- When an input is missing: `value = null`, `confirm_required` is set
- No defaults; missing inputs must be explicitly confirmed

**Fixture example:**
```typescript
{
  value: 48000,
  unit: 'usd',
  provenance: 'verified',
  computed_by: {
    kind: 'calc',
    id: 'completion_slip_impact',
    version: '1.0.0'
  },
  citations: [
    {
      source: 'project_settings',
      entity_type: 'delay_cost',
      external_id: 'proj_12345',
      label: 'Daily delay cost',
      data_date: '2026-10-08'
    },
    {
      source: 'p6_xer',
      entity_type: 'schedule_activity',
      external_id: 'LINDEN:A3000',
      label: 'Exterior envelope closeout',
      quote: 'Critical path activity, 0 days float',
      data_date: '2026-10-08'
    }
  ],
  as_of: '2026-10-09T18:27:42Z'
}
```

---

## 2. Citation

Reference to source record with optional quote and data date. UI type enriches stored citations with connection metadata.

```typescript
type Citation = {
  source: 'procore' | 'msgraph' | 'p6_upload' | 'granola' | 'project_settings' | 'manual'; // Unified: msgraph maps to mail/drive
  entity_type: string; // e.g. 'rfi', 'email', 'schedule_activity', 'meeting'
  external_id: string; // External system's ID
  label?: string; // Human-readable label
  connection_id?: string | null; // UUID of integration_connection for stale detection (UI-added, nullable)
  data_date?: string; // ISO date - when this record was captured (UI-added)
  quote?: string; // Verbatim text from redacted body (UI-added)
};
```

**Purpose:** Every number on screen must cite its source. `connection_id` allows cards to show "source stale" next to the exact number it affects.

**Storage vs. UI:**
- **Stored citations** (in `findings.citations` JSONB): `{source, entity_type, external_id, label?}` - strict shape
- **UI citations** (enriched): Add optional `connection_id` (nullable), `data_date`, and `quote` from linked records

**Source names:** Unified to match DB `integration_provider` enum: `procore`, `msgraph` (maps to mail/drive), `p6_upload`, `granola`. All schemas agree on these names.

**API validation:** API rejects any citation whose `(source, entity_type, external_id)` does not resolve to a synced row (see `docs/m1-findings-columns.md`).

**Fixture example:**
```typescript
{
  connection_id: '550e8400-e29b-41d4-a716-446655440000',
  source: 'procore',
  entity_type: 'rfi',
  external_id: '112',
  label: 'RFI 112: Shaft wall fire rating',
  quote: 'What is the required fire rating for the shaft wall at grid line B?',
  data_date: '2026-10-08'
}
```

---

## 3. SourceFreshness

Derived on the server from `integration_connections` + `sync_runs`. Shows connection health and staleness. Never set in a component.

```typescript
type SourceFreshness = {
  connection_id: string; // UUID
  provider: 'procore' | 'msgraph_mail' | 'msgraph_drive' | 'p6_upload' | 'granola';
  mode: 'stored' | 'in_memory';
  health: 'ok' | 'degraded' | 'auth_expired' | 'disconnected' | 'never_synced';
  last_success_at: string | null; // ISO timestamp
  last_attempt_at: string | null; // ISO timestamp
  stale: boolean; // Computed on server against per-provider threshold (OPEN: threshold values)
  error_code: string | null; // Stable codes: AUTH_EXPIRED, RATE_LIMITED, OUT_OF_SCOPE
  records_skipped: number;
  checkpoint_reset_at: string | null; // ISO timestamp
};
```

**Purpose:** UI shows "source stale" warnings when `stale = true` or `health != 'ok'`. Citations include `connection_id` to link specific numbers to their freshness status.

**Fixture example:**
```typescript
{
  connection_id: '550e8400-e29b-41d4-a716-446655440000',
  provider: 'procore',
  mode: 'stored',
  health: 'ok',
  last_success_at: '2026-10-09T05:12:00Z',
  last_attempt_at: '2026-10-09T05:12:00Z',
  stale: false,
  error_code: null,
  records_skipped: 0,
  checkpoint_reset_at: null
}
```

---

## 4. Finding

A detected issue requiring attention (input to actions).

```typescript
type Finding = {
  id: string;
  project_id: string;
  kind: string; // e.g. 'rfi_overdue', 'submittal_chase', 'owner_directive_no_ce'
  detected_at: string; // ISO timestamp
  entity_type: string;
  external_id: string;
  measures: {
    float_days?: Measure<number>;
    dollar_impact?: Measure<number>;
    days_overdue?: Measure<number>;
    days_to_activity?: Measure<number>;
  };
  linked_records: Citation[];
  owner_role: 'PE' | 'PM' | 'PX';
  assigned_to?: string; // User ID or name
  suppressed: boolean;
  suppressed_reason?: string;
};
```

**Fixture example:**
```typescript
{
  id: 'find_abc123',
  project_id: 'proj_12345',
  kind: 'rfi_overdue',
  detected_at: '2026-10-09T05:12:00Z',
  entity_type: 'rfi',
  external_id: '112',
  measures: {
    float_days: {
      value: 3,
      unit: 'working_days',
      provenance: 'verified',
      computed_by: { kind: 'calc', id: 'p6_float', version: '1.0.0' },
      citations: [
        {
          connection_id: '550e8400-e29b-41d4-a716-446655440000',
          source: 'p6_xer',
          entity_type: 'schedule_activity',
          external_id: 'LINDEN:A2310',
          label: 'L3 shaft framing',
          data_date: '2026-10-08'
        }
      ],
      as_of: '2026-10-09T05:12:00Z'
    },
    dollar_impact: {
      value: 36000,
      unit: 'usd',
      provenance: 'verified',
      computed_by: { kind: 'calc', id: 'critical_path_cost', version: '1.0.0' },
      citations: [],
      as_of: '2026-10-09T05:12:00Z'
    },
    days_overdue: {
      value: 6,
      unit: 'calendar_days',
      provenance: 'verified',
      computed_by: { kind: 'calc', id: 'date_diff', version: '1.0.0' },
      citations: [],
      as_of: '2026-10-09T05:12:00Z'
    }
  },
  linked_records: [
    {
      connection_id: '550e8400-e29b-41d4-a716-446655440000',
      source: 'procore',
      entity_type: 'rfi',
      external_id: '112',
      label: 'RFI 112: Shaft wall fire rating'
    }
  ],
  owner_role: 'PE',
  assigned_to: 'Sarah Chen',
  suppressed: false
}
```

---

## 5. Action

Registry action prepared for approval. From Actions Registry (A1-A11).

```typescript
type Action = {
  id: string; // Action instance ID
  action_id: string; // Registry action ID: 'rfi-overdue-escalation', 'submittal-chase', etc.
  version: number;
  project_id: string;
  finding_id: string;
  owner_role: 'PE' | 'PM' | 'PX';
  assigned_to?: string;
  stage: 'detect' | 'investigate' | 'simulate' | 'approve' | 'execute' | 'verify';
  due_at: string | null; // ISO timestamp
  escalation_level: 0 | 1 | 2; // 0=owner_role, 1=one up, 2=PX
  requires_procore: boolean;
  measures: {
    float_protected?: Measure<number>;
    dollars_at_risk?: Measure<number>;
    days_to_deadline?: Measure<number>;
  };
  draft: {
    kind: 'email' | 'change_event' | 'minutes' | 'notice_card';
    to?: string; // Company + role, not specific address
    subject?: string;
    body?: string; // Plaintext or HTML
    attachments?: Array<{ name: string; url: string }>;
    deep_link?: string; // Procore CE creation link, etc.
    read_only: boolean; // Always true for M2
  };
  approval: Approval | null;
  created_at: string;
  updated_at: string;
};
```

**Fixture example (A1: RFI overdue escalation):**
```typescript
{
  id: 'action_xyz789',
  action_id: 'rfi-overdue-escalation',
  version: 1,
  project_id: 'proj_12345',
  finding_id: 'find_abc123',
  owner_role: 'PE',
  assigned_to: 'Sarah Chen',
  stage: 'approve',
  due_at: '2026-10-13T17:00:00Z',
  escalation_level: 0,
  requires_procore: true,
  measures: {
    float_protected: {
      value: 3,
      unit: 'working_days',
      provenance: 'verified',
      computed_by: { kind: 'calc', id: 'p6_float', version: '1.0.0' },
      citations: [],
      as_of: '2026-10-09T05:12:00Z'
    },
    dollars_at_risk: {
      value: 36000,
      unit: 'usd',
      provenance: 'verified',
      computed_by: { kind: 'calc', id: 'critical_path_cost', version: '1.0.0' },
      citations: [],
      as_of: '2026-10-09T05:12:00Z'
    },
    days_to_deadline: {
      value: 4,
      unit: 'working_days',
      provenance: 'verified',
      computed_by: { kind: 'calc', id: 'date_diff', version: '1.0.0' },
      citations: [],
      as_of: '2026-10-09T05:12:00Z'
    }
  },
  draft: {
    kind: 'email',
    to: 'Architect (via Outlook)',
    subject: 'RFI 112 overdue – L3 shaft framing starts Tue Oct 13',
    body: 'RFI 112 is now 6 days past due and controls L3 shaft framing starting Tue 10/13. We need the response by Fri 10/9 COB to hold the start. Float at risk: 3 days. $ at risk: $36,000 (3 days × $12,000/day).\n\nCan you provide the shaft wall fire rating answer by Friday 10/9?',
    read_only: true
  },
  approval: null,
  created_at: '2026-10-09T05:12:00Z',
  updated_at: '2026-10-09T05:12:00Z'
}
```

---

## 6. Approval

Approval/dismissal record for an action.

```typescript
type Approval = {
  id: string;
  action_id: string;
  tier: 'PE' | 'PM' | 'PX' | 'CEO'; // OPEN: CEO tier not in current enum
  approver_id: string;
  approver_name: string;
  decision: 'approved' | 'edited' | 'dismissed';
  dismiss_reason?: 'already_handled' | 'not_relevant' | 'wrong';
  edit_summary?: string;
  decided_at: string; // ISO timestamp
  sent_at?: string; // ISO timestamp - user-confirmed or detected in sent items
  audit_event_ids: string[]; // References to audit_events table
};
```

**Fixture example:**
```typescript
{
  id: 'appr_def456',
  action_id: 'action_xyz789',
  tier: 'PE',
  approver_id: 'user_sarah',
  approver_name: 'Sarah Chen',
  decision: 'approved',
  decided_at: '2026-10-09T08:15:00Z',
  sent_at: '2026-10-09T08:16:00Z',
  audit_event_ids: ['audit_001', 'audit_002']
}
```

---

## 7. Scenario / WhatIfResult

Output from what-if scenario analysis (docs/what-if-math.md).

```typescript
type Scenario = {
  activity_id: string;
  activity_name: string;
  slip_working_days: number;
  confidence: 'high' | 'medium' | 'low'; // Internal only
  match_reason: string;
  alternative_matches?: Array<{ activity_id: string; activity_name: string; match_reason: string }>;
};

type WhatIfResult = {
  scenario: Scenario;
  impacts: {
    primary_activity: {
      activity_id: string;
      activity_name: string;
      original_early_finish: string; // ISO date
      new_early_finish: string;
      slip_working_days: number;
      float_consumed: number;
      remaining_float: number;
      on_critical_path: boolean;
    };
    successors: Array<{
      activity_id: string;
      activity_name: string;
      propagated_delay: number;
      p6_total_float: number;
      resulting_float: number;
      on_critical_path: boolean;
    }>;
    project_completion: {
      original_date: string; // ISO date
      new_date: string;
      slip_working_days: number;
      slip_calendar_days: number;
    };
  };
  dollars: {
    dollar_impact: number | null;
    completion_slip_working_days: number;
    completion_slip_calendar_days: number;
    daily_delay_cost: number | null;
    daily_delay_cost_unit: 'calendar_day' | 'working_day';
    daily_delay_cost_source: 'project_settings' | 'not_configured';
  };
  notices: Array<{
    notice_type: 'delay_time_extension' | 'cost_change_claim' | 'differing_site_condition' | 'change_directive_dispute' | 'cure_default' | 'injury_property_damage' | 'other';
    notice_info: string;
    event_date: string; // ISO date
    notice_period_days: number;
    calendar_or_business: 'calendar' | 'business';
    notice_deadline: string | null; // ISO date
    deadline_source: string; // e.g. 'project_settings_contract_section_8.3'
  }>;
  suggested_actions: Array<{
    action_id: string;
    action_name: string;
    target_activity_id: string | null;
    reason: string;
  }>;
  source_data: {
    schedule_snapshot: string;
    schedule_data_date: string; // ISO date
    project_settings: string;
    computed_at: string; // ISO timestamp
  };
  estimate_label: 'estimate, confirm in P6';
};
```

**Fixture example:**
```typescript
{
  scenario: {
    activity_id: 'A2310',
    activity_name: 'L3 shaft framing',
    slip_working_days: 21,
    confidence: 'high',
    match_reason: 'Exact match on activity name "shaft framing" and location "L3"'
  },
  impacts: {
    primary_activity: {
      activity_id: 'A2310',
      activity_name: 'L3 shaft framing',
      original_early_finish: '2026-10-22',
      new_early_finish: '2026-11-20',
      slip_working_days: 21,
      float_consumed: 3.0,
      remaining_float: -18.0,
      on_critical_path: true
    },
    successors: [
      {
        activity_id: 'A2320',
        activity_name: 'L3 MEP rough-in',
        propagated_delay: 18.0,
        p6_total_float: 3.0,
        resulting_float: -15.0,
        on_critical_path: true
      }
    ],
    project_completion: {
      original_date: '2026-11-19',
      new_date: '2026-12-14',
      slip_working_days: 15,
      slip_calendar_days: 25
    }
  },
  dollars: {
    dollar_impact: 300000,
    completion_slip_working_days: 15,
    completion_slip_calendar_days: 25,
    daily_delay_cost: 12000,
    daily_delay_cost_unit: 'calendar_day',
    daily_delay_cost_source: 'project_settings'
  },
  notices: [
    {
      notice_type: 'delay_time_extension',
      notice_info: 'If this happens: notice period per settings is 7 business days (§8.3), deadline Dec 3. Confirm with PX.',
      event_date: '2026-11-20',
      notice_period_days: 7,
      calendar_or_business: 'business',
      notice_deadline: '2026-12-03',
      deadline_source: 'project_settings_contract_section_8.3'
    }
  ],
  suggested_actions: [
    {
      action_id: 'schedule-slip-recovery',
      action_name: 'Vendor slip recovery options',
      target_activity_id: 'A2310',
      reason: 'Activity slips and consumes float'
    }
  ],
  source_data: {
    schedule_snapshot: 'P6_XER_2026-10-08_05-12',
    schedule_data_date: '2026-10-08',
    project_settings: 'project_12345_settings_v3',
    computed_at: '2026-10-09T18:27:42Z'
  },
  estimate_label: 'estimate, confirm in P6'
}
```

---

## 8. Evidence

Evidence items with "Why?" panel and open-in-source link.

```typescript
type Evidence = {
  id: string;
  kind: 'email' | 'rfi' | 'submittal' | 'meeting' | 'schedule_activity' | 'change_event';
  source: Citation;
  excerpt?: string; // Brief text excerpt
  why_panel: {
    title: string;
    explanation: string; // Why this evidence supports the finding/action
    computed_by: { kind: string; id: string; version: string };
  };
  open_in_source_link?: string; // Deep link to Procore, email, etc.
  sender_auth?: {
    spf: 'pass' | 'fail' | 'unknown';
    dkim: 'pass' | 'fail' | 'unknown';
    dmarc: 'pass' | 'fail' | 'unknown';
    compauth: 'pass' | 'fail' | 'unknown';
    verdict: 'pass' | 'fail' | 'unknown';
  }; // Only for email evidence
};
```

**Fixture example:**
```typescript
{
  id: 'evid_001',
  kind: 'email',
  source: {
    connection_id: '550e8400-e29b-41d4-a716-446655440001',
    source: 'msgraph_mail',
    entity_type: 'email',
    external_id: 'AAMkAGI2T...',
    label: 'RE: EV charger locations',
    quote: 'We need to add 4 additional Level 2 chargers on the east side of the parking structure.',
    data_date: '2026-10-05'
  },
  excerpt: 'We need to add 4 additional Level 2 chargers...',
  why_panel: {
    title: 'Owner directive with scope addition',
    explanation: 'This email from the owner adds scope (4 additional chargers) with no existing change event linked. Registry rule A4 triggers change event draft.',
    computed_by: { kind: 'rule', id: 'owner_directive_detector', version: '1.0.0' }
  },
  open_in_source_link: 'https://outlook.office365.com/mail/...',
  sender_auth: {
    spf: 'pass',
    dkim: 'pass',
    dmarc: 'pass',
    compauth: 'pass',
    verdict: 'pass'
  }
}
```

---

## 9. AgentTask

Agent operations queue task.

```typescript
type AgentTask = {
  id: string;
  project_id: string;
  task: 'sync_procore' | 'sync_email' | 'import_xer' | 'detect_findings' | 'draft_actions' | 'compute_scenario';
  linked_action_id?: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  current_checkpoint?: string;
  allowed_registry_actions: string[]; // e.g. ['rfi-overdue-escalation', 'submittal-chase']
  created_at: string;
  started_at?: string;
  finished_at?: string;
  error_code?: string;
  error_summary?: string;
};
```

**Fixture example:**
```typescript
{
  id: 'task_123',
  project_id: 'proj_12345',
  task: 'detect_findings',
  status: 'running',
  current_checkpoint: 'processing_rfis',
  allowed_registry_actions: ['rfi-overdue-escalation', 'submittal-chase', 'fabrication-hold'],
  created_at: '2026-10-09T05:00:00Z',
  started_at: '2026-10-09T05:01:00Z'
}
```

---

## 10. AuditEvent

Audit trail for actions and outcomes.

```typescript
type AuditEvent = {
  id: string;
  action_id: string;
  event_type: 'created' | 'approved' | 'edited' | 'dismissed' | 'sent' | 'outcome_confirmed';
  user_id?: string;
  user_name?: string;
  timestamp: string; // ISO timestamp
  metadata: {
    model_call_id?: string;
    model_version?: string;
    verifier_result?: 'pass' | 'fail';
    verifier_failure_reason?: string;
    sentence_provenance?: Array<{ sentence: string; source: 'template' | 'model' }>;
    dismiss_reason?: string;
    edit_summary?: string;
    detection_method?: 'user_confirmed' | 'sent_item_match';
    outcome_kind?: string; // e.g. 'rfi_answered', 'ce_created', 'notice_responded'
    outcome_on_time?: boolean;
    float_saved?: number;
    dollars_saved?: number;
  };
};
```

**Fixture example:**
```typescript
{
  id: 'audit_001',
  action_id: 'action_xyz789',
  event_type: 'approved',
  user_id: 'user_sarah',
  user_name: 'Sarah Chen',
  timestamp: '2026-10-09T08:15:00Z',
  metadata: {
    model_call_id: 'call_abc123',
    model_version: 'gpt-5.6',
    verifier_result: 'pass'
  }
}
```

---

## 11. Permission Model

Which roles can see, approve, or execute each action tier. Backend enforces; UI hides controls.

```typescript
type PermissionMatrix = {
  action_id: string; // Registry action ID
  tiers: {
    PE?: { can_view: boolean; can_approve: boolean; can_execute: boolean };
    PM?: { can_view: boolean; can_approve: boolean; can_execute: boolean };
    PX?: { can_view: boolean; can_approve: boolean; can_execute: boolean };
    CEO?: { can_view: boolean; can_approve: boolean; can_execute: boolean }; // OPEN: CEO tier
  };
  escalation_path: Array<'PE' | 'PM' | 'PX' | 'CEO'>;
};
```

**Example (A1: RFI overdue escalation):**
```typescript
{
  action_id: 'rfi-overdue-escalation',
  tiers: {
    PE: { can_view: true, can_approve: true, can_execute: true },
    PM: { can_view: true, can_approve: true, can_execute: true },
    PX: { can_view: true, can_approve: true, can_execute: true }
  },
  escalation_path: ['PE', 'PM', 'PX']
}
```

**Example (A6: Notice response):**
```typescript
{
  action_id: 'notice-response',
  tiers: {
    PM: { can_view: true, can_approve: false, can_execute: false }, // PM prepares only
    PX: { can_view: true, can_approve: true, can_execute: true }
  },
  escalation_path: ['PX'] // Already PX-tier; urgent handling
}
```

---

## 12. UI States

How loading, empty, stale, permission-denied, and error states are represented.

```typescript
type LoadingState<T> = {
  kind: 'loading';
  data?: T; // Optional stale data while refreshing
};

type EmptyState = {
  kind: 'empty';
  message: string; // e.g. "Nothing needs you today on Linden Yard"
};

type StaleState<T> = {
  kind: 'stale';
  data: T;
  stale_since: string; // ISO timestamp
  stale_threshold_hours: number; // OPEN: per-provider threshold
  freshness: SourceFreshness[];
};

type PermissionDeniedState = {
  kind: 'permission_denied';
  required_role: 'PE' | 'PM' | 'PX' | 'CEO';
  user_role: 'PE' | 'PM' | 'PX' | 'CEO' | 'viewer';
};

type ErrorState = {
  kind: 'error';
  error_code: string; // Stable code
  error_message: string;
  retry_allowed: boolean;
};

type DataState<T> = 
  | { kind: 'success'; data: T }
  | LoadingState<T>
  | EmptyState
  | StaleState<T>
  | PermissionDeniedState
  | ErrorState;
```

**Fixture example (stale):**
```typescript
{
  kind: 'stale',
  data: { /* action data */ },
  stale_since: '2026-10-08T18:00:00Z',
  stale_threshold_hours: 12,
  freshness: [
    {
      connection_id: '550e8400-e29b-41d4-a716-446655440000',
      provider: 'procore',
      mode: 'stored',
      health: 'degraded',
      last_success_at: '2026-10-08T18:00:00Z',
      last_attempt_at: '2026-10-09T05:12:00Z',
      stale: true,
      error_code: 'RATE_LIMITED',
      records_skipped: 3,
      checkpoint_reset_at: null
    }
  ]
}
```

---

## 13. Unverified Senders Section

Special section type for unverified senders. Rows labeled UNVERIFIED, never count in totals or rankings, carry hypothetical-impact Measure, include `add_party_allowed` boolean.

```typescript
type UnverifiedSenderRow = {
  sender_domain: string;
  sender_display_name: string;
  email_count: number;
  hypothetical_impact: Measure<number>; // What the $ would be if verified
  sample_subjects: string[]; // Up to 3 recent subjects
  add_party_allowed: boolean; // Whether user can add this domain to project_parties
  sender_auth_summary: {
    pass_count: number;
    fail_count: number;
    unknown_count: number;
  };
};

type UnverifiedSendersSection = {
  section_type: 'unverified_senders';
  label: 'UNVERIFIED';
  rows: UnverifiedSenderRow[];
  warning: string; // e.g. "These senders are not in your project parties list. Add them to enable actions."
};
```

**Fixture example:**
```typescript
{
  section_type: 'unverified_senders',
  label: 'UNVERIFIED',
  rows: [
    {
      sender_domain: 'newvendor.com',
      sender_display_name: 'New Vendor Co',
      email_count: 5,
      hypothetical_impact: {
        value: 125000,
        unit: 'usd',
        provenance: 'ai_suggested',
        computed_by: { kind: 'model', id: 'cost_estimator', version: '1.0.0' },
        citations: [],
        as_of: '2026-10-09T05:12:00Z',
        confidence: 0.7,
        confirm_required: 'Add party to verify'
      },
      sample_subjects: [
        'RE: Steel fabrication schedule',
        'Updated shop drawings',
        'Delivery delay notification'
      ],
      add_party_allowed: true,
      sender_auth_summary: {
        pass_count: 5,
        fail_count: 0,
        unknown_count: 0
      }
    }
  ],
  warning: 'These senders are not in your project parties list. Add them to enable actions.'
}
```

---

## Fixture Priority Order

1. **Project Action Workspace** - PE/PM/PX daily action queue (Actions A1-A11)
2. **Portfolio Command Center** - PX multi-project rollup
3. **Agent Operations** - AgentTask queue and system health

---

## OPEN Items

1. **CEO escalation tier** - A11 outgoing delay notice escalates to CEO if not approved by PX. Current approval tier enum supports only PE/PM/PX. Add CEO tier or change A11 escalation target? (actions-registry.md on main, line ~600)

2. **gc_vendor party enum** - A6 notice response tracking mentions gc_vendor as a contract_kind counterparty. Current `company_role` enum on main: owner, architect_engineer, gc, sub. Add gc_vendor role or clarify mapping? (actions-registry.md on main, line ~306)

3. **Stale threshold values** - Per-provider staleness thresholds for SourceFreshness.stale computation:
   - procore: ? hours
   - msgraph (mail/drive): ? hours
   - p6_upload: ? hours
   - granola: ? hours

4. **Lead time rule** - A2 submittal chase uses: (1) the submittal's `lead_time_days` field if set, else (2) per-project lead time by spec division (configured at onboarding), else (3) "Confirm lead time" with no $ impact shown. **There are NO defaults**—missing values require explicit confirmation. **Note:** actions-registry.md line ~90 still incorrectly says "or project default" - needs fixing.

5. **Delay cost unit** - Confirm whether `projects.daily_delay_cost_usd` is per calendar day or working day (affects what-if $ calculations and critical-path slip conversions). (what-if-math.md on main, line ~147)

6. **hours_per_day source** - What-if math needs `hours_per_day` for float conversion (P6 stores float in hours). **Note:** P6 parser currently hard-codes 8 h/day; what-if-math has DEFAULT 8. Propose adding to `projects` table or storing in XER metadata? (what-if-math.md on main, line ~78)

7. **A5 resequence for no-float activities** - When activity has ≤ 0 float remaining, should the resequence suggestion be omitted entirely, or shown with a note that float is exhausted? (actions-registry.md on main, line ~770)

8. **SourceFreshness field sources** - `mode` source unclear (integration_connections field or derived?); `checkpoint_reset_at` source unclear. Do partial sync runs (status='partial') count as success for `last_success_at`?

9. **Approval.audit_log_ids** - References `audit_log.id` (bigint). Ensure migrations/API align on this reference vs. separate audit_events table.

---

## Version History

- **v1.0 (Oct 9, 2026, 19:17 UTC):** Initial draft with all 13 contract types, fixtures, permission model, UI states, unverified senders section, SourceFreshness integration, email sender_auth, and 9 documented OPEN items.
- **v1.1 (Oct 9, 2026, 19:26 UTC):** Added `docs/m1-findings-columns.md` and `docs/email-facts-fields.md` reconciled against main migrations (tables don't exist yet; docs describe planned schema). Clarified Citation storage vs. UI enrichment (stored citations lack connection_id/data_date/quote; UI adds them). Fixed OPEN #4 wording (no lead-time defaults). Noted current enum differences for CEO tier and gc_vendor. OPEN count: 7 (resolved #8, #9).
- **v2.0 (Oct 9, 2026, 19:44 UTC):** **Independent review corrections.** Rebased onto main (34 commits). Matched m1-findings-columns.md to PR #7 Lead-aligned version (composite FKs, required unique indexes, CHECK constraint, severity enum, uppercase rule_id, cost_exposure_usd limit, API rejection note). Updated email-facts-fields.md (7-value notice_type enum, $ = completion slip × daily cost). Approval.audit_log_ids references audit_log.id (bigint). Citation: connection_id nullable, StoredCitation .strict(), unified source names (procore/msgraph/p6_upload/granola). SourceFreshness: documented field sources, health='ok' refine. Provenance validation with zod refines + NEGATIVE tests (verified+model, verified+confidence, null w/o confirm, verified $ w/o citations, ai_suggested $, suppressed w/o reason, read_only literal true, email evidence requires sender_auth). Finding/Evidence: unverified_sender flag. UnverifiedSendersSection: split reason (auth_failed/not_on_project_parties), removed ai_suggested $. Action: can_approve field. Fixtures: marked SYNTHETIC, fixed A1 $ calc (completion slip × daily cost), fixed dates, neutral model placeholder. OPEN #4/#6 notes added. OPEN count: 9.
