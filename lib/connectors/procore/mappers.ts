/**
 * Procore field allowlists and mapping functions.
 * 
 * Field allowlists approved by CTO (2026-10-06):
 * - RFI: number, subject, question, official_response, status, location, cost_code,
 *   initiated_at, due_date, assignees, responsible_contractor, specification_section,
 *   drawing_number, ball_in_court, rfi_manager, received_from, cost_impact (raw),
 *   schedule_impact (raw), dates, IDs
 * - Submittal: number, title, revision, spec_section, status, location, cost_code,
 *   required_on_site_date, lead_time, design_team_review_time, internal_review_time,
 *   buffer_time, received_date, approvers (with revision history), responsible_contractor,
 *   ball_in_court, scheduled_task, dates, IDs
 * 
 * Attachments and file data NEVER kept.
 * Description field explicitly excluded from submittals.
 */

import { createHash } from "crypto";
import type { NormalizedRFI, NormalizedSubmittal } from "../types";
import type { ProcoreRFI, ProcoreSubmittal } from "./types";

/**
 * RFI field allowlist as specified by CTO.
 * Used for fingerprinting and to document what we store.
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
  "specification_section",
  "drawing_number",
  "ball_in_court",
  "assignees",
  "responsible_contractor",
  "rfi_manager",
  "received_from",
  "initiated_at",
  "due_date",
  "created_at",
  "updated_at",
  "cost_impact",
  "schedule_impact",
  "project.id",
  "company.id",
] as const;

/**
 * Submittal field allowlist as specified by CTO.
 * Description field is explicitly excluded.
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
  "responsible_contractor",
  "ball_in_court",
  "created_at",
  "updated_at",
  "received_date",
  "due_date",
  "required_on_site_date",
  "lead_time",
  "design_team_review_time",
  "internal_review_time",
  "buffer_time",
  "approvers",
  "scheduled_task",
  "project.id",
  "company.id",
] as const;

/**
 * Extract allowlisted fields from raw Procore RFI.
 * Used for fingerprint generation.
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
    specification_section: rfi.specification_section,
    drawing_number: rfi.drawing_number,
    ball_in_court: rfi.ball_in_court,
    assignees: rfi.assignees.map((a) => ({
      id: a.id,
      name: a.name,
      email_address: a.email_address,
      company: a.company,
    })),
    responsible_contractor: rfi.responsible_contractor,
    rfi_manager: rfi.rfi_manager,
    received_from: rfi.received_from,
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
    responsible_contractor: submittal.responsible_contractor,
    ball_in_court: submittal.ball_in_court,
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
      email_address: a.email_address,
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
 * Used for change detection.
 */
export function generateFingerprint(allowlistedFields: Record<string, unknown>): string {
  const canonical = JSON.stringify(allowlistedFields, Object.keys(allowlistedFields).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Map raw Procore RFI to normalized SiteTech RFI.
 * 
 * Rules per CTO:
 * - Keep raw cost_impact and schedule_impact structure (don't collapse to boolean)
 * - Keep raw source_status as-is
 * - Don't compute is_overdue or days_overdue (rules layer owns these)
 * - Only map "answered" from real Procore status, not from presence of answer
 */
export function mapProcoreRFIToNormalized(
  rfi: ProcoreRFI,
  endpoint: string
): NormalizedRFI {
  const allowlistedFields = extractAllowlistedRFIFields(rfi);
  const fingerprint = generateFingerprint(allowlistedFields);

  return {
    fingerprint,
    source_id: String(rfi.id),
    number: rfi.number,
    project_id: String(rfi.project.id),
    company_id: String(rfi.company.id),
    
    subject: rfi.subject,
    question: rfi.question,
    official_response: rfi.official_response,
    
    source_status: rfi.status,
    location: rfi.location,
    cost_code: rfi.cost_code?.name ?? null,
    specification_section: rfi.specification_section,
    drawing_number: rfi.drawing_number,
    
    ball_in_court: rfi.ball_in_court,
    assignees: rfi.assignees.map((a) => ({
      id: String(a.id),
      name: a.name,
      email: a.email_address,
      company: a.company?.name ?? null,
    })),
    responsible_contractor: rfi.responsible_contractor?.name ?? null,
    rfi_manager: rfi.rfi_manager
      ? {
          id: String(rfi.rfi_manager.id),
          name: rfi.rfi_manager.name,
          email: rfi.rfi_manager.email_address,
        }
      : null,
    received_from: rfi.received_from
      ? {
          id: String(rfi.received_from.id),
          name: rfi.received_from.name,
          email: rfi.received_from.email_address,
          company: rfi.received_from.company?.name ?? null,
        }
      : null,
    
    initiated_at: rfi.initiated_at,
    due_date: rfi.due_date,
    created_at: rfi.created_at,
    updated_at: rfi.updated_at,
    
    // Preserve raw impact structure per CTO instructions
    cost_impact: rfi.cost_impact,
    schedule_impact: rfi.schedule_impact,
    
    source_system: "procore",
    source_endpoint: endpoint,
    synced_at: new Date().toISOString(),
  };
}

/**
 * Map raw Procore Submittal to normalized SiteTech Submittal.
 * 
 * Rules per CTO:
 * - Keep approvers array with full revision history
 * - Keep revise_resubmit as an approver response (don't collapse)
 * - Don't store description field
 */
export function mapProcoreSubmittalToNormalized(
  submittal: ProcoreSubmittal,
  endpoint: string
): NormalizedSubmittal {
  const allowlistedFields = extractAllowlistedSubmittalFields(submittal);
  const fingerprint = generateFingerprint(allowlistedFields);

  return {
    fingerprint,
    source_id: String(submittal.id),
    number: submittal.number,
    project_id: String(submittal.project.id),
    company_id: String(submittal.company.id),
    
    title: submittal.title,
    specification_section: submittal.specification_section,
    location: submittal.location,
    cost_code: submittal.cost_code?.name ?? null,
    
    source_status: submittal.status,
    current_revision: submittal.revision,
    
    // Keep full approver revision history per CTO
    approvers: submittal.approvers.map((a) => ({
      id: String(a.id),
      name: a.name,
      email: a.email_address,
      revision: a.revision,
      response: a.response, // Can include "revise_resubmit"
      responded_at: a.responded_at,
    })),
    
    responsible_contractor: submittal.responsible_contractor?.name ?? null,
    ball_in_court: submittal.ball_in_court,
    
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
    
    source_system: "procore",
    source_endpoint: endpoint,
    synced_at: new Date().toISOString(),
  };
}
