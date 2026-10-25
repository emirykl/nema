"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Card";
import { useWallet } from "@/components/wallet/WalletProvider";
import { type VaultState, useApi } from "@/lib/api";
import { ActionCard } from "./ActionCard";
import { Activity } from "./Activity";
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
  const vault = useApi<VaultState>("/api/vault", 15_000);
  const account = useAccount(address);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshAll = useCallback(async () => {
    await Promise.all([account.refresh(), vault.refresh()]);
    setRefreshKey((k) => k + 1);
  }, [account, vault]);

  const state = vault.data;
  const guard = state ? GUARD_BADGE[state.guardStatus] : null;
  const guardTripped = state?.guardStatus === "Depegged" || state?.guardStatus === "Stale";

  return (
    <>
      <PageHeader kicker="Deposit USDT0 · receive nUSDT0 · earn from XOXNO" title="The Vault">
        <div className="flex flex-wrap gap-2">
          <Badge tone="clown">Testnet · mock USDT0</Badge>
          {guard && <Badge tone={guard.tone}>{guard.label}</Badge>}
          {state?.paused && <Badge tone="bad">Deposits paused</Badge>}
        </div>
      </PageHeader>

      <div className="mx-auto max-w-7xl px-5 pb-24 pt-10 sm:px-8">
        {vault.error && !state && (
          <p className="mb-6 rounded-2xl bg-red-500/10 p-4 text-[14px] text-red-600">
            Can&apos;t reach the Nema API. Start the backend (npm run dev in /backend) and refresh.
          </p>
        )}

        <div>
          <Stats vault={state} shares={address ? (account.status?.nusdt0 ?? 0n) : null} />
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[420px_1fr]">
          <div className="lg:sticky lg:top-6">
            <ActionCard
              status={account.status}
              paused={state?.paused ?? false}
              guardTripped={guardTripped}
              onSettled={refreshAll}
            />
          </div>
          <div className="grid min-w-0 gap-8">
            <PriceChart />
            <Allocation vault={state} />
            <Activity refreshKey={refreshKey} />
          </div>
        </div>
      </div>
    </>
  );
}
