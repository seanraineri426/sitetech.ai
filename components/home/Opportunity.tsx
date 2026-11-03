const rows = [
  {
    num: "01",
    title: "Knowledge from real work",
    description:
      "Technical documents, project imagery, and operating records can capture details of how the built environment is designed, delivered, and managed.",
  },
  {
    num: "02",
    title: "A collection you already hold",
    description:
      "Start by identifying existing record categories and their history. You do not need to upload or reorganize your files to take the fit check.",
  },
  {
    num: "03",
    title: "A clear next step",
    description:
      "Get a first-pass guide to what you can discuss now and what your team may need to clarify internally.",
  },
];

export function Opportunity() {
  return (
    <section id="opportunity" className="section-light scroll-mt-24">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="section-label mb-6">The opportunity</p>
            <h2 className="headline-sm">You may already have the starting point.</h2>
            <p className="mt-6 text-base leading-relaxed text-gray-600">
              Years of projects can leave a substantial collection of technical knowledge and
              operating history. A permitted collection may have another use in AI training or
              evaluation. The first step is understanding what exists, who can authorize its use,
              and whether a relevant opportunity is available.
            </p>
          </div>

          <div>
            <div className="divide-y divide-gray-200">
              {rows.map((row) => (
                <div key={row.num} className="grid gap-6 py-10 first:pt-0 sm:grid-cols-[80px_1fr]">
                  <p className="font-mono text-sm text-gray-500">{row.num}</p>
                  <div>
                    <h3 className="text-xl font-medium tracking-tight">{row.title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-gray-600">{row.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="border-t border-gray-200 pt-8 text-sm leading-relaxed text-gray-500">
              Potential fit depends on the specific collection, permissions, and buyer requirements.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
