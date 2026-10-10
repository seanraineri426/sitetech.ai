"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { HeroSchematic } from "./HeroSchematic";

const HeroCanvas = dynamic(() => import("./HeroCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
});

const pillars = [
  { label: "01", title: "Connect your stack", detail: "Email, Excel, Procore, Yardi — linked, not replaced" },
  { label: "02", title: "Deploy specialized agents", detail: "Acquisitions to lease-up, each with defined permissions" },
  { label: "03", title: "Stay in control", detail: "Agents automate the work. Humans keep the decisions" },
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
              AI infrastructure for real estate
            </p>

            <h1 className="headline max-w-[16ch]">
              Turn your real estate technology stack into an AI operating system.
            </h1>

            <p className="body-lg mt-6 max-w-2xl">
              SiteTech designs, deploys, and manages AI agents for real estate
              companies. We connect the software your team already uses and automate
              the work that moves between it.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <Link href="/pricing#contact" className="btn-primary">
                Book an AI Workflow Assessment
              </Link>
              <Link href="/solutions" className="link-arrow text-gray-400">
                Explore use cases
                <span aria-hidden>→</span>
              </Link>
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
