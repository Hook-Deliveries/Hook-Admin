"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ClipboardCheck, Clock3, Filter, RotateCcw, Search, ShieldCheck, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { QueryState } from "@/components/shared/QueryState";
import { useApiQuery } from "@/lib/query";
import { ProductSubmissionCard } from "./ProductSubmissionCard";
import type { CursorPage, ProductSubmission } from "@/lib/catalog";

interface Dashboard {
  pending: number;
  inReview: number;
  changesRequested: number;
  approvedToday: number;
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: number; tone: string }) {
  return (
    <Card className="rounded-xl shadow-none">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <span className={`grid size-9 place-items-center rounded-lg ${tone}`}><Icon className="size-4" /></span>
          <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
        </div>
        <p className="mt-3 text-xs font-semibold text-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export function ProductSubmissionDirectoryPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [market, setMarket] = useState("all");
  const [marketAssociate, setMarketAssociate] = useState("all");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const dashboard = useApiQuery<Dashboard>(["admin", "product-submissions", "dashboard"], "/admin/catalog/review/dashboard");
  const query = useApiQuery<CursorPage<ProductSubmission>>(["admin", "product-submissions", "queue"], "/admin/catalog/review?limit=50");
  const submissions = useMemo(() => query.data?.data || [], [query.data?.data]);

  const marketOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of submissions) {
      if (item.market?.publicId) seen.set(item.market.publicId, item.market.name);
    }
    return Array.from(seen, ([publicId, name]) => ({ publicId, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [submissions]);

  const marketAssociateOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of submissions) {
      if (item.marketAssociate?.publicId) {
        seen.set(item.marketAssociate.publicId, item.marketAssociate.name || item.marketAssociate.publicId);
      }
    }
    return Array.from(seen, ([publicId, name]) => ({ publicId, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [submissions]);

  const filtered = useMemo(() => submissions.filter((item) => {
    const text = [item.basicTitle, item.publicId, item.market?.name, item.marketVendor?.businessName].filter(Boolean).join(" ").toLowerCase();
    return (!deferredSearch || text.includes(deferredSearch))
      && (status === "all" || item.status === status)
      && (market === "all" || item.market?.publicId === market)
      && (marketAssociate === "all" || item.marketAssociate?.publicId === marketAssociate);
  }), [deferredSearch, submissions, status, market, marketAssociate]);

  const hasActiveFilters = Boolean(search) || status !== "all" || market !== "all" || marketAssociate !== "all";

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setMarket("all");
    setMarketAssociate("all");
  }

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        title="Product Submissions"
        description="Review Market Associate-captured items and complete the remaining product details to activate them."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Clock3} label="Awaiting review" value={dashboard.data?.pending || 0} tone="bg-[#fff8dc] text-[#8a6900]" />
        <Stat icon={ClipboardCheck} label="In review" value={dashboard.data?.inReview || 0} tone="bg-blue-50 text-blue-700" />
        <Stat icon={RotateCcw} label="Changes requested" value={dashboard.data?.changesRequested || 0} tone="bg-amber-50 text-amber-800" />
        <Stat icon={ShieldCheck} label="Approved today" value={dashboard.data?.approvedToday || 0} tone="bg-emerald-50 text-emerald-700" />
      </div>
      <Card className="rounded-xl shadow-none">
        <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, market, or ID" className="h-9 pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-full sm:w-44"><SelectValue placeholder="All status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="in_review">In review</SelectItem>
                <SelectItem value="changes_requested">Changes requested</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={market} onValueChange={setMarket}>
              <SelectTrigger className="h-9 w-full sm:w-48"><SelectValue placeholder="All markets" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All markets</SelectItem>
                {marketOptions.map((item) => (
                  <SelectItem key={item.publicId} value={item.publicId}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={marketAssociate} onValueChange={setMarketAssociate}>
              <SelectTrigger className="h-9 w-full sm:w-52"><SelectValue placeholder="All Market Associates" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Market Associates</SelectItem>
                {marketAssociateOptions.map((item) => (
                  <SelectItem key={item.publicId} value={item.publicId}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}><X /> Clear</Button>
            ) : (
              <span className="hidden items-center gap-1 text-xs text-muted-foreground xl:flex"><Filter className="size-3.5" /> Refine queue</span>
            )}
          </div>
        </CardContent>
      </Card>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        loadingLabel="Loading submissions"
        errorTitle="Submissions unavailable"
        empty={!query.isLoading && !query.isError && !filtered.length}
        emptyIcon={ClipboardCheck}
        emptyTitle="No submissions found"
        emptyDescription="Adjust the filters, or check back once a Market Associate submits a capture."
        onRetry={() => query.refetch()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Submission queue <span className="ml-1 text-xs font-normal text-muted-foreground">{filtered.length} shown</span></p>
          {query.isFetching ? <span className="text-xs text-muted-foreground">Refreshing...</span> : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => <ProductSubmissionCard key={item.publicId} submission={item} />)}
        </div>
      </QueryState>
    </div>
  );
}
