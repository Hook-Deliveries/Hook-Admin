"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Printer, Truck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReceiptPrintDialog } from "@/components/fulfilment/ReceiptPrintDialog";
import { CourierBadge, type CourierInfo } from "@/components/fulfilment/CourierBadge";
import { CourierSwitchDialog } from "@/components/fulfilment/CourierSwitchDialog";
import { Repeat } from "lucide-react";
import { HookLoader } from "@/components/shared/HookLoader";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { QueryState } from "@/components/shared/QueryState";
import { ListRow, initialsOf } from "@/components/shared/ListRow";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { apiPatch, apiPost } from "@/lib/api";
import { useApiQuery } from "@/lib/query";

type Shipment = {
  id?: string;
  _id?: string;
  publicId?: string;
  orderId?: string;
  provider?: string;
  courierCode?: string;
  courierName?: string;
  substitutedFrom?: string;
  substitutionReason?: string;
  trackingNumber?: string;
  status?: string;
  version?: number;
  createdAt?: string;
  hub?: { name?: string } | null;
  order?: { publicId?: string } | null;
  courier?: CourierInfo;
  alternatives?: CourierInfo[];
};

type Consolidation = {
  id?: string;
  _id?: string;
  publicId?: string;
  orderId?: string;
  hubId?: string;
  status?: string;
  hub?: { name?: string } | null;
  order?: { publicId?: string } | null;
  chosenCourier?: CourierInfo;
  alternatives?: CourierInfo[];
};

type Tab = "ready" | "active" | "exceptions" | "all";
const EXCEPTIONS = ["DELIVERY_FAILED", "RETURN_IN_TRANSIT", "AWAITING_HANDOVER_PAYMENT"];
const CLOSED = ["DELIVERED", "CANCELLED", "RETURNED_TO_HOOK"];
const PRE_PICKUP = ["BOOKED_WITH_PROVIDER", "AWAITING_PICKUP"];

const label = (value?: string) => String(value || "-").replaceAll("_", " ");
const rowId = (row: Shipment | Consolidation, index: number, prefix: string) =>
  row.publicId || row.id || row._id || `${prefix}-${index}`;

const nextStatuses: Record<string, string[]> = {
  BOOKED_WITH_PROVIDER: ["AWAITING_PICKUP", "CANCELLED"],
  AWAITING_PICKUP: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "DELIVERY_FAILED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERY_FAILED", "RETURN_IN_TRANSIT"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED", "AWAITING_HANDOVER_PAYMENT"],
  AWAITING_HANDOVER_PAYMENT: ["RELEASE_APPROVED"],
  RELEASE_APPROVED: ["DELIVERED"],
  DELIVERY_FAILED: ["RETURN_IN_TRANSIT"],
  RETURN_IN_TRANSIT: ["RETURNED_TO_HOOK"],
};

