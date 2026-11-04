import Link from "next/link";

export const processSteps = [
  {
    num: "01",
    title: "Tell us what your company holds",
    detail:
      "Answer a few questions about your business and the categories of records you may want to discuss.",
  },
  {
    num: "02",
    title: "Clarify the starting point",
    detail:
      "Your answers highlight the scope of the collection and any permissions your team may need to review.",
  },
  {
    num: "03",
    title: "Consider a specific introduction",
    detail:
      "If a relevant opportunity is available, SiteTech asks for your permission before introducing your business to a buyer or licensing partner.",
  },
  {
    num: "04",
    title: "Evaluate the opportunity directly",
    detail:
      "You and the counterparty discuss any evaluation, licensing terms, compensation, and permitted use. You decide whether to proceed.",
  },
];

export const processSupportingLine =
  "SiteTech's role is the introduction. Your business remains responsible for deciding what it can share and which terms it accepts.";

export function Process() {
  return (
    <section id="process" className="section-dark-solid scroll-mt-24 border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="section-label mb-6">How it works</p>
            <h2 className="headline-sm text-white">
              Start with a description. Explore the opportunity from there.
            </h2>
          </div>
          <Link href="/how-it-works" className="link-arrow shrink-0 text-gray-400">
            Read the full process
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-14 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {processSteps.map((step) => (
            <div key={step.num} className="bg-black p-8">
              <p className="font-mono text-[11px] text-gray-500">{step.num}</p>
              <h3 className="mt-4 text-base font-medium tracking-tight text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">{step.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-base leading-relaxed text-gray-400">{processSupportingLine}</p>
          <Link
            href="/for-buyers"
            className="shrink-0 text-sm text-gray-500 underline-offset-4 hover:text-white hover:underline"
          >
            Are you a data buyer or licensing partner?
          </Link>
        </div>
      </div>
    </section>
  );
}
