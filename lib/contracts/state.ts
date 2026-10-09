import { z } from 'zod';
import { SourceFreshnessSchema } from './source-freshness';

export const UserRoleSchema = z.enum(['PE', 'PM', 'PX', 'CEO', 'viewer']);

export type UserRole = z.infer<typeof UserRoleSchema>;

export function LoadingStateSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    kind: z.literal('loading'),
    data: dataSchema.optional()
  });
}

export type LoadingState<T> = {
  kind: 'loading';
  data?: T;
};

export const EmptyStateSchema = z.object({
  kind: z.literal('empty'),
  message: z.string()
});

export type EmptyState = z.infer<typeof EmptyStateSchema>;

export function StaleStateSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    kind: z.literal('stale'),
    data: dataSchema,
    stale_since: z.string().datetime(),
    stale_threshold_hours: z.number().positive(),
    freshness: z.array(SourceFreshnessSchema)
  });
}

export type StaleState<T> = {
  kind: 'stale';
  data: T;
  stale_since: string;
  stale_threshold_hours: number;
  freshness: import('./source-freshness').SourceFreshness[];
};

export const PermissionDeniedStateSchema = z.object({
  kind: z.literal('permission_denied'),
  required_role: z.enum(['PE', 'PM', 'PX', 'CEO']),
  user_role: UserRoleSchema
});

export type PermissionDeniedState = z.infer<typeof PermissionDeniedStateSchema>;

export const ErrorStateSchema = z.object({
  kind: z.literal('error'),
  error_code: z.string(),
  error_message: z.string(),
  retry_allowed: z.boolean()
});

export type ErrorState = z.infer<typeof ErrorStateSchema>;

export function SuccessStateSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    kind: z.literal('success'),
    data: dataSchema
  });
}

export type SuccessState<T> = {
  kind: 'success';
  data: T;
};

export function DataStateSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion('kind', [
    SuccessStateSchema(dataSchema),
    LoadingStateSchema(dataSchema),
    EmptyStateSchema,
    StaleStateSchema(dataSchema),
    PermissionDeniedStateSchema,
    ErrorStateSchema
  ]);
}

export type DataState<T> =
  | SuccessState<T>
  | LoadingState<T>
  | EmptyState
  | StaleState<T>
  | PermissionDeniedState
  | ErrorState;
