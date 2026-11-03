import { DataFitQuiz } from "@/components/data-fit/DataFitQuiz";

export function FitCheckSection() {
  return (
    <section id="data-fit" className="section-light scroll-mt-24 border-t border-gray-200">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="section-label mb-6">Find your starting point</p>
            <h2 className="headline-sm">Could your company&apos;s records be relevant?</h2>
            <p className="mt-6 text-base leading-relaxed text-gray-600">
              Answer eight short questions for an initial guide to your next step. You&apos;ll see
              the result before deciding whether to contact SiteTech.
            </p>
          </div>

          <div className="min-w-0">
            <DataFitQuiz origin="home-fit-check" returnHref="/#data-fit" returnLabel="Close the fit check" />
          </div>
        </div>
      </div>
    </section>
  );
}
