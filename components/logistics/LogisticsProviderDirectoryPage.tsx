"use client";

import { useMemo, useState } from "react";
import { Activity, Pencil, Plus, Search, Trash2, Truck, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MediaPicker } from "@/components/shared/MediaPicker";
import { PageHeader } from "@/components/shared/PageHeader";
import { QueryState } from "@/components/shared/QueryState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { useAdminSession, useApiQuery } from "@/lib/query";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { formatNaira, type CollectionResponse, type LogisticsProviderRecord } from "./logistics-types";

type FormState = {
  code: string;
  name: string;
  description: string;
  logoUrl: string;
  fee: string;
  status: "active" | "inactive";
  sortOrder: string;
};

const emptyForm: FormState = { code: "", name: "", description: "", logoUrl: "", fee: "", status: "active", sortOrder: "0" };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : fallback;
}

/**
 * Courier logos are arbitrary third-party URLs (often SVG on a CDN we do not
 * control), so this stays a plain <img> rather than next/image — adding every
 * courier's host to remotePatterns is not workable. Falls back to the truck
 * glyph when there is no logo or the URL fails to load.
 */
function ProviderLogo({
  provider,
  className = "size-12",
}: {
  provider: Pick<LogisticsProviderRecord, "logoUrl" | "name">;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(provider.logoUrl) && !failed;

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-lg border bg-white ${className}`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={provider.logoUrl}
          alt={`${provider.name} logo`}
          className="size-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      ) : (
        <Truck className="size-5 text-muted-foreground" aria-hidden />
      )}
    </span>
  );
}

function Stat({ icon: Icon, label, value, detail, tone }: {
  icon: typeof Truck; label: string; value: string | number; detail: string; tone: string;
}) {
  return (
    <Card className="rounded-xl shadow-none">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <span className={`grid size-9 place-items-center rounded-lg ${tone}`}><Icon className="size-4" /></span>
          <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
        </div>
        <p className="mt-3 text-xs font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function LogisticsProviderDirectoryPage() {
  const { data: session } = useAdminSession();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<LogisticsProviderRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [removing, setRemoving] = useState<LogisticsProviderRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const allowed = hasPermission(session, "logistics.view");
  const canManage = hasPermission(session, "logistics.manage");
  const query = useApiQuery<CollectionResponse<LogisticsProviderRecord>>(
    ["admin", "logistics-providers"],
    "/admin/logistics-providers",
    Boolean(session && allowed),
  );

  const providers = useMemo(() => query.data?.data || [], [query.data?.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return providers.filter((provider) => {
      const text = [provider.name, provider.code, provider.description].filter(Boolean).join(" ").toLowerCase();
      return (!term || text.includes(term)) && (status === "all" || provider.status === status);
    });
  }, [providers, search, status]);

  const activeCount = providers.filter((provider) => provider.status === "active").length;
  const cheapest = providers.filter((p) => p.status === "active").reduce<number | null>(
    (low, provider) => (low === null ? provider.feeMinor : Math.min(low, provider.feeMinor)),
    null,
  );

  function openCreate() {
    setForm(emptyForm);
    setCreating(true);
  }

  function openEdit(provider: LogisticsProviderRecord) {
    setForm({
      code: provider.code,
      name: provider.name,
      description: provider.description || "",
      logoUrl: provider.logoUrl || "",
      // Admins think in naira; the API speaks minor units.
      fee: String(Number(provider.feeMinor || 0) / 100),
      status: provider.status,
      sortOrder: String(provider.sortOrder ?? 0),
    });
    setEditing(provider);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setForm(emptyForm);
  }

  const feeValid = form.fee.trim() !== "" && Number.isFinite(Number(form.fee)) && Number(form.fee) >= 0;
  const formValid = form.code.trim().length >= 2 && form.name.trim().length >= 2 && feeValid;

  async function save() {
    if (!formValid) return;
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        logoUrl: form.logoUrl.trim() || undefined,
        feeMinor: Math.round(Number(form.fee) * 100),
        status: form.status,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) {
        await apiPatch(`/admin/logistics-providers/${editing.publicId || editing.id}`, payload);
        toast.success("Logistics provider updated");
      } else {
        await apiPost("/admin/logistics-providers", payload);
        toast.success("Logistics provider added");
      }
      await query.refetch();
      closeForm();
    } catch (error) {
      toast.error(errorMessage(error, "Unable to save this logistics provider"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setSaving(true);
    try {
      await apiDelete(`/admin/logistics-providers/${removing.publicId || removing.id}`);
      toast.success("Logistics provider removed");
      await query.refetch();
      setRemoving(null);
    } catch (error) {
      toast.error(errorMessage(error, "Unable to remove this logistics provider"));
    } finally {
      setSaving(false);
    }
  }

  if (session && !allowed) {
    return (
      <div className="mx-auto flex min-h-96 max-w-2xl items-center justify-center p-6 text-center">
        <div>
          <Truck className="mx-auto size-10 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Logistics access is restricted</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your current role does not include permission to view logistics providers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        title="Logistics Providers"
        description="The couriers customers choose from at checkout, and the delivery fee each one charges."
        actions={
          <PermissionGuard permission="logistics.manage">
            <Button variant="brand" size="sm" onClick={openCreate}>
              <Plus /> Add provider
            </Button>
          </PermissionGuard>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat icon={Truck} label="Total providers" value={providers.length} detail="Configured for Hook checkout" tone="bg-[#fff8dc] text-[#8a6900]" />
        <Stat icon={Activity} label="Active" value={activeCount} detail="Offered to customers right now" tone="bg-emerald-50 text-emerald-700" />
        <Stat icon={Wallet} label="Lowest fee" value={cheapest === null ? "—" : formatNaira(cheapest)} detail="Cheapest active delivery option" tone="bg-blue-50 text-blue-700" />
      </div>

      <Card className="rounded-xl shadow-none">
        <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search provider or code"
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-full sm:w-36"><SelectValue placeholder="All status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {search || status !== "all" ? (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatus("all"); }}>
                <X /> Clear
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <QueryState
        loading={query.isLoading}
        error={query.error}
        loadingLabel="Loading logistics providers"
        errorTitle="Logistics providers unavailable"
        empty={!query.isLoading && !query.isError && !filtered.length}
        emptyIcon={Truck}
        emptyTitle="No logistics providers yet"
        emptyDescription="Add a courier so customers have a delivery option at checkout."
        onRetry={() => query.refetch()}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((provider) => (
            <Card key={provider.publicId || provider.id} className="rounded-xl shadow-none transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <ProviderLogo provider={provider} className="size-12" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-base font-semibold text-foreground">{provider.name}</p>
                        <StatusBadge status={provider.status} />
                      </div>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">{provider.code}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-lg font-semibold tabular-nums text-foreground">
                    {formatNaira(provider.feeMinor)}
                  </span>
                </div>
                {provider.description ? (
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{provider.description}</p>
                ) : null}
                {canManage ? (
                  <div className="mt-4 flex items-center gap-2 border-t pt-3">
                    <Button variant="outline" size="sm" onClick={() => openEdit(provider)}>
                      <Pencil /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRemoving(provider)}>
                      <Trash2 /> Remove
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </QueryState>

      <Dialog open={creating || Boolean(editing)} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit logistics provider" : "Add logistics provider"}</DialogTitle>
            <DialogDescription>
              Customers see active providers at checkout, and the fee here becomes their delivery fee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* A courier is recognised by its mark, so show it large and exactly
                as the customer will see it in the app's picker. */}
            <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
              <ProviderLogo
                provider={{ logoUrl: form.logoUrl, name: form.name || "This courier" }}
                className="size-20"
              />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {form.name || "New courier"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {form.code ? form.code.toUpperCase() : "Customer-facing preview"}
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-[#8a6900]">
                  {feeValid ? formatNaira(Math.round(Number(form.fee) * 100)) : "Delivery fee not set"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="provider-code">Code</Label>
                <Input
                  id="provider-code"
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                  placeholder="GIG"
                  maxLength={40}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-fee">Delivery fee (₦)</Label>
                <Input
                  id="provider-fee"
                  type="number"
                  min={0}
                  value={form.fee}
                  onChange={(event) => setForm((current) => ({ ...current, fee: event.target.value }))}
                  placeholder="5000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider-name">Name</Label>
              <Input
                id="provider-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="GIG Logistics"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider-description">Description</Label>
              <Textarea
                id="provider-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Nationwide delivery, 2-4 working days."
                maxLength={300}
              />
            </div>

            <MediaPicker
              maxFiles={1}
              uploadPath="/admin/uploads/images"
              value={form.logoUrl ? [form.logoUrl] : []}
              onChange={(urls) => setForm((current) => ({ ...current, logoUrl: urls[0] || "" }))}
              label="Courier logo"
              description="Upload the courier's logo or paste a direct image link. Customers see it when choosing delivery."
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="provider-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((current) => ({ ...current, status: value as "active" | "inactive" }))}
                >
                  <SelectTrigger id="provider-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-order">Sort order</Label>
                <Input
                  id="provider-order"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={closeForm}>Cancel</Button>
            <Button variant="brand" disabled={saving || !formValid} onClick={() => void save()}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add provider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(removing)} onOpenChange={(open) => { if (!open) setRemoving(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.name}?</DialogTitle>
            <DialogDescription>
              Customers will no longer be able to choose this courier at checkout. Orders already placed with it are unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={() => void remove()}>
              {saving ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
