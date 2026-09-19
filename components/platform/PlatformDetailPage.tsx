"use client";

import { useParams, useRouter } from "next/navigation";
import { Archive, ArrowLeft, Ban, KeyRound, Mail, RotateCcw, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HookLoader } from "@/components/shared/HookLoader";
import { PageHeader } from "@/components/shared/PageHeader";
import { QueryState } from "@/components/shared/QueryState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DetailSection } from "@/components/shared/DetailSection";
import { DefinitionGrid, type DefinitionItem } from "@/components/shared/DefinitionGrid";
import { useAdminSession, useApiQuery } from "@/lib/query";
import { apiPost } from "@/lib/api";
import { hasPermission, type Permission } from "@/lib/permissions";
import { useState, type ReactNode } from "react";

type AccountResource = "staff" | "partners";
type LifecycleResource = "states" | "cities" | "zones" | "markets" | "hubs";
type LifecycleAction = {
  suffix: string;
  label: string;
  title: string;
  description: string;
  destructive?: boolean;
};

const hiddenFields = new Set(["id", "_id", "__v", "status"]);

function labelFor(key: string) {
  return key
    .replace(/Id$/, " ID")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function displayValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return new Intl.NumberFormat("en-NG").format(value);
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString("en-NG");
    return value.replaceAll("_", " ");
  }
  if (Array.isArray(value)) {
    if (!value.length) return "None";
    return value.map((entry) => typeof entry === "object" ? objectSummary(entry as Record<string, unknown>) : String(entry)).join(", ");
  }
  if (typeof value === "object") return objectSummary(value as Record<string, unknown>);
  return String(value);
}

function objectSummary(value: Record<string, unknown>) {
  const preferred = ["name", "title", "publicId", "code", "email", "phone", "address", "line1"];
  const parts = preferred
    .filter((key) => value[key])
    .map((key) => String(value[key]));
  if (parts.length) return parts.join(" · ");
  return Object.entries(value)
    .filter(([, entry]) => ["string", "number", "boolean"].includes(typeof entry))
    .slice(0, 4)
    .map(([key, entry]) => `${labelFor(key)}: ${String(entry)}`)
    .join(" · ") || "Configured";
}

function recordName(record: Record<string, unknown> | undefined, fallback: string) {
  if (!record) return fallback;
  const fullName = [record.firstName, record.lastName].filter(Boolean).join(" ");
  return String(record.name || record.businessName || record.title || fullName || record.publicId || fallback);
}

function groupRecord(record: Record<string, unknown>) {
  const identityKeys = new Set(["publicId", "code", "email", "phone", "accountType", "type"]);
  const auditKeys = new Set(["createdAt", "updatedAt", "lastLoginAt", "invitedAt", "activatedAt", "suspendedAt"]);
  const identity: DefinitionItem[] = [];
  const operations: DefinitionItem[] = [];
  const audit: DefinitionItem[] = [];
  Object.entries(record).forEach(([key, value]) => {
    if (hiddenFields.has(key)) return;
    const item = { label: labelFor(key), value: displayValue(value) };
    if (identityKeys.has(key)) identity.push(item);
    else if (auditKeys.has(key) || key.endsWith("At")) audit.push(item);
    else operations.push(item);
  });
  return { identity, operations, audit };
}

