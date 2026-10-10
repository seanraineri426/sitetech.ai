import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CTA } from "@/components/marketing/CTA";
import { insights, getInsight, formatDate, type ContentBlock } from "@/lib/marketing/insights";

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

  const url = `${siteUrl}/blog/${post.slug}`;
  const title = post.seoTitle ?? post.title;
  return {
    title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title,
      description: post.description,
      url,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title,
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

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getInsight(slug);
  if (!post) notFound();

  const url = `${siteUrl}/blog/${post.slug}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.seoTitle ?? post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: post.author, url: siteUrl },
    publisher: {
      "@type": "Organization",
      name: "SiteTech AI",
      logo: { "@type": "ImageObject", url: `${siteUrl}/icon.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: post.category,
  };

  const faqSchema = post.faqs?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: post.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      }
    : null;

  return (
    <main className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faqSchema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      ) : null}

      <article className="section-light">
        <div className="mx-auto max-w-[720px] px-6 pt-28 pb-16 sm:pt-32 lg:pt-44 lg:pb-28">
          <Link
            href="/blog"
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500 transition-colors hover:text-black"
          >
            ← Blog
          </Link>

          <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
            <span className="text-gray-700">{post.category}</span>
            <span aria-hidden className="text-gray-300">
              /
            </span>
            <span>{formatDate(post.date)}</span>
            <span aria-hidden className="text-gray-300">
              /
            </span>
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

          {post.faqs?.length ? (
            <section className="mt-16 border-t border-gray-200 pt-12">
              <h2 className="text-2xl font-medium tracking-tight text-black lg:text-3xl">
                Common questions
              </h2>
              <dl className="mt-8 space-y-8">
                {post.faqs.map((faq) => (
                  <div key={faq.question}>
                    <dt className="text-lg font-medium text-black">{faq.question}</dt>
                    <dd className="mt-2 text-[17px] leading-[1.7] text-gray-700">{faq.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {post.related?.length ? (
            <nav className="mt-14 border-t border-gray-200 pt-8" aria-label="Related">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-400">
                Related
              </p>
              <ul className="mt-4 space-y-3">
                {post.related.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="link-arrow text-black">
                      {link.label}
                      <span aria-hidden> →</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

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
