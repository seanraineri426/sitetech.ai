"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Locked modeled-value tease + progress. Digits stay masked until the email
 * gate unlocks the real number. Nothing on screen can be mistaken for it.
 */
function LockedValue({ round, total }: { round: number; total: number }) {
  const heat = Math.min(1, round / total);
  const reduce = useReducedMotion();
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold/80">Your number</p>
      <motion.p
        aria-hidden
        className="mt-1 select-none font-mono text-2xl font-semibold tracking-[0.18em] text-gold sm:text-3xl"
        animate={reduce ? undefined : { opacity: [0.55, 1, 0.55] }}
        transition={{ duration: Math.max(2.4, 3.6 - heat * 0.8), repeat: Infinity, ease: "easeInOut" }}
        style={{ textShadow: `0 0 ${6 + heat * 14}px rgba(245,196,81,${0.2 + heat * 0.3})` }}
      >
        $???,???
      </motion.p>
      <span className="sr-only">Your valuation number is locked until the end.</span>
    </div>
  );
}

export function CasinoHud({
  round,
  total,
  sealed = false,
}: {
  /** Kept for call-site stability. */
  answers?: unknown;
  /** Number of steps completed so far, 0 to total. */
  round: number;
  total: number;
  sealed?: boolean;
}) {
  const reduce = useReducedMotion();
  const pct = Math.round((Math.min(round, total) / total) * 100);

  return (
    <div className="border-b border-gold/20 bg-black/40 px-5 py-4 sm:px-8">
      <div className="flex items-start justify-between gap-6">
        <LockedValue round={round} total={total} />

        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold/80">Progress</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white sm:text-3xl">
            {sealed ? "100%" : `${pct}%`}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <ol className="flex flex-1 gap-1.5" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <li key={i} className="relative h-1.5 flex-1 overflow-hidden bg-white/10">
              <motion.span
                className="absolute inset-0 origin-left bg-gold"
                initial={false}
                animate={{ scaleX: i < round || sealed ? 1 : 0 }}
                transition={{ duration: reduce ? 0 : 0.45, ease: "easeOut" }}
              />
            </li>
          ))}
        </ol>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400">
          {sealed ? "Ready" : `${Math.min(round + 1, total)} of ${total}`}
        </p>
      </div>
    </div>
  );
}
