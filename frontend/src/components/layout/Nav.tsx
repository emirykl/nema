import Link from "next/link";
import { NemaSquid } from "@/components/illustrations/NemaSquid";
import { MobileMenu } from "./MobileMenu";
import { NavAction } from "./NavAction";

export const NAV_LINKS = [
  { href: "/app", label: "The Vault" },
  { href: "/#how", label: "How it works" },
  { href: "/transparency", label: "Transparency" },
];

export function Nav() {
  return (
    <header className="grain relative z-40 bg-ocean">
      <nav className="mx-auto flex h-20 max-w-7xl items-center gap-8 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="Nema home">
          <NemaSquid className="h-11 w-10" title="" />
          <span className="font-display text-[26px] uppercase leading-none text-paper [text-shadow:0_3px_0_var(--tape)]">
            Nema
          </span>
        </Link>
        <div className="ml-auto hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="label text-[17px] text-ink transition hover:text-paper">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <NavAction />
          <MobileMenu links={NAV_LINKS} />
        </div>
      </nav>
    </header>
  );
}
