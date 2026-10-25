import { NemaFish } from "@/components/illustrations/NemaFish";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/Card";
import { Tape, TornEdge } from "@/components/zine/Torn";

const guarantees = [
  ["Non-custodial", "Funds sit in the vault contract, never with the team. The site is just an interface; you can call the contract directly."],
  ["Withdrawals always open", "Pause stops new deposits. It cannot stop you from leaving. That rule lives in the contract and is covered by tests."],
  ["Peg guard", "A SEP-40 price feed watches USDT0. If it drifts from $1, deposits halt and funds unwind from strategies."],
  ["Caps and a timelock", "Every strategy has a hard cap. New strategies wait out a timelock, so everyone can exit first."],
];

export function Safety() {
  return (
    <section className="bg-navy">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <SectionHeading eyebrow="Safety" title={<>Nobody runs off <span className="text-clown">with the pond.</span></>} dark>
          The admin can pause deposits and tune allocations within caps. The admin cannot send your USDT0 anywhere.
        </SectionHeading>
        <div className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {guarantees.map(([title, body], i) => (
            <div key={title} className="border-t-2 border-paper/20 pt-6">
              <div className="flex items-baseline gap-4">
                <span className="font-display text-[22px] text-clown">0{i + 1}</span>
                <h3 className="font-display text-[24px] uppercase leading-tight text-paper">{title}</h3>
              </div>
              <p className="mt-3 text-[16px] leading-relaxed text-paper/65">{body}</p>
            </div>
          ))}
        </div>
      </div>
      <TornEdge to="var(--clown)" seed={23} />
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="grain bg-clown">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:flex-row">
        <div className="flex-1">
          <p className="font-display text-[22px] uppercase text-ink sm:text-[28px]">Testnet is open</p>
          <h2 className="mt-4">
            <Tape seed={41} tilt={-1}>
              <span className="block px-5 py-3 font-display text-[48px] uppercase leading-[0.9] text-clown sm:px-8 sm:py-5 sm:text-[92px]">
                Wake up
                <br />
                your USDT0
              </span>
            </Tape>
          </h2>
          <p className="label mt-8 max-w-lg text-[22px] leading-tight text-ink">
            Grab mock USDT0, deposit, watch the share price climb, withdraw. Two minutes, start to finish.
          </p>
          <ButtonLink href="/app" size="lg" variant="secondary" seed={13} className="mt-8">
            Open the vault
          </ButtonLink>
        </div>
        <NemaFish className="w-[min(70vw,380px)] -rotate-6 drop-shadow-[8px_10px_0_rgb(8_22_52/0.4)]" title="" />
      </div>
      <TornEdge to="var(--tape)" seed={27} fringe={false} />
    </section>
  );
}
