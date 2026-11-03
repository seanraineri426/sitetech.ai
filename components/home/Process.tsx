import Link from "next/link";

export const processSteps = [
  {
    num: "01",
    title: "Tell us what you have—in plain categories",
    detail:
      "Answer 8 questions about the kinds of files your company has. Do not upload files or name clients.",
  },
  {
    num: "02",
    title: "We review the starting point",
    detail:
      "Your answers show whether there is a clear set to discuss or whether permission questions need to be sorted first.",
  },
  {
    num: "03",
    title: "You approve any introduction",
    detail:
      "If a buyer conversation may make sense, we tell you who it is. Nothing about your company is shared until you say yes.",
  },
  {
    num: "04",
    title: "You talk money and terms directly",
    detail:
      "You and the buyer discuss price, allowed use, exclusivity, and timing. If you do not like the offer, you walk away.",
  },
];

export const processSupportingLine =
  "SiteTech makes the introduction. We do not take your files, set your price, or decide for you.";

export function Process() {
  return (
    <section id="process" className="section-dark-solid scroll-mt-24 border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="section-label mb-6">How it works</p>
            <h2 className="headline-sm text-white">
              Four steps. No disruption to your business.
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
          <Link href="/for-buyers" className="shrink-0 text-sm text-gray-500 underline-offset-4 hover:text-white hover:underline">
            Are you an AI lab or data buyer?
          </Link>
        </div>
      </div>
    </section>
  );
}
