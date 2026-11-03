const points = [
  "No document uploads or software connections through this site.",
  "A specific introduction requires your approval.",
  "Any evaluation or licensing arrangement is discussed directly with the counterparty.",
];

export function Control() {
  return (
    <section className="section-dark-solid border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-24">
          <div>
            <p className="section-label mb-6">You control the next step</p>
            <h2 className="headline-sm text-white">
              Explore the possibility before sharing the records.
            </h2>
            <p className="body-lg mt-6">
              The fit check asks about categories, format, and permissions. It does not ask for the
              underlying files. If an introduction becomes relevant, we explain the proposed next
              step and ask for your permission.
            </p>
          </div>

          <ul className="divide-y divide-white/10 border-y border-white/10 lg:self-end">
            {points.map((point, i) => (
              <li key={point} className="grid gap-4 py-6 sm:grid-cols-[48px_1fr]">
                <span className="font-mono text-[11px] text-gray-500">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-base leading-relaxed text-gray-300">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
