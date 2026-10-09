import { z } from 'zod';

// Matches DB integration_provider enum
export const ProviderSchema = z.enum([
  'procore',
  'msgraph', // Sub-sources: mail, drive
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
  mode: SourceModeSchema, // OPEN: source unclear (integration_connections field or derived?)
  health: SourceHealthSchema, // Mapped from integration_connections.status: pending→never_synced, active→ok, error→degraded/auth_expired, disconnected→disconnected
  last_success_at: z.string().datetime().nullable(), // From sync_runs: latest run with status='succeeded'
  last_attempt_at: z.string().datetime().nullable(), // From sync_runs: latest run started_at regardless of status
  stale: z.boolean(), // Computed on server against per-provider threshold (OPEN: threshold values)
  error_code: z.string().nullable(), // Stable codes: AUTH_EXPIRED, RATE_LIMITED, OUT_OF_SCOPE
  records_skipped: z.number().int().min(0), // From sync_runs.counts['records_skipped'] for last run (OPEN: Integrations must emit this key)
  checkpoint_reset_at: z.string().datetime().nullable() // OPEN: source unclear
}).refine(
  data => {
    // health='ok' requires non-null last_success_at
    if (data.health === 'ok' && data.last_success_at === null) {
      return false;
    }
    return true;
  },
  { message: 'health="ok" requires non-null last_success_at' }
);

export type SourceFreshness = z.infer<typeof SourceFreshnessSchema>;

// OPEN: Do partial runs (status='partial') count as success for last_success_at?
