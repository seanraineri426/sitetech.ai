import { describe, it, expect } from 'vitest';
import {
  MeasureSchema,
  CitationSchema,
  SourceFreshnessSchema,
  FindingSchema,
  ActionSchema,
  ApprovalSchema,
  WhatIfResultSchema,
  EvidenceSchema,
  AgentTaskSchema,
  AuditEventSchema,
  PermissionMatrixSchema,
  EmptyStateSchema,
  StaleStateSchema,
  PermissionDeniedStateSchema,
  ErrorStateSchema,
  UnverifiedSendersSectionSchema,
  type Measure,
  type Citation,
  type SourceFreshness,
  type Finding,
  type Action,
  type Approval,
  type WhatIfResult,
  type Evidence,
  type AgentTask,
  type AuditEvent,
  type PermissionMatrix,
  type EmptyState,
  type StaleState,
  type PermissionDeniedState,
  type ErrorState,
  type UnverifiedSendersSection
} from '../index';
import { z } from 'zod';

describe('UI Data Contracts - Fixtures', () => {
  describe('Measure<T>', () => {
    it('parses verified dollar measure with citations', () => {
      const dollarMeasureFixture: Measure<number> = {
        value: 48000,
        unit: 'usd',
        provenance: 'verified',
        computed_by: {
          kind: 'calc',
          id: 'completion_slip_impact',
          version: '1.0.0'
        },
        citations: [
          {
            connection_id: '550e8400-e29b-41d4-a716-446655440000',
            source: 'project_settings',
            entity_type: 'delay_cost',
            external_id: 'proj_12345',
            label: 'Daily delay cost',
            data_date: '2026-10-08'
          },
          {
            connection_id: '550e8400-e29b-41d4-a716-446655440000',
            source: 'p6_xer',
            entity_type: 'schedule_activity',
            external_id: 'LINDEN:A3000',
            label: 'Exterior envelope closeout',
            quote: 'Critical path activity, 0 days float',
            data_date: '2026-10-08'
          }
        ],
        as_of: '2026-10-09T18:27:42Z'
      };

      const result = MeasureSchema(z.number()).parse(dollarMeasureFixture);
      expect(result.value).toBe(48000);
      expect(result.unit).toBe('usd');
      expect(result.provenance).toBe('verified');
    });

    it('parses ai_suggested measure with confidence and confirm_required', () => {
      const aiMeasureFixture: Measure<number> = {
        value: null,
        unit: 'working_days',
        provenance: 'ai_suggested',
        computed_by: {
          kind: 'model',
          id: 'lead_time_estimator',
          version: '1.0.0'
        },
        citations: [],
        as_of: '2026-10-09T18:27:42Z',
        confidence: 0.65,
        confirm_required: 'Confirm lead time'
      };

      const result = MeasureSchema(z.number()).parse(aiMeasureFixture);
      expect(result.value).toBeNull();
      expect(result.confidence).toBe(0.65);
      expect(result.confirm_required).toBe('Confirm lead time');
    });
  });

  describe('Citation', () => {
    it('parses citation with connection_id and quote', () => {
      const citationFixture: Citation = {
        connection_id: '550e8400-e29b-41d4-a716-446655440000',
        source: 'procore',
        entity_type: 'rfi',
        external_id: '112',
        label: 'RFI 112: Shaft wall fire rating',
        quote: 'What is the required fire rating for the shaft wall at grid line B?',
        data_date: '2026-10-08'
      };

      const result = CitationSchema.parse(citationFixture);
      expect(result.connection_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.source).toBe('procore');
    });

    it('parses citation without connection_id (manual source)', () => {
      const manualCitationFixture: Citation = {
        connection_id: null,
        source: 'manual',
        entity_type: 'note',
        external_id: 'manual_001',
        label: 'Manual entry by PM'
      };

      const result = CitationSchema.parse(manualCitationFixture);
      expect(result.connection_id).toBeNull();
      expect(result.source).toBe('manual');
    });
  });

  describe('SourceFreshness', () => {
    it('parses healthy source freshness', () => {
      const sourceFreshnessFixture: SourceFreshness = {
        connection_id: '550e8400-e29b-41d4-a716-446655440000',
        provider: 'procore',
        mode: 'stored',
        health: 'ok',
        last_success_at: '2026-10-09T05:12:00Z',
        last_attempt_at: '2026-10-09T05:12:00Z',
        stale: false,
        error_code: null,
        records_skipped: 0,
        checkpoint_reset_at: null
      };

      const result = SourceFreshnessSchema.parse(sourceFreshnessFixture);
      expect(result.health).toBe('ok');
      expect(result.stale).toBe(false);
    });

    it('parses degraded source freshness with error', () => {
      const degradedFreshnessFixture: SourceFreshness = {
        connection_id: '550e8400-e29b-41d4-a716-446655440001',
        provider: 'msgraph_mail',
        mode: 'stored',
        health: 'degraded',
        last_success_at: '2026-10-08T18:00:00Z',
        last_attempt_at: '2026-10-09T05:12:00Z',
        stale: true,
        error_code: 'RATE_LIMITED',
        records_skipped: 3,
        checkpoint_reset_at: null
      };

      const result = SourceFreshnessSchema.parse(degradedFreshnessFixture);
      expect(result.health).toBe('degraded');
      expect(result.stale).toBe(true);
      expect(result.error_code).toBe('RATE_LIMITED');
    });
  });

  describe('Finding', () => {
    it('parses RFI overdue finding (Project Action Workspace)', () => {
      const findingFixture: Finding = {
        id: 'find_abc123',
        project_id: 'proj_12345',
        kind: 'rfi_overdue',
        detected_at: '2026-10-09T05:12:00Z',
        entity_type: 'rfi',
        external_id: '112',
        measures: {
          float_days: {
            value: 3,
            unit: 'working_days',
            provenance: 'verified',
            computed_by: { kind: 'calc', id: 'p6_float', version: '1.0.0' },
            citations: [
              {
                connection_id: '550e8400-e29b-41d4-a716-446655440000',
                source: 'p6_xer',
                entity_type: 'schedule_activity',
                external_id: 'LINDEN:A2310',
                label: 'L3 shaft framing',
                data_date: '2026-10-08'
              }
            ],
            as_of: '2026-10-09T05:12:00Z'
          },
          dollar_impact: {
            value: 36000,
            unit: 'usd',
            provenance: 'verified',
            computed_by: { kind: 'calc', id: 'critical_path_cost', version: '1.0.0' },
            citations: [],
            as_of: '2026-10-09T05:12:00Z'
          },
          days_overdue: {
            value: 6,
            unit: 'calendar_days',
            provenance: 'verified',
            computed_by: { kind: 'calc', id: 'date_diff', version: '1.0.0' },
            citations: [],
            as_of: '2026-10-09T05:12:00Z'
          }
        },
        linked_records: [
          {
            connection_id: '550e8400-e29b-41d4-a716-446655440000',
            source: 'procore',
            entity_type: 'rfi',
            external_id: '112',
            label: 'RFI 112: Shaft wall fire rating'
          }
        ],
        owner_role: 'PE',
        assigned_to: 'Sarah Chen',
        suppressed: false
      };

      const result = FindingSchema.parse(findingFixture);
      expect(result.kind).toBe('rfi_overdue');
      expect(result.owner_role).toBe('PE');
      expect(result.measures.dollar_impact?.value).toBe(36000);
    });
  });

  describe('Action (Project Action Workspace - Priority 1)', () => {
    it('parses A1 RFI overdue escalation action', () => {
      const actionFixture: Action = {
        id: 'action_xyz789',
        action_id: 'rfi-overdue-escalation',
        version: 1,
        project_id: 'proj_12345',
        finding_id: 'find_abc123',
        owner_role: 'PE',
        assigned_to: 'Sarah Chen',
        stage: 'approve',
        due_at: '2026-10-13T17:00:00Z',
        escalation_level: 0,
        requires_procore: true,
        measures: {
          float_protected: {
            value: 3,
            unit: 'working_days',
            provenance: 'verified',
            computed_by: { kind: 'calc', id: 'p6_float', version: '1.0.0' },
            citations: [],
            as_of: '2026-10-09T05:12:00Z'
          },
          dollars_at_risk: {
            value: 36000,
            unit: 'usd',
            provenance: 'verified',
            computed_by: { kind: 'calc', id: 'critical_path_cost', version: '1.0.0' },
            citations: [],
            as_of: '2026-10-09T05:12:00Z'
          },
          days_to_deadline: {
            value: 4,
            unit: 'working_days',
            provenance: 'verified',
            computed_by: { kind: 'calc', id: 'date_diff', version: '1.0.0' },
            citations: [],
            as_of: '2026-10-09T05:12:00Z'
          }
        },
        draft: {
          kind: 'email',
          to: 'Architect (via Outlook)',
          subject: 'RFI 112 overdue – L3 shaft framing starts Tue Oct 13',
          body: 'RFI 112 is now 6 days past due and controls L3 shaft framing starting Tue 10/13. We need the response by Fri 10/9 COB to hold the start. Float at risk: 3 days. $ at risk: $36,000 (3 days × $12,000/day).\n\nCan you provide the shaft wall fire rating answer by Friday 10/9?',
          read_only: true
        },
        approval: null,
        created_at: '2026-10-09T05:12:00Z',
        updated_at: '2026-10-09T05:12:00Z'
      };

      const result = ActionSchema.parse(actionFixture);
      expect(result.action_id).toBe('rfi-overdue-escalation');
      expect(result.draft.kind).toBe('email');
      expect(result.draft.read_only).toBe(true);
      expect(result.requires_procore).toBe(true);
    });

    it('parses A4 change event draft action with approval', () => {
      const approvalFixture: Approval = {
        id: 'appr_def456',
        action_id: 'action_ce_001',
        tier: 'PM',
        approver_id: 'user_mike',
        approver_name: 'Mike Johnson',
        decision: 'approved',
        decided_at: '2026-10-09T08:15:00Z',
        sent_at: '2026-10-09T08:16:00Z',
        audit_event_ids: ['audit_001', 'audit_002']
      };

      const actionFixture: Action = {
        id: 'action_ce_001',
        action_id: 'change-event-draft',
        version: 1,
        project_id: 'proj_12345',
        finding_id: 'find_ce_001',
        owner_role: 'PM',
        assigned_to: 'Mike Johnson',
        stage: 'execute',
        due_at: '2026-10-14T17:00:00Z',
        escalation_level: 0,
        requires_procore: false,
        measures: {
          dollars_at_risk: {
            value: 125000,
            unit: 'usd',
            provenance: 'verified',
            computed_by: { kind: 'rule', id: 'owner_directive_amount', version: '1.0.0' },
            citations: [
              {
                connection_id: '550e8400-e29b-41d4-a716-446655440001',
                source: 'msgraph_mail',
                entity_type: 'email',
                external_id: 'AAMkAGI2T...',
                label: 'RE: EV charger locations',
                quote: 'Budget impact approximately $125k',
                data_date: '2026-10-05'
              }
            ],
            as_of: '2026-10-09T05:12:00Z'
          }
        },
        draft: {
          kind: 'change_event',
          subject: 'Additional EV chargers - east parking structure',
          body: 'Owner directive from Oct 5 email: Add 4 additional Level 2 chargers on east side of parking structure. ROM: $125,000 per email.',
          deep_link: 'https://app.procore.com/projects/12345/change_events/new',
          read_only: true
        },
        approval: approvalFixture,
        created_at: '2026-10-09T05:12:00Z',
        updated_at: '2026-10-09T08:16:00Z'
      };

      const result = ActionSchema.parse(actionFixture);
      expect(result.action_id).toBe('change-event-draft');
      expect(result.approval).not.toBeNull();
      expect(result.approval?.decision).toBe('approved');
      expect(result.draft.kind).toBe('change_event');
    });
  });

  describe('Approval', () => {
    it('parses approved decision', () => {
      const approvalFixture: Approval = {
        id: 'appr_def456',
        action_id: 'action_xyz789',
        tier: 'PE',
        approver_id: 'user_sarah',
        approver_name: 'Sarah Chen',
        decision: 'approved',
        decided_at: '2026-10-09T08:15:00Z',
        sent_at: '2026-10-09T08:16:00Z',
        audit_event_ids: ['audit_001', 'audit_002']
      };

      const result = ApprovalSchema.parse(approvalFixture);
      expect(result.decision).toBe('approved');
      expect(result.tier).toBe('PE');
    });

    it('parses dismissed decision with reason', () => {
      const dismissalFixture: Approval = {
        id: 'appr_dismiss_001',
        action_id: 'action_xyz789',
        tier: 'PM',
        approver_id: 'user_mike',
        approver_name: 'Mike Johnson',
        decision: 'dismissed',
        dismiss_reason: 'already_handled',
        decided_at: '2026-10-09T09:30:00Z',
        audit_event_ids: ['audit_003']
      };

      const result = ApprovalSchema.parse(dismissalFixture);
      expect(result.decision).toBe('dismissed');
      expect(result.dismiss_reason).toBe('already_handled');
    });
  });

  describe('WhatIfResult', () => {
    it('parses complete what-if scenario result', () => {
      const whatIfFixture: WhatIfResult = {
        scenario: {
          activity_id: 'A2310',
          activity_name: 'L3 shaft framing',
          slip_working_days: 21,
          confidence: 'high',
          match_reason: 'Exact match on activity name "shaft framing" and location "L3"'
        },
        impacts: {
          primary_activity: {
            activity_id: 'A2310',
            activity_name: 'L3 shaft framing',
            original_early_finish: '2026-10-22',
            new_early_finish: '2026-11-20',
            slip_working_days: 21,
            float_consumed: 3.0,
            remaining_float: -18.0,
            on_critical_path: true
          },
          successors: [
            {
              activity_id: 'A2320',
              activity_name: 'L3 MEP rough-in',
              propagated_delay: 18.0,
              p6_total_float: 3.0,
              resulting_float: -15.0,
              on_critical_path: true
            }
          ],
          project_completion: {
            original_date: '2026-11-19',
            new_date: '2026-12-14',
            slip_working_days: 15,
            slip_calendar_days: 25
          }
        },
        dollars: {
          dollar_impact: 300000,
          completion_slip_working_days: 15,
          completion_slip_calendar_days: 25,
          daily_delay_cost: 12000,
          daily_delay_cost_unit: 'calendar_day',
          daily_delay_cost_source: 'project_settings'
        },
        notices: [
          {
            notice_type: 'delay_time_extension',
            notice_info: 'If this happens: notice period per settings is 7 business days (§8.3), deadline Dec 3. Confirm with PX.',
            event_date: '2026-11-20',
            notice_period_days: 7,
            calendar_or_business: 'business',
            notice_deadline: '2026-12-03',
            deadline_source: 'project_settings_contract_section_8.3'
          }
        ],
        suggested_actions: [
          {
            action_id: 'schedule-slip-recovery',
            action_name: 'Vendor slip recovery options',
            target_activity_id: 'A2310',
            reason: 'Activity slips and consumes float'
          }
        ],
        source_data: {
          schedule_snapshot: 'P6_XER_2026-10-08_05-12',
          schedule_data_date: '2026-10-08',
          project_settings: 'project_12345_settings_v3',
          computed_at: '2026-10-09T18:27:42Z'
        },
        estimate_label: 'estimate, confirm in P6'
      };

      const result = WhatIfResultSchema.parse(whatIfFixture);
      expect(result.scenario.activity_id).toBe('A2310');
      expect(result.dollars.dollar_impact).toBe(300000);
      expect(result.estimate_label).toBe('estimate, confirm in P6');
      expect(result.impacts.primary_activity.on_critical_path).toBe(true);
    });
  });

  describe('Evidence', () => {
    it('parses email evidence with sender_auth', () => {
      const evidenceFixture: Evidence = {
        id: 'evid_001',
        kind: 'email',
        source: {
          connection_id: '550e8400-e29b-41d4-a716-446655440001',
          source: 'msgraph_mail',
          entity_type: 'email',
          external_id: 'AAMkAGI2T...',
          label: 'RE: EV charger locations',
          quote: 'We need to add 4 additional Level 2 chargers on the east side of the parking structure.',
          data_date: '2026-10-05'
        },
        excerpt: 'We need to add 4 additional Level 2 chargers...',
        why_panel: {
          title: 'Owner directive with scope addition',
          explanation: 'This email from the owner adds scope (4 additional chargers) with no existing change event linked. Registry rule A4 triggers change event draft.',
          computed_by: { kind: 'rule', id: 'owner_directive_detector', version: '1.0.0' }
        },
        open_in_source_link: 'https://outlook.office365.com/mail/...',
        sender_auth: {
          spf: 'pass',
          dkim: 'pass',
          dmarc: 'pass',
          compauth: 'pass',
          verdict: 'pass'
        }
      };

      const result = EvidenceSchema.parse(evidenceFixture);
      expect(result.kind).toBe('email');
      expect(result.sender_auth?.verdict).toBe('pass');
      expect(result.why_panel.title).toBe('Owner directive with scope addition');
    });

    it('parses RFI evidence without sender_auth', () => {
      const evidenceFixture: Evidence = {
        id: 'evid_002',
        kind: 'rfi',
        source: {
          connection_id: '550e8400-e29b-41d4-a716-446655440000',
          source: 'procore',
          entity_type: 'rfi',
          external_id: '112',
          label: 'RFI 112: Shaft wall fire rating',
          data_date: '2026-10-08'
        },
        excerpt: 'What is the required fire rating for the shaft wall at grid line B?',
        why_panel: {
          title: 'RFI overdue blocking near-term activity',
          explanation: 'RFI 112 is 6 days overdue and blocks L3 shaft framing (starts in 4 working days). Registry rule A1 triggers escalation.',
          computed_by: { kind: 'rule', id: 'rfi_overdue_detector', version: '1.0.0' }
        },
        open_in_source_link: 'https://app.procore.com/projects/12345/rfis/112'
      };

      const result = EvidenceSchema.parse(evidenceFixture);
      expect(result.kind).toBe('rfi');
      expect(result.sender_auth).toBeUndefined();
    });
  });

  describe('AgentTask (Agent Operations - Priority 3)', () => {
    it('parses running detect_findings task', () => {
      const agentTaskFixture: AgentTask = {
        id: 'task_123',
        project_id: 'proj_12345',
        task: 'detect_findings',
        status: 'running',
        current_checkpoint: 'processing_rfis',
        allowed_registry_actions: ['rfi-overdue-escalation', 'submittal-chase', 'fabrication-hold'],
        created_at: '2026-10-09T05:00:00Z',
        started_at: '2026-10-09T05:01:00Z'
      };

      const result = AgentTaskSchema.parse(agentTaskFixture);
      expect(result.task).toBe('detect_findings');
      expect(result.status).toBe('running');
      expect(result.current_checkpoint).toBe('processing_rfis');
    });

    it('parses failed sync task with error', () => {
      const failedTaskFixture: AgentTask = {
        id: 'task_456',
        project_id: 'proj_12345',
        task: 'sync_procore',
        status: 'failed',
        allowed_registry_actions: [],
        created_at: '2026-10-09T04:00:00Z',
        started_at: '2026-10-09T04:01:00Z',
        finished_at: '2026-10-09T04:05:00Z',
        error_code: 'AUTH_EXPIRED',
        error_summary: 'Procore access token expired'
      };

      const result = AgentTaskSchema.parse(failedTaskFixture);
      expect(result.status).toBe('failed');
      expect(result.error_code).toBe('AUTH_EXPIRED');
    });
  });

  describe('AuditEvent', () => {
    it('parses approved event with model provenance', () => {
      const auditEventFixture: AuditEvent = {
        id: 'audit_001',
        action_id: 'action_xyz789',
        event_type: 'approved',
        user_id: 'user_sarah',
        user_name: 'Sarah Chen',
        timestamp: '2026-10-09T08:15:00Z',
        metadata: {
          model_call_id: 'call_abc123',
          model_version: 'gpt-5.6',
          verifier_result: 'pass'
        }
      };

      const result = AuditEventSchema.parse(auditEventFixture);
      expect(result.event_type).toBe('approved');
      expect(result.metadata.verifier_result).toBe('pass');
    });

    it('parses outcome_confirmed event with float and dollars saved', () => {
      const outcomeEventFixture: AuditEvent = {
        id: 'audit_outcome_001',
        action_id: 'action_xyz789',
        event_type: 'outcome_confirmed',
        user_id: 'system',
        timestamp: '2026-10-15T14:30:00Z',
        metadata: {
          detection_method: 'sent_item_match',
          outcome_kind: 'rfi_answered',
          outcome_on_time: true,
          float_saved: 3,
          dollars_saved: 36000
        }
      };

      const result = AuditEventSchema.parse(outcomeEventFixture);
      expect(result.event_type).toBe('outcome_confirmed');
      expect(result.metadata.float_saved).toBe(3);
      expect(result.metadata.dollars_saved).toBe(36000);
    });
  });

  describe('PermissionMatrix', () => {
    it('parses A1 permission matrix (PE tier)', () => {
      const permissionFixture: PermissionMatrix = {
        action_id: 'rfi-overdue-escalation',
        tiers: {
          PE: { can_view: true, can_approve: true, can_execute: true },
          PM: { can_view: true, can_approve: true, can_execute: true },
          PX: { can_view: true, can_approve: true, can_execute: true }
        },
        escalation_path: ['PE', 'PM', 'PX']
      };

      const result = PermissionMatrixSchema.parse(permissionFixture);
      expect(result.action_id).toBe('rfi-overdue-escalation');
      expect(result.tiers.PE?.can_approve).toBe(true);
      expect(result.escalation_path).toEqual(['PE', 'PM', 'PX']);
    });

    it('parses A6 permission matrix (PX tier only)', () => {
      const permissionFixture: PermissionMatrix = {
        action_id: 'notice-response',
        tiers: {
          PM: { can_view: true, can_approve: false, can_execute: false },
          PX: { can_view: true, can_approve: true, can_execute: true }
        },
        escalation_path: ['PX']
      };

      const result = PermissionMatrixSchema.parse(permissionFixture);
      expect(result.action_id).toBe('notice-response');
      expect(result.tiers.PM?.can_approve).toBe(false);
      expect(result.tiers.PX?.can_approve).toBe(true);
    });
  });

  describe('UI States', () => {
    it('parses empty state', () => {
      const emptyFixture: EmptyState = {
        kind: 'empty',
        message: 'Nothing needs you today on Linden Yard'
      };

      const result = EmptyStateSchema.parse(emptyFixture);
      expect(result.kind).toBe('empty');
      expect(result.message).toBe('Nothing needs you today on Linden Yard');
    });

    it('parses stale state with freshness data', () => {
      const staleFixture: StaleState<Action> = {
        kind: 'stale',
        data: {
          id: 'action_xyz789',
          action_id: 'rfi-overdue-escalation',
          version: 1,
          project_id: 'proj_12345',
          finding_id: 'find_abc123',
          owner_role: 'PE',
          stage: 'approve',
          due_at: null,
          escalation_level: 0,
          requires_procore: true,
          measures: {},
          draft: { kind: 'email', read_only: true },
          approval: null,
          created_at: '2026-10-09T05:12:00Z',
          updated_at: '2026-10-09T05:12:00Z'
        },
        stale_since: '2026-10-08T18:00:00Z',
        stale_threshold_hours: 12,
        freshness: [
          {
            connection_id: '550e8400-e29b-41d4-a716-446655440000',
            provider: 'procore',
            mode: 'stored',
            health: 'degraded',
            last_success_at: '2026-10-08T18:00:00Z',
            last_attempt_at: '2026-10-09T05:12:00Z',
            stale: true,
            error_code: 'RATE_LIMITED',
            records_skipped: 3,
            checkpoint_reset_at: null
          }
        ]
      };

      const result = StaleStateSchema(ActionSchema).parse(staleFixture);
      expect(result.kind).toBe('stale');
      expect(result.freshness[0].stale).toBe(true);
      expect(result.freshness[0].health).toBe('degraded');
    });

    it('parses permission denied state', () => {
      const deniedFixture: PermissionDeniedState = {
        kind: 'permission_denied',
        required_role: 'PX',
        user_role: 'PE'
      };

      const result = PermissionDeniedStateSchema.parse(deniedFixture);
      expect(result.kind).toBe('permission_denied');
      expect(result.required_role).toBe('PX');
      expect(result.user_role).toBe('PE');
    });

    it('parses error state', () => {
      const errorFixture: ErrorState = {
        kind: 'error',
        error_code: 'NETWORK_ERROR',
        error_message: 'Failed to fetch actions',
        retry_allowed: true
      };

      const result = ErrorStateSchema.parse(errorFixture);
      expect(result.kind).toBe('error');
      expect(result.retry_allowed).toBe(true);
    });
  });

  describe('UnverifiedSendersSection', () => {
    it('parses unverified senders section', () => {
      const unverifiedFixture: UnverifiedSendersSection = {
        section_type: 'unverified_senders',
        label: 'UNVERIFIED',
        rows: [
          {
            sender_domain: 'newvendor.com',
            sender_display_name: 'New Vendor Co',
            email_count: 5,
            hypothetical_impact: {
              value: 125000,
              unit: 'usd',
              provenance: 'ai_suggested',
              computed_by: { kind: 'model', id: 'cost_estimator', version: '1.0.0' },
              citations: [],
              as_of: '2026-10-09T05:12:00Z',
              confidence: 0.7,
              confirm_required: 'Add party to verify'
            },
            sample_subjects: [
              'RE: Steel fabrication schedule',
              'Updated shop drawings',
              'Delivery delay notification'
            ],
            add_party_allowed: true,
            sender_auth_summary: {
              pass_count: 5,
              fail_count: 0,
              unknown_count: 0
            }
          }
        ],
        warning: 'These senders are not in your project parties list. Add them to enable actions.'
      };

      const result = UnverifiedSendersSectionSchema.parse(unverifiedFixture);
      expect(result.section_type).toBe('unverified_senders');
      expect(result.label).toBe('UNVERIFIED');
      expect(result.rows[0].sender_domain).toBe('newvendor.com');
      expect(result.rows[0].add_party_allowed).toBe(true);
      expect(result.rows[0].hypothetical_impact.confirm_required).toBe('Add party to verify');
    });
  });
});
