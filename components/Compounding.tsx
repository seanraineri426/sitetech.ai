const releases = [
  { label: "4.6", height: 38 },
  { label: "4.7", height: 56 },
  { label: "4.8", height: 76 },
  { label: "Next", height: 98, projected: true },
];

const points = [
  {
    num: "01",
    title: "Model-agnostic by design",
    detail:
      "We are not locked to a single vendor. Each workflow can route tasks to the model that best fits the job, policy, and cost profile.",
  },
  {
    num: "02",
    title: "Evaluated on your data",
    detail:
      "Model upgrades are tested against your workflows, documents, edge cases, and approval rules before they are promoted.",
  },
  {
    num: "03",
    title: "No rebuild, no repurchase",
    detail:
      "The workflow layer stays intact as model capability improves. You build on the operating layer instead of starting over.",
  },
];

export function Compounding() {
  return (
    <section id="compounding" className="section-dark-solid border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-[1.1fr_1fr] lg:gap-24">
          <div>
            <p className="section-label mb-6">Compounding value</p>
            <h2 className="headline-sm">
              The operating layer compounds as models improve.
            </h2>
            <p className="body-lg mt-6">
              Models change quickly. Your real advantage is the stable operating layer:
              clean context, permissions, workflow logic, evaluation sets, and a ledger.
              When stronger models become available, we test where they belong and promote
              them into the workflows that benefit.
            </p>

            <div className="mt-12 space-y-8">
              {points.map((point) => (
                <div key={point.num} className="flex gap-5">
                  <span className="font-mono text-sm text-gray-600">{point.num}</span>
                  <div>
                    <h3 className="font-medium tracking-tight">{point.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">
                      {point.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-center border border-white/10 p-8 lg:p-12">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
              Capability per model release
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-600">
              Directional illustration
            </p>

            <div className="mt-10 flex h-56 items-end gap-4 sm:gap-6">
              {releases.map((release) => (
                <div key={release.label} className="flex flex-1 flex-col items-center gap-3">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={`w-full ${
                        release.projected
                          ? "border border-dashed border-white/40 bg-white/10"
                          : "bg-white"
                      }`}
                      style={{ height: `${release.height}%` }}
                    />
                  </div>
                  <span
                    className={`font-mono text-[11px] ${
                      release.projected ? "text-gray-500" : "text-gray-300"
                    }`}
                  >
                    {release.label}
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-8 border-t border-white/10 pt-6 text-sm leading-relaxed text-gray-400">
              The same workflow can become more capable without replacing the surrounding
              system. The durable asset is the context and control layer around the model.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
