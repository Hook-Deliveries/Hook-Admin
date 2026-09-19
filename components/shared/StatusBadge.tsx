import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

type StatusIntent = "success" | "warning" | "danger" | "neutral";

const successStatuses = new Set([
  "active",
  "approved",
  "available",
  "collected",
  "completed",
  "confirmed",
  "delivered",
  "fully operational",
  "in stock",
  "online",
  "paid",
  "published",
  "qc passed",
  "ready for dispatch",
  "release approved",
  "resolved",
  "successful",
  "verified",
]);

const warningStatuses = new Set([
  "awaiting payment",
  "changes requested",
  "due at handover",
  "approved for fulfilment",
  "booked with provider",
  "in fulfilment",
  "in review",
  "in transit",
  "low stock",
  "low stock alert",
  "on break",
  "operations review",
  "out for delivery",
  "partially delivered",
  "pending",
  "pending approval",
  "processing",
  "submitted",
  "verification pending",
]);

const dangerStatuses = new Set([
  "blocked",
  "cancelled",
  "critical",
  "delayed",
  "disabled",
  "failed",
  "inactive",
  "out of stock",
  "on hold",
  "refunded",
  "rejected",
  "returned",
  "return in progress",
  "suspended",
  "unpaid",
]);

const intentClasses: Record<StatusIntent, string> = {
  success: "border-success/20 bg-success-soft text-success",
  warning: "border-warning/20 bg-warning-soft text-warning",
  danger: "border-danger/20 bg-danger-soft text-danger",
  neutral: "border-border bg-muted text-muted-foreground",
};

function formatStatus(status: string) {
  const value = String(status || "")
    .trim()
    .replaceAll("_", " ");
  if (!value) return "Unknown";
  return value
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function intentFor(status: string): StatusIntent {
  const normalized = status.trim().replaceAll("_", " ").toLowerCase();
  if (successStatuses.has(normalized)) return "success";
  if (warningStatuses.has(normalized)) return "warning";
  if (dangerStatuses.has(normalized)) return "danger";
  return "neutral";
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const intent = intentFor(status);

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        intentClasses[intent],
        className,
      )}
    >
      {formatStatus(status)}
    </Badge>
  );
}
