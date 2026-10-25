import type { ComponentProps, ReactNode } from "react";
import { Caps } from "./Caps";

/** Cream paper card with ink outline and hard offset shadow. */
export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`paper-card ${className}`} {...props} />;
}

export function Stat({
  label,
  value,
  hint,
  className = "",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="label text-[14px] text-muted">
        <Caps>{label}</Caps>
      </div>
      <div className="tabular mt-1 font-display text-[26px] leading-tight">{value}</div>
      {hint && <div className="mt-1 text-[13px] text-muted">{hint}</div>}
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