export default function FulfilmentShipmentsPage() {
  const shipmentsQuery = useApiQuery<Shipment[]>(
    ["admin", "fulfilment", "shipments"],
    "/admin/fulfilment/shipments?limit=200",
  );
  const consolidationsQuery = useApiQuery<Consolidation[]>(
    ["admin", "fulfilment", "sealed-consolidations"],
    "/admin/fulfilment/consolidations?status=SEALED&limit=100",
  );

  const [tab, setTab] = useState<Tab>("ready");
  const [search, setSearch] = useState("");
  const [chosenStatus, setChosenStatus] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<{ shipment: Shipment; status: string }>();
  const [pending, setPending] = useState<string>();
  const [receiptOrder, setReceiptOrder] = useState<string>();
  // Booking with a substitute (chosen courier unavailable) or switching a
  // booked shipment both go through the same dialog.
  const [switching, setSwitching] = useState<
    { kind: "book"; item: Consolidation } | { kind: "reassign"; shipment: Shipment }
  >();

  const shipments = useMemo(() => shipmentsQuery.data || [], [shipmentsQuery.data]);
  const unbooked = useMemo(() => {
    const bookedOrders = new Set(shipments.map((item) => item.orderId));
    return (consolidationsQuery.data || []).filter(
      (item) => item.orderId && !bookedOrders.has(item.orderId),
    );
  }, [consolidationsQuery.data, shipments]);

  const needle = search.trim().toLowerCase();
  const matches = (...values: Array<string | undefined>) =>
    !needle || values.some((value) => value?.toLowerCase().includes(needle));
  const readyRows = unbooked.filter((item) =>
    matches(item.order?.publicId, item.orderId, item.publicId, item.chosenCourier?.name, item.hub?.name),
  );
  const registerRows = shipments.filter((item) => {
    const status = item.status || "";
    if (tab === "active" && (CLOSED.includes(status) || EXCEPTIONS.includes(status))) return false;
    if (tab === "exceptions" && !EXCEPTIONS.includes(status)) return false;
    return matches(item.publicId, item.order?.publicId, item.orderId, item.courierName, item.trackingNumber, item.hub?.name);
  });
  const counts = {
    ready: unbooked.length,
    active: shipments.filter((item) => !CLOSED.includes(item.status || "") && !EXCEPTIONS.includes(item.status || "")).length,
    exceptions: shipments.filter((item) => EXCEPTIONS.includes(item.status || "")).length,
    all: shipments.length,
  };
  const unavailableReady = unbooked.filter((item) => item.chosenCourier?.available === false).length;

  const loading = shipmentsQuery.isLoading || consolidationsQuery.isLoading;
  const error = shipmentsQuery.error || consolidationsQuery.error;
  const cleanError = (cause: unknown, fallback: string) =>
    cause instanceof Error ? cause.message.replace(/^\d+:\s*/, "") : fallback;

  function retryAll() {
    void shipmentsQuery.refetch();
    void consolidationsQuery.refetch();
  }

  async function book(item: Consolidation, substitute?: { code: string; reason: string }) {
    if (!item.orderId || !item.hubId) return;
    const id = item.publicId || item.id || item._id;
    if (!id) return;
    setPending(`book-${id}`);
    try {
      await apiPost(`/admin/fulfilment/orders/${item.orderId}/shipments`, {
        provider: "manual",
        courierCode: substitute?.code || item.chosenCourier?.code,
        ...(substitute ? { substitutionReason: substitute.reason } : {}),
        hubId: item.hubId,
        idempotencyKey: `shipment-${item.orderId}`,
      });
      toast.success("Shipment booked.");
      setSwitching(undefined);
      await Promise.all([shipmentsQuery.refetch(), consolidationsQuery.refetch()]);
    } catch (cause) {
      toast.error(cleanError(cause, "The shipment could not be booked."));
    } finally {
      setPending(undefined);
    }
  }

  async function reassign(shipment: Shipment, courierCode: string, reason: string) {
    const id = shipment.publicId || shipment.id || shipment._id;
    if (!id) return;
    setPending(`switch-${id}`);
    try {
      await apiPost(`/admin/fulfilment/shipments/${id}/reassign-courier`, {
        courierCode,
        reason,
        version: shipment.version,
      });
      toast.success("Courier switched. The customer has been updated.");
      setSwitching(undefined);
      await shipmentsQuery.refetch();
    } catch (cause) {
      toast.error(cleanError(cause, "The courier could not be switched."));
    } finally {
      setPending(undefined);
    }
  }

  async function advance() {
    if (!confirming) return;
    const { shipment, status } = confirming;
    const id = shipment.publicId || shipment.id || shipment._id;
    if (!id) return;
    setPending(`status-${id}`);
    try {
      await apiPatch(`/admin/fulfilment/shipments/${id}`, { status, version: shipment.version });
      toast.success(`Shipment advanced to ${label(status)}.`);
      setConfirming(undefined);
      await shipmentsQuery.refetch();
    } catch (cause) {
      toast.error(cleanError(cause, "The shipment status could not be changed."));
    } finally {
      setPending(undefined);
    }
  }

  const switchingCurrent = switching?.kind === "book" ? switching.item.chosenCourier : switching?.shipment.courier ?? {
    code: switching?.shipment.courierCode,
    name: switching?.shipment.courierName,
  };
  const switchingAlternatives =
    (switching?.kind === "book" ? switching.item.alternatives : switching?.shipment.alternatives) || [];

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        showBack={false}
        title="Shipments"
        description="Book sealed parcels with the courier the customer chose. If it is unavailable, switch to another courier and tell the customer why."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Ready to book" value={counts.ready} icon={Truck} />
        <MetricCard
          label="Courier unavailable"
          value={unavailableReady}
          icon={AlertTriangle}
          intent={unavailableReady ? "danger" : "neutral"}
          caption="Needs a switch before booking"
        />
        <MetricCard label="Active" value={counts.active} icon={Truck} intent="success" />
        <MetricCard
          label="Exceptions"
          value={counts.exceptions}
          icon={AlertTriangle}
          intent={counts.exceptions ? "warning" : "neutral"}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList>
            <TabsTrigger value="ready">Ready to book ({counts.ready})</TabsTrigger>
            <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
            <TabsTrigger value="exceptions">Exceptions ({counts.exceptions})</TabsTrigger>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search order, courier, tracking, hub"
          className="h-9 sm:w-[300px]"
        />
      </div>

      <Card className="rounded-lg shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">{tab === "ready" ? "Ready for booking" : "Shipment register"}</CardTitle>
          <Badge variant="outline">
            {tab === "ready" ? `${readyRows.length} waiting` : `${registerRows.length} shipments`}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <QueryState
            loading={loading}
            error={error}
            empty={tab === "ready" ? readyRows.length === 0 : registerRows.length === 0}
            loadingLabel="Loading shipments"
            errorTitle="Shipment operations could not be loaded"
            emptyTitle={tab === "ready" ? "Nothing waiting for booking" : "No shipments here"}
            emptyDescription={
              tab === "ready"
                ? "Sealed parcels appear here once the hub has consolidated them."
                : "Booked shipments and their tracking appear here."
            }
            emptyIcon={Truck}
            onRetry={retryAll}
          >
            {tab === "ready"
              ? readyRows.map((item, index) => {
                  const id = rowId(item, index, "consolidation");
                  const unavailable = item.chosenCourier?.available === false;
                  return (
                    <ListRow
                      key={id}
                      index={index + 1}
                      initials={initialsOf(item.chosenCourier?.name || "courier")}
                      title={
                        <span className="truncate text-sm font-semibold text-zinc-950">
                          {item.order?.publicId || item.orderId}
                        </span>
                      }
                      subject={<CourierBadge courier={item.chosenCourier} />}
                      meta={[`Sealed ${id}`, item.hub?.name || `Hub ${item.hubId}`]}
                      actions={
                        <PermissionGuard permission="logistics.book">
                          <Button size="sm" variant="ghost" onClick={() => setReceiptOrder(item.order?.publicId || item.orderId)}>
                            <Printer /> Receipt
                          </Button>
                          {unavailable ? (
                            <Button size="sm" variant="destructive" onClick={() => setSwitching({ kind: "book", item })}>
                              <Repeat /> Switch courier &amp; book
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSwitching({ kind: "book", item })}
                              >
                                <Repeat /> Switch
                              </Button>
                              <Button size="sm" onClick={() => void book(item)} disabled={pending === `book-${id}`}>
                                {pending === `book-${id}` ? (
                                  <HookLoader size="button" />
                                ) : (
                                  <>
                                    <Truck /> Book shipment
                                  </>
                                )}
                              </Button>
                            </>
                          )}
                        </PermissionGuard>
                      }
                    />
                  );
                })
              : registerRows.map((item, index) => {
                  const id = rowId(item, index, "shipment");
                  const options = nextStatuses[item.status || ""] || [];
                  const selected = chosenStatus[id] || options[0] || "";
                  const orderRef = item.order?.publicId || item.orderId;
                  const canSwitch = PRE_PICKUP.includes(item.status || "");
                  return (
                    <ListRow
                      key={id}
                      index={index + 1}
                      initials={initialsOf(item.courierName || item.provider || "shipment")}
                      title={<span className="truncate text-sm font-semibold text-zinc-950">{id}</span>}
                      subject={
                        <CourierBadge
                          courier={{ ...item.courier, code: item.courierCode, name: item.courierName || item.provider }}
                        />
                      }
                      meta={[
                        orderRef ? (
                          <Link href={`/dashboard/orders/${orderRef}`} className="hover:underline">
                            {orderRef}
                          </Link>
                        ) : (
                          "No order reference"
                        ),
                        item.trackingNumber,
                        item.hub?.name,
                        item.substitutedFrom ? `switched from ${item.substitutedFrom}` : undefined,
                      ]}
                      actions={
                        <>
                          <StatusBadge status={item.status || "BOOKED_WITH_PROVIDER"} />
                          {orderRef ? (
                            <Button size="sm" variant="ghost" onClick={() => setReceiptOrder(orderRef)}>
                              <Printer /> Receipt
                            </Button>
                          ) : null}
                          <PermissionGuard permission="logistics.manage">
                            {canSwitch ? (
                              <Button size="sm" variant="ghost" onClick={() => setSwitching({ kind: "reassign", shipment: item })}>
                                <Repeat /> Switch courier
                              </Button>
                            ) : null}
                            {options.length ? (
                              <>
                                <Select
                                  value={selected}
                                  onValueChange={(value) => setChosenStatus((current) => ({ ...current, [id]: value }))}
                                >
                                  <SelectTrigger className="h-8 w-[190px]">
                                    <SelectValue placeholder="Advance status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {options.map((option) => (
                                      <SelectItem key={option} value={option}>
                                        {label(option)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={pending === `status-${id}` || !selected}
                                  onClick={() => setConfirming({ shipment: item, status: selected })}
                                >
                                  <Check /> Advance
                                </Button>
                              </>
                            ) : null}
                          </PermissionGuard>
                        </>
                      }
                    />
                  );
                })}
          </QueryState>
        </CardContent>
      </Card>

      <ReceiptPrintDialog orderRef={receiptOrder} open={Boolean(receiptOrder)} onOpenChange={(open) => (open ? undefined : setReceiptOrder(undefined))} />
      <CourierSwitchDialog
        open={Boolean(switching)}
        onOpenChange={(open) => (open ? undefined : setSwitching(undefined))}
        current={switchingCurrent}
        alternatives={switchingAlternatives}
        title={switching?.kind === "book" ? "Book with a different courier" : "Switch courier"}
        description={
          switching?.kind === "book" && switching.item.chosenCourier?.available === false
            ? `${switching.item.chosenCourier?.name || "The chosen courier"} is unavailable. Pick another courier to book with.`
            : undefined
        }
        submitting={Boolean(pending?.startsWith("book-") || pending?.startsWith("switch-"))}
        onConfirm={(code, reason) => {
          if (!switching) return;
          if (switching.kind === "book") void book(switching.item, { code, reason });
          else void reassign(switching.shipment, code, reason);
        }}
      />

      <AlertDialog
        open={Boolean(confirming)}
        onOpenChange={(open) => (open ? undefined : setConfirming(undefined))}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Advance {confirming ? rowId(confirming.shipment, 0, "shipment") : "shipment"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Status changes from{" "}
              <span className="font-medium text-foreground">{label(confirming?.shipment.status)}</span>{" "}
              to <span className="font-medium text-foreground">{label(confirming?.status)}</span>. The
              customer is notified of this change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void advance();
              }}
              disabled={Boolean(pending)}
            >
              {pending ? <HookLoader size="button" variant="yellow" /> : "Advance shipment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
