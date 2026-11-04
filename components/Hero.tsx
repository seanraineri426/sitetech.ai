"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { DataFitQuiz } from "@/components/data-fit/DataFitQuiz";
import { PUBLISHED_RANGE_TEXT } from "@/lib/data-fit/benchmarks";

const HeroCanvas = dynamic(() => import("./HeroCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
});

/**
 * First screen: say what we do in one line, and put the quiz right there so
 * the first tap is one tap away. No intro screen, no extra click.
 */
export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="section-dark-solid relative flex min-h-[100svh] flex-col overflow-hidden text-white">
      <div className="absolute inset-0 z-0" aria-hidden>
        <HeroCanvas />
      </div>

      <div className="absolute inset-0 z-[1]" aria-hidden>
        <Image
          src="/higgsfield/hero-topo.png"
          alt=""
          fill
          priority
          className="object-cover opacity-45"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black" />
      </div>

      <div className="relative z-[2] flex flex-1 flex-col justify-center px-5 pb-12 pt-24 sm:px-6 lg:px-10">
        <div className="mx-auto grid w-full max-w-[1400px] items-center gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-gold">
              AI data licensing for businesses
            </p>

            <h1 className="mt-4 max-w-[16ch] text-[clamp(2.4rem,6.2vw,4.6rem)] font-medium leading-[1.02] tracking-tight">
              AI companies buy business data. What is yours worth?
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-300">
              SiteTech introduces companies in construction, real estate, design, and other industries to AI
              data buyers. Answer 8 quick questions and see a modeled value.
            </p>

            <p className="mt-5 max-w-xl border-l-2 border-gold pl-4 text-base leading-relaxed text-gray-200">
              Buyers publish offer ranges of{" "}
              <span className="font-semibold text-gold">{PUBLISHED_RANGE_TEXT}</span> for construction and design records.{" "}
              <span className="text-gray-500">Published offers, not completed sales or a promise of payment.</span>
            </p>
          </motion.div>

          <motion.div
            id="quiz"
            className="scroll-mt-24"
            initial={reduce ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <DataFitQuiz origin="home-hero" embedded />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
