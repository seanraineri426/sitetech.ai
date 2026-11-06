import { Hero } from "@/components/Hero";
import { LicensePath } from "@/components/home/LicensePath";
import { RoboticsPath } from "@/components/home/RoboticsPath";
import { Process } from "@/components/home/Process";
import { FAQ } from "@/components/home/FAQ";
import { CTA } from "@/components/CTA";
import { LICENSE_HREF, RECORD_HREF } from "@/lib/doors";

export default function Home() {
  return (
    <main className="relative">
      <Hero />
      <LicensePath />
      <RoboticsPath />
      <Process />
      <FAQ />
      <CTA
        title="Pick a door and take the next step."
        body="License the records you already keep, or explore robotics training footage from field work. SiteTech introduces you only with your approval."
        href={LICENSE_HREF}
        label="License my records"
        secondaryHref={RECORD_HREF}
        secondaryLabel="Record my work"
      />
    </main>
  );
}
