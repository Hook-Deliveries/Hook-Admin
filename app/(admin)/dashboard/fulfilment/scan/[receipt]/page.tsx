"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Check, Printer } from "lucide-react";
import { toast } from "sonner";
import type { ReceiptData } from "@/components/fulfilment/HookReceipt";
import { HookLoader } from "@/components/shared/HookLoader";
import { PageHeader } from "@/components/shared/PageHeader";
import { QueryState } from "@/components/shared/QueryState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { apiPatch } from "@/lib/api";
import { useApiQuery } from "@/lib/query";

const NEXT: Record<string, { status: string; label: string }> = {
  BOOKED_WITH_PROVIDER: { status: "AWAITING_PICKUP", label: "Mark ready for courier pickup" },
  AWAITING_PICKUP: { status: "PICKED_UP", label: "Confirm courier collected the parcel" },
};

const label = (value?: string) => String(value || "-").replaceAll("_", " ");

/** Where the QR on a parcel lands: the parcel's live status and its next step. */
export default function ParcelScanPage({ params }: { params: Promise<{ receipt: string }> }) {
  const { receipt } = use(params);
  const orderRef = decodeURIComponent(receipt).replace(/^RCT-/, "ORD-");
  const query = useApiQuery<ReceiptData>(
    ["admin", "fulfilment", "scan", orderRef],
    `/admin/fulfilment/orders/${encodeURIComponent(orderRef)}/receipt`,
  );
  const [pending, setPending] = useState(false);
  const data = query.data;
  const step = data?.shipment?.status ? NEXT[data.shipment.status] : undefined;

  async function advance() {
    if (!data?.shipment?.publicId || !step) return;
    setPending(true);
    try {
      await apiPatch(`/admin/fulfilment/shipments/${data.shipment.publicId}`, { status: step.status, version: data.shipment.version });
      toast.success("Parcel updated.");
      await query.refetch();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message.replace(/^\d+:\s*/, "") : "The parcel could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-5">
      <PageHeader showBack={false} title={data?.order.publicId || "Parcel"} description={`Receipt ${receipt}`} />
      <QueryState
        loading={query.isLoading}
        error={query.error}
        loadingLabel="Looking up parcel"
        errorTitle="This parcel could not be found"
        onRetry={() => query.refetch()}
      >
        {data ? (
          <>
            <Card className="rounded-lg shadow-none">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Status</CardTitle>
                <StatusBadge status={data.shipment?.status || data.status} />
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <dl className="grid grid-cols-2 gap-3">
                  <div><dt className="text-xs text-muted-foreground">Deliver to</dt><dd className="font-medium">{data.recipient.name}, {data.recipient.city}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Courier</dt><dd className="font-medium">{data.courier?.name || "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Tracking</dt><dd className="font-medium">{data.courier?.trackingNumber || "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Seal</dt><dd className="font-medium">{data.parcel?.sealReference || "—"}</dd></div>
                </dl>
                {(data.payment?.collectMinor || 0) > 0 ? (
                  <p className="rounded-md bg-zinc-950 px-3 py-2 text-center font-semibold text-white">Pay at handover: collect the amount printed on the receipt</p>
                ) : null}
                {step ? (
                  <PermissionGuard permission="logistics.manage">
                    <Button className="w-full" onClick={() => void advance()} disabled={pending}>
                      {pending ? <HookLoader size="button" /> : <><Check /> {step.label}</>}
                    </Button>
                  </PermissionGuard>
                ) : null}
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/dashboard/fulfilment/receipt/${data.order.publicId}`}><Printer /> Open receipt</Link>
                </Button>
              </CardContent>
            </Card>

            {data.shipment?.events?.length ? (
              <Card className="rounded-lg shadow-none">
                <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
                <CardContent>
                  <ol className="space-y-3 border-l pl-4">
                    {[...data.shipment.events].reverse().map((event, index) => (
                      <li key={index} className="relative text-sm">
                        <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-foreground" />
                        <p className="font-medium">{label(event.status)}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.at ? new Date(event.at).toLocaleString("en-NG") : ""}{event.note ? ` · ${event.note}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}
      </QueryState>
    </div>
  );
}
