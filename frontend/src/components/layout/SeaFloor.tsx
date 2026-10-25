import { NemaSquidArt } from "@/components/illustrations/NemaSquid";

const INK = "#0B0F1A";
const ORANGE = "#FF7A1A";
const ORANGE_SHADE = "#E8620A";
const GOLD = "#FFD43B";
const SAND = "#F6E6C8";
const LEAF = "#6CC24A";
const CORAL = "#FF6B8A";

function Weed({ x, h, delay }: { x: number; h: number; delay: number }) {
  const d = `M${x} 150 C${x - 14} ${150 - h * 0.3} ${x + 14} ${150 - h * 0.6} ${x - 2} ${150 - h * 0.85} C${x - 8} ${150 - h * 0.95} ${x + 4} ${150 - h} ${x} ${150 - h}`;
  return (
    <g className="scene-sway" style={{ transformOrigin: `${x}px 150px`, animationDelay: `${delay}s` }}>
      <path d={d} fill="none" stroke={INK} strokeWidth={10} strokeLinecap="round" />
      <path d={d} fill="none" stroke={LEAF} strokeWidth={6} strokeLinecap="round" />
    </g>
  );
}

function Coral({ x }: { x: number }) {
  return (
    <path
      d={`M${x} 150 L${x} 128 M${x} 138 L${x - 12} 124 L${x - 12} 114 M${x} 132 L${x + 11} 120 L${x + 11} 108 M${x} 128 L${x} 112`}
      fill="none"
      stroke={CORAL}
      strokeWidth={7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** A plain, original little fish (not anyone's character), facing right. */
function Fish({ color, stripe }: { color: string; stripe: string }) {
  return (
    <g strokeLinejoin="round">
      <path d="M-18 0 L-30 -10 L-28 0 L-30 10 Z" fill={color} stroke={INK} strokeWidth={2.5} />
      <ellipse cx={0} cy={0} rx={20} ry={11} fill={color} stroke={INK} strokeWidth={2.5} />
      <path d="M-4 -10 C-2 -4 -2 4 -4 10" fill="none" stroke={stripe} strokeWidth={3} />
      <circle cx={10} cy={-2} r={3} fill="#FFFDF7" stroke={INK} strokeWidth={1.5} />
      <circle cx={10.8} cy={-1.6} r={1.4} fill={INK} />
    </g>
  );
}

const SCHOOL = [
  { y: 40, dur: 26, delay: 0, color: ORANGE, stripe: "#FFFDF7", left: false, scale: 1 },
  { y: 74, dur: 34, delay: -12, color: "#4C8DFF", stripe: GOLD, left: true, scale: 0.8 },
  { y: 58, dur: 30, delay: -20, color: GOLD, stripe: ORANGE_SHADE, left: false, scale: 0.65 },
];

const BUBBLES = [
  { x: 210, r: 4, delay: 0 },
  { x: 640, r: 3, delay: 2 },
  { x: 980, r: 5, delay: 1 },
  { x: 1290, r: 3, delay: 3 },
];

/**
 * The bottom of the pond, under the footer: sand, weed, coral, a chest of
 * treasure, the squid taking a break, fish going about their day.
 */
export function SeaFloor() {
  return (
    <svg
      viewBox="0 0 1440 160"
      preserveAspectRatio="xMidYMax slice"
      className="pointer-events-none block h-[120px] w-full sm:h-[160px]"
      aria-hidden
    >
      <defs>
        <linearGradient id="seafloor-deep" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#081634" />
          <stop offset="1" stopColor="#0b1e4a" />
        </linearGradient>
      </defs>
      <rect width="1440" height="160" fill="url(#seafloor-deep)" />

      {SCHOOL.map((f) => (
        <g
          key={f.y}
          className={f.left ? "fish-swim-left" : "fish-swim"}
          style={{ animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }}
        >
          <g transform={`translate(0 ${f.y}) scale(${f.left ? -f.scale : f.scale} ${f.scale})`}>
            <Fish color={f.color} stripe={f.stripe} />
          </g>
        </g>
      ))}

      {BUBBLES.map((b) => (
        <circle
          key={b.x}
          className="scene-bubble"
          cx={b.x}
          cy={140}
          r={b.r}
          fill="none"
          stroke="#cfe0ff"
          strokeOpacity={0.7}
          strokeWidth={1.6}
          style={{ animationDelay: `${b.delay}s`, animationDuration: "7s" }}
        />
      ))}

      <Weed x={80} h={90} delay={0} />
      <Weed x={104} h={60} delay={0.7} />
      <Coral x={330} />
      <Weed x={520} h={74} delay={0.3} />
      <Coral x={860} />
      <Weed x={1180} h={96} delay={1.1} />
      <Weed x={1204} h={64} delay={0.5} />
      <Weed x={1380} h={80} delay={0.9} />

      {/* Sand */}
      <path
        d="M0 142 C200 132 400 150 720 140 C1000 132 1240 150 1440 138 L1440 160 L0 160 Z"
        fill={SAND}
        stroke={INK}
        strokeWidth={3}
      />

      {/* A chest of treasure, lid ajar, coins spilling */}
      <g transform="translate(980 108)" strokeLinejoin="round">
        <circle cx={-14} cy={34} r={7} fill={GOLD} stroke={INK} strokeWidth={2.5} />
        <circle cx={-26} cy={36} r={6} fill={GOLD} stroke={INK} strokeWidth={2.5} />
        <rect width={64} height={34} rx={3} fill={ORANGE} stroke={INK} strokeWidth={3} />
        <rect x={11} width={7} height={34} fill={ORANGE_SHADE} stroke={INK} strokeWidth={2} />
        <rect x={46} width={7} height={34} fill={ORANGE_SHADE} stroke={INK} strokeWidth={2} />
        <rect x={26} y={6} width={12} height={13} rx={2} fill={GOLD} stroke={INK} strokeWidth={2} />
        <path
          d="M0 0 L2 -10 C10 -24 56 -26 64 -12 L64 0 Z"
          transform="rotate(14 64 0)"
          fill={ORANGE}
          stroke={INK}
          strokeWidth={3}
        />
      </g>

      {/* The squid, off duty */}
      <g transform="translate(640 92) scale(0.3)">
        <g className="scene-bob">
          <NemaSquidArt />
        </g>
      </g>
    </svg>
  );
}
