/**
 * One maintenance round: keeper, share-price snapshot, event indexer.
 * Supabase pg_cron calls it every 10 minutes; the vault endpoint also
 * triggers it when the last round is stale, so a missed cron heals itself.
 */
import { indexEvents } from "./activity";
import { config } from "./config";
import { kv } from "./db";
import { runKeeper } from "./keeper";
import { logger } from "./log";
import { recordSnapshot } from "./snapshots";

const log = logger("tick");
export const TICK_EVERY_MS = 10 * 60_000;
/** A round is never started twice inside this window, across all instances. */
const LEASE_MS = TICK_EVERY_MS - 30_000;

/** `force` skips the lease (demo/manual runs); the keeper's own checks still apply. */
export async function tick({ force = false } = {}): Promise<{ ran: boolean; failed: string[] }> {
  if (!force && !(await kv.lease("tick", LEASE_MS))) return { ran: false, failed: [] };

  const failed: string[] = [];
  const steps: [string, () => Promise<void>][] = [
    ["snapshot", recordSnapshot],
    ["activity", indexEvents],
    ...(config.KEEPER_ENABLED ? ([["keeper", runKeeper]] as [string, () => Promise<void>][]) : []),
  ];
  // Snapshot and indexer are reads; they go first so the chart never waits on keeper transactions.
  for (const [name, step] of steps) {
    await step().catch((err) => {
      failed.push(name);
      log.error(`${name} failed`, String(err));
    });
  }
  return { ran: true, failed };
}
