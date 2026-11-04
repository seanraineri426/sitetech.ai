"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  BENCHMARKS,
  BENCHMARKS_CHECKED,
  BENCHMARK_CAVEAT,
  OFFER_INDEX,
  REALIZED_SALES,
} from "@/lib/data-fit/benchmarks";
import { formatUsd } from "@/lib/data-fit/valuation";

const MIN = 10_000;
const MAX = 5_000_000;
const pos = (n: number) => {
  const c = Math.min(MAX, Math.max(MIN, n));
  return ((Math.log(c) - Math.log(MIN)) / (Math.log(MAX) - Math.log(MIN))) * 100;
};

function compact(n: number) {
  if (n >= 1_000_000) return `$${n / 1_000_000}M`;
  return `$${Math.round(n / 1000)}K`;
}

/** Places the visitor's modeled value on a log scale against published ranges. */
export function BenchmarkGauge({ amountUsd }: { amountUsd: number }) {
  const reduce = useReducedMotion();
  const q1 = pos(OFFER_INDEX.q1Usd);
  const q3 = pos(OFFER_INDEX.q3Usd);
  const ticks = [10_000, 100_000, 1_000_000, 5_000_000];

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">Against published market ranges</p>

      <div className="mt-6 px-2">
        <div className="relative h-3 bg-white/10">
          <div
            aria-hidden
            className="absolute inset-y-0 bg-gold/30"
            style={{ left: `${q1}%`, width: `${q3 - q1}%` }}
          />
          <span aria-hidden className="absolute -top-1 h-5 w-px bg-white/60" style={{ left: `${pos(REALIZED_SALES.medianUsd)}%` }} />
          <span aria-hidden className="absolute -top-1 h-5 w-px bg-gold" style={{ left: `${pos(OFFER_INDEX.medianUsd)}%` }} />
          {amountUsd > 0 && (
            <motion.span
              aria-hidden
              className="absolute -top-3 h-9 w-[3px] bg-white shadow-[0_0_14px_rgba(255,255,255,0.9)]"
              initial={{ left: "0%" }}
              animate={{ left: `${pos(amountUsd)}%` }}
              transition={{ duration: reduce ? 0 : 1.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-white">
                You
              </span>
            </motion.span>
          )}
        </div>
        <div className="relative mt-2 h-4">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 font-mono text-[10px] text-gray-500"
              style={{ left: `${pos(t)}%` }}
            >
              {compact(t)}
            </span>
          ))}
        </div>
      </div>

      <ul className="mt-5 space-y-1 text-xs leading-relaxed text-gray-400">
        <li>
          <span className="text-gold">Gold band</span>: middle half of {OFFER_INDEX.figures} published offers for company
          records, {formatUsd(OFFER_INDEX.q1Usd)} to {formatUsd(OFFER_INDEX.q3Usd)}. Gold line: median offer{" "}
          {formatUsd(OFFER_INDEX.medianUsd)}.
        </li>
        <li>
          <span className="text-white">White line</span>: median of the {REALIZED_SALES.count} public completed sales with a
          stated amount, {formatUsd(REALIZED_SALES.medianUsd)}.
        </li>
      </ul>

      <ul className="mt-5 divide-y divide-white/10 border-y border-white/10">
        {BENCHMARKS.map((b) => (
          <li key={b.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-white underline-offset-4 hover:text-gold hover:underline"
              >
                {b.who}
              </a>
              <span className="font-mono text-gold">
                {formatUsd(b.lowUsd)} to {formatUsd(b.highUsd)}
                {b.openEnded ? "+" : ""}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              <span className="uppercase tracking-wider text-gray-500">{b.kind}.</span> {b.what}. {b.note}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-gray-400">{BENCHMARK_CAVEAT}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-gray-600">
        Sources checked {BENCHMARKS_CHECKED}
      </p>
    </div>
  );
}
