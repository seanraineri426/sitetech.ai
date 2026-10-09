import type { ActionCardData } from '@/lib/actions/types';

export const rfiEscalationFixture: ActionCardData = {
  id: 'test-rfi-1',
  actionType: 'rfi_escalation',
  headline: 'RFI 112 is 6 days late, and L3 framing starts Tue Oct 13',
  projectName: 'Linden Yard',
  daysAtRisk: 3,
  dollarsAtRisk: 3600000,
  dueBy: '2026-10-09T17:00:00Z',
  ownerRole: 'PE',
  ownerName: 'Sarah Chen',
  why: {
    kind: 'email_quote',
    label: 'RFI 112 overdue',
    quote: 'Need shaft-wall rating answer before framing crew arrives',
    sourceUrl: 'https://app.procore.com/projects/12345/rfis/112',
  },
  confirmFlags: [],
  draft: {
    kind: 'email',
    to: 'architect@example.com',
    subject: 'RFI 112 past due - L3 shaft framing starting Tue 10/13',
    body: 'RFI 112 is now 6 days past due and controls L3 shaft framing starting Tue 10/13...',
  },
  handoff: {
    href: 'https://outlook.office.com/mail/deeplink/compose?to=architect@example.com&subject=RFI%20112',
    copyText: null,
    label: 'Approve & open',
  },
};

export const submittalChaseFixture: ActionCardData = {
  id: 'test-submittal-1',
  actionType: 'submittal_chase',
  headline: 'Curtain wall shop drawings stuck in review for 12 days',
  projectName: 'Linden Yard',
  daysAtRisk: null,
  dollarsAtRisk: null,
  dueBy: null,
  ownerRole: 'PE',
  ownerName: null,
  why: {
    kind: 'record',
    label: 'Submittal S-0042 in review',
    sourceUrl: 'https://app.procore.com/projects/12345/submittals/42',
  },
  confirmFlags: ['confirm_owner', 'confirm_activity'],
  draft: {
    kind: 'email',
    to: 'reviewer@example.com',
    subject: 'Submittal S-0042 review needed',
    body: 'The curtain wall shop drawings have been in review for 12 days...',
  },
  handoff: {
    href: null,
    copyText: 'The curtain wall shop drawings have been in review for 12 days...',
    label: 'Copy & open',
  },
};

export const changeEventFixture: ActionCardData = {
  id: 'test-ce-1',
  actionType: 'change_event',
  headline: 'Owner email added EV chargers with no change event',
  projectName: 'Linden Yard',
  daysAtRisk: 0,
  dollarsAtRisk: 4200000,
  dueBy: '2026-10-15T17:00:00Z',
  ownerRole: 'PM',
  ownerName: 'Mike Torres',
  why: {
    kind: 'email_quote',
    label: 'Owner directive Oct 5',
    quote: 'Add six Level 2 EV charging stations in the garage',
    sourceUrl: 'https://outlook.office.com/mail/id/ABC123',
  },
  confirmFlags: [],
  draft: {
    kind: 'procore_paste',
    body: 'Change Event: EV Charging Stations\n\nOwner directive per email Oct 5...',
    procoreUrl: 'https://app.procore.com/projects/12345/change_events/new',
  },
  handoff: {
    href: 'https://app.procore.com/projects/12345/change_events/new',
    copyText: 'Change Event: EV Charging Stations\n\nOwner directive per email Oct 5...',
    label: 'Copy & open Procore',
  },
};

export const allActionFixtures: ActionCardData[] = [
  rfiEscalationFixture,
  submittalChaseFixture,
  changeEventFixture,
];
