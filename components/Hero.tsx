"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { BOOKING_URL } from "@/lib/site";
import { LICENSE_HREF, RECORD_HREF } from "@/lib/doors";

const HeroCanvas = dynamic(() => import("./HeroCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
});

/**
 * First screen: SiteTech brand, one hook, two doors.
 * Quiz and robotics flows live in later sections.
 */
export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="section-dark-solid relative flex min-h-[100svh] flex-col overflow-hidden text-white">
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

      <div className="absolute inset-0 z-[1] opacity-50 mix-blend-screen" aria-hidden>
        <HeroCanvas />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/35 md:from-black/90 md:via-black/35 md:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/85" />
        <div className="absolute inset-x-0 top-1/4 h-1/2 bg-black/35 md:hidden" />
      </div>

      <div className="relative z-[2] flex flex-1 flex-col justify-center px-5 pb-16 pt-24 sm:px-6 lg:px-10 lg:pt-28">
        <motion.div
          className="mx-auto w-full max-w-[1400px]"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="max-w-[12ch] text-[clamp(3rem,12vw,5.5rem)] font-medium leading-[0.95] tracking-tight">
            SiteTech{" "}
            <span className="text-gold">AI</span>
          </h1>

          <p className="mt-5 max-w-[22ch] text-[clamp(1.35rem,4.2vw,2.15rem)] font-medium leading-[1.15] tracking-tight text-white">
            Get paid for the records you keep, or for the work your crew films.
          </p>

          <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-300 sm:text-lg">
            Construction, real estate, home services, and trades. Two short checks. Clear numbers.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
            <a
              href={LICENSE_HREF}
              className="cta-gold group inline-flex min-h-[60px] w-full items-center justify-between gap-4 rounded-xl px-6 text-left text-base font-semibold sm:w-auto sm:min-w-[18rem] sm:text-lg"
            >
              <span className="flex flex-col leading-tight">
                <span>License my records</span>
                <span className="mt-0.5 text-xs font-medium text-black/60">See what your archive could be worth</span>
              </span>
              <span className="cta-arrow flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-gold" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M6 13l6 6 6-6" />
                </svg>
              </span>
            </a>

            <a
              href={RECORD_HREF}
              className="inline-flex min-h-[60px] w-full items-center justify-between gap-4 rounded-xl border border-white/25 bg-white/[0.04] px-6 text-left text-base font-semibold text-white transition hover:border-gold/70 hover:bg-white/[0.07] sm:w-auto sm:min-w-[18rem] sm:text-lg"
            >
              <span className="flex flex-col leading-tight">
                <span>Record my work</span>
                <span className="mt-0.5 text-xs font-medium text-gray-400">Estimate payout from crew hours</span>
              </span>
              <span aria-hidden className="text-xl text-gold">↓</span>
            </a>
          </div>

          <p className="mt-5 text-sm text-gray-400">
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
        </motion.div>
      </div>
    </section>
  );
}
