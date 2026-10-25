/**
 * Testnet-only faucet for mock USDT0. Sends a classic payment from the mock
 * issuer, so the recipient needs a USDT0 trustline first.
 */
import { Asset, BASE_FEE, Horizon, Keypair, Operation, StrKey, TransactionBuilder } from "@stellar/stellar-sdk";
import { config } from "../config.js";

const { horizonUrl, networkPassphrase, assets } = config.deployment;
const horizon = new Horizon.Server(horizonUrl);
const usdt0 = new Asset(assets.usdt0.code, assets.usdt0.issuer);
const COOLDOWN_MS = 60 * 60_000;

export class FaucetError extends Error {
  constructor(
    message: string,
    readonly code: "disabled" | "invalid_address" | "no_account" | "no_trustline" | "cooldown",
  ) {
    super(message);
  }
}

const lastDrip = new Map<string, number>();

export async function drip(address: string, ip: string) {
  if (!config.FAUCET_ISSUER_SECRET || !assets.usdt0.mock) {
    throw new FaucetError("Faucet is disabled", "disabled");
  }
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new FaucetError("Not a Stellar account address", "invalid_address");
  }

  const now = Date.now();
  for (const key of [address, ip]) {
    const last = lastDrip.get(key);
    if (last && now - last < COOLDOWN_MS) {
      const minutes = Math.ceil((COOLDOWN_MS - (now - last)) / 60_000);
      throw new FaucetError(`Try again in ${minutes} min`, "cooldown");
    }
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

  const issuer = Keypair.fromSecret(config.FAUCET_ISSUER_SECRET);
  const source = await horizon.loadAccount(issuer.publicKey());
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase })
    .addOperation(Operation.payment({ destination: address, asset: usdt0, amount: String(config.FAUCET_AMOUNT) }))
    .setTimeout(60)
    .build();
  tx.sign(issuer);
  const res = await horizon.submitTransaction(tx);

  lastDrip.set(address, now);
  lastDrip.set(ip, now);
  return { hash: res.hash, amount: config.FAUCET_AMOUNT };
}
