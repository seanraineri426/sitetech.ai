/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TimelineChart } from '../timeline-chart';

describe('TimelineChart', () => {
  it('renders loading state', () => {
    render(<TimelineChart data={[]} isLoading={true} />);

    const loadingElement = document.querySelector('.animate-pulse');
    expect(loadingElement).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<TimelineChart data={[]} />);

    expect(screen.getByText('No schedule data')).toBeInTheDocument();
  });

  it('renders chart with data', () => {
    const data = [
      { activity: 'A1', start: 0, duration: 5 },
      { activity: 'A2', start: 5, duration: 3, isSlipped: true },
    ];
    const { container } = render(<TimelineChart data={data} />);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
