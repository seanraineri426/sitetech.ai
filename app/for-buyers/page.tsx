import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { InquiryForm } from "@/components/data-fit/InquiryForm";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "For buyers & licensing partners",
  description:
    "Start a partner conversation about relevant introductions to built-environment businesses exploring permitted AI data opportunities.",
  alternates: { canonical: "/for-buyers" },
  openGraph: {
    title: "For buyers & licensing partners | SiteTech AI",
    description:
      "Tell SiteTech about your organization and the high-level categories you are interested in discussing.",
    url: `${SITE_URL}/for-buyers`,
    type: "website",
  },
};

export default function ForBuyersPage() {
  return (
    <main className="relative">
      <PageHeader
        label="Buyers & partners"
        title="Work with SiteTech on relevant introductions."
        description="We welcome conversations with AI data buyers and licensing partners interested in permitted records from the built environment. Tell us about your organization and the high-level categories you are interested in discussing."
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
            <div className="lg:sticky lg:top-32 lg:self-start">
              <p className="section-label mb-6">How introductions work</p>
              <ul className="divide-y divide-gray-200 border-y border-gray-200">
                {[
                  "Businesses describe record categories at a high level—not underlying files.",
                  "A specific introduction requires the company's approval and identifies the proposed recipient.",
                  "Dataset evaluation and any licensing transaction are handled directly between the parties.",
                  "Any referral arrangement is agreed separately and clarified before an introduction.",
                ].map((item, i) => (
                  <li key={item} className="grid gap-4 py-5 sm:grid-cols-[48px_1fr]">
                    <span className="font-mono text-[11px] text-gray-500">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm leading-relaxed text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="min-w-0">
              <InquiryForm
                inquiryType="buyer_partner"
                quiz={null}
                ctaOrigin="for-buyers-page"
                heading="Start a partner conversation"
                intro="Describe your organization and the high-level categories you are interested in discussing. Please keep confidential requirements and underlying materials out of this form."
                allowNote
                noteLabel="High-level categories of interest (optional)"
                submitLabel="Start a partner conversation"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
