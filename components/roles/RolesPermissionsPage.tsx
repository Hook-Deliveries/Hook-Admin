"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AdminWorkflowSheet } from "@/components/shared/AdminWorkflowSheet";
import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { QueryState } from "@/components/shared/QueryState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { useAdminSession, useApiQuery } from "@/lib/query";

type Role = {
  id: string;
  key: string;
  name: string;
  description?: string;
  permissionKeys?: string[];
  defaultScopeType?: string;
  isSystem?: boolean;
  isActive?: boolean;
  assignedStaffCount?: number;
};

type PermissionRecord = {
  key: string;
  domain?: string;
  description?: string;
};

type FormState = {
  key: string;
  name: string;
  description: string;
  defaultScopeType: string;
  permissionKeys: string[];
};

type ListResponse<T> = T[] | { data?: T[] };

const emptyForm: FormState = {
  key: "",
  name: "",
  description: "",
  defaultScopeType: "global",
  permissionKeys: [],
};

const scopeOptions = [
  { value: "global", label: "Global" },
  { value: "multi_state", label: "Multiple states" },
  { value: "single_state", label: "Single state" },
  { value: "hub", label: "Dispatch Hub" },
  { value: "self", label: "Self" },
];

function rows<T>(value: ListResponse<T> | undefined) {
  return Array.isArray(value) ? value : value?.data || [];
}

