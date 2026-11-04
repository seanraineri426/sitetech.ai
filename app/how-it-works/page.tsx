import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { CTA } from "@/components/CTA";
import { Reveal } from "@/components/Reveal";
import { processSteps, processSupportingLine } from "@/components/home/Process";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Start with a high-level description of your records, clarify permissions, and explore whether a permitted introduction makes sense. SiteTech facilitates introductions only.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How it works | SiteTech AI",
    description:
      "Start with a description. Explore the opportunity from there. You approve any introduction.",
    url: `${SITE_URL}/how-it-works`,
    type: "website",
  },
};

const stageDetails: Record<string, string[]> = {
  "01": [
    "Eight short questions about your business and record categories",
    "No document uploads or software connections",
    "Your email unlocks the modeled result at the end",
    "Contacting SiteTech remains optional",
  ],
  "02": [
    "Collection categories and approximate coverage",
    "Self-reported permission readiness",
    "Sensitive or restricted content that should stay out of the inquiry",
    "Questions your organization may want to review internally",
  ],
  "03": [
    "Only if a relevant opportunity may be available",
    "SiteTech identifies the proposed recipient first",
    "Nothing is shared until you specifically approve",
    "No automatic introductions",
  ],
  "04": [
    "You and the counterparty discuss evaluation and terms",
    "Compensation and permitted use are negotiated directly",
    "You decide whether to proceed",
    "SiteTech does not set price or license terms",
  ],
};

const roles = [
  {
    title: "What SiteTech does",
    items: [
      "Helps interested businesses describe record categories at a high level",
      "Explores whether a relevant buyer or licensing partner may be worth approaching",
      "Asks for permission before any specific introduction",
      "Facilitates the introduction when approved",
    ],
  },
  {
    title: "What SiteTech does not do",
    items: [
      "Buy datasets or act as the licensing counterparty",
      "Determine dataset value or negotiate licensing terms",
      "Collect source documents or process datasets",
      "Anonymize records or operate a data marketplace",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <main className="relative">
      <PageHeader
        label="How it works"
        title="Start with a description. Explore the opportunity from there."
        description={processSupportingLine}
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
          <div className="space-y-0 divide-y divide-gray-200 border-y border-gray-200">
            {processSteps.map((stage) => (
              <div
                key={stage.num}
                className="grid gap-8 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:py-16"
              >
                <div>
                  <p className="font-mono text-sm text-gray-500">{stage.num}</p>
                  <h2 className="mt-3 text-2xl font-medium tracking-tight lg:text-3xl">
                    {stage.title}
                  </h2>
                  <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-600">
                    {stage.detail}
                  </p>
                </div>
                <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
                  {stageDetails[stage.num].map((item) => (
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

      <section id="role" className="section-dark-solid scroll-mt-24 border-t border-white/10">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
          <div className="max-w-2xl">
            <p className="section-label mb-6">SiteTech&apos;s role</p>
            <h2 className="headline-sm text-white">
              Introductions only. Your terms stay yours.
            </h2>
            <p className="body-lg mt-6">
              SiteTech&apos;s model is to receive referral fees on eligible introductions under
              separate agreements with buyers or partners. Any applicable referral arrangement
              is clarified before an introduction. We do not set the price or negotiate the
              terms of your data license.
            </p>
          </div>

          <div className="mt-14 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2">
            {roles.map((role) => (
              <div key={role.title} className="bg-black p-8">
                <h3 className="text-base font-medium tracking-tight text-white">{role.title}</h3>
                <ul className="mt-5 space-y-3">
                  {role.items.map((item) => (
                    <li key={item} className="flex gap-4 text-sm leading-relaxed text-gray-400">
                      <span aria-hidden className="mt-[10px] h-px w-5 shrink-0 bg-gray-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-10 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-3xl text-base leading-relaxed text-gray-400">
              Possessing a file does not establish permission to license it. Client material
              and licensed third-party content may require separate authorization.
            </p>
            <Link
              href="/for-buyers"
              className="shrink-0 text-sm text-gray-500 underline-offset-4 hover:text-white hover:underline"
            >
              Data buyer or licensing partner?
            </Link>
          </div>
        </div>
      </section>

      <Reveal>
        <CTA />
      </Reveal>
    </main>
  );
}
