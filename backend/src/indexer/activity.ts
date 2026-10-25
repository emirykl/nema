/** Follows vault contract events (deposits, withdrawals, rebalances, harvests). */
import { rpc, scValToNative } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { logger } from "../lib/log.js";
import { server } from "../lib/soroban.js";
import { jsonStore } from "./store.js";

export interface VaultEvent {
  id: string;
  kind: "deposit" | "withdraw" | "rebalance" | "harvest";
  account?: string;
  data: Record<string, string>;
  txHash: string;
  at: string;
}

const KINDS = new Set<VaultEvent["kind"]>(["deposit", "withdraw", "rebalance", "harvest"]);
const MAX_EVENTS = 500;
const LOOKBACK_LEDGERS = 100_000; // ~5.8 days
const POLL_MS = 15_000;
const PAGE_SIZE = 200;
const MAX_PAGES_PER_POLL = 30;

const log = logger("activity");
const store = jsonStore<{ cursor?: string; events: VaultEvent[] }>("activity", { events: [] });
let state = store.load();

function stringify(value: unknown): Record<string, string> {
  if (value === null || typeof value !== "object") return { value: String(value) };
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)]));
}

/** Ledger sequence encoded in the high 32 bits of an event cursor. */
const cursorLedger = (cursor: string) => Number(BigInt(cursor.split("-")[0] ?? "0") >> 32n);

async function poll() {
  // RPC scans a bounded ledger range per request; page until caught up.
  for (let page = 0; page < MAX_PAGES_PER_POLL; page++) {
    const res = await fetchPage();
    record(res.events);
    state.cursor = res.cursor;
    if (res.events.length < PAGE_SIZE && cursorLedger(res.cursor) >= res.latestLedger) break;
  }
  state.events = state.events.slice(-MAX_EVENTS);
  store.save(state);
}

async function fetchPage() {
  const filters = [{ type: "contract" as const, contractIds: [config.deployment.contracts.vault] }];
  if (state.cursor) return server.getEvents({ filters, cursor: state.cursor, limit: PAGE_SIZE });

  const [latest, health] = await Promise.all([server.getLatestLedger(), server.getHealth()]);
  const startLedger = Math.max(health.oldestLedger ?? 0, latest.sequence - LOOKBACK_LEDGERS);
  return server.getEvents({ filters, startLedger, limit: PAGE_SIZE });
}

function record(events: rpc.Api.EventResponse[]) {
  for (const ev of events) {
    const [head, second] = ev.topic.map((t) => scValToNative(t));
    if (!KINDS.has(head)) continue;
    state.events.push({
      id: ev.id,
      kind: head,
      account: typeof second === "string" ? second : undefined,
      data: stringify(scValToNative(ev.value)),
      txHash: ev.txHash,
      at: ev.ledgerClosedAt,
    });
  }
}

export function recentActivity(limit = 20, kinds?: VaultEvent["kind"][]): VaultEvent[] {
  const list = kinds ? state.events.filter((e) => kinds.includes(e.kind)) : state.events;
  return list.slice(-limit).reverse();
}

export function startActivity() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await poll();
    } catch (err) {
      log.warn("poll failed", String(err));
      // A stale cursor (e.g. outside RPC retention) is dropped and rebuilt.
      if (String(err).includes("cursor")) state.cursor = undefined;
    } finally {
      running = false;
    }
  };
  tick();
  return setInterval(tick, POLL_MS);
}
