"use client";

import { motion, useReducedMotion } from "motion/react";

const INK = "#0B0F1A";
const ORANGE = "#FF7A1A";
const ORANGE_SHADE = "#E8620A";
const GOLD = "#FFD43B";
const PAPER = "#FFF4E0";
const GREEN = "#3DDC84";
const RED = "#FF5A5F";
const OCEAN = "#2160FF";

const ART = "block h-auto w-full";

function Coin({ r = 7 }: { r?: number }) {
  return (
    <g>
      <circle r={r} fill={GOLD} stroke={INK} strokeWidth={2.5} />
      <circle r={r * 0.55} fill="none" stroke="#F0A81E" strokeWidth={2} />
    </g>
  );
}

/** 01 — Funds live in the contract: a locked chest; the team's hand can't reach it. */
export function NonCustodialArt() {
  const reduced = useReducedMotion();
  return (
    <svg viewBox="0 0 200 110" className={ART} aria-hidden>
      {/* Chest, shut and padlocked */}
      <g strokeLinejoin="round">
        <rect x={62} y={48} width={76} height={44} rx={4} fill={ORANGE} stroke={INK} strokeWidth={3} />
        <path d="M62 48 L62 40 C62 26 138 26 138 40 L138 48 Z" fill={ORANGE} stroke={INK} strokeWidth={3} />
        <rect x={76} y={30} width={8} height={62} fill={ORANGE_SHADE} stroke={INK} strokeWidth={2} />
        <rect x={116} y={30} width={8} height={62} fill={ORANGE_SHADE} stroke={INK} strokeWidth={2} />
        <path d="M92 52 L92 46 C92 36 108 36 108 46 L108 52" fill="none" stroke={INK} strokeWidth={4} />
        <rect x={88} y={51} width={24} height={20} rx={3} fill={GOLD} stroke={INK} strokeWidth={3} />
        <circle cx={100} cy={60} r={2.5} fill={INK} />
        <text
          x={100}
          y={86}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill={INK}
          fontFamily="ui-monospace, monospace"
        >
          CONTRACT
        </text>
      </g>
      {/* A hand reaching in and bouncing off */}
      <motion.g
        animate={reduced ? undefined : { x: [0, 14, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <path d="M8 66 L34 66" stroke={PAPER} strokeOpacity={0.5} strokeWidth={10} strokeLinecap="round" />
        <circle cx={40} cy={66} r={8} fill={PAPER} stroke={INK} strokeWidth={2.5} />
      </motion.g>
      <motion.g
        animate={reduced ? undefined : { scale: [0.6, 1.15, 0.6], opacity: [0, 1, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "52px 66px" }}
      >
        <path d="M46 60 L58 72 M58 60 L46 72" stroke={RED} strokeWidth={4} strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}

/** 02 — Pause stops deposits, never withdrawals: one pipe paused, one still flowing. */
export function WithdrawalsOpenArt() {
  const reduced = useReducedMotion();
  return (
    <svg viewBox="0 0 200 110" className={ART} aria-hidden>
      {/* Deposit pipe, paused */}
      <rect
        x={12}
        y={22}
        width={176}
        height={20}
        rx={10}
        fill="none"
        stroke={PAPER}
        strokeOpacity={0.35}
        strokeWidth={2.5}
      />
      <g transform="translate(100 32)">
        <circle r={12} fill={OCEAN} stroke={INK} strokeWidth={2.5} />
        <rect x={-5} y={-6} width={3.5} height={12} rx={1} fill={PAPER} />
        <rect x={1.5} y={-6} width={3.5} height={12} rx={1} fill={PAPER} />
      </g>
      <text
        x={14}
        y={16}
        fontSize={9}
        fontWeight={700}
        fill={PAPER}
        fillOpacity={0.6}
        fontFamily="ui-monospace, monospace"
      >
        DEPOSIT · PAUSED
      </text>
      {/* Withdraw pipe, flowing */}
      <rect x={12} y={70} width={176} height={20} rx={10} fill="none" stroke={GREEN} strokeWidth={2.5} />
      <text x={14} y={104} fontSize={9} fontWeight={700} fill={GREEN} fontFamily="ui-monospace, monospace">
        WITHDRAW · ALWAYS OPEN
      </text>
      {!reduced &&
        [0, 0.7, 1.4].map((delay) => (
          <motion.g
            key={delay}
            initial={{ x: 22, y: 80, opacity: 0 }}
            animate={{ x: [22, 178], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2.1, repeat: Infinity, ease: "linear", delay, times: [0, 0.1, 0.9, 1] }}
          >
            <Coin r={6} />
          </motion.g>
        ))}
    </svg>
  );
}

/** 03 — Peg guard: a needle hovering around $1.00 inside a safe band. */
export function PegGuardArt() {
  const reduced = useReducedMotion();
  // Gauge arc from 200° to 340°, centred at (100, 92).
  const arc = (r: number, a0: number, a1: number) => {
    const p = (a: number) => [100 + r * Math.cos((a * Math.PI) / 180), 92 + r * Math.sin((a * Math.PI) / 180)];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return `M${x0!.toFixed(1)} ${y0!.toFixed(1)} A${r} ${r} 0 0 1 ${x1!.toFixed(1)} ${y1!.toFixed(1)}`;
  };
  return (
    <svg viewBox="0 0 200 110" className={ART} aria-hidden>
      <path
        d={arc(64, 200, 340)}
        fill="none"
        stroke={RED}
        strokeOpacity={0.55}
        strokeWidth={12}
        strokeLinecap="round"
      />
      <path d={arc(64, 250, 290)} fill="none" stroke={GREEN} strokeWidth={12} />
      <text
        x={100}
        y={22}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill={PAPER}
        fontFamily="ui-monospace, monospace"
      >
        $1.00
      </text>
      <motion.g
        animate={reduced ? undefined : { rotate: [-12, 10, -6, 14, -12] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "100px 92px" }}
      >
        <path d="M100 92 L100 38" stroke={PAPER} strokeWidth={4} strokeLinecap="round" />
      </motion.g>
      <circle cx={100} cy={92} r={8} fill={ORANGE} stroke={INK} strokeWidth={2.5} />
      {/* Shield */}
      <path
        d="M168 58 L184 64 C184 80 178 88 168 94 C158 88 152 80 152 64 Z"
        fill={OCEAN}
        stroke={INK}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path
        d="M161 75 L166 80 L175 69"
        fill="none"
        stroke={PAPER}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 04 — Caps and a timelock: sand running through an hourglass beside a capped bar. */
export function CapsTimelockArt() {
  const reduced = useReducedMotion();
  return (
    <svg viewBox="0 0 200 110" className={ART} aria-hidden>
      {/* Capped bar */}
      <rect
        x={24}
        y={20}
        width={22}
        height={78}
        rx={4}
        fill="none"
        stroke={PAPER}
        strokeOpacity={0.4}
        strokeWidth={2.5}
      />
      <motion.rect
        x={27}
        width={16}
        rx={2}
        fill={OCEAN}
        initial={{ y: 95, height: 0 }}
        animate={reduced ? { y: 40, height: 55 } : { y: [95, 40, 40, 95], height: [0, 55, 55, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", times: [0, 0.4, 0.85, 1] }}
      />
      <path d="M18 38 L52 38" stroke={RED} strokeWidth={3} strokeDasharray="4 3" />
      <text x={56} y={41} fontSize={9} fontWeight={700} fill={RED} fontFamily="ui-monospace, monospace">
        CAP
      </text>
      {/* Hourglass */}
      <g transform="translate(138 18)" strokeLinejoin="round">
        <motion.g
          animate={reduced ? undefined : { rotate: [0, 0, 180] }}
          transition={{ duration: 4, repeat: Infinity, times: [0, 0.85, 1], ease: "easeInOut" }}
          style={{ transformOrigin: "22px 40px" }}
        >
          <rect x={0} y={0} width={44} height={6} rx={2} fill={ORANGE} stroke={INK} strokeWidth={2.5} />
          <rect x={0} y={74} width={44} height={6} rx={2} fill={ORANGE} stroke={INK} strokeWidth={2.5} />
          <path
            d="M6 6 L38 6 C38 22 26 32 24 40 C26 48 38 58 38 74 L6 74 C6 58 18 48 20 40 C18 32 6 22 6 6 Z"
            fill={PAPER}
            fillOpacity={0.15}
            stroke={PAPER}
            strokeWidth={2.5}
          />
          <motion.path
            d="M10 10 L34 10 C33 20 25 28 22 36 C19 28 11 20 10 10 Z"
            fill={GOLD}
            animate={reduced ? undefined : { scaleY: [1, 0.15, 0.15] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.8, 1] }}
            style={{ transformOrigin: "22px 36px" }}
          />
          <motion.path
            d="M8 72 L36 72 C34 62 28 58 22 56 C16 58 10 62 8 72 Z"
            fill={GOLD}
            animate={reduced ? undefined : { scaleY: [0.15, 1, 1] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.8, 1] }}
            style={{ transformOrigin: "22px 72px" }}
          />
        </motion.g>
      </g>
    </svg>
  );
}
