"use client";

import { useCallback, useEffect, useState } from "react";
import { accountStatus, readableError, type AccountStatus } from "@/lib/stellar";

/** Horizon view of the connected account: existence, trustlines, balances. */
export function useAccount(address: string | null) {
  const [status, setStatus] = useState<AccountStatus | null>(null);

  const refresh = useCallback(
    (): Promise<void> => (address ? accountStatus(address).catch(() => null) : Promise.resolve(null)).then(setStatus),
    [address],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, refresh };
}

export type TxPhase = "idle" | "building" | "signing" | "submitting" | "done" | "error";

/** Runs one wallet transaction at a time and tracks its phase. */
export function useTx() {
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  const run = useCallback(
    async (steps: {
      build: () => Promise<string>;
      sign: (xdr: string) => Promise<string>;
      submit: (signed: string) => Promise<string>;
    }) => {
      setError(null);
      setHash(null);
      try {
        setPhase("building");
        const xdr = await steps.build();
        setPhase("signing");
        const signed = await steps.sign(xdr);
        setPhase("submitting");
        setHash(await steps.submit(signed));
        setPhase("done");
        return true;
      } catch (err) {
        setError(readableError(err));
        setPhase("error");
        return false;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
  }, []);

  return {
    phase,
    error,
    hash,
    run,
    reset,
    busy: phase === "building" || phase === "signing" || phase === "submitting",
  };
}

/**
 * Projects a value growing at `aprBps` from `since`, re-rendering every
 * `intervalMs`. Used to show yield accruing between on-chain reads.
 */
export function useAccruing(base: bigint | null, aprBps: number, since: string | undefined, intervalMs = 100) {
  // The clock is only read inside the timer, so prerendering stays deterministic.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  if (base === null || !since) return null;
  if (now === null) return base;
  const elapsed = Math.max(0, (now - new Date(since).getTime()) / 1000);
  // Parts per trillion keeps sub-stroop growth visible second by second.
  const growthPpt = BigInt(Math.floor((aprBps / 10_000) * (elapsed / 31_536_000) * 1e12));
  return base + (base * growthPpt) / 1_000_000_000_000n;
}
