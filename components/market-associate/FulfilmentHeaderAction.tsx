"use client";

import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { WorkflowThumbnail } from "@/components/market-associate/WorkflowThumbnail";
import { cn } from "@/lib/utils";

export function FulfilmentHeaderAction({
  count,
  href,
  title,
  imageUrl,
  blocked = false,
}: {
  count: number;
  href: string;
  title?: string;
  imageUrl?: string;
  blocked?: boolean;
}) {
  const multiple = count > 1;
  const heading = blocked
    ? `${count} fulfilment${multiple ? "s" : ""} need attention`
    : multiple
      ? `${count} fulfilments ready to work on`
      : "Fulfilment ready to work on";
  const detail = multiple ? "Open all assigned fulfilments" : title || "Open assigned fulfilment";

  return (
    <Link
      href={href}
      aria-label={`${heading}. ${detail}`}
      className={cn(
        "group flex h-12 w-full min-w-0 items-center gap-2 rounded-[12px] border px-2 py-1.5 shadow-sm transition active:scale-[0.995] motion-reduce:transition-none sm:gap-2.5 sm:px-2.5",
        blocked
          ? "border-red-700 bg-red-600 text-white"
          : "border-[#E4B500] bg-[#FFC809] text-black",
      )}
    >
      {imageUrl ? (
        <WorkflowThumbnail src={imageUrl} alt={title ? `${title} product` : "Fulfilment product"} className="size-9 rounded-[8px]" />
      ) : (
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-[8px]", blocked ? "bg-white/15" : "bg-white/70")}>
          <Package size={18} aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-extrabold leading-4 sm:hidden">
          {count} {count === 1 ? "order" : "orders"}
        </span>
        <span className="hidden truncate text-[12px] font-extrabold leading-4 sm:block">{heading}</span>
        <span className={cn("hidden truncate text-[10px] leading-3.5 sm:block", blocked ? "text-white/85" : "text-black/65")}>
          {detail}
        </span>
      </span>
      <span className={cn("grid min-w-6 shrink-0 place-items-center rounded-full px-1.5 py-1 text-[10px] font-extrabold", blocked ? "bg-white text-red-600" : "bg-black text-white")}>
        {count > 99 ? "99+" : count}
      </span>
      <ChevronRight size={16} className="hidden shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none sm:block" aria-hidden />
    </Link>
  );
}
