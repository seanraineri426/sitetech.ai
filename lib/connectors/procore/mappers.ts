/**
 * Procore field allowlists and mapping functions.
 * 
 * CTO-approved allowlists (2026-10-07 final):
 * 
 * RFI: number, subject, question, official_response, status,
 *      location (object: {id, name}), cost_code (object: {id, code, name}),
 *      cost_impact and schedule_impact (objects: {status, value}),
 *      dates (initiated_at, due, created, updated),
 *      assignees (array: {id, name} only, NO login/email),
 *      responsible_contractor (object: {id, name} only)
 * 
 * Submittal: number, title, specification_section, status, revision, dates,
 *            required_on_site_date, lead_time, design_team/internal review and
 *            buffer times, received_date, approvers per revision with response
 *            and responded_at ({id, name, revision, response, responded_at}),
 *            scheduled_task (object: {id, name})
 * 
 * DROPPED from Submittals per CTO 2026-10-07: location, cost_code
 * DROPPED from RFIs: drawing_number, rfi_manager, received_from, ball_in_court,
 *                    specification_section, ALL email addresses (assignee.login, etc.)
 * 
 * Attachments and file data NEVER kept.
 * 
 * SECURITY: All nested objects are explicitly built from allowlisted subfields only.
 * Fingerprints computed on the exact allowlisted payload that gets exported.
 */

import { createHash } from "crypto";
import { canonicalStringify } from "../shared/canonical-stringify";
import type { NormalizedRFI, NormalizedSubmittal, RawRecord } from "../types";
import type { ProcoreRFI, ProcoreSubmittal } from "./types";

/**
 * RFI field allowlist (CTO-approved 2026-10-07).
 * Includes location, drops specification_section.
 */
export const RFI_ALLOWLIST = [
  "id",
  "number",
  "subject",
  "question",
  "official_response",
  "status",
  "location", // Object: {id, name}
  "cost_code", // Object: {id, code, name}
  "assignees", // Array: {id, name} only, NO login/email
  "responsible_contractor", // Object: {id, name} only
  "initiated_at",
  "due_date",
  "created_at",
  "updated_at",
  "cost_impact", // Object: {status, value}
  "schedule_impact", // Object: {status, value}
  "project.id",
  "company.id",
] as const;

/**
 * Submittal field allowlist (CTO-approved 2026-10-07).
 * Keeps specification_section and scheduled_task.
 * Drops location and cost_code.
 */
export const SUBMITTAL_ALLOWLIST = [
  "id",
  "number",
  "title",
  "revision",
  "status",
  "specification_section",
  // location DROPPED per CTO 2026-10-07
  // cost_code DROPPED per CTO 2026-10-07
  "created_at",
  "updated_at",
  "received_date",
  "due_date",
  "required_on_site_date",
  "lead_time",
  "design_team_review_time",
  "internal_review_time",
  "buffer_time",
  "approvers", // Array: {id, name, revision, response, responded_at}, NO emails
  "scheduled_task", // Object: {id, name}
  "project.id",
  "company.id",
] as const;

/**
 * Build allowlisted RFI payload from allowlisted subfields only.
 * Every nested object is explicitly constructed.
 */
function buildAllowlistedRFIPayload(rfi: ProcoreRFI): Record<string, unknown> {
  // Build nested objects explicitly from allowlisted subfields
  const location = rfi.location
    ? {
        id: rfi.location.id,
        name: rfi.location.name,
      }
    : null;

  const cost_code = rfi.cost_code
    ? {
        id: rfi.cost_code.id,
        code: rfi.cost_code.code,
        name: rfi.cost_code.name,
      }
    : null;

  const cost_impact = rfi.cost_impact
    ? {
        status: rfi.cost_impact.status,
        value: rfi.cost_impact.value,
      }
    : null;

  const schedule_impact = rfi.schedule_impact
    ? {
        status: rfi.schedule_impact.status,
        value: rfi.schedule_impact.value,
      }
    : null;

  const responsible_contractor = rfi.responsible_contractor
    ? {
        id: rfi.responsible_contractor.id,
        name: rfi.responsible_contractor.name,
      }
    : null;

  const assignees = rfi.assignees.map((a) => ({
    id: a.id,
    name: a.name,
    // NO login/email per CTO
  }));

  return {
    id: rfi.id,
    number: rfi.number,
    subject: rfi.subject,
    question: rfi.question,
    official_response: rfi.official_response,
    status: rfi.status,
    location,
    cost_code,
    assignees,
    responsible_contractor,
    initiated_at: rfi.initiated_at,
    due_date: rfi.due_date,
    created_at: rfi.created_at,
    updated_at: rfi.updated_at,
    cost_impact,
    schedule_impact,
    project_id: rfi.project.id,
    company_id: rfi.company.id,
  };
}

