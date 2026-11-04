"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { HeroVisual } from "./home/HeroVisual";

const HeroCanvas = dynamic(() => import("./HeroCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
});

const pillars = [
  {
    label: "01",
    title: "The labs need it all the time",
    detail: "AI research labs and data buyers are constantly looking for fresh, real-world training data.",
  },
  {
    label: "02",
    title: "You should not go in blind",
    detail: "Labs do this for a living. Most owners have never sold data once. SiteTech helps you start smart.",
  },
  {
    label: "03",
    title: "Nothing happens without your yes",
    detail: "No introduction, no files, and no deal unless you approve it first.",
  },
];

export function Hero() {
  return (
    <section className="section-dark-solid hero-panel relative flex min-h-screen flex-col overflow-hidden text-white">
      <div className="absolute inset-0 z-0" aria-hidden>
        <HeroCanvas />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/40 via-transparent to-black" />

      <div className="relative z-[2] flex flex-1 flex-col justify-center px-6 pt-28 lg:px-10">
        <div className="mx-auto grid w-full max-w-[1400px] items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <p className="eyebrow-pill mb-7">
              <span aria-hidden className="h-1.5 w-1.5 bg-white" />
              AI labs are hunting for real-world data
            </p>

            <h1 className="headline-xl max-w-[10.5ch] text-balance">
              AI labs don&apos;t need more internet data. They need yours.
            </h1>

            <p className="body-lg mt-6 max-w-2xl">
              They can scrape the web all day. They can&apos;t scrape your finished jobs: the
              photos, plans, schedules, estimates, inspections, and service records your team
              created over years of real work. That&apos;s the good stuff. SiteTech helps you
              find out if a lab conversation is worth having—without uploading a single file.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <Link href="/#data-fit" className="btn-primary">
                See if mine is the good stuff
              </Link>
              <Link href="/how-it-works" className="link-arrow text-gray-400">
                How this works
                <span aria-hidden>→</span>
              </Link>
            </div>

            <p className="mt-6 font-mono text-[11px] tracking-wide text-gray-500">
              8 quick questions. No uploads. No obligation. You stay in control.
            </p>
          </div>

          <div className="min-w-0 lg:pl-4">
            <HeroVisual />
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
