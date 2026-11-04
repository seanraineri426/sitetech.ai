import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy information",
  description:
    "What SiteTech collects through the fit check and inquiry forms on this website, how it is delivered, and how it is used.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy information | SiteTech AI",
    description: "What this website collects and how SiteTech uses it.",
    url: `${SITE_URL}/privacy`,
    type: "website",
  },
};

const LAST_UPDATED = "November 3, 2026";

const sections: { title: string; paragraphs: (string | string[])[] }[] = [
  {
    title: "What this page covers",
    paragraphs: [
      "This page describes how the SiteTech AI website handles information you provide through the data fit check and the inquiry forms. It reflects how the site is actually built. It is not a complete legal privacy policy and does not describe any later arrangement you may enter into with a buyer or licensing partner.",
    ],
  },
  {
    title: "The fit check",
    paragraphs: [
      "The fit check asks eight multiple-choice questions about your business type, categories of records, storage format, scope, permission status, possible sensitive content, how often records are added, and what you would like to do next.",
      "Your selections are held in your browser's memory while you use the page. They are not stored in cookies or browser storage, or placed in the page URL, and if you close or reload the page they are gone. Nothing is sent while you answer. At the end, the fit check asks for your name, work email, and company before it opens your result. Only at that point are your answers sent to SiteTech together with those details. The result and the modeled value are calculated in your browser from fixed, published rules; no AI system reviews your answers.",
    ],
  },
  {
    title: "Inquiry forms",
    paragraphs: [
      "If you choose to contact SiteTech, the form asks for:",
      [
        "Name, work email, and company name (required).",
        "Role and company website (optional).",
        "A short optional note on the contact and buyer/partner forms.",
        "Your fit-check answers, which are sent with your details when you unlock the result at the end of the fit check.",
        "Your confirmation of the consent statement shown next to the checkbox, and the version of that statement.",
        "The page you were on and which button you used (for example, the homepage fit check), so SiteTech knows the context of your request. This does not include your full address bar, search terms, or referrer.",
      ],
      "The site does not fetch or analyze a website address you enter; it is passed along as text.",
    ],
  },
  {
    title: "How requests are delivered",
    paragraphs: [
      "Submitting a form sends your request from your browser to Web3Forms, a third-party form-delivery service, which records the time of receipt and delivers it to SiteTech's inbox by email. Web3Forms processes the submission only in order to deliver it. The website itself does not keep a database of submissions.",
      "You see \"Request received\" only after the delivery service confirms it accepted the request. If delivery fails, your details stay in the form and nothing has been sent.",
    ],
  },
  {
    title: "How SiteTech uses your information",
    paragraphs: [
      "SiteTech uses your contact details and answers to respond to your request and to consider whether a potential introduction is worth discussing with you.",
      "SiteTech does not share your inquiry with any buyer or licensing partner unless you separately and specifically approve a named introduction and the information to be shared. Sending a form is not that approval.",
      "SiteTech does not sell your contact details and does not add you to a newsletter when you send a request.",
    ],
  },
  {
    title: "What not to send",
    paragraphs: [
      "Do not enter document contents, datasets, client details, resident or tenant information, identity documents, privileged material, credentials, or other confidential information anywhere on this website. The forms are designed for high-level descriptions only.",
    ],
  },
  {
    title: "Cookies and analytics",
    paragraphs: [
      "This website does not set analytics or advertising cookies and does not run third-party analytics or session-recording scripts. Fonts are loaded as part of the site's own build output.",
    ],
  },
  {
    title: "Your choices",
    paragraphs: [
      "You can answer the fit check questions without providing any contact details, but the result and modeled value open only after you submit your details at the end. To ask SiteTech to correct or delete a request you have already sent, reply to the follow-up you receive or use the contact form.",
    ],
  },
  {
    title: "Changes",
    paragraphs: [
      `This page was last updated on ${LAST_UPDATED}. It will be updated if the way the website handles information changes.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="relative">
      <PageHeader
        label="Privacy information"
        title="What this website collects, and how it is used."
        description="A plain description of how the fit check and inquiry forms on this site handle your information."
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 lg:px-10 lg:py-24">
          <div className="max-w-[720px] divide-y divide-gray-200">
            {sections.map((section) => (
              <div key={section.title} className="py-10 first:pt-0">
                <h2 className="text-xl font-medium tracking-tight">{section.title}</h2>
                {section.paragraphs.map((p, i) =>
                  Array.isArray(p) ? (
                    <ul key={i} className="mt-4 space-y-3">
                      {p.map((item) => (
                        <li key={item} className="flex gap-4 text-base leading-relaxed text-gray-700">
                          <span aria-hidden className="mt-[12px] h-px w-5 shrink-0 bg-gray-300" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i} className="mt-4 text-base leading-relaxed text-gray-700">
                      {p}
                    </p>
                  ),
                )}
              </div>
            ))}
            <div className="pt-10">
              <Link href="/contact" className="link-arrow text-black">
                Contact SiteTech
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
