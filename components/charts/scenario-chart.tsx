'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList } from 'recharts';

export interface ScenarioDataPoint {
  label: string;
  value: number;
}

export interface ScenarioChartProps {
  data: ScenarioDataPoint[];
  isLoading?: boolean;
}

export function ScenarioChart({ data, isLoading }: ScenarioChartProps) {
  if (isLoading) {
    return (
      <div className="h-64 w-full animate-pulse bg-muted rounded" />
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-64 w-full flex items-center justify-center text-sm text-muted-foreground">
        No scenario data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <XAxis
          dataKey="label"
          stroke="var(--muted-foreground)"
          tick={{ fill: 'var(--muted-foreground)' }}
        />
        <YAxis
          stroke="var(--muted-foreground)"
          tick={{ fill: 'var(--muted-foreground)' }}
          tickFormatter={(value: number) => `$${value / 1000}k`}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          <LabelList
            dataKey="value"
            position="top"
            formatter={(value: unknown) => {
              const num = typeof value === 'number' ? value : 0;
              return `$${num / 1000}k`;
            }}
            fill="var(--foreground)"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
