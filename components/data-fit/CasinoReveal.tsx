"use client";

import { useState, type RefObject } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  CATEGORY_BASE_USD,
  CATEGORY_NAME,
  CATEGORY_WEIGHTS_PCT,
  FORMAT_NAME,
  FORMAT_PCT,
  FRESHNESS_NAME,
  FRESHNESS_PCT,
  RIGHTS_NAME,
  RIGHTS_PCT,
  SCOPE_NAME,
  SCOPE_PCT,
  formatUsd,
  type Valuation,
} from "@/lib/data-fit/valuation";
import { CoinBurst } from "./casino-bits";
import { BenchmarkGauge } from "./BenchmarkGauge";
import { ReelNumber } from "./Reels";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.05 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function mult(pct: number) {
  return `x${(pct / 100).toFixed(2)}`;
}

function Table({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold/80">{title}</p>
      <dl className="mt-2 divide-y divide-white/10 border-y border-white/10 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-1.5">
            <dt className="text-gray-300">{k}</dt>
            <dd className="font-mono text-white">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function CasinoReveal({
  valuation,
  headingRef,
  onSettled,
}: {
  valuation: Valuation;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSettled?: () => void;
}) {
  const reduce = useReducedMotion();
  const [settled, setSettled] = useState(false);
  const [copied, setCopied] = useState(false);
  const v = valuation;
  const citation = `${v.model}. Ref ${v.reference}. Modeled value ${formatUsd(v.amountUsd)} (range ${formatUsd(
    v.lowUsd,
  )} to ${formatUsd(v.highUsd)}). Quiz ${v.quizVersion}. Based on self-reported answers; not an appraisal, quote, or offer.`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  const win = v.amountUsd > 0;

  return (
    <section className="relative overflow-hidden px-5 pb-10 pt-10 sm:px-8" aria-labelledby="reveal-heading">
      {settled && !reduce && <div aria-hidden className="flash-overlay pointer-events-none absolute inset-0 z-10" />}
      {settled && !reduce && win && <CoinBurst />}

      <p className="text-center font-mono text-[11px] uppercase tracking-[0.3em] text-gold/80">
        {settled ? "Vault open" : "Rolling your number"}
      </p>
      <h3
        id="reveal-heading"
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-center text-xl font-medium tracking-tight text-white outline-none sm:text-2xl"
      >
        Your modeled value
      </h3>

      <div className="mt-8">
        <ReelNumber value={v.amountUsd} onSettled={() => {
            setSettled(true);
            onSettled?.();
          }} />
      </div>

      <div aria-live="polite" className="mt-5 min-h-[28px] text-center">
        {settled && (
          <motion.p
            initial={reduce ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 16 }}
            className="inline-flex items-center gap-3 font-mono text-xs uppercase tracking-[0.25em]"
          >
            <span className={`border px-3 py-1 ${win ? "border-gold bg-gold text-black" : "border-white/40 text-white"}`}>
              {v.held ? "Held" : `${v.tier} tier`}
            </span>
            {win && (
              <span className="text-gray-300">
                Range {formatUsd(v.lowUsd)} to {formatUsd(v.highUsd)}
              </span>
            )}
          </motion.p>
        )}
      </div>

      {settled && (
        <motion.div variants={container} initial={reduce ? "show" : "hidden"} animate="show" className="mx-auto mt-10 max-w-2xl space-y-8">
          {v.held && (
            <motion.div variants={item} className="border border-white/30 p-4 text-sm leading-relaxed text-gray-200">
              {v.held === "restricted"
                ? "Held. Outside use is off-limits for this set, so the Rights multiplier is x0.00 and the model returns $0. The boost below shows what a separate, green-lit collection would model."
                : "Held. No identifiable record category was selected, so the base value is $0. Name at least one category to give the model something to work with."}
            </motion.div>
          )}

          {/* Formula */}
          <motion.div variants={item}>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">How the number is calculated</p>
            <div className="mt-3 border border-gold/30">
              <div className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-white/10 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">Base value</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-gray-400">
                    {v.baseItems.length === 0 && <li>No record category selected</li>}
                    {v.baseItems.map((b) => (
                      <li key={b.key}>
                        {b.name}: {formatUsd(b.valueUsd)} at {b.weightPct}%
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="self-start font-mono text-sm text-white">{formatUsd(v.baseUsd)}</p>
              </div>
              {v.factors.map((f) => (
                <div key={f.key} className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{f.label}</p>
                    <p className="text-xs text-gray-400">{f.choice}</p>
                  </div>
                  <p className="self-start font-mono text-sm text-gold">{mult(f.pct)}</p>
                </div>
              ))}
              <div className="grid grid-cols-[1fr_auto] gap-x-4 bg-gold/10 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">Modeled value</p>
                  <p className="text-xs text-gray-400">
                    {formatUsd(Math.round(v.rawUsd))} before rounding to the nearest $100
                  </p>
                </div>
                <p className="self-start font-mono text-base font-semibold text-gold">{formatUsd(v.amountUsd)}</p>
              </div>
            </div>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-gray-500">
              Base x Coverage x Format x Freshness x Rights x Cleanliness. Range is 0.7x to 1.4x.
            </p>
          </motion.div>

          <motion.div variants={item}>
            <BenchmarkGauge amountUsd={v.amountUsd} />
          </motion.div>

          {/* Boosts */}
          {v.boosts.length > 0 && (
            <motion.div variants={item}>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">What would raise it</p>
              <ul className="mt-3 space-y-2">
                {v.boosts.map((b) => (
                  <li key={b.key} className="flex items-center justify-between gap-4 border border-white/15 px-4 py-3 text-sm text-gray-200">
                    <span>{b.label}</span>
                    <span className="font-mono font-semibold text-gold">+{formatUsd(b.deltaUsd)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-500">
                Each boost reruns the same formula with that one answer improved. It is not legal advice.
              </p>
            </motion.div>
          )}

          {/* Citation */}
          <motion.div variants={item} className="border border-gold/40 bg-gold/[0.06] p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">Cite this number</p>
            <p className="mt-2 break-words font-mono text-sm leading-relaxed text-white">{citation}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={copy}
                className="min-h-[44px] border border-gold px-4 font-mono text-xs uppercase tracking-[0.18em] text-gold transition hover:bg-gold hover:text-black"
              >
                {copied ? "Copied" : "Copy citation"}
              </button>
              <span className="font-mono text-sm text-gold" aria-label={`Reference ${v.reference}`}>
                {v.reference}
              </span>
            </div>
          </motion.div>

          <motion.details variants={item} className="group border border-white/15 px-4 py-3">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.2em] text-gray-300 outline-none focus-visible:text-gold">
              Model assumptions ({v.model})
            </summary>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <Table
                title="Base per category"
                rows={Object.entries(CATEGORY_BASE_USD).map(([k, n]) => [CATEGORY_NAME[k as keyof typeof CATEGORY_NAME], formatUsd(n)])}
              />
              <Table
                title="Category weights, highest first"
                rows={CATEGORY_WEIGHTS_PCT.map((w, i) => [`Category ${i + 1}`, `${w}%`])}
              />
              <Table title="Coverage" rows={Object.entries(SCOPE_PCT).map(([k, n]) => [SCOPE_NAME[k as keyof typeof SCOPE_NAME], mult(n)])} />
              <Table title="Format" rows={Object.entries(FORMAT_PCT).map(([k, n]) => [FORMAT_NAME[k as keyof typeof FORMAT_NAME], mult(n)])} />
              <Table title="Freshness" rows={Object.entries(FRESHNESS_PCT).map(([k, n]) => [FRESHNESS_NAME[k as keyof typeof FRESHNESS_NAME], mult(n)])} />
              <Table title="Rights" rows={Object.entries(RIGHTS_PCT).map(([k, n]) => [RIGHTS_NAME[k as keyof typeof RIGHTS_NAME], mult(n)])} />
              <Table
                title="Cleanliness"
                rows={[
                  ["Clear to license as-is", "x1.00"],
                  ["Each carve-out flagged", "minus 0.12"],
                  ["Deal scope unsure", "x0.80"],
                  ["Floor", "x0.50"],
                ]}
              />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-gray-500">
              SiteTech chose these multipliers and calibrated them so a strong, fully permitted collection
              lands inside the published buyer ranges shown above. They are modeling assumptions, not
              market prices, and no buyer has agreed to them.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              Format is inferred from the software you picked. A system of record such as Procore,
              Autodesk, or Yardi counts as structured exports, shared drives and Bluebeam count as digital
              documents, and paper counts down. Team size and the specific tools do not change the number
              on their own. SiteTech uses them to understand which buyers could be a fit.
            </p>
          </motion.details>

          <motion.p variants={item} className="text-xs leading-relaxed text-gray-500">
            This is a modeled estimate computed from your own answers. It is not a quote, appraisal, buyer
            offer, or promise of payment. SiteTech has not reviewed your records, does not buy or price
            datasets, and has not confirmed buyer interest. Any real terms would be set between you and a
            buyer under a separate agreement.
          </motion.p>
        </motion.div>
      )}
    </section>
  );
}
