import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AskBar } from '../ask-bar';

describe('AskBar', () => {
  it('opens with Cmd+K', async () => {
    const onAsk = vi.fn();
    render(<AskBar onAsk={onAsk} />);

    expect(screen.queryByPlaceholderText(/Ask SiteTech/i)).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask SiteTech/i)).toBeInTheDocument();
    });
  });

  it('opens with Ctrl+K', async () => {
    const onAsk = vi.fn();
    render(<AskBar onAsk={onAsk} />);

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask SiteTech/i)).toBeInTheDocument();
    });
  });

  it('closes with Escape', async () => {
    const onAsk = vi.fn();
    render(<AskBar onAsk={onAsk} />);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask SiteTech/i)).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/Ask SiteTech/i)).not.toBeInTheDocument();
    });
  });

  it('calls onAsk when submitting', async () => {
    const onAsk = vi.fn();
    render(<AskBar onAsk={onAsk} />);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask SiteTech/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ask SiteTech/i);
    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(onAsk).toHaveBeenCalledWith('Test question');
    });
  });

  it('focuses input when opened', async () => {
    const onAsk = vi.fn();
    render(<AskBar onAsk={onAsk} />);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Ask SiteTech/i);
      expect(input).toHaveFocus();
    });
  });
});
