import { insights, formatDate } from "@/lib/insights";

export function InsightsTeaser() {
  const latest = insights.slice(0, 3);

  return (
    <section className="section-dark-solid border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-24 lg:px-10 lg:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="section-label mb-6 text-gray-500">Insights</p>
            <h2 className="headline-sm text-white">
              Field notes from building real-world AI.
            </h2>
          </div>
          <a href="/insights" className="link-arrow text-white">
            View all insights
            <span aria-hidden>→</span>
          </a>
        </div>

        <div className="mt-14 grid gap-px border border-white/10 bg-white/10 md:grid-cols-3">
          {latest.map((post) => (
            <a
              key={post.slug}
              href={`/insights/${post.slug}`}
              className="group flex flex-col bg-black p-8 transition-colors hover:bg-gray-950 lg:p-10"
            >
              <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
                <span className="text-gray-300">{post.category}</span>
                <span aria-hidden className="text-gray-700">/</span>
                <span>{formatDate(post.date)}</span>
              </div>

              <h3 className="mt-6 text-xl font-medium leading-snug tracking-tight text-white">
                {post.title}
              </h3>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-gray-400">
                {post.description}
              </p>

              <span className="link-arrow mt-8 text-white">
                Read
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
