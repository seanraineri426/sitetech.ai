import { z } from 'zod';

export const ProviderSchema = z.enum([
  'procore',
  'msgraph_mail',
  'msgraph_drive',
  'p6_upload',
  'granola'
]);

export type Provider = z.infer<typeof ProviderSchema>;

export const SourceModeSchema = z.enum(['stored', 'in_memory']);

export type SourceMode = z.infer<typeof SourceModeSchema>;

export const SourceHealthSchema = z.enum([
  'ok',
  'degraded',
  'auth_expired',
  'disconnected',
  'never_synced'
]);

export type SourceHealth = z.infer<typeof SourceHealthSchema>;

export const SourceFreshnessSchema = z.object({
  connection_id: z.string().uuid(),
  provider: ProviderSchema,
  mode: SourceModeSchema,
  health: SourceHealthSchema,
  last_success_at: z.string().datetime().nullable(),
  last_attempt_at: z.string().datetime().nullable(),
  stale: z.boolean(),
  error_code: z.string().nullable(),
  records_skipped: z.number().int().min(0),
  checkpoint_reset_at: z.string().datetime().nullable()
});

export type SourceFreshness = z.infer<typeof SourceFreshnessSchema>;
