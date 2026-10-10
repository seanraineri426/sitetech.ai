/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CommandCenter } from '../command-center';

describe('CommandCenter', () => {
  const mockProps = {
    greeting: 'Friday, October 9',
    summary: 'Good morning, Jordan',
    kpis: [],
    actions: [],
    onActionApprove: vi.fn(),
    onActionEdit: vi.fn(),
    onActionDismiss: vi.fn(),
  };

  it('renders greeting and summary', () => {
    render(<CommandCenter {...mockProps} />);

    expect(screen.getByText('Friday, October 9')).toBeInTheDocument();
    expect(screen.getByText('Good morning, Jordan')).toBeInTheDocument();
  });

  it('shows empty state when no actions', () => {
    render(<CommandCenter {...mockProps} />);

    expect(
      screen.getByText('Connect a project mailbox to see actions')
    ).toBeInTheDocument();
  });

  it('renders KPIs with data', () => {
    const kpis = [
      {
        label: 'DOLLARS AT RISK',
        value: '$1.24M',
        subtitle: '↓ $190k this week',
        trend: [{ value: 1.1 }, { value: 1.24 }],
        color: '#ff0000',
      },
    ];

    render(<CommandCenter {...mockProps} kpis={kpis} />);

    expect(screen.getByText('DOLLARS AT RISK')).toBeInTheDocument();
    expect(screen.getByText('$1.24M')).toBeInTheDocument();
    expect(screen.getByText('↓ $190k this week')).toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    const actions = [
      {
        id: '1',
        actionType: 'rfi_escalation' as const,
        headline: 'Test action',
        projectName: 'Test Project',
        daysAtRisk: 3,
        dollarsAtRisk: 100000,
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
      },
    ];

    render(<CommandCenter {...mockProps} actions={actions} />);

    expect(screen.getByText('Test action')).toBeInTheDocument();
  });
});
