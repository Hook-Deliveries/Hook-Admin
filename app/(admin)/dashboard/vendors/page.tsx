"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ListFilter, Plus, X } from "lucide-react";
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
import { VendorsTable } from "@/components/vendors/VendorsTable";
import { VendorOnboardingSheet } from "@/components/vendors/VendorOnboardingSheet";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { queryString, useUrlFilters } from "@/lib/admin-utils";

const STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Inactive", value: "inactive" },
  { label: "Blocked", value: "blocked" },
];

export default function VendorsPage() {
  const filters = useUrlFilters({ page: "1", status: "all" });
  const page = filters.get("page") || "1";
  const search = filters.get("search");
  const status = filters.get("status") || "all";

  const path = `/admin/market-vendors${queryString({ page, limit: 20, search, status })}`;
  const queryKey = useMemo(
    () => ["admin", "market-vendors", page, search, status] as const,
    [page, search, status],
  );

  const [onboarding, setOnboarding] = useState(false);

  const statusLabel = STATUS_OPTIONS.find((option) => option.value === status)?.label || "All statuses";
  const activeFilterCount = [search, status !== "all" ? status : ""].filter(Boolean).length;

  return (
    <div className="w-full min-w-0 space-y-5 px-4 py-5">
      <PageHeader
        className="mb-0"
        title="Vendors"
        description="Every supplier across all markets, with their contact and onboarding status."
        actions={
          <PermissionGuard permission="market.vendors.manage">
            <Button type="button" size="sm" onClick={() => setOnboarding(true)}>
              <Plus size={15} /> Onboard vendor
            </Button>
          </PermissionGuard>
        }
      />

      <VendorOnboardingSheet open={onboarding} onOpenChange={setOnboarding} />

      <div className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput
              placeholder="Search by business, contact, phone..."
              className="w-full sm:w-64 lg:w-72"
              value={search}
              onChange={(value) => filters.set({ search: value, page: 1 })}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="justify-between gap-2 text-zinc-700">
                  <ListFilter size={14} />
                  <span>{statusLabel}</span>
                  <ChevronDown size={13} className="text-zinc-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>Vendor status</DropdownMenuLabel>
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
          </div>

          {activeFilterCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => filters.set({ search: "", status: "all", page: 1 })}
              className="self-start text-zinc-500 lg:self-auto"
            >
              <X size={14} />
              Clear
            </Button>
          )}
        </div>

        <VendorsTable
          queryKey={queryKey}
          path={path}
          onPageChange={(nextPage) => filters.set({ page: nextPage })}
        />
      </div>
    </div>
  );
}
