"use client";

import Link from "next/link";
import { useState } from "react";

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="grid h-10 w-10 place-items-center rounded-[4px] border-2 border-ink bg-paper text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
        >
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <div className="grain absolute inset-x-0 top-20 border-y-2 border-ink bg-ocean px-5 py-4 shadow-[0_8px_0_var(--tape)]">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="label block py-3 text-[26px] text-ink hover:text-paper"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
