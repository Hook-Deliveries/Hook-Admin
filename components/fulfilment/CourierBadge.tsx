import { CircleAlert, CircleCheck } from "lucide-react";
import { money } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export type CourierInfo = {
  code?: string;
  name?: string;
  feeMinor?: number;
  available?: boolean;
  unavailableReason?: string;
  currentFeeMinor?: number;
};

/** The courier a customer chose, with a clear available / unavailable state. */
export function CourierBadge({ courier, className }: { courier?: CourierInfo; className?: string }) {
  if (!courier?.code && !courier?.name) {
    return <span className={cn("text-xs text-muted-foreground", className)}>No courier recorded</span>;
  }
  const unavailable = courier.available === false;
  const Icon = unavailable ? CircleAlert : CircleCheck;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)} title={courier.unavailableReason}>
      <Icon className={cn("size-3.5 shrink-0", unavailable ? "text-danger" : "text-success")} />
      <span className="font-medium text-foreground">{courier.name || courier.code}</span>
      {courier.feeMinor != null ? <span className="text-muted-foreground">{money(courier.feeMinor)}</span> : null}
      {unavailable ? <span className="font-semibold text-danger">Unavailable</span> : null}
    </span>
  );
}
