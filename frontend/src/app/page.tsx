import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { IdleStats } from "@/components/landing/IdleStats";
import { FinalCta, Safety } from "@/components/landing/Safety";
import { YieldSources } from "@/components/landing/YieldSources";

export default function Home() {
  return (
    <>
      <Hero />
      <IdleStats />
      <HowItWorks />
      <YieldSources />
      <Safety />
      <FinalCta />
    </>
  );
}
