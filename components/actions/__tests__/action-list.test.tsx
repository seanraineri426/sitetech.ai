/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionList } from '../action-list';
import { allActionFixtures } from '@/tests/fixtures/action-card-data';

describe('ActionList', () => {
  const mockOnApprove = vi.fn();
  const mockOnEdit = vi.fn();
  const mockOnDismiss = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('shows skeletons when loading', () => {
      const { container } = render(
        <ActionList
          loading
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('does not show actions when loading', () => {
      render(
        <ActionList
          actions={allActionFixtures}
          loading
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.queryByText(/RFI 112/)).not.toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('shows error message', () => {
      render(
        <ActionList
          error="Failed to load actions"
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('Error loading actions')).toBeInTheDocument();
      expect(screen.getByText('Failed to load actions')).toBeInTheDocument();
    });

    it('does not show actions when error', () => {
      render(
        <ActionList
          actions={allActionFixtures}
          error="Network error"
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.queryByText(/RFI 112/)).not.toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows empty message when no actions', () => {
      render(
        <ActionList
          actions={[]}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText(/Nothing needs you today/)).toBeInTheDocument();
    });

    it('shows empty message with project name', () => {
      render(
        <ActionList
          actions={[]}
          projectName="Linden Yard"
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('Nothing needs you today on Linden Yard.')).toBeInTheDocument();
    });

    it('shows empty message when actions is undefined', () => {
      render(
        <ActionList
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText(/Nothing needs you today/)).toBeInTheDocument();
    });
  });

  describe('Actions rendering', () => {
    it('renders all actions', () => {
      render(
        <ActionList
          actions={allActionFixtures}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText(/RFI 112 is 6 days late, and L3 framing starts Tue Oct 13/)).toBeInTheDocument();
      expect(screen.getByText(/Curtain wall shop drawings stuck in review for 12 days/)).toBeInTheDocument();
      expect(screen.getByText(/Owner email added EV chargers with no change event/)).toBeInTheDocument();
    });

    it('calls onApprove with correct action id', async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn(() => Promise.resolve()),
        },
      });

      render(
        <ActionList
          actions={allActionFixtures}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const approveButtons = screen.getAllByRole('button', { name: /Approve|Copy/ });
      await userEvent.click(approveButtons[0]);

      expect(mockOnApprove).toHaveBeenCalledWith('test-rfi-1');
    });

    it('calls onEdit with correct action id', async () => {
      render(
        <ActionList
          actions={allActionFixtures}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const editButtons = screen.getAllByRole('button', { name: 'Edit' });
      await userEvent.click(editButtons[0]);

      expect(mockOnEdit).toHaveBeenCalledWith('test-rfi-1');
    });

    it('calls onDismiss with correct action id', async () => {
      render(
        <ActionList
          actions={allActionFixtures}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss' });
      await userEvent.click(dismissButtons[0]);

      expect(mockOnDismiss).toHaveBeenCalledWith('test-rfi-1');
    });
  });
});
