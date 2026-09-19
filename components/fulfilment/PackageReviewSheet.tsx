"use client";

import Image from "next/image";
import { Check, CheckCircle2, PackageX, TriangleAlert, X } from "lucide-react";
import { AdminWorkflowSheet } from "@/components/shared/AdminWorkflowSheet";
import { HookLoader } from "@/components/shared/HookLoader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RotateCcw, Undo2 } from "lucide-react";
import { colorName } from "@/lib/color-name";
import { money } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export type ReviewItem = {
  orderItemId: string;
  itemReference?: string;
  productTitle?: string;
  orderedPhotoUrl?: string;
  pickedUpPhotoUrl?: string;
  photos?: Array<{ view: string; url: string }>;
  checks?: { productMatches: boolean; sizeMatches: boolean; colorMatches: boolean; quantityMatches: boolean };
  matched?: boolean;
  orderedColor?: string;
  orderedSize?: string;
  orderedQuantity?: number;
  actualColor?: string;
  actualSize?: string;
  actualQuantity?: number;
  unitCostMinor?: number;
  supplierReference?: string;
  conditionNote?: string;
  verifiedAt?: string;
};

export const FAILURE_REASONS: Array<[string, string]> = [
  ["WRONG_PRODUCT", "Wrong product"],
  ["WRONG_SIZE", "Wrong size"],
  ["WRONG_COLOR", "Wrong colour"],
  ["DAMAGED", "Damaged or defective"],
  ["MISSING", "Missing item"],
  ["OTHER", "Other"],
];
const reasonLabel = (value?: string) => FAILURE_REASONS.find(([key]) => key === value)?.[1] || value;

export type FailureDraft = { reason?: string; note?: string };

export type ReviewPackage = {
  publicId?: string;
  qualityChecks?: Array<{ orderItemId?: string; result?: string; reason?: string; note?: string; resolutionId?: string; resourced?: boolean }>;
  status?: string;
  receivedAt?: string;
  hub?: { name?: string } | null;
  order?: { publicId?: string } | null;
  marketAssociate?: { name?: string } | null;
  items?: ReviewItem[];
};

const checkLabels: Array<[keyof NonNullable<ReviewItem["checks"]>, string]> = [
  ["productMatches", "Product"],
  ["sizeMatches", "Size"],
  ["colorMatches", "Colour"],
  ["quantityMatches", "Quantity"],
];

function Compare({ label, ordered, found }: { label: string; ordered?: string | number; found?: string | number }) {
  const same = String(ordered ?? "").toLowerCase() === String(found ?? "").toLowerCase();
  return (
    <div className="grid grid-cols-[5.5rem_1fr_1fr] items-center gap-2 border-t py-2 text-sm first:border-t-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span>{ordered ?? "—"}</span>
      <span className={cn("flex items-center gap-1.5 font-medium", !same && "text-danger")}>
        {found ?? "—"}
        {same ? <Check className="size-3.5 text-success" /> : <TriangleAlert className="size-3.5" />}
      </span>
    </div>
  );
}

function Photo({ src, caption }: { src?: string; caption: string }) {
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className="group block"
      aria-label={`Open ${caption} photo`}
    >
      <div className="relative aspect-square overflow-hidden rounded-md border bg-muted">
        {src ? <Image src={src} alt={caption} fill className="object-cover transition group-hover:scale-105" unoptimized /> : null}
      </div>
      <p className="mt-1 text-center text-[11px] font-medium text-muted-foreground">{caption}</p>
    </a>
  );
}

