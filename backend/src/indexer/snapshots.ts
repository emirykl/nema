/** Periodic share-price samples for the price chart and realized APY. */
import { config } from "../config.js";
import { logger } from "../lib/log.js";
import { read } from "../lib/soroban.js";
import { jsonStore } from "./store.js";

export interface Snapshot {
  t: number;
  sharePrice: string;
  totalAssets: string;
  totalShares: string;
}

const MAX_POINTS = 10_000;
const SECONDS_PER_YEAR = 31_536_000;
const log = logger("snapshots");
const store = jsonStore<Snapshot[]>("snapshots", []);
let points = store.load();

export async function recordSnapshot() {
  const vault = config.deployment.contracts.vault;
  const [sharePrice, totalAssets, totalShares] = await Promise.all([
    read<bigint>(vault, "share_price"),
    read<bigint>(vault, "total_assets"),
    read<bigint>(vault, "total_shares"),
  ]);
  points.push({
    t: Date.now(),
    sharePrice: sharePrice.toString(),
    totalAssets: totalAssets.toString(),
    totalShares: totalShares.toString(),
  });
  if (points.length > MAX_POINTS) points = points.slice(-MAX_POINTS);
  store.save(points);
}

export function history(sinceMs = 0): Snapshot[] {
  return points.filter((p) => p.t >= sinceMs);
}

/** Annualized share-price growth over the recorded window, in percent. */
export function realizedApy(): number | null {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const seconds = (last.t - first.t) / 1000;
  if (seconds < 3600) return null;
  const growth = Number(last.sharePrice) / Number(first.sharePrice);
  return (growth ** (SECONDS_PER_YEAR / seconds) - 1) * 100;
}

export function startSnapshots() {
  const tick = () => recordSnapshot().catch((err) => log.warn("snapshot failed", String(err)));
  tick();
  return setInterval(tick, config.SNAPSHOT_INTERVAL_SECONDS * 1000);
}
