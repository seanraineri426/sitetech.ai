const phases = [
  {
    phase: "01",
    title: "Workflow Assessment",
    description:
      "A fixed-scope engagement to map how work moves through your organization and identify where AI agents pay for themselves.",
    includes: [
      "Employee interviews & workflow mapping",
      "Systems and data inventory",
      "Prioritized automation roadmap",
      "Fixed-scope implementation proposal",
    ],
  },
  {
    phase: "02",
    title: "Implementation",
    description:
      "Your first production AI workflows — integrations, agents, and automations — built into your environment.",
    includes: [
      "Integrations with your existing systems",
      "Specialized AI agents deployed",
      "Workflow automations & routines",
      "Team onboarding & documentation",
    ],
  },
  {
    phase: "03",
    title: "Managed AI Infrastructure",
    description:
      "SiteTech operates and expands your AI layer as an ongoing service, as your operation evolves.",
    includes: [
      "Workflow monitoring & troubleshooting",
      "Continuous improvement & new use cases",
      "Employee training",
      "Integration updates & value measurement",
    ],
  },
];

const pricingNotes = [
  { title: "Fixed-scope assessment", detail: "Know the cost before anything is built" },
  { title: "Per seat & per usage", detail: "Aligned to the people and volume that use it" },
  { title: "No platform tax", detail: "Built for you, not thousands of other firms" },
];

export function Pricing() {
  return (
    <section id="pricing" className="section-light">
      <div className="mx-auto max-w-[1400px] px-6 py-16 lg:px-10 lg:py-24">
        <div className="grid gap-px bg-gray-200 lg:grid-cols-3">
          {phases.map((item) => (
            <div key={item.phase} className="flex flex-col bg-white p-10 lg:p-12">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
                Phase {item.phase}
              </p>
              <h3 className="mt-4 text-2xl font-medium tracking-tight">{item.title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-gray-600">{item.description}</p>
              <ul className="mt-8 flex-1 space-y-3 border-t border-gray-200 pt-8">
                {item.includes.map((line, i) => (
                  <li key={line} className="flex gap-4 text-sm text-gray-700">
                    <span className="font-mono text-gray-500">{String(i + 1).padStart(2, "0")}</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 grid border border-gray-200 sm:grid-cols-3">
          {pricingNotes.map((note, i) => (
            <div
              key={note.title}
              className={`px-8 py-6 ${i > 0 ? "border-t border-gray-200 sm:border-t-0 sm:border-l" : ""}`}
            >
              <p className="text-sm font-medium">{note.title}</p>
              <p className="mt-1 text-sm text-gray-500">{note.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
          <a href="#contact" className="btn-primary">
            Book an AI Workflow Assessment
          </a>
          <p className="text-sm text-gray-500">
            Every engagement is scoped to your operation.
          </p>
        </div>
      </div>
    </section>
  );
}
