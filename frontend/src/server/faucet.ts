/**
 * Testnet-only faucet for mock USDT0. Sends a classic payment from the mock
 * issuer, so the recipient needs a USDT0 trustline first.
 */
import { Asset, BASE_FEE, Horizon, Keypair, Operation, StrKey, TransactionBuilder } from "@stellar/stellar-sdk";
import { config } from "./config";
import { db, must } from "./db";

const { horizonUrl, networkPassphrase, assets } = config.deployment;
const horizon = new Horizon.Server(horizonUrl);
const usdt0 = new Asset(assets.usdt0.code, assets.usdt0.issuer);
const COOLDOWN_MS = 60 * 60_000;
/** Concurrent drips share the issuer's sequence number; a loser simply retries. */
const SEND_ATTEMPTS = 4;

export class FaucetError extends Error {
  constructor(
    message: string,
    readonly code: "disabled" | "invalid_address" | "no_account" | "no_trustline" | "cooldown",
  ) {
    super(message);
  }
}

/**
 * Claims the cooldown slot for `key` atomically: succeeds only if the last
 * drip is older than the cooldown, so two parallel requests can't both pass.
 */
async function claim(key: string, now: Date): Promise<string | null> {
  const cutoff = new Date(now.getTime() - COOLDOWN_MS).toISOString();
  await db()
    .from("faucet_drips")
    .upsert({ key, last_at: new Date(0).toISOString() }, { ignoreDuplicates: true });
  const before = must(await db().from("faucet_drips").select("last_at").eq("key", key).single()) as { last_at: string };
  const taken = must(
    await db().from("faucet_drips").update({ last_at: now.toISOString() }).eq("key", key).lt("last_at", cutoff).select("key"),
  );
  if ((taken ?? []).length > 0) return null;
  const minutes = Math.ceil((new Date(before.last_at).getTime() + COOLDOWN_MS - now.getTime()) / 60_000);
  return `Try again in ${Math.max(1, minutes)} min`;
}

const release = (keys: string[]) =>
  db().from("faucet_drips").update({ last_at: new Date(0).toISOString() }).in("key", keys);

const isBadSeq = (err: unknown) =>
  JSON.stringify((err as { response?: { data?: unknown } })?.response?.data ?? "").includes("tx_bad_seq");

async function send(address: string) {
  const issuer = Keypair.fromSecret(config.FAUCET_ISSUER_SECRET!);
  for (let attempt = 1; ; attempt++) {
    const source = await horizon.loadAccount(issuer.publicKey());
    const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase })
      .addOperation(Operation.payment({ destination: address, asset: usdt0, amount: String(config.FAUCET_AMOUNT) }))
      .setTimeout(60)
      .build();
    tx.sign(issuer);
    try {
      return await horizon.submitTransaction(tx);
    } catch (err) {
      if (!isBadSeq(err) || attempt >= SEND_ATTEMPTS) throw err;
      await new Promise((r) => setTimeout(r, 300 * attempt + Math.random() * 500));
    }
  }
}

export async function drip(address: string, ip: string) {
  if (!config.FAUCET_ISSUER_SECRET || !assets.usdt0.mock) {
    throw new FaucetError("Faucet is disabled", "disabled");
  }
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new FaucetError("Not a Stellar account address", "invalid_address");
  }

  const recipient = await horizon.loadAccount(address).catch(() => {
    throw new FaucetError("Account not found on testnet. Fund it with Friendbot first.", "no_account");
  });
  const hasTrustline = recipient.balances.some(
    (b) => "asset_code" in b && b.asset_code === usdt0.code && b.asset_issuer === usdt0.issuer,
  );
  if (!hasTrustline) {
    throw new FaucetError("Add the USDT0 trustline first", "no_trustline");
  }

  const now = new Date();
  const keys = [`addr:${address}`, `ip:${ip}`];
  const claimed: string[] = [];
  for (const key of keys) {
    const wait = await claim(key, now);
    if (wait) {
      await release(claimed);
      throw new FaucetError(wait, "cooldown");
    }
    claimed.push(key);
  }

  try {
    const res = await send(address);
    return { hash: res.hash, amount: config.FAUCET_AMOUNT };
  } catch (err) {
    await release(claimed);
    throw err;
  }
}
