import { z } from 'zod';
import { CitationSchema, ComputedBySchema } from './measure';

export const EvidenceKindSchema = z.enum([
  'email',
  'rfi',
  'submittal',
  'meeting',
  'schedule_activity',
  'change_event'
]);

export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const AuthVerdictSchema = z.enum(['pass', 'fail', 'unknown']);

export type AuthVerdict = z.infer<typeof AuthVerdictSchema>;

export const SenderAuthSchema = z.object({
  spf: AuthVerdictSchema,
  dkim: AuthVerdictSchema,
  dmarc: AuthVerdictSchema,
  compauth: AuthVerdictSchema,
  verdict: AuthVerdictSchema
});

export type SenderAuth = z.infer<typeof SenderAuthSchema>;

export const WhyPanelSchema = z.object({
  title: z.string(),
  explanation: z.string(),
  computed_by: ComputedBySchema
});

export type WhyPanel = z.infer<typeof WhyPanelSchema>;

export const EvidenceSchema = z.object({
  id: z.string(),
  kind: EvidenceKindSchema,
  source: CitationSchema,
  excerpt: z.string().optional(),
  why_panel: WhyPanelSchema,
  open_in_source_link: z.string().url().optional(),
  sender_auth: SenderAuthSchema.optional()
});

export type Evidence = z.infer<typeof EvidenceSchema>;
