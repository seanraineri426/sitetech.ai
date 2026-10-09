import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectActions } from '../project-actions';

describe('ProjectActions', () => {
  const mockProps = {
    projectName: 'Test Project',
    summary: 'Actions · 5 open',
    selectedAction: null,
    scheduleImpact: [],
    recoveryOptions: [],
    onActionApprove: vi.fn(),
    onActionEdit: vi.fn(),
    onActionDismiss: vi.fn(),
    onRecoveryApprove: vi.fn(),
  };

  it('renders project info', () => {
    render(<ProjectActions {...mockProps} />);

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Actions · 5 open')).toBeInTheDocument();
  });

  it('shows empty state when no action selected', () => {
    render(<ProjectActions {...mockProps} />);

    expect(screen.getByText('Select an action to see details')).toBeInTheDocument();
  });

  it('renders selected action', () => {
    const action = {
      id: '1',
      actionType: 'rfi_escalation' as const,
      headline: 'Test action',
      projectName: 'Test Project',
      daysAtRisk: null,
      dollarsAtRisk: null,
      dueBy: null,
      timeZone: 'America/New_York',
      ownerRole: 'PE' as const,
      ownerName: 'Test Owner',
      why: {
        kind: 'record' as const,
        label: 'Test',
        description: 'Test',
        date: 'Oct 1',
        secondaryLink: null,
      },
      confirmFlags: [],
      draft: { kind: 'email' as const, to: 'test@example.com', toDisplay: 'Test User', subject: 'Test', body: 'Test' },
      handoff: { href: null, copyText: null, label: 'Test' },
    };

    render(<ProjectActions {...mockProps} selectedAction={action} />);

    expect(screen.getByText('Test action')).toBeInTheDocument();
  });

  it('renders recovery options when provided', () => {
    const action = {
      id: '1',
      actionType: 'rfi_escalation' as const,
      headline: 'Test',
      projectName: 'Test',
      daysAtRisk: null,
      dollarsAtRisk: null,
      dueBy: null,
      timeZone: 'America/New_York',
      ownerRole: 'PE' as const,
      ownerName: null,
      why: {
        kind: 'record' as const,
        label: 'Test',
        description: 'Test',
        date: 'Oct 1',
        secondaryLink: null,
      },
      confirmFlags: [],
      draft: { kind: 'email' as const, to: 'test@example.com', toDisplay: 'Test User', subject: 'Test', body: 'Test' },
      handoff: { href: null, copyText: null, label: 'Test' },
    };

    const recoveryOptions = [
      {
        id: 'ro-1',
        label: 'Option A',
        description: 'Test option',
        daysChange: -7,
        dollarsChange: -100000,
        impact: 'Test impact',
      },
    ];

    render(
      <ProjectActions
        {...mockProps}
        selectedAction={action}
        recoveryOptions={recoveryOptions}
      />
    );

    expect(screen.getByText('Recovery options')).toBeInTheDocument();
    expect(screen.getByText('Option A')).toBeInTheDocument();
  });
});
