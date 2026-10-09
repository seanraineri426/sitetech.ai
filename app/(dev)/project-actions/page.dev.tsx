'use client';

import { AppShell } from '@/components/shell/app-shell';
import { ProjectActions } from '@/components/screens/project-actions';
import { AskBar } from '@/components/shell/ask-bar';
import {
  projectActionFixture,
  scheduleImpactFixture,
  recoveryOptionsFixture,
} from '@/tests/fixtures/project-actions-data';

export default function ProjectActionsPreview() {
  return (
    <>
      <AppShell currentPath="/actions">
        <ProjectActions
          projectName="Harbor Point Residences · 212 units · GC: Example Builders"
          summary="Actions · 5 open · $302k at risk"
          selectedAction={projectActionFixture}
          scheduleImpact={scheduleImpactFixture}
          recoveryOptions={recoveryOptionsFixture}
          onActionApprove={(id) => console.log('Approve:', id)}
          onActionEdit={(id) => console.log('Edit:', id)}
          onActionDismiss={(id) => console.log('Dismiss:', id)}
          onRecoveryApprove={(id) => console.log('Recovery approve:', id)}
        />
      </AppShell>
      <AskBar onAsk={(q) => console.log('Ask:', q)} />
    </>
  );
}
