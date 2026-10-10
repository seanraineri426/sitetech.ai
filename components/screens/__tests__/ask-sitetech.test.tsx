/**
 * @vitest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AskSiteTech } from '../ask-sitetech';

describe('AskSiteTech', () => {
  const mockProps = {
    answer: null,
    recentQuestions: [],
    onAsk: vi.fn(),
  };

  it('renders input and suggestions', () => {
    render(<AskSiteTech {...mockProps} />);

    expect(
      screen.getByPlaceholderText(/Ask a question or tell SiteTech/)
    ).toBeInTheDocument();
    expect(screen.getByText('Which RFIs block next week?')).toBeInTheDocument();
  });

  it('calls onAsk when submitting', () => {
    const onAsk = vi.fn();
    render(<AskSiteTech {...mockProps} onAsk={onAsk} />);

    const input = screen.getByPlaceholderText(/Ask a question or tell SiteTech/);
    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.submit(input.closest('form')!);

    expect(onAsk).toHaveBeenCalledWith('Test question');
  });

  it('renders answer when provided', () => {
    const answer = {
      text: 'Test answer',
      chart: null,
      suggestions: ['Suggestion 1'],
    };

    render(<AskSiteTech {...mockProps} answer={answer} />);

    expect(screen.getByText('Test answer')).toBeInTheDocument();
    expect(screen.getByText('Suggestion 1')).toBeInTheDocument();
  });

  it('renders chart when answer has chart data', () => {
    const answer = {
      text: 'Test answer',
      chart: [{ label: 'A', value: 100 }],
      suggestions: [],
    };

    const { container } = render(<AskSiteTech {...mockProps} answer={answer} />);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('shows recent questions when no answer', () => {
    const recentQuestions = ['Question 1', 'Question 2'];

    render(<AskSiteTech {...mockProps} recentQuestions={recentQuestions} />);

    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('Question 1')).toBeInTheDocument();
    expect(screen.getByText('Question 2')).toBeInTheDocument();
  });
});
