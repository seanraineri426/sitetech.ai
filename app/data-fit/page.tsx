import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { DataFitQuiz } from "@/components/data-fit/DataFitQuiz";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Could your files be worth money?",
  description:
    "Answer 8 plain-English questions to see whether your company's plans, photos, schedules, and records could lead to an AI licensing conversation. No uploads, no client names, no obligation.",
  alternates: { canonical: "/data-fit" },
  openGraph: {
    title: "Could your files be worth money? | SiteTech AI",
    description:
      "8 quick questions. No files uploaded. See your result before deciding whether to contact SiteTech.",
    url: `${SITE_URL}/data-fit`,
    type: "website",
  },
};

export default function DataFitPage() {
  return (
    <main className="relative">
      <PageHeader
        label="Start here"
        title="Is yours the good stuff?"
        description="Answer 8 plain-English questions. You'll see a clear result before entering any contact details—and you never upload a file."
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-12 sm:py-16 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-3xl">
            <DataFitQuiz origin="data-fit-page" autoStart returnHref="/" returnLabel="Return to the homepage" />
          </div>
        </div>
      </section>
    </main>
  );
}
