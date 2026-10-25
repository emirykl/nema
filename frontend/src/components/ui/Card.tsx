import type { ComponentProps, ReactNode } from "react";
import { Caps } from "./Caps";

/** Cream paper card with ink outline and hard offset shadow. */
export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`paper-card ${className}`} {...props} />;
}

/** Small "?" that reveals `children` on hover, or on tap/focus on touch screens. */
export function InfoTip({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="More info"
        className="grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-current text-[11px] font-bold leading-none opacity-60 transition hover:opacity-100 focus-visible:opacity-100"
      >
        ?
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-20 mt-2 hidden w-60 max-w-[calc(100vw-2.5rem)] rounded-[4px] border-2 border-ink bg-navy px-3 py-2 text-left text-[13px] font-normal normal-case leading-snug tracking-normal text-paper shadow-[4px_4px_0_var(--ink)] group-hover:block group-focus-within:block ${
          align === "right" ? "right-0" : "left-0"
        }`}
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {children}
      </span>
    </span>
  );
}

export function Stat({
  label,
  value,
  info,
  infoAlign,
  className = "",
}: {
  label: string;
  value: ReactNode;
  info?: ReactNode;
  infoAlign?: "left" | "right";
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="label flex items-center gap-1.5 text-[14px] text-muted">
        <Caps>{label}</Caps>
        {info && <InfoTip align={infoAlign}>{info}</InfoTip>}
      </div>
      <div className="tabular mt-1 font-display text-[26px] leading-tight">{value}</div>
    </div>
  );
}

type Tone = "neutral" | "ocean" | "clown" | "good" | "bad";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink",
  ocean: "bg-ocean text-paper",
  clown: "bg-clown text-ink",
  good: "bg-emerald-400 text-ink",
  bad: "bg-red-500 text-paper",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`label inline-flex items-center gap-1.5 rounded-[3px] border-2 border-ink px-2 py-0.5 text-[13px] leading-5 ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
  dark = false,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  dark?: boolean;
  align?: "left" | "center";
}) {
  return (
    <div className={`max-w-3xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      <div className="label text-[15px] text-clown">✦ {eyebrow}</div>
      <h2
        className={`mt-3 font-display text-[38px] uppercase leading-[0.95] sm:text-[60px] ${dark ? "text-paper" : "text-ink"}`}
      >
        {title}
      </h2>
      {children && (
        <p
          className={`label mt-5 max-w-2xl text-[19px] font-bold leading-snug sm:text-[22px] ${dark ? "text-paper/75" : "text-ink/75"}`}
        >
          {children}
        </p>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`inline-block animate-pulse rounded bg-surface-2 ${className}`} />;
}
