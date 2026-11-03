import { DataFitQuiz } from "@/components/data-fit/DataFitQuiz";

const reassurances = [
  "No AI knowledge needed",
  "No files or client names",
  "See the result before contact info",
];

export function FitCheckSection() {
  return (
    <section id="data-fit" className="section-light scroll-mt-24 border-t border-gray-200">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="section-label mb-6">Start here</p>
            <h2 className="headline-sm">Is yours the good stuff the labs are looking for?</h2>
            <p className="mt-6 text-base leading-relaxed text-gray-600">
              Answer 8 plain-English questions about what you have, whether it is yours to
              discuss, and whether anything sensitive needs to stay out. You will get a clear
              next step before entering any contact details.
            </p>
            <ul className="mt-8 divide-y divide-gray-200 border-y border-gray-200">
              {reassurances.map((item, i) => (
                <li key={item} className="flex items-center gap-4 py-4 text-sm font-medium text-gray-700">
                  <span className="font-mono text-[11px] text-gray-400">{String(i + 1).padStart(2, "0")}</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <DataFitQuiz
              origin="home-fit-check"
              returnHref="/#data-fit"
              returnLabel="Close the fit check"
              startLabel="Start the 8 questions"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
