'use client';

import { LineChart, Line, ResponsiveContainer } from 'recharts';

export interface KpiSparklineData {
  value: number;
}

export interface KpiSparklineProps {
  data: KpiSparklineData[];
  color: string;
  isLoading?: boolean;
}

export function KpiSparkline({ data, color, isLoading }: KpiSparklineProps) {
  if (isLoading) {
    return (
      <div className="h-12 w-full animate-pulse bg-muted rounded" />
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-12 w-full flex items-center justify-center text-xs text-muted-foreground">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
