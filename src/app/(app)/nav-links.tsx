"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

// Big tap targets on the charcoal bar; the current screen is Watwin orange.
// On phones the row scrolls sideways rather than wrapping onto several lines.
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 text-base [scrollbar-width:none]">
      {items.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center rounded-xl px-4 font-bold ${
              active ? "bg-brand-strong text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
