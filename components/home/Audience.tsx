export const audienceGroups = [
  {
    title: "Developers, owners & REITs",
    detail: "Company-created project histories, technical reports, and property-level operating analysis.",
  },
  {
    title: "General & specialty contractors",
    detail: "Permitted project imagery, schedules, quantity records, and construction documentation.",
  },
  {
    title: "Architecture, engineering & surveying",
    detail:
      "Technical documentation, models, surveys, and specifications where external-use rights have been established.",
  },
  {
    title: "Property & facilities management",
    detail:
      "Equipment, maintenance, and building-performance records that can be considered separately from personal resident information.",
  },
  {
    title: "Brokerage, appraisal & research",
    detail: "Company-created property and market analysis with the necessary external-use permissions.",
  },
  {
    title: "Title, legal & professional services",
    detail:
      "Potentially relevant nonprivileged, permitted business-record collections, subject to appropriate internal review.",
  },
  {
    title: "Housing organizations & public-sector teams",
    detail:
      "Permitted technical and operational collections, with personal and restricted records kept out of the inquiry.",
  },
  {
    title: "Manufacturers, suppliers & related firms",
    detail: "Company-owned technical specifications, product documentation, and equipment records.",
  },
];

export function Audience() {
  return (
    <section id="who-its-for" className="section-light scroll-mt-24 border-t border-gray-200">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="max-w-3xl">
          <p className="section-label mb-6">Across the built environment</p>
          <h2 className="headline-sm">Built for the businesses behind buildings.</h2>
          <p className="mt-6 text-base leading-relaxed text-gray-600">
            We welcome inquiries from companies across real estate, construction, and the
            professional services that support them. These examples help identify a starting
            point; they are not a list of confirmed buyer requests.
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
          Possessing a file does not establish permission to license it. Client material and
          licensed third-party content may require separate authorization.
        </p>
      </div>
    </section>
  );
}