/**
 * Build allowlisted Submittal payload from allowlisted subfields only.
 * Every nested object is explicitly constructed.
 */
function buildAllowlistedSubmittalPayload(
  submittal: ProcoreSubmittal
): Record<string, unknown> {
  // location DROPPED per CTO 2026-10-07
  // cost_code DROPPED per CTO 2026-10-07

  const scheduled_task = submittal.scheduled_task
    ? {
        id: submittal.scheduled_task.id,
        name: submittal.scheduled_task.name,
      }
    : null;

  const approvers = submittal.approvers.map((a) => ({
    id: a.id,
    name: a.name,
    // NO email per CTO
    revision: a.revision,
    response: a.response,
    responded_at: a.responded_at,
  }));

  return {
    id: submittal.id,
    number: submittal.number,
    title: submittal.title,
    revision: submittal.revision,
    status: submittal.status,
    specification_section: submittal.specification_section,
    created_at: submittal.created_at,
    updated_at: submittal.updated_at,
    received_date: submittal.received_date,
    due_date: submittal.due_date,
    required_on_site_date: submittal.required_on_site_date,
    lead_time: submittal.lead_time,
    design_team_review_time: submittal.design_team_review_time,
    internal_review_time: submittal.internal_review_time,
    buffer_time: submittal.buffer_time,
    approvers,
    scheduled_task,
    project_id: submittal.project.id,
    company_id: submittal.company.id,
  };
}

/**
 * Generate stable fingerprint (SHA-256 hash) of allowlisted payload.
 * Uses recursive canonical stringify with sorted keys at every depth.
 * Fingerprint computed on the EXACT payload that gets exported.
 */
