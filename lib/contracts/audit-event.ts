import { z } from 'zod';

export const AuditEventTypeSchema = z.enum([
  'created',
  'approved',
  'edited',
  'dismissed',
  'sent',
  'outcome_confirmed'
]);

export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

export const VerifierResultSchema = z.enum(['pass', 'fail']);

export type VerifierResult = z.infer<typeof VerifierResultSchema>;

export const SentenceProvenanceSourceSchema = z.enum(['template', 'model']);

export type SentenceProvenanceSource = z.infer<typeof SentenceProvenanceSourceSchema>;

export const SentenceProvenanceSchema = z.object({
  sentence: z.string(),
  source: SentenceProvenanceSourceSchema
});

export type SentenceProvenance = z.infer<typeof SentenceProvenanceSchema>;

export const DetectionMethodSchema = z.enum(['user_confirmed', 'sent_item_match']);

export type DetectionMethod = z.infer<typeof DetectionMethodSchema>;

export const AuditEventMetadataSchema = z.object({
  model_call_id: z.string().optional(),
  model_version: z.string().optional(),
  verifier_result: VerifierResultSchema.optional(),
  verifier_failure_reason: z.string().optional(),
  sentence_provenance: z.array(SentenceProvenanceSchema).optional(),
  dismiss_reason: z.string().optional(),
  edit_summary: z.string().optional(),
  detection_method: DetectionMethodSchema.optional(),
  outcome_kind: z.string().optional(),
  outcome_on_time: z.boolean().optional(),
  float_saved: z.number().optional(),
  dollars_saved: z.number().optional()
});

export type AuditEventMetadata = z.infer<typeof AuditEventMetadataSchema>;

export const AuditEventSchema = z.object({
  id: z.string(),
  action_id: z.string(),
  event_type: AuditEventTypeSchema,
  user_id: z.string().optional(),
  user_name: z.string().optional(),
  timestamp: z.string().datetime(),
  metadata: AuditEventMetadataSchema
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
