"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Networks } from "@creit.tech/stellar-wallets-kit/types";
import { config } from "@/lib/config";

type Kit = typeof import("@creit.tech/stellar-wallets-kit/sdk").StellarWalletsKit;

interface WalletContextValue {
  address: string | null;
  ready: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sign: (xdr: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextValue | null>(null);
const STORAGE_KEY = "nema.wallet";

function storage(action: "get"): string | null;
function storage(action: "set", value: string | null): void;
function storage(action: "get" | "set", value?: string | null) {
  try {
    if (action === "get") return localStorage.getItem(STORAGE_KEY);
    if (value) localStorage.setItem(STORAGE_KEY, value);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const kitRef = useRef<Kit | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // The kit touches `window` and custom elements, so it loads client-side only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ StellarWalletsKit }, { defaultModules }] = await Promise.all([
        import("@creit.tech/stellar-wallets-kit/sdk"),
        import("@creit.tech/stellar-wallets-kit/modules/utils"),
      ]);
      const savedWallet = storage("get");
      StellarWalletsKit.init({
        modules: defaultModules(),
        network: config.networkPassphrase as Networks,
        selectedWalletId: savedWallet ?? undefined,
      });
      kitRef.current = StellarWalletsKit;

      if (savedWallet) {
        const restored = await StellarWalletsKit.getAddress().catch(() => null);
        if (!cancelled && restored) setAddress(restored.address);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    const kit = kitRef.current;
    if (!kit) return;
    const { address } = await kit.authModal();
    storage("set", kit.selectedModule.productId);
    setAddress(address);
  }, []);

  const disconnect = useCallback(async () => {
    await kitRef.current?.disconnect().catch(() => undefined);
    storage("set", null);
    setAddress(null);
  }, []);

  const sign = useCallback(
    async (xdr: string) => {
      const kit = kitRef.current;
      if (!kit || !address) throw new Error("Connect a wallet first");
      const { signedTxXdr } = await kit.signTransaction(xdr, { networkPassphrase: config.networkPassphrase, address });
      return signedTxXdr;
    },
    [address],
  );

  const value = useMemo(
    () => ({ address, ready, connect, disconnect, sign }),
    [address, ready, connect, disconnect, sign],
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
