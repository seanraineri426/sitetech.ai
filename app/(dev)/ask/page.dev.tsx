'use client';

import { AppShell } from '@/components/shell/app-shell';
import { AskSiteTech } from '@/components/screens/ask-sitetech';
import { AskBar } from '@/components/shell/ask-bar';
import {
  askAnswerFixture,
  recentQuestionsFixture,
} from '@/tests/fixtures/ask-sitetech-data';

export default function AskSiteTechPreview() {
  return (
    <>
      <AppShell currentPath="/ask">
        <AskSiteTech
          answer={askAnswerFixture}
          recentQuestions={recentQuestionsFixture}
          onAsk={(q) => console.log('Ask:', q)}
        />
      </AppShell>
      <AskBar onAsk={(q) => console.log('Ask:', q)} />
    </>
  );
}