/** What the Market Associate submitted for a package, with the approve/fail decision. */
export function PackageReviewSheet({
  pkg,
  open,
  onOpenChange,
  confirmed,
  onConfirm,
  pending,
  canDecide,
  onApprove,
  onFail,
  failures,
  onFailureChange,
  canReopen,
  onReopen,
  onResource,
}: {
  pkg?: ReviewPackage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  confirmed: Record<string, boolean>;
  onConfirm: (orderItemId: string, value: boolean) => void;
  pending?: boolean;
  canDecide: boolean;
  onApprove: () => void;
  onFail: () => void;
  failures: Record<string, FailureDraft>;
  onFailureChange: (orderItemId: string, draft: FailureDraft) => void;
  canReopen?: boolean;
  onReopen?: () => void;
  onResource?: () => void;
}) {
  const items = pkg?.items || [];
  const allConfirmed = items.length > 0 && items.every((item) => confirmed[item.orderItemId]);
  const flagged = items.filter((item) => failures[item.orderItemId]?.reason);
  const failReady = flagged.length > 0 && flagged.every((item) => (failures[item.orderItemId]?.note || "").trim().length >= 3);
  const failed = pkg?.status === "QC_FAILED";
  const mismatches = items.filter((item) => item.matched === false).length;

  return (
    <AdminWorkflowSheet
      open={open}
      onOpenChange={onOpenChange}
      title={pkg?.publicId ? `Review ${pkg.publicId}` : "Review package"}
      description="Compare what the Market Associate submitted with what the customer ordered, then approve or fail the package."
      footer={
        canDecide ? (
          <>
            <Button variant="destructive" onClick={onFail} disabled={pending || !failReady}>
              <PackageX /> Fail check{flagged.length ? ` (${flagged.length})` : ""}
            </Button>
            <Button onClick={onApprove} disabled={pending || !allConfirmed || flagged.length > 0}>
              {pending ? <HookLoader size="button" /> : <><CheckCircle2 /> Approve &amp; pass QC</>}
            </Button>
          </>
        ) : failed && canReopen ? (
          <>
            <Button variant="outline" onClick={onResource} disabled={pending}>
              <Undo2 /> Send back to Market Associate
            </Button>
            <Button onClick={onReopen} disabled={pending}>
              {pending ? <HookLoader size="button" /> : <><RotateCcw /> Re-open quality check</>}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-4">
          {[
            ["Package", pkg?.publicId],
            ["Order", pkg?.order?.publicId],
            ["Market Associate", pkg?.marketAssociate?.name],
            ["Hub", pkg?.hub?.name],
          ].map(([name, value]) => (
            <div key={name}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{name}</p>
              <p className="mt-0.5 truncate font-medium">{value || "—"}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={pkg?.status || "QC_PENDING"} />
          <Badge variant="outline">{items.length} item{items.length === 1 ? "" : "s"}</Badge>
          {mismatches ? <Badge variant="destructive">{mismatches} reported mismatch</Badge> : null}
        </div>

        {items.map((item, index) => {
          const photos = item.photos?.length
            ? item.photos
            : item.pickedUpPhotoUrl
              ? [{ view: "front", url: item.pickedUpPhotoUrl }]
              : [];
          return (
            <section key={item.orderItemId} className="overflow-hidden rounded-lg border">
              <header className="flex items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.productTitle || `Item ${index + 1}`}</p>
                  <p className="text-xs text-muted-foreground">{item.itemReference}</p>
                </div>
                <Badge variant={item.matched ? "default" : "destructive"}>
                  {item.matched ? "Associate: matches" : "Associate: mismatch"}
                </Badge>
              </header>

              <div className="space-y-4 p-4">
                <div className="grid grid-cols-4 gap-2">
                  <Photo src={item.orderedPhotoUrl} caption="Ordered" />
                  {["front", "side", "back"].map((view) => (
                    <Photo key={view} src={photos.find((photo) => photo.view === view)?.url} caption={`Picked · ${view}`} />
                  ))}
                </div>

                <div>
                  <div className="grid grid-cols-[5.5rem_1fr_1fr] gap-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span />
                    <span>Ordered</span>
                    <span>Found</span>
                  </div>
                  <Compare label="Colour" ordered={item.orderedColor ? colorName(item.orderedColor) : undefined} found={item.actualColor ? colorName(item.actualColor) : undefined} />
                  <Compare label="Size" ordered={item.orderedSize} found={item.actualSize} />
                  <Compare label="Quantity" ordered={item.orderedQuantity} found={item.actualQuantity} />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {checkLabels.map(([key, name]) => {
                    const ok = item.checks?.[key];
                    return (
                      <Badge key={key} variant="outline" className={cn("gap-1", ok ? "text-success" : "text-danger")}>
                        {ok ? <Check className="size-3" /> : <X className="size-3" />}
                        {name}
                      </Badge>
                    );
                  })}
                </div>

                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Unit cost paid</dt>
                    <dd className="font-medium">{item.unitCostMinor != null ? money(item.unitCostMinor) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Supplier reference</dt>
                    <dd className="font-medium">{item.supplierReference || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Condition note</dt>
                    <dd className="mt-0.5 rounded-md bg-muted/50 p-2.5">{item.conditionNote || "No note left."}</dd>
                  </div>
                </dl>

                {failed ? (
                  (() => {
                    const record = pkg?.qualityChecks?.find((entry) => entry.orderItemId === item.orderItemId && entry.result === "failed");
                    return record ? (
                      <div className="rounded-md border border-danger/30 bg-danger-soft p-3 text-sm">
                        <p className="font-semibold text-danger">Failed: {reasonLabel(record.reason)}</p>
                        <p className="mt-0.5">{record.note}</p>
                        {record.resolutionId ? <p className="mt-1 text-xs text-muted-foreground">Issue {record.resolutionId} opened for review</p> : null}
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        Failed before reasons were recorded. Send it back to the Market Associate or re-open the check.
                      </div>
                    );
                  })()
                ) : null}

                {canDecide ? (
                  <div className="space-y-2 rounded-md border border-dashed p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Report a problem (optional)</p>
                    <Select
                      value={failures[item.orderItemId]?.reason || "none"}
                      onValueChange={(value) =>
                        onFailureChange(item.orderItemId, { ...failures[item.orderItemId], reason: value === "none" ? undefined : value })
                      }
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No problem with this item</SelectItem>
                        {FAILURE_REASONS.map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {failures[item.orderItemId]?.reason ? (
                      <Textarea
                        rows={2}
                        value={failures[item.orderItemId]?.note || ""}
                        onChange={(event) => onFailureChange(item.orderItemId, { ...failures[item.orderItemId], note: event.target.value })}
                        placeholder="What is wrong? Hook uses this to resolve it with the customer."
                      />
                    ) : null}
                  </div>
                ) : null}

                {canDecide ? (
                  <label className="flex items-center gap-2 rounded-md border bg-background p-3 text-sm font-medium">
                    <Checkbox
                      checked={Boolean(confirmed[item.orderItemId])}
                      onCheckedChange={(value) => onConfirm(item.orderItemId, value === true)}
                    />
                    I have checked this item against the photos
                  </label>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </AdminWorkflowSheet>
  );
}
