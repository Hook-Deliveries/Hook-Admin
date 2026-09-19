"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Filter, Plus, Search, Store, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { AdminWorkflowSheet } from "@/components/shared/AdminWorkflowSheet";
import { QueryState } from "@/components/shared/QueryState";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { useAdminSession, useApiQuery } from "@/lib/query";
import { apiPost } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { MarketCard } from "./MarketCard";
import { MarketOverview } from "./MarketOverview";
import type { CollectionResponse, LookupRecord, MarketRecord } from "./market-types";

type MarketListResponse = CollectionResponse<MarketRecord>;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : fallback;
}

export function MarketDirectoryPage() {
  const { data: session } = useAdminSession();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [state, setState] = useState("all");
  const [lifecycleMarket, setLifecycleMarket] = useState<MarketRecord | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [assignmentMarket, setAssignmentMarket] = useState<MarketRecord | null>(null);
  const [assignmentHub, setAssignmentHub] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [acting, setActing] = useState(false);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const allowed = hasPermission(session, "markets.view");
  const query = useApiQuery<MarketListResponse>(["admin", "markets"], "/admin/markets?limit=100", Boolean(session && allowed));
  const states = useApiQuery<CollectionResponse<LookupRecord>>(["markets", "filters", "states"], "/admin/states?limit=100", Boolean(session && allowed));
  const hubs = useApiQuery<CollectionResponse<LookupRecord>>(["markets", "filters", "hubs"], "/admin/hubs?limit=100", Boolean(session && allowed));
  const markets = useMemo(() => query.data?.data || [], [query.data?.data]);
  const stateOptions = states.data?.data || [];
  const hubOptions = hubs.data?.data || [];
  const filtered = useMemo(() => markets.filter((market) => {
    const text = [market.name, market.publicId, market.address, market.cityName, market.stateName, market.hubName].filter(Boolean).join(" ").toLowerCase();
    const stateMatches = state === "all" || market.stateId === state || market.state?.publicId === state;
    return (!deferredSearch || text.includes(deferredSearch)) && (status === "all" || String(market.status).toLowerCase() === status) && stateMatches;
  }), [deferredSearch, markets, state, status]);
  const canManage = hasPermission(session, "markets.manage");

  async function changeLifecycle() {
    if (!lifecycleMarket || lifecycleReason.trim().length < 3) return;
    setActing(true);
    try {
      const id = lifecycleMarket.publicId || lifecycleMarket.id;
      const suffix = lifecycleMarket.status === "active" ? "deactivate" : "activate";
      await apiPost(`/admin/markets/${id}/${suffix}`, { reason: lifecycleReason.trim() });
      toast.success(`Market ${suffix === "activate" ? "activated" : "deactivated"}`);
      await query.refetch();
      setLifecycleMarket(null);
      setLifecycleReason("");
    } catch (error) {
      toast.error(errorMessage(error, "Unable to update market status"));
    } finally {
      setActing(false);
    }
  }

  async function assignHub() {
    if (!assignmentMarket || !assignmentHub || assignmentReason.trim().length < 3) return;
    setActing(true);
    try {
      const id = assignmentMarket.publicId || assignmentMarket.id;
      await apiPost(`/admin/markets/${id}/assign-hub`, { hubId: assignmentHub, reason: assignmentReason.trim() });
      toast.success("Dispatch Hub assigned");
      await query.refetch();
      setAssignmentMarket(null);
      setAssignmentHub("");
      setAssignmentReason("");
    } catch (error) {
      toast.error(errorMessage(error, "Unable to assign Dispatch Hub"));
    } finally {
      setActing(false);
    }
  }

  if (session && !allowed) {
    return <div className="mx-auto flex min-h-96 max-w-2xl items-center justify-center p-6 text-center"><div><Store className="mx-auto size-10 text-muted-foreground" /><h1 className="mt-4 text-lg font-semibold">Market access is restricted</h1><p className="mt-1 text-sm text-muted-foreground">Your current role does not include permission to view market operations.</p></div></div>;
  }

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader title="Markets" description="A visual operating directory for the markets that power Hook catalog capture and fulfilment." actions={<PermissionGuard permission="markets.manage"><Button asChild variant="brand" size="sm"><Link href="/dashboard/markets/new"><Plus /> Add market</Link></Button></PermissionGuard>} />
      <MarketOverview markets={markets} />
      <Card className="rounded-xl shadow-none">
        <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search market, location, or ID" className="h-9 pl-9" /></div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={state} onValueChange={setState}><SelectTrigger className="h-9 w-full sm:w-44"><SelectValue placeholder="All states" /></SelectTrigger><SelectContent><SelectItem value="all">All states</SelectItem>{stateOptions.map((item) => <SelectItem key={item.publicId || item.id} value={String(item.publicId || item.id)}>{item.name}</SelectItem>)}</SelectContent></Select>
            <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-9 w-full sm:w-36"><SelectValue placeholder="All status" /></SelectTrigger><SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>
            {search || status !== "all" || state !== "all" ? <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatus("all"); setState("all"); }}><X /> Clear</Button> : <span className="hidden items-center gap-1 text-xs text-muted-foreground xl:flex"><Filter className="size-3.5" /> Refine directory</span>}
          </div>
        </CardContent>
      </Card>
      <QueryState loading={query.isLoading} error={query.error} loadingLabel="Loading market directory" errorTitle="Market directory unavailable" empty={!query.isLoading && !query.isError && !filtered.length} emptyIcon={Store} emptyTitle="No markets found" emptyDescription="Adjust the filters or create a market for this operating network." onRetry={() => query.refetch()}>
        <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-medium text-foreground">Market directory <span className="ml-1 text-xs font-normal text-muted-foreground">{filtered.length} shown</span></p>{query.isFetching ? <span className="text-xs text-muted-foreground">Refreshing...</span> : null}</div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((market) => <MarketCard key={market.publicId || market.id} market={market} canManage={canManage} onLifecycle={setLifecycleMarket} onAssignHub={(record) => { setAssignmentMarket(record); setAssignmentHub(record.hub?.publicId || record.hubId || ""); }} />)}</div>
      </QueryState>
      <Dialog open={Boolean(lifecycleMarket)} onOpenChange={(next) => { if (!next && !acting) { setLifecycleMarket(null); setLifecycleReason(""); } }}><DialogContent><DialogHeader><DialogTitle>{lifecycleMarket?.status === "active" ? "Deactivate market?" : "Activate market?"}</DialogTitle><DialogDescription>{lifecycleMarket?.status === "active" ? "New operational assignments will stop using this market. Existing history remains intact." : "This market will become available for compatible operations."}</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="market-lifecycle-reason">Audit reason</Label><Input id="market-lifecycle-reason" value={lifecycleReason} onChange={(event) => setLifecycleReason(event.target.value)} placeholder="Add a clear operational reason" minLength={3} maxLength={500} /></div><DialogFooter><Button variant="outline" disabled={acting} onClick={() => setLifecycleMarket(null)}>Cancel</Button><Button variant={lifecycleMarket?.status === "active" ? "destructive" : "brand"} disabled={acting || lifecycleReason.trim().length < 3} onClick={() => void changeLifecycle()}>{acting ? "Saving..." : lifecycleMarket?.status === "active" ? "Deactivate" : "Activate"}</Button></DialogFooter></DialogContent></Dialog>
      <AdminWorkflowSheet
        open={Boolean(assignmentMarket)}
        onOpenChange={(next) => {
          if (!next && !acting) {
            setAssignmentMarket(null);
            setAssignmentHub("");
            setAssignmentReason("");
          }
        }}
        title="Assign Dispatch Hub"
        description="Choose a Hub in the same State. The backend validates geographic compatibility before saving."
        footer={(
          <>
            <Button variant="outline" disabled={acting} onClick={() => setAssignmentMarket(null)}>Cancel</Button>
            <Button variant="brand" disabled={acting || !assignmentHub || assignmentReason.trim().length < 3} onClick={() => void assignHub()}>
              {acting ? "Saving..." : "Assign Hub"}
            </Button>
          </>
        )}
      >
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Dispatch Hub</Label>
            <Select value={assignmentHub} onValueChange={setAssignmentHub}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select a Dispatch Hub" /></SelectTrigger>
              <SelectContent>{hubOptions.map((item) => <SelectItem key={item.publicId || item.id} value={String(item.publicId || item.id)}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="market-assignment-reason">Audit reason</Label>
            <Input id="market-assignment-reason" value={assignmentReason} onChange={(event) => setAssignmentReason(event.target.value)} placeholder="Why is this Hub being assigned?" minLength={3} maxLength={500} />
          </div>
        </div>
      </AdminWorkflowSheet>
    </div>
  );
}
