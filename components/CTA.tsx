type CTAProps = {
  title?: string;
  body?: string;
  href?: string;
  label?: string;
};

export function CTA({
  title = "Tell us how you work. We'll build the AI around it.",
  body = "No pitch deck. A conversation about your workflows, your data, and where embedded AI would save your team real time.",
  href = "/pricing#contact",
  label = "Start a conversation",
}: CTAProps) {
  return (
    <section className="section-dark-solid border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-24 lg:px-10 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-20">
          <h2 className="headline-sm max-w-[18ch] text-white">{title}</h2>
          <div>
            <p className="text-base leading-relaxed text-gray-400">{body}</p>
            <a href={href} className="btn-primary mt-8">
              {label}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
