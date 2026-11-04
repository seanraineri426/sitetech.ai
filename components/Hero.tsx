"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

const HeroCanvas = dynamic(() => import("./HeroCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
});

const pillars = [
  {
    label: "01",
    title: "Start with what you have",
    detail: "A high-level description of the records your business already creates.",
  },
  {
    label: "02",
    title: "Explore a potential introduction",
    detail: "We consider whether a relevant buyer or licensing partner may be worth approaching.",
  },
  {
    label: "03",
    title: "Decide on your terms",
    detail: "You approve any introduction and discuss any proposed arrangement directly.",
  },
];

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="section-dark-solid relative flex min-h-screen flex-col overflow-hidden text-white">
      <div className="absolute inset-0 z-0" aria-hidden>
        <HeroCanvas />
      </div>

      <div className="absolute inset-0 z-[1]" aria-hidden>
        <Image
          src="/higgsfield/hero-topo.png"
          alt=""
          fill
          priority
          className="object-cover opacity-55"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/35" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black" />
      </div>

      <div className="relative z-[2] flex flex-1 flex-col justify-center px-6 pt-28 lg:px-10">
        <div className="mx-auto grid w-full max-w-[1400px] items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="section-label mb-6 text-gray-400">
              AI data opportunities for the built environment
            </p>

            <h1 className="headline max-w-[18ch]">
              Your project files could be your next revenue stream.
            </h1>

            <p className="body-lg mt-6 max-w-2xl">
              Your company already creates plans, reports, images, and operating records.
              SiteTech helps you explore whether a permitted collection could be relevant to
              an AI data buyer, and whether an introduction makes sense.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <Link href="/#data-fit" className="btn-primary">
                Check your data fit
              </Link>
              <Link href="/how-it-works" className="link-arrow text-gray-400">
                See how it works
                <span aria-hidden>→</span>
              </Link>
            </div>

            <p className="mt-6 font-mono text-[11px] tracking-wide text-gray-500">
              8 short questions. Tap to advance. Your email opens the vault at the end.
            </p>
          </motion.div>

          <motion.div
            className="relative hidden overflow-hidden border border-white/15 lg:block"
            initial={reduce ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative aspect-[4/5]">
              <Image
                src="/higgsfield/archive-coins.png"
                alt="Illustrative graphic of project records converting into commercial potential"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 0px, 40vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gray-400">
                  Modeled estimate
                </p>
                <p className="mt-2 text-2xl font-medium tracking-tight">See what your archive could unlock</p>
                <p className="mt-2 text-sm text-gray-400">
                  Chips and a safety meter climb as you answer.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="relative z-[2] mx-auto w-full max-w-[1400px] px-6 pb-10 lg:px-10">
        <div className="grid border-t border-white/10 sm:grid-cols-3">
          {pillars.map((item, i) => (
            <div
              key={item.label}
              className={`py-6 ${i > 0 ? "sm:border-l sm:border-white/10 sm:pl-8" : ""} ${i < pillars.length - 1 ? "border-b border-white/10 sm:border-b-0" : ""}`}
            >
              <p className="font-mono text-[11px] text-gray-500">{item.label}</p>
              <p className="mt-2 text-base font-medium tracking-tight">{item.title}</p>
              <p className="mt-0.5 text-sm text-gray-400">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
