"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "./config";

export interface Usdt0Stats {
  supply: number;
  trustlines: number;
  fundedAccounts: number;
  idleShare: number;
  price: number | null;
  updatedAt: string;
}

export interface YieldSource {
  id: "xoxno" | "aquarius";
  name: string;
  kind: string;
  apy: number;
  tvlUsd: number;
  breakdown: { label: string; apy: number }[];
  status: "live" | "next";
}

export interface StrategyState {
  address: string;
  name: string;
  cap_bps: number;
  target_bps: number;
  balance: string;
  aprBps: number;
  allocationBps: number;
}

export interface VaultState {
  totalAssets: string;
  totalShares: string;
  sharePrice: string;
  idleAssets: string;
  paused: boolean;
  guardStatus: "Disabled" | "Healthy" | "Depegged" | "Stale";
  feeBps: number;
  bufferBps: number;
  strategies: StrategyState[];
  netAprBps: number;
  realizedApy: number | null;
  updatedAt: string;
}

export interface Snapshot {
  t: number;
  sharePrice: string;
  totalAssets: string;
}

export interface VaultEvent {
  id: string;
  kind: "deposit" | "withdraw";
  account?: string;
  data: { assets?: string; shares?: string };
  txHash: string;
  at: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.message ?? `Request failed (${res.status})`, res.status, body.error);
  return body as T;
}

/** Fetches `path` on mount and every `refreshMs`. Keeps the last good value on errors. */
export function useApi<T>(path: string | null, refreshMs = 0) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const alive = useRef(true);

  const load = useCallback((): Promise<void> => {
    if (!path) return Promise.resolve();
    return api<T>(path).then(
      (next) => {
        if (!alive.current) return;
        setData(next);
        setError(undefined);
      },
      (err: Error) => {
        if (alive.current) setError(err);
      },
    );
  }, [path]);

  useEffect(() => {
    alive.current = true;
    load();
    const timer = refreshMs > 0 ? setInterval(load, refreshMs) : undefined;
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [load, refreshMs]);

  return { data, error, loading: !data && !error, refresh: load };
}
