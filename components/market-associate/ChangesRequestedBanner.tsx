"use client";

import Link from "next/link";
import { BellRing, ChevronRight, ClipboardCheck, Package, RotateCcw, TriangleAlert, type LucideIcon } from "lucide-react";
import { WorkflowThumbnail } from "@/components/market-associate/WorkflowThumbnail";
import { cn } from "@/lib/utils";

export type WorkflowAlert = {
  id: string;
  message: string;
  detail?: string;
  href: string;
  tone: "brand" | "danger" | "neutral";
  kind: "fulfilment" | "availability" | "changes";
  count: number;
  imageUrl?: string;
  imageAlt?: string;
};

const icons: Record<WorkflowAlert["kind"], LucideIcon> = {
  fulfilment: Package,
  availability: ClipboardCheck,
  changes: RotateCcw,
};

/** Persistent workflow alerts collapsed into the portal header to preserve page space. */
export function ChangesRequestedBanner({ alerts }: { alerts: WorkflowAlert[] }) {
  const total = alerts.reduce((sum, alert) => sum + alert.count, 0);
  return (
    <details className="group relative">
      <summary
        className="relative grid size-9 cursor-pointer list-none place-items-center rounded-[10px] border border-black/5 bg-white shadow-sm [&::-webkit-details-marker]:hidden"
        aria-label={`${total} open workflow ${total === 1 ? "item" : "items"}`}
      >
        <BellRing size={18} aria-hidden />
        <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-[#FFC809] px-1 py-0.5 text-[10px] font-bold text-black ring-2 ring-[#F5F5F5]">
          {total > 99 ? "99+" : total}
        </span>
      </summary>
      <div className="absolute right-0 top-11 z-[60] w-[min(88vw,23rem)] space-y-2 rounded-[14px] border border-black/8 bg-[#F5F5F5] p-2.5 shadow-xl">
        <div className="flex items-center justify-between px-1 pb-0.5">
          <p className="text-[13px] font-bold text-black">Work requiring attention</p>
          <span className="text-[11px] text-[#8F8F8F]">Updates live</span>
        </div>
        {alerts.map((alert) => {
          const Icon = alert.tone === "danger" ? TriangleAlert : icons[alert.kind];
          return (
            <Link
              key={alert.id}
              href={alert.href}
              className={cn(
                "flex items-center gap-2.5 rounded-[11px] border px-2.5 py-2.5 transition active:scale-[0.99] motion-reduce:transition-none",
                alert.tone === "danger" ? "border-red-200 bg-red-600 text-white" : "border-black/5 bg-white text-black",
              )}
              aria-label={`${alert.message}. ${alert.detail || "Open"}`}
            >
              {alert.imageUrl ? (
                <WorkflowThumbnail src={alert.imageUrl} alt={alert.imageAlt || "Product"} className="size-10 rounded-[8px]" />
              ) : (
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-[8px]", alert.tone === "danger" ? "bg-white/15" : "bg-[#FFF3C4]")}>
                  <Icon size={19} aria-hidden />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-bold leading-4">{alert.message}</span>
                {alert.detail && <span className={cn("mt-0.5 block truncate text-[11px]", alert.tone === "danger" ? "text-white/80" : "text-black/55")}>{alert.detail}</span>}
              </span>
              <span className={cn("grid min-w-6 place-items-center rounded-full px-1.5 py-1 text-[10px] font-bold", alert.tone === "danger" ? "bg-white text-red-600" : "bg-[#FFC809] text-black")}>{alert.count}</span>
              <ChevronRight size={15} className="shrink-0" aria-hidden />
            </Link>
          );
        })}
      </div>
    </details>
  );
}
