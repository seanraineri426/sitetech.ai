import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Pricing } from "@/components/Pricing";
import { Contact } from "@/components/Contact";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Priced per seat and per usage, with a setup fee to get you live and ongoing maintenance from forward-deployed AI engineers.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing | SiteTech AI",
    description:
      "Priced per seat and per usage, with a setup fee to get you live and ongoing maintenance from forward-deployed AI engineers.",
    url: "https://sitetech.ai/pricing",
    type: "website",
  },
};

export default function PricingPage() {
  return (
    <main className="relative">
      <PageHeader
        label="Engagement"
        title="Priced for your team. Your usage. Your workflow."
        description="A setup fee to get you live, then an ongoing maintenance fee so our forward-deployed AI engineers never leave your side."
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
