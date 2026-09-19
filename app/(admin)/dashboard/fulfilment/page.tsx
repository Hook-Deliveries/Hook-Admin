"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  ClipboardCheck,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HookLoader } from "@/components/shared/HookLoader";
import { AdminWorkflowSheet } from "@/components/shared/AdminWorkflowSheet";
import { MetricCard } from "@/components/shared/MetricCard";
import { StageStrip } from "@/components/fulfilment/StageStrip";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { taskAge } from "@/lib/fulfilment-progress";
import { QueryState } from "@/components/shared/QueryState";
import { ListRow, initialsOf } from "@/components/shared/ListRow";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { apiPost } from "@/lib/api";
import { useApiQuery } from "@/lib/query";

type NamedMarket = { name?: string; imageUrl?: string };
type NamedHub = { name?: string };
type NamedMarketAssociate = { name?: string; email?: string; avatarUrl?: string };
type NamedOrder = { publicId?: string };

type Row = {
  id?: string;
  publicId?: string;
  status?: string;
  marketId?: string;
  marketAssociateId?: string;
  hubId?: string;
  summary?: string;
  severity?: string;
  type?: string;
  orderId?: string;
  version?: number;
  createdAt?: string;
  issue?: { type?: string; summary?: string; reportedAt?: string } | null;
  market?: NamedMarket | null;
  hub?: NamedHub | null;
  marketAssociate?: NamedMarketAssociate | null;
  order?: NamedOrder | null;
};

type MarketAssociateOption = Row & {
  firstName?: string;
  lastName?: string;
  email?: string;
};

type Hub = Row & { name?: string; stateId?: string };
type DirectoryResponse<T> = { data: T[] } | T[];

type ControlTower = {
  tasks: Row[];
  shipments: Row[];
  returns: Row[];
  metrics: {
    openTasks: number;
    activeShipments: number;
    openReturns: number;
  };
};

type AssignmentForm = { marketAssociateId?: string; hubId?: string; reason?: string };

const identifier = (row?: Row) => row?.publicId || row?.id || "";

/**
 * The dashboard shows a prioritised preview, not the whole queue — the
 * dedicated workspaces are for working through everything. Both lists tell you
 * when they are truncated so a task never silently disappears off the bottom.
 */
const TASK_PREVIEW_LIMIT = 12;

