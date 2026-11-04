import { Hero } from "@/components/Hero";
import { Opportunity } from "@/components/home/Opportunity";
import { Process } from "@/components/home/Process";
import { Audience } from "@/components/home/Audience";
import { Control } from "@/components/home/Control";
import { FitCheckSection } from "@/components/home/FitCheckSection";
import { FAQ } from "@/components/home/FAQ";
import { CTA } from "@/components/CTA";
import { Reveal } from "@/components/Reveal";

export default function Home() {
  return (
    <main className="relative">
      <Hero />
      <Reveal>
        <Opportunity />
      </Reveal>
      <Reveal>
        <Process />
      </Reveal>
      <Reveal>
        <Audience />
      </Reveal>
      <Reveal>
        <Control />
      </Reveal>
      {/* No Reveal here: the quiz must be reachable immediately from deep links and never animate while in use. */}
      <FitCheckSection />
      <Reveal>
        <FAQ />
      </Reveal>
      <Reveal>
        <CTA href="/#data-fit" />
      </Reveal>
    </main>
  );
}
