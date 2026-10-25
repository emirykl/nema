import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

/**
 * Torn-paper toolkit: deterministic jagged clip-paths for tape, stickers and
 * section edges. Same seed, same tear, so server and client render alike.
 */

/** Same noise as the `.grain` overlay in globals.css. */
const NOISE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Polygon with every edge roughened by up to `amp` px. */
export function tornClip(seed: number, amp = 5, steps = 28): string {
  const r = rng(seed);
  const pts: string[] = [];
  const j = () => (r() * amp).toFixed(1);
  for (let i = 0; i <= steps; i++) pts.push(`${(i / steps) * 100}% ${j()}px`);
  for (let i = 1; i <= steps / 3; i++) pts.push(`calc(100% - ${j()}px) ${(i / (steps / 3)) * 100}%`);
  for (let i = steps - 1; i >= 0; i--) pts.push(`${(i / steps) * 100}% calc(100% - ${j()}px)`);
  for (let i = steps / 3 - 1; i >= 1; i--) pts.push(`${j()}px ${(i / (steps / 3)) * 100}%`);
  return `polygon(${pts.join(",")})`;
}

/** Ink tape strip behind a headline, slightly crooked. */
export function Tape({ children, className = "", seed = 7, tilt = -1.5 }: { children: ReactNode; className?: string; seed?: number; tilt?: number }) {
  return (
    <span
      className={`grain-dark relative inline-block bg-tape ${className}`}
      style={{ clipPath: tornClip(seed, 9, 40), transform: `rotate(${tilt}deg)` }}
    >
      <span className="relative z-[1] block">{children}</span>
    </span>
  );
}

const stickerTones = {
  paper: "bg-paper text-ink",
  orange: "bg-clown text-ink",
  navy: "bg-navy text-paper",
  blue: "bg-ocean text-paper",
} as const;

export type StickerTone = keyof typeof stickerTones;

export const stickerClass = (tone: StickerTone = "paper", extra = "") =>
  `sticker inline-flex items-center justify-center gap-2 font-display uppercase tracking-[0.01em] ${stickerTones[tone]} ${extra}`;

const stickerStyle = (seed: number, tilt: number): CSSProperties => ({
  clipPath: tornClip(seed, 4, 16),
  ["--tilt" as string]: `${tilt}deg`,
});

export function Sticker({
  tone,
  seed = 3,
  tilt = -2,
  className = "",
  style,
  ...props
}: ComponentProps<"button"> & { tone?: StickerTone; seed?: number; tilt?: number }) {
  return <button className={stickerClass(tone, className)} style={{ ...stickerStyle(seed, tilt), ...style }} {...props} />;
}

export function StickerLink({
  tone,
  seed = 3,
  tilt = -2,
  className = "",
  ...props
}: ComponentProps<typeof Link> & { tone?: StickerTone; seed?: number; tilt?: number }) {
  return <Link className={stickerClass(tone, className)} style={stickerStyle(seed, tilt)} {...props} />;
}

/**
 * Ragged boundary between two sections, with a thin paper fringe. The tear is
 * drawn twice side by side and drifts sideways like a slow swell; the two
 * copies meet seamlessly, so the loop never jumps. Pass `grain` when the
 * section below has the paper texture, so edge and section read as one piece.
 */
export function TornEdge({
  to,
  seed = 11,
  fringe = true,
  flip = false,
  grain = false,
}: {
  to: string;
  seed?: number;
  fringe?: boolean;
  flip?: boolean;
  grain?: boolean;
}) {
  const r = rng(seed);
  const n = 90;
  const ys = Array.from({ length: n }, () => (10 + r() * 22).toFixed(1));
  // The last point repeats the first so tile edges line up.
  const line = Array.from({ length: n + 1 }, (_, i) => `L${(i / n) * 1440} ${ys[i % n]}`).join(" ");
  // Runs past the bottom edge so the swell never opens a gap above the next section.
  const d = `M0 52 ${line} L1440 52 Z`;
  const noiseId = `torn-noise-${seed}`;
  const tile = (
    <>
      {fringe && <path d={d} transform="translate(0 -6)" fill="var(--paper)" />}
      <path d={d} fill={to} />
      {grain && <path d={d} fill={`url(#${noiseId})`} opacity={0.22} style={{ mixBlendMode: "multiply" }} />}
    </>
  );
  return (
    <svg
      viewBox="0 0 1440 40"
      preserveAspectRatio="none"
      aria-hidden
      className={`pointer-events-none -mb-px block h-6 w-full overflow-hidden sm:h-9 ${flip ? "rotate-180" : ""}`}
    >
      {grain && (
        <defs>
          <pattern id={noiseId} patternUnits="userSpaceOnUse" width={220} height={220}>
            <image href={NOISE} width={220} height={220} />
          </pattern>
        </defs>
      )}
      <g className="wave-swell">
        <g className="wave-drift" style={{ animationDuration: `${36 + (seed % 5) * 6}s` }}>
          {tile}
          <g transform="translate(1440 0)">{tile}</g>
        </g>
      </g>
    </svg>
  );
}
