"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, Check, ChevronsUpDown, Link2, Mail, MoreHorizontal, Pencil, Plus, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { AdminWorkflowSheet } from "@/components/shared/AdminWorkflowSheet";
import { QueryState } from "@/components/shared/QueryState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { apiPatch, apiPost } from "@/lib/api";
import { useApiQuery } from "@/lib/query";
import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/permissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Option = { value: string; label: string; group?: string };
type Field = {
  key: string;
  label: string;
  type?: "text" | "email" | "number" | "id-list" | "select" | "multi-select";
  required?: boolean;
  options?: Option[];
  optionsEndpoint?: string;
  optionLabelKey?: string;
  optionValueKey?: string;
  dependsOn?: string;
  dependsOnKey?: string;
};
export type DirectoryField = Field;
export type DirectoryAssignment = {
  label: string;
  permission: Permission;
  pathSuffix: string;
  payloadKey: string;
  field: Field;
};
type Row = Record<string, unknown> & {
  id: string;
  publicId?: string;
  status?: string;
  name?: string;
};
type PageData = { data?: Row[]; total?: number } | Row[];
type FormValue = string | string[];
type FormValues = Record<string, FormValue>;

function selectedDependency(values: FormValues, key?: string) {
  if (!key) return [];
  const value = values[key];
  return Array.isArray(value) ? value : value ? [value] : [];
}

function responseRows(data: PageData | undefined): Row[] {
  return Array.isArray(data) ? data : data?.data || [];
}

function normalizeOptions(options: Option[]): Option[] {
  const seen = new Set<string>();

  return options.flatMap((option) => {
    const rawValue: unknown = option?.value;
    const value = rawValue === null || rawValue === undefined ? "" : String(rawValue).trim();

    if (!value || value === "undefined" || value === "null" || seen.has(value)) {
      return [];
    }

    seen.add(value);
    const label = option.label === undefined || option.label === null
      ? value
      : String(option.label).trim() || value;

    return [{ ...option, value, label }];
  });
}

function displayValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length ? `${value.length} permissions` : "No permissions";
  }
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function useRelatedOptions(field: Field, values: FormValues) {
  const dependencies = selectedDependency(values, field.dependsOn);
  const query = useApiQuery<PageData>(
    ["platform-options", field.optionsEndpoint, ...dependencies],
    `${field.optionsEndpoint}?limit=100`,
    Boolean(field.optionsEndpoint) &&
      (!field.dependsOn || dependencies.length > 0),
  );
  const rows = responseRows(query.data);
  const filtered = dependencies.length
    ? rows.filter((row) =>
        dependencies.includes(
          String(row[field.dependsOnKey || `${field.dependsOn}Id`] ?? ""),
        ),
      )
    : rows;
  const relatedOptions = filtered.flatMap((row) => {
    const rawValue =
      row[field.optionValueKey || "id"] ?? row.id ?? row.publicId ?? row.key;

    if (rawValue === null || rawValue === undefined || String(rawValue).trim() === "") {
      return [];
    }

    const value = String(rawValue).trim();
    const rawLabel =
      row[field.optionLabelKey || "name"] ??
      row.name ??
      row.publicId ??
      row.key ??
      row.id ??
      value;

    return [{
      value,
      label: String(rawLabel).trim() || value,
      group: typeof row.domain === "string" ? row.domain : undefined,
    }];
  });
  const options = normalizeOptions(field.options || relatedOptions);
  return { options, query, dependencies };
}

