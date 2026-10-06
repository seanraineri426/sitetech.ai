/**
 * Procore API response types (allowlist-aligned).
 */

export interface ProcoreRFI {
  id: number;
  number: string;
  subject: string;
  question: string | null;
  official_response: string | null;
  status: string;
  location: string | null;
  cost_code: {
    id: number | null;
    name: string | null;
  } | null;
  assignees: Array<{
    id: number;
    name: string;
  }>;
  responsible_contractor: {
    id: number;
    name: string;
  } | null;
  initiated_at: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  cost_impact: {
    status: string;
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
    revision: string | null;
    response: string;
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

export interface ProcoreProject {
  id: number;
  name: string;
  project_number: string | null;
  active: boolean;
  company: {
    id: number;
  };
}
