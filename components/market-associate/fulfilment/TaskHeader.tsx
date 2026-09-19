"use client";

import { Building2, Check, MapPin, Package } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { STEPS, stepIndex, type Task } from "./types";

/** Task identity, where it is in the workflow, and how much verification is left. */
export function TaskHeader({ task, title, verified, total }: { task: Task; title: string; verified: number; total: number }) {
  const current = stepIndex(task.status);
  const percent = total ? Math.round((verified / total) * 100) : 0;
  return (
    <section className="mb-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8F8F8F]">Fulfilment task</p>
          <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-black">{title}</h1>
        </div>
        <StatusBadge status={task.status || "PENDING"} />
      </div>

      <ul className="flex flex-wrap gap-1.5 px-4 pb-4">
        {[
          { icon: Package, text: `Order ${task.orderPublicId || task.orderId || "—"}` },
          { icon: MapPin, text: task.market?.name || `Market ${task.marketId || "—"}` },
          ...(task.hub?.name ? [{ icon: Building2, text: task.hub.name }] : []),
        ].map(({ icon: Icon, text }) => (
          <li key={text} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#F5F5F5] px-2.5 py-1 text-[12px] font-medium text-[#555]">
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{text}</span>
          </li>
        ))}
      </ul>

      <ol aria-label="Progress" className="grid grid-cols-4 gap-1 border-t border-black/5 bg-[#FAFAFA] px-3 py-3">
        {STEPS.map((step, index) => {
          const done = index < current || (index === current && current === STEPS.length - 1);
          const active = index === current && !done;
          return (
            <li key={step} className="flex flex-col items-center gap-1.5 text-center" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-[11px] font-bold transition-colors",
                  done ? "bg-black text-[#FFC809]" : active ? "bg-[#FFC809] text-black ring-4 ring-[#FFC809]/25" : "bg-[#E6E6E6] text-[#8F8F8F]",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span className={cn("text-[11px] font-semibold leading-tight", active || done ? "text-black" : "text-[#A3A3A6]")}>{step}</span>
            </li>
          );
        })}
      </ol>

      {total > 0 && (
        <div className="border-t border-black/5 px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-[12px]">
            <span className="font-semibold text-black">Products verified</span>
            <span className="tabular-nums text-[#8F8F8F]">{verified} of {total}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#EAEBE7]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[#FFC809] transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}
    </section>
  );
}
