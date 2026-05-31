"use client";

import dynamic from "next/dynamic";
import { HeroSchematic } from "./HeroSchematic";

const HeroCanvas = dynamic(() => import("./HeroCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
});

const pillars = [
  { label: "01", title: "Operational map", detail: "Projects, parcels, contracts, actions" },
  { label: "02", title: "Agentic workflows", detail: "AI that reads, reasons, and routes work" },
  { label: "03", title: "Deployment cell", detail: "AI engineers embedded with your team" },
];

export function Hero() {
  return (
    <section className="section-dark-solid relative flex min-h-screen flex-col overflow-hidden text-white">
      <div className="absolute inset-0 z-0">
        <HeroCanvas />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/40 via-transparent to-black" />

      <div className="relative z-[2] flex flex-1 flex-col justify-center px-6 pt-28 lg:px-10">
        <div className="mx-auto grid w-full max-w-[1400px] items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <p className="section-label mb-6 text-gray-500">
              AI for the real world
            </p>

            <h1 className="headline max-w-[15ch]">
              Software for real estate decisions in motion.
            </h1>

            <p className="body-lg mt-6 max-w-2xl">
              SiteTech AI connects private project data, field evidence, deal files, and
              market intelligence into one governed operating layer. Human teams and AI
              agents work from the same record, so decisions can move from meeting, site,
              parcel, model, and contract into action.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <a href="/pricing#contact" className="btn-primary">
                Start a conversation
              </a>
              <a href="/workflows" className="link-arrow text-gray-400">
                Explore use cases
                <span aria-hidden>→</span>
              </a>
            </div>
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
              <p className="font-mono text-[11px] text-gray-600">{item.label}</p>
              <p className="mt-2 text-base font-medium tracking-tight">{item.title}</p>
              <p className="mt-0.5 text-sm text-gray-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
