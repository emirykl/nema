"use client";

import { SectionHeading, Skeleton } from "@/components/ui/Card";
import { TornEdge, tornClip } from "@/components/zine/Torn";
import { type Usdt0Stats, useApi } from "@/lib/api";
import { formatInt, formatPct, formatUsd } from "@/lib/format";

export function IdleStats() {
  const { data } = useApi<Usdt0Stats>("/api/mainnet/usdt0", 600_000);

  const notes = [
    { label: "Wallets with a USDT0 trustline", value: data && formatInt(data.trustlines), tilt: -2 },
    { label: "Wallets actually holding it", value: data && formatInt(data.fundedAccounts), tilt: 1.5, accent: true },
    { label: "Trustlines sitting empty", value: data && formatPct(data.idleShare * 100, 1), tilt: -1 },
    { label: "USDT0 supply on Stellar", value: data && formatUsd(data.supply, true), tilt: 2 },
  ];

  return (
    <section className="bg-navy">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <SectionHeading
          eyebrow="The problem"
          title={
            <>
              USDT0 landed on Stellar. <span className="text-clown">Then it fell asleep.</span>
            </>
          }
          dark
        >
          Tens of thousands of wallets added USDT0. Almost none hold it. No deposit-and-forget product puts it to work.
          Nema is that missing layer.
        </SectionHeading>

        <div className="mt-14 grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-6 lg:grid-cols-4">
          {notes.map((note, i) => (
            <div
              key={note.label}
              className="drop-shadow-[6px_6px_0_var(--tape)]"
              style={{ transform: `rotate(${note.tilt}deg)` }}
            >
              <div className="bg-paper px-5 pb-6 pt-5 text-ink sm:px-7" style={{ clipPath: tornClip(30 + i, 5, 20) }}>
                <div
                  className={`tabular font-display text-[34px] leading-none sm:text-[52px] ${note.accent ? "text-clown" : ""}`}
                >
                  {note.value ?? <Skeleton className="h-10 w-24" />}
                </div>
                <div className="label mt-3 text-[16px] leading-tight text-ink/70 sm:text-[18px]">{note.label}</div>
              </div>
            </div>
          ))}
        </div>

        <p className="label mt-10 flex items-center gap-2 text-[16px] text-paper/60">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          Live from Stellar mainnet via StellarExpert
        </p>
      </div>
      <TornEdge to="var(--paper)" seed={8} fringe={false} />
    </section>
  );
}
