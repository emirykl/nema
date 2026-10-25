/**
 * Keeper: calls the vault's permissionless maintenance entry points.
 * Holds no privileges; anyone could run it. Each action is its own
 * transaction to stay inside Soroban resource limits.
 */
import { Keypair, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { config } from "./config";
import { kv } from "./db";
import { keepAlive } from "./keepalive";
import { watchRisk } from "./risk";
import { logger } from "./log";
import { invoke, read } from "./soroban";
import { vaultState } from "./vault";

const log = logger("keeper");
const { contracts, assets } = config.deployment;
const BPS = 10_000n;
const ONE_TOKEN = 10_000_000n;
/** Skip rebalances smaller than 0.5% of TVL (and below one token). */
const DRIFT_BPS = 50n;
const HARVEST_EVERY_MS = 60 * 60_000;
const ORACLE_REFRESH_AFTER_S = 6 * 60 * 60;

const oracleAsset = xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Other"), xdr.ScVal.scvSymbol("USDT0")]);

/** Serverless instances share no memory, so "last ran" lives in Supabase. */
async function due(step: string, everyMs: number) {
  const last = await kv.get<{ at: number }>(`keeper:${step}`);
  return !last || Date.now() - last.at >= everyMs;
}

export function keeperKey(): Keypair | undefined {
  return config.KEEPER_SECRET ? Keypair.fromSecret(config.KEEPER_SECRET) : undefined;
}

/** Testnet only: keeps the mock SEP-40 price fresh so the guard stays healthy. */
async function refreshMockOracle(signer: Keypair) {
  if (!assets.usdt0.mock) return;
  const last = await read<{ timestamp: bigint } | undefined>(contracts.oracle, "lastprice", [oracleAsset]);
  const age = last ? Date.now() / 1000 - Number(last.timestamp) : Infinity;
  if (age < ORACLE_REFRESH_AFTER_S) return;
  await invoke(signer, contracts.oracle, "set_price", [oracleAsset, nativeToScVal(100_000_000n, { type: "i128" })]);
  log.info("mock oracle refreshed at $1.00");
}

async function rebalanceIfDrifted(signer: Keypair) {
  const state = await vaultState({ fresh: true });
  const defensive = state.paused || state.guardStatus === "Depegged" || state.guardStatus === "Stale";
  const threshold = (state.totalAssets * DRIFT_BPS) / BPS;
  const minMove = threshold > ONE_TOKEN ? threshold : ONE_TOKEN;
  const buffer = (state.totalAssets * BigInt(state.bufferBps)) / BPS;

  for (const s of state.strategies) {
    const target = defensive ? 0n : (state.totalAssets * BigInt(s.target_bps)) / BPS;
    const drift = target - s.balance;
    const movable = drift > 0n ? min(drift, state.idleAssets - buffer) : -drift;
    // Defensive unwinds always run, however small.
    if (movable <= 0n || (movable < minMove && !(defensive && s.balance > 0n))) continue;

    const { result } = await invoke(signer, contracts.vault, "rebalance", [
      nativeToScVal(s.address, { type: "address" }),
    ]);
    log.info(`rebalanced ${s.name}: ${result} stroops`);
  }
}

/**
 * Moves new deposits into the strategy right away instead of at the next
 * cron round. At most one attempt per minute across all instances; it only
 * sends a transaction when the vault has actually drifted from its targets.
 */
export async function nudgeRebalance() {
  const signer = keeperKey();
  if (!signer || !(await kv.lease("rebalance-nudge", 60_000))) return;
  await rebalanceIfDrifted(signer);
}

export async function runKeeper() {
  const signer = keeperKey();
  if (!signer) {
    log.warn("KEEPER_SECRET not set; skipping");
    return;
  }
  const steps: [string, () => Promise<void>][] = [
    // First, so nothing after it (nor any user) pays a large rent gap.
    ["keepalive", async () => void (await keepAlive(signer))],
    // Before rebalancing: a strategy that stopped answering must be reported first.
    ["risk", () => watchRisk(signer)],
    ["oracle", () => refreshMockOracle(signer)],
    [
      "harvest",
      async () => {
        if (!(await due("harvest", HARVEST_EVERY_MS))) return;
        const { result } = await invoke(signer, contracts.vault, "harvest");
        await kv.set("keeper:harvest", { at: Date.now() });
        log.info(`harvested, fee shares minted: ${result}`);
      },
    ],
    ["rebalance", () => rebalanceIfDrifted(signer)],
  ];

  // Steps are independent; one failing must not block the others.
  for (const [name, step] of steps) {
    await step().catch((err) => log.error(`${name} failed`, String(err)));
  }
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);
