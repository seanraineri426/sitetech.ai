/**
 * Provisional normalized types for SiteTech connectors.
 * These will be reconciled with the actual DB tables once the shared schema lands.
 * 
 * All dates are ISO-8601 strings. Money values are numbers (no currency in this layer).
 * Source IDs are preserved as strings.
 */

export interface NormalizedRFI {
  // Stable SiteTech fingerprint (hash of allowlisted fields)
  fingerprint: string;
  
  // Core identifiers
  source_id: string;
  number: string;
  project_id: string;
  company_id?: string;
  
  // Content
  subject: string;
  question: string | null;
  official_response: string | null;
  
  // Status and classification
  source_status: string;
  location: string | null;
  cost_code: string | null;
  specification_section: {
    number: string | null;
    description: string | null;
  } | null;
  drawing_number: string | null;
  
  // People and responsibility
  ball_in_court: string | null;
  assignees: Array<{
    id: string | null;
    name: string | null;
    email: string | null;
    company: string | null;
  }>;
  responsible_contractor: string | null;
  rfi_manager: {
    id: string | null;
    name: string | null;
    email: string | null;
  } | null;
  received_from: {
    id: string | null;
    name: string | null;
    email: string | null;
    company: string | null;
  } | null;
  
  // Dates (ISO-8601 strings)
  initiated_at: string | null;
  due_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  
  // Impact tracking (preserve raw structure, don't collapse)
  cost_impact: {
    status: string; // "yes_unknown", "yes_known", "no_impact", "tbd", etc.
    value: number | null;
  } | null;
  schedule_impact: {
    status: string;
    value: number | null; // days
  } | null;
  
  // Source metadata
  source_system: "procore";
  source_endpoint: string;
  synced_at: string;
}

export interface NormalizedSubmittal {
  // Stable SiteTech fingerprint
  fingerprint: string;
  
  // Core identifiers
  source_id: string;
  number: string;
  project_id: string;
  company_id?: string;
  
  // Content (description explicitly excluded per CTO)
  title: string;
  specification_section: string | null;
  location: string | null;
  cost_code: string | null;
  
  // Status and workflow
  source_status: string;
  current_revision: string | null;
  
  // Approvers with revision history
  approvers: Array<{
    id: string | null;
    name: string | null;
    email: string | null;
    revision: string | null;
    response: string; // Can include "revise_resubmit"
    responded_at: string | null;
  }>;
  
  // People
  responsible_contractor: string | null;
  ball_in_court: string | null;
  
  // Dates (ISO-8601 strings)
  created_at: string | null;
  updated_at: string | null;
  received_date: string | null;
  due_date: string | null;
  required_on_site_date: string | null;
  
  // Timing fields
  lead_time: number | null; // days
  design_team_review_time: number | null; // days
  internal_review_time: number | null; // days
  buffer_time: number | null; // days
  
  // Schedule linkage
  scheduled_task: {
    id: string | null;
    code: string | null;
    name: string | null;
  } | null;
  
  // Source metadata
  source_system: "procore";
  source_endpoint: string;
  synced_at: string;
}

export interface NormalizedScheduleActivity {
  // Stable fingerprint
  fingerprint: string;
  
  // Core identifiers
  source_id: string;
  activity_code: string | null;
  name: string;
  wbs: string | null;
  project_id: string;
  
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
  total_float: number | null; // days
  is_critical: boolean;
  
  // Relationships
  predecessors: Array<{
    activity_id: string;
    type: string; // FS, SS, FF, SF
    lag: number | null; // days
  }>;
  
  // Source metadata
  source_system: "p6_xer";
  source_file: string;
  parsed_at: string;
}

/**
 * Connector interface contract (provisional).
 * Each connector implements these methods for integration with the sync engine.
 */
export interface ConnectorContract<T> {
  authorize(config: unknown): Promise<{ authorized: boolean; error?: string }>;
  backfill(config: unknown, since?: string): AsyncIterable<T>;
  incrementalSync(config: unknown, cursor: string): Promise<{
    records: T[];
    nextCursor: string;
  }>;
  listAllIds(config: unknown): Promise<string[]>;
  mapToNormalized(raw: unknown): T;
}
