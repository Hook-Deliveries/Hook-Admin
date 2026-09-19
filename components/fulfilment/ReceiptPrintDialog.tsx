"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Lock, Printer } from "lucide-react";
import { toast } from "sonner";
import { HookReceipt, type ReceiptData } from "@/components/fulfilment/HookReceipt";
import { HookLoader } from "@/components/shared/HookLoader";
import { QueryState } from "@/components/shared/QueryState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiPost } from "@/lib/api";
import { useApiQuery } from "@/lib/query";

type Size = "a6" | "a4" | "thermal";
const SIZES: Record<Size, { label: string; width: string; height: string; page: string; zoom: number }> = {
  a6: { label: "Label A6", width: "105mm", height: "148mm", page: "A6", zoom: 0.95 },
  thermal: { label: "Thermal 4×6", width: "101.6mm", height: "152.4mm", page: "101.6mm 152.4mm", zoom: 0.95 },
  a4: { label: "Receipt A4", width: "210mm", height: "297mm", page: "A4", zoom: 0.5 },
};

/**
 * Preview and print a parcel receipt without leaving the page. The printable
 * copy is portalled to <body> and everything else is hidden while printing,
 * so the Hub keeps its place (consolidate, seal, next parcel) the whole time.
 */
export function ReceiptPrintDialog({
  orderRef,
  open,
  onOpenChange,
}: {
  orderRef?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [size, setSize] = useState<Size>("a6");
  const [parcelRef, setParcelRef] = useState<string>();
  const [printing, setPrinting] = useState(false);
  const query = useApiQuery<ReceiptData>(
    ["admin", "fulfilment", "receipt", orderRef, parcelRef],
    `/admin/fulfilment/orders/${encodeURIComponent(orderRef || "")}/receipt${parcelRef ? `?consolidationId=${encodeURIComponent(parcelRef)}` : ""}`,
    open && Boolean(orderRef),
  );
  const data = query.data;
  const spec = SIZES[size];
  const sealed = data?.status === "SEALED";
  const scanUrl = data && typeof window !== "undefined" ? `${window.location.origin}/track/${data.receiptNumber}?s=${(data as ReceiptData & { trackingSig?: string }).trackingSig || ""}` : undefined;

  async function print() {
    setPrinting(true);
    try {
      await apiPost(`/admin/fulfilment/orders/${encodeURIComponent(orderRef || "")}/receipt/print`, { size, ...(parcelRef ? { consolidationId: parcelRef } : {}) });
      await query.refetch();
    } catch (cause) {
      // A failed log must not block a label the Hub needs now.
      toast.error(cause instanceof Error ? cause.message.replace(/^\d+:\s*/, "") : "The print could not be logged.");
    } finally {
      setPrinting(false);
    }
    setTimeout(() => window.print(), 150);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>Hook receipt {orderRef ? `· ${orderRef}` : ""}</DialogTitle>
            <DialogDescription>Print it and stick it on the parcel. Reprints are logged and marked.</DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2 px-5 pt-3">
            <Tabs value={size} onValueChange={(value) => setSize(value as Size)}>
              <TabsList>
                {(Object.keys(SIZES) as Size[]).map((key) => (
                  <TabsTrigger key={key} value={key}>{SIZES[key].label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {data?.parcelOptions && data.parcelOptions.length > 1 ? (
              <Select value={parcelRef || data.parcel?.reference} onValueChange={setParcelRef}>
                <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {data.parcelOptions.map((option) => <SelectItem key={option.reference} value={String(option.reference)}>Parcel {option.reference}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : null}
            {data?.printCount ? <span className="text-xs text-muted-foreground">Printed {data.printCount}×</span> : null}
          </div>

          <div className="max-h-[58vh] overflow-auto bg-muted/40 px-5 py-4">
            <QueryState
              loading={query.isLoading}
              error={query.error}
              loadingLabel="Preparing receipt"
              errorTitle="The receipt could not be loaded"
              onRetry={() => query.refetch()}
            >
              {data ? (
                <div className="flex justify-center">
                  <div style={{ zoom: spec.zoom }}>
                    <div className="overflow-hidden rounded-md border bg-white shadow-lg" style={{ width: spec.width, minHeight: spec.height }}>
                      <HookReceipt data={data} scanUrl={scanUrl} />
                    </div>
                  </div>
                </div>
              ) : null}
            </QueryState>
          </div>

          <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
            {data && !sealed ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" /> Seal the parcel first to print its label.
              </p>
            ) : (
              <Button variant="ghost" size="sm" asChild>
                <a href={`/dashboard/fulfilment/receipt/${orderRef}`} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open full page
                </a>
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button onClick={() => void print()} disabled={!sealed || printing}>
                {printing ? <HookLoader size="button" /> : <><Printer /> Print</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {open && data && typeof document !== "undefined"
        ? createPortal(
            <div className="hook-print-root" style={{ width: spec.width, height: spec.height }}>
              <style>{`
                .hook-print-root { display: none; }
                @media print {
                  @page { size: ${spec.page}; margin: 0; }
                  body > *:not(.hook-print-root) { display: none !important; }
                  .hook-print-root { display: block !important; position: fixed; inset: 0; background: white; }
                }
              `}</style>
              <HookReceipt data={data} scanUrl={scanUrl} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
