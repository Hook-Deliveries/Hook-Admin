"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Camera, Check, ChevronDown, ChevronUp, ImagePlus, Package, Plus, Ruler, Save, Send, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { money, type ProductSubmission } from "@/lib/catalog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HookLoader } from "@/components/shared/HookLoader";
import { MobileButton } from "@/components/mobile/MobileUI";
import { ACTION_BAR_BUTTON, StickyActionBar } from "@/components/mobile/StickyActionBar";
import { APP_ACTION_BAR_CONTENT_INSET } from "@/lib/tab-bar-layout";
import { cn } from "@/lib/utils";
import { ColorPicker } from "@/components/mobile/ColorPicker";
import { SizePicker } from "@/components/mobile/SizePicker";
import type { SizingGuide } from "@/lib/sizing-guide";

interface MarketOption { publicId: string; name: string }
interface MarketVendorOption { publicId: string; businessName: string; contactName: string; status: string }
interface CategoryOption { publicId: string; name: string; sizingGuide?: SizingGuide | null }
interface UploadIntent {
  uploadIntentId: string;
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  publicId: string;
  type: string;
  signature: string;
}

interface MediaReadiness {
  provider: "cloudinary";
  mode: "signed";
  enabled: boolean;
  configured: boolean;
  available: boolean;
  maxBytes: number;
  supportedFormats: string[];
}

interface FormState {
  marketId: string;
  marketVendorId: string;
  categorySuggestionId: string;
  basicTitle: string;
  notes: string;
  basePrice: string;
  mediaIds: string[];
  mediaViews: { front?: string; side?: string; back?: string };
  captureChecklistConfirmed: boolean;
  availabilityStatus: string;
  availabilityNote: string;
  internalSellerReference: string;
  variants: Array<{ size: string; colour: string; attributes: Record<string, string>; active: boolean }>;
}

const submissionFieldLabels: Record<string, string> = {
  frontSideBackPhotos: "front, side, and back photos",
  captureChecklistConfirmed: "photo-guideline confirmation",
  basicTitle: "product title",
  categorySuggestionId: "category",
  basePriceMinor: "observed price",
  variants: "size or colour",
};

function initialValue(submission?: ProductSubmission): FormState {
  const mediaViews = submission?.mediaViews && Object.keys(submission.mediaViews).length
    ? submission.mediaViews
    : {
        front: submission?.mediaIds?.[0],
        side: submission?.mediaIds?.[1],
        back: submission?.mediaIds?.[2],
      };
  return {
    marketId: submission?.marketId || "",
    marketVendorId: submission?.marketVendorId || "",
    categorySuggestionId: submission?.categorySuggestionId || "",
    basicTitle: submission?.basicTitle || "",
    notes: submission?.notes || "",
    basePrice: submission ? String(submission.basePriceMinor / 100) : "",
    mediaIds: submission?.mediaIds || [],
    mediaViews,
    captureChecklistConfirmed: submission?.captureChecklistConfirmed || false,
    availabilityStatus: submission?.availabilityStatus || "available",
    availabilityNote: submission?.availabilityNote || "",
    internalSellerReference: submission?.internalSellerReference || "",
    variants: submission?.variants?.map((item) => ({
      size: item.size || "",
      colour: item.colour || "",
      attributes: item.attributes || {},
      active: item.active,
    })) || [{ size: "", colour: "", attributes: {}, active: true }],
  };
}

