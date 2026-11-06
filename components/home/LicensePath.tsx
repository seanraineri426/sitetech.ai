"use client";

import { DataFitQuiz } from "@/components/data-fit/DataFitQuiz";
import { PUBLISHED_RANGE_TEXT } from "@/lib/data-fit/benchmarks";

/**
 * Door 1: archive / ops data licensing fit check.
 */
export function LicensePath() {
  return (
    <section id="license" className="section-dark-solid scroll-mt-24 border-t border-white/10 text-white">
      <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-28">
        <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-gold">Door one</p>
            <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-tight sm:text-4xl lg:text-5xl">
              License the records you already keep.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg">
              AI labs and data partners license company records from construction, real estate, design, home
              services, and other operating businesses. Answer a few questions for a modeled estimate. No
              uploads.
            </p>
            <p className="mt-6 max-w-xl border-l-2 border-gold pl-4 text-sm leading-relaxed text-gray-200">
              Published offer ranges of{" "}
              <span className="font-semibold text-gold">{PUBLISHED_RANGE_TEXT}</span> show up for construction
              and design records.{" "}
              <span className="text-gray-400">Published offers, not completed sales or a promise of payment.</span>
            </p>
          </div>

          <div id="quiz" className="scroll-mt-24">
            <DataFitQuiz origin="home-license" embedded />
          </div>
        </div>
      </div>
    </section>
  );
}
