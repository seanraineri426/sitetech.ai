export const faqs = [
  {
    q: "What kinds of records can I ask about?",
    a: "Start with high-level categories such as technical documentation, project imagery, equipment records, or company-created research. Relevance depends on the collection and its permitted uses. The site does not accept underlying documents or datasets.",
  },
  {
    q: "How much could our data earn?",
    a: "There is no reliable amount to quote from a short questionnaire. Any commercial terms depend on a buyer's requirements, the specific collection, permitted uses, and the agreement between the parties. SiteTech does not provide dataset valuations.",
  },
  {
    q: "Would this be a one-time payment or ongoing revenue?",
    a: "An opportunity could involve a one-time license or another arrangement agreed directly with the counterparty. New records do not automatically create recurring revenue, and no payment structure is guaranteed.",
  },
  {
    q: "Do we have to upload anything or connect our software?",
    a: "No. The fit check and initial inquiry use a high-level description. Any later sharing would be a separate step that your organization evaluates and approves directly with the relevant party.",
  },
  {
    q: "Do we have to give up ownership?",
    a: "Ownership, permitted use, exclusivity, and other rights depend on the specific agreement. A licensing discussion does not by itself determine those terms. Your organization reviews any proposal before deciding whether to proceed.",
  },
  {
    q: "What if our records contain client, tenant, or confidential information?",
    a: "Keep that information out of this website and the initial inquiry. Your organization should determine whether a separate permitted collection exists and which permissions or restrictions apply. The fit check is not a review of your records or a legal determination.",
  },
  {
    q: "Do we need to clean or organize everything first?",
    a: "You can begin with a general understanding of what you have. Any preparation requirements would depend on a specific opportunity. SiteTech does not process, clean, or anonymize datasets.",
  },
  {
    q: "Who would we be introduced to?",
    a: "A potential introduction could involve an AI data buyer or a licensing partner relevant to the collection. We identify the proposed recipient and ask for permission before sharing your inquiry with that recipient. Completing the quiz does not mean a buyer has been found.",
  },
  {
    q: "How does SiteTech make money?",
    a: "SiteTech's model is to receive referral fees on eligible introductions under separate agreements with buyers or partners. Any applicable referral arrangement and next steps are clarified before an introduction. We do not set the price or negotiate the terms of your data license.",
  },
  {
    q: "What happens after I contact you?",
    a: "SiteTech reviews your high-level inquiry and follows up about a possible next step. An introduction depends on fit and opportunity availability. You have no obligation to enter a transaction.",
  },
  {
    q: "I am a data buyer or licensing partner. Can we connect?",
    a: "Yes. Use the buyer and partner inquiry option to describe your organization and the categories you are interested in discussing. Please keep confidential requirements and underlying materials out of the form.",
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="section-label mb-6">Questions</p>
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
