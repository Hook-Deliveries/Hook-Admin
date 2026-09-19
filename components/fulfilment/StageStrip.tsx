import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Stage = { key: string; label: string; count?: number; href?: string; tone?: "default" | "warning" | "danger" };

/** Compact pipeline of fulfilment stages with live counts. */
export function StageStrip({ stages, active, onSelect }: { stages: Stage[]; active?: string; onSelect?: (key: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1.5">
      {stages.map((stage, index) => (
        <div key={stage.key} className="flex items-center">
          <button
            type="button"
            onClick={() => onSelect?.(stage.key)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition hover:bg-muted",
              active === stage.key && "bg-muted font-semibold",
            )}
          >
            <span>{stage.label}</span>
            <span
              className={cn(
                "min-w-5 rounded-full px-1.5 text-center text-xs font-semibold",
                stage.tone === "danger" ? "bg-danger-soft text-danger" : stage.tone === "warning" ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground",
              )}
            >
              {stage.count ?? 0}
            </span>
          </button>
          {index < stages.length - 1 ? <ChevronRight className="size-4 text-muted-foreground/50" /> : null}
        </div>
      ))}
    </div>
  );
}
