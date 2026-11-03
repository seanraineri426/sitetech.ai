import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { InquiryForm } from "@/components/data-fit/InquiryForm";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Ask SiteTech a general question about how AI data licensing introductions work for real estate and built-environment businesses.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact | SiteTech AI",
    description: "Have a question about the process? Contact SiteTech.",
    url: `${SITE_URL}/contact`,
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <main className="relative">
      <PageHeader
        label="Contact"
        title="Have a question? Contact SiteTech."
        description="Use this form for a general conversation about how the process works. If you already know what your company holds, the fit check is the faster starting point."
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
            <div className="lg:sticky lg:top-32 lg:self-start">
              <p className="section-label mb-6">Before you write</p>
              <ul className="divide-y divide-gray-200 border-y border-gray-200">
                {[
                  "Keep document contents, client details, resident information, and credentials out of this form.",
                  "Submitting a question does not share anything with a buyer or partner.",
                  "SiteTech does not provide dataset valuations or legal determinations.",
                ].map((item, i) => (
                  <li key={item} className="grid gap-4 py-5 sm:grid-cols-[48px_1fr]">
                    <span className="font-mono text-[11px] text-gray-500">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-sm leading-relaxed text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/data-fit" className="link-arrow mt-8 text-black">
                Take the fit check instead
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
