"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { DataFitQuiz } from "@/components/data-fit/DataFitQuiz";
import { PUBLISHED_RANGE_TEXT } from "@/lib/data-fit/benchmarks";
import { BOOKING_URL } from "@/lib/site";

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
      {/* Backdrop: generated art, darkest on the left where the headline sits. */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-black" aria-hidden>
        <div className="hero-backdrop-drift absolute inset-0">
          <Image
            src="/higgsfield/hero-backdrop-mobile.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[72%_center] md:hidden"
          />
          <Image
            src="/higgsfield/hero-backdrop.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="hidden object-cover object-right md:block"
          />
        </div>
      </div>

      {/* Particles blend on top of the art (screen: the canvas black adds nothing). */}
      <div className="absolute inset-0 z-[1] opacity-50 mix-blend-screen" aria-hidden>
        <HeroCanvas />
      </div>

      {/* Readability overlays for headline, button, note and quiz card. */}
      <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/35 md:from-black/90 md:via-black/35 md:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/85" />
        <div className="absolute inset-x-0 top-1/4 h-1/2 bg-black/35 md:hidden" />
      </div>

      <div className="relative z-[2] flex flex-1 flex-col justify-center px-5 pb-12 pt-20 sm:px-6 lg:px-10 lg:pt-24">
        <div className="mx-auto grid w-full max-w-[1400px] items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
          {/* On phones this block fills the first screen (hook + button); the quiz is the next screen. */}
          <motion.div
            className="flex min-h-[calc(100svh-6.5rem)] flex-col justify-center pb-4 lg:block lg:min-h-0 lg:pb-0"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-gold">
              AI data licensing for businesses
            </p>

            <h1 className="mt-4 max-w-[16ch] text-[clamp(2.6rem,11vw,4.6rem)] font-medium leading-[1.02] tracking-tight lg:text-[clamp(2.4rem,6.2vw,4.6rem)]">
              AI companies buy business data. What is yours worth?
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg">
              SiteTech introduces companies in construction, real estate, design, and other industries to AI
              data buyers.
            </p>

            <div className="mt-7">
              <a
                href="#quiz"
                className="cta-gold group inline-flex min-h-[60px] w-full items-center justify-between gap-4 rounded-xl px-6 text-left text-base font-semibold sm:w-auto sm:min-w-[22rem] sm:text-lg"
              >
                <span>See what my data is worth</span>
                <span className="cta-arrow flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-gold" aria-hidden>
                  <svg viewBox="0 0 24 24" className="h-5 w-5 lg:hidden" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M6 13l6 6 6-6" />
                  </svg>
                  <svg viewBox="0 0 24 24" className="hidden h-5 w-5 lg:block" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </a>
              <p className="mt-3 text-sm text-gray-400">
                Prefer to talk?{" "}
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold underline-offset-4 hover:underline"
                >
                  Book a call
                </a>
              </p>
            </div>

            <p className="mt-6 max-w-xl border-l-2 border-gold pl-4 text-sm leading-relaxed text-gray-200 sm:text-base">
              Buyers publish offer ranges of{" "}
              <span className="font-semibold text-gold">{PUBLISHED_RANGE_TEXT}</span> for construction and design records.{" "}
              <span className="text-gray-400">Published offers, not completed sales or a promise of payment.</span>
            </p>
          </motion.div>

          <motion.div
            id="quiz"
            className="scroll-mt-20 lg:scroll-mt-24"
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
