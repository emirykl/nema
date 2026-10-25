/**
 * Keeper: calls the vault's permissionless maintenance entry points.
 * Holds no privileges; anyone could run it. Each action is its own
 * transaction to stay inside Soroban resource limits.
 */
import { Keypair, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { logger } from "../lib/log.js";
import { invoke, read } from "../lib/soroban.js";
import { vaultState } from "../services/vault.js";

const log = logger("keeper");
const { contracts, assets } = config.deployment;
const BPS = 10_000n;
const ONE_TOKEN = 10_000_000n;
/** Skip rebalances smaller than 0.5% of TVL (and below one token). */
const DRIFT_BPS = 50n;
const HARVEST_EVERY_MS = 60 * 60_000;
const TTL_EVERY_MS = 24 * 60 * 60_000;
const ORACLE_REFRESH_AFTER_S = 6 * 60 * 60;

const oracleAsset = xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Other"), xdr.ScVal.scvSymbol("USDT0")]);

let lastHarvest = 0;
let lastTtl = 0;

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
  const state = await vaultState();
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

export async function runKeeper() {
  const signer = keeperKey();
  if (!signer) {
    log.warn("KEEPER_SECRET not set; skipping");
    return;
  }
  const steps: [string, () => Promise<void>][] = [
    ["oracle", () => refreshMockOracle(signer)],
    [
      "harvest",
      async () => {
        if (Date.now() - lastHarvest < HARVEST_EVERY_MS) return;
        const { result } = await invoke(signer, contracts.vault, "harvest");
        lastHarvest = Date.now();
        log.info(`harvested, fee shares minted: ${result}`);
      },
    ],
    ["rebalance", () => rebalanceIfDrifted(signer)],
    [
      "ttl",
      async () => {
        if (Date.now() - lastTtl < TTL_EVERY_MS) return;
        await invoke(signer, contracts.vault, "extend_ttl");
        lastTtl = Date.now();
      },
    ],
  ];

  // Steps are independent; one failing must not block the others.
  for (const [name, step] of steps) {
    await step().catch((err) => log.error(`${name} failed`, String(err)));
  }
}

export function startKeeper() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    await runKeeper().finally(() => (running = false));
  };
  tick();
  return setInterval(tick, config.KEEPER_INTERVAL_SECONDS * 1000);
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);
