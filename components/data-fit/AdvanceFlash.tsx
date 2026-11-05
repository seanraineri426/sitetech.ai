"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Dopamine micro-reward on each quiz step advance: gold bloom + optional
 * Higgsfield still. No coins, chips, or casino bulbs.
 */
export function AdvanceFlash({ flashKey }: { flashKey: number }) {
  const reduce = useReducedMotion();
  if (reduce || flashKey <= 0) return null;

  return (
    <motion.div
      key={flashKey}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 0.85, times: [0, 0.18, 1], ease: "easeOut" }}
    >
      <Image
        src="/higgsfield/advance-flash.jpg"
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 720px"
        className="object-cover opacity-70 mix-blend-screen"
        priority={false}
      />
      <motion.div
        className="absolute inset-x-0 top-1/3 h-px bg-gradient-to-r from-transparent via-gold to-transparent"
        initial={{ scaleX: 0.2, opacity: 0 }}
        animate={{ scaleX: 1.4, opacity: [0, 1, 0] }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className="absolute left-1/2 top-[28%] h-40 w-40 -translate-x-1/2 rounded-full bg-gold/30 blur-3xl"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1.8, opacity: [0, 0.9, 0] }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </motion.div>
  );
}
