"use client";

import { Badge, Card, SectionHeading, Skeleton } from "@/components/ui/Card";
import { TornEdge } from "@/components/zine/Torn";
import { type YieldSource, useApi } from "@/lib/api";
import { formatPct, formatUsd } from "@/lib/format";
import { Reveal, Stagger } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";

export function YieldSources() {
  const { data } = useApi<YieldSource[]>("/api/mainnet/yields", 600_000);
  const max = Math.max(1, ...(data ?? []).map((s) => s.apy));

  return (
    <section className="grain bg-ocean">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <SectionHeading eyebrow="Where the yield comes from" title="Every basis point, accounted for.">
            Made inside Stellar: no bridge, no off-chain desk. Today&apos;s live mainnet rates, shown as they are. A realistic
            vault yield is about 0.4–0.8% a year while USDT0 demand on Stellar is still young.
          </SectionHeading>
        </Reveal>

        <Stagger className="mt-14 grid gap-8 md:grid-cols-2">
          {(data ?? [null, null]).map((source, i) => (
            <Card key={source?.id ?? i} className="p-7" style={{ transform: `rotate(${i ? 0.8 : -0.8}deg)` }}>
              {source ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-[24px] uppercase leading-tight">{source.name}</h3>
                      <p className="label mt-1 text-[16px] text-muted">{source.kind}</p>
                    </div>
                    {source.status === "live" ? <Badge tone="good">Live strategy</Badge> : <Badge tone="clown">Next</Badge>}
                  </div>
                  <div className="tabular mt-6 font-display text-[64px] leading-none">
                    <CountUp value={source.apy} format={formatPct} />
                    <span className="label ml-2 text-[18px] text-muted">APY</span>
                  </div>
                  <div className="mt-6 space-y-3">
                    {source.breakdown.map((part) => (
                      <div key={part.label}>
                        <div className="label flex justify-between text-[15px]">
                          <span className="text-muted">{part.label}</span>
                          <span className="tabular">{formatPct(part.apy, 3)}</span>
                        </div>
                        <div className="mt-1.5 h-3 overflow-hidden rounded-sm border-2 border-ink bg-surface-2">
                          <div
                            className={`h-full ${source.status === "live" ? "bg-ocean" : "bg-clown"}`}
                            style={{ width: `${Math.max(2, (part.apy / max) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="label mt-5 text-[15px] text-muted">Pool liquidity {formatUsd(source.tvlUsd, true)}</p>
                </>
              ) : (
                <div className="space-y-4">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-14 w-36" />
                  <Skeleton className="h-3 w-full" />
                </div>
              )}
            </Card>
          ))}
        </Stagger>
      </div>
      <TornEdge to="var(--navy)" seed={19} />
    </section>
  );
}
