/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScenarioChart } from '../scenario-chart';

describe('ScenarioChart', () => {
  it('renders loading state', () => {
    render(<ScenarioChart data={[]} isLoading={true} />);

    const loadingElement = document.querySelector('.animate-pulse');
    expect(loadingElement).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<ScenarioChart data={[]} />);

    expect(screen.getByText('No scenario data')).toBeInTheDocument();
  });

  it('renders chart with data', () => {
    const data = [
      { label: 'Option 1', value: 100 },
      { label: 'Option 2', value: 200 },
    ];
    const { container } = render(<ScenarioChart data={data} />);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
