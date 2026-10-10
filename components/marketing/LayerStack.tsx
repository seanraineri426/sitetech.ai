const layers = [
  {
    label: "Your existing software",
    detail: "Outlook · Excel · Procore · Yardi · SharePoint · Granola",
    highlight: false,
  },
  {
    label: "SiteTech integration + AI layer",
    detail: "APIs, MCP, webhooks, and secure custom workflows — evaluated for your environment.",
    highlight: true,
  },
  {
    label: "Specialized AI agents",
    detail: "Acquisitions · Development · Construction · Leasing · Brokerage · Property management · Finance",
    highlight: false,
  },
  {
    label: "Automated workflows",
    detail: "Work moves between systems without re-keying or chasing.",
    highlight: false,
  },
  {
    label: "Human review",
    detail: "Approvals, eligibility, payments, and judgment stay with your team.",
    highlight: false,
  },
  {
    label: "Business outcome",
    detail: "Faster decisions, clean records, fewer surprises.",
    highlight: false,
  },
];

export function LayerStack() {
  return (
    <section className="section-dark-solid border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="section-label mb-6">The SiteTech layer</p>
            <h2 className="headline-sm text-white">
              We don&apos;t replace your software. We connect it — and add intelligence across it.
            </h2>
            <p className="body-lg mt-6">
              SiteTech sits above your existing stack. Agents read from your systems,
              move work between them, and surface what needs a person.
            </p>
          </div>

          <div>
            {layers.map((layer, i) => (
              <div key={layer.label}>
                <div
                  className={`border px-6 py-5 lg:px-8 ${
                    layer.highlight
                      ? "border-white bg-white text-black"
                      : "border-white/15 bg-black"
                  }`}
                >
                  <p
                    className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
                      layer.highlight ? "text-gray-600" : "text-gray-500"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <p
                    className={`mt-1.5 text-base font-medium tracking-tight ${
                      layer.highlight ? "text-black" : "text-white"
                    }`}
                  >
                    {layer.label}
                  </p>
                  <p
                    className={`mt-1 text-sm leading-relaxed ${
                      layer.highlight ? "text-gray-600" : "text-gray-500"
                    }`}
                  >
                    {layer.detail}
                  </p>
                </div>
                {i < layers.length - 1 && (
                  <div aria-hidden className="flex justify-center py-1">
                    <span className="leading-none text-gray-500">↓</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
