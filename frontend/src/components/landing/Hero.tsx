import { NemaFish } from "@/components/illustrations/NemaFish";
import { ButtonLink } from "@/components/ui/Button";
import { Tape, TornEdge } from "@/components/zine/Torn";

const promises = ["Non-custodial", "Withdraw any time", "Yield made on Stellar"];

export function Hero() {
  return (
    <section className="grain relative bg-ocean">
      <div className="mx-auto grid max-w-7xl items-center gap-6 px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <p className="animate-rise font-display text-[19px] uppercase leading-tight text-ink sm:text-[24px]">
            The first USDT0 yield vault on Stellar
          </p>

          <h1 className="animate-rise relative mt-4 [animation-delay:80ms] sm:mt-6">
            <Tape className="px-5 pb-3 pt-4 sm:px-8 sm:pb-5 sm:pt-6">
              <span className="block font-display text-[88px] uppercase leading-[0.85] text-ocean sm:text-[160px]">Nema</span>
            </Tape>
            <span className="absolute -bottom-5 right-[8%] rotate-[-4deg] font-display text-[40px] uppercase leading-none text-paper [text-shadow:0_4px_0_var(--tape)] sm:-bottom-8 sm:text-[72px] lg:right-auto lg:left-[52%]">
              Vault
            </span>
          </h1>

          <p className="label animate-rise mt-12 max-w-xl text-[24px] leading-[1.05] text-ink [animation-delay:160ms] sm:mt-16 sm:text-[30px]">
            Deposit USDT0. Hold <span className="normal-case">n</span>USDT0. <span className="text-paper">Earn</span> while you chill.
            <br />
            Your idle stablecoins finally go to work.
          </p>

          <ul className="label animate-rise mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[17px] text-ink/60 [animation-delay:200ms]">
            {promises.map((p) => (
              <li key={p} className="flex items-center gap-1.5">
                <span className="grid h-4 w-4 place-items-center rounded-full border-2 border-current text-[9px] leading-none">✓</span>
                {p}
              </li>
            ))}
          </ul>

          <div className="animate-rise mt-10 flex flex-wrap items-center gap-5 [animation-delay:240ms]">
            <ButtonLink href="/app" size="lg" variant="ghost" seed={5}>
              Open the vault
            </ButtonLink>
            <ButtonLink href="#how" size="lg" variant="secondary" seed={9} tilt={1.5}>
              How it works
            </ButtonLink>
          </div>
        </div>

        <div className="relative mx-auto w-[min(78vw,460px)] lg:w-full lg:max-w-[520px]">
          <div className="absolute inset-[12%_6%_4%_10%] -z-10 rounded-full bg-paper/15 blur-2xl" />
          <NemaFish umbrella className="animate-bob w-full drop-shadow-[8px_10px_0_rgb(8_22_52/0.45)]" />
        </div>
      </div>

      <TornEdge to="var(--navy)" seed={4} />
    </section>
  );
}
