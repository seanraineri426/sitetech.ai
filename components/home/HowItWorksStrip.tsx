import Link from "next/link";

const steps = [
  { num: "01", title: "Workflow Assessment", detail: "We map how work actually moves through your organization." },
  { num: "02", title: "AI Architecture", detail: "Systems, permissions, models, and human approvals — designed up front." },
  { num: "03", title: "Implementation", detail: "Integrations, agents, and workflows shipped into your environment." },
  { num: "04", title: "Managed Infrastructure", detail: "We monitor, improve, and expand your AI layer as an ongoing service." },
];

export function HowItWorksStrip() {
  return (
    <section className="section-light border-t border-gray-200">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="section-label mb-6">How it works</p>
            <h2 className="headline-sm">
              From assessment to managed AI infrastructure.
            </h2>
          </div>
          <Link href="/how-it-works" className="link-arrow shrink-0 text-black">
            See how SiteTech works
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-14 grid gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.num} className="bg-white p-8">
              <p className="font-mono text-[11px] text-gray-500">{step.num}</p>
              <h3 className="mt-4 text-base font-medium tracking-tight">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
