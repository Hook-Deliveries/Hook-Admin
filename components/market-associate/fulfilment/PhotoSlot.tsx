"use client";

import Image from "next/image";
import { Camera, Check, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewKey } from "./types";

const LABEL: Record<ViewKey, string> = { front: "Front", side: "Side", back: "Back" };

/**
 * One required angle. Tap to take a photo or choose one from the gallery or
 * files; uploads as soon as one is chosen. There is deliberately no `capture`
 * attribute: it forces the camera and blocks picking an existing photo.
 */
export function PhotoSlot({
  view,
  url,
  uploading,
  disabled,
  onPick,
  onRemove,
}: {
  view: ViewKey;
  url?: string;
  uploading: boolean;
  disabled?: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="relative">
      <label
        className={cn(
          "group relative flex aspect-[3/4] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed text-[#8F8F8F] transition",
          url ? "border-transparent" : "border-[#D4D4D4] bg-[#FAFAFA] hover:border-[#FFC809] hover:bg-[#FFFBEA]",
          (disabled || uploading) && "pointer-events-none",
        )}
      >
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={disabled || uploading}
          aria-label={`${LABEL[view]} view photo`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPick(file);
            event.currentTarget.value = "";
          }}
        />
        {url ? (
          <>
            <Image src={url} alt={`${LABEL[view]} view`} fill sizes="200px" className="object-cover" unoptimized />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/60 to-transparent py-2 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
              <RefreshCw className="size-3" /> Retake
            </span>
          </>
        ) : (
          <>
            <Camera className="size-6" />
            <span className="mt-1.5 text-[12px] font-semibold text-[#555]">{LABEL[view]}</span>
          </>
        )}
        {uploading && (
          <span className="absolute inset-0 grid place-items-center bg-white/80 backdrop-blur-[1px]">
            <span className="size-6 animate-spin rounded-full border-2 border-[#FFC809] border-t-transparent" />
          </span>
        )}
      </label>
      {url && !uploading && (
        <>
          <span className="pointer-events-none absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-emerald-600 text-white shadow"><Check className="size-3" strokeWidth={3} /></span>
          <button type="button" onClick={onRemove} aria-label={`Remove ${LABEL[view]} photo`} className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black">
            <X className="size-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