function cleanError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : fallback;
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function RolesPermissionsPage() {
  const { data: admin } = useAdminSession();
  const rolesQuery = useApiQuery<ListResponse<Role>>(["admin", "roles"], "/admin/roles");
  const permissionsQuery = useApiQuery<ListResponse<PermissionRecord>>(["admin", "permissions"], "/admin/permissions");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const roles = rows(rolesQuery.data);
  const permissions = rows(permissionsQuery.data);
  const canManage = hasPermission(admin, "roles.manage");
  const permissionMap = useMemo(() => new Map(permissions.map((permission) => [permission.key, permission])), [permissions]);
  const permissionGroups = useMemo(() => {
    const groups = new Map<string, PermissionRecord[]>();
    permissions.forEach((permission) => {
      const group = permission.domain || permission.key.split(".")[0] || "Other";
      groups.set(group, [...(groups.get(group) || []), permission]);
    });
    form.permissionKeys.forEach((key) => {
      if (permissionMap.has(key)) return;
      const group = "Assigned permissions";
      groups.set(group, [...(groups.get(group) || []), { key, domain: group, description: "Previously assigned permission" }]);
    });
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [form.permissionKeys, permissionMap, permissions]);
  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return permissionGroups;
    return permissionGroups
      .map(([group, items]) => [group, items.filter((permission) => `${permission.key} ${permission.description || ""}`.toLowerCase().includes(term))] as const)
      .filter(([, items]) => items.length > 0);
  }, [permissionGroups, search]);

  function updateForm<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditingRole(null);
    setForm(emptyForm);
    setSearch("");
    setExpandedGroups({});
    setSheetOpen(true);
  }

  function openEdit(role: Role) {
    if (role.isSystem) return toast.error("System roles are protected and cannot be edited.");
    if ((role.assignedStaffCount || 0) > 0) return toast.error(`This role is assigned to ${role.assignedStaffCount} staff member${role.assignedStaffCount === 1 ? "" : "s"}. Reassign them before editing.`);
    setEditingRole(role);
    setForm({ key: role.key || "", name: role.name || "", description: role.description || "", defaultScopeType: role.defaultScopeType || "global", permissionKeys: [...(role.permissionKeys || [])] });
    setSearch("");
    setExpandedGroups({});
    setSheetOpen(true);
  }

  function requestDelete(role: Role) {
    if (role.isSystem) return toast.error("System roles are protected and cannot be deleted.");
    if ((role.assignedStaffCount || 0) > 0) return toast.error(`This role is assigned to ${role.assignedStaffCount} staff member${role.assignedStaffCount === 1 ? "" : "s"}. Reassign them before deleting.`);
    setDeleteRole(role);
    setDeleteReason("");
  }

  function togglePermission(key: string) {
    updateForm("permissionKeys", form.permissionKeys.includes(key) ? form.permissionKeys.filter((permission) => permission !== key) : [...form.permissionKeys, key]);
  }

  async function saveRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = form.key.trim().toUpperCase();
    const name = form.name.trim();
    if (key.length < 3) return toast.error("Add a role key with at least 3 characters.");
    if (name.length < 2) return toast.error("Add a clear role name.");
    if (!form.permissionKeys.length) return toast.error("Select at least one permission for this role.");
    setSaving(true);
    try {
      const payload = { ...form, key, name, description: form.description.trim() };
      if (editingRole) {
        await apiPatch(`/admin/roles/${editingRole.id}`, payload);
        toast.success("Role updated successfully");
      } else {
        await apiPost("/admin/roles", payload);
        toast.success("Role created successfully");
      }
      setSheetOpen(false);
      await rolesQuery.refetch();
    } catch (error) {
      toast.error(cleanError(error, "Unable to save role"));
    } finally {
      setSaving(false);
    }
  }

  async function archiveRole() {
    if (!deleteRole || deleteReason.trim().length < 3) return;
    setSaving(true);
    try {
      await apiDelete(`/admin/roles/${deleteRole.id}`, { reason: deleteReason.trim() });
      toast.success("Role archived successfully");
      setDeleteRole(null);
      setDeleteReason("");
      await rolesQuery.refetch();
    } catch (error) {
      toast.error(cleanError(error, "Unable to archive role"));
    } finally {
      setSaving(false);
    }
  }

  const activeRoles = roles.filter((role) => role.isActive !== false).length;
  const systemRoles = roles.filter((role) => role.isSystem).length;
  const assignedRoles = roles.filter((role) => (role.assignedStaffCount || 0) > 0).length;

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader className="mb-0" title="Roles & Permissions" description="Define clear access boundaries for every Hook operations role. Changes are enforced immediately by the backend." actions={canManage ? <PermissionGuard permission="roles.manage"><Button variant="brand" size="sm" onClick={openCreate}><Plus /> Create role</Button></PermissionGuard> : null} />

      <Card className="overflow-hidden border-0 bg-[#FFC809] shadow-none ring-0">
        <CardContent className="relative overflow-hidden p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full border-[24px] border-white/20" />
          <div className="relative max-w-2xl">
            <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-black text-[#FFC809]">
              <ShieldCheck className="size-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/60">Access control</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-black sm:text-3xl">Make every permission intentional.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-black/70">
              System roles stay protected. Configurable roles can be archived when they are no longer assigned to staff, while every change remains in the audit log.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Check className="size-5" /></div>
            <div><p className="text-sm text-muted-foreground">Active roles</p><p className="mt-1 text-2xl font-semibold">{activeRoles}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><ShieldCheck className="size-5" /></div>
            <div><p className="text-sm text-muted-foreground">System roles</p><p className="mt-1 text-2xl font-semibold">{systemRoles}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><UserCheck className="size-5" /></div>
            <div><p className="text-sm text-muted-foreground">Roles in use</p><p className="mt-1 text-2xl font-semibold">{assignedRoles}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><KeyRound className="size-5" /></div>
            <div><p className="text-sm text-muted-foreground">Permissions available</p><p className="mt-1 text-2xl font-semibold">{permissions.length}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 overflow-hidden py-0 shadow-sm"><div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h3 className="text-base font-semibold text-foreground">Role directory</h3><p className="mt-0.5 text-sm text-muted-foreground">{roles.length} roles in the current access catalogue</p></div>{rolesQuery.isFetching && !rolesQuery.isLoading ? <span className="text-xs text-muted-foreground">Refreshing…</span> : null}</div><CardContent className="p-0"><QueryState loading={rolesQuery.isLoading} error={rolesQuery.error} empty={!rolesQuery.isLoading && !rolesQuery.isError && !roles.length} loadingLabel="Loading roles…" errorTitle="Roles could not be loaded" emptyTitle="No roles found" emptyDescription="Create a configurable role to give staff a clear access boundary." onRetry={() => rolesQuery.refetch()}><Table className="w-full table-fixed"><TableHeader className="bg-muted/50"><TableRow><TableHead className="w-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:w-14 sm:px-5">#</TableHead><TableHead className="w-[38%] px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-5">Role</TableHead><TableHead className="w-[24%] px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-5">Access</TableHead><TableHead className="w-[16%] px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-5">Staff</TableHead><TableHead className="w-[14%] px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-5">Status</TableHead><TableHead className="w-12 px-2 sm:px-4" /></TableRow></TableHeader><TableBody>{roles.map((role, index) => { const access = role.permissionKeys || []; const assigned = role.assignedStaffCount || 0; return <TableRow key={role.id} className="group"><TableCell className="px-3 text-center text-sm tabular-nums text-muted-foreground sm:px-5">{index + 1}</TableCell><TableCell className="px-3 sm:px-5"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{role.name}</p><p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{role.key}</p><p className="mt-1 hidden truncate text-xs text-muted-foreground sm:block">{role.description || "No description"}</p></div></TableCell><TableCell className="px-3 sm:px-5"><div className="min-w-0"><p className="text-sm font-medium text-foreground">{access.length} permission{access.length === 1 ? "" : "s"}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{access.slice(0, 2).map((key) => key.split(".")[0]).join(" · ") || "No access assigned"}</p></div></TableCell><TableCell className="px-3 sm:px-5"><div className="flex items-center gap-1.5 text-sm text-foreground"><Users className="size-3.5 text-muted-foreground" /> {assigned}</div><p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{assigned === 1 ? "staff member" : "staff members"}</p></TableCell><TableCell className="px-3 sm:px-5"><StatusBadge status={role.isActive === false ? "inactive" : "active"} /></TableCell><TableCell className="px-2 text-right sm:px-4"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Options for ${role.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52">{canManage && !role.isSystem ? <DropdownMenuItem onSelect={() => openEdit(role)}><Pencil /> Edit role</DropdownMenuItem> : null}{role.isSystem ? <DropdownMenuItem disabled><ShieldCheck /> System role protected</DropdownMenuItem> : null}{canManage && !role.isSystem ? <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => requestDelete(role)}><Trash2 /> Delete role</DropdownMenuItem></> : null}</DropdownMenuContent></DropdownMenu></TableCell></TableRow>; })}</TableBody></Table></QueryState></CardContent></Card>

      <AdminWorkflowSheet open={sheetOpen} onOpenChange={(open) => { if (!open && !saving) setSheetOpen(false); }} title={editingRole ? "Edit role" : "Create role"} description="Choose the access this role should have. Staff assignments and system-role rules are checked before changes are accepted." footer={<><Button type="button" variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>Cancel</Button><Button type="submit" form="role-form" variant="brand" disabled={saving}>{saving ? "Saving…" : editingRole ? "Save changes" : "Create role"}</Button></>}><form id="role-form" onSubmit={saveRole} className="space-y-6"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="role-key">Role key</Label><Input id="role-key" value={form.key} onChange={(event) => updateForm("key", event.target.value)} placeholder="CATALOG_MANAGER" disabled={Boolean(editingRole)} /><p className="text-xs text-muted-foreground">A stable internal key used by access rules.</p></div><div className="space-y-1.5"><Label htmlFor="role-name">Role name</Label><Input id="role-name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Catalog Manager" /></div></div><div className="space-y-1.5"><Label htmlFor="role-description">Description</Label><Textarea id="role-description" value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="What can this role do?" rows={3} /></div><div className="space-y-1.5"><Label>Default scope</Label><Select value={form.defaultScopeType} onValueChange={(value) => updateForm("defaultScopeType", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{scopeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-3 rounded-2xl border bg-muted/20 p-4"><div className="flex items-center justify-between gap-3"><div><Label className="text-sm">Permissions</Label><p className="mt-1 text-xs text-muted-foreground">Open a category to choose the permissions available in it.</p></div><span className="rounded-full bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-white">{form.permissionKeys.length} selected</span></div><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a permission" className="pl-9" /></div><div className="space-y-2">{permissionsQuery.isLoading ? <p className="py-4 text-sm text-muted-foreground">Loading permission categories…</p> : null}{!permissionsQuery.isLoading && !filteredGroups.length ? <p className="py-4 text-sm text-muted-foreground">No permissions match this search.</p> : null}{filteredGroups.map(([group, groupPermissions]) => { const expanded = expandedGroups[group] !== false; const selectedCount = groupPermissions.filter((permission) => form.permissionKeys.includes(permission.key)).length; return <div key={group} className="overflow-hidden rounded-xl border bg-background"><button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/40" onClick={() => setExpandedGroups((current) => ({ ...current, [group]: !expanded }))}><span className="flex min-w-0 items-center gap-2"><span className="text-muted-foreground">{expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</span><span className="truncate text-sm font-semibold">{titleCase(group)}</span></span><span className="text-xs text-muted-foreground">{selectedCount}/{groupPermissions.length}</span></button>{expanded ? <div className="grid gap-1 border-t p-2 sm:grid-cols-2">{groupPermissions.map((permission) => { const selected = form.permissionKeys.includes(permission.key); return <label key={permission.key} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${selected ? "border-amber-300 bg-amber-50/70" : "border-transparent hover:border-border hover:bg-muted/40"}`}><Checkbox checked={selected} onCheckedChange={() => togglePermission(permission.key)} /><span className="min-w-0"><span className="block text-sm font-medium">{permission.key}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{permission.description || "Permission for this area"}</span></span></label>; })}</div> : null}</div>; })}</div><div className="border-t pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected permissions</p>{form.permissionKeys.length ? <div className="mt-2 flex flex-wrap gap-2">{form.permissionKeys.map((key) => <button key={key} type="button" onClick={() => togglePermission(key)} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-left text-xs font-medium text-amber-950 hover:bg-amber-100"><Check className="size-3.5 shrink-0" /><span className="truncate">{permissionMap.get(key)?.key || key}</span></button>)}</div> : <p className="mt-2 text-sm text-muted-foreground">No permissions selected yet.</p>}</div></div></form></AdminWorkflowSheet>

      <Dialog open={Boolean(deleteRole)} onOpenChange={(open) => { if (!open && !saving) { setDeleteRole(null); setDeleteReason(""); } }}><DialogContent><DialogHeader><DialogTitle>Delete this role?</DialogTitle><DialogDescription>{deleteRole ? `“${deleteRole.name}” will be archived and removed from the active role catalogue. Staff assignments are checked again by the backend before anything changes.` : "This action is audited."}</DialogDescription></DialogHeader><div className="space-y-1.5"><Label htmlFor="role-delete-reason">Reason</Label><Textarea id="role-delete-reason" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} placeholder="Why is this role no longer needed?" maxLength={500} /></div><DialogFooter><Button variant="outline" onClick={() => setDeleteRole(null)} disabled={saving}>Cancel</Button><Button variant="destructive" onClick={() => void archiveRole()} disabled={saving || deleteReason.trim().length < 3}>{saving ? "Deleting…" : "Delete role"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
