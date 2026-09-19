"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, MessageSquareWarning, Play, X } from "lucide-react";
import { apiPost } from "@/lib/api";
import { money, type ProductSubmission } from "@/lib/catalog";
import { useApiQuery } from "@/lib/query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CatalogStatusBadge } from "@/components/catalog/CatalogStatusBadge";
import { AdminWorkflowSheet } from "@/components/shared/AdminWorkflowSheet";
import { HookLoader } from "@/components/shared/HookLoader";
import { PageHeader } from "@/components/shared/PageHeader";
import { QueryState } from "@/components/shared/QueryState";
import { DetailSection } from "@/components/shared/DetailSection";
import { DefinitionGrid } from "@/components/shared/DefinitionGrid";
import { MediaPicker } from "@/components/shared/MediaPicker";
import {
  csv,
  ProductFieldsForm,
  type CategoryOption,
  type ProductFieldsValue,
} from "@/components/products/ProductFieldsForm";

type Decision = "request-changes" | "reject";

export default function ProductSubmissionReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const query = useApiQuery<ProductSubmission>(["admin", "product-submissions", id], `/admin/catalog/review/${id}`);
  const item = query.data;

  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function startReview() {
    if (!item) return;
    setPending(true);
    try {
      await apiPost(`/admin/catalog/review/${id}/start`, { version: item.version });
      toast.success("Review started");
      await query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Review could not be started");
    } finally {
      setPending(false);
    }
  }

  async function decideSecondary() {
    if (!decision || !item) return;
    setPending(true);
    try {
      await apiPost(`/admin/catalog/review/${id}/${decision}`, { version: item.version, reason, fields: [] });
      toast.success(decision === "reject" ? "Submission rejected" : "Changes requested");
      setDecision(null);
      router.push("/dashboard/product-submissions");
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Decision could not be saved");
    } finally {
      setPending(false);
    }
  }

  const canDecide = item?.status === "in_review";

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        title={item?.basicTitle || "Product submission"}
        description={item ? `${item.publicId} · Captured by a Market Associate` : "Review a Market Associate capture"}
        actions={<><Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft /> Back</Button>{item ? <CatalogStatusBadge status={item.status} /> : null}</>}
      />
      <QueryState loading={query.isLoading} error={query.error} loadingLabel="Loading submission" errorTitle="Submission unavailable" onRetry={() => query.refetch()}>
        {item ? (
          <div className="space-y-4">
            <SubmissionPhotoReview item={item} />
            <DetailSection title="Captured by the Market Associate" description="Read-only — this is what was submitted from the field.">
              <DefinitionGrid items={[
                { label: "Observed price", value: money(item.basePriceMinor, item.currency) },
                { label: "Availability", value: item.availabilityStatus },
                { label: "Market", value: item.market?.name || item.marketId },
                { label: "Suggested category", value: item.category?.name || item.categorySuggestionId },
                { label: "Source vendor", value: item.marketVendor?.businessName || "Not specified" },
                { label: "Market Associate notes", value: item.notes || "No notes supplied", span: 2 },
              ]} />
            </DetailSection>

            {item.status === "submitted" ? (
              <Card className="rounded-lg shadow-none">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <p className="text-sm text-muted-foreground">Start review to complete the product details and make a decision.</p>
                  <Button onClick={() => void startReview()} disabled={pending}>
                    {pending ? <HookLoader size="button" /> : <><Play /> Start review</>}
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {canDecide ? (
              <SubmissionApprovalForm
                key={item.publicId}
                item={item}
                id={id}
                pending={pending}
                setPending={setPending}
                onRequestChanges={() => setDecision("request-changes")}
                onReject={() => setDecision("reject")}
                onApproved={(productId) => router.push(productId ? `/dashboard/products/${productId}` : "/dashboard/product-submissions")}
              />
            ) : null}
          </div>
        ) : null}
      </QueryState>
      <AdminWorkflowSheet
        open={Boolean(decision)}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setDecision(null);
            setReason("");
          }
        }}
        title={decision === "reject" ? "Reject submission" : "Request changes"}
        description="Give a clear operational reason. This decision is version-checked and audited."
        footer={(
          <>
            <Button variant="outline" disabled={pending} onClick={() => { setDecision(null); setReason(""); }}>Cancel</Button>
            <Button type="submit" form="submission-decision-form" variant={decision === "reject" ? "destructive" : "brand"} disabled={pending || reason.trim().length < 5}>
              {pending ? <HookLoader size="button" /> : "Confirm decision"}
            </Button>
          </>
        )}
      >
        <form id="submission-decision-form" onSubmit={(event) => { event.preventDefault(); void decideSecondary(); }} className="space-y-4">
          <Textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason and actionable feedback" className="min-h-32" maxLength={1000} />
          <p className="text-xs leading-5 text-muted-foreground">Use specific feedback when requesting changes so the Market Associate can resolve the submission without another review cycle.</p>
        </form>
      </AdminWorkflowSheet>
    </div>
  );
}

function orderedSubmissionMedia(item: ProductSubmission) {
  const byId = new Map((item.media || []).map((asset) => [asset.publicId, asset]));
  const roles = ["front", "side", "back"] as const;
  const explicit = roles.map((role) => ({ role, asset: item.mediaViews?.[role] ? byId.get(item.mediaViews[role]!) : undefined }));
  if (explicit.some(({ asset }) => asset)) return explicit;
  return roles.map((role, index) => ({ role, asset: item.media?.[index] }));
}

