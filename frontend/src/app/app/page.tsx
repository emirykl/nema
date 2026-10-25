import type { Metadata } from "next";
import { VaultApp } from "@/components/vault/VaultApp";

export const metadata: Metadata = {
  title: "Vault · Nema",
  description: "Deposit USDT0 and earn yield with nUSDT0.",
};

export default function VaultPage() {
  return <VaultApp />;
}
