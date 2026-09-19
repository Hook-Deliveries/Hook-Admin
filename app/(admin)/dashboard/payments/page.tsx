"use client";

import { useMemo } from "react";
import { ChevronDown, ListFilter, X } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaymentsTable } from "@/components/payments/PaymentsTable";
import { queryString, useUrlFilters } from "@/lib/admin-utils";

const STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Pending", value: "PENDING" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Due at handover", value: "DUE_AT_HANDOVER" },
  { label: "Failed", value: "FAILED" },
  { label: "Refunded", value: "REFUNDED" },
];

const PROVIDER_OPTIONS = [
  { label: "All providers", value: "all" },
  { label: "Paystack", value: "paystack" },
];

export default function PaymentsPage() {
  const filters = useUrlFilters({ page: "1", status: "all", provider: "all" });
  const page = filters.get("page") || "1";
  const search = filters.get("search");
  const status = filters.get("status") || "all";
  const provider = filters.get("provider") || "all";

  const path = `/admin/commerce/payments${queryString({ page, limit: 20, search, status, provider })}`;
  const queryKey = useMemo(
    () => ["admin", "commerce", "payments", page, search, status, provider] as const,
    [page, search, status, provider],
  );

  const statusLabel = STATUS_OPTIONS.find((option) => option.value === status)?.label || "All statuses";
  const providerLabel = PROVIDER_OPTIONS.find((option) => option.value === provider)?.label || "All providers";
  const activeFilterCount = [search, status !== "all" ? status : "", provider !== "all" ? provider : ""].filter(Boolean).length;

  return (
    <div className="w-full min-w-0 space-y-5 px-4 py-5">
      <PageHeader
        className="mb-0"
        title="Payments"
        description="Every customer payment, who it came from, and how it was paid."
      />

      <div className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput
              placeholder="Search by payment or reference..."
              className="w-full sm:w-64 lg:w-72"
              value={search}
              onChange={(value) => filters.set({ search: value, page: 1 })}
            />
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="justify-between gap-2 text-zinc-700">
                    <ListFilter size={14} />
                    <span>{statusLabel}</span>
                    <ChevronDown size={13} className="text-zinc-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel>Payment status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={status}
                    onValueChange={(value) => filters.set({ status: value, page: 1 })}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="justify-between gap-2 text-zinc-700">
                    <span>{providerLabel}</span>
                    <ChevronDown size={13} className="text-zinc-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuLabel>Provider</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={provider}
                    onValueChange={(value) => filters.set({ provider: value, page: 1 })}
                  >
                    {PROVIDER_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => filters.set({ search: "", status: "all", provider: "all", page: 1 })}
              className="self-start text-zinc-500 lg:self-auto"
            >
              <X size={14} />
              Clear
            </Button>
          )}
        </div>

        <PaymentsTable
          queryKey={queryKey}
          path={path}
          onPageChange={(nextPage) => filters.set({ page: nextPage })}
        />
      </div>
    </div>
  );
}
