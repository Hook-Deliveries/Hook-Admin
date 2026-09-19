"use client";

import { AlertTriangle, ChevronDown, PackageCheck, Tags, X } from "lucide-react";
import { SearchInput } from "@/components/shared/SearchInput";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STATUS_OPTIONS = [
  { label: "All products", value: "all" },
  { label: "Active", value: "approved" },
  { label: "Pending review", value: "pending_approval" },
  { label: "Rejected", value: "rejected" },
  { label: "Sold out", value: "sold_out" },
  { label: "Disabled", value: "disabled" },
];

const STOCK_OPTIONS = [
  { label: "All stock", value: "all" },
  { label: "Low stock", value: "low" },
  { label: "Out of stock", value: "out" },
];

interface Option {
  id: string;
  name?: string;
}

interface ProductFiltersProps {
  search: string;
  status: string;
  categoryId: string;
  stock: string;
  categories: Option[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onStockChange: (value: string) => void;
  onClear: () => void;
}

export function ProductFilters({
  search,
  status,
  categoryId,
  stock,
  categories,
  onSearchChange,
  onStatusChange,
  onCategoryChange,
  onStockChange,
  onClear,
}: ProductFiltersProps) {
  const activeCount = [
    search,
    status !== "all" ? status : "",
    categoryId !== "all" ? categoryId : "",
    stock !== "all" ? stock : "",
  ].filter(Boolean).length;
  const statusLabel = STATUS_OPTIONS.find((option) => option.value === status)?.label || "All products";
  const categoryLabel = categories.find((category) => category.id === categoryId)?.name || "All categories";
  const stockLabel = STOCK_OPTIONS.find((option) => option.value === stock)?.label || "All stock";

  return (
    <Card className="flex flex-col gap-3 rounded-xl p-3 shadow-none lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          placeholder="Search products..."
          className="w-full sm:w-64 lg:w-72"
          value={search}
          onChange={onSearchChange}
        />
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="justify-between gap-2 text-zinc-700">
                <PackageCheck size={14} />
                <span>{statusLabel}</span>
                {status !== "all" && (
                  <span className="rounded-full bg-brand-gold px-1.5 py-0.5 text-[11px] font-semibold text-zinc-900">1</span>
                )}
                <ChevronDown size={13} className="text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel>Product status</DropdownMenuLabel>
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
                <Tags size={14} />
                <span className="max-w-36 truncate">{categoryLabel}</span>
                {categoryId !== "all" && (
                  <span className="rounded-full bg-brand-gold px-1.5 py-0.5 text-[11px] font-semibold text-zinc-900">1</span>
                )}
                <ChevronDown size={13} className="text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-60 overflow-y-auto">
              <DropdownMenuLabel>Category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={categoryId} onValueChange={onCategoryChange}>
                <DropdownMenuRadioItem value="all">All categories</DropdownMenuRadioItem>
                {categories.map((category) => (
                  <DropdownMenuRadioItem key={category.id} value={category.id}>
                    {category.name || "Unnamed category"}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="justify-between gap-2 text-zinc-700">
                <AlertTriangle size={14} />
                <span>{stockLabel}</span>
                {stock !== "all" && (
                  <span className="rounded-full bg-brand-gold px-1.5 py-0.5 text-[11px] font-semibold text-zinc-900">1</span>
                )}
                <ChevronDown size={13} className="text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Stock level</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={stock} onValueChange={onStockChange}>
                {STOCK_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {activeCount > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={onClear} className="self-start text-zinc-500 lg:self-auto">
          <X size={14} />
          Clear
        </Button>
      )}
    </Card>
  );
}
