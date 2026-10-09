'use client';

import { KpiSparkline, type KpiSparklineData } from '@/components/charts/kpi-sparkline';
import { ActionCard } from '@/components/actions/action-card';
import type { ActionCardData } from '@/lib/actions/types';

export interface KpiData {
  label: string;
  value: string;
  subtitle: string;
  trend: KpiSparklineData[];
  color: string;
}

export interface CommandCenterProps {
  greeting: string;
  summary: string;
  kpis: KpiData[];
  actions: ActionCardData[];
  onActionApprove: (id: string) => void;
  onActionEdit: (id: string) => void;
  onActionDismiss: (id: string) => void;
}

export function CommandCenter({
  greeting,
  summary,
  kpis,
  actions,
  onActionApprove,
  onActionEdit,
  onActionDismiss,
}: CommandCenterProps) {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{greeting}</p>
        <h1 className="text-3xl font-bold text-foreground">{summary}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-card border border-border rounded-lg p-4 space-y-2"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {kpi.label}
            </p>
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            <p className="text-xs text-green-500">{kpi.subtitle}</p>
            <KpiSparkline data={kpi.trend} color={kpi.color} />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Top actions across your portfolio</h2>
          <span className="text-sm text-muted-foreground">Ranked by dollars at risk</span>
        </div>

        {actions.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground">
              Connect a project mailbox to see actions
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {actions.map((action) => (
              <ActionCard
                key={action.id}
                data={action}
                onApprove={() => onActionApprove(action.id)}
                onEdit={() => onActionEdit(action.id)}
                onDismiss={() => onActionDismiss(action.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
