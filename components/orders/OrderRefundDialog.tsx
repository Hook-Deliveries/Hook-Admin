"use client";

import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HookLoader } from "@/components/shared/HookLoader";
import { apiPost } from "@/lib/api";

const money = (minor?: number) => `₦${(Number(minor || 0) / 100).toLocaleString()}`;

/**
 * Raises a refund against an order from the order itself.
 *
 * This used to live only on the Finance refunds page, where staff had to type
 * an order id into a free-text box — copied from somewhere else, and easy to
 * get wrong. Here the order and the captured amount are already known, so the
 * only real decisions left are how much and why.
 *
 * Creating the request does not move money: the Finance refund queue still
 * processes it against the provider.
 */
export function OrderRefundDialog({
  open,
  onOpenChange,
  orderId,
  capturedMinor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  capturedMinor: number;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  // One key per refund attempt. Clicking again after a timeout reuses it, so the
  // server returns the refund it already created instead of raising a second one.
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);

  const amountMinor = useMemo(() => Math.round(Number(amount || 0) * 100), [amount]);
  const overCaptured = capturedMinor > 0 && amountMinor > capturedMinor;
  const canSubmit = amountMinor > 0 && !overCaptured && reason.trim().length >= 3;

  function close() {
    attempt.current = null;
    setAmount("");
    setReason("");
    onOpenChange(false);
  }

  async function submit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const fingerprint = `${orderId}|${amountMinor}|${reason.trim()}`;
      if (attempt.current?.fingerprint !== fingerprint) {
        attempt.current = { fingerprint, key: `refund-${orderId}-${crypto.randomUUID()}` };
      }
      await apiPost("/admin/fulfilment/refunds", {
        orderId,
        amountMinor,
        reason: reason.trim(),
        idempotencyKey: attempt.current.key,
      });
      attempt.current = null;
      toast.success("Refund request created. Finance will process it from the refund queue.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "orders"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "fulfilment", "refunds"] }),
      ]);
      close();
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message.replace(/^\d+:\s*/, "")
          : "The refund request could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Refund this order</DialogTitle>
          <DialogDescription>
            Raises a refund request against {orderId}. Finance processes it against the captured
            provider balance — nothing is sent to the customer yet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="refund-amount" className="text-xs font-semibold">
                Amount (NGN)
              </Label>
              {capturedMinor > 0 ? (
                <button
                  type="button"
                  onClick={() => setAmount(String(capturedMinor / 100))}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                >
                  Refund full {money(capturedMinor)}
                </button>
              ) : null}
            </div>
            <Input
              id="refund-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
            />
            {overCaptured ? (
              <p className="text-[11px] font-medium text-destructive">
                More than the {money(capturedMinor)} captured on this order.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Partial refunds are allowed. The backend still enforces captured balance and
                return eligibility.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="refund-reason" className="text-xs font-semibold">
              Reason
            </Label>
            <Textarea
              id="refund-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this amount being refunded?"
              rows={3}
            />
            <p className="text-[11px] text-muted-foreground">
              Recorded on the refund and in the audit log.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit || saving}>
            {saving ? <HookLoader size="button" variant="dark" /> : "Create refund request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
