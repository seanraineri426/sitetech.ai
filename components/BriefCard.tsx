type BriefLine = {
  label: string;
  value: string;
  flag?: boolean;
};

type BriefCardProps = {
  label: string;
  title: string;
  lines: BriefLine[];
  footer?: string;
  dark?: boolean;
};

/**
 * A mock "daily brief" panel — the kind of exception summary a SiteTech agent
 * delivers each morning. Used on solution pages to make the output concrete.
 */
export function BriefCard({ label, title, lines, footer, dark = false }: BriefCardProps) {
  return (
    <div className={`border p-8 lg:p-10 ${dark ? "border-white/15 bg-black" : "border-gray-200 bg-gray-50"}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
        {label}
      </p>
      <p className={`mt-2 text-lg font-medium tracking-tight ${dark ? "text-white" : "text-black"}`}>
        {title}
      </p>

      <div className={`mt-8 divide-y ${dark ? "divide-white/10" : "divide-gray-200"}`}>
        {lines.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-6 py-3">
            <span className={`text-sm ${dark ? "text-gray-400" : "text-gray-600"}`}>
              {line.label}
            </span>
            <span
              className={`shrink-0 font-mono text-sm ${
                line.flag
                  ? dark
                    ? "text-white"
                    : "text-black font-medium"
                  : dark
                    ? "text-gray-500"
                    : "text-gray-500"
              }`}
            >
              {line.value}
            </span>
          </div>
        ))}
      </div>

      {footer && (
        <p className={`mt-8 border-t pt-6 text-sm leading-relaxed ${dark ? "border-white/10 text-gray-400" : "border-gray-200 text-gray-600"}`}>
          {footer}
        </p>
      )}
    </div>
  );
}
