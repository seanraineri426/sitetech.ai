import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { InquiryForm } from "@/components/data-fit/InquiryForm";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Ask SiteTech a plain-English question about whether your company's records could lead to an AI licensing conversation.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact | SiteTech AI",
    description: "Still not sure how this works? Ask SiteTech.",
    url: `${SITE_URL}/contact`,
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <main className="relative">
      <PageHeader
        label="Contact"
        title="Still not sure? Ask us in plain English."
        description="Use this form if the idea makes sense but the details do not yet. If you already know what kinds of files your company has, the 8-question check is faster."
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
            <div className="lg:sticky lg:top-32 lg:self-start">
              <p className="section-label mb-6">Before you write</p>
              <ul className="divide-y divide-gray-200 border-y border-gray-200">
                {[
                  "Do not send file contents, client details, resident information, or passwords.",
                  "Asking a question does not share anything with a buyer or partner.",
                  "SiteTech cannot price your records or tell you what the law allows—only where to start.",
                ].map((item, i) => (
                  <li key={item} className="grid gap-4 py-5 sm:grid-cols-[48px_1fr]">
                    <span className="font-mono text-[11px] text-gray-500">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-sm leading-relaxed text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/data-fit" className="link-arrow mt-8 text-black">
                See if my files could be worth money
                <span aria-hidden>→</span>
              </Link>
            </div>

            <div className="min-w-0">
              <InquiryForm
                inquiryType="process_question"
                quiz={null}
                ctaOrigin="contact-page"
                heading="Ask a question"
                allowNote
                noteLabel="Your question (optional)"
                submitLabel="Send question"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
