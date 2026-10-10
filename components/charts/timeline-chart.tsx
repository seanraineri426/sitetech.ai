'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';

export interface TimelineDataPoint {
  activity: string;
  start: number;
  duration: number;
  isSlipped?: boolean;
  isBaseline?: boolean;
}

export interface TimelineChartProps {
  data: TimelineDataPoint[];
  isLoading?: boolean;
}

export function TimelineChart({ data, isLoading }: TimelineChartProps) {
  if (isLoading) {
    return (
      <div className="h-64 w-full animate-pulse bg-muted rounded" />
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-64 w-full flex items-center justify-center text-sm text-muted-foreground">
        No schedule data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
      >
        <XAxis type="number" stroke="var(--muted-foreground)" />
        <YAxis
          type="category"
          dataKey="activity"
          stroke="var(--muted-foreground)"
          width={90}
        />
        <Bar dataKey="duration" stackId="a">
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.isSlipped
                  ? 'var(--chart-at-risk)'
                  : entry.isBaseline
                  ? 'var(--chart-amber)'
                  : 'var(--chart-protected)'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
