/**
 * Procore API response types.
 * Based on official Procore REST API documentation.
 */

/**
 * Procore RFI response (v1.0 /rest/v1.0/projects/{project_id}/rfis)
 */
export interface ProcoreRFI {
  id: number;
  number: string;
  subject: string;
  question: string | null;
  status: string;
  location: string | null;
  cost_code: {
    id: number | null;
    name: string | null;
  } | null;
  specification_section: {
    number: string | null;
    description: string | null;
  } | null;
  drawing_number: string | null;
  ball_in_court: string | null;
  assignees: Array<{
    id: number;
    name: string;
    email_address: string | null;
    company: {
      id: number;
      name: string;
    } | null;
  }>;
  responsible_contractor: {
    id: number;
    name: string;
  } | null;
  rfi_manager: {
    id: number;
    name: string;
    email_address: string | null;
  } | null;
  received_from: {
    id: number;
    name: string;
    email_address: string | null;
    company: {
      id: number;
      name: string;
    } | null;
  } | null;
  initiated_at: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  official_response: string | null;
  cost_impact: {
    status: string; // "yes_unknown", "yes_known", "no_impact", "tbd"
    value: number | null;
  } | null;
  schedule_impact: {
    status: string;
    value: number | null;
  } | null;
  project: {
    id: number;
  };
  company: {
    id: number;
  };
}

/**
 * Procore Submittal response (v1.1 /rest/v1.1/projects/{project_id}/submittals)
 */
export interface ProcoreSubmittal {
  id: number;
  number: string;
  title: string;
  revision: string | null;
  status: string;
  specification_section: string | null;
  location: string | null;
  cost_code: {
    id: number | null;
    name: string | null;
  } | null;
  responsible_contractor: {
    id: number;
    name: string;
  } | null;
  ball_in_court: string | null;
  created_at: string;
  updated_at: string;
  received_date: string | null;
  due_date: string | null;
  required_on_site_date: string | null;
  lead_time: number | null;
  design_team_review_time: number | null;
  internal_review_time: number | null;
  buffer_time: number | null;
  approvers: Array<{
    id: number;
    name: string;
    email_address: string | null;
    revision: string | null;
    response: string; // Can include "revise_resubmit"
    responded_at: string | null;
  }>;
  scheduled_task: {
    id: number | null;
    code: string | null;
    name: string | null;
  } | null;
  project: {
    id: number;
  };
  company: {
    id: number;
  };
}

/**
 * Procore Project response
 */
export interface ProcoreProject {
  id: number;
  name: string;
  project_number: string | null;
  active: boolean;
  company: {
    id: number;
  };
}

/**
 * Paginated v2 response envelope
 */
export interface ProcoreV2Response<T> {
  data: T[];
  meta: {
    pagination: {
      total_count: number;
      page: number;
      per_page: number;
    };
  };
}
