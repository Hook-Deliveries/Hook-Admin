"use client";

import { ColorLabel } from "@/components/shared/ColorLabel";
import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Ban, Boxes, Check, Edit3, Eye, Info, Layers, Mail, PackageCheck, Phone, Trash2, UserCheck, WalletCards, X } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HookLoader } from "@/components/shared/HookLoader";
import { ImagePreviewDialog } from "@/components/shared/ImagePreviewDialog";
import { MediaPicker } from "@/components/shared/MediaPicker";
import { AdminWorkflowSheet } from "@/components/shared/AdminWorkflowSheet";
import { DetailSection } from "@/components/shared/DetailSection";
import { DefinitionGrid } from "@/components/shared/DefinitionGrid";
import { ProductLifecycleWorkspace } from "@/components/products/ProductLifecycleWorkspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useApiPatch, useApiQuery } from "@/lib/query";
import { apiDelete } from "@/lib/api";
import { cleanError, money, number } from "@/lib/admin-utils";
import { PermissionGuard, SuperAdminGuard } from "@/components/auth/PermissionGuard";

interface ProductDetail {
  id: string;
  title: string;
  description?: string;
  hookId?: string;
  sellingPrice: number;
  costPrice: number;
  discountedPrice?: number;
  minAcceptablePrice: number;
  quantity: number;
  reservedQuantity: number;
  status: string;
  viewCount: number;
  orderCount: number;
  availabilityStatus?: string;
  catalogVersion?: number;
  categoryId?: string;
  marketId?: string;
  marketName?: string;
  sourceMarketVendorName?: string;
  sourceMarket?: { name?: string; publicId?: string } | null;
  sourceMarketVendor?: { businessName?: string; publicId?: string; status?: string } | null;
  images?: string[];
  colors?: string[];
  sizes?: string[];
  vendor?: { id?: string; businessName?: string };
  category?: { id?: string; publicId?: string; name?: string };
  categoryManagers?: CategoryManager[];
  basePriceMinor?: number;
  sellingPriceMinor?: number;
  negotiationRules?: {
    enabled: boolean;
    minimumNegotiablePriceMinor?: number;
    maximumDiscountMinor?: number;
    maximumCustomerOffers: number;
    acceptedQuoteExpiryMinutes: number;
  };
  availabilityCheckDueAt?: string;
  availabilityCheckNote?: string;
  lastAvailabilityConfirmedAt?: string;
}
interface ProductOption { id: string; publicId?: string; name: string; isActive?: boolean; status?: string; stateName?: string; state?: { name?: string }; }
interface VendorOption { id: string; publicId?: string; businessName: string; status?: string; }

/** Radix Select reserves an empty string for "no selection" — this sentinel
 * stands in for "no vendor" in the control, and is translated back to an
 * empty string (which the backend treats as "clear the vendor") on submit. */
const NO_VENDOR = "none";

interface CategoryManager {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string | null;
  role: "support" | "admin";
}

function managerName(manager: CategoryManager) {
  return `${manager.firstName || ""} ${manager.lastName || ""}`.trim() || manager.email;
}

