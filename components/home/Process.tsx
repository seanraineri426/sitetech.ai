import { BUYER_TYPES_SOFT } from "@/lib/doors";

const processSteps = [
  {
    num: "01",
    title: "Choose a door",
    detail:
      "License records you already keep, or explore first-person footage of field work for robotics training programs.",
  },
  {
    num: "02",
    title: "Describe the fit",
    detail:
      "Answer a few high-level questions. For records, you can unlock a modeled estimate. Nothing uploads through this site.",
  },
  {
    num: "03",
    title: "Consider a specific introduction",
    detail:
      "If a relevant opportunity is available, SiteTech asks for your permission before introducing your business to an AI lab or data partner.",
  },
  {
    num: "04",
    title: "Evaluate directly",
    detail:
      "You and the counterparty discuss scope, terms, and compensation. You decide whether to proceed.",
  },
];

const controlPoints = [
  "No document uploads or software connections through this site.",
  "A specific introduction requires your approval.",
  "Any arrangement is discussed directly with the counterparty.",
];

export function Process() {
  return (
    <section id="how" className="section-dark-solid scroll-mt-24 border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
        <p className="section-label mb-6">How it works</p>
        <h2 className="headline-sm max-w-3xl text-white">
          Two doors. One introduction role.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-400">
          {BUYER_TYPES_SOFT}
        </p>

        <div className="mt-12 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {processSteps.map((step) => (
            <div key={step.num} className="bg-black p-8">
              <p className="font-mono text-[11px] text-gray-500">{step.num}</p>
              <h3 className="mt-4 text-base font-medium tracking-tight text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">{step.detail}</p>
            </div>
          ))}
        </div>

        <ul className="mt-10 grid gap-4 border-t border-white/10 pt-8 sm:grid-cols-3">
          {controlPoints.map((point) => (
            <li key={point} className="flex gap-3 text-sm leading-relaxed text-gray-300">
              <span aria-hidden className="mt-[9px] h-px w-5 shrink-0 bg-gold" />
              {point}
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-gray-500">
          SiteTech&apos;s role is the introduction. You decide what to share and which terms to accept. We earn
          a referral fee only when an eligible introduction leads to an arrangement, under a separate agreement
          with the buyer or partner.
        </p>
      </div>
    </section>
  );
}
