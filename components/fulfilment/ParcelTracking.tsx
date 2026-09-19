"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageCheck, Truck } from "lucide-react";
import { PublicShell } from "@/components/public/PublicShell";
import { StatusBadge } from "@/components/shared/StatusBadge";

type Tracking = {
  receiptNumber: string;
  orderReference: string;
  status: string;
  packedAt?: string;
  courier?: string;
  trackingNumber?: string;
  destination?: string;
  events: Array<{ status?: string; at?: string }>;
};

const label = (value?: string) => String(value || "").replaceAll("_", " ").toLowerCase();

/** What a parcel's QR opens for anyone: status only, no personal details. */
export function ParcelTracking({ receipt, signature }: { receipt: string; signature: string }) {
  const [data, setData] = useState<Tracking>();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/public/parcels/${encodeURIComponent(receipt)}?s=${encodeURIComponent(signature)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "This parcel could not be found.");
        if (!cancelled) setData(payload.data as Tracking);
      })
      .catch((cause: Error) => !cancelled && setError(cause.message));
    return () => { cancelled = true; };
  }, [receipt, signature]);

  return (
    <PublicShell eyebrow="Parcel tracking" title={data ? data.orderReference : "Track your parcel"} description={`Receipt ${receipt}`} width="md" centered>
      {error ? (
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-foreground/10">{error}</p>
      ) : !data ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Looking up your parcel…</p>
      ) : (
        <div className="space-y-4 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-foreground/10">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold"><Truck className="size-4" /> Status</span>
            <StatusBadge status={data.status} />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Heading to</dt><dd className="font-medium">{data.destination || "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Courier</dt><dd className="font-medium">{data.courier || "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Tracking</dt><dd className="font-medium">{data.trackingNumber || "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Packed</dt><dd className="font-medium">{data.packedAt ? new Date(data.packedAt).toLocaleDateString("en-NG") : "—"}</dd></div>
          </dl>
          {data.events.length ? (
            <ol className="space-y-3 border-l pl-4">
              {[...data.events].reverse().map((event, index) => (
                <li key={index} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-foreground" />
                  <p className="font-medium capitalize">{label(event.status)}</p>
                  <p className="text-xs text-muted-foreground">{event.at ? new Date(event.at).toLocaleString("en-NG") : ""}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><PackageCheck className="size-4" /> Your parcel is packed and waiting for its courier.</p>
          )}
          <p className="border-t pt-3 text-center text-xs text-muted-foreground">
            Hook staff? <Link className="underline" href={`/dashboard/fulfilment/scan/${receipt}`}>Open in the dashboard</Link>
          </p>
        </div>
      )}
    </PublicShell>
  );
}
