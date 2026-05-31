const pains = [
  {
    num: "01",
    title: "Generic software doesn't fit",
    description:
      "Off-the-shelf tools are built for the average firm. Your approvals, deal memos, RFIs, and underwriting models don't match, and your team bends around the software.",
  },
  {
    num: "02",
    title: "No one owns AI internally",
    description:
      "Your best people are already running the business. Asking them to also architect AI workflows isn't a strategy. It's a distraction from the work that matters.",
  },
  {
    num: "03",
    title: "Data trust is non-negotiable",
    description:
      "Deal pipelines, cap rates, drawings, and tenant data can't live in consumer chatbots. You need enterprise-grade security with a ledger you can audit.",
  },
];

export function Problem() {
  return (
    <section className="section-light">
      <div className="mx-auto max-w-[1400px] px-6 py-24 lg:px-10 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="section-label mb-6">The problem</p>
            <h2 className="headline-sm">
              You see what AI could do. You can&apos;t get there with a vendor demo.
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {pains.map((pain) => (
              <div key={pain.num} className="grid gap-6 py-10 first:pt-0 last:pb-0 sm:grid-cols-[80px_1fr]">
                <p className="font-mono text-sm text-gray-400">{pain.num}</p>
                <div>
                  <h3 className="text-xl font-medium tracking-tight">{pain.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-gray-600">{pain.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
