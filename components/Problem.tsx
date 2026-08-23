const pains = [
  {
    num: "01",
    title: "Deals die in inboxes",
    description:
      "The OM that sat unread for four days. The broker who stopped calling. The parcel that went to the competitor who moved first. No system flagged any of it — because no system saw it.",
  },
  {
    num: "02",
    title: "Small delays become expensive ones",
    description:
      "An RFI that ages into a claim. A recertification that becomes a compliance finding. A week of vacancy compounding into real carry. The cost is never visible until it's large.",
  },
  {
    num: "03",
    title: "Your best people are the glue",
    description:
      "Your development associate re-checks municipal portals. Your property manager chases the same document for three weeks. Your analyst rebuilds the same report every month. And when they leave, the process leaves with them.",
  },
];

export function Problem() {
  return (
    <section className="section-light">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="section-label mb-6">The problem</p>
            <h2 className="headline-sm">
              Your software isn&apos;t the problem. What falls between it is.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-gray-600">
              Every handoff between systems is a place work stalls, documents
              disappear, and deadlines slip. It doesn&apos;t show up on a dashboard.
              It shows up later — as a claim, a finding, or a lost deal.
            </p>
          </div>

          <div>
            <div className="divide-y divide-gray-200">
              {pains.map((pain) => (
                <div key={pain.num} className="grid gap-6 py-10 first:pt-0 sm:grid-cols-[80px_1fr]">
                  <p className="font-mono text-sm text-gray-500">{pain.num}</p>
                  <div>
                    <h3 className="text-xl font-medium tracking-tight">{pain.title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-gray-600">{pain.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="border-t border-gray-200 pt-10 text-xl font-medium leading-snug tracking-tight text-black">
              Meanwhile, the firms connecting their systems are compounding the
              advantage.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
