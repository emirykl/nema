"use client";

import { useMemo, useState } from "react";
import { Caps } from "@/components/ui/Caps";
import { Card } from "@/components/ui/Card";
import { type PositionSummary, type Snapshot, useApi } from "@/lib/api";
import { formatAmount } from "@/lib/format";

const RANGES = ["24h", "7d", "all"] as const;
type Range = (typeof RANGES)[number];
type View = "you" | "vault";

const W = 600;
const H = 200;
const STROOPS = 1e7;

interface Point {
  t: number;
  v: number;
  /** Set on points that mark one of the wallet's own deposits or withdrawals. */
  event?: { kind: "deposit" | "withdraw"; assets: number };
}

const EVENT_COLOR = { deposit: "#10b981", withdraw: "var(--ocean)" } as const;

const timeLabel = (t: number, withTime: boolean) =>
  new Date(t).toLocaleString(
    "en-US",
    withTime
      ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
      : { month: "short", day: "numeric" },
  );

/**
 * Earnings over time for one wallet: at each share-price sample, what its
 * nUSDT0 was worth minus what it had put in (net of withdrawals). Deposits
 * don't show up as jumps, only yield does.
 */
function earningsSeries(
  snapshots: Snapshot[],
  summary: PositionSummary,
  now: { t: number; shares: bigint; price: bigint },
) {
  const events = summary.events.map((e) => ({
    t: new Date(e.at).getTime(),
    kind: e.kind as "deposit" | "withdraw",
    shares: Number(e.data.shares ?? 0) * (e.kind === "deposit" ? 1 : -1),
    assets: Number(e.data.assets ?? 0) * (e.kind === "deposit" ? 1 : -1),
  }));
  if (!events.length) return [];
  const start = events[0]!.t;
  const at = (t: number) => {
    let shares = 0;
    let net = 0;
    for (const e of events) {
      if (e.t > t) break;
      shares += e.shares;
      net += e.assets;
    }
    return { shares, net };
  };
  const points: Point[] = snapshots
    .filter((s) => s.t >= start)
    .map((s) => {
      const { shares, net } = at(s.t);
      return { t: s.t, v: (shares * Number(s.sharePrice)) / STROOPS / STROOPS - net / STROOPS };
    });
  // A marker at each deposit/withdrawal, valued at the last price sample before it.
  const priceAt = (t: number) =>
    Number([...snapshots].reverse().find((s) => s.t <= t)?.sharePrice ?? snapshots[0]?.sharePrice ?? now.price);
  for (const e of events) {
    const { shares, net } = at(e.t);
    points.push({
      t: e.t,
      v: (shares * priceAt(e.t)) / STROOPS / STROOPS - net / STROOPS,
      event: { kind: e.kind, assets: Math.abs(e.assets) / STROOPS },
    });
  }
  const { net } = at(now.t);
  points.push({ t: now.t, v: (Number(now.shares) * Number(now.price)) / STROOPS / STROOPS - net / STROOPS });
  return points.sort((a, b) => a.t - b.t);
}

function niceDecimals(span: number) {
  if (span <= 0) return 4;
  return Math.min(7, Math.max(2, Math.ceil(-Math.log10(span)) + 1));
}

