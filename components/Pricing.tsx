const phases = [
  {
    phase: "01",
    title: "Implementation setup",
    description:
      "A one-time engagement to map your workflows, stand up your private data environment and system-of-record ledger, and deliver your first production AI workflows.",
    includes: [
      "Workflow discovery with your team",
      "Private infrastructure & ledger setup",
      "Initial custom AI workflows shipped",
      "Integration with your existing tools",
      "Team onboarding & documentation",
    ],
  },
  {
    phase: "02",
    title: "Ongoing maintenance",
    description:
      "Our forward-deployed AI engineers remain at your service, building new workflows day by day, maintaining what ships, and responding when your process changes.",
    includes: [
      "24/7 AI engineer availability",
      "Continuous workflow iteration",
      "New automations as needs emerge",
      "Performance monitoring & optimization",
      "Security updates & compliance support",
    ],
  },
];

const pricingNotes = [
  { title: "Per seat", detail: "Aligned to the people who use the system" },
  { title: "Per usage", detail: "You pay for what runs" },
  { title: "No platform tax", detail: "Built for you, not thousands of other firms" },
];

export function Pricing() {
  return (
    <section id="pricing" className="section-light">
      <div className="mx-auto max-w-[1400px] px-6 py-20 lg:px-10 lg:py-24">
        <div className="grid gap-px bg-gray-200 lg:grid-cols-2 lg:grid-rows-[auto_auto_auto_auto]">
          {phases.map((item) => (
            <div
              key={item.phase}
              className="bg-white p-10 lg:row-span-4 lg:grid lg:grid-rows-subgrid lg:gap-y-0 lg:p-12"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-400">
                Phase {item.phase}
              </p>
              <h3 className="mt-4 text-2xl font-medium tracking-tight">{item.title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-gray-600">{item.description}</p>
              <ul className="mt-8 space-y-3 border-t border-gray-200 pt-8">
                {item.includes.map((line, i) => (
                  <li key={line} className="flex gap-4 text-sm text-gray-700">
                    <span className="font-mono text-gray-400">{String(i + 1).padStart(2, "0")}</span>
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
            Request a proposal
          </a>
          <p className="text-sm text-gray-500">
            Every engagement is scoped to your operation.
          </p>
        </div>
      </div>
    </section>
  );
}
