"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/StatusBadge";

export type ItemResolutionView = {
  publicId?: string; id?: string; version: number; type: string; summary: string; status: string;
  originalSnapshot?: { title?: string; quantity?: number; selectedVariants?: { color?: string; size?: string }; unitPriceMinor?: number };
};

export function ItemResolutionCard({ issue, taskId }: { issue: ItemResolutionView; taskId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const original = issue.originalSnapshot || {};
  const [title, setTitle] = useState(original.title || "");
  const [color, setColor] = useState(original.selectedVariants?.color || "");
  const [size, setSize] = useState(original.selectedVariants?.size || "");
  const [quantity, setQuantity] = useState(String(original.quantity || 1));
  const [price, setPrice] = useState(String(Number(original.unitPriceMinor || 0) / 100));
  const [reason, setReason] = useState("");
  const canPropose = ["OPEN", "ADMIN_REVIEW", "DECLINED"].includes(issue.status);

  async function submit() {
    setPending(true);
    try {
      await apiPost(`/admin/fulfilment/issues/${issue.publicId || issue.id}/proposals`, {
        version: issue.version, productTitle: title, color, size, quantity: Number(quantity),
        unitPriceMinor: Math.round(Number(price) * 100), reason,
      });
      toast.success("Replacement sent to the customer for approval");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "fulfilment", "task", taskId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Proposal could not be sent");
    } finally { setPending(false); }
  }

  return <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 gap-2.5"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" /><div><p className="font-semibold">{original.title || "Order item"}</p><p className="mt-1 text-sm text-muted-foreground">{issue.summary}</p><p className="mt-1 text-xs font-medium uppercase tracking-wide text-amber-800">{issue.type.replaceAll("_", " ")}</p></div></div>
      <StatusBadge status={issue.status} />
    </div>
    {canPropose && <Button className="mt-4" size="sm" onClick={() => setOpen((value) => !value)}>{open ? "Close" : "Propose replacement"}</Button>}
    {open && <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Label>Replacement product</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} /></div>
      <div><Label>Colour</Label><Input value={color} onChange={(event) => setColor(event.target.value)} /></div>
      <div><Label>Size</Label><Input value={size} onChange={(event) => setSize(event.target.value)} /></div>
      <div><Label>Quantity</Label><Input inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ""))} /></div>
      <div><Label>Unit price (NGN)</Label><Input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value.replace(/[^0-9.]/g, ""))} /></div>
      <div className="sm:col-span-2"><Label>Reason shown to customer</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></div>
      <Button className="sm:col-span-2" disabled={pending || !title || !color || !size || !quantity || !price || reason.trim().length < 3} onClick={() => void submit()}>{pending ? "Sending…" : "Send for customer approval"}</Button>
    </div>}
    {["PAYMENT_PENDING", "REFUND_PENDING"].includes(issue.status) && <div className="mt-4 rounded-lg border border-amber-200 bg-white/70 p-3 text-sm text-amber-950"><p className="font-semibold">{issue.status === "PAYMENT_PENDING" ? "Waiting for the customer’s secure Paystack top-up" : "Paystack refund is being verified"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">This task resumes automatically after signed provider verification. No manual transaction reference is required.</p></div>}
  </div>;
}
