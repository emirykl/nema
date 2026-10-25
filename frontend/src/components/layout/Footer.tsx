import Link from "next/link";
import { NemaSquid } from "@/components/illustrations/NemaSquid";
import { SeaFloor } from "./SeaFloor";

export function Footer() {
  return (
    <footer className="bg-tape text-paper">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <NemaSquid className="h-11 w-10" title="" />
          <span className="font-display text-[24px] uppercase">Nema</span>
          <span className="label text-[16px] text-paper/50">USDT0 yield vault on Stellar</span>
        </div>
        <div className="label flex gap-6 text-[16px] md:ml-auto">
          <Link href="/app" className="hover:text-clown">
            The Vault
          </Link>
          <Link href="/transparency" className="hover:text-clown">
            Transparency
          </Link>
          <a href="https://hackmeridian.com" className="hover:text-clown" target="_blank" rel="noreferrer">
            HackMeridian 2026
          </a>
        </div>
      </div>
      <p className="mx-auto max-w-7xl px-5 pb-10 font-display text-[18px] uppercase text-paper/70 sm:px-8 sm:text-[22px]">
        Deposit. Chill. <span className="text-clown">The squid does the rest.</span>
      </p>
      <SeaFloor />
    </footer>
  );
}
