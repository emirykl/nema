"use client";

import { Badge, Card, Skeleton } from "@/components/ui/Card";
import type { VaultState } from "@/lib/api";
import { formatAmount } from "@/lib/format";

/** Where the vault's USDT0 sits right now, and what each slice earns. */
export function Allocation({ vault }: { vault?: VaultState }) {
  if (!vault) {
    return (
      <Card className="p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-5 h-3 w-full" />
      </Card>
    );
  }

  const total = BigInt(vault.totalAssets);
  const idleBps = total > 0n ? Number((BigInt(vault.idleAssets) * 10_000n) / total) : 0;
  const rows = [
    ...vault.strategies.map((s) => ({
      key: s.address,
      name: s.name,
      detail: `Target ${s.target_bps / 100}% · cap ${s.cap_bps / 100}%`,
      bps: s.allocationBps,
      amount: s.balance,
      apr: s.aprBps / 100,
      color: "bg-ocean",
    })),
    {
      key: "idle",
      name: "Instant-withdrawal buffer",
      detail: `Kept idle in the vault · target ${vault.bufferBps / 100}%`,
      bps: idleBps,
      amount: vault.idleAssets,
      apr: 0,
      color: "bg-clown",
    },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[22px] uppercase leading-tight">Allocation</h3>
        <Badge tone="ocean">Gross {rows.reduce((a, r) => a + (r.apr * r.bps) / 10_000, 0).toFixed(2)}%</Badge>
      </div>

      <div className="mt-5 flex h-4 gap-0.5 overflow-hidden rounded-[3px] border-2 border-ink bg-surface-2">
        {rows.map((r) => (
          <div key={r.key} className={r.color} style={{ width: `${r.bps / 100}%` }} />
        ))}
      </div>

      <ul className="mt-5 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 py-3">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.color}`} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">{r.name}</div>
              <div className="text-[12px] text-muted">{r.detail}</div>
            </div>
            <div className="tabular text-right">
              <div className="text-[15px] font-semibold">{(r.bps / 100).toFixed(1)}%</div>
              <div className="text-[12px] text-muted">
                {formatAmount(r.amount, 2)} · {r.apr.toFixed(2)}% APR
              </div>
            </div>
          </li>
        ))}
        <li className="flex items-center gap-3 py-3 opacity-60">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-line" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium">Aquarius USDT0/USDC LP</div>
            <div className="text-[12px] text-muted">Concentrated liquidity + AQUA rewards</div>
          </div>
          <Badge tone="clown">Next</Badge>
        </li>
      </ul>
    </Card>
  );
}
