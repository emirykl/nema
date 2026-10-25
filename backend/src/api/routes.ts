import { StrKey } from "@stellar/stellar-sdk";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getConnInfo } from "@hono/node-server/conninfo";
import { z } from "zod";
import { config } from "../config.js";
import { recentActivity } from "../indexer/activity.js";
import { history, realizedApy } from "../indexer/snapshots.js";
import { logger } from "../lib/log.js";
import { serialize } from "../lib/soroban.js";
import { drip, FaucetError } from "../services/faucet.js";
import { usdt0Stats, yieldSources } from "../services/mainnet.js";
import { position, vaultState } from "../services/vault.js";

const log = logger("api");
const RANGES = { "24h": 86_400_000, "7d": 604_800_000, all: Infinity } as const;

export const app = new Hono();

app.use("/api/*", cors({ origin: config.CORS_ORIGIN.split(",") }));

app.onError((err, c) => {
  log.error(`${c.req.method} ${c.req.path}`, String(err));
  return c.json({ error: "upstream_unavailable" }, 502);
});

app.get("/health", (c) => c.json({ ok: true }));

/** Public deployment info: network, assets and contract ids. */
app.get("/api/config", (c) => {
  const { rpcUrl, horizonUrl, networkPassphrase, network, assets, contracts, lending, vault } = config.deployment;
  return c.json({ network, rpcUrl, horizonUrl, networkPassphrase, assets, contracts, lending, vault });
});

app.get("/api/mainnet/usdt0", async (c) => c.json(await usdt0Stats()));

app.get("/api/mainnet/yields", async (c) => c.json(await yieldSources()));

app.get("/api/vault", async (c) => {
  const state = await vaultState();
  return c.json(serialize({ ...state, realizedApy: realizedApy() }));
});

app.get("/api/vault/history", (c) => {
  const range = z.enum(["24h", "7d", "all"]).catch("7d").parse(c.req.query("range"));
  const window = RANGES[range];
  return c.json(history(window === Infinity ? 0 : Date.now() - window));
});

app.get("/api/vault/activity", (c) => {
  const limit = z.coerce.number().int().min(1).max(100).catch(20).parse(c.req.query("limit"));
  return c.json(recentActivity(limit, ["deposit", "withdraw"]));
});

app.get("/api/positions/:address", async (c) => {
  const address = c.req.param("address");
  if (!StrKey.isValidEd25519PublicKey(address)) return c.json({ error: "invalid_address" }, 400);
  return c.json(serialize(await position(address)));
});

app.post("/api/faucet", async (c) => {
  const body = z.object({ address: z.string() }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid_body" }, 400);
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? getConnInfo(c).remote.address ?? "unknown";

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
