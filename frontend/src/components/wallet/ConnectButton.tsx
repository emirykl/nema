"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { shortAddress } from "@/lib/format";
import { useWallet } from "./WalletProvider";

export function ConnectButton({
  size = "md",
  variant = "ghost",
}: {
  size?: "md" | "lg";
  variant?: "primary" | "secondary" | "ghost";
}) {
  const { address, ready, connect, disconnect } = useWallet();
  // The navbar size stays on one line on small phones.
  const compact = size === "md" ? "whitespace-nowrap max-sm:!h-9 max-sm:!px-3 max-sm:!text-[13px]" : "";
  const [open, setOpen] = useState(false);

  if (!address) {
    return (
      <Button
        size={size}
        variant={variant}
        seed={21}
        className={compact}
        disabled={!ready}
        onClick={() => connect().catch(() => undefined)}
      >
        {size === "md" ? (
          <>
            <span className="max-[419px]:hidden">Connect wallet</span>
            <span className="min-[420px]:hidden">Connect</span>
          </>
        ) : (
          "Connect wallet"
        )}
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        size={size}
        variant="ghost"
        seed={21}
        tilt={1.5}
        className={compact}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="h-2.5 w-2.5 rounded-full border-2 border-ink bg-emerald-400" />
        <span className="tabular">{shortAddress(address)}</span>
      </Button>
      {open && (
        <div className="paper-card absolute right-0 top-14 z-50 w-56 p-2">
          <button
            className="label w-full rounded px-3 py-2 text-left text-[16px] hover:bg-surface-2"
            onClick={() => {
              navigator.clipboard?.writeText(address).catch(() => undefined);
              setOpen(false);
            }}
          >
            Copy address
          </button>
          <button
            className="label w-full rounded px-3 py-2 text-left text-[16px] text-red-600 hover:bg-surface-2"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
