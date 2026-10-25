/**
 * Live mainnet market data for the pitch: how much USDT0 sits idle on
 * Stellar, and what its yield sources pay today.
 */
import { z } from "zod";
import { mainnet } from "../config.js";
import { cached } from "../lib/cache.js";

const TEN_MINUTES = 10 * 60_000;

async function getJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return schema.parse(await res.json());
}

const ExpertAsset = z.object({
  supply: z.coerce.bigint(),
  price: z.number().optional(),
  trustlines: z.object({ total: z.number(), funded: z.number() }),
});

export const usdt0Stats = cached(TEN_MINUTES, async () => {
  const { usdt0 } = mainnet;
  const data = await getJson(
    `https://api.stellar.expert/explorer/public/asset/${usdt0.code}-${usdt0.issuer}`,
    ExpertAsset,
  );
  return {
    supply: Number(data.supply) / 1e7,
    trustlines: data.trustlines.total,
    fundedAccounts: data.trustlines.funded,
    idleShare: 1 - data.trustlines.funded / data.trustlines.total,
    price: data.price ?? null,
    source: "StellarExpert",
    updatedAt: new Date().toISOString(),
  };
});

const LlamaPools = z.object({
  data: z.array(
    z.object({
      chain: z.string(),
      project: z.string(),
      symbol: z.string(),
      apy: z.number().nullable(),
      tvlUsd: z.number(),
    }),
  ),
});

const AquaPools = z.object({
  items: z.array(
    z.object({
      address: z.string(),
      liquidity_usd: z.coerce.number(),
      total_apy: z.coerce.number(),
      apy: z.coerce.number(),
      rewards_apy: z.coerce.number(),
    }),
  ),
});

export interface YieldSource {
  id: "xoxno" | "aquarius";
  name: string;
  kind: string;
  /** Percent, e.g. 0.76 */
  apy: number;
  tvlUsd: number;
  breakdown: { label: string; apy: number }[];
  status: "live" | "next";
}

export const yieldSources = cached(TEN_MINUTES, async (): Promise<YieldSource[]> => {
  const [llama, aqua] = await Promise.allSettled([
    getJson("https://yields.llama.fi/pools", LlamaPools),
    getJson("https://amm-api.aqua.network/pools/?search=USDT0", AquaPools),
  ]);

  const sources: YieldSource[] = [];

  if (llama.status === "fulfilled") {
    const pool = llama.value.data.find((p) => p.chain === "Stellar" && p.project === "xoxno-lending" && p.symbol === "USDT0");
    if (pool) {
      const apy = pool.apy ?? 0;
      sources.push({
        id: "xoxno",
        name: "XOXNO Lending",
        kind: "Lending interest",
        apy,
        tvlUsd: pool.tvlUsd,
        breakdown: [{ label: "Borrower interest", apy }],
        status: "live",
      });
    }
  }

  if (aqua.status === "fulfilled") {
    const pool = aqua.value.items.find((p) => p.address === mainnet.aquariusUsdt0UsdcPool);
    if (pool) {
      sources.push({
        id: "aquarius",
        name: "Aquarius USDT0/USDC",
        kind: "LP fees + AQUA rewards",
        apy: pool.total_apy * 100,
        // The AMM API reports liquidity scaled by 10^7.
        tvlUsd: pool.liquidity_usd / 1e7,
        breakdown: [
          { label: "Swap fees", apy: pool.apy * 100 },
          { label: "AQUA rewards", apy: pool.rewards_apy * 100 },
        ],
        status: "next",
      });
    }
  }

  if (sources.length === 0) throw new Error("no yield source reachable");
  return sources;
});
