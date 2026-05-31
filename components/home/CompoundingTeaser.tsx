export function CompoundingTeaser() {
  return (
    <section className="section-light">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-20">
          <div>
            <p className="section-label mb-6">Model progression</p>
            <h2 className="headline-sm">
              The same workflow becomes more capable as the frontier moves.
            </h2>
          </div>
          <div>
            <p className="text-base leading-relaxed text-gray-600">
              The operating layer stays constant while model capability improves. When a
              stronger model becomes available, we evaluate it against the workflow,
              permissions, and ledger, then route the right tasks to the right model.
            </p>
            <a href="/platform" className="link-arrow mt-8 text-black">
              Explore the platform
              <span aria-hidden>→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
