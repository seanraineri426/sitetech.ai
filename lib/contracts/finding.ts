import { z } from 'zod';
import { MeasureSchema, CitationSchema } from './measure';

export const OwnerRoleSchema = z.enum(['PE', 'PM', 'PX']);

export type OwnerRole = z.infer<typeof OwnerRoleSchema>;

export const FindingMeasuresSchema = z.object({
  float_days: MeasureSchema(z.number()).optional(),
  dollar_impact: MeasureSchema(z.number()).optional(),
  days_overdue: MeasureSchema(z.number()).optional(),
  days_to_activity: MeasureSchema(z.number()).optional()
});

export type FindingMeasures = z.infer<typeof FindingMeasuresSchema>;

export const FindingSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  kind: z.string(),
  detected_at: z.string().datetime(),
  entity_type: z.string(),
  external_id: z.string(),
  measures: FindingMeasuresSchema,
  linked_records: z.array(CitationSchema),
  owner_role: OwnerRoleSchema,
  assigned_to: z.string().optional(),
  suppressed: z.boolean(),
  suppressed_reason: z.string().optional()
});

export type Finding = z.infer<typeof FindingSchema>;
