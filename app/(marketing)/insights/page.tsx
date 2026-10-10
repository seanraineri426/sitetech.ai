import type { Metadata } from "next";
import { PageHeader } from "@/components/marketing/PageHeader";
import { CTA } from "@/components/marketing/CTA";
import { Reveal } from "@/components/marketing/Reveal";
import { insights, formatDate } from "@/lib/marketing/insights";

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Field notes on operational AI for real estate development, construction, brokerages, appraisal, and private equity, from the team building it.",
  alternates: { canonical: "/insights" },
  openGraph: {
    title: "Insights | SiteTech AI",
    description:
      "Field notes on operational AI for real estate and construction, from the team building it.",
    url: "https://sitetech.ai/insights",
    type: "website",
  },
};

export default function InsightsPage() {
  return (
    <main className="relative">
      <PageHeader
        label="Insights"
        title="Field notes from building real-world AI."
        description="How we think about deploying agents into real estate and construction. Written by the team that builds and maintains the systems, not a marketing department."
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 lg:px-10 lg:py-24">
          <ul className="border-t border-gray-200">
            {insights.map((post, i) => (
              <li key={post.slug}>
                <a
                  href={`/insights/${post.slug}`}
                  className="group grid gap-6 border-b border-gray-200 py-10 transition-colors hover:bg-gray-50 lg:grid-cols-[0.32fr_1fr] lg:gap-12 lg:py-14"
                >
                  <div className="flex items-start gap-4">
                    <span className="font-mono text-sm text-gray-400">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
                      <span className="block text-gray-700">{post.category}</span>
                      <span className="mt-2 block">{formatDate(post.date)}</span>
                      <span className="mt-1 block text-gray-400">{post.readingTime}</span>
                    </div>
                  </div>

                  <div className="max-w-3xl">
                    <h2 className="text-2xl font-medium tracking-tight lg:text-3xl">
                      {post.title}
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-gray-600">
                      {post.description}
                    </p>
                    <span className="link-arrow mt-6 text-black">
                      Read
                      <span aria-hidden className="transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Reveal>
        <CTA />
      </Reveal>
    </main>
  );
}
