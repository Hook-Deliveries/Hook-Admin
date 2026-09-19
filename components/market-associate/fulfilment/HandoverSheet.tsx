"use client";

import { Building2, CheckCircle2, Copy, PackageCheck, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Task } from "./types";

/** Copies text, falling back to a message if the browser blocks the clipboard. */
export async function copyHandoverCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    toast.success("Handover code copied");
  } catch {
    toast.error("Could not copy. Write the code down instead.");
  }
}

/**
 * Shown the moment a fulfilment is submitted, and again on request. The code is
 * the only thing the associate needs from this screen, so it takes the whole
 * sheet: large, copyable, with the three things to do with it.
 */
export function HandoverSheet({
  open,
  onOpenChange,
  task,
  code,
  itemCount,
  justSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  code: string;
  itemCount: number;
  justSubmitted: boolean;
}) {
  const reference = task.package?.publicId || task.package?.labelReference;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border-x p-0">
        <div className="overflow-y-auto">
          <SheetHeader className="items-center px-6 pt-8 text-center">
            {justSubmitted && (
              <span className="mb-1 grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-6" /></span>
            )}
            <SheetTitle className="text-xl font-bold tracking-tight">{justSubmitted ? "Fulfilment submitted" : "Hub handover code"}</SheetTitle>
            <SheetDescription className="max-w-sm text-[13px] leading-5 text-[#6B6B6B]">
              Write this code on the sealed package. Hub staff type it in to confirm they have received it.
            </SheetDescription>
          </SheetHeader>

          <div className="mx-6 mt-6 rounded-3xl bg-[#FFC809] px-4 py-8 text-center shadow-[0_10px_30px_rgba(168,123,0,0.2)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/60">Handover code</p>
            <p
              className="mt-3 font-mono text-[72px] font-black leading-none tracking-[0.18em] text-black sm:text-[88px]"
              aria-label={`Hub handover code ${code.split("").join(" ")}`}
            >
              {code}
            </p>
            <button
              type="button"
              onClick={() => void copyHandoverCode(code)}
              className="mx-auto mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-black px-5 text-[14px] font-bold text-[#FFC809] active:scale-95"
            >
              <Copy className="size-4" /> Copy code
            </button>
          </div>

          <ol className="mx-6 mt-6 space-y-3 text-[14px]">
            {[
              { icon: PenLine, text: "Write the code clearly on the package." },
              { icon: PackageCheck, text: `Take the sealed package (${itemCount} product${itemCount === 1 ? "" : "s"}${reference ? `, ref ${reference}` : ""}) to the Hub.` },
              { icon: Building2, text: `Give it to ${task.hub?.name || "Hub staff"}. They enter the code to accept it.` },
            ].map(({ icon: Icon, text }, index) => (
              <li key={text} className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#F5F5F5] text-[#555]"><Icon className="size-4" /></span>
                <span className="pt-1 leading-5 text-black"><span className="mr-1.5 font-bold tabular-nums">{index + 1}.</span>{text}</span>
              </li>
            ))}
          </ol>
          <p className="mx-6 mt-5 text-center text-[12px] leading-5 text-[#8F8F8F]">
            This code stays on your task until the Hub receives the package, so you can come back to it any time.
          </p>
        </div>

        <div className="border-t border-black/5 bg-white p-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex min-h-[52px] w-full items-center justify-center rounded-full bg-black text-[15px] font-bold text-white hover:bg-zinc-800"
          >
            Done
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
