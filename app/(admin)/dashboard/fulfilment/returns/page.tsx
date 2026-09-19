"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { HookLoader } from "@/components/shared/HookLoader";
import { PageHeader } from "@/components/shared/PageHeader";
import { QueryState } from "@/components/shared/QueryState";
import { ListRow, initialsOf } from "@/components/shared/ListRow";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { apiPatch } from "@/lib/api";
import { useApiQuery } from "@/lib/query";

type Row = {
  id?: string;
  _id?: string;
  publicId?: string;
  orderId?: string;
  reasonType?: string;
  reason?: string;
  status?: string;
  order?: { publicId?: string } | null;
};

const label = (value?: string) => String(value || "-").replaceAll("_", " ");

/** Statuses still awaiting a reviewer decision. */
const OPEN_STATUSES = ["REQUESTED", "UNDER_REVIEW"];
const isOpen = (row: Row) => OPEN_STATUSES.includes(String(row.status));

const VIEWS = [
  { label: "Awaiting review", value: "open" },
  { label: "Decided", value: "decided" },
  { label: "All", value: "all" },
];

export default function FulfilmentReturnsPage() {
  const query = useApiQuery<Row[]>(
    ["admin", "fulfilment", "returns"],
    "/admin/fulfilment/returns?limit=100",
  );
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string>();
  // Defaults to the work that needs doing rather than the full history.
  const [view, setView] = useState("open");

  const rows = useMemo(() => query.data || [], [query.data]);
  const openCount = useMemo(() => rows.filter(isOpen).length, [rows]);
  const visible = useMemo(() => {
    if (view === "open") return rows.filter(isOpen);
    if (view === "decided") return rows.filter((row) => !isOpen(row));
    return rows;
  }, [rows, view]);

  async function review(item: Row, decision: "APPROVED" | "REJECTED") {
    const id = item.publicId || item.id || item._id;
    if (!id || !reasons[id]?.trim()) return;
    setPending(id);
    try {
      await apiPatch(`/admin/fulfilment/returns/${id}/review`, {
        decision,
        reason: reasons[id].trim(),
      });
      toast.success(decision === "APPROVED" ? "Return approved." : "Return rejected.");
      await query.refetch();
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message.replace(/^\d+:\s*/, "")
          : "The decision could not be recorded.",
      );
    } finally {
      setPending(undefined);
    }
  }

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        showBack={false}
        title="Returns review"
        description="Review customer issues within the 24-hour delivery or collection policy window, with a recorded decision reason."
      />

      <Card className="rounded-lg shadow-none">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle className="text-base">Return requests</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {openCount
                ? `${openCount} awaiting a decision of ${rows.length} total.`
                : `Nothing awaiting review · ${rows.length} total.`}
            </p>
          </div>
          <div className="inline-flex shrink-0 rounded-lg border bg-muted/40 p-0.5">
            {VIEWS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setView(option.value)}
                aria-pressed={view === option.value}
                className={
                  view === option.value
                    ? "rounded-md bg-background px-3 py-1.5 text-sm font-semibold shadow-sm"
                    : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <QueryState
            loading={query.isLoading}
            error={query.error}
            empty={visible.length === 0}
            loadingLabel="Loading returns"
            errorTitle="Return requests could not be loaded"
            emptyTitle={view === "open" ? "Nothing awaiting review" : "No return requests"}
            emptyDescription={
              view === "open"
                ? "New customer return requests will appear here."
                : "Try another view to see other return requests."
            }
            emptyIcon={RotateCcw}
            onRetry={() => query.refetch()}
          >
            {visible.map((item, index) => {
              const id = item.publicId || item.id || item._id || `return-${index}`;
              const open = isOpen(item);
              const orderRef = item.order?.publicId || item.orderId;
              const decisionReason = reasons[id] || "";

              return (
                <div key={id} className="border-t border-zinc-100 first:border-t-0">
                  <ListRow
                    index={index + 1}
                    initials={initialsOf(label(item.reasonType))}
                    title={<span className="truncate text-sm font-semibold text-zinc-950">{id}</span>}
                    subject={
                      orderRef ? (
                        <Link href={`/dashboard/orders/${orderRef}`} className="hover:underline">
                          {orderRef}
                        </Link>
                      ) : undefined
                    }
                    meta={[
                      label(item.reasonType),
                      item.reason || "No customer explanation provided.",
                    ]}
                    actions={<StatusBadge status={item.status || "REQUESTED"} />}
                  />

                  {/* The decision form only appears on rows that still need one,
                      so a decided return reads as a plain list entry. */}
                  {open ? (
                    <PermissionGuard permission="returns.review">
                      <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3 xl:px-5">
                        <Textarea
                          value={decisionReason}
                          onChange={(event) =>
                            setReasons((current) => ({ ...current, [id]: event.target.value }))
                          }
                          placeholder="Decision reason"
                          maxLength={1000}
                        />
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void review(item, "REJECTED")}
                            disabled={pending === id || !decisionReason.trim()}
                          >
                            <X /> Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => void review(item, "APPROVED")}
                            disabled={pending === id || !decisionReason.trim()}
                          >
                            {pending === id ? <HookLoader size="button" /> : <><Check /> Approve return</>}
                          </Button>
                        </div>
                      </div>
                    </PermissionGuard>
                  ) : null}
                </div>
              );
            })}
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
