/**
 * Testnet end-to-end check of the user journey, following the same steps
 * as the web app: Friendbot -> trustlines -> faucet -> deposit -> withdraw.
 * Runs against the local dev server by default:  npm run e2e
 * or a deployment:                                API_URL=https://… npm run e2e
 */
import {
  Account,
  Asset,
  BASE_FEE,
  Contract,
  Horizon,
  Keypair,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import deployment from "../src/config/deployment.json" with { type: "json" };

const { networkPassphrase, horizonUrl, rpcUrl, assets, contracts } = deployment;
const horizon = new Horizon.Server(horizonUrl);
const soroban = new rpc.Server(rpcUrl);
const api = (process.env.API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const user = Keypair.random();
const i128 = (v: bigint) => nativeToScVal(v, { type: "i128" });

const step = (msg: string) => console.log(`\n▸ ${msg}`);

async function read<T>(contractId: string, method: string, args: ReturnType<typeof i128>[]): Promise<T> {
  const tx = new TransactionBuilder(new Account(deployment.admin, "0"), { fee: BASE_FEE, networkPassphrase })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await soroban.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !sim.result) throw new Error(`${method} simulation failed`);
  return scValToNative(sim.result.retval) as T;
}

async function callVault(method: string, args: ReturnType<typeof i128>[]) {
  const account = await soroban.getAccount(user.publicKey());
  const built = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
    .addOperation(new Contract(contracts.vault).call(method, ...args))
    .setTimeout(60)
    .build();
  const tx = await soroban.prepareTransaction(built);
  tx.sign(user);
  const sent = await soroban.sendTransaction(tx);
  const final = await soroban.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) throw new Error(`${method}: ${final.status}`);
  return scValToNative(final.returnValue!) as bigint;
}

step(`New user ${user.publicKey()}`);
await fetch(`https://friendbot.stellar.org/?addr=${user.publicKey()}`).then((r) => {
  if (!r.ok) throw new Error("friendbot failed");
});

step("Adding USDT0 + nUSDT0 trustlines in one transaction");
const account = await horizon.loadAccount(user.publicKey());
const trust = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
  .addOperation(Operation.changeTrust({ asset: new Asset(assets.usdt0.code, assets.usdt0.issuer) }))
  .addOperation(Operation.changeTrust({ asset: new Asset(assets.nusdt0.code, assets.nusdt0.issuer) }))
  .setTimeout(60)
  .build();
trust.sign(user);
await horizon.submitTransaction(trust);

step("Faucet");
const drip = await fetch(`${api}/api/faucet`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ address: user.publicKey() }),
});
console.log(drip.status, await drip.json());
if (!drip.ok) throw new Error("faucet failed");

const amount = 250n * 10_000_000n;
step("Deposit 250 USDT0");
const expected = await read<bigint>(contracts.vault, "preview_deposit", [i128(amount)]);
const shares = await callVault("deposit", [nativeToScVal(user.publicKey(), { type: "address" }), i128(amount), i128((expected * 995n) / 1000n)]);
console.log(`minted ${shares} nUSDT0 stroops (preview ${expected})`);

step("Withdraw all shares");
const out = await callVault("withdraw", [nativeToScVal(user.publicKey(), { type: "address" }), i128(shares), i128(0n)]);
console.log(`received ${out} USDT0 stroops for ${shares} shares`);

if (out <= 0n || out > amount + amount / 100n) throw new Error("unexpected payout");
console.log("\n✅ end-to-end flow passed");
