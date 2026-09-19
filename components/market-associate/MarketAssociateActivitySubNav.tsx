"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs: Array<[string, string]> = [
  ["Assigned markets", "/market-associate/markets"],
  ["Availability checks", "/market-associate/availability"],
];

export function MarketAssociateActivitySubNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-4 flex gap-1 border-b" aria-label="Market Associate activity">
      {tabs.map(([label, href]) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 pb-2 text-sm font-medium transition-colors",
              active
                ? "border-brand-gold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
