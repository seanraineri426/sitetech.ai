import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/marketing/PageHeader";
import { BriefCard } from "@/components/marketing/BriefCard";
import { WorkflowFlow } from "@/components/marketing/WorkflowFlow";
import { CTA } from "@/components/marketing/CTA";
import { Reveal } from "@/components/marketing/Reveal";

export const metadata: Metadata = {
  title: "AI Automation for Property Management",
  description:
    "AI workflows for property management companies: resident communication, maintenance routing and pattern detection, vendor coordination, and daily exception briefs.",
  alternates: { canonical: "/solutions/property-management" },
  openGraph: {
    title: "AI Automation for Property Management | SiteTech AI",
    description:
      "Resident communication, maintenance workflows, vendor coordination, and daily exception briefs — AI agents for property management teams.",
    url: "https://sitetech.ai/solutions/property-management",
    type: "website",
  },
};

const workflows = [
  {
    title: "Resident communication",
    description:
      "Approved questions about policies, amenities, payments, and move-ins answered; anything sensitive drafted for staff. Escalation is the default.",
  },
  {
    title: "Maintenance pattern detection",
    description:
      "\u201cUnit 6B: four plumbing tickets in six months.\u201d Patterns surface before they become capital surprises.",
  },
  {
    title: "Vendor & invoice coordination",
    description:
      "Proposals organized, COIs and documents tracked, invoices matched to property and budget, duplicates checked. Payment authority stays with your team.",
  },
  {
    title: "Delinquency workflow",
    description:
      "Delinquency identified, communications organized, review queues prepared — escalating under your policies, never autonomously.",
  },
];

export default function PropertyManagementPage() {
  return (
    <main className="relative">
      <PageHeader
        label="Property Management"
        title="AI workflows for the highest-volume business in real estate."
        description="Property management runs on communication, recurring admin work, and exception handling — exactly where AI agents perform best. SiteTech deploys them across conventional, affordable, and mixed-income portfolios."
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
          <WorkflowFlow
            title="Maintenance — from resident request to resolution"
            steps={[
              "Resident submits issue",
              "AI categorizes + prioritizes",
              "Work order routed",
              "Resident acknowledged",
              "Resolution tracked",
              "Overdue escalated",
            ]}
            caption="Each category — plumbing, HVAC, electrical, elevators, emergencies — gets its own routing rules and urgency logic, tuned to your operation."
          />

          <div className="mt-14 grid gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-4">
            {workflows.map((wf) => (
              <div key={wf.title} className="bg-white p-8">
                <h3 className="text-base font-medium tracking-tight">{wf.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{wf.description}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-gray-500">
            SiteTech agents never make adverse housing decisions. Resident-sensitive
            matters are organized for staff review and handled under your policies.
          </p>
        </div>
      </section>

      <section className="section-dark-solid border-t border-white/10">
        <div className="mx-auto grid max-w-[1400px] gap-14 px-6 py-16 sm:py-20 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-24 lg:px-10 lg:py-32">
          <div>
            <p className="section-label mb-6">Example output</p>
            <h2 className="headline-sm text-white">
              The property manager&apos;s morning, on one screen.
            </h2>
            <p className="body-lg mt-6">
              Instead of opening five systems to figure out what matters, your team
              starts the day with the exceptions already assembled.
            </p>
            <p className="mt-6 text-base leading-relaxed text-gray-400">
              Managing affordable or mixed-income units? The same agents extend to
              recertifications and compliance queues.{" "}
              <Link href="/solutions/affordable-housing" className="text-white underline underline-offset-4 hover:opacity-70">
                See affordable housing workflows
              </Link>
              .
            </p>
          </div>

          <BriefCard
            dark
            label="Daily brief"
            title="Today at a glance"
            lines={[
              { label: "Open work orders", value: "14" },
              { label: "Work orders overdue", value: "3", flag: true },
              { label: "Resident issues requiring escalation", value: "3", flag: true },
              { label: "Leases expiring within 30 days", value: "2" },
              { label: "Vendor insurance certificates expired", value: "1", flag: true },
            ]}
            footer="Drafted resident follow-ups and vendor reminders are queued for staff review."
          />
        </div>
      </section>

      <Reveal>
        <CTA
          title="Give your property managers their mornings back."
          body="Show us how resident communication, maintenance, and vendor work move through your team today. We'll map where agents take the repetitive volume — and where staff stay in control."
        />
      </Reveal>
    </main>
  );
}
