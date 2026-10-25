/** Share-price samples for the price chart and realized APY. */
import { cached } from "./cache";
import { db, must, VAULT } from "./db";
import { read } from "./soroban";

export interface Snapshot {
  t: number;
  sharePrice: string;
  totalAssets: string;
  totalShares: string;
}

interface Row {
  t: number;
  share_price: string;
  total_assets: string;
  total_shares: string;
}

const SECONDS_PER_YEAR = 31_536_000;
/** The chart never needs more points than this; older ranges are thinned. */
const MAX_POINTS = 600;

const toSnapshot = (r: Row): Snapshot => ({
  t: Number(r.t),
  sharePrice: r.share_price,
  totalAssets: r.total_assets,
  totalShares: r.total_shares,
});

export async function recordSnapshot() {
  const [sharePrice, totalAssets, totalShares] = await Promise.all([
    read<bigint>(VAULT, "share_price"),
    read<bigint>(VAULT, "total_assets"),
    read<bigint>(VAULT, "total_shares"),
  ]);
  must(
    await db().from("snapshots").insert({
      vault: VAULT,
      t: Date.now(),
      share_price: sharePrice.toString(),
      total_assets: totalAssets.toString(),
      total_shares: totalShares.toString(),
    }),
  );
}

export async function history(sinceMs = 0): Promise<Snapshot[]> {
  const rows: Row[] = [];
  // PostgREST caps a response at 1,000 rows; page through the range.
  for (let from = 0; ; from += 1000) {
    const page = must(
      await db()
        .from("snapshots")
        .select("t, share_price, total_assets, total_shares")
        .eq("vault", VAULT)
        .gte("t", sinceMs)
        .order("t")
        .range(from, from + 999),
    ) as Row[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const step = Math.ceil(rows.length / MAX_POINTS);
  const thinned = step > 1 ? rows.filter((_, i) => i % step === 0 || i === rows.length - 1) : rows;
  return thinned.map(toSnapshot);
}

/** Annualized share-price growth over the recorded window, in percent. Changes slowly; cached 5 min. */
export const realizedApy = cached(5 * 60_000, async (): Promise<number | null> => {
  const pick = async (ascending: boolean) =>
    must(
      await db()
        .from("snapshots")
        .select("t, share_price, total_assets, total_shares")
        .eq("vault", VAULT)
        .order("t", { ascending })
        .limit(1)
        .maybeSingle(),
    ) as Row | null;
  const [first, last] = await Promise.all([pick(true), pick(false)]);
  if (!first || !last) return null;
  const seconds = (Number(last.t) - Number(first.t)) / 1000;
  if (seconds < 3600) return null;
  const growth = Number(last.share_price) / Number(first.share_price);
  return (growth ** (SECONDS_PER_YEAR / seconds) - 1) * 100;
});