function SubmissionPhotoReview({ item }: { item: ProductSubmission }) {
  const photos = orderedSubmissionMedia(item);
  return (
    <DetailSection
      title="Required product views"
      description="Verify that the front, side, and back photos show the same product clearly before starting review."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {photos.map(({ role, asset }) => {
          const src = asset?.deliveryUrl || asset?.secureUrl;
          return (
            <div key={role} className="overflow-hidden rounded-lg border bg-muted/30">
              <div className="relative aspect-[4/3] bg-muted">
                {src ? (
                  <Image src={src} alt={`${role} view of ${item.basicTitle}`} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" unoptimized />
                ) : (
                  <div className="grid size-full place-items-center text-xs font-medium text-muted-foreground">Photo unavailable</div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-xs font-semibold capitalize">{role} view</span>
                {role === "front" ? <span className="rounded-full bg-[#FFF3C4] px-2 py-0.5 text-[10px] font-semibold text-[#765900]">Primary</span> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${item.captureChecklistConfirmed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
        {item.captureChecklistConfirmed ? <Check className="size-4" /> : <MessageSquareWarning className="size-4" />}
        {item.captureChecklistConfirmed
          ? "Market Associate confirmed the three-view capture guidelines."
          : "Legacy capture: the three-view confirmation was not recorded."}
      </div>
    </DetailSection>
  );
}

/**
 * The full "complete and approve" form. Mounted fresh per submission (parent
 * keys it by `item.publicId`), so its field state can simply initialize from
 * the submission — including the Market Associate's own category and market
 * suggestions — with no effect needed to prime it after the fact.
 */
function SubmissionApprovalForm({
  item,
  id,
  pending,
  setPending,
  onRequestChanges,
  onReject,
  onApproved,
}: {
  item: ProductSubmission;
  id: string;
  pending: boolean;
  setPending: (value: boolean) => void;
  onRequestChanges: () => void;
  onReject: () => void;
  onApproved: (productId?: string) => void;
}) {
  const categories = useApiQuery<{ data: CategoryOption[] }>(["admin", "categories", "options"], "/admin/categories");
  // Market options aren't fetched here — the Market field is locked to the
  // submission's own market, so there's nothing to pick from.
  const [images, setImages] = useState<string[]>(
    orderedSubmissionMedia(item).map(({ asset }) => asset?.deliveryUrl || asset?.secureUrl || "").filter(Boolean),
  );
  const [colorValue, setColorValue] = useState("#fbbf24");

  // Colors and sizes the Market Associate captured live on each variant, not
  // as top-level fields — derive the deduplicated set so nothing they entered
  // in the field gets lost.
  const capturedColors = Array.from(
    new Set((item.variants || []).map((variant) => variant.colour?.trim()).filter((value): value is string => Boolean(value))),
  );
  const capturedSizes = Array.from(
    new Set((item.variants || []).map((variant) => variant.size?.trim()).filter((value): value is string => Boolean(value))),
  );

  const [fields, setFields] = useState<ProductFieldsValue>({
    categoryId: item.categorySuggestionId,
    marketId: item.marketId,
    status: "published",
    colors: capturedColors.length ? capturedColors : ["#111827", "#ffffff"],
  });

  async function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    setPending(true);
    try {
      const approved = await apiPost<{ approvedProduct?: { publicId: string } }>(
        `/admin/catalog/review/${id}/approve`,
        {
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
          version: item.version,
        },
      );
      toast.success(fields.status === "published" ? "Product approved and activated" : "Product approved as draft");
      onApproved(approved.approvedProduct?.publicId);
    } catch (error) {
      const details = (error as { details?: { fields?: string[] } })?.details;
      if (details?.fields?.length) {
        toast.error(`Missing before approving: ${details.fields.join(", ")}`);
      } else {
        toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Submission could not be approved");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={approve}>
      <Card className="max-w-6xl rounded-lg border-zinc-200 py-0 shadow-card">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_360px]">
          <ProductFieldsForm
            categories={categories.data?.data || []}
            markets={[]}
            value={fields}
            onChange={(next) => setFields((current) => ({ ...current, ...next }))}
            colorValue={colorValue}
            onColorValueChange={setColorValue}
            lockedMarketName={item.market?.name}
            defaults={{
              title: item.basicTitle,
              quantity: 0,
              sizes: capturedSizes.join(", "),
            }}
          />
          <MediaPicker
            value={images}
            onChange={setImages}
            label="Product Images"
            description="Carried over from the Market Associate's capture — add, remove, or replace before activating."
            className="lg:sticky lg:top-4 lg:self-start"
          />
          <div className="flex flex-wrap items-center justify-end gap-2 lg:col-span-2">
            <Button type="button" variant="outline" disabled={pending} onClick={onRequestChanges}>
              <MessageSquareWarning /> Request changes
            </Button>
            <Button type="button" variant="outline" className="text-destructive" disabled={pending} onClick={onReject}>
              <X /> Reject
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? <HookLoader size="button" /> : <><Check /> {fields.status === "published" ? "Approve & activate" : "Approve as draft"}</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
