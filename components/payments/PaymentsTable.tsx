"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, CreditCard, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { QueryState } from "@/components/shared/QueryState";
import { useApiQuery } from "@/lib/query";

export interface ApiPayment {
  id?: string;
  publicId?: string;
  reference?: string;
  commerceStatus?: string;
  status?: string;
  gateway?: string;
  paymentMethod?: string;
  amountMinor?: number;
  currency?: string;
  createdAt?: string;
  order?: { id: string; reference: string; status?: string };
  customer?: { name?: string; email?: string };
}

interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

export function moneyMinor(value: unknown, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0) / 100);
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function when(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export function PaymentsTable({
  queryKey,
  path,
  onPageChange,
}: {
  queryKey: readonly unknown[];
  path: string;
  onPageChange: (page: number) => void;
}) {
  const { data, isLoading, isFetching, error, refetch } = useApiQuery<Page<ApiPayment>>(queryKey, path);
  const rows = data?.data || [];
  const meta = {
    total: data?.total || 0,
    page: data?.page || 1,
    limit: data?.limit || 20,
    totalPages: data?.totalPages || 1,
  };
  const start = rows.length ? (meta.page - 1) * meta.limit + 1 : 0;
  const end = rows.length ? start + rows.length - 1 : 0;

  return (
    <>
      <QueryState
        loading={isLoading}
        error={error}
        empty={rows.length === 0}
        loadingLabel="Loading payments..."
        errorTitle="Payments could not be loaded"
        emptyTitle="No payments in this view"
        emptyDescription="Try another search or clear the filters."
        emptyIcon={CreditCard}
        onRetry={() => refetch()}
        className="border-t border-zinc-100"
      >
        <div className="space-y-3 border-t border-zinc-100 p-3 md:hidden">
          {rows.map((row) => {
            const id = row.publicId || row.id || "";
            const name = row.customer?.name || "Unknown customer";
            return (
              <article key={id} className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/dashboard/payments/${id}`} className="block truncate font-semibold text-zinc-950">
                      {id}
                    </Link>
                    <p className="mt-0.5 truncate text-sm text-zinc-500">{name}</p>
                  </div>
                  <span className="shrink-0 font-bold tabular-nums">
                    {moneyMinor(row.amountMinor, row.currency)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={row.commerceStatus || row.status || "pending"} />
                  {row.gateway ? (
                    <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium capitalize text-zinc-600">
                      {row.gateway}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                  <span className="truncate">{row.order?.reference || "No order"}</span>
                  <span className="shrink-0">{when(row.createdAt)}</span>
                </div>
              </article>
            );
          })}
        </div>

        <div className="hidden min-w-0 divide-y divide-zinc-100 border-t border-zinc-100 md:block">
          {rows.map((row, index) => {
            const id = row.publicId || row.id || "";
            const name = row.customer?.name || "Unknown customer";
            return (
              <article
                key={id}
                className="group flex min-w-0 items-center gap-4 px-4 py-3 transition-colors hover:bg-zinc-50 xl:px-5"
              >
                <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-zinc-400">
                  {start + index}
                </span>
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="bg-zinc-100 text-xs font-semibold text-zinc-600">
                    {initialsOf(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <Link
                      href={`/dashboard/payments/${id}`}
                      className="truncate text-sm font-semibold text-zinc-950 hover:underline"
                    >
                      {id}
                    </Link>
                    <span className="text-zinc-300">·</span>
                    <span className="truncate text-sm font-medium text-zinc-700">{name}</span>
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-zinc-500">
                    {row.order?.reference ? (
                      <>
                        <Link
                          href={`/dashboard/orders/${row.order.id}`}
                          className="truncate hover:underline"
                        >
                          {row.order.reference}
                        </Link>
                        <span className="text-zinc-300">|</span>
                      </>
                    ) : null}
                    <span className="shrink-0 capitalize">{row.gateway || "—"}</span>
                    <span className="text-zinc-300">|</span>
                    <span className="shrink-0">{when(row.createdAt)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-semibold tabular-nums text-zinc-900">
                    {moneyMinor(row.amountMinor, row.currency)}
                  </span>
                  <StatusBadge status={row.commerceStatus || row.status || "pending"} />
                  <Button asChild variant="outline" size="icon-sm">
                    <Link href={`/dashboard/payments/${id}`} aria-label={`View ${id}`}>
                      <Eye size={15} />
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </QueryState>

      <div className="flex flex-col gap-2 border-t border-zinc-200 px-4 py-2.5 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {start} to {end} of {meta.total} results{" "}
          {isFetching && !isLoading ? "· refreshing" : ""}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3"
            disabled={meta.page <= 1 || isFetching}
            onClick={() => onPageChange(meta.page - 1)}
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
            disabled={meta.page >= meta.totalPages || isFetching}
            onClick={() => onPageChange(meta.page + 1)}
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </>
  );
}
