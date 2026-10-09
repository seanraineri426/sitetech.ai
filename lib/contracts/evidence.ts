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
  sender_auth: SenderAuthSchema.optional(),
  unverified_sender: z.boolean() // CTO rule: unverified emails can't create, change, or hide findings
}).refine(
  data => {
    // Email evidence requires sender_auth (verdict may be 'unknown')
    if (data.kind === 'email' && !data.sender_auth) {
      return false;
    }
    return true;
  },
  { message: 'Email evidence requires sender_auth' }
);

export type Evidence = z.infer<typeof EvidenceSchema>;
