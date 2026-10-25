"use client";

import { Card, Skeleton, Stat } from "@/components/ui/Card";
import type { VaultState } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { useAccruing } from "./hooks";

export function Stats({ vault, shares }: { vault?: VaultState; shares: bigint | null }) {
  const apr = vault?.netAprBps ?? 0;
  const price = useAccruing(vault ? BigInt(vault.sharePrice) : null, apr, vault?.updatedAt);
  const position = price !== null && shares !== null ? (shares * price) / 10_000_000n : null;

  return (
    <Card className="grid grid-cols-2 gap-x-6 gap-y-6 p-6 sm:p-7 lg:grid-cols-4">
      <Stat
        label="Total deposits"
        value={vault ? `${formatAmount(vault.totalAssets, 2)}` : <Skeleton className="h-8 w-28" />}
        hint="USDT0 in vault + strategies"
      />
      <Stat
        label="1 nUSDT0 ="
        value={price !== null ? formatAmount(price, 7, 7) : <Skeleton className="h-8 w-32" />}
        hint="USDT0, growing live"
      />
      <Stat
        label="Net APY"
        value={vault ? `${(apr / 100).toFixed(2)}%` : <Skeleton className="h-8 w-20" />}
        hint={
          vault?.realizedApy != null
            ? `Realized ${vault.realizedApy.toFixed(2)}%`
            : `After ${vault ? vault.feeBps / 100 : 10}% performance fee`
        }
      />
      <Stat
        label="Your position"
        value={position !== null ? <span className="text-clown">{formatAmount(position, 7, 7)}</span> : "—"}
        hint={shares !== null ? `${formatAmount(shares, 4)} nUSDT0` : "Connect to see yours"}
      />
    </Card>
  );
}
