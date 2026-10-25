import { nativeToScVal } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { cached } from "../lib/cache.js";
import { read } from "../lib/soroban.js";

const { contracts, assets } = config.deployment;
const BPS = 10_000;

export interface StrategyInfo {
  address: string;
  cap_bps: number;
  target_bps: number;
}

export interface StrategyState extends StrategyInfo {
  name: string;
  balance: bigint;
  /** Annual rate the underlying market currently pays, in bps. */
  aprBps: number;
  /** Share of total assets currently held, in bps. */
  allocationBps: number;
}

export interface VaultState {
  totalAssets: bigint;
  totalShares: bigint;
  sharePrice: bigint;
  idleAssets: bigint;
  paused: boolean;
  guardStatus: "Disabled" | "Healthy" | "Depegged" | "Stale";
  feeBps: number;
  bufferBps: number;
  unclaimedFeeShares: bigint;
  strategies: StrategyState[];
  /** Expected APY for holders: allocation-weighted strategy rate, net of fees. */
  netAprBps: number;
  updatedAt: string;
}

const STRATEGY_NAMES: Record<string, string> = {
  [contracts.strategyXoxno]: "XOXNO Lending",
};

/** Unit enum variants decode as `[name]`. */
const variant = <T extends string>(v: unknown) => (Array.isArray(v) ? v[0] : v) as T;

async function strategyApr(address: string): Promise<number> {
  if (address !== contracts.strategyXoxno) return 0;
  const market = await read<{ rate_bps: number }>(contracts.lending, "market");
  return Number(market.rate_bps);
}

async function loadState(): Promise<VaultState> {
  const v = contracts.vault;
  const [totalAssets, totalShares, sharePrice, idleAssets, paused, guard, feeBps, bufferBps, unclaimed, infos] =
    await Promise.all([
      read<bigint>(v, "total_assets"),
      read<bigint>(v, "total_shares"),
      read<bigint>(v, "share_price"),
      read<bigint>(v, "idle_assets"),
      read<boolean>(v, "is_paused"),
      read<unknown>(v, "guard_status"),
      read<number>(v, "fee_bps"),
      read<number>(v, "buffer_bps"),
      read<bigint>(v, "unclaimed_fee_shares"),
      read<StrategyInfo[]>(v, "strategies"),
    ]);

  const strategies = await Promise.all(
    infos.map(async (info): Promise<StrategyState> => {
      const [balance, aprBps] = await Promise.all([read<bigint>(info.address, "balance"), strategyApr(info.address)]);
      return {
        ...info,
        name: STRATEGY_NAMES[info.address] ?? "Strategy",
        balance,
        aprBps,
        allocationBps: totalAssets > 0n ? Number((balance * BigInt(BPS)) / totalAssets) : 0,
      };
    }),
  );

  const grossAprBps = strategies.reduce((sum, s) => sum + (s.aprBps * s.allocationBps) / BPS, 0);
  return {
    totalAssets,
    totalShares,
    sharePrice,
    idleAssets,
    paused,
    guardStatus: variant(guard),
    feeBps: Number(feeBps),
    bufferBps: Number(bufferBps),
    unclaimedFeeShares: unclaimed,
    strategies,
    netAprBps: Math.round(grossAprBps * (1 - Number(feeBps) / BPS)),
    updatedAt: new Date().toISOString(),
  };
}

export const vaultState = cached(10_000, loadState);

export async function position(address: string) {
  const addr = nativeToScVal(address, { type: "address" });
  const [shares, assetBalance] = await Promise.all([
    read<bigint>(assets.nusdt0.contract, "balance", [addr]).catch(() => 0n),
    read<bigint>(assets.usdt0.contract, "balance", [addr]).catch(() => 0n),
  ]);
  const value = shares > 0n
    ? await read<bigint>(contracts.vault, "preview_withdraw", [nativeToScVal(shares, { type: "i128" })])
    : 0n;
  return { address, shares, value, assetBalance };
}
