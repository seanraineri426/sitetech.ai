import { Hero } from "@/components/marketing/Hero";
import { Problem } from "@/components/marketing/Problem";
import { LayerStack } from "@/components/marketing/LayerStack";
import { FlowShowcase } from "@/components/marketing/home/FlowShowcase";
import { AffordableSpotlight } from "@/components/marketing/home/AffordableSpotlight";
import { HowItWorksStrip } from "@/components/marketing/home/HowItWorksStrip";
import { CTA } from "@/components/marketing/CTA";
import { Reveal } from "@/components/marketing/Reveal";

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
