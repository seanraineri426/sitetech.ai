import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ContactForms } from "@/components/ContactForms";
import { BOOKING_URL, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact SiteTech about AI data opportunities for your business. Keep confidential contents out of the form.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact | SiteTech AI",
    description: "Ask a process question or start a buyer or partner conversation.",
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
        description="A question about the process, or a data buyer or partner who wants to talk? Send a high-level note. Keep confidential content out of this form."
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
            <div className="lg:sticky lg:top-32 lg:self-start">
              <p className="section-label mb-6">Before you write</p>
              <ul className="divide-y divide-gray-200 border-y border-gray-200">
                {[
                  "Do not include document contents, client details, resident information, or credentials.",
                  "Submitting this form sends the inquiry only to SiteTech, not to buyers.",
                  "SiteTech does not appraise datasets or make legal determinations from this form.",
                ].map((item, i) => (
                  <li key={item} className="grid gap-4 py-5 sm:grid-cols-[48px_1fr]">
                    <span className="font-mono text-[11px] text-gray-500">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm leading-relaxed text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-gold mt-8 inline-flex min-h-[52px] w-full items-center justify-between gap-4 rounded-xl px-5 text-left text-sm font-semibold sm:w-auto sm:min-w-[16rem]"
              >
                <span>Prefer to talk? Book a call</span>
                <span aria-hidden className="text-lg">↗</span>
              </a>
              <div className="mt-6">
                <Link href="/#quiz" className="link-arrow text-black">
                  Check your data fit
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>

            <ContactForms />
          </div>
        </div>
      </section>
    </main>
  );
}
