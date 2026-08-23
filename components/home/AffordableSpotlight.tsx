import Link from "next/link";

const capabilities = [
  "Applicant document collection and classification",
  "Income and third-party verification tracking",
  "Lottery, waitlist, and voucher coordination",
  "Lease-up command center and bottleneck reporting",
  "Recertification and audit preparation",
];

export function AffordableSpotlight() {
  return (
    <section className="section-dark-solid border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-24">
          <div>
            <p className="section-label mb-6">Specialization</p>
            <h2 className="headline-sm text-white">
              Affordable housing is not market-rate leasing with extra paperwork.
            </h2>
            <p className="body-lg mt-6">
              Income-restricted lease-up means documentation, verification, agency
              coordination, and program rules — at volume, under deadline. SiteTech
              builds AI workflows for that lifecycle, with eligibility decisions always
              in qualified hands.
            </p>
            <Link href="/solutions/affordable-housing" className="link-arrow mt-8 text-gray-300 hover:text-white">
              Explore affordable housing workflows
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="border border-white/10 p-8 lg:p-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
              Where agents assist
            </p>
            <ul className="mt-6 space-y-4">
              {capabilities.map((item, i) => (
                <li key={item} className="flex gap-4 text-sm leading-relaxed text-gray-300">
                  <span className="font-mono text-gray-500">{String(i + 1).padStart(2, "0")}</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
