"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, Bot, CheckCircle2, Clock3, Languages, Settings2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AdminWorkflowSheet } from "@/components/shared/AdminWorkflowSheet";
import { KpiCard } from "@/components/shared/KpiCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { QueryState } from "@/components/shared/QueryState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePermission } from "@/hooks/use-permission";
import { apiPatch } from "@/lib/api";
import { useApiQuery } from "@/lib/query";

type Row = { id: string; status: string; product?: { id: string; name: string; images?: string[] } | null; customer?: { firstName?: string; lastName?: string; email?: string } | null; quantity: number; offerCount: number; maximumOffers: number; agreedPriceMinor?: number | null; lastDecision?: string | null; language: string; providerFallback: boolean; expiresAt?: string; updatedAt: string };
type Page = { data: Row[]; total: number; accepted: number; active: number; conversionRate: number; fallbackRate: number };
type Settings = { enabled: boolean; sessionMode: "fixed" | "unlimited"; sessionMinutes: number; maximumOffers: number; quoteMinutes: number; azureWordingEnabled: boolean; providerConfigured: boolean; updatedAt?: string };

function money(value?: number | null) { return value ? `₦${Math.round(value / 100).toLocaleString("en-NG")}` : "—"; }

export default function AINegotiationPage() {
  const canManage = usePermission("ai_negotiation.manage");
  const query = useApiQuery<Page>(["admin", "negotiations"], "/admin/negotiations?limit=100");
  const settings = useApiQuery<Settings>(["admin", "negotiation-settings"], "/admin/negotiation-settings");
  const [status, setStatus] = useState("all");
  const [configOpen, setConfigOpen] = useState(false);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const form = draft || settings.data || { enabled: true, sessionMode: "fixed" as const, sessionMinutes: 10, maximumOffers: 3, quoteMinutes: 30, azureWordingEnabled: true, providerConfigured: false };
  const rows = useMemo(() => (query.data?.data || []).filter((row) => status === "all" || row.status === status), [query.data, status]);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((current) => ({ ...(current || form), [key]: value }));

  async function save() {
    if (reason.trim().length < 3) return toast.error("Add a clear audit reason");
    setSaving(true);
    try {
      await apiPatch("/admin/negotiation-settings", { enabled: form.enabled, sessionMode: form.sessionMode, sessionMinutes: Number(form.sessionMinutes), maximumOffers: Number(form.maximumOffers), quoteMinutes: Number(form.quoteMinutes), azureWordingEnabled: form.azureWordingEnabled, reason: reason.trim() });
      await settings.refetch(); setConfigOpen(false); setDraft(null); setReason(""); toast.success("Negotiation engine updated");
    } catch (error) { toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Could not update the engine"); }
    finally { setSaving(false); }
  }

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader title="AI Negotiation" description="Monitor customer offers while Hook’s deterministic pricing engine protects every commercial boundary." actions={canManage ? <Button variant="brand" onClick={() => setConfigOpen(true)}><Settings2 />Engine configuration</Button> : undefined} />
      <Card className="overflow-hidden border-0 bg-black text-white shadow-none"><CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center"><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-hook text-black"><Bot /></span><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-hook">Hook pricing authority</p><h2 className="mt-2 text-2xl font-semibold">AI speaks. Hook decides.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">Azure OpenAI phrases friendly English and Pidgin responses. It cannot alter an approved decision, price, floor, or quote.</p></div></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white/10 px-3 py-2"><ShieldCheck className="mr-1 inline size-4 text-hook" />Deterministic</span><span className="rounded-full bg-white/10 px-3 py-2"><Languages className="mr-1 inline size-4 text-hook" />English + Pidgin</span></div></CardContent></Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><KpiCard icon={Activity} tone="blue" label="Active sessions" value={query.data?.active ?? "—"} caption="Currently open" /><KpiCard icon={CheckCircle2} tone="green" label="Prices agreed" value={query.data?.accepted ?? "—"} caption={`${query.data?.conversionRate || 0}% conversion`} /><KpiCard icon={Sparkles} tone="amber" label="Legacy fallback" value={`${query.data?.fallbackRate || 0}%`} caption="Historical sessions only" /><KpiCard icon={Clock3} tone="zinc" label="Session window" value={settings.data?.sessionMode === "unlimited" ? "Unlimited" : `${settings.data?.sessionMinutes || 10} min`} caption={`${settings.data?.maximumOffers || 3} price offers`} /></div>
      <Card className="shadow-none"><CardContent className="p-0"><div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Negotiation activity</h2><p className="mt-1 text-xs text-muted-foreground">Safe summaries across active and completed sessions.</p></div><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All sessions</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="agreed">Agreed</SelectItem><SelectItem value="declined">Declined</SelectItem><SelectItem value="expired">Expired</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent></Select></div><QueryState loading={query.isLoading} error={query.error} empty={!rows.length} emptyIcon={Bot} emptyTitle="No negotiations found" emptyDescription="Customer negotiation sessions will appear here." onRetry={() => query.refetch()}><div className="divide-y">{rows.map((row) => { const customer = `${row.customer?.firstName || ""} ${row.customer?.lastName || ""}`.trim() || row.customer?.email || "Customer"; return <Link key={row.id} href={`/dashboard/ai-negotiation/${row.id}`} className="grid gap-3 p-4 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_110px_110px_28px] sm:items-center"><div className="min-w-0"><p className="truncate text-sm font-semibold">{row.product?.name || "Product negotiation"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{row.id} · {customer}</p></div><div><p className="text-sm font-medium capitalize">{row.language}</p><p className="mt-1 text-xs text-muted-foreground">{row.offerCount}/{row.maximumOffers} offers</p></div><div><StatusBadge status={row.status} /></div><div className="text-sm font-semibold tabular-nums">{money(row.agreedPriceMinor)}</div><span className="text-muted-foreground">›</span></Link>; })}</div></QueryState></CardContent></Card>
      <AdminWorkflowSheet open={configOpen} onOpenChange={(open) => { setConfigOpen(open); if (!open) { setDraft(null); setReason(""); } }} title="Negotiation engine" description="Set conversation limits and quote lifetime. Product floors remain controlled in the Commercial Catalog." footer={<><Button variant="outline" disabled={saving} onClick={() => setConfigOpen(false)}>Cancel</Button><Button variant="brand" disabled={saving || reason.trim().length < 3} onClick={() => void save()}>{saving ? "Saving..." : "Save configuration"}</Button></>}>
        <div className="space-y-6"><div className="flex items-center justify-between rounded-xl border p-4"><div><Label htmlFor="engine-enabled" className="font-semibold">Negotiation enabled</Label><p className="mt-1 text-xs text-muted-foreground">Allow customers to begin new sessions.</p></div><Switch id="engine-enabled" checked={form.enabled} onCheckedChange={(value) => set("enabled", value)} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>Session duration</Label><Select value={form.sessionMode} onValueChange={(value: "fixed" | "unlimited") => set("sessionMode", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed countdown</SelectItem><SelectItem value="unlimited">Unlimited</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label htmlFor="session-minutes">Minutes</Label><Input id="session-minutes" type="number" min={1} max={1440} disabled={form.sessionMode === "unlimited"} value={form.sessionMinutes} onChange={(e) => set("sessionMinutes", Number(e.target.value))} /></div><div className="space-y-1.5"><Label htmlFor="offer-limit">Price offers</Label><Input id="offer-limit" type="number" min={1} max={10} value={form.maximumOffers} onChange={(e) => set("maximumOffers", Number(e.target.value))} /></div><div className="space-y-1.5"><Label htmlFor="quote-minutes">Accepted price lifetime</Label><Input id="quote-minutes" type="number" min={1} max={1440} value={form.quoteMinutes} onChange={(e) => set("quoteMinutes", Number(e.target.value))} /></div></div><div className="flex items-center justify-between rounded-xl border p-4"><div><Label htmlFor="azure-wording" className="font-semibold">Azure negotiation replies</Label><p className="mt-1 text-xs text-muted-foreground">{form.providerConfigured ? "Azure-only replies. Disabling this pauses new negotiation replies." : "Provider is not configured; negotiation is unavailable."}</p></div><Switch id="azure-wording" checked={form.azureWordingEnabled} onCheckedChange={(value) => set("azureWordingEnabled", value)} /></div><div className="rounded-xl bg-[#FFF8D8] p-4 text-sm leading-6 text-[#5D4900]">New sessions use <strong>{form.sessionMode === "unlimited" ? "no countdown" : `${form.sessionMinutes} minutes`}</strong>, allow <strong>{form.maximumOffers} price offers</strong>, and keep an accepted price for <strong>{form.quoteMinutes} minutes</strong>.</div><div className="space-y-1.5"><Label htmlFor="config-reason">Audit reason</Label><Input id="config-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this configuration changing?" /></div></div>
      </AdminWorkflowSheet>
    </div>
  );
}