export default function FulfilmentControlTowerPage() {
  const router = useRouter();
  const overviewQuery = useApiQuery<{
    sourcing: number; blocked: number; inbound: number; awaitingQc: number; readyToConsolidate: number;
    consolidating: number; readyToBook: number; inTransit: number; exceptions: number; failed?: number;
  }>(["admin", "fulfilment", "overview"], "/admin/fulfilment/overview");
  const overview = overviewQuery.data;
  const query = useApiQuery<ControlTower>(
    ["admin", "fulfilment", "control-tower"],
    "/admin/fulfilment/control-tower",
  );
  const marketAssociatesQuery = useApiQuery<DirectoryResponse<MarketAssociateOption>>(
    ["admin", "fulfilment", "market-associates"],
    "/admin/fulfilment/market-associates?limit=100",
  );
  const hubsQuery = useApiQuery<DirectoryResponse<Hub>>(
    ["admin", "fulfilment", "hubs"],
    "/admin/fulfilment/hubs?limit=100",
  );
  const supportQuery = useApiQuery<{ supportEmail?: string }>(
    ["admin", "support-contact"],
    "/admin/support-contact",
  );
  const supportEmail = supportQuery.data?.supportEmail;
  const [selectedTask, setSelectedTask] = useState<Row>();
  const [assignments, setAssignments] = useState<
    Record<string, AssignmentForm>
  >({});
  const [pending, setPending] = useState<string>();

  const data = query.data;
  const marketAssociates = Array.isArray(marketAssociatesQuery.data)
    ? marketAssociatesQuery.data
    : marketAssociatesQuery.data?.data || [];
  const hubs = Array.isArray(hubsQuery.data)
    ? hubsQuery.data
    : hubsQuery.data?.data || [];

  async function unblock(task: Row) {
    const taskId = identifier(task);
    if (!taskId) return;
    setPending(`unblock-${taskId}`);
    try {
      await apiPost(`/admin/fulfilment/tasks/${taskId}/unblock`, {
        reason: task.issue?.summary || "Cleared by operations",
      });
      toast.success("Task returned to the queue");
      await query.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message.replace(/^\d+:\s*/, "")
          : "Task could not be unblocked",
      );
    } finally {
      setPending(undefined);
    }
  }

  async function reassign() {
    const taskId = identifier(selectedTask);
    const form = taskId ? assignments[taskId] : undefined;
    if (
      !taskId ||
      !form?.marketAssociateId ||
      !form.hubId ||
      !form.reason?.trim() ||
      !selectedTask?.version
    ) {
      toast.error("Choose a Market Associate, Hub, and reason before reassigning");
      return;
    }

    setPending(`assign-${taskId}`);
    try {
      await apiPost(`/admin/fulfilment/tasks/${taskId}/reassign`, {
        ...form,
        reason: form.reason.trim(),
        version: selectedTask.version,
      });
      toast.success("Fulfilment task reassigned");
      setSelectedTask(undefined);
      await query.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message.replace(/^\d+:\s*/, "")
          : "Task could not be reassigned",
      );
    } finally {
      setPending(undefined);
    }
  }

  // Blocked tasks are the ones that need a human; surfaced on the task card
  // header so they are visible without scanning the whole list.
  const rawTasks = data?.tasks || [];
  const blockedTaskCount = rawTasks.filter((task) => task.status === "BLOCKED").length;

  // Blocked tasks need a human before anything else can move, so they lead.
  // Within each group the backend already returns oldest-first.
  const tasks = [...rawTasks].sort((left, right) => {
    const blocked = (task: Row) => (task.status === "BLOCKED" ? 0 : 1);
    return blocked(left) - blocked(right);
  });

  // Metrics describe where work actually sits, rather than counting rows.
  const AT_HUB = ["HUB_RECEIVED", "QC_PASSED"];
  const SOURCING = ["ALERTED", "ACCEPTED", "SOURCING", "PRODUCT_SECURED", "PACKING", "READY_FOR_HUB"];

  const metrics = data
    ? [
        {
          label: "Sourcing",
          value: tasks.filter((task) => SOURCING.includes(String(task.status))).length,
          icon: Box,
        },
        {
          label: "Blocked",
          value: blockedTaskCount,
          icon: AlertTriangle,
          intent: blockedTaskCount ? ("danger" as const) : ("neutral" as const),
        },
        {
          label: "At hub",
          value: tasks.filter((task) => AT_HUB.includes(String(task.status))).length,
          icon: ClipboardCheck,
        },
        {
          label: "In transit",
          value: data.metrics.activeShipments,
          icon: Truck,
        },
      ]
    : [];

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        className="mb-0"
        title="Fulfilment Control Tower"
        description="Monitor Market Associate sourcing, Hub readiness, shipments, returns, and refunds across the current operating scope."
      />

      <QueryState
        loading={query.isLoading}
        error={
          query.error ||
          (!data ? new Error("No fulfilment data was returned") : undefined)
        }
        loadingLabel="Loading fulfilment control tower..."
        errorTitle="Fulfilment operations could not be loaded"
        onRetry={() => query.refetch()}
      >
        {data ? (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {metrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} />
              ))}
            </div>

            {overview ? (
              <StageStrip
                onSelect={(key) => router.push(key === "sourcing" ? "/dashboard/fulfilment" : ["inbound", "qc", "failed", "consolidate"].includes(key) ? "/dashboard/fulfilment/hub" : "/dashboard/fulfilment/shipments")}
                stages={[
                  { key: "sourcing", label: "Sourcing", count: overview.sourcing, tone: overview.blocked ? "danger" : "default" },
                  { key: "inbound", label: "At hub", count: overview.inbound },
                  { key: "qc", label: "Quality check", count: overview.awaitingQc },
                  { key: "failed", label: "QC failed", count: overview.failed ?? 0, tone: overview.failed ? "danger" : "default" },
                  { key: "consolidate", label: "Consolidate", count: overview.readyToConsolidate + overview.consolidating },
                  { key: "book", label: "Ready to book", count: overview.readyToBook, tone: overview.readyToBook ? "warning" : "default" },
                  { key: "transit", label: "In transit", count: overview.inTransit },
                  { key: "exceptions", label: "Exceptions", count: overview.exceptions, tone: overview.exceptions ? "danger" : "default" },
                ]}
              />
            ) : null}

            <div className="grid gap-4">
              <Card className="gap-0 overflow-hidden rounded-lg py-0 shadow-card">
                <CardHeader className="flex-row items-center justify-between border-b px-4 py-3">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      Market Associate tasks
                    </CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Blocked first, then longest waiting
                    </p>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {blockedTaskCount ? (
                      <span className="mr-2 font-semibold text-destructive">
                        {blockedTaskCount} blocked
                      </span>
                    ) : null}
                    {tasks.length} active
                  </span>
                </CardHeader>
                <CardContent className="p-0">
                  {tasks.length ? (
                    tasks.slice(0, TASK_PREVIEW_LIMIT).map((task, index) => {
                      const taskId = identifier(task);
                      const canReassign = !["BLOCKED", "HUB_RECEIVED", "QC_PASSED"].includes(task.status || "");
                      const marketAssociateName = task.marketAssociate?.name;
                      return (
                        <ListRow
                          key={taskId}
                          index={index + 1}
                          initials={initialsOf(marketAssociateName || task.market?.name)}
                          title={
                            <Link
                              href={`/dashboard/fulfilment/tasks/${taskId}`}
                              className="truncate text-sm font-semibold text-zinc-950 hover:underline"
                            >
                              {task.market?.name || taskId}
                            </Link>
                          }
                          subject={marketAssociateName || "Unassigned"}
                          meta={
                            task.status === "BLOCKED"
                              ? [
                                  task.issue?.summary || "Blocked",
                                  supportEmail ? `Escalate: ${supportEmail}` : undefined,
                                  taskAge(task.createdAt),
                                ]
                              : [task.hub?.name || "No Hub", taskAge(task.createdAt)]
                          }
                          actions={
                            <>
                              <StatusBadge status={task.status || "Unknown"} />
                              {task.status === "BLOCKED" ? (
                                <PermissionGuard permission="fulfilment.assign">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void unblock(task)}
                                    disabled={pending === `unblock-${taskId}`}
                                  >
                                    {pending === `unblock-${taskId}` ? (
                                      <HookLoader size="button" />
                                    ) : (
                                      "Unblock"
                                    )}
                                  </Button>
                                </PermissionGuard>
                              ) : null}
                              {canReassign ? (
                                <PermissionGuard permission="fulfilment.assign">
                                  <Button variant="outline" size="sm" onClick={() => setSelectedTask(task)}>
                                    Reassign
                                  </Button>
                                </PermissionGuard>
                              ) : null}
                              <Button asChild variant="outline" size="icon-sm">
                                <Link href={`/dashboard/fulfilment/tasks/${taskId}`} aria-label={`View ${taskId}`}>
                                  <ArrowRight />
                                </Link>
                              </Button>
                            </>
                          }
                        />
                      );
                    })
                  ) : (
                    <QueryState
                      empty
                      emptyTitle="No active fulfilment tasks"
                      emptyDescription="New approved orders will appear here automatically."
                    />
                  )}
                  {tasks.length > TASK_PREVIEW_LIMIT ? (
                    <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                      Showing the {TASK_PREVIEW_LIMIT} most urgent of {tasks.length} tasks.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

          </>
        ) : null}
      </QueryState>

      <AdminWorkflowSheet
        open={Boolean(selectedTask)}
        onOpenChange={(open) => {
          if (!open && pending !== `assign-${identifier(selectedTask)}`) setSelectedTask(undefined);
        }}
        title="Reassign fulfilment task"
        description="Select a compatible Market Associate and Hub. The change is version-checked and recorded in the audit trail."
        footer={(
          <>
            <Button variant="outline" onClick={() => setSelectedTask(undefined)} disabled={pending === `assign-${identifier(selectedTask)}`}>Cancel</Button>
            <Button variant="brand" onClick={() => void reassign()} disabled={pending === `assign-${identifier(selectedTask)}`}>
              {pending === `assign-${identifier(selectedTask)}` ? <HookLoader size="button" variant="dark" /> : "Confirm reassignment"}
            </Button>
          </>
        )}
      >
          {selectedTask ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Market Associate</Label>
                  <Select
                    value={assignments[identifier(selectedTask)]?.marketAssociateId}
                    onValueChange={(value) =>
                      setAssignments((current) => ({
                        ...current,
                        [identifier(selectedTask)]: {
                          ...current[identifier(selectedTask)],
                          marketAssociateId: value,
                        },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Market Associate" />
                    </SelectTrigger>
                    <SelectContent>
                      {marketAssociates.map((marketAssociate) => {
                        const value = identifier(marketAssociate);
                        const name =
                          `${marketAssociate.firstName || ""} ${marketAssociate.lastName || ""}`.trim() ||
                          marketAssociate.email ||
                          value;
                        return value ? (
                          <SelectItem key={value} value={value}>
                            {name}
                          </SelectItem>
                        ) : null;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Dispatch Hub</Label>
                  <Select
                    value={assignments[identifier(selectedTask)]?.hubId}
                    onValueChange={(value) =>
                      setAssignments((current) => ({
                        ...current,
                        [identifier(selectedTask)]: {
                          ...current[identifier(selectedTask)],
                          hubId: value,
                        },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Hub" />
                    </SelectTrigger>
                    <SelectContent>
                      {hubs.map((hub) => {
                        const value = identifier(hub);
                        return value ? (
                          <SelectItem key={value} value={value}>
                            {hub.name || value}
                          </SelectItem>
                        ) : null;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reassign-reason">Audit reason</Label>
                <Textarea
                  id="reassign-reason"
                  value={assignments[identifier(selectedTask)]?.reason || ""}
                  onChange={(event) =>
                    setAssignments((current) => ({
                      ...current,
                      [identifier(selectedTask)]: {
                        ...current[identifier(selectedTask)],
                        reason: event.target.value,
                      },
                    }))
                  }
                  placeholder="Why is this task being reassigned?"
                />
              </div>
            </div>
          ) : null}
      </AdminWorkflowSheet>

    </div>
  );
}
