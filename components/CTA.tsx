import Link from "next/link";

type CTAProps = {
  title?: string;
  body?: string;
  href?: string;
  label?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function CTA({
  title = "The labs are looking. Find out if they are looking for yours.",
  body = "Data buyers do this every day. Most owners never check once. Answer 8 questions and see whether your records are worth a conversation.",
  href = "/data-fit",
  label = "See if mine is the good stuff",
  secondaryHref = "/contact",
  secondaryLabel = "Have questions first? Talk to SiteTech.",
}: CTAProps) {
  return (
    <section className="section-dark-solid border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-20">
          <h2 className="headline-sm max-w-[18ch] text-white">{title}</h2>
          <div>
            <p className="text-base leading-relaxed text-gray-400">{body}</p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <Link href={href} className="btn-primary">
                {label}
              </Link>
              {secondaryHref && secondaryLabel && (
                <Link href={secondaryHref} className="link-arrow text-gray-400">
                  {secondaryLabel}
                  <span aria-hidden>→</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
