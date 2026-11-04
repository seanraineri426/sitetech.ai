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
 * Casino-style answer card. State is never carried by color alone: selected
 * cards also gain a check mark, a filled badge, and heavier text.
 */
export function OptionItem({ kind, name, value, label, checked, index, onChange, onCommit }: Props) {
  const letter = String.fromCharCode(65 + index);
  const arrowNav = useRef(false);
  return (
    <motion.label
      whileTap={{ scale: 0.985 }}
      onClick={() => {
        // Any click commits and advances, except the clicks a browser synthesizes
        // while arrow keys move through radios (those only change the selection).
        if (kind === "single" && !arrowNav.current) onCommit?.();
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.045, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative flex min-h-[56px] cursor-pointer items-center gap-4 border px-4 py-3 text-left text-[15px] leading-snug transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold ${
        checked
          ? "border-gold bg-gold font-semibold text-black shadow-[0_0_32px_rgba(245,196,81,0.35)]"
          : "border-white/15 bg-white/[0.03] text-white hover:border-gold/70 hover:bg-white/[0.07]"
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
        className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-xs transition-colors ${
          checked ? "border-black bg-black text-gold" : "border-white/30 text-gray-300 group-hover:border-gold group-hover:text-gold"
        }`}
      >
        {kind === "multi" ? checked ? <CheckIcon className="h-3.5 w-3.5" /> : letter : letter}
      </span>
      <span className="flex-1">{label}</span>
      {checked && kind === "single" && <CheckIcon className="h-5 w-5 shrink-0" />}
    </motion.label>
  );
}
