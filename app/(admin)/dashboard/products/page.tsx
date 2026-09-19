"use client";

import Link from "next/link";
import {
  AlertCircle,
  Boxes,
  Download,
  PackageCheck,
  Plus,
  Tags,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductGrid } from "@/components/products/ProductGrid";
import type { ProductRow } from "@/components/products/product-types";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { useApiQuery } from "@/lib/query";
import { Page, number, queryString, useUrlFilters } from "@/lib/admin-utils";

interface CategoryOption {
  id: string;
  name: string;
}

export default function ProductsPage() {
  const filters = useUrlFilters({
    page: "1",
    search: "",
    status: "all",
    categoryId: "all",
    stock: "all",
  });

  const page = Number(filters.get("page") || 1);
  const search = filters.get("search") || "";
  const status = filters.get("status") || "all";
  const categoryId = filters.get("categoryId") || "all";
  const stock = filters.get("stock") || "all";
  const listPath = `/admin/products${queryString({ page, limit: 12, search, status, categoryId, stock })}`;
  const queryKey = [
    "admin",
    "products",
    page,
    search,
    status,
    categoryId,
    stock,
  ] as const;

  const productsQuery = useApiQuery<Page<ProductRow>>(queryKey, listPath);
  const categoriesQuery = useApiQuery<{ data: CategoryOption[] }>(
    ["admin", "product-category-options"],
    "/admin/categories",
  );

  const stats = productsQuery.data?.stats || {};
  const products = productsQuery.data?.data || [];
  const categories = categoriesQuery.data?.data || [];

  function setFilter(key: string, value: string) {
    filters.set({ [key]: value, page: 1 });
  }

  function exportCsv() {
    if (!products.length) {
      toast.info("There are no products to export for this view.");
      return;
    }

    const rows = [
      ["Product", "Hook ID", "Category", "Hook Price", "Stock", "Status"],
      ...products.map((product) => [
        product.title,
        product.hookId || product.id,
        product.category?.name || "Uncategorized",
        String(product.sellingPrice || 0),
        String(product.quantity || 0),
        product.status,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `hook-products-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Product export downloaded.");
  }

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        className="mb-0"
        title="Products"
        description="Manage inventory, market pricing, Hook pricing, and AI negotiation floors."
        actions={
          <>
            <PermissionGuard permission="products.view">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5"
                onClick={exportCsv}
              >
                <Download size={15} />{" "}
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="products.edit">
              <Button
                asChild
                variant="brand"
                size="sm"
                className="flex items-center gap-1.5"
              >
                <Link href="/dashboard/products/new">
                  <Plus size={16} /> Add Product
                </Link>
              </Button>
            </PermissionGuard>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total Products"
          value={number(stats.total)}
          caption={`${number(stats.approved)} active`}
          icon={Boxes}
          tone="blue"
        />
        <KpiCard
          label="Pending Review"
          value={number(stats.pendingApproval)}
          caption="Awaiting catalog decision"
          icon={PackageCheck}
          tone="amber"
        />
        <KpiCard
          label="Low Stock"
          value={number(stats.lowStock)}
          caption="Needs replenishment"
          icon={AlertCircle}
          tone="red"
        />
        <KpiCard
          label="Sold Out"
          value={number(stats.soldOut)}
          caption="Unavailable products"
          icon={Tags}
          tone="zinc"
        />
      </div>

      <ProductFilters
        search={search}
        status={status}
        categoryId={categoryId}
        stock={stock}
        categories={categories}
        onSearchChange={(value) => setFilter("search", value)}
        onStatusChange={(value) => setFilter("status", value)}
        onCategoryChange={(value) => setFilter("categoryId", value)}
        onStockChange={(value) => setFilter("stock", value)}
        onClear={() =>
          filters.set({
            search: "",
            status: "all",
            categoryId: "all",
            stock: "all",
            page: 1,
          })
        }
      />

      <ProductGrid
        queryKey={queryKey}
        path={listPath}
        onPageChange={(nextPage) => filters.set({ page: nextPage })}
      />
    </div>
  );
}
