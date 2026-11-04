import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { CTA } from "@/components/CTA";
import { Reveal } from "@/components/Reveal";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Previous services",
  description:
    "SiteTech previously offered AI implementation services for real estate companies. Those services are no longer offered. SiteTech now helps built-environment businesses explore AI data licensing introductions.",
  alternates: { canonical: "/solutions" },
  robots: { index: false, follow: true },
  openGraph: {
    title: "Previous services | SiteTech AI",
    description: "SiteTech's AI implementation services are no longer offered.",
    url: `${SITE_URL}/solutions`,
    type: "website",
  },
};

const retired = [
  "AI workflow assessments",
  "AI agent design, deployment, and managed infrastructure",
  "Acquisitions, development, construction, and brokerage workflow automation",
  "Property management and affordable housing lease-up tooling",
  "Software integrations (Procore, Yardi, OneSite, and others)",
];

export default function PreviousServicesPage() {
  return (
    <main className="relative">
      <PageHeader
        label="Previous services"
        title="SiteTech no longer offers AI implementation services."
        description="This page is kept so that older links still land somewhere accurate. SiteTech's current focus is helping real estate and built-environment businesses explore potential AI data licensing introductions."
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 lg:px-10 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
            <div>
              <p className="section-label mb-6">What was offered</p>
              <ul className="divide-y divide-gray-200 border-y border-gray-200">
                {retired.map((item) => (
                  <li key={item} className="py-4 text-sm leading-relaxed text-gray-700">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="section-label mb-6">What SiteTech does now</p>
              <p className="text-base leading-relaxed text-gray-700">
                SiteTech helps businesses across the built environment find out whether the
                records they already create (plans, imagery, equipment and building records,
                company-created research) could be relevant to an AI data buyer, and facilitates
                a permitted introduction when one makes sense. The business decides on any
                introduction and discusses terms directly with the counterparty.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-gray-500">
                Articles published during the earlier period remain available on the{" "}
                <Link href="/blog" className="underline underline-offset-4">
                  blog
                </Link>{" "}
                for reference.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                <Link href="/data-fit" className="btn-primary">
                  Check your data fit
                </Link>
                <Link href="/how-it-works" className="link-arrow text-black">
                  See how it works
                  <span aria-hidden>→</span>
                </Link>
              </div>
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
