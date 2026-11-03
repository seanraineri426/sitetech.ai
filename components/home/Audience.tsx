export const audienceGroups = [
  {
    title: "Developers, owners & REITs",
    detail: "Past project files, technical reports, budgets, and property records your company created.",
  },
  {
    title: "General & specialty contractors",
    detail: "Job photos, schedules, estimates, quantities, and project records you have the right to discuss.",
  },
  {
    title: "Architecture, engineering & surveying",
    detail: "Drawings, models, surveys, and specs—only where client and contract rules allow outside discussion.",
  },
  {
    title: "Property & facilities management",
    detail: "Work orders, equipment history, inspections, and building records kept separate from tenant personal information.",
  },
  {
    title: "Brokerage, appraisal & research",
    detail: "Reports, analysis, and market research your company created and is allowed to discuss.",
  },
  {
    title: "Title, legal & professional services",
    detail: "Only non-privileged business records, and only after the right people inside your firm review them.",
  },
  {
    title: "Housing organizations & public-sector teams",
    detail: "Technical and operating records with personal, resident, and restricted information left completely out.",
  },
  {
    title: "Manufacturers, suppliers & related firms",
    detail: "Product documents, specifications, manuals, and equipment records your company owns.",
  },
];

export function Audience() {
  return (
    <section id="who-its-for" className="section-light scroll-mt-24 border-t border-gray-200">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="max-w-3xl">
          <p className="section-label mb-6">Who this is for</p>
          <h2 className="headline-sm">If your company has years of files, start here.</h2>
          <p className="mt-6 text-base leading-relaxed text-gray-600">
            You do not need to be an AI company, and construction does not have to be your
            main business. If your team creates project, property, equipment, or technical
            records, there may be a starting point. These are examples—not confirmed buyer
            requests.
          </p>
        </div>

        <div className="mt-14 grid border-t border-gray-200 sm:grid-cols-2 lg:grid-cols-4">
          {audienceGroups.map((group, i) => (
            <div
              key={group.title}
              className={`border-b border-gray-200 py-8 sm:pr-8 ${
                i % 2 === 1 ? "sm:border-l sm:pl-8 lg:border-l-0 lg:pl-0" : ""
              } ${i % 4 !== 0 ? "lg:border-l lg:pl-8" : ""}`}
            >
              <p className="font-mono text-[11px] text-gray-500">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-4 text-base font-medium tracking-tight">{group.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{group.detail}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 max-w-3xl text-sm leading-relaxed text-gray-500">
          Having a file does not mean you are allowed to license it. If a client owns it or
          rules restrict it, leave it out. Start with the records that are clearly yours to
          discuss.
        </p>
      </div>
    </section>
  );
}
