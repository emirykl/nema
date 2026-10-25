import { StrKey } from "@stellar/stellar-sdk";
import { Hono } from "hono";
import { after } from "next/server";
import { z } from "zod";
import { indexEvents, indexIfStale, positionSummary, recentActivity } from "./activity";
import { config } from "./config";
import { drip, FaucetError } from "./faucet";
import { logger } from "./log";
import { usdt0Stats, yieldSources } from "./mainnet";
import { history, realizedApy } from "./snapshots";
import { serialize } from "./soroban";
import { nudgeRebalance } from "./keeper";
import { tick } from "./tick";
import { position, vaultState } from "./vault";

const log = logger("api");

/**
 * Vercel's CDN answers repeat requests from cache, so the function runs at
 * most once per window however many people have the page open.
 */
const cdn = (seconds: number) => `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`;
const RANGES = { "24h": 86_400_000, "7d": 604_800_000, all: Infinity } as const;
const USER_KINDS = ["deposit", "withdraw"] as const;
/** How often one instance may try to start a self-healing tick (the lease decides if it runs). */
const NUDGE_EVERY_MS = 5 * 60_000;
let lastNudge = 0;

export const app = new Hono().basePath("/api");

app.onError((err, c) => {
  log.error(`${c.req.method} ${c.req.path}`, String(err));
  return c.json({ error: "upstream_unavailable" }, 502);
});

app.get("/health", (c) => c.json({ ok: true }));

/** Public deployment info: network, assets and contract ids. */
app.get("/config", (c) => {
  const { rpcUrl, horizonUrl, networkPassphrase, network, assets, contracts, lending, vault } = config.deployment;
  return c.json({ network, rpcUrl, horizonUrl, networkPassphrase, assets, contracts, lending, vault });
});

app.get("/mainnet/usdt0", async (c) => c.json(await usdt0Stats(), 200, { "cache-control": cdn(600) }));

app.get("/mainnet/yields", async (c) => c.json(await yieldSources(), 200, { "cache-control": cdn(600) }));

app.get("/vault", async (c) => {
  // After their own deposit or withdrawal the app asks for fresh numbers; that is
  // also the moment new money should start earning, so nudge a rebalance.
  const fresh = c.req.query("fresh") !== undefined;
  if (fresh) {
    after(() => nudgeRebalance().catch((err) => log.error("rebalance nudge failed", String(err))));
  } else if (Date.now() - lastNudge > NUDGE_EVERY_MS) {
    // If the cron missed a beat, the first visitor restarts the round after responding.
    lastNudge = Date.now();
    after(() => tick().catch((err) => log.error("nudge failed", String(err))));
  }
  const [state, apy] = await Promise.all([vaultState({ fresh }), realizedApy().catch(() => null)]);
  return c.json(serialize({ ...state, realizedApy: apy }), 200, {
    "cache-control": fresh ? "no-store" : cdn(15),
  });
});

app.get("/vault/history", async (c) => {
  const range = z.enum(["24h", "7d", "all"]).catch("7d").parse(c.req.query("range"));
  const window = RANGES[range];
  const ttl = range === "all" ? 3600 : 300;
  return c.json(await history(window === Infinity ? 0 : Date.now() - window), 200, { "cache-control": cdn(ttl) });
});

app.get("/vault/activity", async (c) => {
  const limit = z.coerce.number().int().min(1).max(100).catch(20).parse(c.req.query("limit"));
  await indexIfStale()?.catch((err) => log.warn("index failed", String(err)));
  return c.json(await recentActivity(limit, [...USER_KINDS]), 200, { "cache-control": cdn(20) });
});

app.get("/positions/:address", async (c) => {
  const address = c.req.param("address");
  if (!StrKey.isValidEd25519PublicKey(address)) return c.json({ error: "invalid_address" }, 400);
  return c.json(serialize(await position(address)), 200, { "cache-control": cdn(10) });
});

/** One wallet's deposits and withdrawals, newest first. */
app.get("/positions/:address/history", async (c) => {
  const address = c.req.param("address");
  if (!StrKey.isValidEd25519PublicKey(address)) return c.json({ error: "invalid_address" }, 400);
  const limit = z.coerce.number().int().min(1).max(100).catch(50).parse(c.req.query("limit"));
  await indexIfStale()?.catch((err) => log.warn("index failed", String(err)));
  return c.json(await recentActivity(limit, [...USER_KINDS], address), 200, { "cache-control": cdn(10) });
});

/**
 * Lifetime totals for one wallet. `?fresh` (sent right after the user's own
 * transaction) indexes the chain first and skips every cache.
 */
app.get("/positions/:address/summary", async (c) => {
  const address = c.req.param("address");
  if (!StrKey.isValidEd25519PublicKey(address)) return c.json({ error: "invalid_address" }, 400);
  const fresh = c.req.query("fresh") !== undefined;
  await (fresh ? indexEvents() : indexIfStale())?.catch((err) => log.warn("index failed", String(err)));
  return c.json(await positionSummary(address), 200, { "cache-control": fresh ? "no-store" : cdn(10) });
});

app.post("/faucet", async (c) => {
  const body = z.object({ address: z.string() }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid_body" }, 400);
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "unknown";

  try {
    return c.json(await drip(body.data.address, ip));
  } catch (err) {
    if (err instanceof FaucetError) {
      const status = err.code === "cooldown" ? 429 : err.code === "disabled" ? 503 : 400;
      return c.json({ error: err.code, message: err.message }, status);
    }
    throw err;
  }
});

/** Maintenance round. Called by Supabase pg_cron (or Vercel Cron) with the shared secret. */
app.on(["GET", "POST"], "/cron/tick", async (c) => {
  if (!config.CRON_SECRET || c.req.header("authorization") !== `Bearer ${config.CRON_SECRET}`) {
    return c.json({ error: "unauthorized" }, 401);
  }
  return c.json(await tick({ force: c.req.query("force") === "1" }));
});
