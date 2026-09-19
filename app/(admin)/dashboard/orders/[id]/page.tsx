"use client";

import { friendlyVariantValue } from "@/lib/color-name";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ReceiptPrintDialog } from "@/components/fulfilment/ReceiptPrintDialog";
import {
  ArrowLeft,
  CreditCard,
  RotateCcw,
  MapPin,
  Package,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { HookLoader } from "@/components/shared/HookLoader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MetricCard } from "@/components/shared/MetricCard";
import { DetailSection } from "@/components/shared/DetailSection";
import { DefinitionGrid } from "@/components/shared/DefinitionGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useApiQuery } from "@/lib/query";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { OrderRefundDialog } from "@/components/orders/OrderRefundDialog";

type OrderDetail = {
  id: string;
  publicId?: string;
  orderCode?: string;
  channel?: string;
  sourceStateId?: string;
  sourceStateIds?: string[];
  commerceStatus?: string;
  commercePaymentStatus?: string;
  commercePaymentMethod?: string;
  deliveryMethod?: string;
  subtotalMinor?: number;
  vatMinor?: number;
  vatRate?: number;
  deliveryFeeMinor?: number;
  couponCode?: string;
  couponDiscountMinor?: number;
  creditsAppliedMinor?: number;
  logisticsProviderSnapshot?: { code?: string; name?: string };
  totalMinor?: number;
  currency?: string;
  customerSnapshot?: Record<string, unknown>;
  addressSnapshot?: Record<string, unknown>;
  pickupPartnerSnapshot?: Record<string, unknown>;
  items?: Array<{
    id: string;
    publicId?: string;
    quantity: number;
    unitPriceMinor?: number;
    totalPriceMinor?: number;
    commissionAmount?: number;
    productSnapshot?: Record<string, unknown>;
    variantSnapshot?: Record<string, unknown>;
    quoteSnapshot?: Record<string, unknown>;
    fulfilmentGroupId?: string;
    deliveryStatus?: string;
    shipmentId?: string;
    product?: {
      basePriceMinor?: number;
      sellingPriceMinor?: number;
      markupMinor?: number;
      discountMinor?: number;
    };
  }>;
  payment?: {
    publicId?: string;
    fulfilmentGroupId?: string;
    commerceStatus?: string;
    gateway?: string;
    transactionRef?: string;
    amountMinor?: number;
  };
  payments?: Array<{
    publicId?: string;
    fulfilmentGroupId?: string;
    commerceStatus?: string;
    gateway?: string;
    transactionRef?: string;
    amountMinor?: number;
  }>;
  fulfilmentGroups?: Array<{
    publicId: string;
    sourceStateId: string;
    subtotalMinor: number;
    deliveryFeeShareMinor: number;
    status: string;
    paymentId?: string;
    shipmentId?: string;
  }>;
  timeline?: Array<{
    status?: string;
    at?: string;
    actorType?: string;
    reason?: string;
  }>;
  podReview?: Record<string, unknown>;
  policyVersions?: Record<string, string>;
};

const money = (value: unknown) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0) / 100);
const text = (value: unknown) => String(value || "-");

