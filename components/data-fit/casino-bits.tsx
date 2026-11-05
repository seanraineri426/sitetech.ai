"use client";

import { useEffect, useRef, useState } from "react";

export function LockIcon({ className = "h-5 w-5", open = false }: { className?: string; open?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d={open ? "M8 11V8a4 4 0 0 1 7.5-2" : "M8 11V8a4 4 0 0 1 8 0v3"} strokeLinecap="round" />
      <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={className} aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Eases a displayed integer toward `target`. Snaps when reduced motion is on. */
export function useTween(target: number, ms = 700) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const raf = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const a = from.current;
    if (reduce || a === target) {
      from.current = target;
      setValue(target);
      return;
    }
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = a + (target - a) * eased;
      from.current = cur;
      setValue(Math.round(cur));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);

  return value;
}
