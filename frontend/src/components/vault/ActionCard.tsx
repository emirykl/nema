"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Caps } from "@/components/ui/Caps";
import { Card, InfoTip } from "@/components/ui/Card";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { config, explorer } from "@/lib/config";
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
import { TentacleGrip } from "@/components/illustrations/TentacleGrip";
import { Onboarding } from "./Onboarding";
import { VaultScene } from "./VaultScene";

type Mode = "deposit" | "withdraw";

const PHASE_LABEL: Partial<Record<TxPhase, string>> = {
  building: "Preparing…",
  signing: "Confirm in wallet…",
  submitting: "Sending…",
};

const PERCENTS = [25, 50, 75, 100] as const;

/** `pct`% of `balance`; 100% is the exact balance, with no rounding dust left behind. */
const fraction = (balance: bigint, pct: number) => (pct === 100 ? balance : (balance * BigInt(pct)) / 100n);
const toInput = (stroops: bigint) => formatAmount(stroops, 7).replace(/,/g, "");

export function ActionCard({
  status,
  paused,
  guardTripped,
  impaired = false,
  onSettled,
}: {
  status: AccountStatus | null;
  paused: boolean;
  guardTripped: boolean;
  /** A strategy stopped answering: deposits are closed until it recovers. */
  impaired?: boolean;
  onSettled: () => Promise<void>;
}) {
  const { address, sign, wrongNetwork } = useWallet();
  const [mode, setMode] = useState<Mode>("deposit");
  const [input, setInput] = useState("");
  const [quote, setQuote] = useState<{ key: string; value: bigint } | null>(null);
  const tx = useTx();

  const amount = parseAmount(input);
  const quoteKey = `${mode}:${amount}`;
  const preview = quote?.key === quoteKey ? quote.value : null;
  const balance = mode === "deposit" ? (status?.usdt0 ?? 0n) : (status?.nusdt0 ?? 0n);
  const [inSymbol, outSymbol] = mode === "deposit" ? ["USDT0", "nUSDT0"] : ["nUSDT0", "USDT0"];
  const depositsBlocked = mode === "deposit" && (paused || guardTripped || impaired);

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
  if (wrongNetwork) problem = `Switch wallet to ${config.network === "testnet" ? "Testnet" : "Mainnet"}`;
  else if (input && amount === null) problem = "Enter a valid amount";
  else if (amount && amount > balance) problem = `Not enough ${inSymbol}`;
  else if (depositsBlocked)
    problem = paused
      ? "Deposits are paused"
      : impaired
        ? "Deposits closed: a strategy isn't answering"
        : "Deposits on hold: peg guard tripped";

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
    <Card className="overflow-hidden p-5 sm:p-6">
      <div className="-mx-5 -mt-5 mb-5 border-b-2 border-ink sm:-mx-6 sm:-mt-6">
        <VaultScene mode={mode} phase={tx.phase} celebrate={tx.phase === "done" ? tx.hash : null} />
      </div>
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
        <div className="flex flex-col items-center py-8 text-center">
          <p className="max-w-[16rem] text-[15px] text-muted">Connect a Stellar wallet to deposit or withdraw.</p>
          <div className="mt-5">
            <ConnectButton size="lg" variant="primary" />
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {needsSetup && !wrongNetwork && <Onboarding status={status} onChange={onSettled} />}

          <div className="rounded-[4px] border-2 border-ink bg-paper p-4 focus-within:border-ocean">
            <div className="flex items-center justify-between text-[13px] text-muted">
              <span>{mode === "deposit" ? "You deposit" : "You return"}</span>
              <span className="tabular">Balance {formatAmount(balance, 4)}</span>
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

          <div className="grid grid-cols-4 gap-2">
            {PERCENTS.map((pct) => {
              const value = fraction(balance, pct);
              const active = amount !== null && balance > 0n && amount === value;
              return (
                <button
                  key={pct}
                  type="button"
                  disabled={balance <= 0n}
                  onClick={() => setInput(toInput(value))}
                  className={`label h-9 rounded-[3px] border-2 border-ink text-[15px] transition disabled:opacity-40 ${
                    active ? "bg-navy text-paper" : "bg-paper hover:bg-surface-2"
                  }`}
                >
                  {pct === 100 ? "Max" : `${pct}%`}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-1 text-[14px]">
            <span className="text-muted">You receive</span>
            <span className="tabular font-semibold">
              {preview !== null ? `≈ ${formatAmount(preview, 4)}` : "—"} {outSymbol}
            </span>
          </div>

          <TentacleGrip>
            <Button
              size="lg"
              className="w-full"
              variant={mode === "deposit" ? "primary" : "secondary"}
              disabled={!amount || amount <= 0n || !!problem || !ready || tx.busy}
              onClick={submit}
            >
              {PHASE_LABEL[tx.phase] ?? problem ?? (mode === "deposit" ? "Deposit" : "Withdraw")}
            </Button>
          </TentacleGrip>

          {tx.phase === "done" && tx.hash && (
            <p className="text-center text-[13px] text-emerald-600 dark:text-emerald-400">
              Done.{" "}
              <a href={explorer.tx(tx.hash)} target="_blank" rel="noreferrer" className="underline">
                View transaction
              </a>
            </p>
          )}
          {tx.error && <p className="text-center text-[13px] text-red-500">{tx.error}</p>}

          <p className="flex items-center justify-center gap-1.5 text-[12px] text-muted">
            Withdrawals stay open at all times.
            <InfoTip align="right">
              {mode === "deposit"
                ? "You get nUSDT0 at today's share price. If the price moves more than 0.5% before your transaction lands, it is cancelled and nothing is spent."
                : "Small withdrawals are paid instantly from the vault's 5% buffer; larger ones are pulled back from the strategy in the same transaction. Pausing never blocks withdrawals."}
            </InfoTip>
          </p>
        </div>
      )}
    </Card>
  );
}
