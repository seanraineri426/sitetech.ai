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

export function ShieldIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M12 3 5 6v5.5c0 4.2 2.8 7.6 7 9.5 4.2-1.9 7-5.3 7-9.5V6l-7-3Z" strokeLinejoin="round" />
      <path d="m9 12 2.2 2.2L15.5 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CoinIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5.2" opacity="0.5" />
      <path d="M12 8.6v6.8M10.2 10.4c0-.8.8-1.2 1.8-1.2s1.8.4 1.8 1.2c0 1.7-3.6.8-3.6 2.4 0 .8.8 1.2 1.8 1.2s1.8-.4 1.8-1.2" strokeLinecap="round" />
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

/** Gold coin shower. Decorative only; the parent decides whether to mount it. */
export function CoinBurst() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const parts = Array.from({ length: 160 }, () => ({
      x: width / 2 + (Math.random() - 0.5) * 80,
      y: height * 0.3,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 14 - 4,
      r: 3 + Math.random() * 5,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.45,
      color: Math.random() > 0.45 ? "#f5c451" : "#fff3c4",
    }));

    const t0 = performance.now();
    let raf = 0;
    const DURATION = 3400;
    const tick = (t: number) => {
      const el = t - t0;
      ctx.clearRect(0, 0, width, height);
      for (const p of parts) {
        p.vy += 0.4;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - el / DURATION);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.5 * Math.abs(Math.cos(p.rot * 2)) + 1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (el < DURATION) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, width, height);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-20 h-full w-full" />;
}
