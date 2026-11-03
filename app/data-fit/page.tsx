import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { DataFitQuiz } from "@/components/data-fit/DataFitQuiz";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Data fit check",
  description:
    "Eight short questions to find out whether your company's project and operating records could be a starting point for an AI data licensing conversation. No uploads, no obligation.",
  alternates: { canonical: "/data-fit" },
  openGraph: {
    title: "Data fit check | SiteTech AI",
    description:
      "Eight short questions. No document uploads. See your result before deciding whether to contact SiteTech.",
    url: `${SITE_URL}/data-fit`,
    type: "website",
  },
};

export default function DataFitPage() {
  return (
    <main className="relative">
      <PageHeader
        label="Find your starting point"
        title="Could your company's records be relevant?"
        description="Answer eight short questions for an initial guide to your next step. You'll see the result before deciding whether to contact SiteTech."
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
