import type { ReactNode } from "react";
import { NemaSquidHead } from "./NemaSquid";

const INK = "#0B0F1A";
const ORANGE = "#FF7A1A";

/**
 * The squid's four arms, all leaving its head at the button's left end.
 * Inner pair: along the top and bottom edges, hooking over the middle.
 * Outer pair: all the way to the right end and round it. The label stays clear.
 */
const ARMS = [
  { kind: "outer", d: "M-16 26 C-20 6 -2 -4 26 -3 C66 -1 108 -6 150 -3 C178 -1 198 0 206 14 C213 26 208 40 197 40 C189 40 189 31 196 31" },
  { kind: "outer", d: "M-16 38 C-20 58 -2 69 26 67 C66 65 108 70 150 67 C178 65 198 64 206 50 C211 42 207 35 201 35" },
  { kind: "inner", d: "M-14 28 C-6 14 6 6 22 7 C38 8 44 2 58 4 C72 6 80 10 92 7 C102 5 108 12 104 20 C101 26 94 25 95 19" },
  { kind: "inner", d: "M-14 36 C-6 50 6 58 22 57 C38 56 44 62 58 60 C72 58 80 54 92 57 C102 59 108 52 104 44 C101 38 94 39 95 45" },
] as const;

/** Wraps a button in the squid. On hover the arms wrap all the way and its eyes turn to stars. */
export function TentacleWrap({ children }: { children: ReactNode }) {
  return (
    <span className="tentacle-wrap group relative inline-flex sm:ml-12">
      {children}
      <svg
        aria-hidden
        viewBox="-20 0 230 64"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -inset-x-3 -inset-y-2.5 h-[calc(100%+20px)] w-[calc(100%+24px)] overflow-visible"
      >
        {ARMS.map((arm) => (
          <g key={arm.d} className={`tentacle tentacle-${arm.kind}`} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={arm.d} pathLength={1} stroke={INK} strokeWidth={9} vectorEffect="non-scaling-stroke" />
            <path d={arm.d} pathLength={1} stroke={ORANGE} strokeWidth={5} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
      <NemaSquidHead className="tentacle-head pointer-events-none absolute right-full top-1/2 -mr-1.5 hidden h-[46px] w-[51px] -translate-y-1/2 sm:block" />
    </span>
  );
}
