"use client";

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
import { ChevronDown, ListFilter, ReceiptText, X } from "lucide-react";

const STATUS_OPTIONS = [
  { label: "All orders", value: "all" },
  { label: "Active orders", value: "active" },
  { label: "Completed orders", value: "completed" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

const PAYMENT_OPTIONS = [
  { label: "All payments", value: "all" },
  { label: "Unpaid", value: "unpaid" },
  { label: "Pending", value: "pending" },
  { label: "Successful", value: "successful" },
  { label: "Failed", value: "failed" },
  { label: "Refunded", value: "refunded" },
];

/**
 * The coarse view switch from the design. "Completed" covers every terminal
 * state, not just delivered, so a cancelled or refunded order does not vanish
 * from both tabs.
 */
const VIEW_TABS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
];

interface OrderFiltersProps {
  search: string;
  status: string;
  paymentStatus: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPaymentStatusChange: (value: string) => void;
  onClear: () => void;
}

export function OrderFilters({
  search,
  status,
  paymentStatus,
  onSearchChange,
  onStatusChange,
  onPaymentStatusChange,
  onClear,
}: OrderFiltersProps) {
  const activeFilterCount = [search, status !== "all" ? status : "", paymentStatus !== "all" ? paymentStatus : ""].filter(Boolean).length;
  const statusLabel = STATUS_OPTIONS.find((option) => option.value === status)?.label || "All orders";
  const paymentLabel = PAYMENT_OPTIONS.find((option) => option.value === paymentStatus)?.label || "All payments";

  return (
    <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="inline-flex shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onStatusChange(tab.value)}
              aria-pressed={status === tab.value}
              className={
                status === tab.value
                  ? "rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 shadow-sm"
                  : "rounded-md px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
        <SearchInput
          placeholder="Search by ID, customer..."
          className="w-full sm:w-64 lg:w-72"
          value={search}
          onChange={onSearchChange}
        />
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="justify-between gap-2 text-zinc-700">
                <ListFilter size={14} />
                <span>{statusLabel}</span>
                {activeFilterCount > 0 && status !== "all" && (
                  <span className="rounded-full bg-brand-gold px-1.5 py-0.5 text-[11px] font-semibold text-zinc-900">1</span>
                )}
                <ChevronDown size={13} className="text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Order status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={status} onValueChange={onStatusChange}>
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
                <ReceiptText size={14} />
                <span>{paymentLabel}</span>
                {paymentStatus !== "all" && (
                  <span className="rounded-full bg-brand-gold px-1.5 py-0.5 text-[11px] font-semibold text-zinc-900">1</span>
                )}
                <ChevronDown size={13} className="text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Payment status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={paymentStatus} onValueChange={onPaymentStatusChange}>
                {PAYMENT_OPTIONS.map((option) => (
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
        <Button type="button" variant="ghost" size="sm" onClick={onClear} className="self-start text-zinc-500 lg:self-auto">
          <X size={14} />
          Clear
        </Button>
      )}
    </div>
  );
}
