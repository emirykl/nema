"use client";

import { AnimatePresence, motion, type Transition, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { NemaSquidArt } from "@/components/illustrations/NemaSquid";
import type { TxPhase } from "./hooks";

const INK = "#0B0F1A";
const ORANGE = "#FF7A1A";
const ORANGE_SHADE = "#E8620A";
const GOLD = "#FFD43B";
const GOLD_SHADE = "#F0A81E";
const SAND = "#F6E6C8";
const LEAF = "#6CC24A";

/** Where coins fall into, or float out of, the chest. */
const MOUTH = { x: 214, y: 112 };
/** Tip of the squid's right arm, in scene coordinates. */
const HAND = { x: 138, y: 134 };
const TOSS_COINS = 3;
const TOSS_SECONDS = 1.5;
const COINS = [-26, -12, 2, 16, 30, -4, 10];
const BUBBLES = [
  { x: 36, r: 4, delay: 0, dur: 6 },
  { x: 62, r: 2.5, delay: 2.4, dur: 5 },
  { x: 150, r: 3, delay: 1.1, dur: 6.5 },
  { x: 288, r: 4.5, delay: 3.2, dur: 7 },
  { x: 318, r: 2.5, delay: 0.6, dur: 5.5 },
  { x: 372, r: 3.5, delay: 4, dur: 6 },
];

function Coin({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={8} fill={GOLD} stroke={INK} strokeWidth={2.5} />
      <circle r={4.5} fill="none" stroke={GOLD_SHADE} strokeWidth={2} />
    </g>
  );
}

/**
 * The squid's ongoing job while a tab is open: tossing coins from its arm
 * into the chest (deposit) or fishing them out (withdraw), on a loop.
 */
/**
 * Deposit path: up from the squid's arm, then in through the gap between the
 * raised lid (its tip is at ~172,71) and the rim, ending below the rim where
 * the chest front hides it. Withdraw runs the same path backwards.
 */
const INTO_CHEST = [HAND, { x: 148, y: 62 }, { x: 180, y: 90 }, { x: 204, y: 126 }];

function CoinToss({ mode }: { mode: "deposit" | "withdraw" }) {
  const path = mode === "deposit" ? INTO_CHEST : [...INTO_CHEST].reverse();
  return (
    <>
      {Array.from({ length: TOSS_COINS }, (_, i) => {
        // Per-value transitions don't inherit, so every value gets the loop.
        // Evenly spaced: a new coin every TOSS_SECONDS / TOSS_COINS.
        const loop = {
          duration: TOSS_SECONDS,
          repeat: Infinity,
          delay: (i * TOSS_SECONDS) / TOSS_COINS,
        };
        const arc: Transition = { ...loop, times: [0, 0.42, 0.72, 1], ease: ["easeOut", "easeIn", "easeIn"] };
        return (
          <motion.g
            key={`${mode}-${i}`}
            initial={{ x: path[0]!.x, y: path[0]!.y, opacity: 0 }}
            animate={{ x: path.map((p) => p.x), y: path.map((p) => p.y), opacity: [0, 1, 1, 0] }}
            transition={{ x: arc, y: arc, opacity: { ...loop, times: [0, 0.08, 0.9, 1] } }}
          >
            {/* Squashing the coin on its x axis reads as a spin. */}
            <motion.g
              animate={{ scaleX: [1, 0.25, 1, 0.25, 1] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
            >
              <Coin x={0} y={0} />
            </motion.g>
          </motion.g>
        );
      })}
    </>
  );
}

/**
 * How full the chest looks, 0–HOARD_MAX. While depositing it climbs one step a
 * second (two coins land per second), spills onto the sand past SPILL_AT, rests
 * at the top for a moment and starts over; while withdrawing it runs down.
 */
const HOARD_MAX = 15;
const SPILL_AT = 5;
const HOARD_REST = 3;
/** Extra coins stacked above the rim: a row of five, then a row of four. */
const PILE = [182, 198, 214, 230, 246]
  .map((x) => ({ x, y: 102 }))
  .concat([190, 206, 222, 238].map((x) => ({ x, y: 94 })));
/** Coins spilled on the sand around the chest, in the order they appear. */
const SPILL = [
  { x: 152, y: 158 },
  { x: 278, y: 156 },
  { x: 142, y: 165 },
  { x: 288, y: 164 },
  { x: 160, y: 168 },
  { x: 268, y: 167 },
  { x: 132, y: 159 },
  { x: 298, y: 157 },
];

function useHoard(mode: "deposit" | "withdraw", active: boolean) {
  const [tick, setTick] = useState(0);
  // Restart the cycle whenever the tab changes (derived-state pattern).
  const [start, setStart] = useState({ mode, tick: 0 });
  if (start.mode !== mode) setStart({ mode, tick });

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  const step = (tick - start.tick) % (HOARD_MAX + HOARD_REST);
  const level = Math.min(HOARD_MAX, step);
  return mode === "deposit" ? level : HOARD_MAX - level;
}

function PopCoin({ x, y }: { x: number; y: number }) {
  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0, transition: { duration: 0.25 } }}
      transition={{ type: "spring", stiffness: 500, damping: 18 }}
      style={{ transformOrigin: `${x}px ${y}px` }}
    >
      <Coin x={x} y={y} />
    </motion.g>
  );
}

