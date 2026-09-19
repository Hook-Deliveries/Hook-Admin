"use client";

import Link from "next/link";
import { Ban, Check, Eye, MoreHorizontal, PackageSearch, Pencil, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PermissionGuard, SuperAdminGuard } from "@/components/auth/PermissionGuard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { money } from "@/lib/admin-utils";
import { cn } from "@/lib/utils";
import type { ProductRow } from "./product-types";

function absoluteImageUrl(url?: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api/v1").replace(/\/api\/v1\/?$/, "");
  return `${base}${url}`;
}

function displayStatus(status: string) {
  return ["published", "approved"].includes(status.toLowerCase()) ? "active" : status;
}

function canReview(status?: string) {
  return !["published", "approved", "active", "disabled"].includes((status || "").toLowerCase());
}

function stockTone(quantity = 0) {
  if (quantity <= 0) return "text-red-600";
  if (quantity < 10) return "text-amber-600";
  return "text-emerald-600";
}

export function ProductCard({
  product,
  onApprove,
  onReject,
  onDisable,
  onDelete,
}: {
  product: ProductRow;
  onApprove: (product: ProductRow) => void;
  onReject: (product: ProductRow) => void;
  onDisable: (product: ProductRow) => void;
  onDelete: (product: ProductRow) => void;
}) {
  const id = product.id;
  const image = absoluteImageUrl(product.images?.[0]);
  const quantity = Number(product.quantity || 0);
  const isDisabled = product.status === "disabled";

  return (
    <Card className="group overflow-hidden rounded-xl shadow-none transition-shadow hover:shadow-md">
      <Link href={`/dashboard/products/${id}`} className="block outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="relative aspect-[16/8] overflow-hidden bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={product.title} className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : (
            <div className="grid size-full place-items-center text-muted-foreground"><PackageSearch className="size-6" /></div>
          )}
          <div className="absolute left-3 top-3"><StatusBadge status={displayStatus(product.status)} /></div>
          <div className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">{product.hookId || id.slice(0, 8)}</div>
        </div>
      </Link>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/dashboard/products/${id}`} className="block truncate text-base font-semibold text-foreground hover:underline">{product.title}</Link>
            <p className="mt-1 truncate text-xs text-muted-foreground">{product.category?.name || "Uncategorized"}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${product.title}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild><Link href={`/dashboard/products/${id}`}><Eye size={15} /> View details</Link></DropdownMenuItem>
              <PermissionGuard permission="products.edit">
                <DropdownMenuItem asChild><Link href={`/dashboard/products/${id}`}><Pencil size={15} /> Edit product</Link></DropdownMenuItem>
                {!isDisabled ? (
                  <DropdownMenuItem variant="destructive" onSelect={() => onDisable(product)}><Ban size={15} /> Disable product</DropdownMenuItem>
                ) : null}
              </PermissionGuard>
              <PermissionGuard permission="products.review">
                {canReview(product.status) ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onApprove(product)}><Check size={15} /> Approve product</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onReject(product)}><XCircle size={15} /> Reject product</DropdownMenuItem>
                  </>
                ) : null}
              </PermissionGuard>
              {isDisabled ? (
                <SuperAdminGuard>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => onDelete(product)}><Trash2 size={15} /> Delete product</DropdownMenuItem>
                </SuperAdminGuard>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-dashed pt-3 text-xs">
          <div className="min-w-0"><p className="text-muted-foreground">Hook Price</p><p className="mt-1 truncate font-medium text-foreground">{money(product.sellingPrice || 0)}</p></div>
          <div className="min-w-0">
            <p className="text-muted-foreground">Stock</p>
            <p className={cn("mt-1 truncate font-medium tabular-nums", stockTone(quantity))}>
              {quantity.toLocaleString()}
              {quantity > 0 && quantity < 10 && <span className="ml-1 text-[10px] font-medium text-amber-600">Low</span>}
              {quantity <= 0 && <span className="ml-1 text-[10px] font-medium text-red-500">Out</span>}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
