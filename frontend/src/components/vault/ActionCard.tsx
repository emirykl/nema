"use client";

import { useEffect, useState } from "react";
import { NemaFish } from "@/components/illustrations/NemaFish";
import { Button } from "@/components/ui/Button";
import { Caps } from "@/components/ui/Caps";
import { Card } from "@/components/ui/Card";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { explorer } from "@/lib/config";
import { formatAmount, parseAmount } from "@/lib/format";
import {
  buildDeposit,
  buildWithdraw,
  previewDeposit,
  previewWithdraw,
  submitSoroban,
  type AccountStatus,
} from "@/lib/stellar";
import { useTx, type TxPhase } from "./hooks";
import { Onboarding } from "./Onboarding";

type Mode = "deposit" | "withdraw";

const PHASE_LABEL: Partial<Record<TxPhase, string>> = {
  building: "Preparing…",
  signing: "Confirm in wallet…",
  submitting: "Sending…",
};

export function ActionCard({
  status,
  paused,
  guardTripped,
  onSettled,
}: {
  status: AccountStatus | null;
  paused: boolean;
  guardTripped: boolean;
  onSettled: () => Promise<void>;
}) {
  const { address, sign } = useWallet();
  const [mode, setMode] = useState<Mode>("deposit");
  const [input, setInput] = useState("");
  const [quote, setQuote] = useState<{ key: string; value: bigint } | null>(null);
  const tx = useTx();

  const amount = parseAmount(input);
  const quoteKey = `${mode}:${amount}`;
  const preview = quote?.key === quoteKey ? quote.value : null;
  const balance = mode === "deposit" ? (status?.usdt0 ?? 0n) : (status?.nusdt0 ?? 0n);
  const [inSymbol, outSymbol] = mode === "deposit" ? ["USDT0", "nUSDT0"] : ["nUSDT0", "USDT0"];
  const depositsBlocked = mode === "deposit" && (paused || guardTripped);

  // Debounced on-chain preview of what the user will receive.
  useEffect(() => {
    if (!amount || amount <= 0n) return;
    const handle = setTimeout(() => {
      (mode === "deposit" ? previewDeposit(amount) : previewWithdraw(amount))
        .then((value) => setQuote({ key: quoteKey, value }))
        .catch(() => setQuote(null));
    }, 300);
    return () => clearTimeout(handle);
  }, [amount, mode, quoteKey]);

  const ready = status?.exists && status.hasUsdt0Trustline && status.hasNusdt0Trustline;
  const needsSetup = status && (!ready || (status.usdt0 === 0n && status.nusdt0 === 0n));

  let problem: string | null = null;
  if (input && amount === null) problem = "Enter a valid amount";
  else if (amount && amount > balance) problem = `Not enough ${inSymbol}`;
  else if (depositsBlocked) problem = paused ? "Deposits are paused" : "Deposits on hold: peg guard tripped";

  async function submit() {
    if (!address || !amount) return;
    const ok = await tx.run({
      build: () => (mode === "deposit" ? buildDeposit(address, amount) : buildWithdraw(address, amount)),
      sign,
      submit: submitSoroban,
    });
    if (ok) {
      setInput("");
      await onSettled();
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="grid grid-cols-2 overflow-hidden rounded-[4px] border-2 border-ink" role="tablist">
        {(["deposit", "withdraw"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setInput("");
              tx.reset();
            }}
            className={`label h-11 text-[18px] transition ${
              mode === m ? "bg-navy text-paper" : "bg-surface text-muted hover:text-ink"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {!address ? (
        <div className="flex flex-col items-center py-10 text-center">
          <NemaFish className="h-24 w-32" title="" />
          <p className="mt-4 max-w-[16rem] text-[15px] text-muted">Connect a Stellar wallet to deposit or withdraw.</p>
          <div className="mt-5">
            <ConnectButton size="lg" variant="primary" />
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {needsSetup && <Onboarding status={status} onChange={onSettled} />}

          <div className="rounded-[4px] border-2 border-ink bg-paper p-4 focus-within:border-ocean">
            <div className="flex items-center justify-between text-[13px] text-muted">
              <span>{mode === "deposit" ? "You deposit" : "You return"}</span>
              <button
                className="tabular hover:text-text"
                onClick={() => setInput(formatAmount(balance, 7).replace(/,/g, ""))}
              >
                Balance {formatAmount(balance, 4)} <span className="font-semibold text-ocean">MAX</span>
              </button>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                inputMode="decimal"
                placeholder="0"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="tabular w-full min-w-0 bg-transparent text-[36px] font-semibold tracking-[-0.03em] outline-none placeholder:text-muted/50"
                aria-label={`Amount of ${inSymbol}`}
              />
              <span className="label shrink-0 rounded-[3px] bg-navy px-3 py-1 text-[16px] text-paper">
                <Caps>{inSymbol}</Caps>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between px-1 text-[14px]">
            <span className="text-muted">You receive</span>
            <span className="tabular font-semibold">
              {preview !== null ? `≈ ${formatAmount(preview, 4)}` : "—"} {outSymbol}
            </span>
          </div>

          <Button
            size="lg"
            className="w-full"
            variant={mode === "deposit" ? "primary" : "secondary"}
            disabled={!amount || amount <= 0n || !!problem || !ready || tx.busy}
            onClick={submit}
          >
            {PHASE_LABEL[tx.phase] ?? problem ?? (mode === "deposit" ? "Deposit" : "Withdraw")}
          </Button>

          {tx.phase === "done" && tx.hash && (
            <p className="text-center text-[13px] text-emerald-600 dark:text-emerald-400">
              Done.{" "}
              <a href={explorer.tx(tx.hash)} target="_blank" rel="noreferrer" className="underline">
                View transaction
              </a>
            </p>
          )}
          {tx.error && <p className="text-center text-[13px] text-red-500">{tx.error}</p>}

          <p className="text-center text-[12px] leading-relaxed text-muted">
            {mode === "deposit"
              ? "Slippage limit 0.5%. Withdrawals stay open at all times."
              : "Small withdrawals are paid from the 5% buffer; larger ones unwind from XOXNO in the same transaction."}
          </p>
        </div>
      )}
    </Card>
  );
}
