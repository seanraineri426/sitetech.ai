import type { Metadata } from "next";
import { PageHeader } from "@/components/marketing/PageHeader";
import { CTA } from "@/components/marketing/CTA";
import { Reveal } from "@/components/marketing/Reveal";

export const metadata: Metadata = {
  title: "Integrations",
  description:
    "SiteTech connects the software real estate teams already use — Microsoft 365, Google Workspace, Procore, Yardi, RealPage, Salesforce, and custom systems — via APIs, MCP, webhooks, and secure custom workflows.",
  alternates: { canonical: "/integrations" },
  openGraph: {
    title: "Integrations | SiteTech AI",
    description:
      "SiteTech sits above your existing stack. We evaluate the best connection method for each client's software environment.",
    url: "https://sitetech.ai/integrations",
    type: "website",
  },
};

const categories = [
  {
    title: "Workplace",
    tools: ["Outlook", "Excel", "Teams", "SharePoint", "OneDrive", "Google Workspace", "Gmail", "Sheets"],
  },
  {
    title: "Real Estate & Construction",
    tools: ["Procore", "Bluebeam", "Autodesk Construction Cloud", "Yardi", "MRI", "RealPage", "Prophetic", "GatherGov"],
  },
  {
    title: "Meetings & CRM",
    tools: ["Granola", "Zoom", "Google Meet", "Salesforce", "HubSpot", "DealCloud"],
  },
  {
    title: "Documents & Projects",
    tools: ["DocuSign", "Dropbox", "Box", "Notion", "Monday", "Asana"],
  },
];

const methods = [
  {
    title: "APIs & native integrations",
    detail: "Where a platform exposes a supported API, we build on it directly.",
  },
  {
    title: "MCP connections",
    detail: "Structured, permissioned access for agents to connected tools.",
  },
  {
    title: "Webhooks & automation platforms",
    detail: "Event-driven connections that move work the moment something changes.",
  },
  {
    title: "Controlled browser workflows",
    detail: "For systems without APIs — including municipal portals — supervised automation within defined boundaries.",
  },
  {
    title: "Custom systems",
    detail: "Databases and internal software connected through secure custom work.",
  },
];

export default function IntegrationsPage() {
  return (
    <main className="relative">
      <PageHeader
        label="Integrations"
        title="Built to sit above the software you already run."
        description="SiteTech evaluates native integrations, APIs, MCP connections, webhooks, automation platforms, and secure custom workflows depending on your technology environment — then connects what makes sense."
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
          <div className="space-y-14">
            {categories.map((category) => (
              <div key={category.title} className="grid gap-6 lg:grid-cols-[0.3fr_1fr] lg:gap-12">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500 lg:pt-1">
                  {category.title}
                </p>
                <div className="grid grid-cols-2 gap-px border border-gray-200 bg-gray-200 sm:grid-cols-3 lg:grid-cols-4">
                  {category.tools.map((tool) => (
                    <div
                      key={tool}
                      className="flex items-center justify-center bg-white px-4 py-6 text-center text-sm font-medium tracking-tight text-gray-700"
                    >
                      {tool}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-14 max-w-2xl text-xl font-medium leading-snug tracking-tight text-black">
            If your software has data your team uses, SiteTech can evaluate how it can
            become part of an AI workflow.
          </p>
          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-gray-500">
            Product names are trademarks of their respective owners and represent the
            types of systems SiteTech evaluates as connection targets. Mention does not
            imply partnership, endorsement, or certified native integration.
          </p>
        </div>
      </section>

      <section className="section-dark-solid border-t border-white/10">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
          <div className="max-w-2xl">
            <p className="section-label mb-6">How we connect</p>
            <h2 className="headline-sm text-white">
              The right connection method for each system.
            </h2>
          </div>

          <div className="mt-14 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
            {methods.map((method, i) => (
              <div key={method.title} className="bg-black p-8">
                <p className="font-mono text-[11px] text-gray-500">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-4 text-base font-medium tracking-tight text-white">{method.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-400">{method.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Reveal>
        <CTA
          title="Bring us your stack."
          body="Tell us what your team runs on today. In a workflow assessment, we'll map the systems, the data, and the connection methods that make AI workflows possible in your environment."
        />
      </Reveal>
    </main>
  );
}
