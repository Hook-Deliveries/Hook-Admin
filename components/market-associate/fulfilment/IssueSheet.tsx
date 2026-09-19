"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { HookLoader } from "@/components/shared/HookLoader";
import { MobileButton } from "@/components/mobile/MobileUI";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ISSUE_TYPES, cleanError } from "./types";

const MIN_LENGTH = 5;

/**
 * Report a blocker for one product (or the whole task). The idempotency key is
 * created once per open sheet and reused on retry, so a slow connection and a
 * second tap raise one issue, not two.
 */
export function IssueSheet({
  open,
  onOpenChange,
  taskRouteId,
  itemId,
  itemName,
  onReported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskRouteId: string;
  itemId?: string;
  itemName?: string;
  onReported: () => void;
}) {
  const [type, setType] = useState<string>("PRODUCT_UNAVAILABLE");
  const [summary, setSummary] = useState("");
  const [pending, setPending] = useState(false);
  const key = useRef<string>(crypto.randomUUID());
  const ready = summary.trim().length >= MIN_LENGTH;

  async function submit() {
    if (!ready || pending) return;
    setPending(true);
    try {
      await apiPost(
        itemId ? `/market-associate/fulfilments/${taskRouteId}/items/${itemId}/issues` : `/market-associate/fulfilments/${taskRouteId}/issues`,
        { summary: summary.trim(), type: itemId ? type : "ITEM_UNAVAILABLE", orderItemId: itemId, idempotencyKey: key.current },
      );
      key.current = crypto.randomUUID();
      setSummary("");
      onOpenChange(false);
      onReported();
      toast.success("Issue reported. Operations has been told.");
    } catch (error) {
      toast.error(cleanError(error, "Issue could not be reported"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-3xl border-x">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-[17px] font-bold"><AlertTriangle className="size-5 text-red-600" />Report an issue</SheetTitle>
          <SheetDescription className="text-[13px] text-[#8F8F8F]">
            {itemName ? <>What is blocking <span className="font-semibold text-black">{itemName}</span>?</> : "Tell operations what is blocking this task."}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-6">
          {itemId && (
            <div role="radiogroup" aria-label="Issue type" className="grid grid-cols-2 gap-2">
              {ISSUE_TYPES.map((option) => {
                const selected = option.value === type;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setType(option.value)}
                    className={cn(
                      "flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-[13px] font-medium transition",
                      selected ? "border-black bg-black text-white" : "border-zinc-200 bg-white text-black hover:bg-zinc-50",
                    )}
                  >
                    {option.label}
                    {selected && <Check className="size-4 shrink-0 text-[#FFC809]" />}
                  </button>
                );
              })}
            </div>
          )}
          <div>
            <Textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              maxLength={500}
              placeholder="Describe what you found, e.g. the vendor has no black in size 42"
              className="min-h-28 rounded-xl"
            />
            <p className="mt-1.5 flex justify-between text-[11px] text-[#8F8F8F]">
              <span>{ready ? "" : `At least ${MIN_LENGTH} characters`}</span>
              <span className="tabular-nums">{summary.length}/500</span>
            </p>
          </div>
          <MobileButton variant="danger" onClick={() => void submit()} disabled={pending || !ready}>
            {pending ? <HookLoader size="button" /> : "Submit issue"}
          </MobileButton>
        </div>
      </SheetContent>
    </Sheet>
  );
}
