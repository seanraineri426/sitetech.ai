/**
 * Procore API response types and Zod schemas (allowlist-aligned).
 */

import { z } from "zod";

// Zod schemas for validation (passthrough to allow new provider fields)
const ProcoreCostCodeSchema = z.object({
  id: z.number().nullable(),
  name: z.string().nullable(),
}).passthrough();

const ProcoreAssigneeSchema = z.object({
  id: z.number(),
  name: z.string(),
}).passthrough();

const ProcoreResponsibleContractorSchema = z.object({
  id: z.number(),
  name: z.string(),
}).passthrough();

const ProcoreImpactSchema = z.object({
  status: z.string(),
  value: z.number().nullable(),
}).passthrough();

const ProcoreApproverSchema = z.object({
  id: z.number(),
  name: z.string(),
  revision: z.string().nullable(),
  response: z.string(),
  responded_at: z.string().nullable(),
}).passthrough();

const ProcoreScheduledTaskSchema = z.object({
  id: z.number().nullable(),
  code: z.string().nullable(),
  name: z.string().nullable(),
}).passthrough();

const ProcoreProjectRefSchema = z.object({
  id: z.number(),
}).passthrough();

const ProcoreCompanyRefSchema = z.object({
  id: z.number(),
}).passthrough();

export const ProcoreRFISchema = z.object({
  id: z.number(),
  number: z.string(),
  subject: z.string(),
  question: z.string().nullable(),
  official_response: z.string().nullable(),
  status: z.string(),
  location: z.string().nullable(),
  cost_code: ProcoreCostCodeSchema.nullable(),
  assignees: z.array(ProcoreAssigneeSchema),
  responsible_contractor: ProcoreResponsibleContractorSchema.nullable(),
  initiated_at: z.string().nullable(),
  due_date: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  cost_impact: ProcoreImpactSchema.nullable(),
  schedule_impact: ProcoreImpactSchema.nullable(),
  project: ProcoreProjectRefSchema,
  company: ProcoreCompanyRefSchema,
}).passthrough();

export const ProcoreSubmittalSchema = z.object({
  id: z.number(),
  number: z.string(),
  title: z.string(),
  revision: z.string().nullable(),
  status: z.string(),
  specification_section: z.string().nullable(),
  location: z.string().nullable(),
  cost_code: ProcoreCostCodeSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  received_date: z.string().nullable(),
  due_date: z.string().nullable(),
  required_on_site_date: z.string().nullable(),
  lead_time: z.number().nullable(),
  design_team_review_time: z.number().nullable(),
  internal_review_time: z.number().nullable(),
  buffer_time: z.number().nullable(),
  approvers: z.array(ProcoreApproverSchema),
  scheduled_task: ProcoreScheduledTaskSchema.nullable(),
  project: ProcoreProjectRefSchema,
  company: ProcoreCompanyRefSchema,
}).passthrough();

export const ProcoreProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  project_number: z.string().nullable(),
  active: z.boolean(),
  company: ProcoreCompanyRefSchema,
}).passthrough();

export type ProcoreRFI = z.infer<typeof ProcoreRFISchema>;
export type ProcoreSubmittal = z.infer<typeof ProcoreSubmittalSchema>;
export type ProcoreProject = z.infer<typeof ProcoreProjectSchema>;
