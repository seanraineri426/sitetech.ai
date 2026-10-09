import { notFound } from 'next/navigation';
import { ActionList } from '@/components/actions/action-list';
import { allActionFixtures } from '@/tests/fixtures/action-card-data';

export default function PreviewPage() {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DESIGN_PREVIEW !== '1') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-4">Action Card Preview</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Design preview for M2 action cards
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Loaded State</h2>
          <ActionList
            actions={allActionFixtures}
            projectName="Linden Yard"
            onApprove={(id) => console.log('Approve:', id)}
            onEdit={(id) => console.log('Edit:', id)}
            onDismiss={(id) => console.log('Dismiss:', id)}
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Loading State</h2>
          <ActionList
            loading
            onApprove={() => {}}
            onEdit={() => {}}
            onDismiss={() => {}}
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Empty State</h2>
          <ActionList
            actions={[]}
            projectName="Linden Yard"
            onApprove={() => {}}
            onEdit={() => {}}
            onDismiss={() => {}}
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Error State</h2>
          <ActionList
            error="Failed to connect to the server"
            onApprove={() => {}}
            onEdit={() => {}}
            onDismiss={() => {}}
          />
        </section>
      </div>
    </div>
  );
}