function Seaweed({ x, height, delay }: { x: number; height: number; delay: number }) {
  const d = `M${x} 160 C${x - 10} ${160 - height * 0.3} ${x + 10} ${160 - height * 0.55} ${x - 2} ${160 - height * 0.8} C${x - 8} ${160 - height * 0.9} ${x + 4} ${160 - height} ${x} ${160 - height}`;
  return (
    <g className="scene-sway" style={{ transformOrigin: `${x}px 160px`, animationDelay: `${delay}s` }}>
      <path d={d} fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
      <path d={d} fill="none" stroke={LEAF} strokeWidth={5} strokeLinecap="round" />
    </g>
  );
}

/**
 * The vault as a treasure chest on the sea floor, guarded by the squid.
 * Deposits rain coins into the chest; withdrawals float them back out.
 * `celebrate` changes once per finished transaction and replays the coins.
 */
export function VaultScene({
  mode,
  phase,
  celebrate,
}: {
  mode: "deposit" | "withdraw";
  phase: TxPhase;
  celebrate: string | null;
}) {
  const reduced = useReducedMotion();
  const busy = phase === "building" || phase === "signing" || phase === "submitting";
  const done = phase === "done" && celebrate !== null;
  const hoard = useHoard(mode, !reduced && !busy && !done);
  const piled = PILE.slice(0, Math.min(PILE.length, hoard));
  const spilled = SPILL.slice(0, Math.max(0, Math.min(SPILL.length, hoard - SPILL_AT)));

  return (
    <svg
      viewBox="0 0 400 190"
      className={`block w-full ${done ? "squid-celebrate" : ""}`}
      role="img"
      aria-label={
        mode === "deposit" ? "Coins going into the Nema treasure chest" : "Coins coming out of the Nema treasure chest"
      }
    >
      <defs>
        <linearGradient id="scene-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a78ff" />
          <stop offset="0.55" stopColor="#1446d6" />
          <stop offset="1" stopColor="#0b1e4a" />
        </linearGradient>
        <radialGradient id="scene-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GOLD} stopOpacity="0.85" />
          <stop offset="1" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="190" fill="url(#scene-water)" />

      {/* Light from the surface */}
      <g className="scene-rays" fill="#fff">
        <polygon points="70,0 110,0 170,190 90,190" opacity="0.07" />
        <polygon points="190,0 215,0 260,190 205,190" opacity="0.06" />
        <polygon points="300,0 330,0 360,190 300,190" opacity="0.05" />
      </g>

      {BUBBLES.map((b) => (
        <circle
          key={b.x}
          className="scene-bubble"
          cx={b.x}
          cy={160}
          r={b.r}
          fill="none"
          stroke="#cfe0ff"
          strokeWidth={1.6}
          style={{
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
          }}
        />
      ))}

      <Seaweed x={28} height={92} delay={0} />
      <Seaweed x={48} height={64} delay={0.8} />
      <Seaweed x={356} height={84} delay={0.4} />
      <Seaweed x={378} height={58} delay={1.3} />

      {/* Sea floor */}
      <path
        d="M0 152 C60 142 120 158 200 150 C280 142 340 156 400 148 L400 190 L0 190 Z"
        fill={SAND}
        stroke={INK}
        strokeWidth={3}
      />
      <g fill="#e2cfa8">
        <ellipse cx="120" cy="170" rx="6" ry="2.5" />
        <ellipse cx="300" cy="172" rx="8" ry="3" />
        <ellipse cx="250" cy="180" rx="4" ry="2" />
      </g>

      {/* Treasure chest */}
      <g className={busy ? "scene-wobble" : ""} style={{ transformOrigin: "214px 160px" }}>
        <ellipse cx={MOUTH.x} cy={MOUTH.y} rx={60} ry={22} fill="url(#scene-glow)" />
        {/* Coins heaped inside */}
        <g>
          {[176, 192, 208, 224, 240, 252].map((x, i) => (
            <Coin key={x} x={x} y={112 - (i % 2) * 5} />
          ))}
          {/* The pile rising above the rim as coins go in */}
          <AnimatePresence>
            {piled.map((c) => (
              <PopCoin key={`pile-${c.x}-${c.y}`} x={c.x} y={c.y} />
            ))}
          </AnimatePresence>
        </g>
        {/* The squid at work while nothing else is happening. Drawn behind the chest
            front and the lid, so coins pass under the lid and drop out of sight. */}
        {!reduced && !busy && !done && <CoinToss key={mode} mode={mode} />}
        <rect x={164} y={112} width={100} height={48} rx={4} fill={ORANGE} stroke={INK} strokeWidth={4} />
        <rect x={180} y={112} width={9} height={48} fill={ORANGE_SHADE} stroke={INK} strokeWidth={2.5} />
        <rect x={239} y={112} width={9} height={48} fill={ORANGE_SHADE} stroke={INK} strokeWidth={2.5} />
        <rect x={205} y={118} width={18} height={20} rx={3} fill={GOLD} stroke={INK} strokeWidth={2.5} />
        <path d="M214 124 a3 3 0 1 1 0.1 0 L216 133 L212 133 Z" fill={INK} />
        {/* Lid, hinged at the back right */}
        <g className="scene-lid" style={{ transformOrigin: "264px 112px" }}>
          <path
            d="M164 112 L164 100 C164 82 264 82 264 100 L264 112 Z"
            fill={ORANGE}
            stroke={INK}
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <path d="M180 112 L180 90 L189 88 L189 112 Z" fill={ORANGE_SHADE} stroke={INK} strokeWidth={2.5} />
          <path d="M239 112 L239 88 L248 90 L248 112 Z" fill={ORANGE_SHADE} stroke={INK} strokeWidth={2.5} />
        </g>
      </g>

      {/* Coins spilled on the sand once the chest is full enough */}
      <AnimatePresence>
        {spilled.map((c) => (
          <PopCoin key={`spill-${c.x}-${c.y}`} x={c.x} y={c.y} />
        ))}
      </AnimatePresence>

      {/* The squid on guard */}
      <g transform="translate(78 82) scale(0.36)">
        <g className="scene-bob">
          <NemaSquidArt stars />
        </g>
      </g>

      {/* Coins for the transaction that just landed */}
      <AnimatePresence>
        {done && !reduced && (
          <g key={celebrate}>
            {COINS.map((dx, i) => {
              const into = mode === "deposit";
              return (
                <motion.g
                  key={i}
                  initial={
                    into
                      ? { x: MOUTH.x + dx * 0.8, y: -16, opacity: 1 }
                      : { x: MOUTH.x + dx * 0.5, y: MOUTH.y, opacity: 0 }
                  }
                  animate={
                    into
                      ? {
                          x: MOUTH.x + dx * 0.4,
                          y: MOUTH.y,
                          opacity: [1, 1, 0],
                        }
                      : { x: MOUTH.x + dx * 1.8, y: -20, opacity: [0, 1, 1, 0] }
                  }
                  transition={{
                    duration: 1.1,
                    delay: i * 0.09,
                    ease: into ? [0.5, 0, 0.75, 0] : [0.2, 0.8, 0.2, 1],
                  }}
                >
                  <Coin x={0} y={0} />
                </motion.g>
              );
            })}
            {[
              [160, 70],
              [270, 64],
              [214, 52],
            ].map(([x, y], i) => (
              <motion.path
                key={`spark-${i}`}
                d={`M${x} ${y - 8} L${x + 2.5} ${y - 2.5} L${x + 8} ${y} L${x + 2.5} ${y + 2.5} L${x} ${y + 8} L${x - 2.5} ${y + 2.5} L${x - 8} ${y} L${x - 2.5} ${y - 2.5} Z`}
                fill={GOLD}
                stroke={INK}
                strokeWidth={1.5}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 0.9, delay: 0.9 + i * 0.12 }}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
            ))}
          </g>
        )}
      </AnimatePresence>
    </svg>
  );
}
