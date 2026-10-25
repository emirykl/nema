import { useId } from "react";

const INK = "#0B0F1A";
const ORANGE = "#FF7A1A";
const ORANGE_SHADE = "#E8620A";
const LID = "#FF8B33";
const WHITE = "#FFFDF7";

const BODY = "M70 168 C70 112 128 76 196 74 C262 72 312 110 314 160 C316 210 268 246 200 248 C130 250 70 222 70 168 Z";
const TAIL = "M298 160 C322 120 360 92 394 98 C384 132 382 186 396 222 C362 228 322 200 298 160 Z";
const DORSAL = "M148 84 C150 44 200 22 250 36 C282 46 300 74 302 112 C270 96 200 80 148 84 Z";
const PECTORAL = "M196 176 C204 150 244 144 260 166 C270 182 256 204 234 204 C214 204 198 194 196 176 Z";
const VENTRAL = "M170 238 C176 270 206 288 238 280 C226 264 222 252 226 240 Z";

/** Ink-white-ink edge that clownfish fins have, clipped to the fin shape. */
function FinEdge({ d, clip }: { d: string; clip: string }) {
  return (
    <g clipPath={`url(#${clip})`}>
      <path d={d} fill="none" stroke={INK} strokeWidth={18} strokeLinecap="round" />
      <path d={d} fill="none" stroke={WHITE} strokeWidth={6} strokeLinecap="round" />
    </g>
  );
}

/** Lily-pad umbrella; its stem ends at (244, 176) in fish coordinates. */
export function Umbrella() {
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d="M244 176 C238 110 226 30 212 -44" fill="none" stroke={INK} strokeWidth={14} />
      <path d="M244 176 C238 110 226 30 212 -44" fill="none" stroke="#3B8F2E" strokeWidth={6} />
      <path
        d="M70 -52 C78 -100 190 -120 270 -104 C320 -94 344 -74 338 -56 C332 -38 290 -30 220 -32 L206 -58 L194 -30 C130 -28 64 -34 70 -52 Z"
        fill="#6CC24A"
        stroke={INK}
        strokeWidth={7}
      />
      <path
        d="M78 -44 C130 -36 262 -36 332 -50 C324 -38 288 -31 220 -32 L206 -58 L194 -30 C132 -28 80 -32 78 -44 Z"
        fill="#4FA236"
      />
      <g fill="none" stroke="#3E8E2E" strokeWidth={3}>
        <path d="M206 -60 L104 -84" />
        <path d="M206 -60 L160 -104" />
        <path d="M206 -60 L240 -106" />
        <path d="M206 -60 L304 -86" />
      </g>
      <path
        d="M70 -52 C78 -100 190 -120 270 -104 C320 -94 344 -74 338 -56 C332 -38 290 -30 220 -32 L206 -58 L194 -30 C130 -28 64 -34 70 -52 Z"
        fill="none"
        stroke={INK}
        strokeWidth={7}
      />
    </g>
  );
}

/**
 * Nema, the house clownfish: unbothered, heavy-lidded, chilling while the
 * vault does the work. Pure SVG group so it can be embedded in scenes.
 */
export function NemaFishArt({ umbrella = false }: { umbrella?: boolean }) {
  const id = useId().replace(/:/g, "");
  const clip = (name: string) => `${id}-${name}`;

  return (
    <g strokeLinejoin="round">
      <defs>
        <clipPath id={clip("body")}>
          <path d={BODY} />
        </clipPath>
        <clipPath id={clip("tail")}>
          <path d={TAIL} />
        </clipPath>
        <clipPath id={clip("dorsal")}>
          <path d={DORSAL} />
        </clipPath>
        <clipPath id={clip("pectoral")}>
          <path d={PECTORAL} />
        </clipPath>
        <clipPath id={clip("eye")}>
          <circle cx={124} cy={148} r={24} />
        </clipPath>
      </defs>

      {/* Fins behind the body */}
      <path d={TAIL} fill={ORANGE} />
      <FinEdge d="M388 100 C378 134 376 186 390 220" clip={clip("tail")} />
      <path d={TAIL} fill="none" stroke={INK} strokeWidth={7} />

      <path d={DORSAL} fill={ORANGE} />
      <FinEdge d="M150 82 C154 46 202 26 248 38 C280 48 298 76 301 110" clip={clip("dorsal")} />
      <path d={DORSAL} fill="none" stroke={INK} strokeWidth={7} />

      <path d={VENTRAL} fill={ORANGE} stroke={INK} strokeWidth={6} />

      {/* Body, stripes and shading */}
      <path d={BODY} fill={ORANGE} />
      <g clipPath={`url(#${clip("body")})`}>
        <ellipse cx={200} cy={252} rx={170} ry={58} fill={ORANGE_SHADE} opacity={0.45} />
        <g fill={WHITE} stroke={INK} strokeWidth={6}>
          <path d="M136 60 C164 112 166 214 132 274 L184 274 C212 214 212 110 184 60 Z" />
          <path d="M236 60 C256 112 256 212 234 274 L272 274 C296 212 296 110 270 60 Z" />
          <path d="M300 60 C306 110 306 214 298 274 L340 274 L340 60 Z" />
        </g>
      </g>
      <path d="M112 100 C140 84 176 78 204 79" fill="none" stroke={WHITE} strokeWidth={6} strokeLinecap="round" opacity={0.55} />
      <path d={BODY} fill="none" stroke={INK} strokeWidth={7} />

      {/* Face: heavy-lidded eye, small smirk, a hint of blush */}
      <circle cx={124} cy={148} r={24} fill={WHITE} />
      <g clipPath={`url(#${clip("eye")})`}>
        <circle cx={126} cy={159} r={10} fill={INK} />
        <circle cx={122} cy={155} r={3} fill={WHITE} />
        <rect x={96} y={118} width={60} height={29} fill={LID} />
      </g>
      <path d="M99 146 Q124 140 150 147" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <circle cx={124} cy={148} r={24} fill="none" stroke={INK} strokeWidth={6} />
      <path d="M74 184 Q88 194 103 186" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <ellipse cx={108} cy={198} rx={9} ry={5} fill="#FF4D4D" opacity={0.3} />

      {umbrella && <Umbrella />}

      {/* Pectoral fin, in front, holding the stem */}
      <path d={PECTORAL} fill={ORANGE} />
      <FinEdge d="M246 152 C266 166 266 192 242 204" clip={clip("pectoral")} />
      <path d={PECTORAL} fill="none" stroke={INK} strokeWidth={6} />
    </g>
  );
}

export function NemaFish({
  umbrella = false,
  className,
  title = "Nema the clownfish",
}: {
  umbrella?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <svg viewBox={umbrella ? "40 -140 380 450" : "50 10 360 290"} className={className} role="img" aria-label={title}>
      <NemaFishArt umbrella={umbrella} />
    </svg>
  );
}
