import { Hero } from "@/components/Hero";
import { RealWorld } from "@/components/home/RealWorld";
import { IndustriesTeaser } from "@/components/home/IndustriesTeaser";
import { PlatformStack } from "@/components/home/PlatformStack";
import { DeploymentModel } from "@/components/home/DeploymentModel";
import { CompoundingTeaser } from "@/components/home/CompoundingTeaser";
import { InsightsTeaser } from "@/components/home/InsightsTeaser";
import { FinancialCase } from "@/components/home/FinancialCase";
import { CTA } from "@/components/CTA";
import { Reveal } from "@/components/Reveal";

export default function Home() {
  return (
    <main className="relative">
      <Hero />
      <Reveal>
        <RealWorld />
      </Reveal>
      <Reveal>
        <PlatformStack />
      </Reveal>
      <Reveal>
        <IndustriesTeaser />
      </Reveal>
      <Reveal>
        <DeploymentModel />
      </Reveal>
      <Reveal>
        <CompoundingTeaser />
      </Reveal>
      <Reveal>
        <InsightsTeaser />
      </Reveal>
      <Reveal>
        <FinancialCase />
      </Reveal>
      <Reveal>
        <CTA />
      </Reveal>
    </main>
  );
}