/** Your earnings (or the vault's share price) over time, with axes and a hover readout. */
export function PriceChart({
  summary,
  shares,
  livePrice,
  now,
  vaultTotal,
  apyBps,
}: {
  summary?: PositionSummary;
  shares: bigint | null;
  livePrice: bigint | null;
  /** The vault's total USDT0 (stroops) and net APY, for the Vault view. */
  vaultTotal: string | null;
  apyBps: number | null;
  /** When `livePrice` was read (unix ms); the chart's "now". */
  now: number | null;
}) {
  const [range, setRange] = useState<Range>("7d");
  const canShowYou = shares !== null && !!summary && summary.events.length > 0 && livePrice !== null;
  const [picked, setPicked] = useState<View>("you");
  const view: View = canShowYou ? picked : "vault";
  const { data } = useApi<Snapshot[]>(`/api/vault/history?range=${range}`, 600_000);
  const [hover, setHover] = useState<number | null>(null);

  const points: Point[] = useMemo(() => {
    const snaps = data ?? [];
    if (view === "you" && summary && shares !== null && livePrice !== null && now !== null) {
      const since = range === "all" ? 0 : (now ?? 0) - (range === "24h" ? 86_400_000 : 604_800_000);
      return earningsSeries(snaps, summary, { t: now, shares, price: livePrice }).filter((p) => p.t >= since);
    }
    return snaps.map((s) => ({ t: s.t, v: Number(s.sharePrice) / STROOPS }));
  }, [data, view, summary, shares, livePrice, now, range]);

  const geo = useMemo(() => {
    if (points.length < 2) return null;
    const [x0, x1] = [points[0]!.t, points.at(-1)!.t];
    let [y0, y1] = [Math.min(...points.map((p) => p.v)), Math.max(...points.map((p) => p.v))];
    // Earnings start at zero; keep zero on the axis so growth reads honestly.
    if (view === "you") y0 = Math.min(0, y0);
    const pad = (y1 - y0) * 0.12 || Math.abs(y1) * 0.001 || 1e-6;
    y0 -= view === "you" && y0 === 0 ? 0 : pad;
    y1 += pad;
    const sx = (t: number) => ((t - x0) / (x1 - x0 || 1)) * W;
    const sy = (v: number) => H - ((v - y0) / (y1 - y0)) * H;
    const line = points.map((p, i) => `${i ? "L" : "M"}${sx(p.t).toFixed(1)} ${sy(p.v).toFixed(1)}`).join(" ");
    return { x0, x1, y0, y1, sx, sy, line, area: `${line} L${W} ${H} L0 ${H} Z`, decimals: niceDecimals(y1 - y0) };
  }, [points, view]);

  const first = points[0]?.v;
  const last = points.at(-1)?.v;
  const shownTime = geo ? geo.x1 - geo.x0 < 2 * 86_400_000 : false;
  const hovered = hover !== null ? points[hover] : undefined;

  const headline =
    view === "you"
      ? last !== undefined
        ? `${last >= 0 ? "+" : ""}${last.toFixed(7)} USDT0 earned`
        : "No earnings yet"
      : vaultTotal !== null && apyBps !== null
        ? `${formatAmount(vaultTotal, 2)} USDT0 in the vault · ${(apyBps / 100).toFixed(2)}% net APY`
        : "Sampled every 10 minutes";
  const priceChange = view === "vault" && first && last ? ((last - first) / first) * 100 : null;

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!geo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = geo.x0 + ((e.clientX - rect.left) / rect.width) * (geo.x1 - geo.x0);
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(p.t - t) < Math.abs(points[best]!.t - t)) best = i;
    });
    setHover(best);
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[22px] uppercase leading-tight">
            <Caps>{view === "you" ? "Your earnings" : "nUSDT0 share price"}</Caps>
          </h3>
          <p
            className={`tabular mt-0.5 text-[14px] font-semibold ${view === "you" ? "text-emerald-600" : "text-ink/70"}`}
          >
            {headline}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canShowYou && (
            <div className="label flex overflow-hidden rounded-[4px] border-2 border-ink text-[14px]">
              {(["you", "vault"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setPicked(v)}
                  className={`px-3 py-1 uppercase ${view === v ? "bg-navy text-paper" : "text-muted hover:text-ink"}`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          <div className="label flex overflow-hidden rounded-[4px] border-2 border-ink text-[14px]">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 uppercase ${range === r ? "bg-navy text-paper" : "text-muted hover:text-ink"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <div className="relative h-[200px] min-w-0 flex-1" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {geo ? (
            <>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                className="h-full w-full"
                role="img"
                aria-label={headline}
              >
                <defs>
                  <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={view === "you" ? "#10b981" : "var(--ocean)"} stopOpacity="0.25" />
                    <stop offset="1" stopColor={view === "you" ? "#10b981" : "var(--ocean)"} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0, 0.5, 1].map((f) => (
                  <line
                    key={f}
                    x1={0}
                    x2={W}
                    y1={f * H}
                    y2={f * H}
                    stroke="var(--line)"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {view === "you" && geo.y0 <= 0 && (
                  <line
                    x1={0}
                    x2={W}
                    y1={geo.sy(0)}
                    y2={geo.sy(0)}
                    stroke="var(--ink)"
                    strokeOpacity={0.35}
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <path d={geo.area} fill="url(#chart-fill)" />
                <path
                  d={geo.line}
                  fill="none"
                  stroke={view === "you" ? "#10b981" : "var(--ocean)"}
                  strokeWidth={2.5}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
                {hovered && (
                  <line
                    x1={geo.sx(hovered.t)}
                    x2={geo.sx(hovered.t)}
                    y1={0}
                    y2={H}
                    stroke="var(--ink)"
                    strokeOpacity={0.4}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
              {view === "you" &&
                points
                  .filter((p) => p.event)
                  .map((p) => (
                    <span
                      key={`ev-${p.t}`}
                      className="pointer-events-none absolute grid h-4 w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-ink text-[9px] font-bold leading-none text-paper"
                      style={{
                        left: `${(geo.sx(p.t) / W) * 100}%`,
                        top: `${(geo.sy(p.v) / H) * 100}%`,
                        background: EVENT_COLOR[p.event!.kind],
                      }}
                    >
                      {p.event!.kind === "deposit" ? "↓" : "↑"}
                    </span>
                  ))}
              {hovered && (
                <>
                  <span
                    className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-paper"
                    style={{ left: `${(geo.sx(hovered.t) / W) * 100}%`, top: `${(geo.sy(hovered.v) / H) * 100}%` }}
                  />
                  <div
                    className="tabular pointer-events-none absolute top-0 whitespace-nowrap z-10 rounded-[4px] border-2 border-ink bg-navy px-2.5 py-1.5 text-[12px] text-paper shadow-[3px_3px_0_var(--ink)]"
                    style={{
                      left: `${(geo.sx(hovered.t) / W) * 100}%`,
                      transform: `translateX(${geo.sx(hovered.t) > W / 2 ? "calc(-100% - 8px)" : "8px"})`,
                    }}
                  >
                    <div className="text-paper/60">{timeLabel(hovered.t, true)}</div>
                    {hovered.event && (
                      <div style={{ color: hovered.event.kind === "deposit" ? "#6ee7b7" : "#9db8ff" }}>
                        {hovered.event.kind === "deposit" ? "Deposited" : "Withdrew"} {hovered.event.assets.toFixed(2)}{" "}
                        USDT0
                      </div>
                    )}
                    <div className="font-semibold">
                      {view === "you"
                        ? `${hovered.v >= 0 ? "+" : ""}${hovered.v.toFixed(7)} USDT0`
                        : `1 nUSDT0 = ${hovered.v.toFixed(7)}`}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="label grid h-full place-items-center rounded border-2 border-dashed border-ink/30 text-[16px] text-muted">
              {view === "you" ? "Your earnings appear after your first deposit" : "Collecting price samples…"}
            </div>
          )}
        </div>
        {geo && (
          <div className="tabular flex h-[200px] shrink-0 flex-col justify-between text-right text-[11px] text-muted">
            <span>{geo.y1.toFixed(geo.decimals)}</span>
            <span>{((geo.y0 + geo.y1) / 2).toFixed(geo.decimals)}</span>
            <span>{geo.y0.toFixed(geo.decimals)}</span>
          </div>
        )}
      </div>
      {geo && (
        <div className="tabular mt-2 flex justify-between text-[11px] text-muted">
          <span>{timeLabel(geo.x0, shownTime)}</span>
          <span>{timeLabel((geo.x0 + geo.x1) / 2, shownTime)}</span>
          <span>{shownTime ? "now" : timeLabel(geo.x1, false)}</span>
        </div>
      )}
      {view === "you" && summary ? (
        <div className="label mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] text-muted">
          <span>All time</span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-ink" style={{ background: EVENT_COLOR.deposit }} />
            Deposited <span className="tabular text-ink">{formatAmount(summary.deposited, 2)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-ink" style={{ background: EVENT_COLOR.withdraw }} />
            Withdrawn <span className="tabular text-ink">{formatAmount(summary.withdrawn, 2)}</span>
          </span>
          <span>USDT0</span>
        </div>
      ) : (
        <p className="tabular mt-3 text-[12px] text-muted">
          1 nUSDT0 in USDT0
          {priceChange !== null && (
            <>
              {" "}
              · {priceChange >= 0 ? "+" : ""}
              {priceChange.toFixed(5)}% in this range
            </>
          )}
          . It only rises as the strategy earns.
        </p>
      )}
    </Card>
  );
}
