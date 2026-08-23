import { Hero } from "@/components/Hero";
import { Problem } from "@/components/Problem";
import { LayerStack } from "@/components/LayerStack";
import { FlowShowcase } from "@/components/home/FlowShowcase";
import { AffordableSpotlight } from "@/components/home/AffordableSpotlight";
import { HowItWorksStrip } from "@/components/home/HowItWorksStrip";
import { CTA } from "@/components/CTA";
import { Reveal } from "@/components/Reveal";

export default function Home() {
  return (
    <main className="relative">
      <Hero />
      <Reveal>
        <Problem />
      </Reveal>
      <Reveal>
        <LayerStack />
      </Reveal>
      <Reveal>
        <FlowShowcase />
      </Reveal>
      <Reveal>
        <AffordableSpotlight />
      </Reveal>
      <Reveal>
        <HowItWorksStrip />
      </Reveal>
      <Reveal>
        <CTA />
      </Reveal>
    </main>
  );
}
