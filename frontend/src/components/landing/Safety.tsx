import { NemaSquid } from "@/components/illustrations/NemaSquid";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/Card";
import { Tape, TornEdge } from "@/components/zine/Torn";
import { Reveal, Stagger } from "@/components/motion/Reveal";
import { CapsTimelockArt, NonCustodialArt, PegGuardArt, WithdrawalsOpenArt } from "./SafetyArt";

const guarantees = [
  { Art: NonCustodialArt, title: "Non-custodial", line: "Your USDT0 lives in the contract, never with us." },
  { Art: WithdrawalsOpenArt, title: "Always withdrawable", line: "Pause stops deposits. Never your exit." },
  { Art: PegGuardArt, title: "Peg guard", line: "If USDT0 slips off $1, deposits halt and funds come home." },
  {
    Art: CapsTimelockArt,
    title: "Caps & timelock",
    line: "Hard limits per strategy. New ones wait, so you can leave first.",
  },
];

const adminCan = ["Pause deposits", "Tune allocations within caps"];
const adminCannot = ["Move your funds", "Stop withdrawals", "Mint nUSDT0", "Change the code"];

export function Safety() {
  return (
    <section className="bg-navy">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <SectionHeading
            eyebrow="Safety"
            title={
              <>
                Nobody runs off <span className="text-clown">with the pond.</span>
              </>
            }
            dark
          />
        </Reveal>

        <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {guarantees.map(({ Art, title, line }) => (
            <div key={title} className="h-full overflow-hidden rounded-[6px] border-2 border-paper/20 bg-tape/60">
              <div className="border-b-2 border-paper/15 px-4 pt-4">
                <Art />
              </div>
              <div className="p-5">
                <h3 className="font-display text-[20px] uppercase leading-tight text-paper">{title}</h3>
                <p className="mt-2 text-[15px] leading-snug text-paper/65">{line}</p>
              </div>
            </div>
          ))}
        </Stagger>

        <Reveal>
          <div className="mt-8 flex flex-col gap-4 rounded-[6px] border-2 border-paper/20 p-5 sm:flex-row sm:items-center sm:gap-6">
            <span className="label shrink-0 text-[16px] text-paper/60">The admin</span>
            <ul className="flex flex-wrap gap-2">
              {adminCan.map((item) => (
                <li
                  key={item}
                  className="label flex items-center gap-1.5 rounded-[3px] bg-emerald-400/15 px-2.5 py-1 text-[14px] text-emerald-300"
                >
                  <span aria-hidden>✓</span> {item}
                </li>
              ))}
              {adminCannot.map((item) => (
                <li
                  key={item}
                  className="label flex items-center gap-1.5 rounded-[3px] bg-red-500/15 px-2.5 py-1 text-[14px] text-red-300"
                >
                  <span aria-hidden>✕</span> <span className="sr-only">cannot</span> {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
      <TornEdge to="var(--clown)" seed={23} grain />
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="grain bg-clown">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:flex-row">
        <Reveal className="flex-1">
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
        </Reveal>
        <Reveal delay={0.15}>
          <NemaSquid className="animate-bob w-[min(60vw,300px)] drop-shadow-[8px_10px_0_rgb(8_22_52/0.4)]" title="" />
        </Reveal>
      </div>
      <TornEdge to="var(--tape)" seed={27} fringe={false} />
    </section>
  );
}
