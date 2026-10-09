export type ActionType =
  | 'rfi_escalation'
  | 'submittal_chase'
  | 'fabrication_hold'
  | 'change_event'
  | 'recovery_options'
  | 'notice_response'
  | 'decision_request';

export type OwnerRole = 'PE' | 'PM' | 'PX' | 'super';

export type WhySource =
  | {
      kind: 'email_quote';
      label: string;
      quote: string;
      senderCompany: string;
      senderRole: string;
      date: string;
      subject: string;
      secondaryLink: string | null;
    }
  | {
      kind: 'record';
      label: string;
      description: string;
      date: string;
      secondaryLink: string | null;
    };

export type ConfirmFlag = 'confirm_owner' | 'confirm_activity';

export type DraftKind =
  | { kind: 'email'; to: string; toDisplay: string; subject: string; body: string }
  | { kind: 'procore_paste'; body: string; procoreUrl: string };

export interface ActionCardData {
  id: string;
  actionType: ActionType;
  headline: string;
  projectName: string;
  daysAtRisk: number | null;
  dollarsAtRisk: number | null;
  dueBy: string | null;
  timeZone: string;
  ownerRole: OwnerRole;
  ownerName: string | null;
  why: WhySource;
  confirmFlags: ConfirmFlag[];
  draft: DraftKind;
  handoff: {
    href: string | null;
    copyText: string | null;
    label: string;
  };
}
