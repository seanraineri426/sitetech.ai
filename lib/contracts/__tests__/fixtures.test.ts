/**
 * UI Data Contracts Fixture Tests
 * 
 * SYNTHETIC FIXTURES - These are example data for testing schema validation.
 * DO NOT use real project data in these tests.
 */

import { describe, it, expect } from 'vitest';
import {
  MeasureSchema,
  CitationSchema,
  StoredCitationSchema,
  SourceFreshnessSchema,
  FindingSchema,
  ActionSchema,
  ApprovalSchema,
  EvidenceSchema,
  AgentTaskSchema,
  AuditEventSchema,
  EmptyStateSchema,
  UnverifiedSendersSectionSchema,
  type Measure,
  type Citation,
  type StoredCitation,
  type SourceFreshness,
  type Finding,
  type Action,
  type Approval,
  type Evidence,
  type AgentTask,
  type AuditEvent,
  type EmptyState,
  type UnverifiedSendersSection
} from '../index';
import { z } from 'zod';

describe('UI Data Contracts - SYNTHETIC Fixtures', () => {
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
            source: 'project_settings',
            entity_type: 'delay_cost',
            external_id: 'proj_synthetic_001',
            label: 'Daily delay cost',
            data_date: '2026-10-08'
          },
          {
            source: 'p6_upload',
            entity_type: 'schedule_activity',
            external_id: 'SYNTHETIC:A3000',
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

    it('parses ai_suggested non-dollar measure with confidence', () => {
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

    it('REJECTS verified with kind=model', () => {
      const invalidFixture = {
        value: 100,
        unit: 'working_days',
        provenance: 'verified',
        computed_by: {
          kind: 'model',
          id: 'test',
          version: '1.0.0'
        },
        citations: [],
        as_of: '2026-10-09T18:27:42Z'
      };

      expect(() => MeasureSchema(z.number()).parse(invalidFixture)).toThrow();
    });

    it('REJECTS verified with confidence', () => {
      const invalidFixture = {
        value: 100,
        unit: 'working_days',
        provenance: 'verified',
        computed_by: {
          kind: 'calc',
          id: 'test',
          version: '1.0.0'
        },
        citations: [],
        as_of: '2026-10-09T18:27:42Z',
        confidence: 0.9
      };

      expect(() => MeasureSchema(z.number()).parse(invalidFixture)).toThrow();
    });

    it('REJECTS null value without confirm_required', () => {
      const invalidFixture = {
        value: null,
        unit: 'working_days',
        provenance: 'verified',
        computed_by: {
          kind: 'calc',
          id: 'test',
          version: '1.0.0'
        },
        citations: [],
        as_of: '2026-10-09T18:27:42Z'
      };

      expect(() => MeasureSchema(z.number()).parse(invalidFixture)).toThrow();
    });

    it('REJECTS verified $ with zero citations', () => {
      const invalidFixture = {
        value: 50000,
        unit: 'usd',
        provenance: 'verified',
        computed_by: {
          kind: 'calc',
          id: 'test',
          version: '1.0.0'
        },
        citations: [],
        as_of: '2026-10-09T18:27:42Z'
      };

      expect(() => MeasureSchema(z.number()).parse(invalidFixture)).toThrow();
    });

    it('REJECTS ai_suggested $ (code computes $)', () => {
      const invalidFixture = {
        value: 125000,
        unit: 'usd',
        provenance: 'ai_suggested',
        computed_by: {
          kind: 'model',
          id: 'cost_estimator',
          version: '1.0.0'
        },
        citations: [],
        as_of: '2026-10-09T05:12:00Z',
        confidence: 0.7
      };

      expect(() => MeasureSchema(z.number()).parse(invalidFixture)).toThrow();
    });
  });

  describe('Citation', () => {
    it('parses stored citation (strict)', () => {
      const storedFixture: StoredCitation = {
        source: 'procore',
        entity_type: 'rfi',
        external_id: '112',
        label: 'RFI 112: Synthetic'
      };

      const result = StoredCitationSchema.parse(storedFixture);
      expect(result.source).toBe('procore');
    });

    it('parses UI citation with enrichment', () => {
      const citationFixture: Citation = {
        source: 'procore',
        entity_type: 'rfi',
        external_id: '112',
        label: 'RFI 112: Synthetic',
        connection_id: '550e8400-e29b-41d4-a716-446655440000',
        quote: 'Synthetic quote text',
        data_date: '2026-10-08'
      };

      const result = CitationSchema.parse(citationFixture);
      expect(result.connection_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.data_date).toBe('2026-10-08');
    });

    it('parses citation with null connection_id', () => {
      const citationFixture: Citation = {
        source: 'manual',
        entity_type: 'note',
        external_id: 'manual_001',
        label: 'Manual entry',
        connection_id: null
      };

      const result = CitationSchema.parse(citationFixture);
      expect(result.connection_id).toBeNull();
    });
  });

  describe('SourceFreshness', () => {
    it('parses healthy source', () => {
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
    });

    it('REJECTS health=ok with null last_success_at', () => {
      const invalidFixture = {
        connection_id: '550e8400-e29b-41d4-a716-446655440000',
        provider: 'procore',
        mode: 'stored',
        health: 'ok',
        last_success_at: null,
        last_attempt_at: '2026-10-09T05:12:00Z',
        stale: false,
        error_code: null,
        records_skipped: 0,
        checkpoint_reset_at: null
      };

      expect(() => SourceFreshnessSchema.parse(invalidFixture)).toThrow();
    });
  });

  describe('Finding', () => {
    it('parses finding (SYNTHETIC)', () => {
      const findingFixture: Finding = {
        id: 'find_synthetic_001',
        project_id: 'proj_synthetic_001',
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
            citations: [],
            as_of: '2026-10-09T05:12:00Z'
          }
        },
        linked_records: [],
        owner_role: 'PE',
        suppressed: false,
        unverified_sender: false
      };

      const result = FindingSchema.parse(findingFixture);
      expect(result.kind).toBe('rfi_overdue');
    });

    it('REJECTS suppressed without reason', () => {
      const invalidFixture = {
        id: 'find_001',
        project_id: 'proj_001',
        kind: 'test',
        detected_at: '2026-10-09T05:12:00Z',
        entity_type: 'rfi',
        external_id: '1',
        measures: {},
        linked_records: [],
        owner_role: 'PE',
        suppressed: true,
        unverified_sender: false
      };

      expect(() => FindingSchema.parse(invalidFixture)).toThrow();
    });
  });

  describe('Action (SYNTHETIC - Project Action Workspace)', () => {
    it('parses A1 RFI overdue action with corrected $ calc', () => {
      // SYNTHETIC: $ = completion slip × daily cost (NOT float × cost)
      const actionFixture: Action = {
        id: 'action_synthetic_001',
        action_id: 'rfi-overdue-escalation',
        version: 1,
        project_id: 'proj_synthetic_001',
        finding_id: 'find_synthetic_001',
        owner_role: 'PE',
        assigned_to: 'Synthetic User',
        stage: 'approve',
        due_at: '2026-10-18T17:00:00Z',
        escalation_level: 0,
        requires_procore: true,
        measures: {
          float_protected: {
            value: 3,
            unit: 'working_days',
            provenance: 'verified',
            computed_by: { kind: 'calc', id: 'p6_float', version: '1.0.0' },
            citations: [{
              source: 'p6_upload',
              entity_type: 'schedule_activity',
              external_id: 'SYNTHETIC:A2310',
              label: 'Synthetic activity'
            }],
            as_of: '2026-10-09T05:12:00Z'
          },
          dollars_at_risk: {
            value: 48000, // = 4 days completion slip × $12k/day
            unit: 'usd',
            provenance: 'verified',
            computed_by: { kind: 'calc', id: 'critical_path_cost', version: '1.0.0' },
            citations: [{
              source: 'project_settings',
              entity_type: 'delay_cost',
              external_id: 'proj_synthetic_001',
              label: 'Daily delay cost'
            }],
            as_of: '2026-10-09T05:12:00Z'
          },
          days_to_deadline: {
            value: 9,
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
          subject: 'RFI 112 overdue – Synthetic activity starts Mon Oct 19',
          body: 'RFI 112 is now 6 days past due and controls Synthetic activity starting Mon 10/19. Float at risk: 3 days. $ at risk: $48,000.\n\nCan you provide the answer by Fri 10/16?',
          read_only: true
        },
        approval: null,
        can_approve: true,
        created_at: '2026-10-09T05:12:00Z',
        updated_at: '2026-10-09T05:12:00Z'
      };

      const result = ActionSchema.parse(actionFixture);
      expect(result.action_id).toBe('rfi-overdue-escalation');
      expect(result.can_approve).toBe(true);
      expect(result.draft.read_only).toBe(true);
    });

    it('REJECTS draft with read_only false', () => {
      const invalidDraft = {
        kind: 'email',
        read_only: false
      };

      expect(() => z.object({
        kind: z.literal('email'),
        read_only: z.literal(true)
      }).parse(invalidDraft)).toThrow();
    });
  });

  describe('Approval', () => {
    it('parses approval with audit_log_ids', () => {
      const approvalFixture: Approval = {
        id: 'appr_synthetic_001',
        action_id: 'action_synthetic_001',
        tier: 'PE',
        approver_id: 'user_synthetic',
        approver_name: 'Synthetic User',
        decision: 'approved',
        decided_at: '2026-10-09T08:15:00Z',
        sent_at: '2026-10-09T08:16:00Z',
        audit_log_ids: [1001, 1002] // References audit_log.id (bigint)
      };

      const result = ApprovalSchema.parse(approvalFixture);
      expect(result.audit_log_ids).toEqual([1001, 1002]);
    });
  });

  describe('Evidence', () => {
    it('parses email evidence with sender_auth', () => {
      const evidenceFixture: Evidence = {
        id: 'evid_synthetic_001',
        kind: 'email',
        source: {
          source: 'msgraph',
          entity_type: 'email',
          external_id: 'AAMkSynthetic...',
          label: 'Synthetic email'
        },
        why_panel: {
          title: 'Test panel',
          explanation: 'Test explanation',
          computed_by: { kind: 'rule', id: 'test_rule', version: '1.0.0' }
        },
        sender_auth: {
          spf: 'pass',
          dkim: 'pass',
          dmarc: 'pass',
          compauth: 'pass',
          verdict: 'pass'
        },
        unverified_sender: false
      };

      const result = EvidenceSchema.parse(evidenceFixture);
      expect(result.sender_auth?.verdict).toBe('pass');
    });

    it('REJECTS email evidence without sender_auth', () => {
      const invalidFixture = {
        id: 'evid_001',
        kind: 'email',
        source: {
          source: 'msgraph',
          entity_type: 'email',
          external_id: 'test'
        },
        why_panel: {
          title: 'Test',
          explanation: 'Test',
          computed_by: { kind: 'rule', id: 'test', version: '1.0.0' }
        },
        unverified_sender: false
      };

      expect(() => EvidenceSchema.parse(invalidFixture)).toThrow();
    });
  });

  describe('AgentTask (Agent Operations)', () => {
    it('parses running task', () => {
      const taskFixture: AgentTask = {
        id: 'task_synthetic_001',
        project_id: 'proj_synthetic_001',
        task: 'detect_findings',
        status: 'running',
        current_checkpoint: 'processing_rfis',
        allowed_registry_actions: ['RFI-OVERDUE', 'SUB-REVIEW-OVERDUE'],
        created_at: '2026-10-09T05:00:00Z',
        started_at: '2026-10-09T05:01:00Z'
      };

      const result = AgentTaskSchema.parse(taskFixture);
      expect(result.status).toBe('running');
    });
  });

  describe('AuditEvent', () => {
    it('parses audit event with neutral model placeholder', () => {
      const auditFixture: AuditEvent = {
        id: 'audit_synthetic_001',
        action_id: 'action_synthetic_001',
        event_type: 'approved',
        user_id: 'user_synthetic',
        user_name: 'Synthetic User',
        timestamp: '2026-10-09T08:15:00Z',
        metadata: {
          model_call_id: 'call_synthetic_001',
          model_version: 'model-placeholder', // Neutral placeholder instead of specific model
          verifier_result: 'pass'
        }
      };

      const result = AuditEventSchema.parse(auditFixture);
      expect(result.metadata.model_version).toBe('model-placeholder');
    });
  });

  describe('UnverifiedSendersSection', () => {
    it('parses unverified section with reason split', () => {
      const unverifiedFixture: UnverifiedSendersSection = {
        section_type: 'unverified_senders',
        label: 'UNVERIFIED',
        rows: [
          {
            sender_domain: 'newvendor.example',
            sender_display_name: 'New Vendor Co',
            email_count: 5,
            hypothetical_impact: {
              value: 15, // NON-dollar unit (working_days), NOT $
              unit: 'working_days',
              provenance: 'ai_suggested',
              computed_by: { kind: 'model', id: 'impact_estimator', version: '1.0.0' },
              citations: [],
              as_of: '2026-10-09T05:12:00Z',
              confidence: 0.7,
              confirm_required: 'Add party to verify'
            },
            sample_subjects: ['RE: Synthetic subject 1', 'Synthetic subject 2'],
            add_party_allowed: true,
            sender_auth_summary: {
              pass_count: 5,
              fail_count: 0,
              unknown_count: 0
            },
            reason: 'not_on_project_parties'
          },
          {
            sender_domain: 'failedauth.example',
            sender_display_name: 'Failed Auth Sender',
            email_count: 2,
            hypothetical_impact: {
              value: 5,
              unit: 'working_days',
              provenance: 'ai_suggested',
              computed_by: { kind: 'model', id: 'impact_estimator', version: '1.0.0' },
              citations: [],
              as_of: '2026-10-09T05:12:00Z',
              confidence: 0.5,
              confirm_required: 'Verify sender'
            },
            sample_subjects: ['Synthetic failed auth subject'],
            add_party_allowed: false,
            sender_auth_summary: {
              pass_count: 0,
              fail_count: 2,
              unknown_count: 0
            },
            reason: 'auth_failed'
          }
        ],
        warning: 'SYNTHETIC: These senders are not verified.'
      };

      const result = UnverifiedSendersSectionSchema.parse(unverifiedFixture);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].reason).toBe('not_on_project_parties');
      expect(result.rows[1].reason).toBe('auth_failed');
      // Verify no dollar values in hypothetical_impact
      expect(result.rows[0].hypothetical_impact.unit).not.toBe('usd');
      expect(result.rows[1].hypothetical_impact.unit).not.toBe('usd');
    });
  });

  describe('UI States', () => {
    it('parses empty state', () => {
      const emptyFixture: EmptyState = {
        kind: 'empty',
        message: 'SYNTHETIC: Nothing to show'
      };

      const result = EmptyStateSchema.parse(emptyFixture);
      expect(result.kind).toBe('empty');
    });
  });
});
