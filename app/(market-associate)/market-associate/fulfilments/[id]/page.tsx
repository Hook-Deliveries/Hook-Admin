"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Package } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { HookLoader } from "@/components/shared/HookLoader";
import { MobileEmpty } from "@/components/mobile/MobileUI";
import { ACTION_BAR_BUTTON, StickyActionBar } from "@/components/mobile/StickyActionBar";
import { HandoverCard, HandoverUnavailableCard, HubReceivedCard } from "@/components/market-associate/fulfilment/HandoverCard";
import { HandoverSheet } from "@/components/market-associate/fulfilment/HandoverSheet";
import { IssueSheet } from "@/components/market-associate/fulfilment/IssueSheet";
import { ProductCard, type ProductState } from "@/components/market-associate/fulfilment/ProductCard";
import { TaskHeader } from "@/components/market-associate/fulfilment/TaskHeader";
import { VerificationForm } from "@/components/market-associate/fulfilment/VerificationForm";
import {
  ACTIONS, SOURCING_STATUSES, cleanError, itemId, itemLabel,
  type Task,
} from "@/components/market-associate/fulfilment/types";
import { apiPost } from "@/lib/api";
import { APP_ACTION_BAR_CONTENT_INSET } from "@/lib/tab-bar-layout";
import { useApiQuery } from "@/lib/query";
import { cn } from "@/lib/utils";

const RESOLVED_ISSUE = ["RESOLVED", "CANCELLED"];

