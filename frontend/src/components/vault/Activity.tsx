"use client";

import { Card } from "@/components/ui/Card";
import { type VaultEvent, useApi } from "@/lib/api";
import { explorer } from "@/lib/config";
import { formatAmount, shortAddress, timeAgo } from "@/lib/format";

/** Vault-wide recent activity, or one wallet's full history when `account` is set. */
export function Activity({ refreshKey, account }: { refreshKey: number; account?: string }) {
  const path = account
    ? `/api/positions/${account}/history?limit=50&k=${refreshKey}`
    : `/api/vault/activity?limit=8&k=${refreshKey}`;
  const { data } = useApi<VaultEvent[]>(path, 60_000);

  return (
    <Card className="p-6">
      <h3 className="font-display text-[22px] uppercase leading-tight">{account ? "Your history" : "Recent activity"}</h3>
      {data && data.length > 0 ? (
        <ul className="mt-3 divide-y divide-line">
          {data.map((e) => (
            <li key={e.id}>
              <a
                href={explorer.tx(e.txHash)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 py-3 hover:opacity-80"
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-[15px] font-bold ${
                    e.kind === "deposit" ? "bg-emerald-500/12 text-emerald-600" : "bg-ocean/10 text-ocean"
                  }`}
                >
                  {e.kind === "deposit" ? "↓" : "↑"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium capitalize">{e.kind}</div>
                  <div className="tabular text-[12px] text-muted">
                    {account ? `${formatAmount(e.data.shares ?? "0", 2)} nUSDT0` : e.account ? shortAddress(e.account) : ""}
                  </div>
                </div>
                <div className="tabular text-right">
                  <div className="text-[14px] font-semibold">{formatAmount(e.data.assets ?? "0", 2)} USDT0</div>
                  <div className="text-[12px] text-muted">{timeAgo(e.at)}</div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[14px] text-muted">
          {!data ? "Loading…" : account ? "No deposits from this wallet yet." : "No activity yet. Be the first fish in the pond."}
        </p>
      )}
    </Card>
  );
}
