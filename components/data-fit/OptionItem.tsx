"use client";

type OptionItemProps = {
  kind: "single" | "multi";
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  describedBy?: string;
};

/**
 * One selectable row. Native radio/checkbox semantics are preserved (the input
 * is visually hidden, not removed); the selected state is conveyed by border
 * weight, an indicator glyph, and font weight — never color alone.
 */
export function OptionItem({ kind, name, value, label, checked, onChange, describedBy }: OptionItemProps) {
  const id = `${name}-${value}`;
  return (
    <label
      htmlFor={id}
      className={`group flex min-h-[48px] cursor-pointer items-center gap-4 border px-4 py-3 text-left text-sm leading-snug transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-current ${
        checked
          ? "border-black bg-black font-medium text-white"
          : "border-gray-300 bg-white text-black hover:border-gray-500"
      }`}
    >
      <input
        id={id}
        type={kind === "single" ? "radio" : "checkbox"}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        aria-describedby={describedBy}
        className="sr-only"
      />
      <span
        aria-hidden
        className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
          kind === "single" ? "rounded-full" : ""
        } ${checked ? "border-white" : "border-gray-400"}`}
      >
        {checked ? (
          kind === "single" ? (
            <span className="h-2 w-2 rounded-full bg-white" />
          ) : (
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M2 6.5 4.8 9 10 3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        ) : null}
      </span>
      <span>{label}</span>
    </label>
  );
}
