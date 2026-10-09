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

// Unified source names matching DB provider enum
export const CitationSourceSchema = z.enum([
  'procore',
  'msgraph', // Maps to msgraph_mail or msgraph_drive
  'p6_upload',
  'granola',
  'project_settings',
  'manual'
]);

export type CitationSource = z.infer<typeof CitationSourceSchema>;

// Stored citation shape (in findings.citations JSONB)
export const StoredCitationSchema = z.object({
  source: CitationSourceSchema,
  entity_type: z.string(),
  external_id: z.string(),
  label: z.string().optional()
}).strict();

export type StoredCitation = z.infer<typeof StoredCitationSchema>;

// UI citation extends stored with connection metadata
export const CitationSchema = StoredCitationSchema.extend({
  connection_id: z.string().uuid().nullable().optional(), // UI-added for stale detection
  data_date: z.string().date().optional(), // UI-added, ISO date
  quote: z.string().optional() // UI-added
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
  }).refine(
    data => {
      // Verified values cannot come from 'model' kind
      if (data.provenance === 'verified' && data.computed_by.kind === 'model') {
        return false;
      }
      return true;
    },
    { message: 'Verified values cannot have computed_by.kind = "model"' }
  ).refine(
    data => {
      // Verified values cannot have confidence
      if (data.provenance === 'verified' && data.confidence !== undefined) {
        return false;
      }
      return true;
    },
    { message: 'Verified values cannot have confidence score' }
  ).refine(
    data => {
      // Null value requires confirm_required
      if (data.value === null && !data.confirm_required) {
        return false;
      }
      return true;
    },
    { message: 'Null value requires confirm_required' }
  ).refine(
    data => {
      // Verified dollar values require citations
      if (data.provenance === 'verified' && data.unit === 'usd' && data.value !== null && data.citations.length === 0) {
        return false;
      }
      return true;
    },
    { message: 'Verified dollar values require citations' }
  ).refine(
    data => {
      // ai_suggested cannot be used for dollar values (code computes $)
      if (data.provenance === 'ai_suggested' && data.unit === 'usd') {
        return false;
      }
      return true;
    },
    { message: 'AI-suggested dollar values not allowed (code computes $)' }
  );
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
