import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/marketing/PageHeader";
import { SolutionBlock, type SolutionWorkflow } from "@/components/marketing/SolutionBlock";
import { CTA } from "@/components/marketing/CTA";
import { Reveal } from "@/components/marketing/Reveal";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "AI agents and automated workflows for real estate acquisitions, development and entitlements, construction, leasing, property management, affordable housing, asset management, and finance.",
  alternates: { canonical: "/solutions" },
  openGraph: {
    title: "Solutions | SiteTech AI",
    description:
      "AI agents and automated workflows for every department that moves a real asset.",
    url: "https://sitetech.ai/solutions",
    type: "website",
  },
};

const anchors = [
  { href: "#acquisitions", label: "Acquisitions" },
  { href: "#development", label: "Development" },
  { href: "#construction", label: "Construction" },
  { href: "#leasing", label: "Leasing" },
  { href: "#brokerage", label: "Brokerage" },
  { href: "#asset-management", label: "Asset Management" },
  { href: "#finance", label: "Finance" },
  { href: "#executive", label: "Executive" },
];

const acquisitions: SolutionWorkflow[] = [
  {
    title: "Deal intake",
    description:
      "A broker email or OM becomes a structured opportunity: property identified, documents saved, follow-ups created.",
  },
  {
    title: "Preliminary deal screening",
    description:
      "First-pass research against your criteria — property records, market data, zoning — summarized with risks and open questions.",
  },
  {
    title: "Parcel & municipal intelligence",
    description:
      "Qualifying parcels and planning activity matched to your targets, delivered as ranked alerts instead of portal-checking.",
  },
];

const development: SolutionWorkflow[] = [
  {
    title: "Consultant commitment tracking",
    description:
      "\u201cWe\u2019ll submit revised drawings Friday\u201d becomes a tracked deliverable — owner, date, and a flag when it slips.",
  },
  {
    title: "Entitlement tracker",
    description:
      "Applications, hearings, municipal comments, deadlines, and revisions in one record instead of five inboxes.",
  },
  {
    title: "Project knowledge agent",
    description:
      "Ask across authorized meeting notes, reports, and contracts: what\u2019s holding up the project, what approvals remain.",
  },
];

const construction: SolutionWorkflow[] = [
  {
    title: "OAC meeting intelligence",
    description:
      "Every meeting becomes extracted actions, owners, and deadlines — cross-checked against the project record.",
  },
  {
    title: "RFI & submittal monitoring",
    description:
      "Aging, unanswered, and schedule-threatening items surfaced before they compound.",
  },
  {
    title: "Change order & pay app organization",
    description:
      "Costs, status, backup, and approvals tracked as one record. Financial review stays with your team.",
  },
];

const leasing: SolutionWorkflow[] = [
  {
    title: "Lead management",
    description:
      "Every inquiry captured, answered with approved information, and routed to staff with the details that matter.",
  },
  {
    title: "Follow-up monitoring",
    description:
      "Prospects without follow-up, tours without applications, and new availability matched to prior leads.",
  },
  {
    title: "Application workflow",
    description:
      "Documents organized, missing items flagged, approved reminders sent. Agents never approve or deny applicants.",
  },
];

const brokerage: SolutionWorkflow[] = [
  {
    title: "Owner outreach prep",
    description:
      "Parcel data, ownership history, and sale signals combined into targeted outreach — so every call starts with a reason.",
  },
  {
    title: "Comp set builder",
    description:
      "Sales, listings, rent comps, and location context pulled into a defensible set in minutes, not afternoons.",
  },
  {
    title: "Listing packet drafting",
    description:
      "Teasers, broker opinions, and property summaries drafted from raw deal files, ready for your polish.",
  },
];

const assetManagement: SolutionWorkflow[] = [
  {
    title: "Monthly reporting",
    description:
      "Property financials become variance analysis and a drafted narrative for your review.",
  },
  {
    title: "Portfolio exceptions",
    description:
      "\u201cWhich properties need attention?\u201d answered as a ranked list, not a stack of reports.",
  },
];

const finance: SolutionWorkflow[] = [
  {
    title: "Lender comparison",
    description:
      "Term sheets become a structured comparison: rate, proceeds, recourse, covenants, fees.",
  },
  {
    title: "Closing & draw tracking",
    description:
      "Checklists, backup, and lender requirements organized — missing items flagged before submission.",
  },
  {
    title: "Investor reporting",
    description:
      "Progress, budget, and milestones drafted into investor updates from authorized sources.",
  },
];

const executiveAnswers = [
  "Decisions required",
  "Projects at risk",
  "Overdue items",
  "Leasing bottlenecks",
  "Budget exceptions",
  "New opportunities",
];

