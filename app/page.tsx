import { Hero } from "@/components/Hero";
import { Process } from "@/components/home/Process";
import { FAQ } from "@/components/home/FAQ";
import { CTA } from "@/components/CTA";

export default function Home() {
  return (
    <main className="relative">
      {/* The quiz lives in the hero, so it never sits inside an animated wrapper. */}
      <Hero />
      <Process />
      <FAQ />
      <CTA href="/#quiz" />
    </main>
  );
}
