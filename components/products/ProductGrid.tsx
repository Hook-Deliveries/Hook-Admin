"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { HookLoader } from "@/components/shared/HookLoader";
import { QueryState } from "@/components/shared/QueryState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApiQuery } from "@/lib/query";
import { apiDelete, apiPatch } from "@/lib/api";
import type { Page } from "@/lib/admin-utils";
import { ProductCard } from "./ProductCard";
import type { ProductRow } from "./product-types";

export type { ProductRow } from "./product-types";

interface ProductGridProps {
  queryKey: readonly unknown[];
  path: string;
  onPageChange: (page: number) => void;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : fallback;
}

export function ProductGrid({ queryKey, path, onPageChange }: ProductGridProps) {
  const query = useApiQuery<Page<ProductRow>>(queryKey, path);
  const products = query.data?.data || [];
  const meta = {
    total: query.data?.total || 0,
    page: query.data?.page || 1,
    limit: query.data?.limit || 20,
    totalPages: query.data?.totalPages || 1,
  };
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function deleteProduct() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/admin/products/${deleteTarget.id}`);
      toast.success("Product deleted.");
      setDeleteTarget(null);
      query.refetch();
    } catch (error) {
      toast.error(errorMessage(error, "Product could not be deleted"));
    } finally {
      setDeleting(false);
    }
  }

  async function updateProduct(product: ProductRow, action: "approve" | "reject" | "disable") {
    const label = action === "approve" ? "approved" : action === "reject" ? "rejected" : "disabled";
    try {
      if (action === "disable") {
        await apiPatch(`/admin/products/${product.id}/disable`);
      } else {
        await apiPatch(`/admin/products/${product.id}/review`, { status: action === "approve" ? "approved" : "rejected" });
      }
      toast.success(`Product ${label}.`);
      query.refetch();
    } catch (error) {
      toast.error(errorMessage(error, "Product action failed"));
    }
  }

  return (
    <>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        loadingLabel="Loading products"
        errorTitle="Products could not be loaded"
        empty={!query.isLoading && !query.isError && !products.length}
        emptyIcon={PackageSearch}
        emptyTitle="No products found for this catalog view"
        emptyDescription="Try another search, adjust the catalog filters, or add a product when you are ready to build inventory."
        onRetry={() => query.refetch()}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onApprove={(item) => void updateProduct(item, "approve")}
              onReject={(item) => void updateProduct(item, "reject")}
              onDisable={(item) => void updateProduct(item, "disable")}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      </QueryState>

      {products.length ? (
        <div className="flex flex-col gap-2 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {(meta.page - 1) * meta.limit + 1} to {(meta.page - 1) * meta.limit + products.length} of {meta.total} products
            {query.isFetching && !query.isLoading ? " · refreshing" : ""}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 px-3" disabled={meta.page <= 1 || query.isFetching} onClick={() => onPageChange(meta.page - 1)}>
              <ChevronLeft size={14} />
            </Button>
            <Button size="sm" className="h-8 min-w-8 bg-zinc-900 px-2 text-white hover:bg-zinc-800">{meta.page}</Button>
            <span className="px-1">/ {meta.totalPages}</span>
            <Button variant="outline" size="sm" className="h-8 px-3" disabled={meta.page >= meta.totalPages || query.isFetching} onClick={() => onPageChange(meta.page + 1)}>
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this product?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? `"${deleteTarget.title}" will be permanently removed from the catalog. This cannot be undone.` : "This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void deleteProduct()} disabled={deleting}>
              {deleting ? <HookLoader size="button" /> : "Delete product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
