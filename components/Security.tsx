const commitments = [
  {
    num: "01",
    title: "System-of-record ledger",
    description:
      "Every action, decision, and data transformation is logged in an auditable ledger you control. Not a black box, but a traceable system of record.",
  },
  {
    num: "02",
    title: "Isolated environments",
    description:
      "Your data is kept in its own isolated environment. What we learn working with you stays with you, and nothing you share is used to train models for anyone else.",
  },
  {
    num: "03",
    title: "Enterprise-grade AI",
    description:
      "No consumer chatbots on your deal data. Enterprise-tier models, contractual controls, and private handling of sensitive inputs.",
  },
  {
    num: "04",
    title: "Encryption & access",
    description:
      "Data encrypted at rest and in transit. Role-based access aligned to your org. VPC and on-prem deployment available.",
  },
  {
    num: "05",
    title: "Contractual commitments",
    description:
      "NDA before we see a single file. Data retention and deletion policies in writing. Security answers in your contract.",
  },
  {
    num: "06",
    title: "Human-in-the-loop",
    description:
      "AI handles the repetitive work. Your team approves what matters. Guardrails and decision points where humans stay in control.",
  },
];

export function Security() {
  return (
    <section id="security" className="section-dark-solid border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.4fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="section-label mb-6">Security</p>
            <h2 className="headline-sm">
              Your data. Your ledger. Your rules.
            </h2>
            <p className="body-lg mt-6">
              Every firm asks the same question first: what happens to our data?
              We answer in contracts, not concepts.
            </p>
          </div>

          <div className="grid gap-px bg-white/10 sm:grid-cols-2">
            {commitments.map((item) => (
              <div key={item.num} className="bg-black p-8 lg:p-10">
                <p className="font-mono text-[11px] text-gray-600">{item.num}</p>
                <h3 className="mt-4 text-lg font-medium tracking-tight">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
