"use client";

import { useState } from "react";
import { Caps } from "@/components/ui/Caps";
import { Card } from "@/components/ui/Card";
import { type Snapshot, useApi } from "@/lib/api";

const RANGES = ["24h", "7d", "all"] as const;
type Range = (typeof RANGES)[number];

const W = 600;
const H = 180;
const PAD = 8;

/** Share price over time: the clearest picture of yield accruing. */
export function PriceChart() {
  const [range, setRange] = useState<Range>("7d");
  const { data } = useApi<Snapshot[]>(`/api/vault/history?range=${range}`, 60_000);
  const points = data ?? [];

  let path = "";
  let area = "";
  let first: number | undefined;
  let last: number | undefined;
  if (points.length >= 2) {
    const xs = points.map((p) => p.t);
    const ys = points.map((p) => Number(p.sharePrice));
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    const ySpan = y1 - y0 || 1;
    const sx = (x: number) => PAD + ((x - x0) / (x1 - x0 || 1)) * (W - PAD * 2);
    const sy = (y: number) => H - PAD - ((y - y0) / ySpan) * (H - PAD * 2);
    path = points
      .map((p, i) => `${i ? "L" : "M"}${sx(p.t).toFixed(1)} ${sy(Number(p.sharePrice)).toFixed(1)}`)
      .join(" ");
    area = `${path} L${sx(x1)} ${H} L${sx(x0)} ${H} Z`;
    first = ys[0];
    last = ys.at(-1);
  }
  const change = first && last ? ((last - first) / first) * 100 : null;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-[22px] uppercase leading-tight">
            <Caps>nUSDT0 share price</Caps>
          </h3>
          <p className="tabular mt-0.5 text-[13px] text-muted">
            {change !== null
              ? `${change >= 0 ? "+" : ""}${change.toFixed(5)}% over this range`
              : "Sampled every 5 minutes"}
          </p>
        </div>
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

      <div className="mt-5 h-[180px]">
        {path ? (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-full w-full"
            role="img"
            aria-label="Share price chart"
          >
            <defs>
              <linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--ocean)" stopOpacity="0.25" />
                <stop offset="1" stopColor="var(--ocean)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#price-fill)" />
            <path
              d={path}
              fill="none"
              stroke="var(--ocean)"
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <div className="label grid h-full place-items-center rounded border-2 border-dashed border-ink/30 text-[16px] text-muted">
            Collecting price samples…
          </div>
        )}
      </div>
    </Card>
  );
}