export default function MarketAssociateFulfilmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useApiQuery<Task>(
    ["marketassociate", "fulfilment", params.id],
    `/market-associate/fulfilments/${params.id}`,
    Boolean(params.id),
  );
  const [pending, setPending] = useState(false);
  const [credential, setCredential] = useState<string>();
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [issueFor, setIssueFor] = useState<{ open: boolean; itemId?: string }>({ open: false });
  const [handover, setHandover] = useState<{ open: boolean; justSubmitted: boolean }>({ open: false, justSubmitted: false });

  /**
   * A task change also moves the fulfilments list and the dashboard counters,
   * so refetching this detail alone would leave those showing the old state.
   */
  function syncTask() {
    for (const key of [["fulfilment", params.id], ["fulfilments"], ["catalog-dashboard"], ["notifications"]]) {
      void queryClient.invalidateQueries({ queryKey: ["marketassociate", ...key] });
    }
  }

  async function runAction(action: string) {
    setPending(true);
    try {
      const result = await apiPost<Task>(`/market-associate/fulfilments/${params.id}/${action}`, { version: query.data?.version });
      setCredential(result.package?.scanCredential);
      syncTask();
      if (action === "submit" && result.package?.scanCredential) {
        // Show the code straight away from the response; do not wait for a refetch.
        setHandover({ open: true, justSubmitted: true });
      } else {
        toast.success(action === "accept" ? "Task accepted" : "Fulfilment submitted");
      }
    } catch (error) {
      toast.error(cleanError(error, "Task could not be updated"));
    } finally {
      setPending(false);
    }
  }

  async function regenerateCode() {
    setPending(true);
    try {
      const result = await apiPost<Task>(`/market-associate/fulfilments/${params.id}/handover-code`);
      setCredential(result.package?.scanCredential);
      syncTask();
      setHandover({ open: true, justSubmitted: false });
    } catch (error) {
      toast.error(cleanError(error, "A new code could not be issued"));
    } finally {
      setPending(false);
    }
  }

  if (query.isLoading) {
    return <div className="grid min-h-80 place-items-center"><HookLoader label="Loading fulfilment task" /></div>;
  }
  const task = query.data;
  if (!task) {
    return (
      <div className="pt-6">
        <MobileEmpty icon={Package} title="Task not found" description="This fulfilment task may have been reassigned or removed." action={
          <button type="button" onClick={() => router.push("/market-associate/fulfilments")} className="flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#FFC809] text-[15px] font-bold text-black">Back to fulfilments</button>
        } />
      </div>
    );
  }

  const items = task.items || [];
  const verifications = task.itemVerifications || [];
  const status = task.status || "";
  const title = task.publicId || task.id || params.id || "Fulfilment task";
  const canVerify = SOURCING_STATUSES.includes(status);
  const hubReceived = status === "HUB_RECEIVED" || task.package?.status === "HUB_RECEIVED";
  const code = credential || task.package?.scanCredential;
  const openIssues = (task.issues || []).filter((entry) => !RESOLVED_ISSUE.includes(String(entry.status)));
  const verified = items.filter((item) => verifications.some((v) => v.orderItemId === itemId(item) && v.matched)).length;
  const canSubmit = items.length > 0 && verified === items.length && openIssues.length === 0;
  const next = ACTIONS[status];

  const selectedIndex = items.findIndex((item) => itemId(item) === selectedItemId);
  const selectedItem = selectedIndex >= 0 ? items[selectedIndex] : undefined;
  const issueItem = items.find((item) => itemId(item) === issueFor.itemId);

  const stateOf = (id: string): ProductState => {
    const verification = verifications.find((v) => v.orderItemId === id);
    if (openIssues.some((entry) => entry.orderItemId === id)) return "issue";
    if (verification?.matched) return "verified";
    if (verification) return "attention";
    return canVerify ? "todo" : "locked";
  };
  const lockedNote = hubReceived ? "Received by Hub" : status === "READY_FOR_HUB" ? "Submitted to Hub" : "Accept the task to begin";

  const issueSheet = (
    <IssueSheet
      // A fresh sheet per target keeps its idempotency key and text from leaking between products.
      key={issueFor.itemId || "task"}
      open={issueFor.open}
      onOpenChange={(open) => setIssueFor((current) => ({ ...current, open }))}
      taskRouteId={params.id}
      itemId={issueFor.itemId}
      itemName={issueItem ? itemLabel(issueItem) : undefined}
      onReported={syncTask}
    />
  );

  const bottomInset = { paddingBottom: `calc(${APP_ACTION_BAR_CONTENT_INSET}px + 1.5rem)` };

  if (selectedItem) {
    return (
      <div style={bottomInset}>
        <VerificationForm
          key={itemId(selectedItem)}
          taskRouteId={params.id}
          item={selectedItem}
          index={selectedIndex}
          total={items.length}
          existing={verifications.find((v) => v.orderItemId === itemId(selectedItem))}
          onClose={() => setSelectedItemId(undefined)}
          onNavigate={(direction) => setSelectedItemId(itemId(items[selectedIndex + direction]))}
          onSaved={() => { syncTask(); setSelectedItemId(undefined); }}
          onReportIssue={() => setIssueFor({ open: true, itemId: itemId(selectedItem) })}
        />
        {issueSheet}
      </div>
    );
  }

  return (
    <div style={next ? bottomInset : undefined}>
      <button type="button" onClick={() => router.back()} className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-semibold text-[#6B6B6B] hover:bg-black/5">
        <ArrowLeft className="size-4" /> Fulfilments
      </button>

      <TaskHeader task={task} title={title} verified={verified} total={items.length} />

      {code && !hubReceived && <HandoverCard task={task} code={code} itemCount={items.length} onShowLarge={() => setHandover({ open: true, justSubmitted: false })} />}
      {!code && !hubReceived && status === "READY_FOR_HUB" && task.package?.credentialUnavailable && <HandoverUnavailableCard pending={pending} onRegenerate={() => void regenerateCode()} />}
      {hubReceived && <HubReceivedCard task={task} />}

      {openIssues.length > 0 && (
        <div role="status" className="mb-5 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-[13px] leading-5 text-red-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p><span className="font-semibold">{openIssues.length} open issue{openIssues.length === 1 ? "" : "s"}.</span> Operations is reviewing. You can submit once {openIssues.length === 1 ? "it is" : "they are"} resolved.</p>
        </div>
      )}

      <section aria-labelledby="products-heading" className="mb-6">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 id="products-heading" className="text-[15px] font-semibold text-black">{canVerify ? "Products to source" : `Products (${items.length})`}</h2>
          {canVerify && items.length > 0 && <span className="text-[12px] text-[#8F8F8F]">Tap a product to verify it</span>}
        </div>
        {items.length ? (
          <ul className="space-y-2.5">
            {items.map((item, index) => {
              const id = itemId(item);
              return (
                <li key={id || index}>
                  <ProductCard item={item} index={index} state={stateOf(id)} lockedNote={lockedNote} onOpen={canVerify ? () => setSelectedItemId(id) : undefined} />
                </li>
              );
            })}
          </ul>
        ) : status === "READY_FOR_HUB" ? (
          <p className="rounded-2xl bg-white p-4 text-center text-[13px] text-[#8F8F8F] shadow-sm ring-1 ring-black/5">Take the sealed package and its handover code to the assigned Hook Hub.</p>
        ) : hubReceived ? null : (
          <MobileEmpty icon={Package} title="No product details" description="Item details are not available for this task yet." />
        )}
      </section>

      {canVerify && (
        <button type="button" onClick={() => setIssueFor({ open: true })} className="mb-2 flex w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-white py-3 text-[14px] font-bold text-red-600 hover:bg-red-50">
          <AlertTriangle className="size-4" /> Report a problem with this task
        </button>
      )}

      {next && (
        <StickyActionBar className="flex-col items-stretch gap-0 px-2 py-2">
          {next.action === "submit" && !canSubmit && (
            <p className="px-2 pb-2 text-center text-[12px] leading-4 text-[#8F8F8F]">
              {verified < items.length ? `${items.length - verified} product${items.length - verified === 1 ? "" : "s"} still to verify` : `Resolve ${openIssues.length} open issue${openIssues.length === 1 ? "" : "s"} first`}
            </p>
          )}
          <button
            type="button"
            disabled={pending || (next.action === "submit" && !canSubmit)}
            onClick={() => void runAction(next.action)}
            className={cn(ACTION_BAR_BUTTON, "flex w-full items-center justify-center gap-2 rounded-full bg-[#FFC809] px-5 font-bold text-black transition hover:bg-[#f0bb00] disabled:opacity-40")}
          >
            {pending ? <HookLoader size="button" /> : <><Check className="size-[18px]" strokeWidth={3} /> {next.label}</>}
          </button>
        </StickyActionBar>
      )}

      {issueSheet}
      {code && (
        <HandoverSheet
          open={handover.open}
          onOpenChange={(open) => setHandover((current) => ({ ...current, open }))}
          task={task}
          code={code}
          itemCount={items.length}
          justSubmitted={handover.justSubmitted}
        />
      )}
    </div>
  );
}
