import Link from "next/link";

type CTAProps = {
  title?: string;
  body?: string;
  href?: string;
  label?: string;
};

export function CTA({
  title = "Show us how your team works today.",
  body = "We'll map where AI agents can eliminate repetitive work, connect your systems, and improve visibility — and tell you honestly where they can't.",
  href = "/pricing#contact",
  label = "Book an AI Workflow Assessment",
}: CTAProps) {
  return (
    <section className="section-dark-solid border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-20">
          <h2 className="headline-sm max-w-[18ch] text-white">{title}</h2>
          <div>
            <p className="text-base leading-relaxed text-gray-400">{body}</p>
            <Link href={href} className="btn-primary mt-8">
              {label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
