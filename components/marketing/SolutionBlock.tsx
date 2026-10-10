export type SolutionWorkflow = {
  title: string;
  description: string;
  connects?: string;
};

type SolutionBlockProps = {
  id: string;
  label: string;
  title: string;
  description: string;
  workflows: SolutionWorkflow[];
  dark?: boolean;
  note?: string;
};

/**
 * A solutions-page section: header plus a grid of concrete workflow cards.
 */
export function SolutionBlock({ id, label, title, description, workflows, dark = false, note }: SolutionBlockProps) {
  return (
    <section id={id} className={`scroll-mt-24 ${dark ? "section-dark-solid border-t border-white/10" : "section-light border-t border-gray-200"}`}>
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="section-label mb-6">{label}</p>
            <h2 className="headline-sm">{title}</h2>
          </div>
          <p className={`max-w-2xl text-base leading-relaxed ${dark ? "text-gray-400" : "text-gray-600"} lg:pt-14`}>
            {description}
          </p>
        </div>

        <div className={`mt-14 grid gap-px border sm:grid-cols-2 lg:grid-cols-3 ${dark ? "border-white/10 bg-white/10" : "border-gray-200 bg-gray-200"}`}>
          {workflows.map((wf) => (
            <div key={wf.title} className={`flex flex-col p-8 ${dark ? "bg-black" : "bg-white"}`}>
              <h3 className="text-base font-medium tracking-tight">{wf.title}</h3>
              <p className={`mt-3 flex-1 text-sm leading-relaxed ${dark ? "text-gray-400" : "text-gray-600"}`}>
                {wf.description}
              </p>
              {wf.connects && (
                <p className={`mt-6 border-t pt-4 font-mono text-[10px] uppercase tracking-[0.15em] leading-relaxed ${dark ? "border-white/10 text-gray-500" : "border-gray-200 text-gray-500"}`}>
                  {wf.connects}
                </p>
              )}
            </div>
          ))}
        </div>

        {note && (
          <p className={`mt-8 max-w-3xl text-sm leading-relaxed ${dark ? "text-gray-500" : "text-gray-500"}`}>
            {note}
          </p>
        )}
      </div>
    </section>
  );
}
