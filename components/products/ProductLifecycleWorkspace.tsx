"use client";

import { FormEvent, useState } from "react";
import { CalendarClock, PauseCircle, PlayCircle, ScaleIcon, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HookLoader } from "@/components/shared/HookLoader";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { useApiPost } from "@/lib/query";
import { money } from "@/lib/admin-utils";

interface NegotiationRules {
  enabled: boolean;
  minimumNegotiablePriceMinor?: number;
  maximumDiscountMinor?: number;
  maximumCustomerOffers: number;
  acceptedQuoteExpiryMinutes: number;
}

interface ProductLifecycleData {
  id: string;
  status: string;
  catalogVersion?: number;
  sellingPriceMinor?: number;
  basePriceMinor?: number;
  negotiationRules?: NegotiationRules;
  availabilityStatus?: string;
  availabilityCheckDueAt?: string;
  availabilityCheckNote?: string;
  lastAvailabilityConfirmedAt?: string;
}

/**
 * The publish/pause/unpublish, negotiation-rules, and availability-check
 * actions that used to live on the standalone Commercial Catalog page — kept
 * here so every live-product action stays in one workspace, one card, one
 * consistent tab pattern with the rest of the admin (Tabs, not hand-rolled
 * pill buttons).
 */
export function ProductLifecycleWorkspace({ product, onSaved }: { product: ProductLifecycleData; onSaved: () => void }) {
  const [reason, setReason] = useState("");
  const [rulesEnabled, setRulesEnabled] = useState(product.negotiationRules?.enabled || false);

  const version = product.catalogVersion || 1;
  const publish = useApiPost<unknown, { reason: string; version: number }>(`/admin/products/${product.id}/publish`, ["admin", "products"], { successMessage: "Product published" });
  const pause = useApiPost<unknown, { reason: string; version: number }>(`/admin/products/${product.id}/pause`, ["admin", "products"], { successMessage: "Product paused" });
  const unpublish = useApiPost<unknown, { reason: string; version: number }>(`/admin/products/${product.id}/unpublish`, ["admin", "products"], { successMessage: "Product unpublished" });
  const availabilityCheck = useApiPost<unknown, { reason: string; version: number }>(`/admin/products/${product.id}/availability-check`, ["admin", "products"], { successMessage: "Availability check requested" });

  const lifecyclePending = publish.isPending || pause.isPending || unpublish.isPending;

  function runLifecycle(action: "publish" | "pause" | "unpublish") {
    if (reason.trim().length < 5) return;
    const mutation = action === "publish" ? publish : action === "pause" ? pause : unpublish;
    mutation.mutate({ reason: reason.trim(), version }, { onSuccess: () => { setReason(""); onSaved(); } });
  }

  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardHeader className="border-b px-4 py-3.5">
        <CardTitle className="text-sm font-semibold">Manage product</CardTitle>
        <CardDescription className="text-xs">Publishing, negotiation, and availability actions — every change is version-checked and audited.</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <Tabs defaultValue="lifecycle">
          <TabsList>
            <TabsTrigger value="lifecycle">Publish &amp; Status</TabsTrigger>
            <TabsTrigger value="negotiation">Negotiation Rules</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
          </TabsList>

          <TabsContent value="lifecycle" className="space-y-4 pt-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3.5 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Current status</p>
                <p className="text-xs text-muted-foreground">What customers see on Hook right now.</p>
              </div>
              <StatusBadge status={product.status} />
            </div>
            <Field>
              <FieldLabel htmlFor="lifecycle-reason">Audit reason</FieldLabel>
              <Textarea id="lifecycle-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this status changing?" className="min-h-20" maxLength={1000} />
              <FieldDescription>At least 5 characters.</FieldDescription>
            </Field>
            <PermissionGuard permission="catalog.product.publish">
              <div className="flex flex-wrap gap-2">
                {product.status !== "published" ? (
                  <Button type="button" variant="brand" size="sm" disabled={lifecyclePending || reason.trim().length < 5} onClick={() => runLifecycle("publish")}>
                    {publish.isPending ? <HookLoader size="button" /> : <><PlayCircle /> Publish</>}
                  </Button>
                ) : null}
                {product.status === "published" ? (
                  <Button type="button" variant="outline" size="sm" disabled={lifecyclePending || reason.trim().length < 5} onClick={() => runLifecycle("pause")}>
                    {pause.isPending ? <HookLoader size="button" /> : <><PauseCircle /> Pause</>}
                  </Button>
                ) : null}
                {["published", "paused"].includes(product.status) ? (
                  <Button type="button" variant="outline" size="sm" className="text-destructive" disabled={lifecyclePending || reason.trim().length < 5} onClick={() => runLifecycle("unpublish")}>
                    {unpublish.isPending ? <HookLoader size="button" /> : <><XCircle /> Unpublish</>}
                  </Button>
                ) : null}
              </div>
            </PermissionGuard>
          </TabsContent>

          <TabsContent value="negotiation" className="pt-4">
            <NegotiationRulesForm productId={product.id} version={version} rules={product.negotiationRules} enabled={rulesEnabled} onEnabledChange={setRulesEnabled} onSaved={onSaved} sellingPriceMinor={product.sellingPriceMinor} />
          </TabsContent>

          <TabsContent value="availability" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 px-3.5 py-3">
                <p className="text-xs text-muted-foreground">Availability status</p>
                <p className="mt-1.5"><StatusBadge status={product.availabilityStatus || "unconfirmed"} /></p>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3.5 py-3">
                <p className="text-xs text-muted-foreground">Check due</p>
                <p className="mt-1.5 text-sm font-medium text-foreground">{product.availabilityCheckDueAt ? new Date(product.availabilityCheckDueAt).toLocaleDateString("en-NG") : "Not scheduled"}</p>
              </div>
            </div>
            {product.availabilityCheckNote ? (
              <p className="rounded-lg border border-dashed px-3.5 py-3 text-sm text-muted-foreground">{product.availabilityCheckNote}</p>
            ) : null}
            <Field>
              <FieldLabel htmlFor="availability-reason">Reason for the check</FieldLabel>
              <Textarea id="availability-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why does this product need re-confirmation?" className="min-h-20" maxLength={1000} />
            </Field>
            <PermissionGuard permission="catalog.availability.manage">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={availabilityCheck.isPending || reason.trim().length < 5}
                onClick={() => availabilityCheck.mutate({ reason: reason.trim(), version }, { onSuccess: () => { setReason(""); onSaved(); } })}
              >
                {availabilityCheck.isPending ? <HookLoader size="button" /> : <><CalendarClock /> Request availability check</>}
              </Button>
            </PermissionGuard>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function NegotiationRulesForm({
  productId,
  version,
  rules,
  enabled,
  onEnabledChange,
  onSaved,
  sellingPriceMinor,
}: {
  productId: string;
  version: number;
  rules?: NegotiationRules;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  onSaved: () => void;
  sellingPriceMinor?: number;
}) {
  const [reason, setReason] = useState("");
  const saveRules = useApiPost<unknown, Record<string, unknown>>(`/admin/products/${productId}/negotiation-rules`, ["admin", "products"], { successMessage: "Negotiation rules updated" });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    saveRules.mutate(
      {
        enabled,
        minimumNegotiablePriceMinor: enabled ? Number(formData.get("minimumNegotiablePriceMinor") || 0) : undefined,
        maximumDiscountMinor: enabled ? Number(formData.get("maximumDiscountMinor") || 0) : undefined,
        reason: reason.trim(),
        version,
      },
      { onSuccess: () => { setReason(""); onSaved(); } },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-background"><ScaleIcon className="size-4 text-muted-foreground" /></span>
          <div>
            <p className="text-sm font-medium text-foreground">AI negotiation</p>
            <p className="text-xs text-muted-foreground">Allow the AI to offer discounts within these limits.</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Minimum negotiable price (₦)</FieldLabel>
            <Input name="minimumNegotiablePriceMinor" type="number" min="1" defaultValue={rules?.minimumNegotiablePriceMinor ? rules.minimumNegotiablePriceMinor / 100 : ""} required />
            {sellingPriceMinor ? <FieldDescription>Hook price is {money(sellingPriceMinor / 100)}.</FieldDescription> : null}
          </Field>
          <Field>
            <FieldLabel>Maximum discount (₦)</FieldLabel>
            <Input name="maximumDiscountMinor" type="number" min="0" defaultValue={rules?.maximumDiscountMinor ? rules.maximumDiscountMinor / 100 : ""} required />
          </Field>
        </div>
      ) : null}
      <Field>
        <FieldLabel htmlFor="rules-reason">Audit reason</FieldLabel>
        <Textarea id="rules-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why are the negotiation rules changing?" className="min-h-16" maxLength={1000} />
      </Field>
      <PermissionGuard permission="catalog.negotiation_rules.edit">
        <Button type="submit" variant="brand" size="sm" disabled={saveRules.isPending || reason.trim().length < 5}>
          {saveRules.isPending ? <HookLoader size="button" /> : "Save negotiation rules"}
        </Button>
      </PermissionGuard>
    </form>
  );
}
