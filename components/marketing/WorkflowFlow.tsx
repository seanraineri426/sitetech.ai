import { Fragment } from "react";

type WorkflowFlowProps = {
  title: string;
  caption?: string;
  steps: string[];
  dark?: boolean;
};

/**
 * Horizontal (desktop) / vertical (mobile) chain of workflow steps.
 * Steps should be short — two to five words each.
 */
export function WorkflowFlow({ title, caption, steps, dark = false }: WorkflowFlowProps) {
  const box = dark
    ? "border-white/15 bg-black text-gray-300"
    : "border-gray-300 bg-white text-gray-700";
  const arrow = dark ? "text-gray-500" : "text-gray-400";

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
        {title}
      </p>
      <div className="mt-5 flex flex-col lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-2 lg:gap-y-3">
        {steps.map((step, i) => (
          <Fragment key={step}>
            <span className={`self-start border px-4 py-2.5 font-mono text-[11px] tracking-wide lg:self-auto ${box}`}>
              {step}
            </span>
            {i < steps.length - 1 && (
              <>
                <span aria-hidden className={`hidden lg:inline ${arrow}`}>→</span>
                <span aria-hidden className={`pl-4 leading-none lg:hidden ${arrow}`}>↓</span>
              </>
            )}
          </Fragment>
        ))}
      </div>
      {caption && (
        <p className="mt-4 text-sm leading-relaxed text-gray-500">
          {caption}
        </p>
      )}
    </div>
  );
}
