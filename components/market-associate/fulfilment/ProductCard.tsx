"use client";

import { AlertTriangle, Check, ChevronRight, CircleDashed } from "lucide-react";
import { swatchFor } from "@/components/mobile/ColorPicker";
import { colorName } from "@/lib/color-name";
import { WorkflowThumbnail } from "@/components/market-associate/WorkflowThumbnail";
import { cn } from "@/lib/utils";
import { itemLabel, itemReferencePhoto, orderedColor, orderedSize, type TaskItem } from "./types";

export type ProductState = "verified" | "attention" | "issue" | "todo" | "locked";

const STATE = {
  verified: { label: "Verified", icon: Check, pill: "bg-emerald-50 text-emerald-700" },
  attention: { label: "Needs update", icon: AlertTriangle, pill: "bg-amber-50 text-amber-700" },
  issue: { label: "Issue reported", icon: AlertTriangle, pill: "bg-red-50 text-red-600" },
  todo: { label: "To verify", icon: CircleDashed, pill: "bg-[#FFF3C4] text-[#7A5D00]" },
  locked: { label: "", icon: CircleDashed, pill: "" },
} as const;

/** One ordered product: what to find, and where it stands. */
export function ProductCard({
  item,
  index,
  state,
  lockedNote,
  onOpen,
}: {
  item: TaskItem;
  index: number;
  state: ProductState;
  /** Shown instead of a status when the task is not at the verification stage. */
  lockedNote?: string;
  onOpen?: () => void;
}) {
  const color = orderedColor(item);
  const size = orderedSize(item);
  const meta = STATE[state];
  const Icon = meta.icon;
  const swatch = color ? swatchFor(color) : undefined;

  const body = (
    <>
      <WorkflowThumbnail src={itemReferencePhoto(item)} alt={`${itemLabel(item)} product`} className="size-16 rounded-xl" />
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#F1F1F1] text-[10px] font-bold text-[#6B6B6B]">{index + 1}</span>
          <span className="truncate text-[15px] font-semibold text-black">{itemLabel(item)}</span>
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {color && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[12px] text-[#555]">
              {swatch && <span className="size-2.5 rounded-full ring-1 ring-black/15" style={{ background: swatch }} />}
              {colorName(color)}
            </span>
          )}
          {size && <span className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[12px] text-[#555]">Size {size}</span>}
          <span className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[12px] font-semibold text-black">Qty {item.quantity ?? 1}</span>
        </span>
        {state === "locked" ? (
          lockedNote && <span className="mt-1.5 block text-[12px] text-[#8F8F8F]">{lockedNote}</span>
        ) : (
          <span className={cn("mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", meta.pill)}>
            <Icon className="size-3" strokeWidth={2.5} />
            {meta.label}
          </span>
        )}
      </span>
      {onOpen && <ChevronRight className="size-5 shrink-0 text-[#A3A3A6]" />}
    </>
  );

  const shell = "flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-black/5";
  return onOpen ? (
    <button type="button" onClick={onOpen} className={cn(shell, "transition active:scale-[0.99] active:bg-[#FAFAFA]")}>{body}</button>
  ) : (
    <div className={shell}>{body}</div>
  );
}
