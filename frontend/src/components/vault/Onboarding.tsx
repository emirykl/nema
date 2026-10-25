"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/components/wallet/WalletProvider";
import { api } from "@/lib/api";
import { buildTrustlines, fundWithFriendbot, readableError, submitClassic, type AccountStatus } from "@/lib/stellar";

type StepId = "fund" | "trust" | "faucet";

/**
 * Testnet setup checklist: fund the account, add both trustlines in one
 * signature, then grab mock USDT0 from the faucet.
 */
export function Onboarding({ status, onChange }: { status: AccountStatus; onChange: () => Promise<void> }) {
  const { address, sign } = useWallet();
  const [busy, setBusy] = useState<StepId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trustDone = status.hasUsdt0Trustline && status.hasNusdt0Trustline;
  const steps: { id: StepId; title: string; body: string; done: boolean; action: string }[] = [
    {
      id: "fund",
      title: "Activate testnet account",
      body: "Free test XLM from Friendbot pays the fees.",
      done: status.exists,
      action: "Fund",
    },
    {
      id: "trust",
      title: "Enable USDT0 and nUSDT0",
      body: "One signature adds both assets to your wallet.",
      done: trustDone,
      action: "Enable",
    },
    {
      id: "faucet",
      title: "Get 1,000 test USDT0",
      body: "Mock USDT0: real USDT0 is mainnet only.",
      done: status.usdt0 > 0n || status.nusdt0 > 0n,
      action: "Get",
    },
  ];
  const current = steps.find((s) => !s.done)?.id;

  async function act(id: StepId) {
    if (!address) return;
    setBusy(id);
    setError(null);
    try {
      if (id === "fund") await fundWithFriendbot(address);
      if (id === "trust") await submitClassic(await sign(await buildTrustlines(address, status)));
      if (id === "faucet") await api("/api/faucet", { method: "POST", body: JSON.stringify({ address }) });
      await onChange();
    } catch (err) {
      setError(err instanceof Error && id === "faucet" ? err.message : readableError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-[4px] border-2 border-dashed border-ink/40 p-4">
      <div className="label text-[16px] text-clown-deep">✦ Testnet setup</div>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={step.id} className="flex items-center gap-3">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ${
                step.done
                  ? "bg-emerald-500 text-white"
                  : step.id === current
                    ? "bg-ocean text-white"
                    : "bg-line text-muted"
              }`}
            >
              {step.done ? "✓" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className={`text-[14px] font-semibold ${step.done ? "text-muted line-through" : ""}`}>
                {step.title}
              </div>
              <div className="text-[12px] text-muted">{step.body}</div>
            </div>
            {step.id === current && (
              <Button
                variant="secondary"
                className="!h-8 !px-4 !text-[13px]"
                disabled={busy !== null}
                onClick={() => act(step.id)}
              >
                {busy === step.id ? "…" : step.action}
              </Button>
            )}
          </li>
        ))}
      </ol>
      {error && <p className="mt-3 text-[13px] text-red-500">{error}</p>}
    </div>
  );
}
