import type { ActionCardData } from '@/lib/actions/types';
import type { TimelineDataPoint } from '@/components/charts/timeline-chart';
import type { RecoveryOption } from '@/components/screens/project-actions';

export const projectActionFixture: ActionCardData = {
  id: 'pa-1',
  actionType: 'rfi_escalation',
  headline: 'Switchgear moved 12 days, past building energization',
  projectName: 'Harbor Point Residences',
  daysAtRisk: null,
  dollarsAtRisk: 9600000,
  dueBy: '2026-10-22',
  timeZone: 'America/Los_Angeles',
  ownerRole: 'PM',
  ownerName: 'R. Patel',
  why: {
    kind: 'email_quote',
    label: 'Vendor email Oct 8',
    quote:
      'RE: SWGR release - ..due to a breaker backorder, ship date for the main switchgear is now 11/20 (previously 11/6)',
    senderCompany: 'Example Builders',
    senderRole: 'Subcontractor',
    date: 'Oct 8, 4:41pm',
    subject: 'RE: SWGR release',
    secondaryLink: 'https://outlook.office.com/mail/id/swgr',
  },
  confirmFlags: [],
  draft: {
    kind: 'email',
    to: 'vendor@example.com',
    subject: 'Switchgear delivery moved',
    body: 'Uses all 4 days of float on A4120 and pushes TCO about 8 working days...',
  },
  handoff: {
    href: 'https://outlook.office.com/mail/deeplink/compose',
    copyText: null,
    label: 'Approve & open in Outlook',
  },
};

export const scheduleImpactFixture: TimelineDataPoint[] = [
  {
    activity: 'A4080 Switchgear delivery',
    start: 0,
    duration: 10,
    isSlipped: true,
  },
  {
    activity: 'A4100 Set & terminate gear',
    start: 10,
    duration: 8,
  },
  {
    activity: 'A4120 Energize building',
    start: 18,
    duration: 4,
    isBaseline: true,
  },
  {
    activity: 'A4200 Elevator commissioning',
    start: 22,
    duration: 12,
  },
  {
    activity: 'A4300 TCO inspections',
    start: 34,
    duration: 6,
  },
];

export const recoveryOptionsFixture: RecoveryOption[] = [
  {
    id: 'ro-1',
    label: 'A · Expedite ask to vendor',
    description: 'Draft ready. Recovers up to 7 days if vendor ships partial gear.',
    daysChange: -7,
    dollarsChange: -84800000,
    impact: 'Protects claim position',
  },
  {
    id: 'ro-2',
    label: 'B · Resequence',
    description:
      'Start elevator commissioning on temp power (A2100 has no gear dependency in the logic).',
    daysChange: -4,
    dollarsChange: -44800000,
    impact: 'View in schedule',
  },
  {
    id: 'ro-3',
    label: 'C · Notify owner',
    description:
      'Draft notice with revised energization date and float impact.',
    daysChange: 0,
    dollarsChange: 0,
    impact: 'Protects claim position',
  },
];
