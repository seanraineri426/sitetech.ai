"use client";

import { useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { formatUsd } from "@/lib/data-fit/valuation";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Endless spinning column used behind the locked gate. Decorative. */
export function SpinningReel({ speed = 0.5, className = "" }: { speed?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`reel-window relative inline-block h-[1em] w-[0.7em] overflow-hidden align-top leading-none ${className}`}
    >
      <span className="reel-spin flex flex-col" style={{ animationDuration: `${speed}s` }}>
        {[...DIGITS, ...DIGITS].map((d, i) => (
          <span key={i} className="block h-[1em] text-center leading-none blur-[1.5px]">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

function Reel({ digit, delay, duration }: { digit: number; delay: number; duration: number }) {
  const strip = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < 3 * 10 + digit + 1; i++) out.push(i % 10);
    return out;
  }, [digit]);
  const total = strip.length;
  const reduce = useReducedMotion();

  return (
    <span className="reel-window relative inline-block h-[1em] w-[0.7em] overflow-hidden align-top leading-none">
      <motion.span
        className="flex flex-col"
        initial={{ y: reduce ? `-${((total - 1) / total) * 100}%` : "0%" }}
        animate={{ y: `-${((total - 1) / total) * 100}%` }}
        transition={{ duration: reduce ? 0 : duration, delay: reduce ? 0 : delay, ease: [0.12, 0.7, 0.1, 1] }}
      >
        {strip.map((d, i) => (
          <span key={i} className="block h-[1em] text-center leading-none">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

/** Total time (ms) until the last reel has stopped for a value. */
export function settleMs(value: number): number {
  const digits = formatUsd(value).replace(/\D/g, "").length;
  const last = digits - 1;
  return Math.round((last * 0.28 + 1.4 + last * 0.32 + 0.2) * 1000);
}

/**
 * Slot-machine number. Reels stop left to right, later reels spin longer.
 * `onSettled` fires once the final reel lands.
 */
export function ReelNumber({ value, onSettled }: { value: number; onSettled: () => void }) {
  const text = formatUsd(value);
  const reduce = useReducedMotion();

  useEffect(() => {
    const t = setTimeout(onSettled, reduce ? 0 : settleMs(value));
    return () => clearTimeout(t);
    // onSettled is intentionally excluded: it is only used for the single settle event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);

  let digitIndex = 0;
  return (
    <div className="flex items-center justify-center gap-[0.06em] font-mono text-[clamp(2.6rem,11vw,5.5rem)] font-semibold leading-none tracking-tight">
      <span className="sr-only">{text}</span>
      <span aria-hidden className="flex items-center gap-[0.06em] text-gold [text-shadow:0_0_28px_rgba(245,196,81,0.5)]">
        {text.split("").map((ch, i) => {
          if (/\d/.test(ch)) {
            const idx = digitIndex++;
            return <Reel key={i} digit={Number(ch)} delay={idx * 0.28} duration={1.4 + idx * 0.32} />;
          }
          return (
            <span key={i} className="inline-block leading-none">
              {ch}
            </span>
          );
        })}
      </span>
    </div>
  );
}
