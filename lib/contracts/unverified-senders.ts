import { z } from 'zod';
import { MeasureSchema } from './measure';

export const SenderAuthSummarySchema = z.object({
  pass_count: z.number().int().min(0),
  fail_count: z.number().int().min(0),
  unknown_count: z.number().int().min(0)
});

export type SenderAuthSummary = z.infer<typeof SenderAuthSummarySchema>;

export const UnverifiedSenderRowSchema = z.object({
  sender_domain: z.string(),
  sender_display_name: z.string(),
  email_count: z.number().int().min(0),
  hypothetical_impact: MeasureSchema(z.number()),
  sample_subjects: z.array(z.string()).max(3),
  add_party_allowed: z.boolean(),
  sender_auth_summary: SenderAuthSummarySchema
});

export type UnverifiedSenderRow = z.infer<typeof UnverifiedSenderRowSchema>;

export const UnverifiedSendersSectionSchema = z.object({
  section_type: z.literal('unverified_senders'),
  label: z.literal('UNVERIFIED'),
  rows: z.array(UnverifiedSenderRowSchema),
  warning: z.string()
});

export type UnverifiedSendersSection = z.infer<typeof UnverifiedSendersSectionSchema>;
