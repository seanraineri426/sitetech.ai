import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CTA } from "@/components/CTA";
import { insights, getInsight, formatDate, type ContentBlock } from "@/lib/insights";

const siteUrl = "https://sitetech.ai";

export function generateStaticParams() {
  return insights.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getInsight(slug);
  if (!post) return {};

  const url = `${siteUrl}/insights/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/insights/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 className="mt-14 text-2xl font-medium tracking-tight text-black lg:text-3xl">
          {block.text}
        </h2>
      );
    case "p":
      return <p className="mt-6 text-[17px] leading-[1.75] text-gray-700">{block.text}</p>;
    case "list":
      return (
        <ul className="mt-6 space-y-4">
          {block.items.map((item) => (
            <li key={item} className="flex gap-4 text-[17px] leading-[1.7] text-gray-700">
              <span aria-hidden className="mt-[10px] h-px w-5 shrink-0 bg-gray-300" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote className="my-12 border-l-2 border-black pl-6 text-xl font-medium leading-snug tracking-tight text-black lg:text-2xl">
          {block.text}
        </blockquote>
      );
  }
}

export default async function InsightPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getInsight(slug);
  if (!post) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: post.author, url: siteUrl },
    publisher: {
      "@type": "Organization",
      name: "SiteTech AI",
      logo: { "@type": "ImageObject", url: `${siteUrl}/icon.png` },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteUrl}/insights/${post.slug}`,
    },
    articleSection: post.category,
  };

  return (
    <main className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <article className="section-light">
        <div className="mx-auto max-w-[720px] px-6 pt-28 pb-16 sm:pt-32 lg:pt-44 lg:pb-28">
          <a
            href="/insights"
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500 transition-colors hover:text-black"
          >
            ← Insights
          </a>

          <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
            <span className="text-gray-700">{post.category}</span>
            <span aria-hidden className="text-gray-300">/</span>
            <span>{formatDate(post.date)}</span>
            <span aria-hidden className="text-gray-300">/</span>
            <span className="text-gray-400">{post.readingTime}</span>
          </div>

          <h1 className="mt-6 text-[clamp(2rem,4.5vw,3.25rem)] font-medium leading-[1.08] tracking-[-0.025em] text-black">
            {post.title}
          </h1>

          <p className="mt-6 border-b border-gray-200 pb-10 text-xl leading-relaxed text-gray-500">
            {post.description}
          </p>

          <div className="mt-4">
            {post.body.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>

          <div className="mt-16 border-t border-gray-200 pt-8">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-400">
              {post.author}
            </span>
          </div>
        </div>
      </article>

      <CTA />
    </main>
  );
}
