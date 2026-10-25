/**
 * One-off: copies the old backend's JSON history (backend/data) into
 * Supabase so the chart keeps its earlier points.
 *   npm run db:import            (reads .env.local for Supabase keys)
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import deployment from "../src/config/deployment.json" with { type: "json" };

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

const vault = deployment.contracts.vault;
const dir = resolve(import.meta.dirname, "../../backend/data");
const db = createClient(url, key, { auth: { persistSession: false } });

const load = <T,>(name: string): T => JSON.parse(readFileSync(resolve(dir, `${name}-${vault}.json`), "utf8"));

const snapshots = load<{ t: number; sharePrice: string; totalAssets: string; totalShares: string }[]>("snapshots");
for (let i = 0; i < snapshots.length; i += 500) {
  const rows = snapshots.slice(i, i + 500).map((s) => ({
    vault,
    t: s.t,
    share_price: s.sharePrice,
    total_assets: s.totalAssets,
    total_shares: s.totalShares,
  }));
  const { error } = await db.from("snapshots").upsert(rows, { ignoreDuplicates: true });
  if (error) throw error;
}
console.log(`snapshots: ${snapshots.length}`);

const { events } = load<{ events: { id: string; kind: string; account?: string; data: object; txHash: string; at: string }[] }>(
  "activity",
);
const { error } = await db.from("vault_events").upsert(
  events.map((e) => ({ id: e.id, vault, kind: e.kind, account: e.account ?? null, data: e.data, tx_hash: e.txHash, at: e.at })),
  { ignoreDuplicates: true },
);
if (error) throw error;
console.log(`events: ${events.length}`);
