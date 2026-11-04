"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Answers } from "@/lib/data-fit/questions";
import { chipsFor, safetyScore } from "@/lib/data-fit/valuation";
import { CoinIcon, LockIcon, ShieldIcon, useTween } from "./casino-bits";

/**
 * The jackpot window: a masked, pulsing placeholder. It never shows digits, so
 * nothing on screen can be mistaken for the real number. It pulses faster each
 * round so the visitor feels the vault getting closer.
 */
function LockedJackpot({ round, total }: { round: number; total: number }) {
  const heat = Math.min(1, round / total);
  const reduce = useReducedMotion();
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-gold/80">
        <LockIcon className="h-3.5 w-3.5" /> Your number
      </p>
      <motion.p
        aria-hidden
        className="mt-1 select-none font-mono text-2xl font-semibold tracking-[0.18em] text-gold sm:text-3xl"
        animate={reduce ? undefined : { opacity: [0.45, 1, 0.45] }}
        transition={{ duration: Math.max(0.5, 1.8 - heat * 1.3), repeat: Infinity, ease: "easeInOut" }}
        style={{ textShadow: `0 0 ${8 + heat * 22}px rgba(245,196,81,${0.25 + heat * 0.45})` }}
      >
        $???,???
      </motion.p>
      <span className="sr-only">Your valuation number is locked until the end.</span>
    </div>
  );
}

export function CasinoHud({
  answers,
  round,
  total,
  sealed = false,
}: {
  answers: Answers;
  /** Number of rounds completed so far, 0 to total. */
  round: number;
  total: number;
  sealed?: boolean;
}) {
  const chips = chipsFor(answers);
  const shown = useTween(chips, 650);
  const safety = safetyScore(answers);
  const safeShown = useTween(safety, 650);
  const prev = useRef(chips);
  const [gain, setGain] = useState<{ id: number; amount: number } | null>(null);
  const [jolt, setJolt] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (chips > prev.current) {
      setGain({ id: Date.now(), amount: chips - prev.current });
      setJolt((j) => j + 1);
    }
    prev.current = chips;
  }, [chips]);

  return (
    <div className="border-b border-gold/20 bg-black/40 px-5 py-4 sm:px-8">
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-4 sm:grid-cols-[1.2fr_1fr_1fr]">
        <LockedJackpot round={round} total={total} />

        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold/80">Chips</p>
          <p
            key={jolt}
            className={`mt-1 flex items-center gap-1.5 font-mono text-2xl font-semibold tabular-nums text-white sm:text-3xl ${jolt && !reduce ? "hud-jolt" : ""}`}
          >
            <CoinIcon className="h-6 w-6 text-gold" />
            {shown.toLocaleString("en-US")}
          </p>
          <AnimatePresence>
            {gain && (
              <motion.span
                key={gain.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: [0, 1, 1, 0], y: -26 }}
                transition={{ duration: 1.1 }}
                onAnimationComplete={() => setGain(null)}
                className="pointer-events-none absolute -top-1 right-0 font-mono text-sm font-semibold text-gold"
                aria-hidden
              >
                +{gain.amount}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <p className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-gold/80">
            <span className="flex items-center gap-1.5">
              <ShieldIcon className="h-3.5 w-3.5" /> Safety
            </span>
            <span className="tabular-nums text-white">{safeShown}%</span>
          </p>
          <div
            role="progressbar"
            aria-label="Safety meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={safety}
            className="mt-2 h-2 w-full overflow-hidden bg-white/10"
          >
            <motion.div
              className="h-full bg-gradient-to-r from-gold-deep via-gold to-gold-soft"
              animate={{ width: `${safety}%` }}
              transition={{ duration: reduce ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
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
          {sealed ? "Vault sealed" : `Round ${Math.min(round + 1, total)} of ${total}`}
        </p>
      </div>
    </div>
  );
}
