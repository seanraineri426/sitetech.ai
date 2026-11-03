const points = [
  {
    title: "Your files stay put",
    detail: "This website never asks you to upload records, connect software, or share a password.",
  },
  {
    title: "Names and IDs come out before training use",
    detail:
      "For an approved package, the buyer or licensing partner de-identifies the data—removing or masking names, emails, phone numbers, addresses, and IDs—so it can be training-ready.",
  },
  {
    title: "Some things are excluded, not anonymized",
    detail:
      "Tenant files, identity documents, privileged legal material, client secrets, and restricted records should stay out entirely. Anonymization is not a magic wand.",
  },
  {
    title: "You approve the buyer conversation",
    detail: "SiteTech names the proposed AI lab, buyer, or partner before your inquiry is shared with them.",
  },
  {
    title: "You sign—or you walk away",
    detail: "Any price, permitted use, exclusivity, and ownership terms are agreed directly by you. A conversation is not a sale.",
  },
];

export function Control() {
  return (
    <section className="section-dark-solid border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-24">
          <div>
            <p className="section-label mb-6">Built to protect your business</p>
            <h2 className="headline-sm text-white">
              You do not hand over the keys. You open one door at a time.
            </h2>
            <p className="body-lg mt-6">
              This is not a data dump and not another software rollout. The fit check only asks
              what kinds of records you have. Your files stay where they are, your team keeps
              working the way it already does, and you can stop at any point.
            </p>
            <p className="mt-6 max-w-2xl text-base font-medium leading-relaxed text-white">
              If a conversation ever makes sense, you will know exactly who it is, what would
              be discussed, and what happens next—before anything moves.
            </p>
          </div>

          <ul className="divide-y divide-white/10 border-y border-white/10 lg:self-end">
            {points.map((point, i) => (
              <li key={point.title} className="grid gap-4 py-6 sm:grid-cols-[48px_1fr]">
                <span className="font-mono text-[11px] text-gray-500">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block text-base font-medium leading-relaxed text-white">{point.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-gray-400">{point.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
