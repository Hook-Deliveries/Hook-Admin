"use client";

import { useState } from "react";
import { CalendarClock, PackageCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { HookLoader } from "@/components/shared/HookLoader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { MobileButton, MobileEmpty, MobileHeader } from "@/components/mobile/MobileUI";
import { useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import { useApiQuery } from "@/lib/query";

type CustodyRecord = {
  publicId?: string;
  orderId?: string;
  status?: string;
  customerEmailSnapshot?: string;
  expiresAt?: string;
  receivedAt?: string;
  releasedAt?: string;
};

const statusLabel: Record<string, string> = {
  AWAITING_RECEIPT: "Awaiting receipt",
  IN_CUSTODY: "Ready for collection",
  RELEASED: "Collected",
  OVERDUE: "Overdue",
  RECOVERY: "Recovery required",
};

function formatDate(value?: string) {
  return value ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(value)) : "Not set";
}

export default function PartnerFulfilmentPage() {
  const custody = useApiQuery<CustodyRecord[]>(["partner", "custody"], "/partner/fulfilment/custody");
  const queryClient = useQueryClient();
  const [releaseCodes, setReleaseCodes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Custody moves order state, so the orders view has to resync alongside it. */
  function syncCustody() {
    void queryClient.invalidateQueries({ queryKey: ["partner", "custody"] });
    void queryClient.invalidateQueries({ queryKey: ["partner", "orders"] });
    void queryClient.invalidateQueries({ queryKey: ["partner", "notifications"] });
  }

  async function receive(record: CustodyRecord) {
    if (!record.publicId) return;
    setBusyId(record.publicId);
    try {
      await apiPost(`/partner/fulfilment/custody/${record.publicId}/receive`, {
        idempotencyKey: `partner-receive:${record.publicId}`,
      });
      syncCustody();
      toast.success("Package received into Partner custody");
    } catch {
      toast.error("The package could not be received");
    } finally {
      setBusyId(null);
    }
  }

  async function release(record: CustodyRecord) {
    if (!record.publicId) return;
    const code = releaseCodes[record.publicId] || "";
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter the customer's six-digit collection code");
      return;
    }
    setBusyId(record.publicId);
    try {
      await apiPost(`/partner/fulfilment/custody/${record.publicId}/release`, {
        code,
        idempotencyKey: `partner-release:${record.publicId}:${code}`,
      });
      syncCustody();
      toast.success("Order released to the customer");
    } catch {
      toast.error("The order could not be released");
    } finally {
      setBusyId(null);
    }
  }

  if (custody.isLoading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <HookLoader size="page" label="Loading Partner custody" />
      </div>
    );
  }

  const records = custody.data || [];

  return (
    <div>
      <MobileHeader
        title="Custody"
        subtitle="Receive and release packages for your location."
        action={
          records.length ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-[#8F8F8F]">
              {records.length}
            </span>
          ) : undefined
        }
      />

      {custody.isError ? (
        <div className="flex items-center gap-3 rounded-[10px] bg-white p-5 text-[13px] text-destructive">
          <ShieldAlert className="size-5 shrink-0" />
          Custody records are temporarily unavailable.
        </div>
      ) : !records.length ? (
        <MobileEmpty
          icon={PackageCheck}
          title="No incoming packages"
          description="Packages for this location appear here after dispatch."
        />
      ) : (
        <div className="space-y-3">
          {records.map((record) => {
            const id = record.publicId || "";
            const busy = busyId === id;
            return (
              <div key={String(record.publicId || record.orderId)} className="rounded-[10px] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-black">
                      {record.orderId || record.publicId}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-[#8F8F8F]">
                      {record.customerEmailSnapshot || "Customer details protected"}
                    </p>
                  </div>
                  <StatusBadge status={statusLabel[record.status || ""] || record.status || "Pending"} />
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-[12px] text-[#8F8F8F]">
                  <CalendarClock className="size-3.5" />
                  Custody window {formatDate(record.expiresAt)}
                  {record.receivedAt ? ` · Received ${formatDate(record.receivedAt)}` : ""}
                  {record.releasedAt ? ` · Released ${formatDate(record.releasedAt)}` : ""}
                </div>

                {record.status === "AWAITING_RECEIPT" && (
                  <div className="mt-4">
                    <MobileButton disabled={busy} onClick={() => void receive(record)}>
                      {busy ? <HookLoader size="button" /> : "Confirm package receipt"}
                    </MobileButton>
                  </div>
                )}

                {record.status === "IN_CUSTODY" && (
                  <div className="mt-4 space-y-2">
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit collection code"
                      value={releaseCodes[id] || ""}
                      onChange={(event) =>
                        setReleaseCodes((current) => ({
                          ...current,
                          [id]: event.target.value.replace(/\D/g, "").slice(0, 6),
                        }))
                      }
                      className="h-12 rounded-[10px] text-center font-mono text-lg tracking-[0.3em]"
                    />
                    <MobileButton disabled={busy} onClick={() => void release(record)}>
                      {busy ? <HookLoader size="button" /> : "Release to customer"}
                    </MobileButton>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
