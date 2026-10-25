import type { ReactNode } from "react";
import { Caps } from "@/components/ui/Caps";
import { Tape, TornEdge } from "@/components/zine/Torn";

/** Ocean band with a taped title, torn into the paper page below. */
export function PageHeader({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <section className="grain bg-ocean">
      <div className="mx-auto max-w-7xl px-5 pb-6 pt-4 sm:px-8 sm:pb-8 sm:pt-6">
        <p className="font-display text-[18px] uppercase text-ink sm:text-[22px]">
          <Caps>{kicker}</Caps>
        </p>
        <h1 className="mt-3">
          <Tape seed={52} tilt={-1}>
            {/* Fluid size: long titles like "Transparency" fit from 360px phones up. */}
            <span className="block px-3 py-2 font-display text-[clamp(28px,8.6vw,88px)] uppercase leading-[0.95] text-ocean sm:px-7 sm:py-3">
              {title}
            </span>
          </Tape>
        </h1>
        {children && <div className="mt-4">{children}</div>}
      </div>
      <TornEdge to="var(--paper)" seed={61} fringe={false} />
    </section>
  );
}
