import { z } from 'zod';

export const ApprovalTierSchema = z.enum(['PE', 'PM', 'PX', 'CEO']);

export type ApprovalTier = z.infer<typeof ApprovalTierSchema>;

export const ApprovalDecisionSchema = z.enum(['approved', 'edited', 'dismissed']);

export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

export const DismissReasonSchema = z.enum(['already_handled', 'not_relevant', 'wrong']);

export type DismissReason = z.infer<typeof DismissReasonSchema>;

export const ApprovalSchema = z.object({
  id: z.string(),
  action_id: z.string(),
  tier: ApprovalTierSchema,
  approver_id: z.string(),
  approver_name: z.string(),
  decision: ApprovalDecisionSchema,
  dismiss_reason: DismissReasonSchema.optional(),
  edit_summary: z.string().optional(),
  decided_at: z.string().datetime(),
  sent_at: z.string().datetime().optional(),
  audit_event_ids: z.array(z.string())
});

export type Approval = z.infer<typeof ApprovalSchema>;
