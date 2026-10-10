import type { Metadata } from "next";
import { PageHeader } from "@/components/marketing/PageHeader";
import { BriefCard } from "@/components/marketing/BriefCard";
import { WorkflowFlow } from "@/components/marketing/WorkflowFlow";
import { CTA } from "@/components/marketing/CTA";
import { Reveal } from "@/components/marketing/Reveal";

export const metadata: Metadata = {
  title: "AI Workflows for Affordable Housing",
  description:
    "AI workflows for affordable housing leasing and compliance: applicant documentation, verification tracking, voucher coordination, lease-up reporting, and recertification — with eligibility decisions under qualified human review.",
  alternates: { canonical: "/solutions/affordable-housing" },
  openGraph: {
    title: "AI Workflows for Affordable Housing | SiteTech AI",
    description:
      "Applicant documentation, verification tracking, lease-up command center, and recertification workflows for affordable housing teams.",
    url: "https://sitetech.ai/solutions/affordable-housing",
    type: "website",
  },
};

const leasingWorkflows = [
  {
    title: "Lead intake & document collection",
    description:
      "Captures household interest and tracks every required document — IDs, income, benefits, assets, tax forms — with approved reminders for what\u2019s missing.",
  },
  {
    title: "Application completeness",
    description:
      "Every application categorized: complete, incomplete, awaiting documents, awaiting verification, awaiting agency response, or ready for staff review.",
  },
  {
    title: "Income verification workflow",
    description:
      "Documents classified, mapped to the right household member, missing information identified — prepared as a summary for human compliance review.",
  },
  {
    title: "Third-party verification tracking",
    description:
      "Employer, asset, benefit, and landlord verifications monitored — stale or unanswered requests flagged automatically.",
  },
  {
    title: "Lottery, waitlist & voucher coordination",
    description:
      "Intake, document status, appointment scheduling, referrals, inspection scheduling, and subsidy paperwork tracked across PBV, Section 8, and voucher programs.",
  },
  {
    title: "Compliance communication drafting",
    description:
      "Standardized missing-document requests, appointment reminders, and deadline notices — drafted for staff to review and send.",
  },
];

const operationsWorkflows = [
  {
    title: "Annual recertification",
    description:
      "Upcoming recerts, outreach, submitted and missing documents, verifications, and deadlines — tracked months before they become emergencies.",
  },
  {
    title: "Compliance exception reporting",
    description:
      "\u201c17 recertifications due within 60 days. 6 households haven\u2019t submitted documents. 4 files await verification.\u201d — before your week starts.",
  },
  {
    title: "Audit preparation",
    description:
      "Searchable documentation indexes and missing-file flags before internal or external compliance reviews.",
  },
];

const agentsDo = [
  "Organize documents, applications, and files",
  "Track verifications, deadlines, and agency responses",
  "Draft approved communications for staff review",
  "Identify missing information and surface exceptions",
];

const humansKeep = [
  "Eligibility and income determinations",
  "Applicant approval, denial, and prioritization",
  "Legal and compliance-sensitive communications",
  "Final certification and reporting sign-off",
];

export default function AffordableHousingPage() {
  return (
    <main className="relative">
      <PageHeader
        label="Affordable Housing"
        title="AI workflows for affordable housing leasing and compliance."
        description="Affordable leasing carries substantially more administrative complexity than conventional leasing. SiteTech organizes the documentation, verification, and agency coordination — while eligibility and compliance decisions remain with qualified staff."
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
          <div className="max-w-2xl">
            <p className="section-label mb-6">Leasing workflows</p>
            <h2 className="headline-sm">
              From first inquiry to approved move-in, nothing falls through.
            </h2>
          </div>

          <div className="mt-14 grid gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3">
            {leasingWorkflows.map((wf) => (
              <div key={wf.title} className="bg-white p-8">
                <h3 className="text-base font-medium tracking-tight">{wf.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{wf.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-dark-solid border-t border-white/10">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
          <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-24">
            <div>
              <p className="section-label mb-6">Lease-Up Command Center</p>
              <h2 className="headline-sm text-white">
                Every morning, the ten things standing between you and stabilized.
              </h2>
              <p className="body-lg mt-6">
                During lease-up, the bottleneck moves daily. The command center watches
                applications, documents, verifications, agency actions, and unit
                readiness — and tells leadership exactly where to push today.
              </p>
            </div>

            <BriefCard
              dark
              label="Example output"
              title="Lease-up status — this morning"
              lines={[
                { label: "Applications received", value: "312" },
                { label: "Incomplete", value: "88", flag: true },
                { label: "Awaiting third-party verification", value: "21", flag: true },
                { label: "Ready for staff review", value: "39" },
                { label: "Awaiting agency action", value: "17" },
                { label: "Move-ins scheduled (14 days)", value: "12" },
              ]}
              footer="Top bottleneck today: 21 files waiting on verification — 9 are over 10 days old. Draft follow-ups are ready for review."
            />
          </div>

          <div className="mt-16 border-t border-white/10 pt-14">
            <WorkflowFlow
              dark
              title="Affordable lease-up — end to end"
              steps={[
                "Application received",
                "Documents classified",
                "Missing items flagged",
                "Verification tracked",
                "Compliance review queue",
                "Human approval",
                "Move-in coordination",
              ]}
              caption="The agent moves paper and tracks status. The compliance decision at the center of the flow belongs to your team."
            />
          </div>
        </div>
      </section>

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
          <div className="max-w-2xl">
            <p className="section-label mb-6">Ongoing operations</p>
            <h2 className="headline-sm">
              The work doesn&apos;t end at lease-up. Neither do the workflows.
            </h2>
          </div>

          <div className="mt-14 grid gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3">
            {operationsWorkflows.map((wf) => (
              <div key={wf.title} className="bg-white p-8">
                <h3 className="text-base font-medium tracking-tight">{wf.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{wf.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-dark-solid border-t border-white/10">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
          <div className="max-w-2xl">
            <p className="section-label mb-6">Human oversight</p>
            <h2 className="headline-sm text-white">
              AI does not determine eligibility. Period.
            </h2>
            <p className="body-lg mt-6">
              Agents assist the people who carry compliance responsibility — they never
              replace the determination itself.
            </p>
          </div>

          <div className="mt-14 grid gap-px border border-white/10 bg-white/10 lg:grid-cols-2">
            <div className="bg-black p-8 lg:p-10">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
                What agents do
              </p>
              <ul className="mt-6 space-y-4">
                {agentsDo.map((item) => (
                  <li key={item} className="flex gap-4 text-sm leading-relaxed text-gray-300">
                    <span aria-hidden className="mt-[10px] h-px w-5 shrink-0 bg-gray-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-black p-8 lg:p-10">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
                What qualified humans keep
              </p>
              <ul className="mt-6 space-y-4">
                {humansKeep.map((item) => (
                  <li key={item} className="flex gap-4 text-sm leading-relaxed text-gray-300">
                    <span aria-hidden className="mt-[10px] h-px w-5 shrink-0 bg-white" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Reveal>
        <CTA
          title="Lease-up faster, with the paperwork under control."
          body="Show us your leasing and compliance workflow. We'll map where agents can organize documentation, track verifications, and surface bottlenecks — with your team keeping every eligibility decision."
        />
      </Reveal>
    </main>
  );
}
