'use client';

import { AppShell } from '@/components/shell/app-shell';
import { CommandCenter } from '@/components/screens/command-center';
import { AskBar } from '@/components/shell/ask-bar';

export default function Home() {
  return (
    <>
      <AppShell currentPath="/command-center">
        <CommandCenter
          greeting="Friday, October 9"
          summary="Welcome to SiteTech"
          kpis={[]}
          actions={[]}
          onActionApprove={() => {}}
          onActionEdit={() => {}}
          onActionDismiss={() => {}}
        />
      </AppShell>
      <AskBar onAsk={() => {}} />
    </>
  );
}
