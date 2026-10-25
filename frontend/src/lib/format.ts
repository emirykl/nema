import { DECIMALS } from "./config";

/** "12.5" -> 125000000n. Returns null for anything that is not a valid amount. */
export function parseAmount(input: string): bigint | null {
  const value = input.trim().replace(",", ".");
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(value)) return null;
  const [whole = "0", fraction = ""] = value.split(".");
  if (fraction.length > DECIMALS) return null;
  return BigInt(whole || "0") * 10n ** BigInt(DECIMALS) + BigInt(fraction.padEnd(DECIMALS, "0") || "0");
}

/** 125000000n -> "12.5" (trailing zeros trimmed, up to `maxDecimals`). */
export function formatAmount(stroops: bigint | string, maxDecimals = 2, minDecimals = 0): string {
  const value = BigInt(stroops);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(DECIMALS);
  const whole = abs / base;
  let fraction = (abs % base).toString().padStart(DECIMALS, "0").slice(0, maxDecimals);
  fraction = fraction.replace(/0+$/, "").padEnd(minDecimals, "0");
  const wholeStr = whole.toLocaleString("en-US");
  return `${negative ? "-" : ""}${wholeStr}${fraction ? `.${fraction}` : ""}`;
}

export const toNumber = (stroops: bigint | string) => Number(BigInt(stroops)) / 10 ** DECIMALS;

export const formatUsd = (value: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : 0,
  }).format(value);

export const formatInt = (value: number) => new Intl.NumberFormat("en-US").format(value);

export const formatPct = (value: number, digits = 2) => `${value.toFixed(digits)}%`;

export const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}
