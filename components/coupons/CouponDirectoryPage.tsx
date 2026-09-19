"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, ArrowRight, Info, Pencil, Plus, Search, Ticket, Trash2, Users, X } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/shared/PageHeader";
import { QueryState } from "@/components/shared/QueryState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { useAdminSession, useApiQuery } from "@/lib/query";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import {
  couponValueLabel,
  couponWindowLabel,
  isExpired,
  type CollectionResponse,
  type CouponRecord,
  type CouponType,
} from "./coupon-types";

type FormState = {
  code: string;
  description: string;
  type: CouponType;
  value: string;
  maxDiscount: string;
  minSubtotal: string;
  startsAt: string;
  endsAt: string;
  totalUsageLimit: string;
  perUserLimit: string;
  status: "active" | "paused";
};

const emptyForm: FormState = {
  code: "",
  description: "",
  type: "percentage",
  value: "",
  maxDiscount: "",
  minSubtotal: "",
  startsAt: "",
  endsAt: "",
  totalUsageLimit: "",
  perUserLimit: "1",
  status: "active",
};

/**
 * Several coupon limits mean "no limit" when left blank, which is not
 * guessable from an empty box — the hint says so explicitly.
 */
function FieldLabel({ htmlFor, children, hint }: { htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{children}</Label>
      {hint ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`About ${String(children)}`}
              className="text-muted-foreground transition hover:text-foreground"
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{hint}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : fallback;
}

function Stat({ icon: Icon, label, value, detail, tone }: {
  icon: typeof Ticket; label: string; value: string | number; detail: string; tone: string;
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

function toDateInput(value?: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function CouponDirectoryPage() {
  const { data: session } = useAdminSession();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CouponRecord | null>(null);
  const [removing, setRemoving] = useState<CouponRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const allowed = hasPermission(session, "coupons.view");
  const canManage = hasPermission(session, "coupons.manage");
  const query = useApiQuery<CollectionResponse<CouponRecord>>(
    ["admin", "coupons"],
    "/admin/coupons",
    Boolean(session && allowed),
  );

  const coupons = useMemo(() => query.data?.data || [], [query.data?.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return coupons.filter((coupon) => {
      const text = [coupon.code, coupon.description].filter(Boolean).join(" ").toLowerCase();
      const matchesStatus =
        status === "all"
        || (status === "expired" ? isExpired(coupon) : coupon.status === status && !isExpired(coupon));
      return (!term || text.includes(term)) && matchesStatus;
    });
  }, [coupons, search, status]);

  const activeCount = coupons.filter((coupon) => coupon.status === "active" && !isExpired(coupon)).length;
  const totalRedemptions = coupons.reduce((sum, coupon) => sum + Number(coupon.usedCount || 0), 0);

  function openCreate() {
    setForm(emptyForm);
    setCreating(true);
  }

  function openEdit(coupon: CouponRecord) {
    setForm({
      code: coupon.code,
      description: coupon.description || "",
      type: coupon.type,
      // A percentage is a plain number; money values are stored in minor units.
      value: coupon.type === "percentage" ? String(coupon.value) : String(Number(coupon.value || 0) / 100),
      maxDiscount: coupon.maxDiscountMinor ? String(coupon.maxDiscountMinor / 100) : "",
      minSubtotal: coupon.minSubtotalMinor ? String(coupon.minSubtotalMinor / 100) : "",
      startsAt: toDateInput(coupon.startsAt),
      endsAt: toDateInput(coupon.endsAt),
      totalUsageLimit: coupon.totalUsageLimit ? String(coupon.totalUsageLimit) : "",
      perUserLimit: String(coupon.perUserLimit ?? 1),
      status: coupon.status,
    });
    setEditing(coupon);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setForm(emptyForm);
  }

  const needsValue = form.type !== "free_delivery";
  const valueValid = !needsValue || (form.value.trim() !== "" && Number(form.value) > 0
    && (form.type !== "percentage" || Number(form.value) <= 100));
  const formValid = form.code.trim().length >= 3 && valueValid;

  async function save() {
    if (!formValid) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        type: form.type,
        value: form.type === "percentage"
          ? Number(form.value)
          : form.type === "fixed"
            ? Math.round(Number(form.value) * 100)
            : 0,
        maxDiscountMinor: form.maxDiscount ? Math.round(Number(form.maxDiscount) * 100) : undefined,
        minSubtotalMinor: form.minSubtotal ? Math.round(Number(form.minSubtotal) * 100) : undefined,
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
        totalUsageLimit: form.totalUsageLimit ? Number(form.totalUsageLimit) : undefined,
        perUserLimit: Number(form.perUserLimit) || 1,
        status: form.status,
      };
      if (editing) {
        await apiPatch(`/admin/coupons/${editing.publicId || editing.id}`, payload);
        toast.success("Coupon updated");
      } else {
        await apiPost("/admin/coupons", payload);
        toast.success("Coupon created");
      }
      await query.refetch();
      closeForm();
    } catch (error) {
      toast.error(errorMessage(error, "Unable to save this coupon"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setSaving(true);
    try {
      await apiDelete(`/admin/coupons/${removing.publicId || removing.id}`);
      toast.success("Coupon removed");
      await query.refetch();
      setRemoving(null);
    } catch (error) {
      toast.error(errorMessage(error, "Unable to remove this coupon"));
    } finally {
      setSaving(false);
    }
  }

  if (session && !allowed) {
    return (
      <div className="mx-auto flex min-h-96 max-w-2xl items-center justify-center p-6 text-center">
        <div>
          <Ticket className="mx-auto size-10 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Coupon access is restricted</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your current role does not include permission to view coupons.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        title="Coupons"
        description="Time-limited and usage-limited discount codes customers can redeem at checkout."
        actions={
          <PermissionGuard permission="coupons.manage">
            <Button variant="brand" size="sm" onClick={openCreate}><Plus /> Create coupon</Button>
          </PermissionGuard>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat icon={Ticket} label="Total coupons" value={coupons.length} detail="Created on this platform" tone="bg-[#fff8dc] text-[#8a6900]" />
        <Stat icon={Activity} label="Active now" value={activeCount} detail="Redeemable at checkout today" tone="bg-emerald-50 text-emerald-700" />
        <Stat icon={Users} label="Total redemptions" value={totalRedemptions} detail="Times a coupon has been used" tone="bg-blue-50 text-blue-700" />
      </div>

      <Card className="rounded-xl shadow-none">
        <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search code or description"
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-full sm:w-36"><SelectValue placeholder="All status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
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
        loadingLabel="Loading coupons"
        errorTitle="Coupons unavailable"
        empty={!query.isLoading && !query.isError && !filtered.length}
        emptyIcon={Ticket}
        emptyTitle="No coupons found"
        emptyDescription="Create a coupon to offer customers a discount at checkout."
        onRetry={() => query.refetch()}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((coupon) => {
            const id = coupon.publicId || coupon.id;
            const expired = isExpired(coupon);
            return (
              <Card key={id} className="group rounded-xl shadow-none transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-mono text-base font-semibold text-foreground">{coupon.code}</p>
                        <StatusBadge status={expired ? "expired" : coupon.status} />
                      </div>
                      <p className="mt-1 text-sm font-medium text-[#8a6900]">{couponValueLabel(coupon)}</p>
                    </div>
                  </div>
                  {coupon.description ? (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{coupon.description}</p>
                  ) : null}
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-dashed pt-3 text-xs">
                    <div className="min-w-0">
                      <p className="text-muted-foreground">Used</p>
                      <p className="mt-1 font-medium text-foreground">
                        {coupon.usedCount}
                        {coupon.totalUsageLimit ? ` / ${coupon.totalUsageLimit}` : ""}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-muted-foreground">Window</p>
                      <p className="mt-1 truncate font-medium text-foreground">{couponWindowLabel(coupon)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3">
                    <Link
                      href={`/dashboard/coupons/${id}`}
                      className="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-[#8a6900]"
                    >
                      <Ticket className="size-3.5 text-[#b18b00]" /> View usage
                      <ArrowRight className="size-3.5" />
                    </Link>
                    {canManage ? (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${coupon.code}`} onClick={() => openEdit(coupon)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          aria-label={`Remove ${coupon.code}`}
                          onClick={() => setRemoving(coupon)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </QueryState>

      <Dialog open={creating || Boolean(editing)} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit coupon" : "Create coupon"}</DialogTitle>
            <DialogDescription>
              Customers enter this code at checkout. Limits below control how often it can be used —
              leave any limit empty to make it unlimited.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="coupon-code">Code</Label>
                <Input
                  id="coupon-code"
                  value={form.code}
                  onChange={(event) => setForm((c) => ({ ...c, code: event.target.value.toUpperCase() }))}
                  placeholder="WELCOME10"
                  maxLength={40}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coupon-type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) => setForm((c) => ({ ...c, type: value as CouponType }))}
                >
                  <SelectTrigger id="coupon-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage off</SelectItem>
                    <SelectItem value="fixed">Fixed amount off</SelectItem>
                    <SelectItem value="free_delivery">Free delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {needsValue ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="coupon-value">
                    {form.type === "percentage" ? "Percentage (%)" : "Amount off (₦)"}
                  </Label>
                  <Input
                    id="coupon-value"
                    type="number"
                    min={0}
                    max={form.type === "percentage" ? 100 : undefined}
                    value={form.value}
                    onChange={(event) => setForm((c) => ({ ...c, value: event.target.value }))}
                    placeholder={form.type === "percentage" ? "10" : "2000"}
                  />
                </div>
                {form.type === "percentage" ? (
                  <div className="space-y-2">
                    <FieldLabel htmlFor="coupon-max" hint="The most a single order can be discounted, however large the basket. Leave empty for no ceiling.">Max discount (₦)</FieldLabel>
                    <Input
                      id="coupon-max"
                      type="number"
                      min={0}
                      value={form.maxDiscount}
                      onChange={(event) => setForm((c) => ({ ...c, maxDiscount: event.target.value }))}
                      placeholder="Optional ceiling"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="coupon-description">Description</Label>
              <Textarea
                id="coupon-description"
                value={form.description}
                onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))}
                placeholder="10% off your first order"
                maxLength={300}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="coupon-starts" hint="When the code becomes usable. Leave empty to start straight away.">Starts</FieldLabel>
                <Input
                  id="coupon-starts"
                  type="date"
                  value={form.startsAt}
                  onChange={(event) => setForm((c) => ({ ...c, startsAt: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="coupon-ends" hint="When the code stops working. Leave empty so it never expires.">Ends</FieldLabel>
                <Input
                  id="coupon-ends"
                  type="date"
                  value={form.endsAt}
                  onChange={(event) => setForm((c) => ({ ...c, endsAt: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="coupon-total-limit" hint="How many times this code may be redeemed across all customers. Leave empty for unlimited uses.">Total uses</FieldLabel>
                <Input
                  id="coupon-total-limit"
                  type="number"
                  min={1}
                  value={form.totalUsageLimit}
                  onChange={(event) => setForm((c) => ({ ...c, totalUsageLimit: event.target.value }))}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="coupon-user-limit" hint="How many times one customer may redeem this code. Defaults to 1.">Uses per customer</FieldLabel>
                <Input
                  id="coupon-user-limit"
                  type="number"
                  min={1}
                  value={form.perUserLimit}
                  onChange={(event) => setForm((c) => ({ ...c, perUserLimit: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="coupon-min" hint="Basket subtotal required before the code applies. Leave empty for no minimum.">Minimum order (₦)</FieldLabel>
                <Input
                  id="coupon-min"
                  type="number"
                  min={0}
                  value={form.minSubtotal}
                  onChange={(event) => setForm((c) => ({ ...c, minSubtotal: event.target.value }))}
                  placeholder="No minimum"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coupon-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((c) => ({ ...c, status: value as "active" | "paused" }))}
                >
                  <SelectTrigger id="coupon-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={closeForm}>Cancel</Button>
            <Button variant="brand" disabled={saving || !formValid} onClick={() => void save()}>
              {saving ? "Saving..." : editing ? "Save changes" : "Create coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(removing)} onOpenChange={(open) => { if (!open) setRemoving(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.code}?</DialogTitle>
            <DialogDescription>
              Customers will no longer be able to redeem this code. Orders that already used it are unaffected.
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
