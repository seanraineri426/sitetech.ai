import { z } from 'zod';

export const AgentTaskKindSchema = z.enum([
  'sync_procore',
  'sync_email',
  'import_xer',
  'detect_findings',
  'draft_actions',
  'compute_scenario'
]);

export type AgentTaskKind = z.infer<typeof AgentTaskKindSchema>;

export const AgentTaskStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled'
]);

export type AgentTaskStatus = z.infer<typeof AgentTaskStatusSchema>;

export const AgentTaskSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  task: AgentTaskKindSchema,
  linked_action_id: z.string().optional(),
  status: AgentTaskStatusSchema,
  current_checkpoint: z.string().optional(),
  allowed_registry_actions: z.array(z.string()),
  created_at: z.string().datetime(),
  started_at: z.string().datetime().optional(),
  finished_at: z.string().datetime().optional(),
  error_code: z.string().optional(),
  error_summary: z.string().optional()
});

export type AgentTask = z.infer<typeof AgentTaskSchema>;
