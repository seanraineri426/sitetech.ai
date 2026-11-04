import Image from "next/image";
import { DataFitQuiz } from "@/components/data-fit/DataFitQuiz";

export function FitCheckSection() {
  return (
    <section id="data-fit" className="section-light scroll-mt-24 border-t border-gray-200">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="section-label mb-6">Find your starting point</p>
            <h2 className="headline-sm">Could your company&apos;s records be relevant?</h2>
            <p className="mt-6 text-base leading-relaxed text-gray-600">
              Answer eight short questions. Tap once to advance. Chips and a safety meter climb as you
              go, then your email opens the vault on a modeled value you can calculate and cite.
            </p>

            <div className="relative mt-10 aspect-[16/10] overflow-hidden border border-gray-200">
              <Image
                src="/higgsfield/vault-reveal.png"
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 p-5 text-white">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-300">
                  End of quiz
                </p>
                <p className="mt-2 text-lg font-medium tracking-tight">
                  Your modeled value unlocks at the end
                </p>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <DataFitQuiz
              origin="home-fit-check"
              returnHref="/#data-fit"
              returnLabel="Return to this section"
              startLabel="Start the fit check"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
