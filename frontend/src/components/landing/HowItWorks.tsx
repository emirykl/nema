import { Caps } from "@/components/ui/Caps";
import { Card, SectionHeading } from "@/components/ui/Card";
import { TornEdge } from "@/components/zine/Torn";

const steps = [
  {
    title: "Deposit USDT0",
    body: "Connect Freighter, Lobstr or any Stellar wallet. One signature moves USDT0 into the vault contract.",
  },
  {
    title: "Hold nUSDT0",
    body: "A receipt token lands in your wallet. Your count stays fixed; each one is worth more USDT0 over time.",
  },
  {
    title: "Withdraw any time",
    body: "Return nUSDT0, get USDT0 plus yield. Withdrawals can never be paused, not even by the admin.",
  },
];

const priceRows = [
  { when: "Day 0", assets: "100,000", price: "1.0000" },
  { when: "Month 3", assets: "100,150", price: "1.0015" },
  { when: "Month 12", assets: "100,600", price: "1.0060" },
];

export function HowItWorks() {
  return (
    <section id="how" className="grain scroll-mt-4 bg-paper">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <SectionHeading eyebrow="How it works" title="Three steps. Then you chill.">
          A yield vault, not a lending app and not staking. Nema routes USDT0 to vetted on-chain strategies and
          compounds what they earn.
        </SectionHeading>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <Card key={step.title} className="p-7">
              <div className="font-display text-[64px] leading-none text-ocean [text-shadow:3px_3px_0_var(--ink)]">
                0{i + 1}
              </div>
              <h3 className="mt-5 font-display text-[24px] uppercase leading-tight">
                <Caps>{step.title}</Caps>
              </h3>
              <p className="mt-3 text-[16px] leading-relaxed text-muted">{step.body}</p>
            </Card>
          ))}
        </div>

        <div className="paper-card mt-8 grid items-center gap-8 !bg-navy p-7 text-paper sm:p-10 md:grid-cols-[1fr_1.1fr] [&>*]:min-w-0">
          <div>
            <h3 className="font-display text-[28px] uppercase leading-tight sm:text-[34px]">
              Your <span className="normal-case">n</span>USDT0 count never changes.{" "}
              <span className="text-clown">Its value does.</span>
            </h3>
            <p className="mt-4 text-[16px] leading-relaxed text-paper/70">
              Share price = USDT0 in the vault ÷ nUSDT0 in circulation. As strategies earn, the vault holds more USDT0
              for the same shares. Example at 0.6% a year, before the 10% performance fee:
            </p>
          </div>
          <div className="min-w-0 overflow-x-auto rounded border-2 border-paper/30">
            <table className="tabular w-full text-left text-[14px] sm:text-[16px]">
              <thead className="label bg-paper/10 text-[14px] text-paper/60">
                <tr>
                  <th className="px-3 py-3 sm:px-4">When</th>
                  <th className="px-3 py-3 sm:px-4">USDT0 in vault</th>
                  <th className="px-3 py-3 text-right sm:px-4">1 nUSDT0 =</th>
                </tr>
              </thead>
              <tbody>
                {priceRows.map((row) => (
                  <tr key={row.when} className="border-t border-paper/15">
                    <td className="px-3 py-3 text-paper/70 sm:px-4">{row.when}</td>
                    <td className="px-3 py-3 sm:px-4">{row.assets}</td>
                    <td className="px-3 py-3 text-right font-bold text-clown sm:px-4">{row.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <TornEdge to="var(--ocean)" seed={14} fringe={false} />
    </section>
  );
}
