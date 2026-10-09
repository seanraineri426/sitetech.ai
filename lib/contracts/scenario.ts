import { z } from 'zod';

export const ScenarioConfidenceSchema = z.enum(['high', 'medium', 'low']);

export type ScenarioConfidence = z.infer<typeof ScenarioConfidenceSchema>;

export const AlternativeMatchSchema = z.object({
  activity_id: z.string(),
  activity_name: z.string(),
  match_reason: z.string()
});

export type AlternativeMatch = z.infer<typeof AlternativeMatchSchema>;

export const ScenarioSchema = z.object({
  activity_id: z.string(),
  activity_name: z.string(),
  slip_working_days: z.number().int(),
  confidence: ScenarioConfidenceSchema,
  match_reason: z.string(),
  alternative_matches: z.array(AlternativeMatchSchema).optional()
});

export type Scenario = z.infer<typeof ScenarioSchema>;

export const PrimaryActivityImpactSchema = z.object({
  activity_id: z.string(),
  activity_name: z.string(),
  original_early_finish: z.string().date(),
  new_early_finish: z.string().date(),
  slip_working_days: z.number(),
  float_consumed: z.number(),
  remaining_float: z.number(),
  on_critical_path: z.boolean()
});

export type PrimaryActivityImpact = z.infer<typeof PrimaryActivityImpactSchema>;

export const SuccessorImpactSchema = z.object({
  activity_id: z.string(),
  activity_name: z.string(),
  propagated_delay: z.number(),
  p6_total_float: z.number(),
  resulting_float: z.number(),
  on_critical_path: z.boolean()
});

export type SuccessorImpact = z.infer<typeof SuccessorImpactSchema>;

export const ProjectCompletionImpactSchema = z.object({
  original_date: z.string().date(),
  new_date: z.string().date(),
  slip_working_days: z.number().int(),
  slip_calendar_days: z.number().int()
});

export type ProjectCompletionImpact = z.infer<typeof ProjectCompletionImpactSchema>;

export const ImpactsSchema = z.object({
  primary_activity: PrimaryActivityImpactSchema,
  successors: z.array(SuccessorImpactSchema),
  project_completion: ProjectCompletionImpactSchema
});

export type Impacts = z.infer<typeof ImpactsSchema>;

export const DelayCostUnitSchema = z.enum(['calendar_day', 'working_day']);

export type DelayCostUnit = z.infer<typeof DelayCostUnitSchema>;

export const DelayCostSourceSchema = z.enum(['project_settings', 'not_configured']);

export type DelayCostSource = z.infer<typeof DelayCostSourceSchema>;

export const DollarsSchema = z.object({
  dollar_impact: z.number().nullable(),
  completion_slip_working_days: z.number().int(),
  completion_slip_calendar_days: z.number().int(),
  daily_delay_cost: z.number().nullable(),
  daily_delay_cost_unit: DelayCostUnitSchema,
  daily_delay_cost_source: DelayCostSourceSchema
});

export type Dollars = z.infer<typeof DollarsSchema>;

export const NoticeTypeSchema = z.enum([
  'delay_time_extension',
  'cost_change_claim',
  'differing_site_condition',
  'change_directive_dispute',
  'cure_default',
  'injury_property_damage',
  'other'
]);

export type NoticeType = z.infer<typeof NoticeTypeSchema>;

export const DayBasisSchema = z.enum(['calendar', 'business']);

export type DayBasis = z.infer<typeof DayBasisSchema>;

export const NoticeSchema = z.object({
  notice_type: NoticeTypeSchema,
  notice_info: z.string(),
  event_date: z.string().date(),
  notice_period_days: z.number().int().positive(),
  calendar_or_business: DayBasisSchema,
  notice_deadline: z.string().date().nullable(),
  deadline_source: z.string()
});

export type Notice = z.infer<typeof NoticeSchema>;

export const SuggestedActionSchema = z.object({
  action_id: z.string(),
  action_name: z.string(),
  target_activity_id: z.string().nullable(),
  reason: z.string()
});

export type SuggestedAction = z.infer<typeof SuggestedActionSchema>;

export const SourceDataSchema = z.object({
  schedule_snapshot: z.string(),
  schedule_data_date: z.string().date(),
  project_settings: z.string(),
  computed_at: z.string().datetime()
});

export type SourceData = z.infer<typeof SourceDataSchema>;

export const WhatIfResultSchema = z.object({
  scenario: ScenarioSchema,
  impacts: ImpactsSchema,
  dollars: DollarsSchema,
  notices: z.array(NoticeSchema),
  suggested_actions: z.array(SuggestedActionSchema),
  source_data: SourceDataSchema,
  estimate_label: z.literal('estimate, confirm in P6')
});

export type WhatIfResult = z.infer<typeof WhatIfResultSchema>;
