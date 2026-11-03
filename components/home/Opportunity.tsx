const rows = [
  {
    num: "01",
    label: "The problem",
    title: "Your best data is buried in old jobs",
    description:
      "Every estimate, drawing, inspection, photo, schedule, and report captured something your team learned the hard way. Then the project ended, the files went into a drive, and that knowledge stopped working for you.",
  },
  {
    num: "02",
    label: "Why the labs care",
    title: "The good stuff is not on the internet",
    description:
      "Anyone can find generic examples online. What is hard to get is proprietary, real-world proof: how a job actually looked, what it actually cost, how long it actually took, and how a building actually performed after people moved in. That is the kind of data AI labs and data buyers hunt for.",
  },
  {
    num: "03",
    label: "The gap SiteTech closes",
    title: "They buy data all the time. You have probably never sold it.",
    description:
      "That imbalance is the whole point of a broker. SiteTech helps you describe what you have, avoid the obvious permission traps, and decide whether a specific lab conversation is worth your time. You do not upload files or walk in blind.",
  },
];

export function Opportunity() {
  return (
    <section id="opportunity" className="section-light scroll-mt-24">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="section-label mb-6">Who&apos;s got the good stuff?</p>
            <h2 className="headline-sm">That question is the whole data business.</h2>
            <p className="mt-6 text-base leading-relaxed text-gray-600">
              AI labs—from frontier research labs to mid-tier model companies—need training
              data that feels like the real world, because that is what their software has to
              understand. The scarce thing is not files. The scarce thing is good, usable,
              permission-clear data from real work.
            </p>
            <p className="mt-5 border-l-2 border-black pl-5 text-lg font-medium leading-relaxed text-black">
              You do not need to understand AI. You need to know whether your company is
              sitting on the kind of records a lab cannot easily create, copy, or scrape.
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
              Not every archive is the good stuff, and no honest person can quote a price
              from a short quiz. The first step is finding out what you have, whether you are
              allowed to discuss it, and whether it is scarce enough to justify a conversation.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
