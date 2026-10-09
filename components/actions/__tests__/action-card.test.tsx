/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionCard } from '../action-card';
import {
  rfiEscalationFixture,
  submittalChaseFixture,
  changeEventFixture,
} from '@/tests/fixtures/action-card-data';

describe('ActionCard', () => {
  const mockOnApprove = vi.fn();
  const mockOnEdit = vi.fn();
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('Formatting', () => {
    it('formats days and dollars correctly', () => {
      render(
        <ActionCard
          data={rfiEscalationFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('3 days · $36,000 at risk')).toBeInTheDocument();
    });

    it('formats single day correctly', () => {
      const data = { ...rfiEscalationFixture, daysAtRisk: 1 };
      render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText(/1 day/)).toBeInTheDocument();
    });

    it('rounds cents to nearest dollar', () => {
      const data = { ...rfiEscalationFixture, dollarsAtRisk: 4200042 };
      render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText(/\$42,000/)).toBeInTheDocument();
    });

    it('shows "under $1" for positive cents less than 100', () => {
      const data = { ...rfiEscalationFixture, dollarsAtRisk: 99, daysAtRisk: null };
      render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('under $1 at risk')).toBeInTheDocument();
    });

    it('shows "-under $1" for negative cents between -99 and -1', () => {
      const data = { ...rfiEscalationFixture, dollarsAtRisk: -50, daysAtRisk: null };
      render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('-under $1 at risk')).toBeInTheDocument();
    });

    it('formats negative dollars correctly', () => {
      const data = { ...rfiEscalationFixture, dollarsAtRisk: -200000, daysAtRisk: null };
      render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('-$2,000 at risk')).toBeInTheDocument();
    });

    it('shows nothing when both days and dollars are null', () => {
      const { container } = render(
        <ActionCard
          data={submittalChaseFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const text = container.textContent || '';
      expect(text).not.toContain('at risk');
    });

    it('shows only days when dollars are null', () => {
      const data = { ...rfiEscalationFixture, dollarsAtRisk: null };
      render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('3 days at risk')).toBeInTheDocument();
    });

    it('shows only dollars when days are null', () => {
      const data = { ...rfiEscalationFixture, daysAtRisk: null };
      render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('$36,000 at risk')).toBeInTheDocument();
    });

    it('never fakes a 0 for null values', () => {
      const data = { ...submittalChaseFixture, daysAtRisk: null, dollarsAtRisk: null };
      render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.queryByText(/0 days/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
    });

    it('shows 0 when explicitly provided', () => {
      const data = { ...changeEventFixture, daysAtRisk: 0, dollarsAtRisk: 4200000 };
      render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('0 days · $42,000 at risk')).toBeInTheDocument();
    });

    it('formats dates in project timezone', () => {
      const data = { ...rfiEscalationFixture, dueBy: '2026-10-12', timeZone: 'America/New_York' };
      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const text = container.textContent || '';
      expect(text).toMatch(/Due:.*Oct.*12/);
    });

    it('shows nothing for invalid dates', () => {
      const data = { ...rfiEscalationFixture, dueBy: 'invalid-date' };
      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const text = container.textContent || '';
      expect(text).not.toMatch(/Due:/);
    });
  });

  describe('Handoff URL validation', () => {
    it('allows https outlook.office.com URLs', async () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      const data = {
        ...rfiEscalationFixture,
        handoff: {
          href: 'https://outlook.office.com/mail/deeplink/compose?to=test@example.com',
          copyText: null,
          label: 'Approve & open',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Approve'));
      await userEvent.click(approveButton!);

      expect(windowOpen).toHaveBeenCalledWith(
        'https://outlook.office.com/mail/deeplink/compose?to=test@example.com',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('allows https outlook.office365.com URLs', async () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      const data = {
        ...rfiEscalationFixture,
        handoff: {
          href: 'https://outlook.office365.com/mail/compose',
          copyText: null,
          label: 'Approve & open',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Approve'));
      await userEvent.click(approveButton!);

      expect(windowOpen).toHaveBeenCalled();
    });

    it('allows https outlook.live.com URLs', async () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      const data = {
        ...rfiEscalationFixture,
        handoff: {
          href: 'https://outlook.live.com/mail/compose',
          copyText: null,
          label: 'Approve & open',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Approve'));
      await userEvent.click(approveButton!);

      expect(windowOpen).toHaveBeenCalled();
    });

    it('allows https *.procore.com URLs', async () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      const data = {
        ...changeEventFixture,
        handoff: {
          href: 'https://app.procore.com/projects/12345/change_events/new',
          copyText: null,
          label: 'Copy & open Procore',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('open'));
      await userEvent.click(approveButton!);

      expect(windowOpen).toHaveBeenCalledWith(
        'https://app.procore.com/projects/12345/change_events/new',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('rejects procore.com without subdomain', async () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      const data = {
        ...changeEventFixture,
        handoff: {
          href: 'https://procore.com/malicious',
          copyText: null,
          label: 'Approve & open',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Approve'));
      await userEvent.click(approveButton!);

      expect(windowOpen).not.toHaveBeenCalled();
      expect(screen.getByText('This link can\'t be opened safely')).toBeInTheDocument();
    });

    it('rejects evil.com URLs', async () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      const data = {
        ...rfiEscalationFixture,
        handoff: {
          href: 'https://evil.com/phishing',
          copyText: null,
          label: 'Approve & open',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Approve'));
      await userEvent.click(approveButton!);

      expect(windowOpen).not.toHaveBeenCalled();
      expect(screen.getByText('This link can\'t be opened safely')).toBeInTheDocument();
    });

    it('rejects javascript: URLs', async () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      const data = {
        ...rfiEscalationFixture,
        handoff: {
          href: 'javascript:alert(1)',
          copyText: null,
          label: 'Approve & open',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Approve'));
      await userEvent.click(approveButton!);

      expect(windowOpen).not.toHaveBeenCalled();
      expect(screen.getByText('This link can\'t be opened safely')).toBeInTheDocument();
    });

    it('rejects procore.com.evil.com URLs', async () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      const data = {
        ...changeEventFixture,
        handoff: {
          href: 'https://procore.com.evil.com/fake',
          copyText: null,
          label: 'Approve & open',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Approve'));
      await userEvent.click(approveButton!);

      expect(windowOpen).not.toHaveBeenCalled();
      expect(screen.getByText('This link can\'t be opened safely')).toBeInTheDocument();
    });

    it('rejects http URLs', async () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      const data = {
        ...rfiEscalationFixture,
        handoff: {
          href: 'http://outlook.office.com/mail/compose',
          copyText: null,
          label: 'Approve & open',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Approve'));
      await userEvent.click(approveButton!);

      expect(windowOpen).not.toHaveBeenCalled();
      expect(screen.getByText('This link can\'t be opened safely')).toBeInTheDocument();
    });

    it('rejects URLs with username', async () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      const data = {
        ...rfiEscalationFixture,
        handoff: {
          href: 'https://user@outlook.office.com/mail/compose',
          copyText: null,
          label: 'Approve & open',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Approve'));
      await userEvent.click(approveButton!);

      expect(windowOpen).not.toHaveBeenCalled();
    });

    it('rejects URLs with password', async () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      const data = {
        ...rfiEscalationFixture,
        handoff: {
          href: 'https://user:pass@outlook.office.com/mail/compose',
          copyText: null,
          label: 'Approve & open',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Approve'));
      await userEvent.click(approveButton!);

      expect(windowOpen).not.toHaveBeenCalled();
    });

    it('rejects URLs with non-default port', async () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      const data = {
        ...rfiEscalationFixture,
        handoff: {
          href: 'https://outlook.office.com:8080/mail/compose',
          copyText: null,
          label: 'Approve & open',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Approve'));
      await userEvent.click(approveButton!);

      expect(windowOpen).not.toHaveBeenCalled();
    });
  });

  describe('Clipboard functionality', () => {
    it('copies text to clipboard when copyText is provided', async () => {
      const data = {
        ...submittalChaseFixture,
        handoff: {
          href: null,
          copyText: 'Test content to copy',
          label: 'Copy & open',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Copy'));
      await userEvent.click(approveButton!);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test content to copy');
    });

    it('shows "Copied" confirmation after copying', async () => {
      const data = {
        ...submittalChaseFixture,
        handoff: {
          href: null,
          copyText: 'Test content',
          label: 'Copy & open',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Copy'));
      await userEvent.click(approveButton!);

      await waitFor(() => {
        const text = container.textContent || '';
        expect(text).toContain('✓ Copied');
      });
    });

    it('handles both href and copyText together', async () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      const data = {
        ...changeEventFixture,
        handoff: {
          href: 'https://app.procore.com/projects/12345/change_events/new',
          copyText: 'Change Event content',
          label: 'Copy & open Procore',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Copy'));
      await userEvent.click(approveButton!);

      expect(windowOpen).toHaveBeenCalled();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Change Event content');
    });
  });

  describe('Why section', () => {
    it('starts collapsed', () => {
      const { container } = render(
        <ActionCard
          data={rfiEscalationFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const text = container.textContent || '';
      expect(text).not.toContain('Need shaft-wall rating');
    });

    it('expands when clicked', async () => {
      const { container } = render(
        <ActionCard
          data={rfiEscalationFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const whyButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Why'));
      expect(whyButton).toBeDefined();
      await userEvent.click(whyButton!);

      const text = container.textContent || '';
      expect(text).toContain('Need shaft-wall rating');
      expect(text).toContain('RFI 112 overdue');
    });

    it('shows quote for email_quote kind', async () => {
      const { container } = render(
        <ActionCard
          data={rfiEscalationFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const whyButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Why'));
      await userEvent.click(whyButton!);

      const text = container.textContent || '';
      expect(text).toContain('Need shaft-wall rating');
    });

    it('does not show quote for record kind', async () => {
      const { container } = render(
        <ActionCard
          data={submittalChaseFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const whyButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Why'));
      await userEvent.click(whyButton!);

      const quotes = container.querySelectorAll('blockquote');
      expect(quotes.length).toBe(0);
    });

    it('shows source link when URL is valid', async () => {
      const { container } = render(
        <ActionCard
          data={rfiEscalationFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const whyButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Why'));
      await userEvent.click(whyButton!);

      const links = container.querySelectorAll('a');
      const sourceLink = Array.from(links).find((link) => link.textContent?.includes('View source'));
      expect(sourceLink).toBeDefined();
      expect(sourceLink?.getAttribute('href')).toBe('https://app.procore.com/projects/12345/rfis/112');
    });

    it('shows plain text for data: URL', async () => {
      const data = {
        ...rfiEscalationFixture,
        why: { kind: 'record' as const, label: 'Test', sourceUrl: 'data:text/plain,test' },
      };
      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const whyButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Why'));
      await userEvent.click(whyButton!);

      const links = container.querySelectorAll('a[href]');
      const hasDataLink = Array.from(links).some((link) => link.getAttribute('href')?.startsWith('data:'));
      expect(hasDataLink).toBe(false);
    });

    it('shows plain text for http:// URL', async () => {
      const data = {
        ...rfiEscalationFixture,
        why: { kind: 'record' as const, label: 'Test', sourceUrl: 'http://evil.com/page' },
      };
      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const whyButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Why'));
      await userEvent.click(whyButton!);

      const links = container.querySelectorAll('a[href^="http://"]');
      expect(links.length).toBe(0);
    });

    it('shows plain text for https://evil.com URL', async () => {
      const data = {
        ...rfiEscalationFixture,
        why: { kind: 'record' as const, label: 'Test', sourceUrl: 'https://evil.com/page' },
      };
      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const whyButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Why'));
      await userEvent.click(whyButton!);

      const links = container.querySelectorAll('a');
      const evilLink = Array.from(links).find((link) => link.getAttribute('href')?.includes('evil.com'));
      expect(evilLink).toBeUndefined();
    });

    it('shows plain text for //evil.com URL', async () => {
      const data = {
        ...rfiEscalationFixture,
        why: { kind: 'record' as const, label: 'Test', sourceUrl: '//evil.com/page' },
      };
      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const whyButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Why'));
      await userEvent.click(whyButton!);

      const links = container.querySelectorAll('a');
      const evilLink = Array.from(links).find((link) => link.getAttribute('href')?.includes('evil.com'));
      expect(evilLink).toBeUndefined();
    });
  });

  describe('Confirm chips', () => {
    it('renders confirm_owner chip', () => {
      const { container } = render(
        <ActionCard
          data={submittalChaseFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const text = container.textContent || '';
      expect(text).toContain('Confirm owner');
    });

    it('renders confirm_activity chip', () => {
      const { container } = render(
        <ActionCard
          data={submittalChaseFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const text = container.textContent || '';
      expect(text).toContain('Confirm activity');
    });

    it('renders no chips when confirmFlags is empty', () => {
      const { container } = render(
        <ActionCard
          data={rfiEscalationFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const text = container.textContent || '';
      expect(text).not.toContain('Confirm owner');
      expect(text).not.toContain('Confirm activity');
    });
  });

  describe('Callbacks', () => {
    it('calls onApprove when approve button is clicked', async () => {
      vi.spyOn(window, 'open').mockImplementation(() => null);
      const { container } = render(
        <ActionCard
          data={rfiEscalationFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Approve'));
      expect(approveButton).toBeDefined();
      await userEvent.click(approveButton!);

      expect(mockOnApprove).toHaveBeenCalledTimes(1);
    });

    it('does not call onApprove when handoff is blocked', async () => {
      const data = {
        ...rfiEscalationFixture,
        handoff: {
          href: 'https://evil.com/phishing',
          copyText: null,
          label: 'Approve & open',
        },
      };
      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Approve'));
      await userEvent.click(approveButton!);

      expect(mockOnApprove).not.toHaveBeenCalled();
      expect(screen.getByText('This link can\'t be opened safely')).toBeInTheDocument();
    });

    it('calls onEdit when edit button is clicked', async () => {
      const { container } = render(
        <ActionCard
          data={rfiEscalationFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const editButton = Array.from(buttons).find((btn) => btn.textContent === 'Edit');
      expect(editButton).toBeDefined();
      await userEvent.click(editButton!);

      expect(mockOnEdit).toHaveBeenCalledTimes(1);
    });

    it('calls onDismiss when dismiss button is clicked', async () => {
      const { container } = render(
        <ActionCard
          data={rfiEscalationFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const dismissButton = Array.from(buttons).find((btn) => btn.textContent === 'Dismiss');
      expect(dismissButton).toBeDefined();
      await userEvent.click(dismissButton!);

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has minimum 44px tap targets for all interactive elements', async () => {
      const { container } = render(
        <ActionCard
          data={rfiEscalationFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      buttons.forEach((button) => {
        expect(button.className).toContain('min-h-[44px]');
      });

      const whyButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Why'));
      await userEvent.click(whyButton!);

      await waitFor(() => {
        const links = container.querySelectorAll('a');
        const sourceLink = Array.from(links).find((link) => link.textContent?.includes('View source'));
        if (sourceLink) {
          expect(sourceLink.className).toContain('min-h-[44px]');
        }
      });
    });

    it('uses proper button elements', () => {
      const { container } = render(
        <ActionCard
          data={rfiEscalationFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('has aria-expanded on why button', () => {
      const { container } = render(
        <ActionCard
          data={rfiEscalationFixture}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const whyButton = container.querySelector('button[aria-expanded]');
      expect(whyButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('has aria-live on copied message', async () => {
      const data = {
        ...submittalChaseFixture,
        handoff: {
          href: null,
          copyText: 'Test content',
          label: 'Copy & open',
        },
      };

      const { container } = render(
        <ActionCard
          data={data}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      );

      const buttons = container.querySelectorAll('button');
      const approveButton = Array.from(buttons).find((btn) => btn.textContent?.includes('Copy'));
      await userEvent.click(approveButton!);

      await waitFor(() => {
        const copiedMsg = container.querySelector('[aria-live="polite"]');
        expect(copiedMsg).toBeInTheDocument();
        expect(copiedMsg?.textContent).toContain('Copied');
      });
    });
  });
});
