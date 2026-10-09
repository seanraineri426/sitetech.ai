import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KpiSparkline } from '../kpi-sparkline';

describe('KpiSparkline', () => {
  it('renders loading state', () => {
    render(<KpiSparkline data={[]} color="#ff0000" isLoading={true} />);

    const loadingElement = document.querySelector('.animate-pulse');
    expect(loadingElement).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<KpiSparkline data={[]} color="#ff0000" />);

    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders chart with data', () => {
    const data = [{ value: 1 }, { value: 2 }, { value: 3 }];
    const { container } = render(<KpiSparkline data={data} color="#ff0000" />);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
