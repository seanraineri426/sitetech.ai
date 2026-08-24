import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { CTA } from "@/components/CTA";
import { Reveal } from "@/components/Reveal";
import { insights, formatDate } from "@/lib/insights";

const siteUrl = "https://sitetech.ai";

export const metadata: Metadata = {
  title: "Blog | Affordable Housing AI, Lease-Up, and Yardi Workflows",
  description:
    "Practical writing on affordable housing lease-up, LIHTC recertification, Yardi and OneSite overlays, and why AI should never determine eligibility. From SiteTech AI.",
  keywords: [
    "affordable housing lease-up",
    "LIHTC recertification",
    "Yardi AI",
    "OneSite automation",
    "affordable housing compliance AI",
  ],
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog | SiteTech AI",
    description:
      "Lease-up command centers, recertification queues, eligibility rules, and PMS overlays for regional affordable housing operators.",
    url: `${siteUrl}/blog`,
    type: "website",
  },
};

export default function BlogPage() {
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "SiteTech AI Blog",
    description:
      "Operational AI for affordable housing lease-up, recertification, and property-management systems.",
    url: `${siteUrl}/blog`,
    publisher: { "@type": "Organization", name: "SiteTech AI", url: siteUrl },
    blogPost: insights.map((post) => ({
      "@type": "BlogPosting",
      headline: post.seoTitle ?? post.title,
      description: post.description,
      datePublished: post.date,
      url: `${siteUrl}/blog/${post.slug}`,
    })),
  };

  return (
    <main className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />

      <PageHeader
        label="Blog"
        title="How affordable housing operations actually run."
        description="Lease-up bottlenecks, recertification queues, eligibility rules, and why we sit on Yardi and OneSite instead of replacing them. Written for occupancy, compliance, and regional PM leads."
      />

      <section className="section-light">
        <div className="mx-auto max-w-[1400px] px-6 py-16 lg:px-10 lg:py-24">
          <ul className="border-t border-gray-200">
            {insights.map((post, i) => (
              <li key={post.slug}>
                <a
                  href={`/blog/${post.slug}`}
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
