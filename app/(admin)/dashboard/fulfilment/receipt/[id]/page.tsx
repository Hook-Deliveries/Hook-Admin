"use client";

import { use, useState } from "react";
import { Lock, Printer } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { HookReceipt, type ReceiptData } from "@/components/fulfilment/HookReceipt";
import { PageHeader } from "@/components/shared/PageHeader";
import { QueryState } from "@/components/shared/QueryState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/lib/query";

type Size = "a6" | "a4" | "thermal";
const SIZES: Record<Size, { label: string; width: string; height: string; page: string }> = {
  a6: { label: "Parcel label (A6)", width: "105mm", height: "148mm", page: "A6" },
  a4: { label: "Full receipt (A4)", width: "210mm", height: "297mm", page: "A4" },
  thermal: { label: "Thermal 4×6 in", width: "101.6mm", height: "152.4mm", page: "101.6mm 152.4mm" },
};

export default function HookReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [size, setSize] = useState<Size>("a6");
  const query = useApiQuery<ReceiptData>(
    ["admin", "fulfilment", "receipt", id],
    `/admin/fulfilment/orders/${encodeURIComponent(id)}/receipt`,
  );
  const spec = SIZES[size];
  const sealed = query.data?.status === "SEALED";
  const [printing, setPrinting] = useState(false);

  // Log the print first so the label itself carries the reprint mark, then
  // hand over to the browser. A failed log must not block a needed label.
  async function print() {
    setPrinting(true);
    try {
      await apiPost(`/admin/fulfilment/orders/${encodeURIComponent(id)}/receipt/print`, { size });
      await query.refetch();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message.replace(/^\d+:\s*/, "") : "The print could not be logged.");
    } finally {
      setPrinting(false);
    }
    setTimeout(() => window.print(), 150);
  }

  return (
    <div className="w-full space-y-5 px-4 py-5">
      {/* Print only the receipt: everything else on the page is hidden, and the
          sheet is sized to the chosen paper with no browser margins. */}
      <style>{`
        @media print {
          @page { size: ${spec.page}; margin: 0; }
          body * { visibility: hidden !important; }
          .hook-receipt-sheet, .hook-receipt-sheet * { visibility: visible !important; }
          .hook-receipt-sheet { position: fixed; inset: 0; width: ${spec.width}; height: ${spec.height}; box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      <div className="print:hidden">
        <PageHeader
          title="Hook receipt"
          description="Print this and stick it on the parcel. Reprint any time; it always reflects the latest order details."
          actions={
            <div className="flex items-center gap-2">
              <Tabs value={size} onValueChange={(value) => setSize(value as Size)}>
                <TabsList>
                  {(Object.keys(SIZES) as Size[]).map((key) => (
                    <TabsTrigger key={key} value={key}>{SIZES[key].label}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Button onClick={() => void print()} disabled={!sealed || printing}>
                <Printer /> Print
              </Button>
            </div>
          }
        />
      </div>

      {query.data && !sealed ? (
        <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-4 py-3 text-sm print:hidden">
          <Lock className="size-4 shrink-0" />
          This parcel is not sealed yet. Seal it at the Hub to print its label, so a label never goes on an incomplete parcel.
        </div>
      ) : null}
      {query.data?.printCount ? (
        <p className="text-xs text-muted-foreground print:hidden">
          Printed {query.data.printCount} time{query.data.printCount === 1 ? "" : "s"}. Reprints carry a red “Reprint” mark.
        </p>
      ) : null}

      <QueryState
        loading={query.isLoading}
        error={query.error}
        loadingLabel="Preparing receipt"
        errorTitle="The receipt could not be loaded"
        onRetry={() => query.refetch()}
      >
        {query.data ? (
          <div className="flex justify-center print:block">
            <div
              className="hook-receipt-sheet overflow-hidden rounded-md border bg-white shadow-lg"
              style={{ width: spec.width, minHeight: spec.height }}
            >
              <HookReceipt data={query.data} scanUrl={typeof window === "undefined" ? undefined : `${window.location.origin}/dashboard/fulfilment/scan/${query.data.receiptNumber}`} />
            </div>
          </div>
        ) : null}
      </QueryState>
    </div>
  );
}