export function MarketAssociateSubmissionForm({
  submission,
  markets,
  categories,
}: {
  submission?: ProductSubmission;
  markets: MarketOption[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => initialValue(submission));
  const [mediaById, setMediaById] = useState<Record<string, { deliveryUrl?: string; width?: number; height?: number }>>(
    () => Object.fromEntries((submission?.media || []).map((item) => [item.publicId, item])),
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sizingGuideExpanded, setSizingGuideExpanded] = useState(false);
  const editable = !submission || ["draft", "changes_requested"].includes(submission.status);
  const selectedCategory = categories.find((category) => category.publicId === form.categorySuggestionId);
  const sizingGuide = selectedCategory?.sizingGuide;
  const mediaReadiness = useQuery({
    queryKey: ["catalog-media-readiness"],
    queryFn: () => apiGet<MediaReadiness>("/catalog/media/readiness"),
    staleTime: 60_000,
    retry: 1,
  });
  const vendors = useQuery({
    queryKey: ["marketassociate", "market-vendors", form.marketId],
    queryFn: () => apiGet<MarketVendorOption[]>(`/market-associate/markets/${encodeURIComponent(form.marketId)}/vendors`),
    enabled: editable && Boolean(form.marketId),
    staleTime: 30_000,
  });
  const mediaAvailable = mediaReadiness.data?.available === true;
  const requiredPhotoIds = [form.mediaViews.front, form.mediaViews.side, form.mediaViews.back];
  const photosComplete = requiredPhotoIds.every(Boolean) && new Set(requiredPhotoIds).size === 3;

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  const payload = useMemo(() => ({
    marketId: form.marketId,
    marketVendorId: form.marketVendorId,
    categorySuggestionId: form.categorySuggestionId,
    basicTitle: form.basicTitle.trim(),
    notes: form.notes.trim() || undefined,
    mediaIds: form.mediaIds,
    mediaViews: form.mediaViews,
    captureChecklistConfirmed: form.captureChecklistConfirmed,
    basePriceMinor: Math.round(Number(form.basePrice) * 100),
    currency: "NGN",
    variants: form.variants.filter((variant) => variant.size || variant.colour),
    availabilityStatus: form.availabilityStatus,
    availabilityNote: form.availabilityNote.trim() || undefined,
    internalSellerReference: form.internalSellerReference.trim() || undefined,
    ...(submission ? { version: submission.version } : {}),
  }), [form, submission]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  async function save(submitAfter = false) {
    if (submitAfter) {
      const requiredPhotos = [form.mediaViews.front, form.mediaViews.side, form.mediaViews.back];
      if (requiredPhotos.some((id) => !id) || new Set(requiredPhotos).size !== 3) {
        toast.error("Take a clear front, side, and back photo before submitting");
        return;
      }
      if (!form.captureChecklistConfirmed) {
        toast.error("Confirm that the three product-photo guidelines were followed");
        return;
      }
      // A variant needs size, colour, or an attribute — mirrors the backend's
      // own submit-time check, so the Market Associate sees this before the round trip,
      // not as a generic "could not be saved" toast after the fact.
      const hasCompleteVariant = form.variants.some(
        (variant) => variant.size.trim() || variant.colour.trim() || Object.keys(variant.attributes).length,
      );
      if (!hasCompleteVariant) {
        toast.error("Add at least one size or colour before submitting for review");
        return;
      }
    }
    setSaving(true);
    try {
      const saved = submission
        ? await apiPatch<ProductSubmission>(`/market-associate/product-submissions/${submission.publicId}`, payload)
        : await apiPost<ProductSubmission>("/market-associate/product-submissions", payload);
      // The submit call returns the promoted record, so prefer it over the draft
      // we just saved — that is what carries the new status.
      let latest = saved;
      if (submitAfter) {
        latest =
          (await apiPost<ProductSubmission>(
            `/market-associate/product-submissions/${saved.publicId}/submit`,
            { version: saved.version },
          )) || saved;
        toast.success("Submission sent to Catalog Review");
      } else {
        toast.success("Draft saved");
      }
      setDirty(false);
      // Seed the detail cache so the status badge is correct on arrival, then let
      // the list and dashboard refetch. Without this the pages read a stale cache
      // and keep showing "draft" until they happen to go stale on their own.
      queryClient.setQueryData(["marketassociate", "submission", latest.publicId], latest);
      void queryClient.invalidateQueries({ queryKey: ["marketassociate", "submissions"] });
      void queryClient.invalidateQueries({ queryKey: ["marketassociate", "submission", latest.publicId] });
      void queryClient.invalidateQueries({ queryKey: ["marketassociate", "catalog-dashboard"] });
      router.replace(`/market-associate/submissions/${latest.publicId}`);
    } catch (error) {
      const details = (error as { details?: { fields?: string[] } })?.details;
      if (details?.fields?.length) {
        toast.error(`Missing before submitting: ${details.fields.map((field) => submissionFieldLabels[field] || field).join(", ")}`);
      } else {
        toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Submission could not be saved");
      }
    } finally {
      setSaving(false);
    }
  }

  async function upload(view: "front" | "side" | "back", file?: File) {
    if (!file) return;
    if (!mediaAvailable) {
      toast.error("Secure image uploads are temporarily unavailable");
      return;
    }
    setUploading(true);
    try {
      const intent = await apiPost<UploadIntent>("/catalog/media/upload-intents", {
        ownerType: "submission",
        originalName: file.name,
        mimeType: file.type,
        bytes: file.size,
      });
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", intent.apiKey);
      body.append("timestamp", String(intent.timestamp));
      body.append("folder", intent.folder);
      body.append("public_id", intent.publicId);
      body.append("type", intent.type);
      body.append("signature", intent.signature);
      const providerResponse = await fetch(intent.uploadUrl, { method: "POST", body });
      const provider = await providerResponse.json();
      if (!providerResponse.ok) throw new Error(provider?.error?.message || "Image upload failed");
      const asset = await apiPost<{ publicId: string; deliveryUrl?: string; width?: number; height?: number }>("/catalog/media/finalize", {
        uploadIntentId: intent.uploadIntentId,
        providerPublicId: provider.public_id,
        version: String(provider.version),
        ownerType: "submission",
      });
      setMediaById((current) => ({ ...current, [asset.publicId]: asset }));
      setForm((current) => {
        const mediaViews = { ...current.mediaViews, [view]: asset.publicId };
        return {
          ...current,
          mediaViews,
          mediaIds: [mediaViews.front, mediaViews.side, mediaViews.back].filter((id): id is string => Boolean(id)),
          captureChecklistConfirmed: false,
        };
      });
      setDirty(true);
      toast.success(`${view[0].toUpperCase()}${view.slice(1)} view uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  const noVendors = Boolean(form.marketId && !vendors.isLoading && !vendors.data?.length);

  return (
    <div style={{ paddingBottom: editable ? APP_ACTION_BAR_CONTENT_INSET : 16 }}>
      {submission?.reviewNotes?.length ? (
        <div className="mb-6 rounded-[10px] bg-[#FFF3C4] p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#9a7400]">
            <AlertCircle className="size-4" /> Catalog Review feedback
          </p>
          <div className="mt-2 space-y-1.5">
            {submission.reviewNotes.slice().reverse().map((note, index) => (
              <p key={`${note.createdAt}-${index}`} className="text-[13px] leading-5 text-black">
                <span className="font-semibold capitalize">{note.action.replaceAll("_", " ")}</span>
                {note.message ? `: ${note.message}` : ""}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {submission?.approvedProduct ? (
        <div className="mb-6 grid gap-3 rounded-[10px] border border-emerald-200 bg-emerald-50 p-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-bold uppercase text-emerald-700">Market Associate observed</p>
            <p className="mt-1 text-[16px] font-bold text-black">{money(submission.basePriceMinor, submission.currency)}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-emerald-700">Approved Hook price</p>
            <p className="mt-1 text-[16px] font-bold text-black">{money(submission.approvedProduct.sellingPriceMinor, submission.approvedProduct.currency)}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-emerald-700">Catalog status</p>
            <p className="mt-1 text-[16px] font-bold capitalize text-black">{submission.approvedProduct.status.replaceAll("_", " ")}</p>
          </div>
        </div>
      ) : null}

      {/* Photos first — this is a guided field capture, not a generic gallery. */}
      <FormBlock title="Product photos" hint="Capture exactly three views. The front view becomes the primary catalog image.">
        {mediaReadiness.isError || (mediaReadiness.isSuccess && !mediaAvailable) ? (
          <Alert className="mb-3">
            <AlertCircle />
            <AlertTitle>Secure uploads unavailable</AlertTitle>
            <AlertDescription>
              Draft media is safe. Save the draft and upload once the media service is restored.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="rounded-[12px] bg-[#FFF8DF] p-3">
          <p className="flex items-center gap-2 text-[13px] font-bold text-black"><Camera className="size-4" /> How to photograph the product</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <PhotoGuide label="Front" detail="Face the product" position="front" />
            <PhotoGuide label="Side" detail="Show its profile" position="side" />
            <PhotoGuide label="Back" detail="Show the rear" position="back" />
          </div>
          <p className="mt-3 text-[11px] leading-4 text-[#6f5a12]">Use a clean background, fill the frame, keep the whole product visible, and avoid blur, glare, filters, or people.</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(["front", "side", "back"] as const).map((view) => (
            <CaptureSlot
              key={view}
              view={view}
              mediaId={form.mediaViews[view]}
              asset={form.mediaViews[view] ? mediaById[form.mediaViews[view]!] : undefined}
              editable={editable}
              available={mediaAvailable}
              uploading={uploading || mediaReadiness.isLoading}
              onUpload={(file) => void upload(view, file)}
              onRemove={() => {
                setForm((current) => {
                  const mediaViews = { ...current.mediaViews, [view]: undefined };
                  return {
                    ...current,
                    mediaViews,
                    mediaIds: [mediaViews.front, mediaViews.side, mediaViews.back].filter((id): id is string => Boolean(id)),
                    captureChecklistConfirmed: false,
                  };
                });
                setDirty(true);
              }}
            />
          ))}
        </div>

        <button
          type="button"
          disabled={!editable || !photosComplete}
          onClick={() => update("captureChecklistConfirmed", !form.captureChecklistConfirmed)}
          className={cn(
            "flex w-full items-start gap-3 rounded-[10px] border p-3 text-left transition",
            form.captureChecklistConfirmed ? "border-[#d4a600] bg-[#FFF3C4]" : "border-[#D9D9D9] bg-white",
            (!editable || !photosComplete) && "cursor-not-allowed opacity-60",
          )}
          aria-pressed={form.captureChecklistConfirmed}
        >
          <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded border", form.captureChecklistConfirmed ? "border-black bg-black text-white" : "border-[#A3A3A6]")}>
            {form.captureChecklistConfirmed && <Check className="size-3.5" />}
          </span>
          <span>
            <span className="block text-[13px] font-semibold text-black">I followed the product photo guidelines</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-[#6B6B6B]">
              {photosComplete ? "I confirm these are clear front, side, and back views of the same product." : "Upload all three required views to enable this confirmation."}
            </span>
          </span>
        </button>
      </FormBlock>

      <FormBlock title="Product">
        <MobileField label="Product title">
          <Input
            disabled={!editable}
            value={form.basicTitle}
            onChange={(event) => update("basicTitle", event.target.value)}
            placeholder="Clear product name"
            className="h-12 rounded-[10px]"
          />
        </MobileField>
        <MobileField label="Observed market price (NGN)">
          <Input
            disabled={!editable}
            inputMode="decimal"
            value={form.basePrice}
            onChange={(event) => update("basePrice", event.target.value.replace(/[^\d.]/g, ""))}
            placeholder="0.00"
            className="h-12 rounded-[10px]"
          />
        </MobileField>
        <MobileField label="Suggested category">
          <Select
            disabled={!editable}
            value={form.categorySuggestionId}
            onValueChange={(value) => {
              update("categorySuggestionId", value);
              setSizingGuideExpanded(false);
            }}
          >
            <SelectTrigger className="h-12 rounded-[10px]"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.publicId} value={category.publicId}>{category.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </MobileField>
        {sizingGuide?.summary ? (
          <div className="rounded-[10px] bg-[#FFF9E6] p-3">
            <div className="flex items-start gap-2">
              <Ruler className="mt-0.5 size-4 shrink-0 text-[#9a7400]" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#5a4300]">{sizingGuide.summary}</p>
                {sizingGuide.howToMeasure ? (
                  <button
                    type="button"
                    onClick={() => setSizingGuideExpanded((current) => !current)}
                    className="mt-1.5 flex items-center gap-1 text-[12px] font-semibold text-[#9a7400]"
                  >
                    How to measure
                    {sizingGuideExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </button>
                ) : null}
                {sizingGuideExpanded && sizingGuide.howToMeasure ? (
                  <p className="mt-1.5 whitespace-pre-line text-[12px] leading-5 text-[#5a4300]">
                    {sizingGuide.howToMeasure}
                  </p>
                ) : null}
                {sizingGuideExpanded && sizingGuide.chart?.length ? (
                  <div className="mt-2 space-y-1 overflow-hidden rounded-[8px] bg-white/70">
                    {sizingGuide.chart.map((row) => (
                      <div key={row.size} className="flex flex-wrap gap-x-3 gap-y-0.5 px-2.5 py-1.5 text-[12px] text-[#5a4300]">
                        <span className="font-semibold">{row.size}</span>
                        {Object.entries(row.measurements).map(([label, value]) => (
                          <span key={label} className="text-[#7a6000]">
                            {label}: {value}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        <MobileField label="Capture notes">
          <Textarea
            disabled={!editable}
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Materials, condition, distinguishing details, and seller context."
            className="min-h-28 rounded-[10px]"
          />
        </MobileField>
      </FormBlock>

      <FormBlock title="Source" hint="Where you collected this product from.">
        <MobileField label="Assigned Market">
          <Select
            disabled={!editable}
            value={form.marketId}
            onValueChange={(value) => {
              setForm((current) => ({ ...current, marketId: value, marketVendorId: "" }));
              setDirty(true);
            }}
          >
            <SelectTrigger className="h-12 rounded-[10px]"><SelectValue placeholder="Select Market" /></SelectTrigger>
            <SelectContent>
              {markets.map((market) => (
                <SelectItem key={market.publicId} value={market.publicId}>{market.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </MobileField>
        <MobileField
          label="Source supplier"
          error={noVendors ? "No suppliers yet in this Market." : undefined}
        >
          <Select
            disabled={!editable || !form.marketId || vendors.isLoading}
            value={form.marketVendorId}
            onValueChange={(value) => update("marketVendorId", value)}
          >
            <SelectTrigger className="h-12 rounded-[10px]">
              <SelectValue placeholder={vendors.isLoading ? "Loading suppliers" : "Select supplier"} />
            </SelectTrigger>
            <SelectContent>
              {(vendors.data || []).map((vendor) => (
                <SelectItem key={vendor.publicId} value={vendor.publicId}>
                  {vendor.businessName} · {vendor.contactName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {noVendors && (
            <Link
              href={`/market-associate/markets/${form.marketId}`}
              className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-[#9a7400]"
            >
              <UserPlus className="size-3.5" /> Onboard a supplier for this Market
            </Link>
          )}
        </MobileField>
        <MobileField label="Seller reference (internal)">
          <Input
            disabled={!editable}
            value={form.internalSellerReference}
            onChange={(event) => update("internalSellerReference", event.target.value)}
            placeholder="Stall or contact reference"
            className="h-12 rounded-[10px]"
          />
        </MobileField>
        <MobileField label="Availability">
          <Select disabled={!editable} value={form.availabilityStatus} onValueChange={(value) => update("availabilityStatus", value)}>
            <SelectTrigger className="h-12 rounded-[10px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="limited">Limited</SelectItem>
              <SelectItem value="unconfirmed">Unconfirmed</SelectItem>
            </SelectContent>
          </Select>
        </MobileField>
      </FormBlock>

      <FormBlock
        title="Variants"
        hint="Required — add at least one size, colour, or both."
        action={
          editable ? (
            <button
              type="button"
              onClick={() => update("variants", [...form.variants, { size: "", colour: "", attributes: {}, active: true }])}
              className="flex items-center gap-1 text-[13px] font-semibold text-[#9a7400]"
            >
              <Plus className="size-3.5" /> Add
            </button>
          ) : undefined
        }
      >
        <div className="space-y-2">
          {form.variants.map((variant, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <SizePicker
                disabled={!editable}
                value={variant.size}
                groups={sizingGuide?.presetGroups}
                onChange={(next) =>
                  update("variants", form.variants.map((item, itemIndex) => (itemIndex === index ? { ...item, size: next } : item)))
                }
              />
              <ColorPicker
                disabled={!editable}
                value={variant.colour}
                onChange={(next) =>
                  update("variants", form.variants.map((item, itemIndex) => (itemIndex === index ? { ...item, colour: next } : item)))
                }
              />
              <button
                type="button"
                disabled={!editable || form.variants.length === 1}
                onClick={() => update("variants", form.variants.filter((_, itemIndex) => itemIndex !== index))}
                className="grid size-12 place-items-center rounded-[10px] bg-[#EAEBE7] disabled:opacity-40"
                aria-label="Remove variant"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </FormBlock>

      {editable ? (
        <StickyActionBar>
          <MobileButton
            variant="outline"
            disabled={saving || uploading}
            onClick={() => void save(false)}
            className={cn(ACTION_BAR_BUTTON, "w-auto shrink-0 border-0 px-4")}
          >
            <Save size={16} /> Draft
          </MobileButton>
          <MobileButton
            disabled={saving || uploading}
            onClick={() => void save(true)}
            className={cn(ACTION_BAR_BUTTON, "flex-1")}
          >
            {saving ? <HookLoader size="button" /> : <><Send size={16} /> Submit for review</>}
          </MobileButton>
        </StickyActionBar>
      ) : null}
    </div>
  );
}

const viewLabels = { front: "Front", side: "Side", back: "Back" } as const;

function PhotoGuide({
  label,
  detail,
  position,
}: {
  label: string;
  detail: string;
  position: keyof typeof viewLabels;
}) {
  return (
    <div className="rounded-[9px] bg-white px-2 py-2.5 text-center">
      <span className="relative mx-auto grid h-10 w-14 place-items-center rounded-[7px] border border-dashed border-[#D4B33E] bg-[#FFFDF5]">
        <Package
          className={cn(
            "size-6 text-black",
            position === "side" && "scale-x-75",
            position === "back" && "-scale-x-100 opacity-70",
          )}
          strokeWidth={1.6}
          aria-hidden
        />
        <span className="absolute inset-x-1 bottom-1 h-px bg-[#FFC809]" />
      </span>
      <span className="mt-1.5 block text-[11px] font-bold text-black">{label}</span>
      <span className="block text-[9px] leading-3 text-[#8F8F8F]">{detail}</span>
    </div>
  );
}

function CaptureSlot({
  view,
  mediaId,
  asset,
  editable,
  available,
  uploading,
  onUpload,
  onRemove,
}: {
  view: keyof typeof viewLabels;
  mediaId?: string;
  asset?: { deliveryUrl?: string; width?: number; height?: number };
  editable: boolean;
  available: boolean;
  uploading: boolean;
  onUpload: (file?: File) => void;
  onRemove: () => void;
}) {
  const label = viewLabels[view];
  return (
    <div>
      <label
        className={cn(
          "group relative flex aspect-[4/5] overflow-hidden rounded-[10px] border-2 bg-[#F7F7F7]",
          mediaId ? "border-[#FFC809]" : "border-dashed border-[#D9D9D9]",
          editable && available && !uploading ? "cursor-pointer" : "cursor-not-allowed opacity-70",
        )}
      >
        {asset?.deliveryUrl ? (
          <Image src={asset.deliveryUrl} alt={`${label} view of the product`} fill sizes="160px" className="object-cover" unoptimized />
        ) : mediaId || uploading ? (
          <span className="flex size-full items-center justify-center"><HookLoader size="inline" /></span>
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 px-1 text-center text-[#8F8F8F]">
            <ImagePlus className="size-5" />
            <span className="text-[10px] font-semibold">Add {label.toLowerCase()}</span>
          </span>
        )}
        <span className="absolute inset-x-1.5 bottom-1.5 rounded-full bg-black/75 px-1.5 py-1 text-center text-[9px] font-bold text-white">
          {label}{view === "front" ? " · Primary" : ""}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          disabled={!editable || uploading || !available}
          onChange={(event) => {
            onUpload(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {editable && mediaId ? (
        <button type="button" onClick={onRemove} className="mt-1 flex w-full items-center justify-center gap-1 text-[10px] font-semibold text-red-600" aria-label={`Remove ${label.toLowerCase()} photo`}>
          <Trash2 className="size-3" /> Remove
        </button>
      ) : null}
    </div>
  );
}

function FormBlock({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-[15px] font-semibold text-black">{title}</h2>
          {hint && <p className="mt-0.5 text-[12px] text-[#8F8F8F]">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-4 rounded-[10px] bg-white p-4">{children}</div>
    </section>
  );
}

function MobileField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-semibold">{label}</Label>
      {children}
      {error && <p className="text-[12px] font-medium text-amber-700">{error}</p>}
    </div>
  );
}
