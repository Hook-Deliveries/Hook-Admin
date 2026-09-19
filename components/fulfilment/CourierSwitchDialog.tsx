"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { CourierInfo } from "./CourierBadge";

type SwitchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current?: CourierInfo;
  alternatives: CourierInfo[];
  title: string;
  description?: string;
  submitting?: boolean;
  onConfirm: (courierCode: string, reason: string) => void;
};

/**
 * Pick a substitute courier and give the customer a reason. Used both when the
 * chosen courier is unavailable at booking and when switching a booked
 * shipment before pickup.
 */
export function CourierSwitchDialog(props: SwitchProps) {
  // Mounted only while open so the form starts fresh each time.
  return props.open ? <SwitchForm {...props} /> : null;
}

function SwitchForm({
  open,
  onOpenChange,
  current,
  alternatives,
  title,
  description,
  submitting,
  onConfirm,
}: SwitchProps) {
  const options = alternatives.filter((item) => item.code && item.code !== current?.code);
  const [code, setCode] = useState(options[0]?.code || "");
  const [reason, setReason] = useState("");

  const picked = options.find((item) => item.code === code);
  const delta = picked?.feeMinor != null && current?.feeMinor != null ? picked.feeMinor - current.feeMinor : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description || "The customer is told which courier is delivering and why."}</DialogDescription>
        </DialogHeader>
        {options.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No other active courier is available. Activate one under Logistics providers first.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2">
              {options.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setCode(String(item.code))}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition",
                    code === item.code ? "border-foreground bg-muted" : "hover:bg-muted/50",
                  )}
                >
                  <span className="font-medium">{item.name || item.code}</span>
                  <span className="text-xs text-muted-foreground">{item.feeMinor != null ? money(item.feeMinor) : ""}</span>
                </button>
              ))}
            </div>
            {delta ? (
              <p className="text-xs text-muted-foreground">
                {delta > 0 ? "Costs" : "Saves"} {money(Math.abs(delta))} compared with the customer&apos;s courier. The customer&apos;s charge does not change.
              </p>
            ) : null}
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why the change? (shown to the customer)"
              rows={3}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={submitting || !code || reason.trim().length < 3} onClick={() => onConfirm(code, reason.trim())}>
            {submitting ? <Loader2 className="animate-spin" /> : "Confirm switch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
