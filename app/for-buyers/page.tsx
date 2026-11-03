import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { InquiryForm } from "@/components/data-fit/InquiryForm";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "For AI labs, data buyers, and licensing partners",
  description:
    "Tell SiteTech what broad kinds of real-world built-environment records you want to discuss. Introductions happen only with the record owner's approval.",
  alternates: { canonical: "/for-buyers" },
  openGraph: {
    title: "For AI labs, data buyers, and licensing partners | SiteTech AI",
    description: "Start a conversation about relevant, owner-approved introductions.",
    url: `${SITE_URL}/for-buyers`,
    type: "website",
  },
};

export default function ForBuyersPage() {
  return (
    <main className="relative">
      <PageHeader
        label="AI labs, buyers & partners"
        title="Looking for real-world records from the built environment?"
        description="Tell us about your organization and the broad categories you want to discuss. SiteTech can explore whether an owner-approved introduction makes sense."
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
            <div className="lg:sticky lg:top-32 lg:self-start">
              <p className="section-label mb-6">How introductions work</p>
              <ul className="divide-y divide-gray-200 border-y border-gray-200">
                {[
                  "Businesses describe only the kinds of records they have—not the records themselves.",
                  "The owner must approve a specific introduction before SiteTech shares its inquiry with you.",
                  "You handle rights confirmation, evaluation, de-identification, secure transfer, and training-ready preparation directly with the owner under contract.",
                  "Any referral arrangement is agreed separately and explained before an introduction.",
                ].map((item, i) => (
                  <li key={item} className="grid gap-4 py-5 sm:grid-cols-[48px_1fr]">
                    <span className="font-mono text-[11px] text-gray-500">{String(i + 1).padStart(2, "0")}</span>
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
                heading="Start a conversation"
                intro="Describe your organization and the broad categories you want to discuss. Please keep confidential requirements and underlying materials out of this form."
                allowNote
                noteLabel="What kinds of records are you interested in? (optional)"
                submitLabel="Start a conversation"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
