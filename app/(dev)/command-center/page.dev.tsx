'use client';

import { AppShell } from '@/components/shell/app-shell';
import { CommandCenter } from '@/components/screens/command-center';
import { AskBar } from '@/components/shell/ask-bar';
import { kpiFixtures, commandCenterActionsFixture } from '@/tests/fixtures/command-center-data';

export default function CommandCenterPreview() {
  return (
    <>
      <AppShell currentPath="/command-center">
        <CommandCenter
          greeting="Friday, October 9"
          summary="Good morning, Jordan. 14 actions need you across 4 projects."
          kpis={kpiFixtures}
          actions={commandCenterActionsFixture}
          onActionApprove={(id) => console.log('Approve:', id)}
          onActionEdit={(id) => console.log('Edit:', id)}
          onActionDismiss={(id) => console.log('Dismiss:', id)}
        />
      </AppShell>
      <AskBar onAsk={(q) => console.log('Ask:', q)} />
    </>
  );
}
