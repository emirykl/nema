"use client";

import { Button } from "@/components/ui/Button";
import { useWallet } from "@/components/wallet/WalletProvider";
import { config } from "@/lib/config";

const NETWORK_NAMES: Record<string, string> = { PUBLIC: "Mainnet", TESTNET: "Testnet", FUTURENET: "Futurenet" };
const ours = config.network === "testnet" ? "Testnet" : "Mainnet";

/** Shown while the connected wallet is on a different network than the vault. */
export function NetworkWarning() {
  const { wrongNetwork, walletNetwork, checkNetwork } = useWallet();
  if (!wrongNetwork) return null;
  const theirs = (walletNetwork && NETWORK_NAMES[walletNetwork.toUpperCase()]) ?? walletNetwork ?? "another network";

  return (
    <div
      role="alert"
      className="paper-card mb-8 flex flex-col gap-4 !bg-clown p-5 text-ink sm:flex-row sm:items-center sm:p-6"
    >
      <div className="min-w-0 flex-1">
        <div className="font-display text-[22px] uppercase leading-tight sm:text-[26px]">
          Switch from {theirs} to {ours}
        </div>
        <p className="mt-2 text-[15px] leading-snug">
          Your wallet is on {theirs}. Nema runs on Stellar {ours}, so nothing can be signed until you switch.
          <br />
          <span className="font-semibold">Freighter:</span> Settings → Network → {ours}.
        </p>
      </div>
      <Button variant="secondary" className="shrink-0 self-start sm:self-center" onClick={() => checkNetwork()}>
        I switched
      </Button>
    </div>
  );
}
