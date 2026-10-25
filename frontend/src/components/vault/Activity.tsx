"use client";

import { Card } from "@/components/ui/Card";
import { type VaultEvent, useApi } from "@/lib/api";
import { explorer } from "@/lib/config";
import { formatAmount, shortAddress, timeAgo } from "@/lib/format";

export function Activity({ refreshKey }: { refreshKey: number }) {
  const { data } = useApi<VaultEvent[]>(`/api/vault/activity?limit=8&k=${refreshKey}`, 20_000);

  return (
    <Card className="p-6">
      <h3 className="font-display text-[22px] uppercase leading-tight">Recent activity</h3>
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
                  <div className="tabular text-[12px] text-muted">{e.account ? shortAddress(e.account) : ""}</div>
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
          {data ? "No activity yet. Be the first fish in the pond." : "Loading…"}
        </p>
      )}
    </Card>
  );
}
