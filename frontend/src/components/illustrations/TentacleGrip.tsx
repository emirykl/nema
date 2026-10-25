import type { CSSProperties, ReactNode } from "react";

const INK = "#0B0F1A";
const ORANGE = "#FF7A1A";
const SUCKER = "#FFD9B8";

/**
 * One arm wrapping over the top edge of a button, in real pixels (no
 * stretching, so curls stay round). The button's edge is the line y = 26,
 * which is 30px from the top of the (viewBox y = -4) box; offsets below use that.
 * `back` rises from behind the button (only the loop above the edge shows);
 * `front` comes over the edge, runs a short way down the face and curls.
 */
const ARM = {
  width: 52,
  height: 70,
  // A tight loop just past the edge (about 13px out) that hugs it, no open gap…
  // Its last control point lines up with the front's first, so the two halves
  // meet at the edge with the same heading and read as one arm.
  // Strands 10 units apart (= stroke width), so the loop closes with no slit.
  back: "M23 40 C22 30 22 22 23 17 C25 12 31 12 33 17 C34 20 33.6 21.8 33 26",
  // …then well onto the face before curling.
  // Starts 2 units back inside the back half, along the same heading: the overlap
  // hides the hairline that two flush stroke ends leave when anti-aliased.
  // Ends in an open J-hook whose tip stays a stroke-width clear of the arm.
  front: "M33.28 24 L33 26 C32 33 31 40 30 46 C29 53 22 56 18 51 C16 48 17 44 20 42",
  tip: [20, 42] as const,
  suckers: [
    [32.5, 32],
    [31.5, 38.5],
    [30.5, 45],
  ],
};

/**
 * Where each arm sits. Every arm is the same drawing, rotated so that its
 * "edge line" lies on the button side it grips. Offsets keep each arm well
 * away from the centred label.
 */
const PLACES: { side: string; style: CSSProperties }[] = [
  { side: "top", style: { left: "16%", top: -30, transform: "translateX(-50%)" } },
  { side: "bottom", style: { left: "84%", bottom: -30, transform: "translateX(-50%) rotate(180deg)" } },
  { side: "left", style: { left: -21, top: "50%", transform: "translate(0, -50%) rotate(-90deg)" } },
  { side: "right", style: { right: -21, top: "50%", transform: "translate(0, -50%) rotate(90deg)" } },
];

function ArmLayer({ part, style, z }: { part: "back" | "front"; style: CSSProperties; z: string }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 -4 ${ARM.width} ${ARM.height}`}
      width={ARM.width}
      height={ARM.height}
      className={`pointer-events-none absolute overflow-visible ${z}`}
      style={style}
    >
      {/* Butt caps: the two halves join flush at the edge with no outline across the arm.
          The tip gets its round end from two discs, each painted with its own stroke
          (ink disc with the ink stroke, orange disc with the orange one), which is
          exactly how a round cap would look. */}
      <g className={`grip-arm grip-${part}`} fill="none" strokeLinecap="butt" strokeLinejoin="round">
        <path d={ARM[part]} pathLength={1} stroke={INK} strokeWidth={10} />
        {part === "front" && <circle className="grip-tip" cx={ARM.tip[0]} cy={ARM.tip[1]} r={5} fill={INK} />}
        <path d={ARM[part]} pathLength={1} stroke={ORANGE} strokeWidth={6} />
        {part === "front" && <circle className="grip-tip" cx={ARM.tip[0]} cy={ARM.tip[1]} r={3} fill={ORANGE} />}
      </g>
      {part === "front" && (
        <g className="grip-suckers">
          <g fill={SUCKER} stroke={INK} strokeWidth={1}>
            {ARM.suckers.map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} />
            ))}
          </g>
        </g>
      )}
    </svg>
  );
}

/**
 * On hover, four squid arms reach out from behind the button, one per side,
 * loop over its edge and grip the front. Nothing shows at rest, or while the
 * wrapped button is disabled.
 */
export function TentacleGrip({ children }: { children: ReactNode }) {
  return (
    <span className="tentacle-grip relative isolate block">
      {PLACES.map((p) => (
        <ArmLayer key={`back-${p.side}`} part="back" style={p.style} z="z-0" />
      ))}
      <span className="relative z-10 block">{children}</span>
      {PLACES.map((p) => (
        <ArmLayer key={`front-${p.side}`} part="front" style={p.style} z="z-20" />
      ))}
    </span>
  );
}
