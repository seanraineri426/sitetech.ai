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
    "Start with 8 questions, approve any introduction, and talk terms directly with an AI lab, data buyer, or licensing partner. No uploads and no disruption to your business.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How it works | SiteTech AI",
    description:
      "You describe what you have. SiteTech explores the conversation. You approve every next step.",
    url: `${SITE_URL}/how-it-works`,
    type: "website",
  },
};

const stageDetails: Record<string, string[]> = {
  "01": [
    "8 questions in plain English",
    "Kinds of files only—no documents or passwords",
    "Your result appears before contact details",
    "Contacting SiteTech is always optional",
  ],
  "02": [
    "What kinds of records you have and roughly how many projects they cover",
    "Whether you believe outside use is allowed",
    "Anything private or restricted that must stay out",
    "Simple questions to check inside your company",
  ],
  "03": [
    "Only if a relevant opportunity may exist",
    "SiteTech tells you who the buyer is first",
    "Nothing is shared until you specifically say yes",
    "No automatic introductions",
  ],
  "04": [
    "The buyer explains what it wants to evaluate",
    "You discuss price, allowed use, exclusivity, and timing",
    "Your lawyer can review any proposed agreement",
    "You sign only if the deal makes sense",
  ],
};

const roles = [
  {
    title: "What SiteTech does",
    items: [
      "Helps you describe what kinds of records you have",
      "Explores whether an AI lab or licensing partner may want to talk",
      "Explains the proposed introduction before it happens",
      "Makes the introduction only after you approve it",
    ],
  },
  {
    title: "What SiteTech does not do",
    items: [
      "Buy your records or become the buyer",
      "Promise a price or guarantee a deal",
      "Negotiate your licensing terms for you",
      "Take, clean, process, or anonymize your files",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <main className="relative">
      <PageHeader
        label="How it works"
        title="From 8 questions to a decision you control."
        description={processSupportingLine}
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
          <div className="space-y-0 divide-y divide-gray-200 border-y border-gray-200">
            {processSteps.map((stage) => (
              <div key={stage.num} className="grid gap-8 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:py-16">
                <div>
                  <p className="font-mono text-sm text-gray-500">{stage.num}</p>
                  <h2 className="mt-3 text-2xl font-medium tracking-tight lg:text-3xl">{stage.title}</h2>
                  <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-600">{stage.detail}</p>
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
            <h2 className="headline-sm text-white">We open the door. You decide whether to walk through it.</h2>
            <p className="body-lg mt-6">
              SiteTech may earn a referral fee on eligible introductions under separate
              agreements with buyers or partners. We explain that before an introduction.
              We do not set the price for your records or negotiate your deal.
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
              Having a file does not automatically mean you can license it. Keep client-owned
              or restricted material out until the right permission is clear.
            </p>
            <Link href="/for-buyers" className="shrink-0 text-sm text-gray-500 underline-offset-4 hover:text-white hover:underline">
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
