const steps = [
  {
    num: "01",
    title: "Discover",
    description:
      "We sit with your team, not in a conference room but at their desks. We watch how work actually flows: the spreadsheets, the email chains, the approvals that take three days.",
  },
  {
    num: "02",
    title: "Design",
    description:
      "We identify the highest-leverage workflows and design custom AI around your standards, templates, and business rules. No feature bloat. Just what moves the needle.",
  },
  {
    num: "03",
    title: "Build & embed",
    description:
      "Our forward-deployed AI engineers ship working software into your environment, integrated with Procore, Yardi, Salesforce, SharePoint, or whatever you already use.",
  },
  {
    num: "04",
    title: "Iterate daily",
    description:
      "Your process evolves. So do we. Our AI engineers stay embedded, refining workflows day by day as your team uses them in production.",
  },
];

const contrasts = [
  { label: "Generic SaaS", value: "Built for the average customer" },
  { label: "Consulting firms", value: "Roadmaps, then handoff" },
  { label: "SiteTech AI", value: "Embedded AI engineers who ship and stay", highlight: true },
];

export function Approach() {
  return (
    <section id="approach" className="section-light">
      <div className="mx-auto max-w-[1400px] px-6 py-24 lg:px-10 lg:py-32">
        <div className="grid gap-20 lg:grid-cols-2 lg:gap-24">
          <div>
            <p className="section-label mb-6">Approach</p>
            <h2 className="headline-sm">
              Forward-deployed AI engineers. Not a help desk.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-gray-600">
              These are our own software engineers who build AI systems, not the
              structural or civil kind. They embed inside your operation and write
              the code that runs your workflows. They own the system, not a ticket queue.
              When a workflow breaks at 2 AM before a bid deadline, someone who built it
              is available.
            </p>

            <div className="mt-12 border border-gray-200">
              {contrasts.map((row, i) => (
                <div
                  key={row.label}
                  className={`grid grid-cols-[140px_1fr] gap-4 px-6 py-4 text-sm ${
                    i > 0 ? "border-t border-gray-200" : ""
                  } ${row.highlight ? "bg-black text-white" : ""}`}
                >
                  <span className={`font-mono text-[11px] uppercase tracking-wider ${row.highlight ? "text-gray-400" : "text-gray-500"}`}>
                    {row.label}
                  </span>
                  <span className={row.highlight ? "text-white" : "text-gray-700"}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {steps.map((step) => (
              <div key={step.num} className="py-10 first:pt-0 last:pb-0">
                <p className="font-mono text-sm text-gray-400">{step.num}</p>
                <h3 className="mt-3 text-xl font-medium tracking-tight">{step.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
