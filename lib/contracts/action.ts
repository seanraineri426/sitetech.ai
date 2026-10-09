import { z } from 'zod';
import { OwnerRoleSchema } from './finding';
import { MeasureSchema } from './measure';
import { ApprovalSchema } from './approval';

export const ActionStageSchema = z.enum([
  'detect',
  'investigate',
  'simulate',
  'approve',
  'execute',
  'verify'
]);

export type ActionStage = z.infer<typeof ActionStageSchema>;

export const EscalationLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2)
]);

export type EscalationLevel = z.infer<typeof EscalationLevelSchema>;

export const ActionMeasuresSchema = z.object({
  float_protected: MeasureSchema(z.number()).optional(),
  dollars_at_risk: MeasureSchema(z.number()).optional(),
  days_to_deadline: MeasureSchema(z.number()).optional()
});

export type ActionMeasures = z.infer<typeof ActionMeasuresSchema>;

export const DraftKindSchema = z.enum([
  'email',
  'change_event',
  'minutes',
  'notice_card'
]);

export type DraftKind = z.infer<typeof DraftKindSchema>;

export const DraftAttachmentSchema = z.object({
  name: z.string(),
  url: z.string().url()
});

export type DraftAttachment = z.infer<typeof DraftAttachmentSchema>;

export const DraftSchema = z.object({
  kind: DraftKindSchema,
  to: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  attachments: z.array(DraftAttachmentSchema).optional(),
  deep_link: z.string().url().optional(),
  read_only: z.boolean()
});

export type Draft = z.infer<typeof DraftSchema>;

export const ActionSchema = z.object({
  id: z.string(),
  action_id: z.string(),
  version: z.number().int().positive(),
  project_id: z.string(),
  finding_id: z.string(),
  owner_role: OwnerRoleSchema,
  assigned_to: z.string().optional(),
  stage: ActionStageSchema,
  due_at: z.string().datetime().nullable(),
  escalation_level: EscalationLevelSchema,
  requires_procore: z.boolean(),
  measures: ActionMeasuresSchema,
  draft: DraftSchema,
  approval: ApprovalSchema.nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type Action = z.infer<typeof ActionSchema>;
