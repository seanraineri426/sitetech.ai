const layers = [
  {
    num: "01",
    title: "Project map",
    detail:
      "A typed map of projects, parcels, contracts, budgets, schedules, scopes, people, decisions, and approvals.",
  },
  {
    num: "02",
    title: "Agent runtime",
    detail:
      "Specialized agents read the operating layer, call approved tools, draft outputs, and escalate decisions that need human approval.",
  },
  {
    num: "03",
    title: "System-of-record ledger",
    detail:
      "Important actions, transformations, approvals, and model outputs are written back to a traceable record.",
  },
  {
    num: "04",
    title: "Interoperability layer",
    detail:
      "Connectors built on each system's API and exports to move data between tools like Procore, Autodesk, Yardi, Salesforce, SharePoint, Microsoft 365, and firm-specific systems.",
  },
  {
    num: "05",
    title: "Evals and controls",
    detail:
      "Workflows are tested against your documents, policies, permissions, and edge cases before stronger models are promoted.",
  },
  {
    num: "06",
    title: "Forward deployment",
    detail:
      "SiteTech AI engineers build, ship, monitor, and iterate the workflows alongside your team.",
  },
];

export function PlatformStack() {
  return (
    <section className="section-dark-solid border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.4fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="section-label mb-6">Platform</p>
            <h2 className="headline-sm text-white">
              An operational foundation for human and AI teams.
            </h2>
            <p className="body-lg mt-6">
              The objective is not a chatbot beside your business. It is a governed
              operating layer where agents can understand the entities, constraints,
              permissions, and actions that make real estate work real.
            </p>
            <a href="/platform" className="link-arrow mt-8 text-gray-300 hover:text-white">
              View the platform
              <span aria-hidden>→</span>
            </a>
          </div>

          <div className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2">
            {layers.map((layer) => (
              <div key={layer.num} className="bg-black p-8 lg:p-10">
                <p className="font-mono text-[11px] text-gray-600">{layer.num}</p>
                <h3 className="mt-4 text-lg font-medium tracking-tight text-white">
                  {layer.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">
                  {layer.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
