'use client';

import { ActionCard } from '@/components/actions/action-card';
import type { ActionCardData } from '@/lib/actions/types';
import { TimelineChart, type TimelineDataPoint } from '@/components/charts/timeline-chart';

export interface RecoveryOption {
  id: string;
  label: string;
  description: string;
  daysChange: number;
  dollarsChange: number;
  impact: string;
}

export interface ProjectActionsProps {
  projectName: string;
  summary: string;
  selectedAction: ActionCardData | null;
  scheduleImpact: TimelineDataPoint[];
  recoveryOptions: RecoveryOption[];
  onActionApprove: (id: string) => void;
  onActionEdit: (id: string) => void;
  onActionDismiss: (id: string) => void;
  onRecoveryApprove: (optionId: string) => void;
}

export function ProjectActions({
  projectName,
  summary,
  selectedAction,
  scheduleImpact,
  recoveryOptions,
  onActionApprove,
  onActionEdit,
  onActionDismiss,
  onRecoveryApprove,
}: ProjectActionsProps) {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{projectName}</p>
        <h1 className="text-2xl font-bold text-foreground">{summary}</h1>
      </div>

      {!selectedAction ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">Select an action to see details</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <ActionCard
              data={selectedAction}
              onApprove={() => onActionApprove(selectedAction.id)}
              onEdit={() => onActionEdit(selectedAction.id)}
              onDismiss={() => onActionDismiss(selectedAction.id)}
            />
          </div>

          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-4">Schedule impact</h3>
              {scheduleImpact.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Link a schedule activity to see impact
                </p>
              ) : (
                <TimelineChart data={scheduleImpact} />
              )}
            </div>

            {recoveryOptions.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Recovery options</h3>
                <p className="text-xs text-muted-foreground">
                  Approve one or more, nothing is sent until you do
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {recoveryOptions.map((option) => (
                    <div
                      key={option.id}
                      className="bg-card border border-border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{option.label}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {option.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-medium ${
                            option.daysChange < 0
                              ? 'text-green-500'
                              : 'text-chart-at-risk'
                          }`}
                        >
                          {option.daysChange > 0 ? '+' : ''}
                          {option.daysChange} days · saves $
                          {Math.abs(option.dollarsChange / 100).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{option.impact}</p>
                      <button
                        onClick={() => onRecoveryApprove(option.id)}
                        className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors min-h-[44px]"
                      >
                        Approve & open in Outlook
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
