"use client";

import { motion, type Transition, useReducedMotion } from "motion/react";
import { NemaSquidArt } from "@/components/illustrations/NemaSquid";
import { CountUp } from "@/components/motion/CountUp";

const INK = "#0B0F1A";
const ORANGE = "#FF7A1A";
const ORANGE_SHADE = "#E8620A";
const GOLD = "#FFD43B";
const NAVY = "#0B1E4A";
const PAPER = "#FFF4E0";
const LEAF = "#2F9E44";

function Coin({ r = 8 }: { r?: number }) {
  return (
    <g>
      <circle r={r} fill={GOLD} stroke={INK} strokeWidth={2.5} />
      <circle r={r * 0.55} fill="none" stroke="#F0A81E" strokeWidth={2} />
    </g>
  );
}

function Wallet({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} strokeLinejoin="round">
      <rect width={58} height={40} rx={6} fill={NAVY} stroke={INK} strokeWidth={3} />
      <path d="M0 12 L58 12" stroke={PAPER} strokeOpacity={0.25} strokeWidth={2} />
      <rect x={38} y={16} width={24} height={14} rx={4} fill={ORANGE} stroke={INK} strokeWidth={3} />
      <circle cx={47} cy={23} r={2.5} fill={INK} />
    </g>
  );
}

function Chest({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} strokeLinejoin="round">
      <rect width={60} height={32} rx={3} fill={ORANGE} stroke={INK} strokeWidth={3} />
      <rect x={10} width={6} height={32} fill={ORANGE_SHADE} stroke={INK} strokeWidth={2} />
      <rect x={44} width={6} height={32} fill={ORANGE_SHADE} stroke={INK} strokeWidth={2} />
      <rect x={25} y={5} width={10} height={12} rx={2} fill={GOLD} stroke={INK} strokeWidth={2} />
      {/* Lid tilted open, hinged at the back right */}
      <path
        d="M2 0 L4 -10 C12 -22 52 -26 60 -14 L60 0 Z"
        transform="rotate(16 60 0)"
        fill={ORANGE}
        stroke={INK}
        strokeWidth={3}
      />
    </g>
  );
}

/** One coin on an endless arc between two points, spinning as it goes. */
function FlyingCoin({ from, to, delay = 0 }: { from: [number, number]; to: [number, number]; delay?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  const peak: [number, number] = [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) - 34];
  const loop: Transition = { duration: 1.6, repeat: Infinity, repeatDelay: 0.5, delay };
  const arc: Transition = { ...loop, times: [0, 0.5, 1], ease: ["easeOut", "easeIn"] };
  return (
    <motion.g
      initial={{ x: from[0], y: from[1], opacity: 0 }}
      animate={{ x: [from[0], peak[0], to[0]], y: [from[1], peak[1], to[1]], opacity: [0, 1, 1, 0] }}
      transition={{ x: arc, y: arc, opacity: { ...loop, times: [0, 0.1, 0.85, 1] } }}
    >
      <motion.g animate={{ scaleX: [1, 0.25, 1] }} transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}>
        <Coin />
      </motion.g>
    </motion.g>
  );
}

const ART = "block h-auto w-full";

/** Step 1: USDT0 hops from the wallet into the vault. */
export function StepDepositArt() {
  return (
    <svg viewBox="0 0 200 110" className={ART} aria-hidden>
      <Wallet x={18} y={56} />
      <Chest x={124} y={64} />
      <FlyingCoin from={[52, 58]} to={[146, 62]} />
      <FlyingCoin from={[52, 58]} to={[146, 62]} delay={1.05} />
    </svg>
  );
}

/** Step 2: the squid holds nUSDT0 while its value line climbs. */
export function StepHoldArt() {
  const reduced = useReducedMotion();
  return (
    <svg viewBox="0 0 200 110" className={ART} aria-hidden>
      <path d="M20 92 L180 92" stroke={INK} strokeOpacity={0.15} strokeWidth={2} />
      <motion.path
        d="M22 88 C60 86 90 76 120 62 C146 50 164 34 180 20"
        fill="none"
        stroke={LEAF}
        strokeWidth={4}
        strokeLinecap="round"
        initial={{ pathLength: reduced ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={reduced ? undefined : { duration: 2.2, repeat: Infinity, repeatDelay: 0.8, ease: "easeInOut" }}
      />
      <path
        d="M170 18 L181 19 L178 30"
        fill="none"
        stroke={LEAF}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g transform="translate(26 22) scale(0.36)">
        <g className="scene-bob">
          <NemaSquidArt />
        </g>
      </g>
      {/* The nUSDT0 token in the squid's arm */}
      <g transform="translate(92 70)">
        <circle r={16} fill={ORANGE} stroke={INK} strokeWidth={3} />
        <text y={6} textAnchor="middle" fontFamily="var(--font-comic), sans-serif" fontSize={16} fill={INK}>
          n
        </text>
      </g>
    </svg>
  );
}

/** Step 3: coins come back out of the vault into the wallet, with a little extra. */
export function StepWithdrawArt() {
  const reduced = useReducedMotion();
  return (
    <svg viewBox="0 0 200 110" className={ART} aria-hidden>
      <Wallet x={124} y={56} />
      <Chest x={18} y={64} />
      <FlyingCoin from={[40, 62]} to={[146, 58]} />
      <FlyingCoin from={[40, 62]} to={[146, 58]} delay={1.05} />
      <motion.text
        x={176}
        y={44}
        textAnchor="middle"
        fontFamily="var(--font-comic), sans-serif"
        fontSize={22}
        fill={LEAF}
        stroke={INK}
        strokeWidth={1}
        initial={{ opacity: reduced ? 1 : 0, y: 44 }}
        animate={reduced ? undefined : { opacity: [0, 1, 0], y: [48, 36, 30] }}
        transition={reduced ? undefined : { duration: 1.6, repeat: Infinity, repeatDelay: 0.5, delay: 1.2 }}
      >
        +
      </motion.text>
    </svg>
  );
}

const asUsdt0 = (n: number) => n.toFixed(2);

/** "Your count stays, its value grows": 100 nUSDT0 counting up over a year. */
export function ValueGrowth() {
  return (
    <div className="rounded-[6px] border-2 border-paper/25 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="label text-[13px] text-paper/50">You hold</div>
          <div className="tabular font-display text-[30px] leading-none sm:text-[38px]">100 nUSDT0</div>
        </div>
        <div className="text-right">
          <div className="label text-[13px] text-paper/50">Worth</div>
          <div className="tabular font-display text-[30px] leading-none text-clown sm:text-[38px]">
            <CountUp from={100} value={100.6} format={asUsdt0} duration={2.6} />
          </div>
        </div>
      </div>
      <div className="mt-6 h-3 overflow-hidden rounded-full bg-paper/15">
        <motion.div
          className="h-full rounded-full bg-clown"
          initial={{ width: "4%" }}
          whileInView={{ width: "100%" }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 2.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <div className="label mt-2 flex justify-between text-[13px] text-paper/50">
        <span>Day 0 · 100.00</span>
        <span>Month 12 · 100.60</span>
      </div>
    </div>
  );
}
