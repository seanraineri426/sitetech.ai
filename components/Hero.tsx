"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { HeroSchematic } from "./HeroSchematic";

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
  return (
    <section className="section-dark-solid relative flex min-h-screen flex-col overflow-hidden text-white">
      <div className="absolute inset-0 z-0" aria-hidden>
        <HeroCanvas />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/40 via-transparent to-black" />

      <div className="relative z-[2] flex flex-1 flex-col justify-center px-6 pt-28 lg:px-10">
        <div className="mx-auto grid w-full max-w-[1400px] items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <p className="section-label mb-6 text-gray-400">
              AI data opportunities for the built environment
            </p>

            <h1 className="headline max-w-[18ch]">
              Your project files could be your next revenue stream.
            </h1>

            <p className="body-lg mt-6 max-w-2xl">
              Your company already creates plans, reports, images, and operating records.
              SiteTech helps you explore whether a permitted collection could be relevant to
              an AI data buyer—and whether an introduction makes sense.
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
              8 short questions. No document uploads. No obligation.
            </p>
          </div>

          <div className="hidden lg:block">
            <HeroSchematic />
          </div>
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