export function RelatedSelect({
  field,
  value,
  values,
  onChange,
}: {
  field: Field;
  value?: string;
  values: FormValues;
  onChange: (value: string) => void;
}) {
  const { options, query, dependencies } = useRelatedOptions(field, values);

  return (
    <>
      <input type="hidden" name={field.key} value={value || ""} />
      <Select
        value={value}
        onValueChange={onChange}
        disabled={
          Boolean(field.dependsOn && !dependencies.length) || query.isLoading
        }
      >
        <SelectTrigger id={field.key} className="w-full">
          <SelectValue
            placeholder={
              field.dependsOn && !dependencies.length
                ? `Select ${field.dependsOn.replace(/Id$/, "")} first`
                : query.isLoading
                  ? "Loading options..."
                  : `Select ${field.label.toLowerCase()}`
            }
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

export function RelatedMultiSelect({
  field,
  value = [],
  values,
  onChange,
}: {
  field: Field;
  value?: string[];
  values: FormValues;
  onChange: (value: string[]) => void;
}) {
  const { options, query, dependencies } = useRelatedOptions(field, values);
  const disabled =
    Boolean(field.dependsOn && !dependencies.length) || query.isLoading;
  const selectedLabels = options
    .filter((option) => value.includes(option.value))
    .map((option) => option.label);
  const groupedOptions = Object.entries(
    options.reduce<Record<string, Option[]>>((groups, option) => {
      const group = option.group || "Available options";
      (groups[group] ||= []).push(option);
      return groups;
    }, {}),
  );
  const isPermissionPicker = field.key === "permissionKeys";

  return (
    <>
      <input type="hidden" name={field.key} value={value.join(",")} />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={field.key}
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className="h-auto min-h-9 w-full justify-between px-3 font-normal"
          >
            <span
              className={cn(
                "truncate text-left",
                !selectedLabels.length && "text-muted-foreground",
              )}
            >
              {query.isLoading
                ? "Loading options..."
                : field.dependsOn && !dependencies.length
                  ? `Select ${field.dependsOn.replace(/Ids?$/, "")} first`
                  : isPermissionPicker && value.length
                    ? `${value.length} permission${value.length === 1 ? "" : "s"} selected`
                    : selectedLabels.length
                    ? selectedLabels.join(", ")
                    : `Select ${field.label.toLowerCase()}`}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="max-h-[calc(100dvh-2rem)] w-[var(--radix-popover-trigger-width)] gap-0 overflow-hidden p-0"
        >
          <Command className="h-[min(24rem,calc(100dvh-8rem))] max-h-none">
            <CommandInput
              placeholder={`Search ${field.label.toLowerCase()}...`}
            />
            <CommandList
              className="h-[min(18rem,calc(100dvh-11rem))] max-h-none flex-none overflow-y-scroll overscroll-contain touch-pan-y"
              onWheel={(event) => event.stopPropagation()}
            >
              <CommandEmpty>No matching options.</CommandEmpty>
              {isPermissionPicker
                ? groupedOptions.map(([group, groupOptions]) => (
                    <CommandGroup key={group} heading={group.replaceAll("_", " ")}>
                      {groupOptions.map((option) => {
                        const selected = value.includes(option.value);
                        return (
                          <CommandItem
                            key={option.value}
                            value={`${option.label} ${option.value}`}
                            onSelect={() =>
                              onChange(
                                selected
                                  ? value.filter((item) => item !== option.value)
                                  : [...value, option.value],
                              )
                            }
                          >
                            <span className="truncate">{option.label}</span>
                            <Check className={cn("ml-auto size-4", selected ? "opacity-100" : "opacity-0")} />
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  ))
                : <CommandGroup>
                    {options.map((option) => {
                      const selected = value.includes(option.value);
                      return (
                        <CommandItem
                          key={option.value}
                          value={`${option.label} ${option.value}`}
                          onSelect={() =>
                            onChange(
                              selected
                                ? value.filter((item) => item !== option.value)
                                : [...value, option.value],
                            )
                          }
                        >
                          <span className="truncate">{option.label}</span>
                          <Check className={cn("ml-auto size-4", selected ? "opacity-100" : "opacity-0")} />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}

export function PlatformDirectoryPage({
  title,
  description,
  endpoint,
  detailBase,
  permissionLabel,
  fields,
  columns,
  pageSize = 50,
  managePermission,
  editPermission = managePermission,
  lifecyclePermission = managePermission,
  lifecyclePaths,
  archivePermission,
  archivePath,
  invitationAction = false,
  invitationPermission = managePermission,
  cancelInvitationPermission = lifecyclePermission,
  assignment,
}: {
  title: string;
  description: string;
  endpoint: string;
  detailBase: string;
  permissionLabel: string;
  fields: Field[];
  columns: { key: string; label: string }[];
  pageSize?: number;
  managePermission?: Permission;
  editPermission?: Permission;
  lifecyclePermission?: Permission;
  lifecyclePaths?: { activate: string; deactivate: string };
  archivePermission?: Permission;
  archivePath?: string;
  invitationAction?: boolean;
  invitationPermission?: Permission;
  cancelInvitationPermission?: Permission;
  assignment?: DirectoryAssignment;
}) {
  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [lifecycleRow, setLifecycleRow] = useState<Row | null>(null);
  const [lifecycleMode, setLifecycleMode] = useState<"status" | "archive" | "cancel">("status");
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [editReason, setEditReason] = useState("");
  const [assignmentRow, setAssignmentRow] = useState<Row | null>(null);
  const [assignmentValue, setAssignmentValue] = useState<FormValue>(assignment?.field.type === "multi-select" ? [] : "");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<FormValues>({});
  const query = useApiQuery<PageData>(
    ["platform", endpoint, pageSize],
    `${endpoint}?limit=${pageSize}`,
  );
  const rows = responseRows(query.data);
  const total = Array.isArray(query.data) ? rows.length : query.data?.total ?? rows.length;

  function formValue(field: Field, row: Row) {
    const value = row[field.key];
    if (field.type === "id-list" || field.type === "multi-select") {
      if (Array.isArray(value)) {
        return value.map((entry) => {
          if (typeof entry === "object" && entry !== null) {
            const record = entry as Record<string, unknown>;
            return String(record.id || record._id || record.publicId || "");
          }
          return String(entry);
        }).filter(Boolean);
      }
      return typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
    }
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      return String(record.id || record._id || record.publicId || "");
    }
    return String(value);
  }

  function openEdit(row: Row) {
    const next: FormValues = {};
    fields.forEach((field) => {
      const value = formValue(field, row);
      if (Array.isArray(value) || value) next[field.key] = value;
    });
    setEditingRow(row);
    setValues(next);
    setEditReason("");
    setOpen(true);
  }

  function buildBody(form: FormData) {
    const body: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = String(form.get(field.key) || "").trim();
      if (!raw && !field.required && field.type !== "id-list" && field.type !== "multi-select") continue;
      if (field.type === "number") {
        if (raw) body[field.key] = Number(raw);
        continue;
      }
      if (field.type === "id-list" || field.type === "multi-select") {
        body[field.key] = raw.split(",").map((value) => value.trim()).filter(Boolean);
        continue;
      }
      body[field.key] = raw;
    }
    if (endpoint === "/admin/partners") {
      body.contact = { email: body.email, phone: body.phone };
    }
    if (editingRow && String(form.get("reason") || "").trim()) {
      body.reason = String(form.get("reason")).trim();
    }
    return body;
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = buildBody(form);
    setSaving(true);
    try {
      if (editingRow) {
        await apiPatch(`${endpoint}/${editingRow.publicId || editingRow.id}`, body);
        toast.success(`${title.replace(/s$/, "")} updated`);
      } else {
        await apiPost(endpoint, body);
        toast.success(`${title.replace(/s$/, "")} created`);
      }
      setOpen(false);
      setEditingRow(null);
      setValues({});
      setEditReason("");
      await query.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message.replace(/^\d+:\s*/, "")
          : "Unable to save record",
      );
    } finally {
      setSaving(false);
    }
  }

  async function resendInvitation(row: Row) {
    const id = row.publicId || row.id;
    setActingId(id);
    try {
      await apiPost(`${endpoint}/${id}/resend-invitation`, {});
      toast.success("Invitation sent again");
      await query.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message.replace(/^\d+:\s*/, "")
          : "Unable to resend invitation",
      );
    } finally {
      setActingId(null);
    }
  }

  async function saveAssignment() {
    if (!assignment || !assignmentRow || assignmentReason.trim().length < 3) return;
    const values = Array.isArray(assignmentValue)
      ? assignmentValue.filter(Boolean)
      : assignmentValue.trim();
    if (!values.length) return;
    const id = assignmentRow.publicId || assignmentRow.id;
    setActingId(id);
    try {
      await apiPost(`${endpoint}/${id}/${assignment.pathSuffix}`, {
        [assignment.payloadKey]: values,
        reason: assignmentReason.trim(),
      });
      toast.success(`${assignment.label} completed`);
      await query.refetch();
      setAssignmentRow(null);
      setAssignmentReason("");
      setAssignmentValue(assignment.field.type === "multi-select" ? [] : "");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message.replace(/^\d+:\s*/, "")
          : `Unable to ${assignment.label.toLowerCase()}`,
      );
    } finally {
      setActingId(null);
    }
  }

  async function changeLifecycle() {
    if ((!lifecyclePaths && !archivePath) || !lifecycleRow || lifecycleReason.trim().length < 3) return;
    const isActive = lifecycleRow.status?.toLowerCase() === "active";
    const suffix = lifecycleMode === "archive"
      ? archivePath
      : lifecycleMode === "cancel"
        ? "cancel-invitation"
        : isActive
          ? lifecyclePaths?.deactivate
          : lifecyclePaths?.activate;
    if (!suffix) return;
    const id = lifecycleRow.publicId || lifecycleRow.id;
    setActingId(id);
    try {
      await apiPost(`${endpoint}/${id}/${suffix}`, { reason: lifecycleReason.trim() });
      const actionLabel = lifecycleMode === "archive"
        ? "archived"
        : lifecycleMode === "cancel"
          ? "invitation cancelled"
          : isActive
            ? "deactivated"
            : "activated";
      toast.success(`${title.replace(/s$/, "")} ${actionLabel}`);
      await query.refetch();
      setLifecycleRow(null);
      setLifecycleReason("");
      setLifecycleMode("status");
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Lifecycle change failed");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        className="mb-0"
        title={title}
        description={description}
        actions={
          fields.length ? (
            managePermission ? (
              <PermissionGuard permission={managePermission}>
                <Button variant="brand" size="sm" onClick={() => { setEditingRow(null); setValues({}); setOpen(true); }}>
                  <Plus /> Add {title.replace(/s$/, "")}
                </Button>
              </PermissionGuard>
            ) : (
              <Button variant="brand" size="sm" onClick={() => { setEditingRow(null); setValues({}); setOpen(true); }}>
                <Plus /> Add {title.replace(/s$/, "")}
              </Button>
            )
          ) : undefined
        }
      />
      <Card className="gap-0 overflow-hidden rounded-lg py-0 shadow-card">
        <div className="flex min-h-12 items-center justify-between border-b px-4 py-2.5">
          <div>
            <p className="text-sm font-medium text-foreground">
              Operational directory
            </p>
            <p className="text-xs text-muted-foreground">
              {total} records in the current scope
            </p>
          </div>
          {query.isFetching && !query.isLoading ? (
            <span className="text-xs text-muted-foreground">Refreshing...</span>
          ) : null}
        </div>
        <CardContent className="p-0">
          <QueryState
            loading={query.isLoading}
            error={query.error}
            empty={!query.isLoading && !query.isError && !rows.length}
            loadingLabel={`Loading ${title.toLowerCase()}...`}
            errorTitle={`${title} could not be loaded`}
            emptyTitle={`No ${title.toLowerCase()} yet`}
            emptyDescription={`Create the first record when ${permissionLabel} is ready.`}
            onRetry={() => query.refetch()}
          >
            <div className="overflow-x-auto">
              <Table className="min-w-220">
                <TableHeader className="sticky top-0 z-10 bg-muted/70">
                  <TableRow>
                    <TableHead className="px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      ID
                    </TableHead>
                    {columns.map((column) => (
                      <TableHead
                        key={column.key}
                        className="px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {column.label}
                      </TableHead>
                    ))}
                    <TableHead className="px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Status
                    </TableHead>
                    {(editPermission || lifecyclePaths || archivePath || invitationAction || assignment) ? <TableHead className="w-12 px-4" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} className="h-11 hover:bg-muted/30">
                      <TableCell className="px-4">
                        <Link
                          className="font-medium text-foreground hover:underline"
                          href={`${detailBase}/${row.publicId || row.id}`}
                        >
                          {row.publicId || row.id}
                        </Link>
                      </TableCell>
                      {columns.map((column) => (
                        <TableCell
                          key={column.key}
                          className="max-w-72 truncate px-4 text-sm text-muted-foreground"
                        >
                          {displayValue(row[column.key])}
                        </TableCell>
                      ))}
                      <TableCell className="px-4">
                        {row.status ? (
                          <StatusBadge status={row.status} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {(editPermission || lifecyclePaths || archivePath || invitationAction || assignment) ? (
                        <TableCell className="px-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.publicId || row.id}`} disabled={actingId === (row.publicId || row.id)}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {editPermission && !(endpoint === "/admin/roles" && row.isSystem === true) ? <PermissionGuard permission={editPermission}><DropdownMenuItem onSelect={() => openEdit(row)}><Pencil /> Edit record</DropdownMenuItem></PermissionGuard> : endpoint === "/admin/roles" && row.isSystem === true ? <DropdownMenuItem disabled>System role protected</DropdownMenuItem> : null}
                              {editPermission && (lifecyclePaths || archivePath || invitationAction || assignment) ? <DropdownMenuSeparator /> : null}
                              {invitationAction && row.status?.toLowerCase() === "invited" ? (
                                <>
                                  {invitationPermission ? <PermissionGuard permission={invitationPermission}><DropdownMenuItem onSelect={() => void resendInvitation(row)}><Mail /> Resend invitation</DropdownMenuItem></PermissionGuard> : null}
                                  {cancelInvitationPermission ? <PermissionGuard permission={cancelInvitationPermission}><DropdownMenuItem variant="destructive" onSelect={() => { setLifecycleMode("cancel"); setLifecycleRow(row); setLifecycleReason(""); }}><Archive /> Cancel invitation</DropdownMenuItem></PermissionGuard> : null}
                                </>
                              ) : null}
                              {lifecyclePaths && lifecyclePermission && row.status?.toLowerCase() !== "invited" ? <PermissionGuard permission={lifecyclePermission}><DropdownMenuItem onSelect={() => { setLifecycleMode("status"); setLifecycleRow(row); setLifecycleReason(""); }}><Power /> {row.status?.toLowerCase() === "active" ? "Deactivate" : "Activate"}</DropdownMenuItem></PermissionGuard> : null}
                              {archivePath && archivePermission && !["disabled", "invited"].includes(row.status?.toLowerCase() || "") ? <PermissionGuard permission={archivePermission}><DropdownMenuItem variant="destructive" onSelect={() => { setLifecycleMode("archive"); setLifecycleRow(row); setLifecycleReason(""); }}><Archive /> Archive record</DropdownMenuItem></PermissionGuard> : null}
                              {assignment ? <PermissionGuard permission={assignment.permission}><DropdownMenuItem onSelect={() => { setAssignmentRow(row); setAssignmentReason(""); setAssignmentValue(assignment.field.type === "multi-select" ? [] : ""); }}><Link2 /> {assignment.label}</DropdownMenuItem></PermissionGuard> : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </QueryState>
        </CardContent>
      </Card>
      <AdminWorkflowSheet
        open={open}
        onOpenChange={(next) => {
          if (!next && !saving) {
            setOpen(false);
            setValues({});
            setEditingRow(null);
            setEditReason("");
          }
        }}
        title={`${editingRow ? "Edit" : "Add"} ${title.replace(/s$/, "")}`}
        description={editingRow
          ? "Update the record details. The backend validates relationships, scope, and lifecycle rules."
          : `Create a ${title.replace(/s$/, "").toLowerCase()} for the current operational workspace.`}
        footer={(
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" form="platform-directory-form" variant="brand" disabled={saving}>
              {saving ? "Saving..." : editingRow ? "Save changes" : "Create"}
            </Button>
          </>
        )}
      >
          <form id="platform-directory-form" onSubmit={save} className="space-y-5">
            {fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key}>{field.label}</Label>
                {field.type === "select" ? (
                  <RelatedSelect
                    field={field}
                    value={
                      typeof values[field.key] === "string"
                        ? (values[field.key] as string)
                        : undefined
                    }
                    values={values}
                    onChange={(value) =>
                      setValues((current) => {
                        const next = { ...current, [field.key]: value };
                        for (const candidate of fields) {
                          if (candidate.dependsOn === field.key)
                            delete next[candidate.key];
                        }
                        return next;
                      })
                    }
                  />
                ) : field.type === "multi-select" ? (
                  <RelatedMultiSelect
                    field={field}
                    value={
                      Array.isArray(values[field.key])
                        ? (values[field.key] as string[])
                        : []
                    }
                    values={values}
                    onChange={(value) =>
                      setValues((current) => {
                        const next = { ...current, [field.key]: value };
                        for (const candidate of fields) {
                          if (candidate.dependsOn === field.key)
                            delete next[candidate.key];
                        }
                        return next;
                      })
                    }
                  />
                ) : (
                    <Input
                    id={field.key}
                    name={field.key}
                    type={
                      field.type === "id-list" ? "text" : field.type || "text"
                    }
                    required={field.required}
                    defaultValue={typeof values[field.key] === "string" ? values[field.key] : undefined}
                  />
                )}
              </div>
            ))}
            {editingRow ? (
              <div className="space-y-1.5 border-t pt-5">
                <Label htmlFor="directory-edit-reason">Audit reason</Label>
                <Input id="directory-edit-reason" name="reason" value={editReason} onChange={(event) => setEditReason(event.target.value)} placeholder="Optional reason for this change" maxLength={500} />
              </div>
            ) : null}
          </form>
      </AdminWorkflowSheet>
      <Dialog open={Boolean(lifecycleRow)} onOpenChange={(next) => { if (!next && !actingId) { setLifecycleRow(null); setLifecycleReason(""); setLifecycleMode("status"); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lifecycleMode === "archive" ? "Archive" : lifecycleMode === "cancel" ? "Cancel invitation" : lifecycleRow?.status?.toLowerCase() === "active" ? "Deactivate" : "Activate"} {title.replace(/s$/, "")}</DialogTitle>
            <DialogDescription>{lifecycleMode === "archive" ? "The record will be hidden from active operations while its history is preserved." : lifecycleMode === "cancel" ? "The invitation will stop working and the account will remain available in the audit history." : "This change is reversible and will be recorded in the audit log."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="directory-lifecycle-reason">Reason</Label>
            <Input id="directory-lifecycle-reason" value={lifecycleReason} onChange={(event) => setLifecycleReason(event.target.value)} placeholder="Add an operational reason" minLength={3} maxLength={500} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={Boolean(actingId)} onClick={() => setLifecycleRow(null)}>Cancel</Button>
            <Button type="button" variant={lifecycleMode === "archive" || lifecycleMode === "cancel" || lifecycleRow?.status?.toLowerCase() === "active" ? "destructive" : "brand"} disabled={Boolean(actingId) || lifecycleReason.trim().length < 3} onClick={() => void changeLifecycle()}>{actingId ? "Saving..." : lifecycleMode === "archive" ? "Archive" : lifecycleMode === "cancel" ? "Cancel invitation" : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AdminWorkflowSheet
        open={Boolean(assignmentRow)}
        onOpenChange={(next) => {
          if (!next && !actingId) {
            setAssignmentRow(null);
            setAssignmentReason("");
            setAssignmentValue(assignment?.field.type === "multi-select" ? [] : "");
          }
        }}
        title={assignment?.label || "Assignment"}
        description="Choose a compatible record and provide a reason. The backend validates state ownership before saving."
        footer={(
          <>
            <Button type="button" variant="outline" disabled={Boolean(actingId)} onClick={() => setAssignmentRow(null)}>Cancel</Button>
            <Button type="button" variant="brand" disabled={Boolean(actingId) || !assignmentValue || (Array.isArray(assignmentValue) && !assignmentValue.length) || assignmentReason.trim().length < 3} onClick={() => void saveAssignment()}>{actingId ? "Saving..." : "Save assignment"}</Button>
          </>
        )}
      >
        {assignment ? (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor={`assignment-${assignment.field.key}`}>{assignment.field.label}</Label>
              {assignment.field.type === "multi-select" ? (
                <RelatedMultiSelect
                  field={assignment.field}
                  value={Array.isArray(assignmentValue) ? assignmentValue : []}
                  values={{}}
                  onChange={setAssignmentValue}
                />
              ) : (
                <RelatedSelect
                  field={assignment.field}
                  value={typeof assignmentValue === "string" ? assignmentValue : undefined}
                  values={{}}
                  onChange={setAssignmentValue}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assignment-reason">Reason</Label>
              <Input id="assignment-reason" value={assignmentReason} onChange={(event) => setAssignmentReason(event.target.value)} placeholder="Add an operational reason" minLength={3} maxLength={500} />
            </div>
          </div>
        ) : null}
      </AdminWorkflowSheet>
    </div>
  );
}
