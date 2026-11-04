import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { DataFitQuiz } from "@/components/data-fit/DataFitQuiz";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Check your data fit",
  description:
    "Answer eight short questions for an initial guide to your next step. No document uploads. No obligation. Enter your email at the end to unlock a modeled value and your next step.",
  alternates: { canonical: "/data-fit" },
  openGraph: {
    title: "Check your data fit | SiteTech AI",
    description:
      "Eight short questions. No document uploads. Enter your email at the end to unlock a modeled value.",
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
        description="Answer eight short questions for an initial guide to your next step. Your email unlocks a modeled value and your next step at the end."
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-12 sm:py-16 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-3xl">
            <DataFitQuiz
              origin="data-fit-page"
              autoStart
              returnHref="/"
              returnLabel="Return to the homepage"
              startLabel="Start the fit check"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
