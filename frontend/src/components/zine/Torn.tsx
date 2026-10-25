import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

/**
 * Torn-paper toolkit: deterministic jagged clip-paths for tape, stickers and
 * section edges. Same seed, same tear, so server and client render alike.
 */

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

/** Ragged boundary between two sections, with a thin paper fringe. */
export function TornEdge({ to, seed = 11, fringe = true, flip = false }: { to: string; seed?: number; fringe?: boolean; flip?: boolean }) {
  const r = rng(seed);
  const n = 90;
  const line = Array.from({ length: n + 1 }, (_, i) => `L${(i / n) * 1440} ${(10 + r() * 22).toFixed(1)}`).join(" ");
  const d = `M0 40 ${line} L1440 40 Z`;
  return (
    <svg
      viewBox="0 0 1440 40"
      preserveAspectRatio="none"
      aria-hidden
      className={`pointer-events-none block h-6 w-full sm:h-9 ${flip ? "rotate-180" : ""}`}
    >
      {fringe && <path d={d} transform="translate(0 -6)" fill="var(--paper)" />}
      <path d={d} fill={to} />
    </svg>
  );
}
