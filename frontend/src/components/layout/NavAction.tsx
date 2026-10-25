"use client";

import { usePathname } from "next/navigation";
import { TentacleWrap } from "@/components/illustrations/TentacleWrap";
import { ButtonLink } from "@/components/ui/Button";
import { ConnectButton } from "@/components/wallet/ConnectButton";

/** The wallet lives in the vault; every other page points there instead. */
export function NavAction() {
  const pathname = usePathname();
  if (pathname.startsWith("/app")) return <ConnectButton />;
  return (
    <TentacleWrap>
      <ButtonLink href="/app" variant="ghost" seed={21} className="whitespace-nowrap max-sm:!h-9 max-sm:!px-3 max-sm:!text-[13px]">
        <span className="max-[379px]:hidden">Open the vault</span>
        <span className="min-[380px]:hidden">Vault</span>
      </ButtonLink>
    </TentacleWrap>
  );
}
