/**
 * Transaction building for the vault. Every transaction is built here and
 * signed in the user's wallet; nothing touches a private key.
 */
import {
  Account,
  Asset,
  BASE_FEE,
  Contract,
  Horizon,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  type xdr,
} from "@stellar/stellar-sdk";
import { config, SLIPPAGE_BPS } from "./config";

const { networkPassphrase } = config;
const horizon = new Horizon.Server(config.horizonUrl);
const soroban = new rpc.Server(config.rpcUrl);

export const usdt0 = new Asset(config.assets.usdt0.code, config.assets.usdt0.issuer);
export const nusdt0 = new Asset(config.assets.nusdt0.code, config.assets.nusdt0.issuer);

export interface AccountStatus {
  exists: boolean;
  hasUsdt0Trustline: boolean;
  hasNusdt0Trustline: boolean;
  usdt0: bigint;
  nusdt0: bigint;
}

const toStroops = (balance: string) => {
  const [whole = "0", fraction = ""] = balance.split(".");
  return BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, "0").slice(0, 7));
};

export async function accountStatus(address: string): Promise<AccountStatus> {
  const account = await horizon.loadAccount(address).catch(() => null);
  if (!account) {
    return { exists: false, hasUsdt0Trustline: false, hasNusdt0Trustline: false, usdt0: 0n, nusdt0: 0n };
  }
  const line = (asset: Asset) =>
    account.balances.find(
      (b) => "asset_code" in b && b.asset_code === asset.code && b.asset_issuer === asset.issuer,
    );
  const usdt0Line = line(usdt0);
  const nusdt0Line = line(nusdt0);
  return {
    exists: true,
    hasUsdt0Trustline: !!usdt0Line,
    hasNusdt0Trustline: !!nusdt0Line,
    usdt0: usdt0Line ? toStroops(usdt0Line.balance) : 0n,
    nusdt0: nusdt0Line ? toStroops(nusdt0Line.balance) : 0n,
  };
}

export async function fundWithFriendbot(address: string) {
  const res = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error("Friendbot could not fund this account");
}

/**
 * One classic transaction adding the missing trustlines. Soroban calls must
 * be alone in their transaction, so this runs once, before the first deposit.
 */
export async function buildTrustlines(address: string, status: AccountStatus): Promise<string> {
  const account = await horizon.loadAccount(address);
  const builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase }).setTimeout(120);
  if (!status.hasUsdt0Trustline) builder.addOperation(Operation.changeTrust({ asset: usdt0 }));
  if (!status.hasNusdt0Trustline) builder.addOperation(Operation.changeTrust({ asset: nusdt0 }));
  return builder.build().toXDR();
}

export async function submitClassic(signedXdr: string) {
  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  return horizon.submitTransaction(tx);
}

// --- Vault calls ----------------------------------------------------------

const vault = new Contract(config.contracts.vault);
const i128 = (v: bigint) => nativeToScVal(v, { type: "i128" });
const address = (a: string) => nativeToScVal(a, { type: "address" });

async function simulate<T>(op: xdr.Operation): Promise<T> {
  const source = new Account(config.admin, "0");
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase }).addOperation(op).setTimeout(30).build();
  const sim = await soroban.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !sim.result) throw new Error(readableError(sim));
  return scValToNative(sim.result.retval) as T;
}

export const previewDeposit = (assets: bigint) => simulate<bigint>(vault.call("preview_deposit", i128(assets)));
export const previewWithdraw = (shares: bigint) => simulate<bigint>(vault.call("preview_withdraw", i128(shares)));

const withSlippage = (amount: bigint) => (amount * (10_000n - SLIPPAGE_BPS)) / 10_000n;

async function prepare(source: string, op: xdr.Operation): Promise<string> {
  const account = await soroban.getAccount(source);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase }).addOperation(op).setTimeout(120).build();
  try {
    return (await soroban.prepareTransaction(tx)).toXDR();
  } catch (err) {
    throw new Error(readableError(err));
  }
}

export async function buildDeposit(from: string, assets: bigint) {
  const minShares = withSlippage(await previewDeposit(assets));
  return prepare(from, vault.call("deposit", address(from), i128(assets), i128(minShares)));
}

export async function buildWithdraw(from: string, shares: bigint) {
  const minAssets = withSlippage(await previewWithdraw(shares));
  return prepare(from, vault.call("withdraw", address(from), i128(shares), i128(minAssets)));
}

/** Sends a signed Soroban transaction and waits until it lands. Returns the hash. */
export async function submitSoroban(signedXdr: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  const sent = await soroban.sendTransaction(tx);
  if (sent.status === "ERROR") throw new Error("The network rejected the transaction");
  const final = await soroban.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction ${final.status.toLowerCase()}`);
  }
  return sent.hash;
}

// --- Errors ---------------------------------------------------------------

/** Vault error codes (contracts/vault/src/errors.rs) in plain words. */
const VAULT_ERRORS: Record<number, string> = {
  2: "Enter an amount greater than zero.",
  4: "Deposits are paused. Withdrawals stay open.",
  5: "Deposits are on hold: the USDT0 price guard is tripped.",
  6: "Price moved beyond your slippage limit. Try again.",
  7: "Amount too small to mint a share.",
  8: "The first deposit must be larger.",
  9: "You don't have that many nUSDT0.",
  10: "Not enough liquidity right now. Try a smaller amount.",
};

export function readableError(err: unknown): string {
  const text = typeof err === "string" ? err : err instanceof Error ? err.message : JSON.stringify(err);
  const code = text.match(/Error\(Contract, #(\d+)\)/)?.[1];
  if (code && VAULT_ERRORS[Number(code)]) return VAULT_ERRORS[Number(code)]!;
  if (/trustline|TrustLine/i.test(text)) return "A trustline is missing. Complete the setup step first.";
  if (/balance|underfunded/i.test(text)) return "Insufficient balance.";
  if (/reject|declin|denied|cancel/i.test(text)) return "Request cancelled in your wallet.";
  return "Something went wrong. Please try again.";
}
