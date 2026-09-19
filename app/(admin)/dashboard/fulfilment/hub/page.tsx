"use client";

import { useMemo, useState } from "react";
import { Eye, PackageCheck, Printer, ShieldCheck, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { HANDOVER_CODE_LENGTH, HandoverCodeInput } from "@/components/fulfilment/HandoverCodeInput";
import { HookLoader } from "@/components/shared/HookLoader";
import { PageHeader } from "@/components/shared/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PackageReviewSheet, type FailureDraft } from "@/components/fulfilment/PackageReviewSheet";
import { ReceiptPrintDialog } from "@/components/fulfilment/ReceiptPrintDialog";
import { StageStrip } from "@/components/fulfilment/StageStrip";
import { QueryState } from "@/components/shared/QueryState";
import { ListRow, initialsOf } from "@/components/shared/ListRow";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { apiPost } from "@/lib/api";
import { useApiQuery } from "@/lib/query";

type InboundRow = {
  id?: string;
  _id?: string;
  publicId?: string;
  hubId?: string;
  orderId?: string;
  status?: string;
  hub?: { name?: string } | null;
  order?: { publicId?: string } | null;
};

type PackageItemRow = {
  orderItemId: string;
  productTitle?: string;
  orderedPhotoUrl?: string;
  pickedUpPhotoUrl?: string;
  checks?: { productMatches: boolean; sizeMatches: boolean; colorMatches: boolean; quantityMatches: boolean };
  matched?: boolean;
};

type PackageRow = InboundRow & {
  taskId?: string;
  version?: number;
  itemIds?: string[];
  items?: PackageItemRow[];
  qualityChecks?: Array<{ orderItemId?: string; result?: string; reason?: string; note?: string; resolutionId?: string }>;
  marketAssociate?: { name?: string } | null;
};

type ConsolidationRow = {
  id?: string;
  _id?: string;
  publicId?: string;
  orderId?: string;
  hubId?: string;
  status?: string;
  version?: number;
  hub?: { name?: string } | null;
  order?: { publicId?: string } | null;
};

type HubData = {
  inbound: InboundRow[];
  packages: PackageRow[];
  consolidations: ConsolidationRow[];
};

// A failed package is "on hold" until it is sent back to the Market Associate.
const isOnHold = (item: { status?: string; qualityChecks?: Array<{ result?: string; resourced?: boolean }> }) =>
  item.status === "QC_FAILED" &&
  (!item.qualityChecks?.length || item.qualityChecks.some((check) => check.result === "failed" && !check.resourced));

const label = (value?: string) => String(value || "-").replaceAll("_", " ");

type HubOption = { publicId?: string; id?: string; name?: string };

export default function FulfilmentHubPage() {
  // Staff attached to one hub see theirs automatically; this filter only
  // matters for someone who can see several, who otherwise got every hub's
  // work merged into one list with no way to narrow.
  const [hubId, setHubId] = useState<string>("all");
  const [stage, setStage] = useState<"inbound" | "qc" | "failed" | "consolidate">("inbound");
  const hubsQuery = useApiQuery<{ data?: HubOption[] } | HubOption[]>(
    ["admin", "fulfilment", "hubs"],
    "/admin/fulfilment/hubs?limit=100",
  );
  const hubOptions = useMemo(() => {
    const raw = hubsQuery.data;
    return (Array.isArray(raw) ? raw : raw?.data || []) as HubOption[];
  }, [hubsQuery.data]);

  const query = useApiQuery<HubData>(
    ["admin", "fulfilment", "hub", hubId],
    `/admin/fulfilment/hub${hubId !== "all" ? `?hubId=${encodeURIComponent(hubId)}` : ""}`,
  );
  const [credential, setCredential] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string>();
  const [reviewId, setReviewId] = useState<string>();
  const [receiptOrder, setReceiptOrder] = useState<string>();
  const [failureDrafts, setFailureDrafts] = useState<Record<string, FailureDraft>>({});
  const [confirmedItems, setConfirmedItems] = useState<Record<string, boolean>>({});

  // Per package: what was typed, and what the last attempt told us.
  const [codeNotice, setCodeNotice] = useState<Record<string, { message: string; locked?: boolean }>>({});

  async function receive(item: InboundRow, typed?: string) {
    const id = item.publicId || item.id || item._id;
    const code = typed ?? (id ? credential[id] : "");
    if (!id || !item.hubId || code?.length !== HANDOVER_CODE_LENGTH || pending === id) return;
    setPending(id);
    setCodeNotice((current) => ({ ...current, [id]: { message: "" } }));
    try {
      await apiPost(`/admin/fulfilment/packages/${id}/receive`, {
        hubId: item.hubId,
        scanCredential: code,
        idempotencyKey: `hub-receive-${id}`,
      });
      toast.success(`Package ${id} received. It now needs a quality check.`);
      setCredential((current) => ({ ...current, [id]: "" }));
      await query.refetch();
    } catch (error) {
      // A wrong code, a lockout, or a network problem must all be visible: the
      // Hub cannot act on a button that silently does nothing.
      const failure = error as Error & { status?: number; details?: { attemptsRemaining?: number } };
      const locked = failure.status === 423 || /locked/i.test(failure.message);
      const remaining = failure.details?.attemptsRemaining;
      const message = locked
        ? "This package is locked after too many wrong codes. Ask an administrator to review it."
        : /invalid package handover code/i.test(failure.message)
          ? `That code does not match this package.${typeof remaining === "number" ? ` ${remaining} attempt${remaining === 1 ? "" : "s"} left before it locks.` : ""}`
          : failure.message.replace(/^\d+:\s*/, "") || "The package could not be received.";
      setCodeNotice((current) => ({ ...current, [id]: { message, locked } }));
      setCredential((current) => ({ ...current, [id]: "" }));
    } finally {
      setPending(undefined);
    }
  }

  async function qc(item: PackageRow, passed: boolean) {
    const id = item.publicId || item.id || item._id;
    if (!id) return;
    setPending(id);
    try {
      const checks = passed
        ? (item.items || []).map((row) => ({ orderItemId: row.orderItemId, confirmed: Boolean(confirmedItems[row.orderItemId]) }))
        : [];
      const failures = passed
        ? undefined
        : (item.items || [])
            .filter((row) => failureDrafts[row.orderItemId]?.reason)
            .map((row) => ({
              orderItemId: row.orderItemId,
              reason: failureDrafts[row.orderItemId]!.reason,
              note: (failureDrafts[row.orderItemId]?.note || "").trim(),
            }));
      await apiPost(`/admin/fulfilment/packages/${id}/qc`, {
        version: item.version,
        passed,
        checks,
        ...(failures ? { failures } : {}),
      });
      setFailureDrafts({});
      toast.success(passed ? `Package ${id} approved. It is ready to consolidate.` : `Package ${id} failed its check. An issue was opened for review.`);
      setReviewId(undefined);
      await query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "The quality check could not be saved.");
    } finally {
      setPending(undefined);
    }
  }

  // Half-typed problem reports belong to one package; never carry them over.
  function openReview(id: string) {
    setFailureDrafts({});
    setReviewId(id);
  }

  async function resource(item: PackageRow) {
    const id = item.publicId || item.id || item._id;
    if (!id) return;
    setPending(id);
    try {
      await apiPost(`/admin/fulfilment/packages/${id}/resource`, { version: item.version });
      toast.success("Sent back to the Market Associate to source again.");
      setReviewId(undefined);
      await query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "The package could not be sent back.");
    } finally {
      setPending(undefined);
    }
  }

  async function reopen(item: PackageRow) {
    const id = item.publicId || item.id || item._id;
    if (!id) return;
    setPending(id);
    try {
      await apiPost(`/admin/fulfilment/packages/${id}/qc/reopen`, { version: item.version });
      toast.success(`Package ${id} is back in the quality check.`);
      setReviewId(undefined);
      await query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "The check could not be re-opened.");
    } finally {
      setPending(undefined);
    }
  }

  async function consolidate(item: PackageRow) {
    const id = item.orderId;
    if (!id || !item.hubId) return;
    setPending(`consolidate-${id}`);
    try {
      await apiPost(`/admin/fulfilment/orders/${id}/consolidate`, { hubId: item.hubId });
      toast.success("Consolidation started. Seal the parcel when it is packed.");
      await query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "The consolidation could not be started.");
    } finally {
      setPending(undefined);
    }
  }

  async function seal(item: ConsolidationRow) {
    const id = item.publicId || item.id || item._id;
    if (!id) return;
    setPending(`seal-${id}`);
    try {
      await apiPost(`/admin/fulfilment/consolidations/${id}/seal`, { version: item.version });
      const orderRef = item.order?.publicId || item.orderId;
      toast.success("Parcel sealed.", {
        description: "Print the Hook receipt and stick it on the parcel.",
        action: orderRef
          ? { label: "Print receipt", onClick: () => setReceiptOrder(orderRef) }
          : undefined,
        duration: 12000,
      });
      await query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "The parcel could not be sealed.");
    } finally {
      setPending(undefined);
    }
  }

  const readyForConsolidation = useMemo(() => {
    const seen = new Set<string>();
    // An order with a failed package is held until that item is resolved.
    const held = new Set((query.data?.packages || []).filter(isOnHold).map((item) => item.orderId));
    return (query.data?.packages || []).filter((item) => {
      if (item.status !== "QC_PASSED" || !item.orderId || seen.has(item.orderId) || held.has(item.orderId)) return false;
      seen.add(item.orderId);
      return true;
    });
  }, [query.data?.packages]);

  // Packages awaiting or holding a quality decision. Computed once instead of
  // filtering the same array twice inline.
  const qcPackages = useMemo(
    () => (query.data?.packages || []).filter((item) =>
      ["RECEIVED", "QC_PENDING", "QC_PASSED"].includes(String(item.status)),
    ),
    [query.data?.packages],
  );

  const failedPackages = useMemo(
    () => (query.data?.packages || []).filter(isOnHold),
    [query.data?.packages],
  );
  const reviewing = [...qcPackages, ...failedPackages].find((item) => (item.publicId || item.id || item._id) === reviewId);

  const data = query.data;
  const inbound = data?.inbound || [];
  const consolidations = data?.consolidations || [];
  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        showBack={false}
        title="Dispatch Hub workspace"
        description="Receive Market Associate packages, complete visible quality checks, and prepare complete State Orders for dispatch."
        actions={
          hubOptions.length > 1 ? (
            <Select value={hubId} onValueChange={setHubId}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder="All hubs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All my hubs</SelectItem>
                {hubOptions.map((hub) => {
                  const value = String(hub.publicId || hub.id);
                  return (
                    <SelectItem key={value} value={value}>
                      {hub.name || value}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      <StageStrip
        active={stage}
        onSelect={(key) => setStage(key as "inbound" | "qc" | "failed" | "consolidate")}
        stages={[
          { key: "inbound", label: "Inbound", count: inbound.length, tone: inbound.length ? "warning" : "default" },
          { key: "qc", label: "Quality check", count: qcPackages.filter((item) => item.status !== "QC_PASSED").length },
          { key: "failed", label: "Failed", count: failedPackages.length, tone: failedPackages.length ? "danger" : "default" },
          { key: "consolidate", label: "Consolidate & seal", count: readyForConsolidation.length + consolidations.length },
        ]}
      />

      {stage === "inbound" ? (
      <Card className="rounded-lg shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Inbound Market Associate packages</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Verify the four-digit handover code written on the package before accepting custody.</p>
          </div>
          <Badge variant="outline">{inbound.length} waiting</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <QueryState
            loading={query.isLoading}
            error={query.error}
            empty={inbound.length === 0}
            loadingLabel="Loading Hub workspace"
            errorTitle="The Hub workspace could not be loaded"
            emptyTitle="Nothing awaiting receipt"
            emptyDescription="Market Associate packages appear here on their way to this hub."
            emptyIcon={Truck}
            onRetry={() => query.refetch()}
          >
            {inbound.map((item, index) => {
              const id = item.publicId || item.id || item._id || `inbound-${index}`;
              return (
                <div key={id} className="border-t border-zinc-100 first:border-t-0">
                  <ListRow
                    index={index + 1}
                    initials={initialsOf(item.hub?.name || "hub")}
                    title={<span className="truncate text-sm font-semibold text-zinc-950">{id}</span>}
                    subject={item.order?.publicId || item.orderId || undefined}
                    meta={[item.hub?.name || `Hub ${item.hubId || "-"}`, "Awaiting receipt"]}
                    actions={
                      <PermissionGuard permission="fulfilment.hub.receive">
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-2">
                            <HandoverCodeInput
                              value={credential[id] || ""}
                              invalid={Boolean(codeNotice[id]?.message)}
                              disabled={pending === id || codeNotice[id]?.locked}
                              ariaLabel={`Handover code for package ${id}`}
                              onChange={(value) => setCredential((current) => ({ ...current, [id]: value }))}
                              onComplete={(value) => void receive(item, value)}
                            />
                            <Button
                              size="sm"
                              onClick={() => void receive(item)}
                              disabled={pending === id || codeNotice[id]?.locked || (credential[id]?.length ?? 0) !== HANDOVER_CODE_LENGTH}
                            >
                              {pending === id ? (
                                <HookLoader size="button" />
                              ) : (
                                <>
                                  <PackageCheck /> Receive
                                </>
                              )}
                            </Button>
                          </div>
                          {codeNotice[id]?.message ? (
                            <p role="alert" className={`max-w-xs text-right text-xs ${codeNotice[id]?.locked ? "font-semibold text-destructive" : "text-destructive"}`}>
                              {codeNotice[id]?.message}
                            </p>
                          ) : null}
                        </div>
                      </PermissionGuard>
                    }
                  />
                </div>
              );
            })}
          </QueryState>
        </CardContent>
      </Card>
      ) : null}

      {stage === "qc" ? (
      <Card className="rounded-lg shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Visible quality checks</CardTitle>
          <Badge variant="outline">{qcPackages.length} in review</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <QueryState
            loading={query.isLoading}
            error={query.error}
            empty={qcPackages.length === 0}
            loadingLabel="Loading Hub workspace"
            errorTitle="The Hub workspace could not be loaded"
            emptyTitle="Nothing waiting for quality review"
            emptyDescription="Received packages appear here for their visible check."
            emptyIcon={PackageCheck}
            onRetry={() => query.refetch()}
          >
            {qcPackages.map((item, index) => {
              const id = item.publicId || item.id || item._id || `package-${index}`;
              const awaitingQc = item.status === "RECEIVED" || item.status === "QC_PENDING";
              const items = item.items || [];
              return (
                <div key={id} className="border-t border-zinc-100 first:border-t-0">
                  <ListRow
                    index={index + 1}
                    initials={initialsOf(item.hub?.name || "hub")}
                    title={<span className="truncate text-sm font-semibold text-zinc-950">{id}</span>}
                    subject={item.order?.publicId || item.orderId || undefined}
                    meta={[
                      item.hub?.name || `Hub ${item.hubId || "-"}`,
                      awaitingQc
                        ? `${items.length} item${items.length === 1 ? "" : "s"} to check`
                        : "Ready for consolidation",
                    ]}
                    actions={
                      <>
                        <StatusBadge status={item.status || "RECEIVED"} />
                        <Button size="sm" variant={awaitingQc ? "default" : "outline"} onClick={() => openReview(id)}>
                          <Eye /> {awaitingQc ? "Review & approve" : "View"}
                        </Button>
                      </>
                    }
                  />
                </div>
              );
            })}
          </QueryState>
        </CardContent>
      </Card>
      ) : null}

      {stage === "failed" ? (
        <Card className="rounded-lg shadow-none">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">Failed quality checks</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Held until each item issue is resolved, then re-open the check.</p>
            </div>
            <Badge variant="outline">{failedPackages.length} on hold</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <QueryState
              loading={query.isLoading}
              error={query.error}
              empty={failedPackages.length === 0}
              loadingLabel="Loading Hub workspace"
              errorTitle="The Hub workspace could not be loaded"
              emptyTitle="No failed packages"
              emptyDescription="Packages that fail their check are held here with the reason."
              emptyIcon={ShieldCheck}
              onRetry={() => query.refetch()}
            >
              {failedPackages.map((item, index) => {
                const id = item.publicId || item.id || item._id || `failed-${index}`;
                const failed = (item.qualityChecks || []).filter((entry) => entry.result === "failed");
                return (
                  <ListRow
                    key={id}
                    index={index + 1}
                    initials={initialsOf(item.hub?.name || "hub")}
                    title={<span className="truncate text-sm font-semibold text-zinc-950">{id}</span>}
                    subject={item.order?.publicId || item.orderId || undefined}
                    meta={[
                      item.hub?.name || `Hub ${item.hubId || "-"}`,
                      `${failed.length} item${failed.length === 1 ? "" : "s"} failed`,
                      failed[0]?.reason ? String(failed[0].reason).replaceAll("_", " ").toLowerCase() : undefined,
                    ]}
                    actions={
                      <>
                        <StatusBadge status="QC_FAILED" />
                        <Button size="sm" variant="outline" onClick={() => openReview(id)}>
                          <Eye /> View &amp; re-check
                        </Button>
                      </>
                    }
                  />
                );
              })}
            </QueryState>
          </CardContent>
        </Card>
      ) : null}

      {stage === "consolidate" ? (
      <Card className="rounded-lg shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Consolidation and final packing</CardTitle>
          <Badge variant="outline">
            {readyForConsolidation.length} ready · {consolidations.length} open
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <QueryState
            loading={query.isLoading}
            error={query.error}
            empty={readyForConsolidation.length === 0 && consolidations.length === 0}
            loadingLabel="Loading Hub workspace"
            errorTitle="The Hub workspace could not be loaded"
            emptyTitle="Nothing ready to consolidate"
            emptyDescription="Orders appear here once every package has passed QC."
            emptyIcon={ShieldCheck}
            onRetry={() => query.refetch()}
          >
            {readyForConsolidation.map((item, index) => {
              const id = `${item.orderId}-${item.hubId || index}`;
              return (
                <div key={id} className="border-t border-zinc-100 first:border-t-0">
                  <ListRow
                    index={index + 1}
                    initials={initialsOf(item.hub?.name || "hub")}
                    title={
                      <span className="truncate text-sm font-semibold text-zinc-950">
                        {item.order?.publicId || item.orderId}
                      </span>
                    }
                    meta={[
                      item.hub?.name || `Hub ${item.hubId || "-"}`,
                      "All active packages passed QC",
                    ]}
                    actions={
                      <PermissionGuard permission="fulfilment.consolidate">
                        <Button
                          size="sm"
                          onClick={() => void consolidate(item)}
                          disabled={pending === `consolidate-${item.orderId}`}
                        >
                          {pending === `consolidate-${item.orderId}` ? (
                            <HookLoader size="button" />
                          ) : (
                            "Start consolidation"
                          )}
                        </Button>
                      </PermissionGuard>
                    }
                  />
                </div>
              );
            })}
            {consolidations.map((item, index) => {
              const id = item.publicId || item.id || item._id || `consolidation-${index}`;
              return (
                <div key={id} className="border-t border-zinc-100 first:border-t-0">
                  <ListRow
                    index={readyForConsolidation.length + index + 1}
                    initials={initialsOf(item.hub?.name || "hub")}
                    title={<span className="truncate text-sm font-semibold text-zinc-950">{id}</span>}
                    subject={item.order?.publicId || item.orderId || undefined}
                    meta={[item.hub?.name || `Hub ${item.hubId || "-"}`, label(item.status)]}
                    actions={
                      item.status === "DRAFT" ? (
                        <PermissionGuard permission="fulfilment.consolidate">
                          <Button size="sm" onClick={() => void seal(item)} disabled={pending === `seal-${id}`}>
                            {pending === `seal-${id}` ? (
                              <HookLoader size="button" />
                            ) : (
                              <>
                                <ShieldCheck /> Seal parcel
                              </>
                            )}
                          </Button>
                        </PermissionGuard>
                      ) : (
                        <>
                          <StatusBadge status={item.status || "SEALED"} />
                          <Button size="sm" variant="outline" onClick={() => setReceiptOrder(item.order?.publicId || item.orderId)}>
                            <Printer /> Print receipt
                          </Button>
                        </>
                      )
                    }
                  />
                </div>
              );
            })}
          </QueryState>
        </CardContent>
      </Card>
      ) : null}
      <ReceiptPrintDialog orderRef={receiptOrder} open={Boolean(receiptOrder)} onOpenChange={(open) => (open ? undefined : setReceiptOrder(undefined))} />
      <PackageReviewSheet
        pkg={reviewing}
        open={Boolean(reviewing)}
        onOpenChange={(open) => (open ? undefined : setReviewId(undefined))}
        confirmed={confirmedItems}
        onConfirm={(orderItemId, value) => setConfirmedItems((current) => ({ ...current, [orderItemId]: value }))}
        pending={Boolean(reviewing && pending === (reviewing.publicId || reviewing.id || reviewing._id))}
        canDecide={reviewing?.status === "RECEIVED" || reviewing?.status === "QC_PENDING"}
        onApprove={() => reviewing && void qc(reviewing, true)}
        onFail={() => reviewing && void qc(reviewing, false)}
        failures={failureDrafts}
        onFailureChange={(orderItemId, draft) => setFailureDrafts((current) => ({ ...current, [orderItemId]: draft }))}
        canReopen={reviewing?.status === "QC_FAILED"}
        onReopen={() => reviewing && void reopen(reviewing)}
        onResource={() => reviewing && void resource(reviewing)}
      />
    </div>
  );
}