export default function SolutionsPage() {
  return (
    <main className="relative">
      <PageHeader
        label="Solutions"
        title="AI agents for every department that moves a real asset."
        description="Each agent reads authorized data, automates the repetitive work between your tools, and surfaces what requires a person. A few examples:"
      />

      <div className="section-light border-b border-gray-200">
        <div className="mx-auto flex max-w-[1400px] flex-wrap gap-x-8 gap-y-3 px-6 py-6 lg:px-10">
          {anchors.map((a) => (
            <a key={a.href} href={a.href} className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500 transition-colors hover:text-black">
              {a.label}
            </a>
          ))}
        </div>
      </div>

      <SolutionBlock
        id="acquisitions"
        label="Acquisitions"
        title="From broker email to screened opportunity."
        description="Agents structure the intake and do the first-pass research, so your team starts from a shortlist."
        workflows={acquisitions}
      />

      <SolutionBlock
        id="development"
        label="Development & Entitlements"
        title="One record of every commitment and approval."
        description="Development runs across consultants, agencies, and lenders. SiteTech tracks who promised what, by when."
        workflows={development}
        dark
      />

      <SolutionBlock
        id="construction"
        label="Construction"
        title="Field-to-office intelligence, without the lag."
        description="Agents read your project platforms and meeting records to surface what needs attention today."
        workflows={construction}
      />

      <section className="section-dark-solid border-t border-white/10">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-20 lg:px-10 lg:py-28">
          <div>
            <p className="section-label mb-6">Property Management</p>
            <h2 className="headline-sm text-white">
              The highest-volume business in real estate gets its own page.
            </h2>
            <p className="body-lg mt-6">
              Resident communication, maintenance, vendors, and delinquency queues —
              where AI workflows pay for themselves fastest.
            </p>
            <Link href="/solutions/property-management" className="link-arrow mt-8 text-gray-300 hover:text-white">
              Explore property management
              <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="border border-white/10 p-8 lg:p-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
              Example output
            </p>
            <p className="mt-4 text-2xl font-medium leading-snug tracking-tight text-white">
              &ldquo;14 open work orders. 3 resident issues need you. 1 vendor COI
              expired.&rdquo;
            </p>
            <p className="mt-4 text-sm leading-relaxed text-gray-400">
              The property manager&apos;s morning, on one screen.
            </p>
          </div>
        </div>
      </section>

      <SolutionBlock
        id="leasing"
        label="Leasing"
        title="Every prospect followed up. Every application moving."
        description="From first inquiry to signed lease, agents keep leads answered and applications complete."
        workflows={leasing}
      />

      <SolutionBlock
        id="brokerage"
        label="Brokerage"
        title="Sharper reasons to call, faster materials to send."
        description="Agents handle the research and assembly work, so brokers spend their time on relationships and deals."
        workflows={brokerage}
        dark
      />

      <section className="section-dark-solid border-t border-white/10">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-20">
            <div>
              <p className="section-label mb-6">Affordable Housing</p>
              <h2 className="headline-sm text-white">
                The most documentation-heavy workflow in housing, handled with care.
              </h2>
              <p className="body-lg mt-6">
                Verification, lotteries, voucher coordination, recertification — a
                specialization we build for deliberately, with qualified humans always
                holding eligibility authority.
              </p>
              <Link href="/solutions/affordable-housing" className="link-arrow mt-8 text-gray-300 hover:text-white">
                Explore affordable housing
                <span aria-hidden>→</span>
              </Link>
            </div>
            <div className="border border-white/10 p-8 lg:p-10">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
                Lease-up command center
              </p>
              <p className="mt-4 text-2xl font-medium leading-snug tracking-tight text-white">
                &ldquo;Top 10 items preventing lease-up today.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      <SolutionBlock
        id="asset-management"
        label="Asset Management"
        title="Ranked exceptions instead of a stack of reports."
        description="Agents read operating and financial reporting across the portfolio and surface what needs attention."
        workflows={assetManagement}
      />

      <SolutionBlock
        id="finance"
        label="Finance & Capital Markets"
        title="From term sheets to draws to investor updates."
        description="Capital work runs on checklists and documentation. Agents keep the record organized; your team keeps the judgment."
        workflows={finance}
        dark
      />

      <section id="executive" className="section-light scroll-mt-24 border-t border-gray-200">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
          <div className="grid gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-24">
            <div>
              <p className="section-label mb-6">Executive Intelligence</p>
              <h2 className="headline-sm">
                &ldquo;What changed across the portfolio this week?&rdquo;
              </h2>
              <p className="mt-6 text-base leading-relaxed text-gray-600">
                One briefing, pulled from permitted information across your email,
                meetings, project platforms, and financial reporting.
              </p>
              <p className="mt-6 text-xl font-medium leading-snug tracking-tight text-black">
                Stop searching across ten systems to understand your company.
              </p>
            </div>
            <div className="border border-gray-200 bg-gray-50 p-8 lg:p-10">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
                One briefing answers
              </p>
              <ul className="mt-6 space-y-4">
                {executiveAnswers.map((item, i) => (
                  <li key={item} className="flex gap-4 text-sm text-gray-700">
                    <span className="font-mono text-gray-500">{String(i + 1).padStart(2, "0")}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Reveal>
        <CTA />
      </Reveal>
    </main>
  );
}
