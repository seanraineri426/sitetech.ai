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
    title: "You already did the hard part",
    detail: "Your team created the plans, photos, reports, and records doing real work.",
  },
  {
    label: "02",
    title: "We explore who may want to talk",
    detail: "SiteTech looks at whether an AI lab or licensing partner conversation makes sense.",
  },
  {
    label: "03",
    title: "Nothing happens without your yes",
    detail: "No introduction, no files, and no deal unless you approve it first.",
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
              Your old project files may have a second life
            </p>

            <h1 className="headline max-w-[18ch]">
              The jobs you already finished could pay you again.
            </h1>

            <p className="body-lg mt-6 max-w-2xl">
              AI companies need real project photos, plans, schedules, and records to teach
              their software how buildings actually get built and run. You already paid your
              team to create those files. SiteTech helps you find out if a buyer conversation
              is worth having—without uploading a single file.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <Link href="/#data-fit" className="btn-primary">
                See if my files could be worth money
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
