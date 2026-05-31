import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Industries } from "@/components/Industries";
import { Workflows } from "@/components/Workflows";
import { CTA } from "@/components/CTA";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Use Cases",
  description:
    "Agentic AI use cases for real estate development, construction, brokerages, appraisal, and private equity.",
  alternates: { canonical: "/workflows" },
  openGraph: {
    title: "Use Cases | SiteTech AI",
    description:
      "Agentic AI use cases for real estate development, construction, brokerages, appraisal, and private equity.",
    url: "https://sitetech.ai/workflows",
    type: "website",
  },
};

const services = [
  {
    name: "AI for Real Estate Development",
    description:
      "Agentic systems for entitlement tracking, budget variance, schedule risk, capital partner reporting, and consultant coordination.",
  },
  {
    name: "AI for General Construction",
    description:
      "AI workflows for RFI and submittal control, bid leveling, change order triage, pay app reconciliation, and field progress intelligence.",
  },
  {
    name: "AI for Real Estate Brokerage",
    description:
      "AI agents for parcel intelligence, owner outreach, comp set building, listing materials, and pipeline prioritization.",
  },
  {
    name: "AI for Private Equity Real Estate",
    description:
      "Controlled AI systems for diligence, underwriting support, portfolio operations, covenant monitoring, and LP reporting.",
  },
  {
    name: "AI for Real Estate Appraisal",
    description:
      "Valuation workflows for comparable analysis, adjustment grid drafting, property data extraction, market analysis, and USPAP-aware review.",
  },
];

const servicesSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: services.map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": "Service",
      name: s.name,
      description: s.description,
      serviceType: "AI implementation",
      provider: { "@type": "Organization", name: "SiteTech AI", url: "https://sitetech.ai" },
      areaServed: "US",
    },
  })),
};

export default function WorkflowsPage() {
  return (
    <main className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(servicesSchema) }}
      />
      <PageHeader
        label="Use cases"
        title="Operational AI for the built world."
        description="Agentic workflows for the decisions that move projects, sites, parcels, contracts, capital, and portfolios. Connected to your tools. Governed by your rules. Written back to your ledger."
      />
      <Reveal>
        <Industries />
      </Reveal>
      <Reveal>
        <Workflows />
      </Reveal>
      <Reveal>
        <CTA />
      </Reveal>
    </main>
  );
}
