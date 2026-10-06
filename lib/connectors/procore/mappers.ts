/**
 * Procore field allowlists and mapping functions.
 * 
 * Final CTO-approved allowlists (2026-10-06 review):
 * 
 * RFI: number, subject, question, official_response, status/source_status,
 *      raw cost_impact and schedule_impact {status, value}, dates (initiated_at,
 *      due, created, updated), location, cost_code, assignees (IDs and names only),
 *      responsible_contractor (ID and name)
 * 
 * Submittal: number, title, spec section, status, dates, required_on_site_date,
 *            lead_time, design_team/internal review and buffer times, received_date,
 *            current_revision, approvers per revision with response and responded_at
 *            (IDs and names only), location, cost_code, scheduled_task
 * 
 * DROPPED (pending CTO approval): drawing_number, rfi_manager, received_from,
 *          ball_in_court, RFI spec section, submittal responsible_contractor and
 *          ball_in_court, ALL email addresses (PII)
 * 
 * Attachments and file data NEVER kept.
 */

import { createHash } from "crypto";
import { canonicalStringify } from "../shared/canonical-stringify";
import type { NormalizedRFI, NormalizedSubmittal, RawRecord } from "../types";
import type { ProcoreRFI, ProcoreSubmittal } from "./types";

/**
 * RFI field allowlist (final CTO-approved).
 */
export const RFI_ALLOWLIST = [
  "id",
  "number",
  "subject",
  "question",
  "official_response",
  "status",
  "location",
  "cost_code",
  "assignees", // IDs and names only
  "responsible_contractor", // ID and name only
  "initiated_at",
  "due_date",
  "created_at",
  "updated_at",
  "cost_impact", // raw {status, value}
  "schedule_impact", // raw {status, value}
  "project.id",
  "company.id",
] as const;

/**
 * Submittal field allowlist (final CTO-approved).
 */
export const SUBMITTAL_ALLOWLIST = [
  "id",
  "number",
  "title",
  "revision",
  "status",
  "specification_section",
  "location",
  "cost_code",
  "created_at",
  "updated_at",
  "received_date",
  "due_date",
  "required_on_site_date",
  "lead_time",
  "design_team_review_time",
  "internal_review_time",
  "buffer_time",
  "approvers", // IDs and names only, no emails
  "scheduled_task",
  "project.id",
  "company.id",
] as const;

/**
 * Extract allowlisted fields from raw Procore RFI.
 */
function extractAllowlistedRFIFields(rfi: ProcoreRFI): Record<string, unknown> {
  return {
    id: rfi.id,
    number: rfi.number,
    subject: rfi.subject,
    question: rfi.question,
    official_response: rfi.official_response,
    status: rfi.status,
    location: rfi.location,
    cost_code: rfi.cost_code,
    assignees: rfi.assignees.map((a) => ({
      id: a.id,
      name: a.name,
      // NO emails
    })),
    responsible_contractor: rfi.responsible_contractor,
    initiated_at: rfi.initiated_at,
    due_date: rfi.due_date,
    created_at: rfi.created_at,
    updated_at: rfi.updated_at,
    cost_impact: rfi.cost_impact,
    schedule_impact: rfi.schedule_impact,
    project_id: rfi.project.id,
    company_id: rfi.company.id,
  };
}

/**
 * Extract allowlisted fields from raw Procore Submittal.
 */
function extractAllowlistedSubmittalFields(
  submittal: ProcoreSubmittal
): Record<string, unknown> {
  return {
    id: submittal.id,
    number: submittal.number,
    title: submittal.title,
    revision: submittal.revision,
    status: submittal.status,
    specification_section: submittal.specification_section,
    location: submittal.location,
    cost_code: submittal.cost_code,
    created_at: submittal.created_at,
    updated_at: submittal.updated_at,
    received_date: submittal.received_date,
    due_date: submittal.due_date,
    required_on_site_date: submittal.required_on_site_date,
    lead_time: submittal.lead_time,
    design_team_review_time: submittal.design_team_review_time,
    internal_review_time: submittal.internal_review_time,
    buffer_time: submittal.buffer_time,
    approvers: submittal.approvers.map((a) => ({
      id: a.id,
      name: a.name,
      // NO emails
      revision: a.revision,
      response: a.response,
      responded_at: a.responded_at,
    })),
    scheduled_task: submittal.scheduled_task,
    project_id: submittal.project.id,
    company_id: submittal.company.id,
  };
}

/**
 * Generate stable fingerprint (SHA-256 hash) of allowlisted fields.
 * Uses recursive canonical stringify with sorted keys at every depth.
 */
export function generateFingerprint(allowlistedFields: Record<string, unknown>): string {
  const canonical = canonicalStringify(allowlistedFields);
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Map raw Procore RFI to normalized SiteTech RFI.
 */
export function mapProcoreRFIToNormalized(rfi: ProcoreRFI): NormalizedRFI {
  const allowlistedFields = extractAllowlistedRFIFields(rfi);
  const fingerprint = generateFingerprint(allowlistedFields);

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
    
    location: rfi.location,
    cost_code: rfi.cost_code?.name ?? null,
    
    assignees: rfi.assignees.map((a) => ({
      id: String(a.id),
      name: a.name,
      // NO emails per CTO trim
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
    
    cost_impact: rfi.cost_impact,
    schedule_impact: rfi.schedule_impact,
  };
}

/**
 * Map raw Procore Submittal to normalized SiteTech Submittal.
 */
export function mapProcoreSubmittalToNormalized(
  submittal: ProcoreSubmittal
): NormalizedSubmittal {
  const allowlistedFields = extractAllowlistedSubmittalFields(submittal);
  const fingerprint = generateFingerprint(allowlistedFields);

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
    
    location: submittal.location,
    cost_code: submittal.cost_code?.name ?? null,
    
    approvers: submittal.approvers.map((a) => ({
      id: String(a.id),
      name: a.name,
      // NO emails per CTO trim
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
      location: submittal.location,
      cost_code: submittal.cost_code,
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
