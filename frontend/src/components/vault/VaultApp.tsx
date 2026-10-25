"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Card";
import { useWallet } from "@/components/wallet/WalletProvider";
import { type PositionSummary, type VaultState, useApi } from "@/lib/api";
import { ActionCard } from "./ActionCard";
import { Activity } from "./Activity";
import { NetworkWarning } from "./NetworkWarning";
import { Allocation } from "./Allocation";
import { useAccount } from "./hooks";
import { PriceChart } from "./PriceChart";
import { Stats } from "./Stats";

const GUARD_BADGE = {
  Healthy: { tone: "good", label: "Peg guard: healthy" },
  Disabled: { tone: "neutral", label: "Peg guard: off" },
  Depegged: { tone: "bad", label: "Peg guard: depeg detected" },
  Stale: { tone: "bad", label: "Peg guard: price stale" },
} as const;

export function VaultApp() {
  const { address } = useWallet();
  const vault = useApi<VaultState>("/api/vault", 30_000);
  const account = useAccount(address);
  const summaryPath = address ? `/api/positions/${address}/summary` : null;
  const summary = useApi<PositionSummary>(summaryPath, 60_000);
  const [refreshKey, setRefreshKey] = useState(0);

  const { refresh: refreshVault } = vault;
  const { refresh: refreshAccount } = account;
  const { refresh: refreshSummary } = summary;

  // After the user's own transaction: skip every cache, then look again once
  // the keeper has had time to move the new money into the strategy.
  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshAccount(),
      refreshVault(`/api/vault?fresh=${Date.now()}`),
      summaryPath ? refreshSummary(`${summaryPath}?fresh=${Date.now()}`) : undefined,
    ]);
    setRefreshKey((k) => k + 1);
  }, [refreshAccount, refreshVault, refreshSummary, summaryPath]);

  // The indexed history can trail the chain by a few seconds. While the shares
  // it accounts for differ from the wallet's, ask again (a few times at most;
  // a lasting gap means nUSDT0 moved outside the vault, e.g. a DEX trade).
  const chainShares = account.status?.nusdt0;
  const summaryData = summary.data;
  const outOfSync =
    !!summaryData &&
    chainShares !== undefined &&
    BigInt(summaryData.sharesIn) - BigInt(summaryData.sharesOut) !== chainShares;
  const retries = useRef(0);
  useEffect(() => {
    if (!outOfSync || !summaryPath || retries.current >= 5) return;
    const id = setTimeout(() => {
      retries.current += 1;
      refreshSummary(`${summaryPath}?fresh=${Date.now()}`);
    }, 4000);
    return () => clearTimeout(id);
  }, [outOfSync, summaryPath, refreshSummary, summaryData]);
  useEffect(() => {
    retries.current = 0;
  }, [refreshKey, address]);

  useEffect(() => {
    if (refreshKey === 0) return;
    const id = setTimeout(() => refreshVault(`/api/vault?fresh=${Date.now()}`), 15_000);
    return () => clearTimeout(id);
  }, [refreshKey, refreshVault]);

  const state = vault.data;
  const guard = state ? GUARD_BADGE[state.guardStatus] : null;
  const guardTripped = state?.guardStatus === "Depegged" || state?.guardStatus === "Stale";
  const impaired = (state?.impaired?.length ?? 0) > 0;

  return (
    <>
      <PageHeader kicker="Deposit USDT0 · receive nUSDT0 · earn from XOXNO" title="The Vault">
        {/* Only surfaces when something needs the user's attention. */}
        {(guardTripped || state?.paused || impaired) && (
          <div className="flex flex-wrap gap-2">
            {impaired && <Badge tone="bad">Strategy not answering · withdrawals open, deposits closed</Badge>}
            {guardTripped && guard && <Badge tone={guard.tone}>{guard.label}</Badge>}
            {state?.paused && <Badge tone="bad">Deposits paused</Badge>}
          </div>
        )}
      </PageHeader>

      <div className="mx-auto max-w-7xl px-5 pb-24 pt-10 sm:px-8">
        <NetworkWarning />
        {vault.error && !state && (
          <p className="mb-6 rounded-2xl bg-red-500/10 p-4 text-[14px] text-red-600">
            Can&apos;t reach the Nema API right now. Retrying…
          </p>
        )}

        <div>
          <Stats
            vault={state}
            shares={address ? (account.status?.nusdt0 ?? 0n) : null}
            summary={address ? summary.data : undefined}
          />
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[420px_1fr]">
          <div className="lg:sticky lg:top-6">
            <ActionCard
              status={account.status}
              paused={state?.paused ?? false}
              guardTripped={guardTripped}
              impaired={impaired}
              onSettled={refreshAll}
            />
          </div>
          <div className="grid min-w-0 gap-8">
            <PriceChart
              summary={address ? summary.data : undefined}
              shares={address ? (account.status?.nusdt0 ?? null) : null}
              livePrice={state ? BigInt(state.sharePrice) : null}
              now={state ? Date.parse(state.updatedAt) : null}
              vaultTotal={state?.totalAssets ?? null}
              apyBps={state?.netAprBps ?? null}
            />
            <Allocation vault={state} />
            {address && <Activity refreshKey={refreshKey} account={address} />}
            <Activity refreshKey={refreshKey} />
          </div>
        </div>
      </div>
    </>
  );
}
