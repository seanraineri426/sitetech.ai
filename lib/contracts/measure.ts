import { z } from 'zod';

export const MeasureUnitSchema = z.enum([
  'usd',
  'working_days',
  'calendar_days',
  'date',
  'count',
  'percent',
  'hours'
]);

export type MeasureUnit = z.infer<typeof MeasureUnitSchema>;

export const MeasureProvenanceSchema = z.enum(['verified', 'ai_suggested', 'approved']);

export type MeasureProvenance = z.infer<typeof MeasureProvenanceSchema>;

export const ComputedByKindSchema = z.enum(['rule', 'calc', 'model', 'human']);

export type ComputedByKind = z.infer<typeof ComputedByKindSchema>;

export const ComputedBySchema = z.object({
  kind: ComputedByKindSchema,
  id: z.string(),
  version: z.string()
});

export type ComputedBy = z.infer<typeof ComputedBySchema>;

export const CitationSourceSchema = z.enum([
  'procore',
  'msgraph_mail',
  'p6_xer',
  'granola',
  'project_settings',
  'manual'
]);

export type CitationSource = z.infer<typeof CitationSourceSchema>;

export const CitationSchema = z.object({
  connection_id: z.string().uuid().nullable(),
  source: CitationSourceSchema,
  entity_type: z.string(),
  external_id: z.string(),
  label: z.string().optional(),
  quote: z.string().optional(),
  data_date: z.string().optional()
});

export type Citation = z.infer<typeof CitationSchema>;

export function MeasureSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema.nullable(),
    unit: MeasureUnitSchema,
    provenance: MeasureProvenanceSchema,
    computed_by: ComputedBySchema,
    citations: z.array(CitationSchema),
    as_of: z.string().datetime(),
    confidence: z.number().min(0).max(1).optional(),
    confirm_required: z.string().optional()
  });
}

export type Measure<T> = {
  value: T | null;
  unit: MeasureUnit;
  provenance: MeasureProvenance;
  computed_by: ComputedBy;
  citations: Citation[];
  as_of: string;
  confidence?: number;
  confirm_required?: string;
};
