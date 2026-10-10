import type { Metadata } from "next";
import { PageHeader } from "@/components/marketing/PageHeader";
import { Pricing } from "@/components/marketing/Pricing";
import { Contact } from "@/components/marketing/Contact";
import { Reveal } from "@/components/marketing/Reveal";

export const metadata: Metadata = {
  title: "Engagement",
  description:
    "Start with a fixed-scope AI workflow assessment, move to implementation, and continue with managed AI infrastructure — operated and expanded by SiteTech AI engineers.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Engagement | SiteTech AI",
    description:
      "Assessment, implementation, and managed AI infrastructure for real estate companies.",
    url: "https://sitetech.ai/pricing",
    type: "website",
  },
};

export default function PricingPage() {
  return (
    <main className="relative">
      <PageHeader
        label="Engagement"
        title="Assessment first. Then implementation. Then we stay."
        description="SiteTech sells outcomes, not licenses: a fixed-scope workflow assessment, a defined implementation, and ongoing managed AI infrastructure."
      />
      <Reveal>
        <Pricing />
      </Reveal>
      <Reveal>
        <Contact />
      </Reveal>
    </main>
  );
}
