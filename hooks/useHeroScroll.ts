"use client";

import { useEffect, useState } from "react";

/** Raw scroll progress 0→1 over the hero transition track (default 2 viewport heights). */
export function useHeroScroll(viewportMultiplier = 2) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const max = window.innerHeight * viewportMultiplier;
      setProgress(Math.min(1, Math.max(0, window.scrollY / max)));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [viewportMultiplier]);

  return progress;
}

export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

/** Remap scroll into a 0→1 range between start and end thresholds. */
export function remap(scroll: number, start: number, end: number) {
  return clamp01((scroll - start) / (end - start));
}
