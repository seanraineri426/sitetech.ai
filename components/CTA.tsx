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
  title = "Your finished work could pay you twice.",
  body = "You already paid your team to create the records. Answer 8 questions and find out whether a buyer conversation is even worth having.",
  href = "/data-fit",
  label = "See if my files could be worth money",
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
