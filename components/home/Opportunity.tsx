const rows = [
  {
    num: "01",
    label: "The problem",
    title: "You paid to create the knowledge, then it got filed away",
    description:
      "Every estimate, drawing, inspection, photo, and report captured something your team learned on a real job. When the project ended, most of that know-how stopped working for your business.",
  },
  {
    num: "02",
    label: "Why AI companies care",
    title: "AI cannot learn the real world from guesses",
    description:
      "AI software learns from examples. Real job photos show real conditions. Real schedules show what actually happened. Real service records show how buildings really run over time.",
  },
  {
    num: "03",
    label: "The low-pressure solution",
    title: "Describe what you have. We explore who may care.",
    description:
      "No file uploads. No software to connect. No giant cleanup project. If a specific buyer conversation looks worth having, SiteTech asks you first—and you decide.",
  },
];

export function Opportunity() {
  return (
    <section id="opportunity" className="section-light scroll-mt-24">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="section-label mb-6">The hidden asset</p>
            <h2 className="headline-sm">Your archive is not just storage. It may be inventory.</h2>
            <p className="mt-6 text-base leading-relaxed text-gray-600">
              When a job closes, the files usually go into a drive and stay there. But those
              files can also be examples of how the real built world works—and that is exactly
              the kind of material AI labs and data buyers may need.
            </p>
            <p className="mt-5 border-l-2 border-black pl-5 text-lg font-medium leading-relaxed text-black">
              You do not need to understand AI. You only need to know what kinds of records
              your company already has.
            </p>
          </div>

          <div>
            <div className="divide-y divide-gray-200">
              {rows.map((row) => (
                <div key={row.num} className="grid gap-6 py-10 first:pt-0 sm:grid-cols-[80px_1fr]">
                  <p className="font-mono text-sm text-gray-500">{row.num}</p>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
                      {row.label}
                    </p>
                    <h3 className="mt-3 text-xl font-medium tracking-tight">{row.title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-gray-600">{row.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="border-t border-gray-200 pt-8 text-sm leading-relaxed text-gray-500">
              Not every set of records will be a fit, and no honest person can quote a price
              from a short quiz. The first step is finding out what you have, whether you are
              allowed to discuss it, and whether a buyer conversation makes sense.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
