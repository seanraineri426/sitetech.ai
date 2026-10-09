/**
 * Provisional normalized types for SiteTech connectors.
 * These will be reconciled with the actual DB tables once the shared schema lands.
 * 
 * All dates are ISO-8601 strings. Money values are numbers (no currency in this layer).
 * External IDs are preserved as strings.
 */

export interface NormalizedRFI {
  // Entity identification
  entity_type: "rfi";
  external_id: string;
  fingerprint: string;
  
  // Source identifiers
  source_project_id: string;
  source_company_id?: string;
  
  // Core fields
  number: string;
  subject: string;
  question: string | null;
  official_response: string | null;
  
  // Status
  status: string;
  source_status: string;
  
  // Classification
  location: { id: string; name: string } | null;
  cost_code: string | null;
  
  // People (IDs and names only, no emails)
  assignees: Array<{
    id: string | null;
    name: string | null;
  }>;
  responsible_contractor: {
    id: string | null;
    name: string | null;
  } | null;
  
  // Dates (ISO-8601 strings)
  initiated_at: string | null;
  due_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  
  // Impact tracking (preserve raw structure)
  cost_impact: {
    status: string;
    value: number | null;
  } | null;
  schedule_impact: {
    status: string;
    value: number | null;
  } | null;
}

export interface NormalizedSubmittal {
  // Entity identification
  entity_type: "submittal";
  external_id: string;
  fingerprint: string;
  
  // Source identifiers
  source_project_id: string;
  source_company_id?: string;
  
  // Core fields
  number: string;
  title: string;
  specification_section: string | null;
  
  // Status
  status: string;
  source_status: string;
  current_revision: string | null;
  
  // Classification
  location: string | null;
  cost_code: string | null;
  
  // Approvers with revision history (IDs and names only, no emails)
  approvers: Array<{
    id: string | null;
    name: string | null;
    revision: string | null;
    response: string;
    responded_at: string | null;
  }>;
  
  // Dates (ISO-8601 strings)
  created_at: string | null;
  updated_at: string | null;
  received_date: string | null;
  due_date: string | null;
  required_on_site_date: string | null;
  
  // Timing fields
  lead_time: number | null;
  design_team_review_time: number | null;
  internal_review_time: number | null;
  buffer_time: number | null;
  
  // Schedule linkage
  scheduled_task: {
    id: string | null;
    code: string | null;
    name: string | null;
  } | null;
}

export interface NormalizedScheduleActivity {
  // Entity identification
  entity_type: "schedule_activity";
  external_id: string; // Composite: {proj_short_name}:{task_code}
  fingerprint: string;
  
  // Source identifiers
  source_project_id: string;
  task_id: string; // Internal P6 task_id (not in fingerprint)
  
  // Core fields
  activity_code: string | null;
  name: string;
  wbs: string | null;
  
  // Dates (ISO-8601 date strings, not date-time)
  planned_start: string | null;
  planned_finish: string | null;
  actual_start: string | null;
  actual_finish: string | null;
  early_start: string | null;
  early_finish: string | null;
  late_start: string | null;
  late_finish: string | null;
  
  // Status
  percent_complete: number | null;
  total_float: number | null;
  is_critical: boolean;
  
  // Relationships
  predecessors: Array<{
    activity_id: string;
    type: string;
    lag: number | null;
  }>;
}

export interface NormalizedEmail {
  // Entity identification
  entity_type: "email";
  external_id: string;
  fingerprint: string;
  
  // Source identifiers
  source_mailbox: string;
  
  // Core fields
  subject: string;
  body_preview: string;
  from: {
    name: string;
    address: string;
  };
  to_recipients: Array<{
    name: string;
    address: string;
  }>;
  cc_recipients: Array<{
    name: string;
    address: string;
  }>;
  
  // Dates (ISO-8601 UTC strings)
  received_at: string;
  sent_at: string;
  received_at_source: "graph" | "forwarded_text";
  
  // Metadata
  has_attachments: boolean;
  importance: "low" | "normal" | "high";
  is_read: boolean;
  categories: string[];
  conversation_id: string;
}

/**
 * Raw record shape for storage layer.
 * Contains allowlisted payload and fingerprint.
 */
export interface RawRecord {
  entityType: string;
  externalId: string;
  allowlistedPayload: Record<string, unknown>;
  fingerprint: string;
}
