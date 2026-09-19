"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { QueryState } from "@/components/shared/QueryState";
import { ListRow, initialsOf } from "@/components/shared/ListRow";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HookLoader } from "@/components/shared/HookLoader";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { apiPost } from "@/lib/api";
import { useApiQuery } from "@/lib/query";
import { toast } from "sonner";

type Row = {
  id?: string;
  publicId?: string;
  amountMinor?: number;
  orderId?: string;
  reason?: string;
  status?: string;
  idempotencyKey?: string;
  order?: { publicId?: string } | null;
};

const money = (minor?: number) => `₦${(Number(minor || 0) / 100).toLocaleString()}`;

/** Statuses that still have work left for finance to do. */
const ACTIONABLE = ["REQUESTED", "APPROVED", "FAILED"];

/**
 * Finance's refund worklist.
 *
 * Creating a refund lives on the order page now — this page used to ask staff
 * to type an order id into a free-text box, copied from elsewhere and easy to
 * mistype, with none of the order's context on screen. What stays here is the
 * part that is genuinely cross-order: a failed or pending refund must be
 * visible without knowing which order it came from.
 */
export default function FulfilmentRefundsPage() {
  const query = useApiQuery<Row[]>(
    ["admin", "fulfilment", "refunds"],
    "/admin/fulfilment/refunds?limit=100",
  );
  const [pending, setPending] = useState<string>();
  const rows = query.data || [];
  const outstanding = rows.filter((row) => ACTIONABLE.includes(row.status ?? "")).length;

  async function process(item: Row) {
    const id = item.publicId || item.id;
    if (!id) return;
    setPending(id);
    try {
      await apiPost(`/admin/fulfilment/refunds/${id}/process`, {
        idempotencyKey: item.idempotencyKey,
      });
      toast.success("Refund sent to the provider.");
      await query.refetch();
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message.replace(/^\d+:\s*/, "")
          : "The refund could not be processed.",
      );
    } finally {
      setPending(undefined);
    }
  }

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        showBack={false}
        title="Refund processing"
        description="Refunds are executed against captured Paystack balances and retain provider evidence."
      />

      <Card className="rounded-lg shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle className="text-base">Refund queue</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {outstanding
                ? `${outstanding} refund${outstanding === 1 ? "" : "s"} awaiting action.`
                : "Nothing is waiting on finance."}{" "}
              Start a refund from the order you are refunding.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <QueryState
            loading={query.isLoading}
            error={query.error}
            empty={rows.length === 0}
            loadingLabel="Loading refunds"
            errorTitle="Refunds could not be loaded"
            emptyTitle="No refund records"
            emptyDescription="Refunds raised from an order will appear here for processing."
            emptyIcon={RotateCcw}
            onRetry={() => query.refetch()}
          >
            {rows.map((item, index) => {
              const id = item.publicId || item.id || `refund-${index}`;
              const orderRef = item.order?.publicId || item.orderId;
              const failed = item.status === "FAILED";
              return (
                <ListRow
                  key={id}
                  index={index + 1}
                  initials={initialsOf(item.status || "refund")}
                  // A failed refund is the row that needs a human — money did
                  // not reach the customer — so it is tinted.
                  tint={failed ? "bg-danger-soft/40 hover:bg-danger-soft/50" : undefined}
                  title={<span className="truncate text-sm font-semibold text-zinc-950">{id}</span>}
                  subject={money(item.amountMinor)}
                  meta={[
                    orderRef ? (
                      <Link href={`/dashboard/orders/${orderRef}`} className="hover:underline">
                        {orderRef}
                      </Link>
                    ) : (
                      "No order reference"
                    ),
                    item.reason,
                  ]}
                  actions={
                    <>
                      <StatusBadge status={item.status || "REQUESTED"} />
                      {ACTIONABLE.includes(item.status ?? "") ? (
                        <PermissionGuard permission="finance.refunds.process">
                          <Button size="sm" onClick={() => void process(item)} disabled={pending === id}>
                            {pending === id ? <HookLoader size="button" /> : "Process refund"}
                          </Button>
                        </PermissionGuard>
                      ) : null}
                    </>
                  }
                />
              );
            })}
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
