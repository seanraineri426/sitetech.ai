const industries = [
  { title: "Development", detail: "For teams coordinating capital, approvals, consultants, and delivery." },
  { title: "Construction", detail: "For field and office teams managing execution across active jobs." },
  { title: "Brokerage", detail: "For teams turning market knowledge and relationship data into action." },
  { title: "Private Equity", detail: "For investment teams managing deals, assets, partners, and reporting." },
  { title: "Appraisal", detail: "For valuation teams handling research, comps, and report assembly." },
];

export function IndustriesTeaser() {
  return (
    <section className="section-light">
      <div className="mx-auto max-w-[1400px] px-6 py-24 lg:px-10 lg:py-28">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="section-label mb-6">Who it is for</p>
            <h2 className="headline-sm">A private AI operating layer for the real estate stack.</h2>
          </div>
          <a href="/workflows" className="link-arrow shrink-0 text-black">
            View deeper use cases
            <span aria-hidden>→</span>
          </a>
        </div>

        <div className="mt-14 grid gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-5">
          {industries.map((item) => (
            <div key={item.title} className="flex flex-col bg-white p-8">
              <h3 className="text-base font-medium tracking-tight">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
