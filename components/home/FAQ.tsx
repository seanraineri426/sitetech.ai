import { BUYER_TYPES_SOFT } from "@/lib/doors";

export const faqs = [
  {
    q: "What is SiteTech, in plain terms?",
    a: "SiteTech helps businesses explore two paths with AI data partners: licensing company records you already keep, or recording first-person field work for robotics training programs. We listen, help you see a first-pass fit, and ask before introducing you to anyone. You stay in control.",
  },
  {
    q: "Who are the buyers or partners?",
    a: `${BUYER_TYPES_SOFT} When a specific introduction makes sense, we name the proposed recipient and ask your permission before sharing your inquiry.`,
  },
  {
    q: "How does SiteTech make money?",
    a: "We earn a referral fee when an introduction we facilitate leads to an eligible arrangement between you and a buyer or partner. That fee sits in a separate agreement with the buyer or partner. We do not buy your data, set your price, or take a cut of your license unless that is agreed up front. If no introduction happens, you owe us nothing from this website.",
  },
  {
    q: "What is the difference between the two doors?",
    a: "License my records is for archives and operating systems (plans, photos, CRM, project tools, and similar). Record my work is for first-person footage of job-site or shop work that robotics training programs may want. The robotics path estimates annual payout as people × hours per week × $10 × 52. Some trades businesses qualify for both.",
  },
  {
    q: "How much could our data be worth?",
    a: "AI buyers and brokers publish offer ranges of $100K to $5M for construction and design records. The fit check gives you a modeled estimate from your own answers so you can see where you might sit. That number is a planning guide, not a quote, appraisal, or promise of payment. Real terms only appear if you and a counterparty agree later.",
  },
  {
    q: "Do we have to upload files or connect our software?",
    a: "No. You only answer a few high-level questions. Nothing leaves your systems through this site. If a later conversation needs samples, exports, or footage, that would be a separate step you approve with the other party.",
  },
  {
    q: "Do we give up ownership of our records?",
    a: "Not by talking to us, and not by finishing the fit check. Ownership and use terms only change if you sign a separate agreement with a buyer or partner. You can walk away at any point.",
  },
  {
    q: "What happens after I reach out?",
    a: "We review what you shared and follow up about a possible next step. There is no obligation to take a call, accept an introduction, or enter a deal. If it is not a fit, we will say so plainly.",
  },
  {
    q: "I am a data buyer or licensing partner. Can we talk?",
    a: "Yes. Use the buyer and partner path on the contact page to tell us who you are and what categories you care about. Keep confidential requirements and source materials out of the form for now.",
  },
];

export function FAQ() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section id="faq" className="section-dark-solid scroll-mt-24 border-t border-white/10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="section-label mb-6">FAQ</p>
            <h2 className="headline-sm text-white">Common questions.</h2>
          </div>

          <div className="divide-y divide-white/10 border-y border-white/10">
            {faqs.map((f) => (
              <details key={f.q} className="faq-item group">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-6 py-5 text-left text-base font-medium tracking-tight text-white [&::-webkit-details-marker]:hidden">
                  <span>{f.q}</span>
                  <span
                    aria-hidden
                    className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center border border-white/30 font-mono text-xs text-gray-400 transition-colors group-open:bg-white group-open:text-black"
                  >
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">−</span>
                  </span>
                </summary>
                <p className="max-w-2xl pb-6 text-sm leading-relaxed text-gray-400">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
