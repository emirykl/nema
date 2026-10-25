/**
 * Keeper risk watch. Two checks, both from public chain data:
 *  - a strategy that no longer answers gets reported to the vault
 *    (`report_unavailable`, permissionless on v2 vaults), which reopens
 *    withdrawals out of the vault's cash within one keeper round;
 *  - the share price must never fall; if it does, a strategy lost money.
 * Alerts go to the log and, if configured, a webhook (at most every 6 hours
 * per alert).
 */
import { type Keypair, nativeToScVal } from "@stellar/stellar-sdk";
import { config } from "./config";
import { kv } from "./db";
import { logger } from "./log";
import { invoke, read } from "./soroban";

const log = logger("risk");
const { contracts } = config.deployment;
const ALERT_EVERY_MS = 6 * 60 * 60_000;

async function alert(key: string, message: string) {
  log.error(message);
  const last = await kv.get<{ at: number }>(`alert:${key}`);
  if (last && Date.now() - last.at < ALERT_EVERY_MS) return;
  await kv.set(`alert:${key}`, { at: Date.now() });
  if (!config.RISK_WEBHOOK_URL) return;
  await fetch(config.RISK_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // `content` for Discord, `text` for Slack.
    body: JSON.stringify({ content: `🦑 Nema: ${message}`, text: `🦑 Nema: ${message}` }),
    signal: AbortSignal.timeout(10_000),
  }).catch((err) => log.warn("webhook failed", String(err)));
}

export async function watchRisk(signer: Keypair) {
  const strategies = await read<{ address: string }[]>(contracts.vault, "strategies");
  const impaired = await read<string[]>(contracts.vault, "impaired_strategies").catch(() => null);

  for (const { address } of strategies) {
    if (impaired?.includes(address)) continue;
    const answers = await read<bigint>(address, "balance").then(
      () => true,
      () => false,
    );
    if (answers) continue;
    if (impaired === null) {
      // v1 vault: no on-chain remedy; a human has to act.
      await alert(`unavailable:${address}`, `strategy ${address} is not answering; the vault can't price shares`);
      continue;
    }
    try {
      await invoke(signer, contracts.vault, "report_unavailable", [nativeToScVal(address, { type: "address" })]);
      await alert(
        `unavailable:${address}`,
        `strategy ${address} stopped answering; reported, withdrawals reopened from cash`,
      );
    } catch (err) {
      await alert(
        `report-failed:${address}`,
        `strategy ${address} is not answering and reporting it failed: ${String(err)}`,
      );
    }
  }

  // The share price only ever rises; a drop means a strategy lost money.
  const price = await read<bigint>(contracts.vault, "share_price");
  const peak = await kv.get<{ price: string }>("risk:peak-price");
  if (peak && price < BigInt(peak.price)) {
    await alert("price-drop", `share price fell from ${peak.price} to ${price} (stroops); check the strategies`);
  } else {
    await kv.set("risk:peak-price", { price: price.toString() });
  }
}
