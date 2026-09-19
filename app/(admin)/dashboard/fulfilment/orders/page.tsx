"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ChevronLeft, ChevronRight, PackageSearch, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { QueryState } from "@/components/shared/QueryState";
import { useApiQuery } from "@/lib/query";
import { queryString, useUrlFilters } from "@/lib/admin-utils";

interface FulfilmentOrder {
  id: string;
  reference: string;
  commerceStatus?: string;
  totalMinor?: number;
  currency?: string;
  createdAt?: string;
  customer?: { name?: string; email?: string };
  items?: Array<{ id?: string; title?: string; imageUrl?: string; quantity?: number }>;
  tasks?: Array<{
    id?: string;
    status?: string;
    breaching?: boolean;
    market?: { name?: string } | null;
    hub?: { name?: string } | null;
    marketAssociate?: { name?: string } | null;
  }>;
  shipments?: Array<{ id?: string; status?: string; trackingNumber?: string }>;
  blockedTaskCount?: number;
  breachingTaskCount?: number;
}

interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

/**
 * The stages an order passes through inside fulfilment. These mirror the
 * STAGE_STATUSES map on the backend, so a tab always matches what the API
 * filters by.
 */
const STAGES = [
  { label: "All", value: "all" },
  { label: "Sourcing", value: "sourcing" },
  { label: "At hub", value: "hub" },
  { label: "Dispatch", value: "dispatch" },
];

const money = (minor?: number, currency = "NGN") =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    Number(minor || 0) / 100,
  );

function when(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export default function FulfilmentOrdersPage() {
  const filters = useUrlFilters({ page: "1", stage: "all" });
  const page = filters.get("page") || "1";
  const search = filters.get("search");
  const stage = filters.get("stage") || "all";

  const path = `/admin/fulfilment/orders${queryString({ page, limit: 20, search, stage })}`;
  const queryKey = useMemo(
    () => ["admin", "fulfilment", "orders", page, search, stage] as const,
    [page, search, stage],
  );
  const query = useApiQuery<Page<FulfilmentOrder>>(queryKey, path);

  const rows = query.data?.data || [];
  const meta = {
    total: query.data?.total || 0,
    page: query.data?.page || 1,
    totalPages: query.data?.totalPages || 1,
  };
  const attention = rows.filter((row) => (row.blockedTaskCount || 0) + (row.breachingTaskCount || 0) > 0).length;

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        showBack={false}
        title="Orders in fulfilment"
        description="Where each customer order actually is right now, with its sourcing tasks rolled up."
      />

      <Card className="gap-0 overflow-hidden rounded-lg py-0 shadow-card">
        <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="inline-flex shrink-0 rounded-lg border bg-muted/40 p-0.5">
              {STAGES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => filters.set({ stage: option.value, page: 1 })}
                  aria-pressed={stage === option.value}
                  className={
                    stage === option.value
                      ? "rounded-md bg-background px-3 py-1.5 text-sm font-semibold shadow-sm"
                      : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
            <SearchInput
              placeholder="Search by order reference..."
              className="w-full sm:w-64"
              value={search}
              onChange={(value) => filters.set({ search: value, page: 1 })}
            />
          </div>
          {attention ? (
            <span className="shrink-0 rounded-full border border-danger/20 bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
              {attention} need attention
            </span>
          ) : null}
        </div>

        <CardContent className="p-0">
          <QueryState
            loading={query.isLoading}
            error={query.error}
            empty={rows.length === 0}
            loadingLabel="Loading orders in fulfilment..."
            errorTitle="Orders could not be loaded"
            emptyTitle="No orders in this stage"
            emptyDescription="Orders appear here once payment is confirmed and sourcing begins."
            emptyIcon={PackageSearch}
            onRetry={() => query.refetch()}
          >
            {rows.map((order) => {
              const needsAttention = (order.blockedTaskCount || 0) + (order.breachingTaskCount || 0) > 0;
              const items = order.items || [];
              return (
                <article key={order.id} className="border-b px-4 py-4 last:border-b-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {/* Stacked thumbnails keep the row height fixed however
                          many items the order holds. */}
                      <div className="flex shrink-0 items-center">
                        {items.slice(0, 3).map((item, index) =>
                          item.imageUrl ? (
                            <span
                              key={item.id || index}
                              className="relative size-10 overflow-hidden rounded-md border-2 border-background bg-muted"
                              style={{ marginLeft: index === 0 ? 0 : -10, zIndex: 3 - index }}
                            >
                              <Image src={item.imageUrl} alt="" fill className="object-cover" unoptimized />
                            </span>
                          ) : (
                            <span
                              key={item.id || index}
                              className="grid size-10 place-items-center rounded-md border-2 border-background bg-muted text-muted-foreground"
                              style={{ marginLeft: index === 0 ? 0 : -10, zIndex: 3 - index }}
                            >
                              <PackageSearch className="size-4" />
                            </span>
                          ),
                        )}
                        {items.length > 3 ? (
                          <span
                            className="grid size-10 place-items-center rounded-md border-2 border-background bg-foreground text-[11px] font-bold text-background"
                            style={{ marginLeft: -10 }}
                          >
                            +{items.length - 3}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Link
                            href={`/dashboard/orders/${order.id}`}
                            className="truncate text-sm font-semibold hover:underline"
                          >
                            {order.reference}
                          </Link>
                          <StatusBadge status={order.commerceStatus || "IN_FULFILMENT"} />
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {order.customer?.name || "Customer"} · {items.length} item
                          {items.length === 1 ? "" : "s"} · {money(order.totalMinor, order.currency)}
                          {when(order.createdAt) ? ` · ${when(order.createdAt)}` : ""}
                        </p>
                      </div>
                    </div>

                    {needsAttention ? (
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {order.blockedTaskCount ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
                            <PauseCircle className="size-3" /> {order.blockedTaskCount} blocked
                          </span>
                        ) : null}
                        {order.breachingTaskCount ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-danger/20 bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">
                            <AlertTriangle className="size-3" /> {order.breachingTaskCount} past deadline
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {order.tasks?.length ? (
                    <div className="mt-3 space-y-1.5 border-t pt-3">
                      {order.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Link
                              href={`/dashboard/fulfilment/tasks/${task.id}`}
                              className="truncate font-medium hover:underline"
                            >
                              {task.id}
                            </Link>
                            <StatusBadge status={task.status || "UNASSIGNED"} />
                            {task.breaching ? (
                              <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-danger">
                                Past deadline
                              </span>
                            ) : null}
                          </div>
                          <span className="shrink-0 truncate text-muted-foreground">
                            {task.marketAssociate?.name || "Unassigned"} · {task.market?.name || "No market"}
                            {task.hub?.name ? ` · ${task.hub.name}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                      No sourcing tasks have been created for this order yet.
                    </p>
                  )}
                </article>
              );
            })}
          </QueryState>
        </CardContent>

        <div className="flex flex-col gap-2 border-t px-4 py-2.5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            {meta.total} order{meta.total === 1 ? "" : "s"} in fulfilment
            {query.isFetching && !query.isLoading ? " · refreshing" : ""}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3"
              disabled={meta.page <= 1 || query.isFetching}
              onClick={() => filters.set({ page: meta.page - 1 })}
            >
              <ChevronLeft size={14} />
            </Button>
            <Button size="sm" className="h-8 min-w-8 bg-zinc-900 px-2 text-white hover:bg-zinc-800">
              {meta.page}
            </Button>
            <span className="px-1">/ {meta.totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3"
              disabled={meta.page >= meta.totalPages || query.isFetching}
              onClick={() => filters.set({ page: meta.page + 1 })}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