export default function OrderDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [refunding, setRefunding] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const query = useApiQuery<OrderDetail>(
    ["admin", "orders", id],
    `/admin/orders/${id}`,
    Boolean(id),
  );
  const order = query.data;
  if (query.isLoading)
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <HookLoader size="page" label="Loading Order" />
      </div>
    );
  if (!order)
    return (
      <div className="p-6">
        <PageHeader
          title="Order unavailable"
          description="This Order could not be loaded in your current operational scope."
        />
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    );
  const customer = order.customerSnapshot || {};
  const address = order.addressSnapshot || order.pickupPartnerSnapshot || {};
  const totalMarginMinor = (order.items || []).reduce((sum, item) => {
    const marketPriceMinor = item.product?.basePriceMinor;
    const hookPriceMinor = item.product?.sellingPriceMinor ?? item.unitPriceMinor;
    if (marketPriceMinor == null || hookPriceMinor == null) return sum;
    return sum + (hookPriceMinor - marketPriceMinor) * item.quantity;
  }, 0);
  const hasMarginData = (order.items || []).some((item) => item.product?.basePriceMinor != null);
  // Only CONFIRMED payments are refundable. A Pay-at-Handover order has one
  // payment per delivery, so the captured total is their sum, not the order
  // total — which may include deliveries that were never paid for.
  const capturedMinor = (order.payments?.length ? order.payments : order.payment ? [order.payment] : [])
    .filter((payment) => String(payment.commerceStatus || "").toUpperCase() === "CONFIRMED")
    .reduce((sum, payment) => sum + Number(payment.amountMinor || 0), 0);
  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        title={order.publicId || order.orderCode || order.id}
        description={`${text(order.channel).replaceAll("_", " ")} · ${text(order.deliveryMethod).replaceAll("_", " ")}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setReceiptOpen(true)}>
              <Printer className="mr-2 h-4 w-4" /> Hook receipt
            </Button>
            <ReceiptPrintDialog orderRef={order.publicId || order.id} open={receiptOpen} onOpenChange={setReceiptOpen} />
            {/* Refunds are raised from the order, where the captured amount is
                already known. Finance still processes them from the queue. */}
            <PermissionGuard permission="refunds.manage">
              <Button variant="outline" size="sm" onClick={() => setRefunding(true)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Refund
              </Button>
            </PermissionGuard>
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </>
        }
      />

      <OrderRefundDialog
        open={refunding}
        onOpenChange={setRefunding}
        orderId={order.publicId || order.orderCode || String(order.id)}
        capturedMinor={capturedMinor}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Package} label="Order status" value={text(order.commerceStatus).replaceAll("_", " ")} intent="warning" />
        <MetricCard icon={CreditCard} label="Payment status" value={text(order.commercePaymentStatus).replaceAll("_", " ")} intent="success" />
        <MetricCard icon={MapPin} label="Source states" value={String(order.sourceStateIds?.length || (order.sourceStateId ? 1 : 0))} />
        <MetricCard icon={ShieldCheck} label="Order total" value={money(order.totalMinor)} />
        {hasMarginData ? <MetricCard icon={ShieldCheck} label="Order margin" value={money(totalMarginMinor)} intent={totalMarginMinor >= 0 ? "success" : "warning"} /> : null}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <DetailSection title="Delivery groups" description="Each source state is fulfilled and tracked independently under this customer order." action={<MapPin className="size-4 text-muted-foreground" />} contentClassName="space-y-3">
            {(order.fulfilmentGroups || []).map((group, index) => (
              <div key={group.publicId} className="grid gap-3 rounded-md border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">Delivery {index + 1}</p>
                    <StatusBadge status={group.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{group.sourceStateId} · {group.publicId}</p>
                  {group.shipmentId ? <p className="mt-1 text-xs text-muted-foreground">Shipment {group.shipmentId}</p> : null}
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold">{money(group.subtotalMinor + group.deliveryFeeShareMinor)}</p>
                  <p className="text-xs text-muted-foreground">Includes {money(group.deliveryFeeShareMinor)} delivery</p>
                </div>
              </div>
            ))}
            {!order.fulfilmentGroups?.length ? <p className="text-sm text-muted-foreground">This legacy order does not have delivery groups.</p> : null}
          </DetailSection>
          <DetailSection title="Order items" description="Immutable product, variant, quote, and price snapshots captured at checkout." action={<Package className="size-4 text-muted-foreground" />} contentClassName="space-y-3">
              {(order.items || []).map((item) => {
                const marketPriceMinor = item.product?.basePriceMinor;
                const hookPriceMinor = item.product?.sellingPriceMinor ?? item.unitPriceMinor;
                const marginMinor = marketPriceMinor != null && hookPriceMinor != null ? hookPriceMinor - marketPriceMinor : undefined;
                const marginPct = marginMinor != null && hookPriceMinor ? (marginMinor / hookPriceMinor) * 100 : undefined;
                return (
                <div
                  key={item.publicId || item.id}
                  className="rounded-md border p-4"
                >
                  <div className="grid grid-cols-[1fr_auto] gap-4">
                    <div>
                      <p className="font-semibold">
                        {text(item.productSnapshot?.title)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Qty {item.quantity} · {money(item.unitPriceMinor)} each
                      </p>
                      {Object.keys(item.variantSnapshot || {}).length ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {Object.entries(item.variantSnapshot || {})
                            .map(([key, value]) => `${key}: ${friendlyVariantValue(key, value)}`)
                            .join(" · ")}
                        </p>
                      ) : null}
                      {item.quoteSnapshot ? (
                        <Badge className="mt-2" variant="secondary">
                          Negotiated quote applied
                        </Badge>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.deliveryStatus ? <StatusBadge status={item.deliveryStatus} /> : null}
                        {item.fulfilmentGroupId ? <Badge variant="outline">{item.fulfilmentGroupId}</Badge> : null}
                      </div>
                    </div>
                    <p className="font-semibold">{money(item.totalPriceMinor)}</p>
                  </div>
                  {(marketPriceMinor != null || hookPriceMinor != null) && (
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-4">
                      <PriceStat label="Market price" value={marketPriceMinor != null ? money(marketPriceMinor) : "-"} />
                      <PriceStat label="Hook price" value={hookPriceMinor != null ? money(hookPriceMinor) : "-"} />
                      <PriceStat label="Margin" value={marginMinor != null ? money(marginMinor) : "-"} tone={marginMinor != null && marginMinor >= 0 ? "success" : "destructive"} />
                      <PriceStat label="Margin %" value={marginPct != null ? `${marginPct.toFixed(1)}%` : "-"} tone={marginPct != null && marginPct >= 0 ? "success" : "destructive"} />
                    </div>
                  )}
                </div>
              );})}
              {!order.items?.length ? (
                <p className="text-sm text-muted-foreground">
                  No line snapshots found.
                </p>
              ) : null}
              <Separator />
              <div className="ml-auto w-full max-w-xs space-y-2 text-sm">
                <Amount label="Subtotal" value={order.subtotalMinor} />
                {order.vatMinor != null && order.vatMinor > 0 ? (
                  <Amount label={`VAT${order.vatRate ? ` (${(order.vatRate * 100).toFixed(0)}%)` : ""}`} value={order.vatMinor} />
                ) : null}
                {order.couponDiscountMinor ? (
                  <Amount
                    label={order.couponCode ? `Coupon (${order.couponCode})` : "Coupon"}
                    value={-order.couponDiscountMinor}
                  />
                ) : null}
                {order.creditsAppliedMinor ? (
                  <Amount label="Hook Coin" value={-order.creditsAppliedMinor} />
                ) : null}
                <Amount
                  label={order.logisticsProviderSnapshot?.name ? `Delivery (${order.logisticsProviderSnapshot.name})` : "Delivery"}
                  value={order.deliveryFeeMinor}
                />
                <Amount label="Total" value={order.totalMinor} strong />
              </div>
          </DetailSection>
          <DetailSection title="Order timeline" description="Customer and operations lifecycle events in chronological order." contentClassName="space-y-4">
              {(order.timeline || []).map((event, index) => (
                <div
                  key={`${event.status}-${event.at}-${index}`}
                  className="flex gap-3"
                >
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-brand-gold" />
                  <div>
                    <p className="font-medium">
                      {text(event.status).replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {event.at ? new Date(event.at).toLocaleString() : "-"} ·{" "}
                      {text(event.actorType)}
                    </p>
                    {event.reason ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {event.reason}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
          </DetailSection>
        </div>
        <div className="space-y-5">
          <DetailSection title="Customer & policies" description="Identity and accepted policy versions captured for this order." action={<ShieldCheck className="size-4 text-muted-foreground" />}><DefinitionGrid columns={1} items={[{ label: "Customer", value: text(customer.name) }, { label: "Email", value: text(customer.email) }, { label: "Phone", value: text(customer.phone) }, { label: "Policy versions", value: Object.entries(order.policyVersions || {}).map(([key, value]) => `${key} ${value}`).join(" · ") || "Not recorded" }]} /></DetailSection>
          <DetailSection title="Delivery snapshot" description="Immutable destination information used for fulfilment." action={<MapPin className="size-4 text-muted-foreground" />}><DefinitionGrid columns={1} items={[{ label: "Recipient", value: text(address.recipientName || address.name) }, { label: "Address", value: text(address.line1 || address.address) }, { label: "Phone", value: text(address.phone || (address.contact as Record<string, unknown> | undefined)?.phone) }]} /></DetailSection>
          <DetailSection title="Payment evidence" description="Provider-backed payment records. Multi-delivery Pay-at-Handover orders have one payment per delivery." action={<CreditCard className="size-4 text-muted-foreground" />} contentClassName="space-y-3">
            {(order.payments?.length ? order.payments : order.payment ? [order.payment] : []).map((payment, index) => (
              <div key={payment.publicId || payment.transactionRef || index} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3"><p className="font-medium">{payment.fulfilmentGroupId ? `Delivery payment` : "Order payment"}</p><StatusBadge status={payment.commerceStatus || "PENDING"} /></div>
                <p className="mt-2 text-sm font-semibold">{money(payment.amountMinor)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{payment.gateway || "Paystack"} · {payment.transactionRef || "Reference pending"}</p>
              </div>
            ))}
          </DetailSection>
        </div>
      </div>
    </div>
  );
}

function Amount({
  label,
  value,
  strong,
}: {
  label: string;
  value: unknown;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${strong ? "text-base font-semibold" : ""}`}
    >
      <span>{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}

function PriceStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "destructive";
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-semibold ${tone === "success" ? "text-emerald-600" : tone === "destructive" ? "text-red-600" : ""}`}>
        {value}
      </p>
    </div>
  );
}
