"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useApiPost, useApiQuery } from "@/lib/query";
import { HookLoader } from "@/components/shared/HookLoader";
import { MediaPicker } from "@/components/shared/MediaPicker";
import {
  csv,
  ProductFieldsForm,
  type CategoryOption,
  type MarketOption,
  type ProductFieldsValue,
} from "@/components/products/ProductFieldsForm";

export default function NewProductPage() {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [colorValue, setColorValue] = useState("#fbbf24");
  const [fields, setFields] = useState<ProductFieldsValue>({
    categoryId: "",
    marketId: "",
    status: "published",
    colors: ["#111827", "#ffffff"],
  });
  const categories = useApiQuery<{ data: CategoryOption[] }>(["admin", "categories", "options"], "/admin/categories");
  const markets = useApiQuery<{ data: MarketOption[] }>(["admin", "markets", "product-options"], "/admin/markets?limit=200");
  const createProduct = useApiPost<{ id: string }, Record<string, unknown>>("/admin/products", ["admin", "products"], { successMessage: "Product created" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    const product = await createProduct.mutateAsync({
      ...payload,
      categoryId: fields.categoryId,
      marketId: fields.marketId,
      status: fields.status,
      costPrice: Number(payload.costPrice || 0),
      sellingPrice: Number(payload.sellingPrice || 0),
      minAcceptablePrice: Number(payload.minAcceptablePrice || payload.sellingPrice || 0),
      quantity: Number(payload.quantity || 0),
      images,
      colors: fields.colors,
      sizes: csv(formData.get("sizes")),
    });
    router.push(`/dashboard/products/${product.id}`);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full space-y-5 px-4 py-5">
      <PageHeader
        title="Create Product"
        description="Add inventory to Hook's commercial catalog."
        actions={<Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft size={15} /> Back</Button>}
      />
      <form onSubmit={submit}>
        <Card className="max-w-6xl rounded-lg border-zinc-200 py-0 shadow-card">
          <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_360px]">
            <ProductFieldsForm
              categories={categories.data?.data || []}
              markets={markets.data?.data || []}
              value={fields}
              onChange={(next) => setFields((current) => ({ ...current, ...next }))}
              colorValue={colorValue}
              onColorValueChange={setColorValue}
            />

            <MediaPicker
              value={images}
              onChange={setImages}
              label="Product Images"
              description="Upload product photos to Cloudinary or add direct image links. The first image is used in catalog tables."
              className="lg:sticky lg:top-4 lg:self-start"
            />

            <div className="flex justify-end lg:col-span-2">
              <Button type="submit" variant="brand" disabled={createProduct.isPending}>
                {createProduct.isPending ? <HookLoader size="button" label="Creating..." /> : fields.status === "published" ? "Create & activate" : "Save draft"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
