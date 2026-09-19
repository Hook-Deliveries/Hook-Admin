"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { QueryState } from "@/components/shared/QueryState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiPatch, apiPost } from "@/lib/api";
import { useAdminSession, useApiQuery } from "@/lib/query";
import { hasPermission } from "@/lib/permissions";
import { toast } from "sonner";

type StateRow = {
  publicId: string;
  name: string;
  capitalName?: string;
  code: string;
  status: string;
  deliveryEnabled: boolean;
  lgaCount?: number;
};

type Rule = {
  publicId: string;
  name: string;
  scope: "global" | "state";
  scopeId?: string;
  mode: "flat" | "per_km" | "distance_bands";
  flatFeeMinor?: number;
  baseFeeMinor?: number;
  feePerKmMinor?: number;
  fallbackFeeMinor?: number;
  originHubId?: string;
  bands?: Array<{ upToKm: number; feeMinor: number }>;
  status: "active" | "inactive";
  version: number;
};

type DeliverySettings = {
  defaultDeliveryFeeMinor?: number;
};

type DeliveryQueryData = {
  settings: DeliverySettings;
  states: StateRow[];
  rules: Rule[];
};

type DirectoryRow = {
  publicId?: string;
  id?: string;
  name: string;
};

type PreviewResult = {
  scope: Rule["scope"];
  mode: Rule["mode"];
  distanceKm?: number;
  billableKm?: number;
  baseFeeMinor?: number;
  feePerKmMinor?: number;
  feeMinor: number;
  ruleVersion: string;
};

const pageGutter = "w-full space-y-5 px-4 py-5";

function money(value: number | undefined) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0) / 100);
}

function listOf<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.items)) return record.items as T[];
  }
  return [];
}

function directoryId(row: DirectoryRow) {
  return row.publicId || row.id;
}

