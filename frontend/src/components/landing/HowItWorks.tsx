import { Card, SectionHeading } from "@/components/ui/Card";
import { TornEdge } from "@/components/zine/Torn";
import { Reveal, Stagger } from "@/components/motion/Reveal";
import { StepDepositArt, StepHoldArt, StepWithdrawArt, ValueGrowth } from "./HowItWorksArt";

const steps = [
  { Art: StepDepositArt, title: "Deposit USDT0", line: "One signature." },
  { Art: StepHoldArt, title: "Hold nUSDT0", line: "Same count, growing value." },
  { Art: StepWithdrawArt, title: "Withdraw", line: "Any time, plus yield." },
];

export function HowItWorks() {
  return (
    <section id="how" className="grain scroll-mt-4 bg-paper">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <SectionHeading eyebrow="How it works" title="Three steps. Then you chill." />
        </Reveal>

        <Stagger className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map(({ Art, title, line }, i) => (
            <Card key={title} className="overflow-hidden">
              <div className="border-b-2 border-ink bg-surface-2/60 px-4 pt-4">
                <Art />
              </div>
              <div className="flex items-baseline gap-3 p-6">
                <span className="font-display text-[40px] leading-none text-ocean [text-shadow:2px_2px_0_var(--ink)]">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="font-display text-[22px] uppercase leading-tight">{title}</h3>
                  <p className="mt-1 text-[15px] text-muted">{line}</p>
                </div>
              </div>
            </Card>
          ))}
        </Stagger>

        <Reveal>
          <div className="paper-card mt-8 grid items-center gap-8 !bg-navy p-7 text-paper sm:p-10 md:grid-cols-[1fr_1.1fr] [&>*]:min-w-0">
            <h3 className="font-display text-[28px] uppercase leading-tight sm:text-[38px]">
              Your <span className="normal-case">n</span>USDT0 count never changes.{" "}
              <span className="text-clown">Its value does.</span>
            </h3>
            <ValueGrowth />
          </div>
        </Reveal>
      </div>
      <TornEdge to="var(--ocean)" seed={14} fringe={false} grain />
    </section>
  );
}
