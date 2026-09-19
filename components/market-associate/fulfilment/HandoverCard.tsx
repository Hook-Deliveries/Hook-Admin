"use client";

import { CheckCircle2, Copy, Expand, KeyRound, RefreshCw, TriangleAlert } from "lucide-react";
import { copyHandoverCode } from "./HandoverSheet";
import type { Task } from "./types";

/** The persistent handover code: on the task page for as long as the package waits for the Hub. */
export function HandoverCard({
  task,
  code,
  itemCount,
  onShowLarge,
}: {
  task: Task;
  code: string;
  itemCount: number;
  onShowLarge: () => void;
}) {
  return (
    <section id="handover-code" className="mb-5 overflow-hidden rounded-2xl bg-[#FFC809] shadow-[0_10px_30px_rgba(168,123,0,0.18)]">
      <div className="flex items-start gap-3 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-black text-[#FFC809]"><KeyRound className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-black">Package ready for the Hub</p>
          <p className="mt-0.5 text-[12px] leading-5 text-black/65">Write this code on the sealed package. Hub staff type it in to confirm they received it.</p>
        </div>
      </div>
      <div className="bg-[#FFF8D8] px-4 py-5 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#856500]">Hub handover code</p>
        <p className="mt-2 font-mono text-[44px] font-black leading-none tracking-[0.28em] text-black" aria-label={`Hub handover code ${code.split("").join(" ")}`}>{code}</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button type="button" onClick={() => void copyHandoverCode(code)} className="inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-[13px] font-bold text-black shadow-sm active:scale-95">
            <Copy className="size-4" /> Copy
          </button>
          <button type="button" onClick={onShowLarge} className="inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-[13px] font-bold text-black shadow-sm active:scale-95">
            <Expand className="size-4" /> Show large
          </button>
        </div>
      </div>
      <dl className="grid gap-1.5 bg-white px-4 py-3 text-[12px]">
        {[
          ["Package", task.package?.publicId || task.package?.labelReference || "—"],
          ["Destination", task.hub?.name || "Assigned Hook Hub"],
          ["Products", String(itemCount)],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4"><dt className="text-[#777]">{label}</dt><dd className="font-bold text-black">{value}</dd></div>
        ))}
      </dl>
    </section>
  );
}

/** The code cannot be shown (an older package, or a key change). The associate can ask for a new one. */
export function HandoverUnavailableCard({ onRegenerate, pending }: { onRegenerate: () => void; pending: boolean }) {
  return (
    <section className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-500 text-white"><TriangleAlert className="size-5" /></span>
        <div>
          <p className="text-[15px] font-bold text-amber-950">Handover code unavailable</p>
          <p className="mt-1 text-[12px] leading-5 text-amber-900">This package was sealed before its code could be kept. Get a new code, then write it on the package. It replaces any code written earlier.</p>
        </div>
      </div>
      <button type="button" disabled={pending} onClick={onRegenerate} className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-black text-[14px] font-bold text-white disabled:opacity-60">
        <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} /> {pending ? "Getting a new code" : "Get a new code"}
      </button>
    </section>
  );
}

export function HubReceivedCard({ task }: { task: Task }) {
  const reference = task.package?.publicId || task.package?.labelReference;
  return (
    <section className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><CheckCircle2 className="size-5" /></span>
      <div>
        <p className="text-[15px] font-bold text-emerald-950">Received by Hook Hub</p>
        <p className="mt-1 text-[12px] leading-5 text-emerald-800">The Hub verified the package and accepted custody. The handover code is now closed.</p>
        {reference && <p className="mt-2 text-[12px] font-bold text-emerald-950">{reference}</p>}
      </div>
    </section>
  );
}
