import type { Metadata } from "next";
import { PageHeader } from "@/components/marketing/PageHeader";
import { CTA } from "@/components/marketing/CTA";
import { Reveal } from "@/components/marketing/Reveal";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "SiteTech's implementation methodology: workflow assessment, AI architecture, implementation, and managed AI infrastructure — with least-privilege access and human approval gates.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How It Works | SiteTech AI",
    description:
      "From workflow assessment to managed AI infrastructure — how SiteTech designs, deploys, and operates AI agents inside real estate companies.",
    url: "https://sitetech.ai/how-it-works",
    type: "website",
  },
};

const stages = [
  {
    num: "01",
    title: "Workflow Assessment",
    intro: "We interview your team and map how work actually moves through the organization.",
    items: [
      "Employee interviews & workflow mapping",
      "Systems and data inventory",
      "Repetitive work & bottleneck identification",
      "Prioritized automation roadmap",
    ],
  },
  {
    num: "02",
    title: "AI Architecture",
    intro: "The system around the agent is designed before anything is built.",
    items: [
      "Integration methods per system",
      "Least-privilege permissions",
      "Human approval points",
      "Model selection per task",
    ],
  },
  {
    num: "03",
    title: "Implementation",
    intro: "Working systems shipped into your environment, connected to your tools.",
    items: [
      "Integrations & AI agents built",
      "Automations, prompts & knowledge sources",
      "Dashboards where they help",
      "Onboarding & documentation",
    ],
  },
  {
    num: "04",
    title: "Managed AI Infrastructure",
    intro: "The engagement doesn't end at launch — this is the core of what we sell.",
    items: [
      "Monitoring & troubleshooting",
      "Continuous improvement & new use cases",
      "Employee training",
      "Integration updates & value measurement",
    ],
  },
];

const oversight = [
  {
    title: "Least-privilege access",
    detail: "Agents receive only the data and actions their workflow requires — defined up front, enforced technically.",
  },
  {
    title: "Human approval gates",
    detail: "Investment decisions, applicant eligibility, legal notices, payments, and contracts route through people.",
  },
  {
    title: "Data boundaries",
    detail: "Your data stays in your environment and is never used to train models for anyone else.",
  },
  {
    title: "Auditability",
    detail: "Where supported, agent actions are logged against a record you can review — what was read, drafted, sent, and approved.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="relative">
      <PageHeader
        label="How It Works"
        title="From workflow assessment to managed AI infrastructure."
        description="SiteTech is not a tool you buy and configure yourself. We map your work, design the system, deploy the agents, and stay — operating your AI infrastructure over time."
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
          <div className="space-y-0 divide-y divide-gray-200 border-y border-gray-200">
            {stages.map((stage) => (
              <div key={stage.num} className="grid gap-8 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:py-16">
                <div>
                  <p className="font-mono text-sm text-gray-500">{stage.num}</p>
                  <h2 className="mt-3 text-2xl font-medium tracking-tight lg:text-3xl">
                    {stage.title}
                  </h2>
                  <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-600">
                    {stage.intro}
                  </p>
                </div>
                <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
                  {stage.items.map((item) => (
                    <li key={item} className="flex gap-4 text-sm leading-relaxed text-gray-700">
                      <span aria-hidden className="mt-[10px] h-px w-5 shrink-0 bg-gray-300" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="section-dark-solid scroll-mt-24 border-t border-white/10">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
          <div className="max-w-2xl">
            <p className="section-label mb-6">Security & oversight</p>
            <h2 className="headline-sm text-white">
              AI should automate work, not remove accountability.
            </h2>
          </div>

          <div className="mt-14 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {oversight.map((item, i) => (
              <div key={item.title} className="bg-black p-8">
                <p className="font-mono text-[11px] text-gray-500">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-4 text-base font-medium tracking-tight text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-400">{item.detail}</p>
              </div>
            ))}
          </div>

          <p className="mt-14 max-w-3xl border-t border-white/10 pt-10 text-base leading-relaxed text-gray-400">
            SiteTech is model-agnostic by design: each task routes to the model that
            fits the job, the policy, and the cost profile. You buy implementation
            expertise — not access to a particular model.
          </p>
        </div>
      </section>

      <Reveal>
        <CTA
          title="Start with a workflow assessment."
          body="We'll interview your team, map how work moves today, and identify where AI agents can eliminate repetitive work — with a fixed-scope proposal before anything is built."
        />
      </Reveal>
    </main>
  );
}
