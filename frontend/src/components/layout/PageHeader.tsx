import type { ReactNode } from "react";
import { Caps } from "@/components/ui/Caps";
import { Tape, TornEdge } from "@/components/zine/Torn";

/** Ocean band with a taped title, torn into the paper page below. */
export function PageHeader({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <section className="grain bg-ocean">
      <div className="mx-auto max-w-7xl px-5 pb-12 pt-6 sm:px-8 sm:pb-16 sm:pt-10">
        <p className="font-display text-[18px] uppercase text-ink sm:text-[22px]">
          <Caps>{kicker}</Caps>
        </p>
        <h1 className="mt-3">
          <Tape seed={52} tilt={-1}>
            <span className="block px-5 py-2 font-display text-[52px] uppercase leading-[0.95] text-ocean sm:px-7 sm:py-3 sm:text-[88px]">
              {title}
            </span>
          </Tape>
        </h1>
        {children && <div className="mt-6">{children}</div>}
      </div>
      <TornEdge to="var(--paper)" seed={61} fringe={false} />
    </section>
  );
}
