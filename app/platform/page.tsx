import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Compounding } from "@/components/Compounding";
import { Approach } from "@/components/Approach";
import { Integrations } from "@/components/Integrations";
import { Security } from "@/components/Security";
import { CTA } from "@/components/CTA";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Platform",
  description:
    "A governed operating layer for real estate and construction AI agents, with a private project map, system-of-record ledger, interoperability, and forward-deployed AI engineers.",
  alternates: { canonical: "/platform" },
  openGraph: {
    title: "Platform | SiteTech AI",
    description:
      "A governed operating layer for real estate and construction AI agents, with a private project map, system-of-record ledger, and forward-deployed AI engineers.",
    url: "https://sitetech.ai/platform",
    type: "website",
  },
};

export default function PlatformPage() {
  return (
    <main className="relative">
      <PageHeader
        label="Platform"
        title="The operating layer beneath every agent."
        description="A private project map, a system-of-record ledger, deep interoperability with existing tools, model evaluations, and forward-deployed AI engineers who keep the system aligned to your operations."
      />
      <Reveal>
        <Compounding />
      </Reveal>
      <Reveal>
        <Approach />
      </Reveal>
      <Reveal>
        <Integrations />
      </Reveal>
      <Reveal>
        <Security />
      </Reveal>
      <Reveal>
        <CTA />
      </Reveal>
    </main>
  );
}
