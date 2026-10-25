/** Indexes vault contract events (deposits, withdrawals, rebalances, harvests) into Supabase. */
import { type rpc, scValToNative } from "@stellar/stellar-sdk";
import { db, kv, must, VAULT } from "./db";
import { server } from "./soroban";

export interface VaultEvent {
  id: string;
  kind: "deposit" | "withdraw" | "rebalance" | "harvest";
  account?: string;
  data: Record<string, string>;
  txHash: string;
  at: string;
}

interface Row {
  id: string;
  kind: VaultEvent["kind"];
  account: string | null;
  data: Record<string, string>;
  tx_hash: string;
  at: string;
}

const KINDS = new Set<VaultEvent["kind"]>(["deposit", "withdraw", "rebalance", "harvest"]);
const LOOKBACK_LEDGERS = 100_000; // ~5.8 days, about what testnet RPC retains
const PAGE_SIZE = 200;
const MAX_PAGES = 30;

function stringify(value: unknown): Record<string, string> {
  if (value === null || typeof value !== "object") return { value: String(value) };
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)]));
}

/** Ledger sequence encoded in the high 32 bits of an event cursor. */
const cursorLedger = (cursor: string) => Number(BigInt(cursor.split("-")[0] ?? "0") >> 32n);

async function fetchPage(cursor: string | undefined) {
  const filters = [{ type: "contract" as const, contractIds: [VAULT] }];
  if (cursor) return server.getEvents({ filters, cursor, limit: PAGE_SIZE });

  const [latest, health] = await Promise.all([server.getLatestLedger(), server.getHealth()]);
  const startLedger = Math.max(health.oldestLedger ?? 0, latest.sequence - LOOKBACK_LEDGERS);
  return server.getEvents({ filters, startLedger, limit: PAGE_SIZE });
}

function toRows(events: rpc.Api.EventResponse[]) {
  return events.flatMap((ev) => {
    const [head, second] = ev.topic.map((t) => scValToNative(t));
    if (!KINDS.has(head)) return [];
    return [
      {
        id: ev.id,
        vault: VAULT,
        kind: head,
        account: typeof second === "string" ? second : null,
        data: stringify(scValToNative(ev.value)),
        tx_hash: ev.txHash,
        at: ev.ledgerClosedAt,
      },
    ];
  });
}

/** Pulls new events since the stored cursor. Idempotent: rows upsert by event id. */
export async function indexEvents() {
  let cursor = (await kv.get<{ cursor?: string }>("activity"))?.cursor;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetchPage(cursor);
      const rows = toRows(res.events);
      if (rows.length) must(await db().from("vault_events").upsert(rows, { ignoreDuplicates: true }));
      cursor = res.cursor;
      if (res.events.length < PAGE_SIZE && cursorLedger(res.cursor) >= res.latestLedger) break;
    }
  } catch (err) {
    // An expired cursor falls back to the lookback window on the next run.
    if (String(err).includes("cursor")) cursor = undefined;
    else throw err;
  } finally {
    await kv.set("activity", { cursor });
  }
}

const FRESH_MS = 15_000;
let lastIndexed = 0;
let indexing: Promise<void> | undefined;

/**
 * Catches up on new events before a read, at most every 15s per instance,
 * so a user's deposit shows up right away instead of at the next cron round.
 */
export async function indexIfStale() {
  if (Date.now() - lastIndexed < FRESH_MS) return indexing;
  lastIndexed = Date.now();
  indexing = indexEvents().finally(() => (indexing = undefined));
  return indexing;
}

const toEvent = (r: Row): VaultEvent => ({
  id: r.id,
  kind: r.kind,
  account: r.account ?? undefined,
  data: r.data,
  txHash: r.tx_hash,
  at: r.at,
});

export async function recentActivity(limit: number, kinds: VaultEvent["kind"][], account?: string) {
  let query = db()
    .from("vault_events")
    .select("id, kind, account, data, tx_hash, at")
    .eq("vault", VAULT)
    .in("kind", kinds)
    .order("at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (account) query = query.eq("account", account);
  return (must(await query) as Row[]).map(toEvent);
}

export interface PositionSummary {
  /** All-time USDT0 deposited / withdrawn, in stroops. */
  deposited: string;
  withdrawn: string;
  /** All-time nUSDT0 received / returned, in stroops. */
  sharesIn: string;
  sharesOut: string;
  firstAt: string | null;
  /** Every deposit and withdrawal, oldest first (for the earnings chart). */
  events: VaultEvent[];
}

/** A wallet's lifetime totals with the vault, from its indexed events. */
export async function positionSummary(account: string): Promise<PositionSummary> {
  const rows = must(
    await db()
      .from("vault_events")
      .select("id, kind, account, data, tx_hash, at")
      .eq("vault", VAULT)
      .eq("account", account)
      .in("kind", ["deposit", "withdraw"])
      .order("at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1000),
  ) as Row[];
  const events = rows.map(toEvent);
  const sum = (kind: VaultEvent["kind"], field: "assets" | "shares") =>
    events.filter((e) => e.kind === kind).reduce((total, e) => total + BigInt(e.data[field] ?? "0"), 0n).toString();
  return {
    deposited: sum("deposit", "assets"),
    withdrawn: sum("withdraw", "assets"),
    sharesIn: sum("deposit", "shares"),
    sharesOut: sum("withdraw", "shares"),
    firstAt: events[0]?.at ?? null,
    events,
  };
}
