import { z } from 'zod';
import { ApprovalTierSchema } from './approval';

export const TierPermissionsSchema = z.object({
  can_view: z.boolean(),
  can_approve: z.boolean(),
  can_execute: z.boolean()
});

export type TierPermissions = z.infer<typeof TierPermissionsSchema>;

export const PermissionMatrixTiersSchema = z.object({
  PE: TierPermissionsSchema.optional(),
  PM: TierPermissionsSchema.optional(),
  PX: TierPermissionsSchema.optional(),
  CEO: TierPermissionsSchema.optional()
});

export type PermissionMatrixTiers = z.infer<typeof PermissionMatrixTiersSchema>;

export const PermissionMatrixSchema = z.object({
  action_id: z.string(),
  tiers: PermissionMatrixTiersSchema,
  escalation_path: z.array(ApprovalTierSchema)
});

export type PermissionMatrix = z.infer<typeof PermissionMatrixSchema>;