export function PlatformDetailPage({
  title,
  endpoint,
  invitationAction = false,
  accountResource,
  lifecycleResource,
}: {
  title: string;
  endpoint: string;
  invitationAction?: boolean;
  accountResource?: AccountResource;
  lifecycleResource?: LifecycleResource;
}) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [action, setAction] = useState<LifecycleAction | null>(null);
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);
  const { data: admin } = useAdminSession();
  const query = useApiQuery<Record<string, unknown>>(["platform-detail", endpoint, params.id], `${endpoint}/${params.id}`);
  const status = String(query.data?.status || "");
  const accountManagePermission: Permission | undefined = accountResource === "staff"
    ? "staff.suspend"
    : accountResource === "partners"
      ? "partners.manage"
      : undefined;
  const invitationPermission: Permission | undefined = accountResource === "staff" ? "staff.create" : accountManagePermission;
  const lifecycleManagePermission: Permission | undefined = lifecycleResource
    ? `${lifecycleResource}.manage` as Permission
    : undefined;
  const canManageAccount = accountManagePermission ? hasPermission(admin, accountManagePermission) : false;
  const canManageInvitation = invitationPermission ? hasPermission(admin, invitationPermission) : false;
  const canManageLifecycle = lifecycleManagePermission ? hasPermission(admin, lifecycleManagePermission) : false;
  async function resendInvitation() {
    setSending(true);
    try {
      await apiPost(`${endpoint}/${params.id}/resend-invitation`, {});
      toast.success("A new activation link has been sent");
      query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Unable to resend invitation");
    } finally {
      setSending(false);
    }
  }
  async function runAction() {
    if (!action || reason.trim().length < 3) return;
    setActing(true);
    try {
      await apiPost(`${endpoint}/${params.id}/${action.suffix}`, { reason: reason.trim() });
      toast.success(`${action.label} completed`);
      setAction(null);
      setReason("");
      query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Unable to complete action");
    } finally {
      setActing(false);
    }
  }

  const accountActions: LifecycleAction[] = accountResource
    ? status === "invited"
      ? [{
          suffix: "cancel-invitation",
          label: "Cancel invitation",
          title: "Cancel this invitation?",
          description: "The activation link will stop working and this account will be disabled.",
          destructive: true,
        }]
      : status === "active"
        ? [
            {
              suffix: "suspend",
              label: "Suspend account",
              title: "Suspend this account?",
              description: "Access will be blocked and all active sessions will be revoked.",
              destructive: true,
            },
            ...(accountResource === "staff" ? [{
              suffix: "revoke-sessions",
              label: "Revoke sessions",
              title: "Revoke all active sessions?",
              description: "The staff member must sign in again on every device.",
            }, {
              suffix: "archive",
              label: "Archive account",
              title: "Archive this staff account?",
              description: "The account will be disabled, sessions revoked, and its history preserved.",
              destructive: true,
            }] : []),
          ]
      : status === "suspended"
          ? [{
              suffix: "reactivate",
              label: "Reactivate account",
              title: "Reactivate this account?",
              description: "The account will regain access within its assigned scope.",
            }, ...(accountResource === "staff" ? [{
              suffix: "archive",
              label: "Archive account",
              title: "Archive this staff account?",
              description: "The account will be disabled, sessions revoked, and its history preserved.",
              destructive: true,
            }] : [])]
          : []
    : [];
  const lifecycleActions: LifecycleAction[] = lifecycleResource
    ? status === "active"
      ? [{
          suffix: "deactivate",
          label: "Deactivate",
          title: `Deactivate this ${title.toLowerCase()}?`,
          description: "The record will stop being available for new operational assignments.",
          destructive: true,
        }]
      : status === "inactive"
        ? [{
            suffix: "activate",
            label: "Activate",
            title: `Activate this ${title.toLowerCase()}?`,
            description: "The record will become available within its configured operational scope.",
          }]
        : []
    : [];
  const actions = [...accountActions, ...lifecycleActions];

  const groups = groupRecord(query.data || {});
  const name = recordName(query.data, title);

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        title={name}
        description={query.data?.publicId ? `${title} · ${String(query.data.publicId)}` : title}
        actions={
          <>
            {status ? <StatusBadge status={status} /> : null}
            <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft /> Back</Button>
            {invitationAction && canManageInvitation && status === "invited" ? (
            <Button size="sm" variant="outline" disabled={sending} onClick={resendInvitation}>
              {sending ? <HookLoader size="button" /> : <><Mail /> Resend invitation</>}
            </Button>
          ) : null}
          {(canManageAccount || canManageLifecycle) && actions.map((item) => (
            <Button
              key={item.suffix}
              size="sm"
              variant={item.destructive ? "destructive" : "outline"}
              onClick={() => setAction(item)}
            >
              {["suspend", "deactivate"].includes(item.suffix) ? <Ban /> : item.suffix === "archive" ? <Archive /> : item.suffix === "cancel-invitation" ? <ShieldX /> : item.suffix === "revoke-sessions" ? <KeyRound /> : <RotateCcw />}
              {item.label}
            </Button>
            ))}
          </>
        }
      />
      <QueryState loading={query.isLoading} error={query.error} loadingLabel={`Loading ${title.toLowerCase()}`} onRetry={() => query.refetch()}>
        {query.data ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
            <div className="space-y-4">
              {groups.operations.length ? (
                <DetailSection title="Operational overview" description="Current configuration and assignment context for this record.">
                  <DefinitionGrid items={groups.operations} columns={2} />
                </DetailSection>
              ) : null}
            </div>
            <div className="space-y-4">
              {groups.identity.length ? (
                <DetailSection title="Identity" description="Stable identifiers and contact information.">
                  <DefinitionGrid items={groups.identity} columns={1} />
                </DetailSection>
              ) : null}
              {groups.audit.length ? (
                <DetailSection title="Record activity" description="Lifecycle dates recorded by the platform.">
                  <DefinitionGrid items={groups.audit} columns={1} />
                </DetailSection>
              ) : null}
            </div>
          </div>
        ) : null}
      </QueryState>
      <Dialog open={Boolean(action)} onOpenChange={(open) => {
        if (!open && !acting) {
          setAction(null);
          setReason("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action?.title}</DialogTitle>
            <DialogDescription>{action?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lifecycle-reason">Reason</Label>
            <Textarea
              id="lifecycle-reason"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Add a clear operational reason for the audit record"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={acting} onClick={() => setAction(null)}>Cancel</Button>
            <Button
              type="button"
              variant={action?.destructive ? "destructive" : "default"}
              disabled={acting || reason.trim().length < 3}
              onClick={runAction}
            >
              {acting ? <HookLoader size="button" /> : action?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
