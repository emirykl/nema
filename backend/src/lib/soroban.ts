import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
  scValToNative,
  type xdr,
} from "@stellar/stellar-sdk";
import { config } from "../config.js";

const { rpcUrl, networkPassphrase } = config.deployment;

export const server = new rpc.Server(rpcUrl);

// Simulation does not check the source account; any valid address works.
const READ_SOURCE = new Account(config.deployment.admin, "0");

/** Read-only contract call through simulation. Returns the native JS value. */
export async function read<T = unknown>(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<T> {
  const tx = new TransactionBuilder(READ_SOURCE, { fee: BASE_FEE, networkPassphrase })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`${method} failed: ${sim.error}`);
  }
  if (!sim.result) {
    throw new Error(`${method} returned no result`);
  }
  return scValToNative(sim.result.retval) as T;
}

/** Signs and submits a contract call, waiting for the final status. */
export async function invoke(signer: Keypair, contractId: string, method: string, args: xdr.ScVal[] = []) {
  const account = await server.getAccount(signer.publicKey());
  const built = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(60)
    .build();
  const tx = await server.prepareTransaction(built);
  tx.sign(signer);

  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new Error(`${method} rejected: ${sent.errorResult?.toXDR("base64") ?? "unknown"}`);
  }
  const final = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`${method} ${final.status} (${sent.hash})`);
  }
  return {
    hash: sent.hash,
    result: final.returnValue ? scValToNative(final.returnValue) : undefined,
  };
}

/** JSON-safe copy: bigints become strings. */
export function serialize<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
}
