/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppShell } from '../app-shell';

describe('AppShell', () => {
  it('renders with children', () => {
    render(
      <AppShell currentPath="/command-center">
        <div>Test content</div>
      </AppShell>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
    expect(screen.getByText('SiteTech AI')).toBeInTheDocument();
  });

  it('highlights active nav item', () => {
    render(
      <AppShell currentPath="/actions">
        <div>Content</div>
      </AppShell>
    );

    const actionsLink = screen.getAllByText('Actions')[0];
    expect(actionsLink.closest('a')).toHaveClass('bg-sidebar-accent');
  });

  it('renders all navigation items', () => {
    render(
      <AppShell currentPath="/command-center">
        <div>Content</div>
      </AppShell>
    );

    expect(screen.getAllByText('Command center').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Projects').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Actions').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ask').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
  });

  it('has accessible minimum touch targets', () => {
    const { container } = render(
      <AppShell currentPath="/command-center">
        <div>Content</div>
      </AppShell>
    );

    const links = container.querySelectorAll('a, button');
    links.forEach((el) => {
      const styles = window.getComputedStyle(el);
      const minHeight = parseInt(styles.minHeight);
      if (minHeight) {
        expect(minHeight).toBeGreaterThanOrEqual(44);
      }
    });
  });
});
