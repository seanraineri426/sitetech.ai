const archiveRows = [
  { name: "2019–2026 project photos", meta: "drives + cloud folders" },
  { name: "plans / RFIs / submittals", meta: "project systems" },
  { name: "estimates + schedules", meta: "spreadsheets" },
  { name: "service + inspection logs", meta: "building records" },
];

const cleanRows = [
  { label: "Client name", state: "removed" },
  { label: "Email + phone", state: "masked" },
  { label: "Job photo", state: "kept" },
  { label: "Schedule + cost outcome", state: "kept" },
  { label: "Equipment history", state: "kept" },
];

function Arrow() {
  return (
    <div aria-hidden className="flex items-center justify-center py-2 lg:py-0">
      <span className="flex h-11 w-11 items-center justify-center border border-black bg-black text-xl text-white lg:rotate-0">
        <span className="rotate-90 lg:rotate-0">→</span>
      </span>
    </div>
  );
}

export function DataJourney() {
  return (
    <section className="section-light border-t border-gray-200">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="section-label mb-6">From archive to asset</p>
            <h2 className="headline-sm">Watch buried files become a clean package a lab can actually use.</h2>
          </div>
          <p className="max-w-md text-base leading-relaxed text-gray-600">
            This is the part owners worry about, so here it is visually: your whole business
            is not handed over. A defined, approved slice is prepared—private identifiers
            out, real-world value kept.
          </p>
        </div>

        <div className="mt-14 grid items-stretch gap-5 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {/* Buried archive */}
          <article className="border border-gray-300 bg-gray-50 p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">Before</p>
                <h3 className="mt-3 text-2xl font-medium tracking-tight">The buried archive</h3>
              </div>
              <span className="record-chip border-gray-300 text-gray-500">Sitting idle</span>
            </div>
            <ul className="mt-8 divide-y divide-gray-200 border-y border-gray-200">
              {archiveRows.map((row) => (
                <li key={row.name} className="py-4">
                  <p className="text-sm font-medium text-black">{row.name}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-gray-500">{row.meta}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm leading-relaxed text-gray-600">
              Valuable, messy, and mixed together. Exactly why owners do not want to just
              “send the data.”
            </p>
          </article>

          <Arrow />

          {/* Approved slice */}
          <article className="bg-black p-6 text-white shadow-[0_35px_90px_rgba(0,0,0,0.28)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">The safe middle</p>
                <h3 className="mt-3 text-2xl font-medium tracking-tight">The approved slice</h3>
              </div>
              <span className="record-chip border-white text-white">Owner approved</span>
            </div>
            <ul className="mt-8 space-y-3">
              {cleanRows.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-4 border border-white/10 px-4 py-3">
                  <span className={`text-sm ${row.state === "kept" ? "text-white" : "text-gray-500 line-through decoration-white/50"}`}>
                    {row.label}
                  </span>
                  <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${row.state === "kept" ? "text-white" : "text-gray-500"}`}>
                    {row.state}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm leading-relaxed text-gray-400">
              De-identified by the buyer or licensing partner before training use. Restricted
              material is excluded—not cleaned into the deal.
            </p>
          </article>

          <Arrow />

          {/* Training-ready */}
          <article className="border border-black bg-white p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">After</p>
                <h3 className="mt-3 text-2xl font-medium tracking-tight">Training-ready package</h3>
              </div>
              <span className="record-chip border-black bg-black text-white">Lab review</span>
            </div>
            <p className="mt-8 text-[clamp(2rem,4vw,3.4rem)] font-medium leading-[0.98] tracking-[-0.035em]">
              Real work.
              <br />
              Clean rights.
              <br />
              No personal IDs.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {["Rights checked", "De-identified", "Contract-controlled", "Owner-approved"].map((chip) => (
                <span key={chip} className="record-chip border-gray-300 text-gray-700">
                  {chip}
                </span>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-gray-600">
              That is what a lab can evaluate without wasting researcher time—and what you
              can say no to before anything is signed.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
