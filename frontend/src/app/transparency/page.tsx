import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Card } from "@/components/ui/Card";
import { config, explorer } from "@/lib/config";

export const metadata: Metadata = {
  title: "Transparency · Nema",
  description: "Contracts, admin powers and safety parameters of the Nema vault.",
};

const contracts = [
  { name: "Nema Vault", id: config.contracts.vault, note: "Holds deposits, mints and burns nUSDT0" },
  { name: "XOXNO Strategy", id: config.contracts.strategyXoxno, note: "Supplies USDT0 to the lending controller" },
  { name: "nUSDT0 (SAC)", id: config.assets.nusdt0.contract, note: "Admin is the vault; issuer key disabled" },
  { name: "USDT0 (SAC)", id: config.assets.usdt0.contract, note: "Mock on testnet" },
  { name: "Lending market", id: config.contracts.lending, note: "XOXNO-compatible mock on testnet" },
  { name: "Price oracle", id: config.contracts.oracle, note: "SEP-40 mock on testnet" },
];

const adminCan = [
  "Pause new deposits",
  "Set allocation targets, up to each strategy's cap",
  "Lower a strategy's cap (never raise it)",
  "Propose a new strategy, live only after the timelock",
  "Configure the peg guard",
  "Change the fee, never above 20% of profit",
];

const adminCannot = [
  "Move user funds to any address",
  "Block or delay withdrawals",
  "Mint nUSDT0 outside of deposits",
  "Add a strategy without waiting out the timelock",
  "Upgrade the vault code (it is immutable)",
];

const safeguards = [
  ["First-depositor attack", "Virtual share offset plus 1,000 shares locked forever on the first deposit"],
  ["Rounding", "Every conversion rounds in the vault's favor; users are never overpaid"],
  ["Fair fees", "Fees accrue before every deposit and withdrawal, only on profit above the high-water mark"],
  ["Resource limits", "Rebalancing moves one strategy per transaction"],
  ["State archival", "Every call extends contract TTL; the keeper bumps it daily"],
  ["Slippage", "Deposits and withdrawals carry user-set minimums (0.5% in this UI)"],
];

export default function TransparencyPage() {
  return (
    <>
      <PageHeader kicker="Everything on-chain, everything verifiable" title="Transparency">
        <p className="label max-w-2xl text-[20px] leading-snug text-ink sm:text-[24px]">
          What each contract is, who can do what, and how the vault defends your deposit.
        </p>
      </PageHeader>
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8">
        <Card className="!bg-clown p-6">
          <div className="flex items-center gap-2">
            <Badge tone="neutral">Testnet demo</Badge>
          </div>
          <p className="mt-3 text-[16px] leading-relaxed text-ink">
            USDT0 exists only on mainnet, so this demo uses a mock USDT0 asset. XOXNO&apos;s testnet deployment is stood
            in for by a mock market implementing the same controller interface, so the production strategy adapter runs
            unchanged. Rates mirror XOXNO&apos;s live mainnet USDT0 rate.
          </p>
        </Card>

        <section className="mt-12">
          <h2 className="font-display text-[30px] uppercase">Contracts</h2>
          <Card className="mt-4 divide-y divide-line">
            {contracts.map((c) => (
              <a
                key={c.id}
                href={explorer.contract(c.id)}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col gap-1 border-ink/15 p-5 transition hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="sm:w-48">
                  <div className="text-[15px] font-semibold">{c.name}</div>
                  <div className="text-[12px] text-muted">{c.note}</div>
                </div>
                <code className="min-w-0 break-all font-mono text-[12px] font-semibold text-ocean-deep sm:flex-1">
                  {c.id}
                </code>
              </a>
            ))}
          </Card>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          <Card className="p-6">
            <h2 className="font-display text-[22px] uppercase">The admin can</h2>
            <ul className="mt-4 space-y-2.5 text-[15px]">
              {adminCan.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="text-ocean">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <h2 className="font-display text-[22px] uppercase">The admin cannot</h2>
            <ul className="mt-4 space-y-2.5 text-[15px]">
              {adminCannot.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="font-bold text-red-500">×</span>
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-[30px] uppercase">Parameters</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Performance fee", `${config.vault.feeBps / 100}% of profit`],
              ["Idle buffer", `${config.vault.bufferBps / 100}%`],
              ["XOXNO target", `${config.vault.targetBps / 100}%`],
              ["Peg band", "±1% · 24h max age"],
            ].map(([label, value]) => (
              <Card key={label} className="p-5">
                <div className="text-[13px] text-muted">{label}</div>
                <div className="mt-1 text-[17px] font-semibold">{value}</div>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-[30px] uppercase">Safeguards in the contract</h2>
          <Card className="mt-4 divide-y divide-line">
            {safeguards.map(([title, body]) => (
              <div key={title} className="grid gap-1 p-5 sm:grid-cols-[200px_1fr] sm:gap-4">
                <div className="text-[15px] font-semibold">{title}</div>
                <div className="text-[15px] text-muted">{body}</div>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </>
  );
}
