"use client";

import { Card, Skeleton, Stat } from "@/components/ui/Card";
import type { PositionSummary, VaultState } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { useAccruing } from "./hooks";

const ONE = 10_000_000n;

/**
 * The connected wallet's three numbers: balance, earnings, shares. Lifetime
 * totals and the vault's own numbers live in the chart next to it.
 */
export function Stats({
  vault,
  shares,
  summary,
}: {
  vault?: VaultState;
  /** nUSDT0 held on-chain; null when no wallet is connected. */
  shares: bigint | null;
  summary?: PositionSummary;
}) {
  const apr = vault?.netAprBps ?? 0;
  const price = useAccruing(vault ? BigInt(vault.sharePrice) : null, apr, vault?.updatedAt);

  // No wallet: the vault's numbers are the story.
  if (shares === null) {
    return (
      <Card className="p-6 sm:p-7">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
          <Stat
            label="Vault total"
            value={vault ? formatAmount(vault.totalAssets, 2) : <Skeleton className="h-8 w-28" />}
          />
          <Stat label="Net APY" value={vault ? `${(apr / 100).toFixed(2)}%` : <Skeleton className="h-8 w-20" />} />
          <Stat
            label="1 nUSDT0 ="
            value={price !== null ? formatAmount(price, 7, 7) : <Skeleton className="h-8 w-32" />}
          />
        </div>
        <p className="mt-5 text-[14px] text-muted">Connect a wallet to see your balance and earnings.</p>
      </Card>
    );
  }

  const value = price !== null ? (shares * price) / ONE : null;
  const deposited = summary ? BigInt(summary.deposited) : null;
  const withdrawn = summary ? BigInt(summary.withdrawn) : 0n;
  // History lags the chain for a few seconds after a transaction; until the
  // shares it accounts for match the wallet, earnings would be wrong, so wait.
  const inSync = summary !== undefined && BigInt(summary.sharesIn) - BigInt(summary.sharesOut) === shares;
  const earned = inSync && value !== null && deposited !== null ? value + withdrawn - deposited : null;
  const earnedPct = earned !== null && deposited ? (Number(earned) / Number(deposited)) * 100 : null;

  return (
    <Card className="p-6 sm:p-7">
      <div className="grid gap-6 sm:grid-cols-[1.3fr_1fr_1fr]">
        <Stat
          label="Your balance"
          value={
            value !== null ? (
              <span className="text-clown">
                {formatAmount(value, 7, 7)} <span className="text-[16px] text-muted">USDT0</span>
              </span>
            ) : (
              <Skeleton className="h-8 w-40" />
            )
          }
          info="What your nUSDT0 is worth right now, growing live. You can withdraw it all at any time."
        />
        <Stat
          label="Earned"
          value={
            earned !== null ? (
              <span className={earned >= 0n ? "text-emerald-600" : "text-red-600"}>
                {earned >= 0n ? "+" : ""}
                {formatAmount(earned, 7)}
                {earnedPct !== null && (
                  <span className="ml-2 text-[15px]">
                    ({earnedPct >= 0 ? "+" : ""}
                    {earnedPct.toFixed(5)}%)
                  </span>
                )}
              </span>
            ) : shares > 0n || (summary && summary.events.length > 0) ? (
              <span className="text-[16px] text-muted">Updating…</span>
            ) : (
              "—"
            )
          }
          info="All-time earnings: your balance now, plus everything you withdrew, minus everything you deposited. The % is on what you deposited."
        />
        <Stat
          label="You hold"
          value={
            <>
              {formatAmount(shares, 4)} <span className="text-[16px] text-muted">nUSDT0</span>
            </>
          }
          infoAlign="right"
          info="Your share of the vault. The count stays the same; each nUSDT0 is worth more USDT0 over time."
        />
      </div>
    </Card>
  );
}