export function DeliveryCoveragePage() {
  const session = useAdminSession();
  const queryClient = useQueryClient();
  const canManageCoverage = hasPermission(
    session.data,
    "delivery.coverage.manage",
  );
  const canManagePricing = hasPermission(
    session.data,
    "delivery.pricing.manage",
  );
  const canPreview = hasPermission(session.data, "delivery.pricing.preview");
  const query = useApiQuery<DeliveryQueryData>(
    ["admin", "delivery"],
    "/admin/delivery",
  );
  const hubsQuery = useApiQuery<unknown>(
    ["admin", "delivery", "hubs"],
    "/admin/hubs?limit=100",
  );
  const [defaultFeeDraft, setDefaultFeeDraft] = useState<string>();
  const [form, setForm] = useState({
    name: "",
    scope: "global" as Rule["scope"],
    scopeId: "",
    mode: "per_km" as Rule["mode"],
    flatFee: "3000",
    baseFee: "1500",
    feePerKm: "150",
    fallbackFee: "3000",
    originHubId: "none",
    bands: "10:2500,25:3000,60:4000",
  });
  const [previewStateId, setPreviewStateId] = useState("");
  const [previewLatitude, setPreviewLatitude] = useState("6.5244");
  const [previewLongitude, setPreviewLongitude] = useState("3.3792");
  const [previewResult, setPreviewResult] = useState<PreviewResult>();
  const [refreshingCatalog, setRefreshingCatalog] = useState(false);
  const [stateSearch, setStateSearch] = useState("");

  const states = query.data?.states || [];
  const rules = query.data?.rules || [];
  const hubs = listOf<DirectoryRow>(hubsQuery.data);
  const defaultFee =
    defaultFeeDraft ??
    String(
      Number(query.data?.settings?.defaultDeliveryFeeMinor ?? 300000) / 100,
    );
  const selectedPreviewStateId =
    previewStateId ||
    states.find((state) => state.deliveryEnabled)?.publicId ||
    "";
  const scopeRows: DirectoryRow[] = states;
  const filteredStates = useMemo(() => {
    const value = stateSearch.trim().toLowerCase();
    if (!value) return states;
    return states.filter((state) =>
      `${state.name} ${state.capitalName || ""} ${state.code}`
        .toLowerCase()
        .includes(value),
    );
  }, [stateSearch, states]);
  const enabledStateCount = states.filter((state) => state.deliveryEnabled).length;
  const pausedStateCount = Math.max(states.length - enabledStateCount, 0);
  const totalLgaCount = states.reduce((total, state) => total + (state.lgaCount || 0), 0);
  const currentFallbackMinor = Number(
    query.data?.settings?.defaultDeliveryFeeMinor ?? 300000,
  );

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "delivery"] }),
      queryClient.invalidateQueries({
        queryKey: ["admin", "delivery", "hubs"],
      }),
    ]);
  }

  async function toggleState(state: StateRow, enabled: boolean) {
    try {
      await apiPatch(`/admin/delivery/states/${state.publicId}`, {
        deliveryEnabled: enabled,
        reason: enabled
          ? "Enabled customer delivery coverage"
          : "Paused customer delivery coverage",
      });
      toast.success(`${state.name} delivery ${enabled ? "enabled" : "paused"}`);
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update delivery coverage",
      );
    }
  }

  async function saveDefaultFee() {
    const naira = Number(defaultFee);
    if (!Number.isFinite(naira) || naira < 0)
      return toast.error("Enter a valid delivery fallback");
    try {
      await apiPatch("/admin/delivery/settings", {
        defaultDeliveryFeeMinor: Math.round(naira * 100),
        reason: "Updated global delivery fallback",
      });
      toast.success("Global delivery fallback updated");
      setDefaultFeeDraft(undefined);
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save the delivery fee",
      );
    }
  }

  async function refreshCatalog() {
    setRefreshingCatalog(true);
    try {
      const result = await apiPost<{ total: number }>(
        "/admin/delivery/locations/refresh",
        { reason: "Refreshed Nigerian State and LGA catalog" },
      );
      toast.success(`Location catalog refreshed: ${result.total} active LGAs`);
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not refresh the location catalog",
      );
    } finally {
      setRefreshingCatalog(false);
    }
  }

  async function createRule() {
    if (!form.name.trim()) return toast.error("Name the pricing rule first");
    const flatFee = Number(form.flatFee);
    const baseFee = Number(form.baseFee);
    const feePerKm = Number(form.feePerKm);
    const fallbackFee = Number(form.fallbackFee);
    const bands = form.bands
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [distance, amount] = item.split(":").map(Number);
        return { upToKm: distance, feeMinor: Math.round(amount * 100) };
      });
    if (form.mode === "flat" && (!Number.isFinite(flatFee) || flatFee < 0))
      return toast.error("Enter a valid flat fee");
    if (
      form.mode === "per_km" &&
      [baseFee, feePerKm, fallbackFee].some(
        (value) => !Number.isFinite(value) || value < 0,
      )
    )
      return toast.error(
        "Enter a valid base fee, kilometer rate, and fallback",
      );
    if (
      form.mode === "distance_bands" &&
      bands.some(
        (band) =>
          !Number.isFinite(band.upToKm) ||
          !Number.isFinite(band.feeMinor) ||
          band.upToKm <= 0,
      )
    )
      return toast.error("Use distance bands like 10:2500,25:3000");
    try {
      await apiPost("/admin/delivery/rules", {
        name: form.name.trim(),
        scope: form.scope,
        scopeId: form.scope === "global" ? undefined : form.scopeId,
        mode: form.mode,
        flatFeeMinor:
          form.mode === "flat" ? Math.round(flatFee * 100) : undefined,
        baseFeeMinor:
          form.mode === "per_km" ? Math.round(baseFee * 100) : undefined,
        feePerKmMinor:
          form.mode === "per_km" ? Math.round(feePerKm * 100) : undefined,
        fallbackFeeMinor:
          form.mode === "per_km" ? Math.round(fallbackFee * 100) : undefined,
        originHubId: form.originHubId === "none" ? undefined : form.originHubId,
        bands: form.mode === "distance_bands" ? bands : [],
        status: "active",
        reason: "Created delivery pricing rule",
      });
      toast.success("Delivery pricing rule created");
      setForm((current) => ({ ...current, name: "" }));
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create pricing rule",
      );
    }
  }

  async function toggleRule(rule: Rule) {
    try {
      await apiPatch(`/admin/delivery/rules/${rule.publicId}`, {
        status: rule.status === "active" ? "inactive" : "active",
        reason: "Updated delivery pricing rule status",
      });
      toast.success("Pricing rule status updated");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update pricing rule",
      );
    }
  }

  async function previewFee() {
    if (!selectedPreviewStateId)
      return toast.error("Choose a State for the preview");
    const latitude = Number(previewLatitude);
    const longitude = Number(previewLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
      return toast.error("Enter valid destination coordinates");
    try {
      setPreviewResult(
        await apiPost<PreviewResult>("/admin/delivery/preview", {
          stateId: selectedPreviewStateId,
          coordinates: { latitude, longitude },
        }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not calculate delivery fee",
      );
    }
  }

  if (!hasPermission(session.data, "delivery.coverage.view"))
    return (
      <div className={pageGutter}>
        <QueryState
          empty
          emptyTitle="Delivery settings unavailable"
          emptyDescription="Your account does not have access to delivery coverage."
        />
      </div>
    );
  if (query.isLoading)
    return (
      <div className={pageGutter}>
        <QueryState loading loadingLabel="Loading delivery coverage" />
      </div>
    );
  if (query.isError)
    return (
      <div className={pageGutter}>
        <QueryState
          error={query.error}
          errorTitle="Delivery settings could not load"
          onRetry={() => void query.refetch()}
        />
      </div>
    );

  return (
    <div className={pageGutter}>
      <PageHeader
        title="Delivery States & Fees"
        description="Control where customers can receive Hook orders and how delivery fees are calculated. Market sourcing is managed separately."
      />

      <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="border-l-4 border-[#FFC809] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#FFF4BD] text-[#8A6900]">
                <MapPin className="size-5" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Customer delivery network</p>
            </div>
            <h2 className="mt-5 max-w-2xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Delivery coverage across Nigeria</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Choose where customers can receive Hook orders and keep the address catalogue ready for quick State and LGA selection. This does not determine where products are sourced.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-foreground">{enabledStateCount} States enabled</span>
              <span className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-foreground">{totalLgaCount} LGAs available</span>
              <span className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-foreground">{money(currentFallbackMinor)} fallback</span>
            </div>
          </div>
          <div className="relative hidden overflow-hidden bg-[#FFC809] lg:block">
            <div className="absolute -right-16 -top-20 size-64 rounded-full border-[28px] border-white/30" />
            <div className="absolute -bottom-20 -left-16 size-48 rounded-full border-[20px] border-black/10" />
            <div className="relative flex h-full min-h-52 items-end p-6">
              <div className="rounded-xl bg-black px-4 py-3 text-white shadow-sm">
                <p className="text-xs text-white/60">Coverage status</p>
                <p className="mt-1 text-lg font-semibold">{pausedStateCount ? `${pausedStateCount} paused` : "Nationwide ready"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><CheckCircle2 className="size-5" /></div>
            <div><p className="text-sm text-muted-foreground">Available for delivery</p><p className="mt-1 text-2xl font-semibold">{enabledStateCount}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Database className="size-5" /></div>
            <div><p className="text-sm text-muted-foreground">LGAs ready</p><p className="mt-1 text-2xl font-semibold">{totalLgaCount}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Clock3 className="size-5" /></div>
            <div><p className="text-sm text-muted-foreground">Paused States</p><p className="mt-1 text-2xl font-semibold">{pausedStateCount}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><SlidersHorizontal className="size-5" /></div>
            <div><p className="text-sm text-muted-foreground">Global fallback</p><p className="mt-1 text-2xl font-semibold">{money(currentFallbackMinor)}</p></div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="coverage" className="gap-5">
        <div className="flex flex-col gap-3 border-b border-border/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="coverage">
              <MapPin data-icon="inline-start" /> Coverage
            </TabsTrigger>
            <TabsTrigger value="pricing">
              <SlidersHorizontal data-icon="inline-start" /> Pricing
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canManageCoverage || refreshingCatalog}
              onClick={() => void refreshCatalog()}
            >
              {refreshingCatalog ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Database data-icon="inline-start" />
              )}
              Refresh locations
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
              <RefreshCw data-icon="inline-start" />
              Refresh
            </Button>
          </div>
        </div>

        <TabsContent value="coverage" className="mt-0 space-y-6">
          {pausedStateCount > 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-[#F0D979] bg-[#FFF9DC] px-4 py-3 text-sm text-[#665100]">
              <Clock3 className="mt-0.5 size-4 shrink-0" />
              <p><span className="font-semibold">Some delivery coverage is paused.</span> New addresses and checkout are blocked for those States until coverage is enabled again.</p>
            </div>
          ) : null}

          <Card className="gap-0">
            <CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Delivery State directory</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Enable or pause customer delivery by State. This does not change Market sourcing.</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={stateSearch} onChange={(event) => setStateSearch(event.target.value)} placeholder="Search State or capital" className="pl-9" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Capital</TableHead>
                      <TableHead>LGAs</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead className="text-right">Delivery</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStates.map((state, index) => (
                      <TableRow key={state.publicId}>
                        <TableCell className="text-center text-xs text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-xs font-bold">{state.code}</div>
                            <div><p className="font-medium">{state.name}</p><p className="text-xs text-muted-foreground">{state.publicId}</p></div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{state.capitalName || "Not recorded"}</TableCell>
                        <TableCell><span className="font-medium">{state.lgaCount || 0}</span><span className="ml-1 text-xs text-muted-foreground">active</span></TableCell>
                        <TableCell>
                          <Badge variant={state.deliveryEnabled ? "default" : "outline"}>
                            {state.deliveryEnabled ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
                            {state.deliveryEnabled ? "Available" : "Paused"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-3">
                            <span className="hidden text-xs text-muted-foreground sm:inline">{state.deliveryEnabled ? "Enabled" : "Paused"}</span>
                            <Switch checked={Boolean(state.deliveryEnabled)} disabled={!canManageCoverage} onCheckedChange={(enabled) => void toggleState(state, enabled)} aria-label={`${state.deliveryEnabled ? "Pause" : "Enable"} delivery in ${state.name}`} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {!filteredStates.length ? <div className="px-6 py-12 text-center text-sm text-muted-foreground">No States match your search.</div> : null}
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Check size={14} className="text-emerald-600" /> Delivery coverage is independent from Market sourcing availability.
          </div>
        </TabsContent>

        <TabsContent value="pricing" className="mt-0 space-y-6">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="gap-0">
          <CardHeader className="border-b">
            <CardTitle>Global fallback delivery fee</CardTitle>
            <p className="text-sm text-muted-foreground">Used when no active State pricing rule can calculate a route.</p>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="global-fee">Fallback fee (NGN)</Label>
              <Input id="global-fee" inputMode="decimal" value={defaultFee} onChange={(event) => setDefaultFeeDraft(event.target.value)} disabled={!canManagePricing} />
            </div>
            <Button className="w-full" variant="brand" disabled={!canManagePricing} onClick={() => void saveDefaultFee()}>
              <Save className="size-4" /> Save fallback
            </Button>
            <div className="rounded-xl bg-hook/10 p-3 text-sm">
              <span className="font-semibold">Current fallback:</span> {money(currentFallbackMinor)}
            </div>
          </CardContent>
        </Card>

        {canPreview ? (
          <Card className="gap-0">
            <CardHeader className="border-b">
              <CardTitle>Delivery fee preview</CardTitle>
              <p className="text-sm text-muted-foreground">Test the fee returned for a destination before publishing a pricing rule.</p>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Delivery State</Label>
                <Select value={selectedPreviewStateId} onValueChange={setPreviewStateId}>
                  <SelectTrigger><SelectValue placeholder="Choose State" /></SelectTrigger>
                  <SelectContent>
                    {states.filter((state) => state.deliveryEnabled).map((state) => (
                      <SelectItem key={state.publicId} value={state.publicId}>{state.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Latitude</Label><Input value={previewLatitude} inputMode="decimal" onChange={(event) => setPreviewLatitude(event.target.value)} /></div>
              <div className="space-y-2"><Label>Longitude</Label><Input value={previewLongitude} inputMode="decimal" onChange={(event) => setPreviewLongitude(event.target.value)} /></div>
              <Button className="sm:col-span-2" variant="brand" onClick={() => void previewFee()}><MapPin className="size-4" /> Calculate fee</Button>
              {previewResult ? (
                <div className="grid gap-3 rounded-xl bg-hook/10 p-4 text-sm sm:col-span-2 sm:grid-cols-2">
                  <div><p className="text-xs text-muted-foreground">Estimated fee</p><p className="mt-1 text-xl font-semibold">{money(previewResult.feeMinor)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Pricing rule</p><p className="mt-1 font-medium capitalize">{previewResult.scope} · {String(previewResult.mode).replace("_", " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Distance</p><p className="mt-1 font-medium">{previewResult.distanceKm != null ? `${previewResult.distanceKm} km · ${previewResult.billableKm || Math.ceil(previewResult.distanceKm)} billable` : "Fallback applied"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Rule version</p><p className="mt-1 font-medium">{previewResult.ruleVersion}</p></div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card className="gap-0">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="size-4" /> Pricing rules</CardTitle>
          <p className="text-sm text-muted-foreground">State rules take priority over the global fallback when calculating delivery.</p>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          {canManagePricing ? (
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="space-y-2 xl:col-span-2">
                <Label>Rule name</Label>
                <Input
                  value={form.name}
                  placeholder="Nationwide per-kilometer delivery"
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select
                  value={form.scope}
                  onValueChange={(value: Rule["scope"]) =>
                    setForm({ ...form, scope: value, scopeId: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Scope target</Label>
                <Select
                  value={form.scopeId || "none"}
                  onValueChange={(value) =>
                    setForm({ ...form, scopeId: value === "none" ? "" : value })
                  }
                  disabled={form.scope === "global"}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        form.scope === "global" ? "Not needed" : "Choose target"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not needed</SelectItem>
                    {scopeRows.map((row) => {
                      const id = directoryId(row);
                      return id ? (
                        <SelectItem key={id} value={id}>
                          {row.name}
                        </SelectItem>
                      ) : null;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select
                  value={form.mode}
                  onValueChange={(value: Rule["mode"]) =>
                    setForm({ ...form, mode: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_km">Base + per km</SelectItem>
                    <SelectItem value="flat">Flat fee</SelectItem>
                    <SelectItem value="distance_bands">
                      Distance bands
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.mode === "flat" ? (
                <div className="space-y-2">
                  <Label>Fee (NGN)</Label>
                  <Input
                    inputMode="decimal"
                    value={form.flatFee}
                    onChange={(event) =>
                      setForm({ ...form, flatFee: event.target.value })
                    }
                  />
                </div>
              ) : null}
              {form.mode === "per_km" ? (
                <>
                  <div className="space-y-2">
                    <Label>Base fee (NGN)</Label>
                    <Input
                      inputMode="decimal"
                      value={form.baseFee}
                      onChange={(event) =>
                        setForm({ ...form, baseFee: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rate per km (NGN)</Label>
                    <Input
                      inputMode="decimal"
                      value={form.feePerKm}
                      onChange={(event) =>
                        setForm({ ...form, feePerKm: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fallback (NGN)</Label>
                    <Input
                      inputMode="decimal"
                      value={form.fallbackFee}
                      onChange={(event) =>
                        setForm({ ...form, fallbackFee: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Origin Hub</Label>
                    <Select
                      value={form.originHubId}
                      onValueChange={(value) =>
                        setForm({ ...form, originHubId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          Automatic state Hub
                        </SelectItem>
                        {hubs.map((hub) => {
                          const id = directoryId(hub);
                          return id ? (
                            <SelectItem key={id} value={id}>
                              {hub.name}
                            </SelectItem>
                          ) : null;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : null}
              {form.mode === "distance_bands" ? (
                <div className="space-y-2 md:col-span-2 xl:col-span-4">
                  <Label>Distance bands</Label>
                  <Input
                    value={form.bands}
                    onChange={(event) =>
                      setForm({ ...form, bands: event.target.value })
                    }
                    placeholder="10:2500,25:3000,60:4000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: kilometres:fee in NGN, ordered from nearest to
                    farthest.
                  </p>
                </div>
              ) : null}
              <div className="flex items-end">
                <Button
                  variant="brand"
                  className="w-full"
                  onClick={() => void createRule()}
                >
                  <Plus size={16} /> Add rule
                </Button>
              </div>
            </div>
          ) : null}
          <div className="divide-y rounded-lg border">
            {rules.map((rule) => (
              <div
                key={rule.publicId}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{rule.name}</p>
                    <Badge
                      variant={
                        rule.status === "active" ? "default" : "secondary"
                      }
                    >
                      {rule.status}
                    </Badge>
                    <Badge variant="outline">
                      {rule.scope} · {rule.mode.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rule.mode === "per_km"
                      ? `${money(rule.baseFeeMinor)} base + ${money(rule.feePerKmMinor)}/km · fallback ${money(rule.fallbackFeeMinor)}`
                      : rule.mode === "flat"
                        ? money(rule.flatFeeMinor)
                        : `${rule.bands?.length || 0} distance bands`}{" "}
                    · v{rule.version}
                  </p>
                </div>
                {canManagePricing ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void toggleRule(rule)}
                  >
                    {rule.status === "active" ? "Pause" : "Activate"}
                  </Button>
                ) : null}
              </div>
            ))}
            {!rules.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No pricing rules configured. The global fallback remains active.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
