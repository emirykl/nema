import { Umbrella } from "./NemaFish";

const INK = "#0B0F1A";
const ORANGE = "#FF7A1A";
const ORANGE_SHADE = "#E8620A";
const HIGHLIGHT = "#FFB27A";
const WHITE = "#FFFDF7";
const BLUSH = "#FF4F6D";

type Arm = { d: string; tip: readonly [number, number]; joint: string };

/** Outer arms reach sideways, inner arms hang down, like the keychain squid. */
const LEFT_ARM: Arm = { d: "M84 140 Q62 152 40 150", tip: [34, 150], joint: "M58 143 Q60 150 58 157" };
const RIGHT_ARM: Arm = { d: "M116 140 Q138 152 160 150", tip: [166, 150], joint: "M142 143 Q140 150 142 157" };
/** Right arm raised to hold the umbrella stem. */
const RAISED_ARM: Arm = { d: "M118 138 Q156 140 164 104", tip: [166, 96], joint: "M146 129 Q152 135 159 131" };
const LOWER_ARMS: Arm[] = [
  { d: "M92 148 Q86 164 80 177", tip: [78, 183], joint: "M79 163 Q86 166 93 166" },
  { d: "M108 148 Q114 164 120 177", tip: [122, 183], joint: "M107 166 Q114 166 121 163" },
];

function Arms({ arms }: { arms: Arm[] }) {
  return (
    <>
      <g fill="none">
        {arms.map((a) => (
          <path key={a.d} d={a.d} strokeWidth={24} />
        ))}
        {arms.map((a) => (
          <path key={a.d} d={a.d} stroke={ORANGE} strokeWidth={12} />
        ))}
      </g>
      <g fill={ORANGE} strokeWidth={6}>
        {arms.map((a) => (
          <circle key={a.d} cx={a.tip[0]} cy={a.tip[1]} r={13} />
        ))}
      </g>
      <g fill="none" strokeWidth={4}>
        {arms.map((a) => (
          <path key={a.d} d={a.joint} />
        ))}
      </g>
    </>
  );
}

const STAR_YELLOW = "#FFD43B";

/** Five-point star centred on (cx, cy). */
function starPath(cx: number, cy: number, outer: number, inner: number) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  });
  return `M${pts.join(" L")} Z`;
}

/**
 * The Nema logo mark: a round-eyed squid with a finned, ridged mantle and
 * stubby jointed arms. Flat fills and thick ink outlines, like the mascot.
 * `arms={false}` draws the head alone (TentacleWrap draws its own arms);
 * `stars` adds star eyes that CSS swaps in (see .squid-star in globals.css).
 */
export function NemaSquidArt({
  umbrella = false,
  arms = true,
  stars = false,
}: {
  umbrella?: boolean;
  arms?: boolean;
  stars?: boolean;
}) {
  return (
    <g stroke={INK} strokeLinejoin="round" strokeLinecap="round">
      {/* The fish's lily pad, scaled so its stem ends in the raised arm. */}
      {umbrella && (
        <g transform="translate(17 -22) scale(0.6)">
          <Umbrella />
        </g>
      )}
      {arms && <Arms arms={[LEFT_ARM, umbrella ? RAISED_ARM : RIGHT_ARM, ...LOWER_ARMS]} />}

      <path d="M100 24 L36 72 C50 82 68 80 80 70 Z" fill={ORANGE} strokeWidth={6} />
      <path d="M100 24 L164 72 C150 82 132 80 120 70 Z" fill={ORANGE} strokeWidth={6} />
      <path d="M100 14 C120 30 134 62 134 100 L66 100 C66 62 80 30 100 14 Z" fill={ORANGE} strokeWidth={6} />
      <path d="M100 22 C112 34 122 56 125 82 L118 96 L100 96 Z" fill={ORANGE_SHADE} stroke="none" opacity={0.5} />
      <g fill="none" strokeWidth={4}>
        <path d="M74 64 Q100 74 126 64" />
        <path d="M69 84 Q100 95 131 84" />
      </g>
      <path d="M86 34 Q78 48 77 58" fill="none" stroke={HIGHLIGHT} strokeWidth={5} />

      <circle cx={100} cy={124} r={32} fill={ORANGE} strokeWidth={6} />
      <path d="M118 102 Q132 118 126 140 Q118 152 104 155 Q124 140 118 102 Z" fill={ORANGE_SHADE} stroke="none" opacity={0.5} />

      <g fill={WHITE} strokeWidth={5}>
        <ellipse cx={78} cy={120} rx={15} ry={16} />
        <ellipse cx={122} cy={120} rx={15} ry={16} />
      </g>
      <g className="squid-pupil">
        <g fill={INK} stroke="none">
          <circle cx={80} cy={123} r={8} />
          <circle cx={120} cy={123} r={8} />
        </g>
        <g fill={WHITE} stroke="none">
          <circle cx={83} cy={119} r={2.8} />
          <circle cx={123} cy={119} r={2.8} />
        </g>
      </g>
      {stars && (
        <g className="squid-star" fill={STAR_YELLOW} strokeWidth={4}>
          <path d={starPath(78, 121, 17, 7.5)} />
          <path d={starPath(122, 121, 17, 7.5)} />
        </g>
      )}
      <g fill={BLUSH} stroke="none" opacity={0.45}>
        <ellipse cx={80} cy={143} rx={6} ry={3.5} />
        <ellipse cx={120} cy={143} rx={6} ry={3.5} />
      </g>
      <path d="M94 139 Q100 145 106 139" fill="none" strokeWidth={4} />
    </g>
  );
}

export function NemaSquid({
  umbrella = false,
  className,
  title = "Nema",
}: {
  umbrella?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox={umbrella ? "14 -104 222 304" : "16 6 168 192"}
      className={className}
      role="img"
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <NemaSquidArt umbrella={umbrella} />
    </svg>
  );
}

/**
 * Just the head and mantle, lying on its side with the mantle pointing left,
 * so arms drawn elsewhere can leave from its right. Used by TentacleWrap.
 */
export function NemaSquidHead({ className }: { className?: string }) {
  return (
    <svg viewBox="8 -170 160 144" className={className} aria-hidden>
      <g transform="rotate(-90)">
        <NemaSquidArt arms={false} stars />
      </g>
    </svg>
  );
}