function managerInitials(manager: CategoryManager) {
  const name = managerName(manager);
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function absoluteImageUrl(url?: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api/v1").replace(/\/api\/v1\/?$/, "");
  return `${base}${url}`;
}

function isActiveProduct(status?: string) {
  return ["published", "approved", "active"].includes((status || "").toLowerCase());
}

function canApproveProduct(status?: string) {
  return !["published", "approved", "active", "disabled"].includes((status || "").toLowerCase());
}

function PriceLabel({ children, help }: { children: React.ReactNode; help: string }) {
  return (
    <FieldLabel className="items-center">
      {children}
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-zinc-400 hover:text-zinc-700" aria-label={`${children} information`}>
            <Info size={13} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{help}</TooltipContent>
      </Tooltip>
    </FieldLabel>
  );
}

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const query = useApiQuery<ProductDetail>(["admin", "products", id], `/admin/products/${id}`, Boolean(id));
  const categories = useApiQuery<{ data: ProductOption[] }>(["admin", "categories", "product-options"], "/admin/categories");
  const markets = useApiQuery<{ data: ProductOption[] }>(["admin", "markets", "product-options"], "/admin/markets?limit=200");
  const approve = useApiPatch<ProductDetail, { status: string }>(`/admin/products/${id}/review`, ["admin", "products"], { successMessage: "Product approved" });
  const disable = useApiPatch<ProductDetail, undefined>(`/admin/products/${id}/disable`, ["admin", "products"], { successMessage: "Product disabled" });
  const updateProduct = useApiPatch<ProductDetail, Record<string, unknown>>(`/admin/products/${id}`, ["admin", "products"], { successMessage: "Product updated" });
  const [editing, setEditing] = useState(false);
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editColors, setEditColors] = useState<string[]>([]);
  const [editColorValue, setEditColorValue] = useState("#FFC809");
  const [editStatus, setEditStatus] = useState("draft");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editMarketId, setEditMarketId] = useState("");
  const [editVendorId, setEditVendorId] = useState(NO_VENDOR);
  // Vendors are market-scoped — a vendor invited into one Market can't supply
  // a product in another, so the picker only ever offers vendors belonging
  // to whichever Market is currently selected in the edit form.
  const vendors = useApiQuery<VendorOption[]>(["admin", "market", editMarketId, "vendors"], `/admin/markets/${editMarketId}/vendors`, editing && Boolean(editMarketId));
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const product = query.data;
  const heroImage = absoluteImageUrl(product?.images?.[0]);

  async function deleteProduct() {
    if (!product) return;
    setDeleting(true);
    try {
      await apiDelete(`/admin/products/${product.id}`);
      toast.success("Product deleted.");
      router.push("/dashboard/products");
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Product could not be deleted");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full space-y-5 px-4 py-5">
      <PageHeader
        title={product?.title || "Product Detail"}
        description={product?.hookId || product?.id ? `Commercial catalog · ${product.hookId || product.id}` : "Commercial catalog product"}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft size={15} /> Back</Button>
            <PermissionGuard permission="products.edit">
              {product && <Button variant="outline" size="sm" onClick={() => { setEditImages(product.images || []); setEditColors(product.colors || []); setEditStatus(isActiveProduct(product.status) ? "published" : product.status === "pending_approval" || product.status === "rejected" ? "draft" : product.status); setEditCategoryId(product.category?.publicId || product.category?.id || product.categoryId || ""); setEditMarketId(product.sourceMarket?.publicId || product.marketId || ""); setEditVendorId(product.sourceMarketVendor?.publicId || NO_VENDOR); setEditing(true); }}><Edit3 size={15} /> Edit</Button>}
              {product && product.status !== "disabled" && <Button size="sm" variant="outline" onClick={() => disable.mutate(undefined)}><Ban size={15} /> Disable</Button>}
            </PermissionGuard>
            <PermissionGuard permission="products.review">
              {product && canApproveProduct(product.status) && <Button size="sm" variant="brand" onClick={() => approve.mutate({ status: "published" })}><Check size={15} /> Activate</Button>}
            </PermissionGuard>
            {product && product.status === "disabled" && (
              <SuperAdminGuard>
                <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 size={15} /> Delete</Button>
              </SuperAdminGuard>
            )}
          </>
        }
      />

      {query.isLoading && <Card className="rounded-lg shadow-card"><CardContent className="p-4"><HookLoader label="Loading product..." /></CardContent></Card>}
      {query.error && <Card className="rounded-lg border-red-200 bg-red-50 shadow-none"><CardContent className="p-4 text-sm text-red-600">{cleanError(query.error)}</CardContent></Card>}

      {product && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard icon={WalletCards} tone="blue" label="Hook Price" value={money(product.sellingPrice)} caption="Customer-facing price" />
            <KpiCard icon={Boxes} tone={product.quantity < 10 ? "red" : "green"} label="Stock" value={number(product.quantity)} caption={`${number(product.reservedQuantity)} reserved`} />
            <KpiCard icon={PackageCheck} tone="amber" label="Orders" value={number(product.orderCount)} caption={`${number(product.viewCount)} views`} />
            <KpiCard icon={Layers} tone="zinc" label="Negotiation Floor" value={money(product.minAcceptablePrice)} caption="AI minimum accepted price" />
          </div>

          <Card className="overflow-hidden rounded-lg border-zinc-200 py-0 shadow-card">
            <CardContent className="grid gap-0 p-0 md:grid-cols-[280px_1fr]">
              <div className="relative aspect-16/10 bg-zinc-100 md:aspect-auto md:h-full">
                {heroImage ? (
                  <button type="button" onClick={() => setPreviewImage(heroImage)} className="group relative block size-full cursor-zoom-in" aria-label={`Preview ${product.title} image`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={heroImage} alt={product.title} className="size-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                    <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100"><Eye size={13} /> Preview</span>
                  </button>
                ) : (
                  <div className="flex size-full items-center justify-center text-sm text-zinc-400">No image</div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t p-4 text-sm sm:grid-cols-3 md:border-l md:border-t-0">
                <div>
                  <p className="text-xs text-zinc-500">Status</p>
                  <p className="mt-1"><StatusBadge status={isActiveProduct(product.status) ? "active" : product.status} /></p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Hook ID</p>
                  <p className="mt-1 font-medium text-zinc-900">{product.hookId || product.id.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Catalog version</p>
                  <p className="mt-1 font-medium text-zinc-900">{product.catalogVersion || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Cost price</p>
                  <p className="mt-1 font-medium text-zinc-900">{money(product.costPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Selling price</p>
                  <p className="mt-1 font-medium text-zinc-900">{money(product.sellingPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Negotiation floor</p>
                  <p className="mt-1 font-medium text-zinc-900">{money(product.minAcceptablePrice)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <DetailSection title="Description" description={product.description || "No product description."}>
              <DefinitionGrid
                columns={2}
                items={[
                  { label: "Source market", value: product.sourceMarket?.name || product.marketName || "Not linked" },
                  { label: "Vendor", value: product.sourceMarketVendor?.businessName || product.sourceMarketVendorName || product.vendor?.businessName || "None" },
                  { label: "Category", value: product.category?.name || "Uncategorized" },
                  {
                    label: "Colors",
                    value: (product.colors || []).length ? (
                      <div className="flex flex-wrap gap-2">
                        {(product.colors || []).map((color) => (
                          <span key={color} className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600">
                            <ColorLabel value={color} swatchClassName="size-4" />
                          </span>
                        ))}
                      </div>
                    ) : "None",
                  },
                  { label: "Sizes", value: product.sizes?.join(", ") || "None" },
                  { label: "Availability", value: <StatusBadge status={product.availabilityStatus || product.status} /> },
                ]}
              />
            </DetailSection>

            <DetailSection
              title={`In Charge — ${product.category?.name || "Category"}`}
              description="Who to contact about this product's category."
              action={<UserCheck size={15} className="text-zinc-400" />}
            >
              {!product.categoryManagers?.length ? (
                <p className="rounded-md border border-dashed border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-400">
                  No manager assigned to this category yet.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {product.categoryManagers.map((manager) => (
                    <div
                      key={manager.id}
                      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-900">
                        {managerInitials(manager)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-zinc-900">{managerName(manager)}</p>
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            manager.role === "admin" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                          }`}>
                            {manager.role}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                          {manager.phone && (
                            <a href={`tel:${manager.phone}`} className="flex items-center gap-1 hover:text-zinc-900">
                              <Phone size={10} /> {manager.phone}
                            </a>
                          )}
                          <a href={`mailto:${manager.email}`} className="flex min-w-0 items-center gap-1 hover:text-zinc-900">
                            <Mail size={10} /> <span className="truncate">{manager.email}</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DetailSection>

            <DetailSection title="Gallery" action={<Eye size={15} className="text-zinc-400" />}>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {(product.images || []).slice(0, 8).map((src, index) => (
                  <button key={`${src}-${index}`} type="button" onClick={() => setPreviewImage(absoluteImageUrl(src))} className="group relative aspect-square overflow-hidden rounded-md border border-zinc-200 bg-zinc-100" aria-label={`Preview ${product.title} image ${index + 1}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={absoluteImageUrl(src)} alt={product.title} className="size-full object-cover transition duration-300 group-hover:scale-[1.04]" />
                    <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100"><Eye size={16} /></span>
                  </button>
                ))}
                {!product.images?.length && <div className="col-span-full rounded-md border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">No images uploaded.</div>}
              </div>
            </DetailSection>
          </div>

          <ProductLifecycleWorkspace product={product} onSaved={() => query.refetch()} />
        </div>
      )}
      {product && (
        <AdminWorkflowSheet
          open={editing}
          onOpenChange={(open) => {
            if (!open && !updateProduct.isPending) setEditing(false);
          }}
          title="Edit product"
          description="Update catalog copy, commercial pricing, availability, variants, and media. Pricing rules are validated by the backend."
          footer={(
            <>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={updateProduct.isPending}>
                Cancel
              </Button>
              <Button type="submit" form="product-edit-form" variant="brand" disabled={updateProduct.isPending}>
                {updateProduct.isPending ? <HookLoader size="button" label="Saving..." /> : "Save changes"}
              </Button>
            </>
          )}
        >
            <TooltipProvider>
            <form
              id="product-edit-form"
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const payload = Object.fromEntries(formData.entries());
                await updateProduct.mutateAsync({
                  title: payload.title,
                  description: payload.description,
                  categoryId: editCategoryId,
                  marketId: editMarketId,
                  sourceMarketVendorId: editVendorId === NO_VENDOR ? "" : editVendorId,
                  costPrice: Number(payload.costPrice || 0),
                  sellingPrice: Number(payload.sellingPrice || 0),
                  minAcceptablePrice: Number(payload.minAcceptablePrice || 0),
                  quantity: Number(payload.quantity || 0),
                  images: editImages,
                  colors: editColors,
                  sizes: String(payload.sizes || "").split(",").map((item) => item.trim()).filter(Boolean),
                  status: editStatus,
                });
                query.refetch();
                setEditing(false);
              }}
            >
              <Field className="sm:col-span-2"><FieldLabel>Title</FieldLabel><Input name="title" defaultValue={product.title} required /></Field>
              <Field><FieldLabel>Category</FieldLabel><Select value={editCategoryId} onValueChange={setEditCategoryId} required><SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{(categories.data?.data || []).filter((item) => item.isActive !== false).map((item) => <SelectItem key={item.publicId || item.id} value={item.publicId || item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field>
              <Field><FieldLabel>Market</FieldLabel><Select value={editMarketId} onValueChange={(value) => { setEditMarketId(value); setEditVendorId(NO_VENDOR); }} required><SelectTrigger className="w-full"><SelectValue placeholder="Select active Market" /></SelectTrigger><SelectContent>{(markets.data?.data || []).filter((item) => item.status === "active").map((item) => <SelectItem key={item.publicId || item.id} value={item.publicId || item.id}>{item.name}{item.stateName || item.state?.name ? ` · ${item.stateName || item.state?.name}` : ""}</SelectItem>)}</SelectContent></Select></Field>
              <Field className="sm:col-span-2">
                <FieldLabel>Vendor</FieldLabel>
                <Select value={editVendorId} onValueChange={setEditVendorId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={vendors.isLoading ? "Loading vendors…" : "Select a vendor"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VENDOR}>None — no vendor for this product</SelectItem>
                    {(vendors.data || []).map((item) => (
                      <SelectItem key={item.publicId || item.id} value={item.publicId || item.id}>
                        {item.businessName}{item.status && item.status !== "active" ? ` (${item.status})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>Only vendors from the selected Market can supply this product.</FieldDescription>
              </Field>
              <Field className="sm:col-span-2"><FieldLabel>Description</FieldLabel><Textarea name="description" defaultValue={product.description} required minLength={20} className="min-h-20" /></Field>
              <Field><PriceLabel help="What Hook pays for this item. Negotiation can never go below this.">Cost Price</PriceLabel><Input name="costPrice" type="number" min="1" defaultValue={String(product.costPrice)} /></Field>
              <Field><PriceLabel help="The customer-facing price on Hook.">Hook Platform Price</PriceLabel><Input name="sellingPrice" type="number" min="1" defaultValue={String(product.sellingPrice)} /></Field>
              <Field><PriceLabel help="Lowest price AI negotiation can accept. It must not exceed the Hook platform price.">Negotiation Floor</PriceLabel><Input name="minAcceptablePrice" type="number" min="1" defaultValue={String(product.minAcceptablePrice)} /></Field>
              <Field><FieldLabel>Stock</FieldLabel><Input name="quantity" type="number" min="0" defaultValue={String(product.quantity)} /></Field>
              <Field><FieldLabel>Visibility</FieldLabel><Select value={editStatus} onValueChange={setEditStatus}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="published">Active on Hook</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="paused">Paused</SelectItem><SelectItem value="unpublished">Unpublished</SelectItem><SelectItem value="disabled">Disabled</SelectItem></SelectContent></Select></Field>
              <Field className="sm:col-span-2"><FieldLabel>Colors</FieldLabel><div className="flex flex-wrap items-center gap-2">{editColors.map((color) => <button key={color} type="button" onClick={() => setEditColors((current) => current.filter((item) => item !== color))} className="flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-600" title={`Remove ${color}`}><span className="size-4 rounded-full border border-zinc-300" style={{ backgroundColor: color }} /><span className="font-mono">{color}</span><X size={12} /></button>)}<input value={editColorValue} onChange={(event) => setEditColorValue(event.target.value.toUpperCase())} type="color" className="h-9 w-11 rounded-md border border-zinc-200 bg-white p-1" aria-label="Pick product color" /><Button type="button" variant="outline" size="sm" onClick={() => setEditColors((current) => current.includes(editColorValue) ? current : [...current, editColorValue])}>Add color</Button></div></Field>
              <Field><FieldLabel>Sizes</FieldLabel><Input name="sizes" defaultValue={(product.sizes || []).join(", ")} /></Field>
              <div className="sm:col-span-2">
                <MediaPicker
                  value={editImages}
                  onChange={setEditImages}
                  label="Product Images"
                  description="Upload replacement images to Cloudinary or add image links. The first image is the catalog thumbnail."
                />
              </div>
            </form>
            </TooltipProvider>
        </AdminWorkflowSheet>
      )}
      <ImagePreviewDialog open={Boolean(previewImage)} onOpenChange={(open) => { if (!open) setPreviewImage(null); }} src={previewImage} alt={product?.title || "Product image"} />

      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!open && !deleting) setDeleteOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this product?</DialogTitle>
            <DialogDescription>
              {product ? `"${product.title}" will be permanently removed from the catalog. This cannot be undone.` : "This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void deleteProduct()} disabled={deleting}>
              {deleting ? <HookLoader size="button" /> : "Delete product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
