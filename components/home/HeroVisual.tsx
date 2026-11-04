import type { CSSProperties } from "react";
import { HeroSchematic } from "../HeroSchematic";

const kept = ["Job photos", "Plans", "Schedules", "Service logs"];
const removed = ["Names", "Emails", "Phone numbers", "IDs"];

export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div aria-hidden className="absolute -inset-3 border border-white/10 sm:-inset-5" />
      <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 border border-white/10" />

      <div className="relative border border-white/20 bg-black/85 shadow-[0_50px_140px_rgba(0,0,0,0.65)] backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-400">
            Your archive
          </span>
          <span className="record-chip border-white text-white">
            <span aria-hidden className="h-1.5 w-1.5 bg-white" />
            Not uploaded
          </span>
        </div>

        <div className="px-5 pt-2 sm:px-6">
          <HeroSchematic />
        </div>

        <div className="grid border-t border-white/10 sm:grid-cols-2">
          <div className="border-b border-white/10 p-5 sm:border-b-0 sm:border-r">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">
              What labs want to see
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {kept.map((item) => (
                <span key={item} className="record-chip border-white/20 text-gray-200">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">
              Removed before training
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {removed.map((item) => (
                <span key={item} className="record-chip border-white/10 text-gray-500 line-through decoration-white/60">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className="float-card absolute -left-4 top-24 hidden w-52 border border-white bg-white p-4 text-black shadow-[0_24px_60px_rgba(0,0,0,0.45)] xl:block"
        style={{ "--float-rotate": "-2deg" } as CSSProperties}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">The good stuff</p>
        <p className="mt-2 text-sm font-medium leading-snug">
          Real projects. Real outcomes. Not scrapeable.
        </p>
      </div>

      <div
        className="float-card absolute -right-5 bottom-28 hidden w-60 border border-white/25 bg-black p-4 text-white shadow-[0_24px_60px_rgba(0,0,0,0.55)] xl:block"
        style={{ "--float-rotate": "1.5deg", animationDelay: "1.2s" } as CSSProperties}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">Owner control</p>
        <p className="mt-2 text-sm font-medium leading-snug">
          No buyer sees your company until you approve exactly who it is.
        </p>
      </div>
    </div>
  );
}
