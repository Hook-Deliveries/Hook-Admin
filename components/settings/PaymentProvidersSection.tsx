"use client";

import { useEffect, useState } from "react";
import { CreditCard, Save, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { HookLoader } from "@/components/shared/HookLoader";
import { QueryState } from "@/components/shared/QueryState";
import { PaymentProviderMark } from "@/components/payments/PaymentProviderMark";
import { apiPatch } from "@/lib/api";
import { useApiQuery } from "@/lib/query";

type Provider = { provider: "paystack"; enabled: boolean; displayOrder: number; isDefault: boolean; configured: boolean; mode: "test" | "live"; reason?: string };

export function PaymentProvidersSection() {
  const query = useApiQuery<{ providers: Provider[] }>(["commerce", "payment-providers"], "/admin/commerce/payment-providers");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  // Keep the editable provider draft aligned with the server response.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (query.data?.providers) setProviders(query.data.providers); }, [query.data]);

  function update(name: Provider["provider"], patch: Partial<Provider>) {
    setProviders((current) => current.map((provider) => provider.provider === name ? { ...provider, ...patch } : provider));
  }

  function setDefault(name: Provider["provider"]) {
    setProviders((current) => current.map((provider) => ({ ...provider, isDefault: provider.provider === name })));
  }

  async function save() {
    if (reason.trim().length < 5) return toast.error("Add a short audit reason");
    setSaving(true);
    try {
      await apiPatch("/admin/commerce/payment-providers", {
        providers: providers.map(({ provider, enabled, displayOrder, isDefault }) => ({ provider, enabled, displayOrder: Number(displayOrder), isDefault })),
        reason: reason.trim(),
      });
      toast.success("Payment providers updated");
      setReason("");
      await query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Could not update payment providers");
    } finally { setSaving(false); }
  }

  if (query.isLoading) return <div className="grid min-h-60 place-items-center"><HookLoader label="Loading payment providers" /></div>;
  if (query.isError) return <QueryState error={query.error} errorTitle="Payment providers could not load" onRetry={() => void query.refetch()} />;

  return <Card className="border-zinc-200 shadow-sm">
    <CardHeader className="border-b">
      <CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="size-5 text-brand-gold" /> Payment providers</CardTitle>
      <p className="text-sm leading-6 text-muted-foreground">Control the secure hosted payment options customers and shared-link payers can choose.</p>
    </CardHeader>
    <CardContent className="space-y-5 p-5 sm:p-6">
      <div className="space-y-3">
        {[...providers].sort((a, b) => a.displayOrder - b.displayOrder).map((provider) => (
          <div key={provider.provider} className="grid gap-4 rounded-lg border border-zinc-200 p-4 sm:grid-cols-[minmax(0,1fr)_110px_120px] sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <PaymentProviderMark />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">Paystack</p>
                  {provider.configured && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${provider.mode === "live" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{provider.mode}</span>}
                </div>
                <p className="text-xs text-zinc-500">{provider.configured ? "Ready to accept payments" : provider.reason || "Missing configuration"}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end"><Label htmlFor={`${provider.provider}-enabled`}>Enabled</Label><Switch id={`${provider.provider}-enabled`} checked={provider.enabled} disabled={!provider.configured} onCheckedChange={(enabled) => update(provider.provider, { enabled, isDefault: enabled ? provider.isDefault : false })} /></div>
            <Button type="button" size="sm" variant={provider.isDefault ? "default" : "outline"} disabled={!provider.enabled} onClick={() => setDefault(provider.provider)}>{provider.isDefault ? <><ShieldCheck /> Default</> : "Make default"}</Button>
          </div>
        ))}
      </div>
      {providers.some((provider) => !provider.configured) && <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><TriangleAlert className="mt-0.5 size-4 shrink-0" /> Providers with missing backend credentials cannot be enabled. Credentials are never displayed here.</div>}
      <div className="grid gap-4 rounded-lg border bg-zinc-50 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><div className="space-y-2"><Label htmlFor="provider-reason">Audit reason</Label><Input id="provider-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why are payment options changing?" /></div><Button variant="brand" disabled={saving} onClick={() => void save()}>{saving ? <HookLoader size="button" /> : <><Save /> Save providers</>}</Button></div>
    </CardContent>
  </Card>;
}
