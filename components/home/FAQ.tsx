export const faqs = [
  {
    q: "In plain English, what would an AI company do with records like ours?",
    a: "It would use approved examples to teach or test software. Real photos can show what job sites and buildings actually look like. Plans, schedules, estimates, and service records can add the context behind those images. The exact use depends on the buyer and the agreement you approve.",
  },
  {
    q: "Why would files from finished jobs be valuable?",
    a: "Because they came from real work. Generic examples cannot easily show the messy details of a real building, project, repair, or inspection. Your records may contain years of that real-world detail. That does not guarantee a buyer will want them, but it is why a conversation can be worth exploring.",
  },
  {
    q: "How much money could we make?",
    a: "There is no honest number anyone can give from an 8-question quiz. Price depends on what the buyer needs, how useful and usable the records are, what rights you can grant, and the deal you negotiate. SiteTech does not value your records or promise a payout.",
  },
  {
    q: "Is this guaranteed income?",
    a: "No. Think of it as a possible new return on work you already completed—not a promise and not automatic recurring revenue. A deal could be one-time or structured another way, but only if you and a buyer agree to it.",
  },
  {
    q: "Will this disrupt or change how our business operates?",
    a: "The fit check will not. It takes a few minutes, asks only for categories, and does not connect to your systems. If a buyer later wants to evaluate a specific set of records, that is a separate step you can approve, limit, or decline.",
  },
  {
    q: "Do we have to upload files or give SiteTech access to our systems?",
    a: "No. Do not upload files here, and do not enter passwords or connect Procore, Yardi, email, drives, or any other software. The first step is only a plain-language description of the kinds of records you have.",
  },
  {
    q: "What if most of our records belong to clients or contain private information?",
    a: "Leave those out. Start by asking whether there is a separate set your company owns and is allowed to discuss. Tenant files, resident information, identity documents, privileged legal material, and client secrets do not belong in this inquiry.",
  },
  {
    q: "What if we are small or only have one project?",
    a: "You can still check. The quiz does not reject a company just because the set is small, old, or on paper. Size and format help explain the starting point; they do not decide the answer by themselves.",
  },
  {
    q: "Do we lose ownership or control of our records?",
    a: "Not by taking the quiz or having a conversation. Ownership, allowed use, exclusivity, and other rights are set by the agreement you review and sign directly with a buyer. If the terms are wrong, you do not sign.",
  },
  {
    q: "Who would we be introduced to?",
    a: "Possibly an AI lab, a data buyer, or a licensing partner—but only if a relevant opportunity appears to exist. SiteTech will name the proposed recipient and ask for your permission before sharing your inquiry. Taking the quiz does not mean a buyer has already been found.",
  },
  {
    q: "How does SiteTech make money?",
    a: "SiteTech's model is to earn a referral fee on eligible introductions under separate agreements with buyers or partners. That arrangement is clarified before an introduction. SiteTech does not set the price for your records or negotiate your licensing deal.",
  },
  {
    q: "What happens after I answer the questions?",
    a: "You see your result first. If you choose to contact SiteTech, we review the high-level answers and follow up about whether a next step makes sense. You are not obligated to meet a buyer, share records, or accept any deal.",
  },
  {
    q: "I work for an AI lab or data buyer. Can we talk?",
    a: "Yes. Use the buyer and partner page to describe your organization and the broad categories you want to discuss. Please do not send confidential buying requirements or underlying materials through the form.",
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
            <p className="section-label mb-6">Straight answers</p>
            <h2 className="headline-sm text-white">The questions every owner asks first.</h2>
            <p className="body-lg mt-6">
              No AI background required. If something here still does not make sense, ask us
              before doing anything else.
            </p>
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
