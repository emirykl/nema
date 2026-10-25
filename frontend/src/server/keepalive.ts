/**
 * Keeps every Nema contract (instance + code) topped up to the TTL the
 * contracts themselves aim for. The contracts extend themselves on use, but
 * only when they have fallen a day behind, and then the caller pays rent for
 * the whole gap. At current testnet rent prices a few days of rent on a
 * contract's code costs more than one transaction may pay, so we never let
 * that gap open: small, frequent extensions from the keeper instead.
 */
import {
  BASE_FEE,
  Contract,
  type Keypair,
  Operation,
  SorobanDataBuilder,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { config } from "./config";
import { logger } from "./log";
import { server } from "./soroban";

const log = logger("keepalive");
const { networkPassphrase, contracts, assets } = config.deployment;

/** The contracts' own BUMP: 60 days of ledgers. */
const TARGET = 60 * 17_280;
/** Gaps smaller than ~10 minutes aren't worth a transaction. */
const SLACK = 120;
/** Spend at most this much rent per transaction (the network caps a transaction near 429 XLM). */
const MAX_FEE_STROOPS = 1_500_000_000;
/** Never split an extension into pieces shorter than ~1 hour. */
const MIN_STEP = 720;

const CONTRACTS = [
  contracts.vault,
  contracts.strategyXoxno,
  contracts.lending,
  contracts.oracle,
  assets.usdt0.contract,
  assets.nusdt0.contract,
];

/** Ledger key of a contract's code, from its wasm hash (LedgerEntryType 7 + hash). */
const codeKey = (hash: Uint8Array) =>
  xdr.LedgerKey.fromXDR(Buffer.concat([Buffer.from([0, 0, 0, 7]), Buffer.from(hash)]).toString("base64"), "base64");

async function keysFor(id: string) {
  const contract = new Contract(id);
  const instance = await server.getContractInstance(id);
  const exe = instance.executable as { wasmHash?: { value: Uint8Array } };
  // Asset contracts (SAC) are built in and have no code entry.
  return exe.wasmHash ? [contract.getFootprint(), codeKey(exe.wasmHash.value)] : [contract.getFootprint()];
}

/** Ledgers left before the first of `keys` expires. */
async function ledgersLeft(keys: xdr.LedgerKey[]) {
  const res = await server.getLedgerEntries(...keys);
  return Math.min(...res.entries.map((e) => (e.liveUntilLedgerSeq ?? 0) - res.latestLedger));
}

/**
 * Extends `keys` towards TARGET in one transaction, halving the step until
 * the rent fits MAX_FEE. Cheap entries go all the way at once.
 */
async function extend(signer: Keypair, keys: xdr.LedgerKey[], left: number) {
  let step = TARGET - left;
  let extendTo: number;
  let tx;
  for (;;) {
    extendTo = Math.min(TARGET, left + step);
    const account = await server.getAccount(signer.publicKey());
    const built = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
      .addOperation(Operation.extendFootprintTtl({ extendTo }))
      .setSorobanData(new SorobanDataBuilder().setReadOnly(keys).build())
      .setTimeout(60)
      .build();
    tx = await server.prepareTransaction(built);
    if (Number(tx.fee) <= MAX_FEE_STROOPS || step <= MIN_STEP) break;
    step = Math.ceil(step / 2);
  }
  tx.sign(signer);
  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") throw new Error("extend rejected");
  const final = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) throw new Error(`extend ${final.status}`);
  return { extendTo, fee: Number(tx.fee) };
}

/**
 * Brings each contract to TARGET, in as few transactions as the fee cap allows, sending at most
 * `maxTx` transactions (a serverless run has limited time; the next tick continues).
 */
export async function keepAlive(signer: Keypair, maxTx = 6) {
  let sent = 0;
  for (const id of CONTRACTS) {
    const keys = await keysFor(id);
    while (sent < maxTx) {
      const left = await ledgersLeft(keys);
      if (left >= TARGET - SLACK) break;
      const { extendTo, fee } = await extend(signer, keys, left);
      sent++;
      log.info(`${id.slice(0, 6)} +${((extendTo - left) / 720).toFixed(1)}h → ${(extendTo / 17_280).toFixed(2)}d (${(fee / 1e7).toFixed(2)} XLM)`);
    }
  }
  return sent;
}
