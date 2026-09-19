"use client";

import { PackageCheck } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HookLoader } from "@/components/shared/HookLoader";
import { MobileEmpty, MobileHeader, MobileRow, MobileSection } from "@/components/mobile/MobileUI";
import { useApiQuery } from "@/lib/query";
import { WorkflowThumbnail } from "@/components/market-associate/WorkflowThumbnail";

type Row = {
  id?: string;
  publicId?: string;
  status?: string;
  marketId?: string;
  orderId?: string;
  createdAt?: string;
  previewImage?: string;
  previewTitle?: string;
  previewQuantity?: number;
  itemCount?: number;
};
type MarketAssociateTasks = { data: Row[]; total: number };

/**
 * How long this task has been waiting. Replaces the old "Accept by HH:MM" /
 * "Acceptance overdue" label, which was driven by a hardcoded 15-minute
 * deadline stamped at creation and never recomputed — so a task assigned
 * overnight was always "overdue" regardless of anyone's response time.
 */
function ageLabel(value?: string) {
  if (!value) return undefined;
  const created = new Date(value).getTime();
  if (Number.isNaN(created)) return undefined;
  const minutes = Math.max(Math.round((Date.now() - created) / 60000), 0);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `Waiting ${minutes}m`;
  if (minutes < 60 * 24) return `Waiting ${Math.round(minutes / 60)}h`;
  return `Waiting ${Math.round(minutes / (60 * 24))}d`;
}

export default function MarketAssociateFulfilmentsPage() {
  const query = useApiQuery<MarketAssociateTasks>(["marketassociate", "fulfilments", { limit: 100 }], "/market-associate/fulfilments?limit=100");
  const rows = query.data?.data || [];

  if (query.isLoading)
    return (
      <div className="grid min-h-80 place-items-center">
        <HookLoader label="Loading assigned fulfilments" />
      </div>
    );

  const urgent = rows.filter((row) => row.status === "ALERTED" || row.status === "BLOCKED");
  const active = rows.filter((row) => !urgent.includes(row));

  return (
    <div>
      <MobileHeader
        title="Orders"
        subtitle="Accept a task, complete each product, then submit the package to Hub."
        action={
          rows.length ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-[#8F8F8F]">
              {query.data?.total || rows.length}
            </span>
          ) : undefined
        }
      />

      {!rows.length ? (
        <MobileEmpty
          icon={PackageCheck}
          title="No tasks assigned"
          description="New orders from your assigned markets will appear here."
        />
      ) : (
        <>
          {urgent.length > 0 && (
            <MobileSection title="Needs your action">
              {urgent.map((task) => (
                <TaskRow key={task.publicId || task.id} task={task} urgent />
              ))}
            </MobileSection>
          )}
          {active.length > 0 && (
            <MobileSection title="In progress">
              {active.map((task) => (
                <TaskRow key={task.publicId || task.id} task={task} />
              ))}
            </MobileSection>
          )}
        </>
      )}
    </div>
  );
}

function TaskRow({ task, urgent }: { task: Row; urgent?: boolean }) {
  const due = ageLabel(task.createdAt);
  return (
    <MobileRow
      leading={
        <WorkflowThumbnail
          src={task.previewImage}
          alt={task.previewTitle ? `${task.previewTitle} product` : "Fulfilment product"}
          className="size-12"
        />
      }
      tone={urgent ? "brand" : "neutral"}
      label={task.previewTitle || task.publicId || task.id || "Task"}
      description={[
        task.publicId || task.id,
        due,
        task.previewQuantity && task.previewQuantity > 1 ? `Qty ${task.previewQuantity}` : undefined,
        task.itemCount && task.itemCount > 1 ? `${task.itemCount} products` : undefined,
      ].filter(Boolean).join(" · ")}
      href={`/market-associate/fulfilments/${task.publicId || task.id}`}
      value={<StatusBadge status={task.status || "PENDING"} />}
    />
  );
}