export function generateFingerprint(allowlistedPayload: Record<string, unknown>): string {
  const canonical = canonicalStringify(allowlistedPayload);
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Map raw Procore RFI to normalized SiteTech RFI.
 */
export function mapProcoreRFIToNormalized(rfi: ProcoreRFI): NormalizedRFI {
  const allowlistedPayload = buildAllowlistedRFIPayload(rfi);
  const fingerprint = generateFingerprint(allowlistedPayload);

  return {
    entity_type: "rfi",
    external_id: String(rfi.id),
    fingerprint,
    
    source_project_id: String(rfi.project.id),
    source_company_id: String(rfi.company.id),
    
    number: rfi.number,
    subject: rfi.subject,
    question: rfi.question,
    official_response: rfi.official_response,
    
    status: rfi.status,
    source_status: rfi.status,
    
    location: rfi.location
      ? {
          id: String(rfi.location.id),
          name: rfi.location.name,
        }
      : null,
    cost_code: rfi.cost_code?.name ?? null,
    
    assignees: rfi.assignees.map((a) => ({
      id: String(a.id),
      name: a.name,
      // NO emails per CTO
    })),
    responsible_contractor: rfi.responsible_contractor
      ? {
          id: String(rfi.responsible_contractor.id),
          name: rfi.responsible_contractor.name,
        }
      : null,
    
    initiated_at: rfi.initiated_at,
    due_date: rfi.due_date,
    created_at: rfi.created_at,
    updated_at: rfi.updated_at,
    
    cost_impact: rfi.cost_impact
      ? {
          status: rfi.cost_impact.status,
          value: rfi.cost_impact.value,
        }
      : null,
    schedule_impact: rfi.schedule_impact
      ? {
          status: rfi.schedule_impact.status,
          value: rfi.schedule_impact.value,
        }
      : null,
  };
}

/**
 * Map raw Procore Submittal to normalized SiteTech Submittal.
 */
export function mapProcoreSubmittalToNormalized(
  submittal: ProcoreSubmittal
): NormalizedSubmittal {
  const allowlistedPayload = buildAllowlistedSubmittalPayload(submittal);
  const fingerprint = generateFingerprint(allowlistedPayload);

  return {
    entity_type: "submittal",
    external_id: String(submittal.id),
    fingerprint,
    
    source_project_id: String(submittal.project.id),
    source_company_id: String(submittal.company.id),
    
    number: submittal.number,
    title: submittal.title,
    specification_section: submittal.specification_section,
    
    status: submittal.status,
    source_status: submittal.status,
    current_revision: submittal.revision,
    
    // location DROPPED per CTO 2026-10-07
    location: null,
    // cost_code DROPPED per CTO 2026-10-07
    cost_code: null,
    
    approvers: submittal.approvers.map((a) => ({
      id: String(a.id),
      name: a.name,
      // NO emails per CTO
      revision: a.revision,
      response: a.response,
      responded_at: a.responded_at,
    })),
    
    created_at: submittal.created_at,
    updated_at: submittal.updated_at,
    received_date: submittal.received_date,
    due_date: submittal.due_date,
    required_on_site_date: submittal.required_on_site_date,
    
    lead_time: submittal.lead_time,
    design_team_review_time: submittal.design_team_review_time,
    internal_review_time: submittal.internal_review_time,
    buffer_time: submittal.buffer_time,
    
    scheduled_task: submittal.scheduled_task
      ? {
          id: String(submittal.scheduled_task.id),
          code: submittal.scheduled_task.code,
          name: submittal.scheduled_task.name,
        }
      : null,
  };
}

/**
 * Convert normalized RFI to raw record shape for storage layer.
 */
export function rfiToRawRecord(rfi: NormalizedRFI): RawRecord {
  return {
    entityType: "rfi",
    externalId: rfi.external_id,
    allowlistedPayload: {
      number: rfi.number,
      subject: rfi.subject,
      question: rfi.question,
      official_response: rfi.official_response,
      status: rfi.status,
      location: rfi.location,
      cost_code: rfi.cost_code,
      assignees: rfi.assignees,
      responsible_contractor: rfi.responsible_contractor,
      initiated_at: rfi.initiated_at,
      due_date: rfi.due_date,
      created_at: rfi.created_at,
      updated_at: rfi.updated_at,
      cost_impact: rfi.cost_impact,
      schedule_impact: rfi.schedule_impact,
    },
    fingerprint: rfi.fingerprint,
  };
}

/**
 * Convert normalized Submittal to raw record shape for storage layer.
 */
export function submittalToRawRecord(submittal: NormalizedSubmittal): RawRecord {
  return {
    entityType: "submittal",
    externalId: submittal.external_id,
    allowlistedPayload: {
      number: submittal.number,
      title: submittal.title,
      specification_section: submittal.specification_section,
      status: submittal.status,
      current_revision: submittal.current_revision,
      // location DROPPED per CTO 2026-10-07
      // cost_code DROPPED per CTO 2026-10-07
      approvers: submittal.approvers,
      created_at: submittal.created_at,
      updated_at: submittal.updated_at,
      received_date: submittal.received_date,
      due_date: submittal.due_date,
      required_on_site_date: submittal.required_on_site_date,
      lead_time: submittal.lead_time,
      design_team_review_time: submittal.design_team_review_time,
      internal_review_time: submittal.internal_review_time,
      buffer_time: submittal.buffer_time,
      scheduled_task: submittal.scheduled_task,
    },
    fingerprint: submittal.fingerprint,
  };
}
