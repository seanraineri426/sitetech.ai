import { notFound } from 'next/navigation';
import { PreviewClient } from './preview-client.dev';

export default function PreviewPage() {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DESIGN_PREVIEW !== '1') {
    notFound();
  }

  return <PreviewClient />;
}
