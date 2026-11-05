"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { CheckIcon } from "./casino-bits";

type Props = {
  kind: "single" | "multi";
  name: string;
  value: string;
  label: string;
  checked: boolean;
  index: number;
  /** Selection changed (pointer, keyboard, or assistive tech). */
  onChange: () => void;
  /** Deliberate commit: a real pointer click or Enter. Single-select advances on this. */
  onCommit?: () => void;
};

/**
 * Clean answer row. Selected state uses gold fill + check, not letter chips.
 */
export function OptionItem({ kind, name, value, label, checked, index, onChange, onCommit }: Props) {
  const arrowNav = useRef(false);
  return (
    <motion.label
      whileTap={{ scale: 0.985 }}
      onClick={() => {
        // Any click commits and advances, except the clicks a browser synthesizes
        // while arrow keys move through radios (those only change the selection).
        if (kind === "single" && !arrowNav.current) onCommit?.();
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 + index * 0.035, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative flex min-h-[56px] cursor-pointer items-center gap-3.5 border px-4 py-3.5 text-left text-[15px] leading-snug transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold ${
        checked
          ? "border-gold bg-gold font-semibold text-black shadow-[0_0_28px_rgba(245,196,81,0.28)]"
          : "border-white/15 bg-white/[0.03] text-white hover:border-gold/60 hover:bg-white/[0.06]"
      }`}
    >
      <input
        type={kind === "multi" ? "checkbox" : "radio"}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        onKeyDown={(e) => {
          if (e.key.startsWith("Arrow")) {
            arrowNav.current = true;
            setTimeout(() => {
              arrowNav.current = false;
            }, 0);
          }
          if (kind === "single" && e.key === "Enter") {
            e.preventDefault();
            onChange();
            onCommit?.();
          }
        }}
        className="sr-only"
      />
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center border transition-colors ${
          kind === "multi" ? "" : "rounded-full"
        } ${
          checked
            ? "border-black bg-black text-gold"
            : "border-white/35 text-transparent group-hover:border-gold/70"
        }`}
      >
        {checked && <CheckIcon className="h-3 w-3" />}
      </span>
      <span className="flex-1">{label}</span>
    </motion.label>
  );
}
