const steps = [
  {
    num: "01",
    title: "Map the operation",
    detail:
      "We learn how decisions actually move through your firm: people, systems, approvals, data sources, and handoffs.",
  },
  {
    num: "02",
    title: "Connect the record",
    detail:
      "We create a governed operating layer across your project data, deal files, documents, and existing software.",
  },
  {
    num: "03",
    title: "Deploy the agents",
    detail:
      "We build workflow-specific AI systems that read context, prepare work, route outputs, and preserve traceability.",
  },
  {
    num: "04",
    title: "Stay embedded",
    detail:
      "Our AI engineers monitor, improve, and extend the system as your business changes and model capability improves.",
  },
];

export function DeploymentModel() {
  return (
    <section className="section-dark-solid border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div>
            <p className="section-label mb-6">How we deploy</p>
            <h2 className="headline-sm text-white">
              Not a demo environment. A system installed into your operating reality.
            </h2>
            <p className="body-lg mt-6">
              SiteTech AI builds and maintains private, workflow-specific AI systems for
              real estate and construction firms. We do not drop off software and leave.
              We install the operating layer, then stay close as the work changes.
            </p>
          </div>

          <div className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2">
            {steps.map((step) => (
              <div key={step.num} className="bg-black p-8 lg:p-10">
                <p className="font-mono text-[11px] text-gray-600">{step.num}</p>
                <h3 className="mt-4 text-lg font-medium tracking-tight text-white">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
