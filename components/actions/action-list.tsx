'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { ActionCard } from './action-card';
import type { ActionCardData } from '@/lib/actions/types';

interface ActionListProps {
  actions?: ActionCardData[];
  loading?: boolean;
  error?: string | null;
  projectName?: string;
  onApprove: (actionId: string) => void;
  onEdit: (actionId: string) => void;
  onDismiss: (actionId: string) => void;
}

function ActionCardSkeleton() {
  return (
    <Card className="w-full">
      <div className="p-6 space-y-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-20 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-11 flex-1" />
          <Skeleton className="h-11 flex-1" />
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ projectName }: { projectName?: string }) {
  return (
    <Card className="w-full">
      <CardContent className="py-12 text-center">
        <p className="text-lg text-muted-foreground">
          Nothing needs you today{projectName ? ` on ${projectName}` : ''}.
        </p>
      </CardContent>
    </Card>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <Card className="w-full border-destructive">
      <CardContent className="py-8 text-center space-y-2">
        <p className="text-lg font-semibold text-destructive">Error loading actions</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </CardContent>
    </Card>
  );
}

export function ActionList({
  actions,
  loading = false,
  error = null,
  projectName,
  onApprove,
  onEdit,
  onDismiss,
}: ActionListProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <ActionCardSkeleton />
        <ActionCardSkeleton />
        <ActionCardSkeleton />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (!actions || actions.length === 0) {
    return <EmptyState projectName={projectName} />;
  }

  return (
    <div className="space-y-4">
      {actions.map((action) => (
        <ActionCard
          key={action.id}
          data={action}
          onApprove={() => onApprove(action.id)}
          onEdit={() => onEdit(action.id)}
          onDismiss={() => onDismiss(action.id)}
        />
      ))}
    </div>
  );
}
