"use client";

import { friendlyVariantValue } from "@/lib/color-name";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Clock3, ExternalLink, LoaderCircle, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public/PublicShell";
import { PaymentProviderMark } from "@/components/payments/PaymentProviderMark";
import { publicPaymentRequest } from "@/lib/public-payment-api";

type PaymentDetail = {
  id: string;
  status: string;
  expiresAt: string;
  purpose: string;
  paidAt?: string;
  providers: Array<{ provider: "paystack"; isDefault: boolean; mode: "test" | "live" }>;
  order: {
    id: string;
    reference: string;
    subtotalMinor: number;
    vatRate: number;
    vatMinor: number;
    deliveryFeeMinor: number;
    couponCode?: string;
    couponDiscountMinor?: number;
    creditsAppliedMinor?: number;
    totalMinor: number;
    currency: string;
    items: Array<{ id: string; title: string; imageUrl?: string; quantity: number; selectedVariants?: Record<string, string> }>;
  };
};

type StatusAttempt = { provider: "paystack"; status: string } | undefined;

function useCountdown(expiresAt: string | undefined) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();
    const tick = () => {
      const diffMs = target - Date.now();
      if (diffMs <= 0) {
        setLabel("Expired");
        return;
      }
      const totalMinutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      setLabel(hours > 0 ? `Expires in ${hours}h ${minutes}m` : `Expires in ${minutes}m`);
    };
    tick();
    const timer = window.setInterval(tick, 30000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  return label;
}

function money(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value / 100);
}

function providerName(_provider: "paystack") {
  return "Paystack";
}

function idempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return `web-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  return `web-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function PublicPaymentCheckout({ token, processing = false }: { token: string; processing?: boolean }) {
  const [detail, setDetail] = useState<PaymentDetail>();
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<"paystack">();
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState<StatusAttempt>();
  const appReturn = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("appReturn") === "1";

  const load = useCallback(async () => {
    try {
      const data = await publicPaymentRequest<PaymentDetail>(`/public/payment-links/${encodeURIComponent(token)}`);
      setDetail(data);
      setSelected((current) => current || data.providers.find((provider) => provider.isDefault)?.provider || data.providers[0]?.provider);
      setError("");
      return data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This payment link is unavailable");
    }
  }, [token]);

  // Load the public checkout when the token changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!processing || detail?.status === "paid") return;
    const timer = window.setInterval(async () => {
      try {
        const status = await publicPaymentRequest<{ status: string; attempt?: StatusAttempt }>(`/public/payment-links/${encodeURIComponent(token)}/status`);
        setAttempt(status.attempt);
        if (status.status === "paid") await load();
      } catch { /* Keep polling while provider verification completes. */ }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [detail?.status, load, processing, token]);

  const paid = detail?.status === "paid";
  const attemptFailed = attempt?.status === "failed" || attempt?.status === "expired" || attempt?.status === "cancelled";
  const expiry = useMemo(() => detail ? new Date(detail.expiresAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "", [detail]);
  const countdown = useCountdown(detail?.expiresAt);

  async function pay() {
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      const attempt = await publicPaymentRequest<{ authorizationUrl: string }>(`/public/payment-links/${encodeURIComponent(token)}/initialize`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey() },
        body: JSON.stringify({ provider: selected, appReturn }),
      });
      window.location.assign(attempt.authorizationUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment could not start");
      setSubmitting(false);
    }
  }

  if (!detail && !error) return <PaymentShell centered><div className="flex min-h-80 items-center justify-center"><LoaderCircle className="animate-spin text-[#e6ad00]" size={30} /></div></PaymentShell>;
  if (!detail) return <PaymentShell centered width="lg"><StatePanel icon={LockKeyhole} title="Payment link unavailable" description={error} action={<Button onClick={() => void load()}><RotateCcw /> Try again</Button>} /></PaymentShell>;
  if (paid) return (
    <PaymentShell centered width="lg" title="Payment received">
      <StatePanel icon={Check} tone="success" title="Payment successful" description={`Payment for ${detail.order.reference} has been verified. Hook will now continue processing the Order.`} action={appReturn ? <Button onClick={() => window.location.assign(`hook://payments/return?status=success&orderId=${encodeURIComponent(detail.order.id)}`)}>Return to Hook <ExternalLink /></Button> : undefined} />
    </PaymentShell>
  );

  return (
    <PaymentShell eyebrow={detail.purpose} title="Review and pay" description={`Order ${detail.order.reference}`}>
      <div className="min-w-0 space-y-5">
        <section className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            {detail.order.items.map((item) => (
              <div key={item.id} className="flex min-w-0 items-center gap-3 border-b border-zinc-100 p-3 last:border-b-0 sm:p-4">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-zinc-100">
                  {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs text-zinc-400">Hook</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-zinc-900">{item.title}</p>
                  <p className="mt-1 text-sm text-zinc-500">Quantity {item.quantity}</p>
                  {item.selectedVariants && <p className="mt-1 truncate text-xs text-zinc-400">{Object.entries(item.selectedVariants).filter(([, value]) => Boolean(value)).map(([key, value]) => friendlyVariantValue(key, value)).join(" · ")}</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-[#f0d36c] bg-[#fff9df] p-3.5 text-sm text-[#705700]"><Clock3 size={17} /> Link available until {expiry}{countdown ? ` · ${countdown}` : ""}</div>
        </section>

        <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-6">
          {processing && <div className="mb-4 flex items-center gap-2 rounded-md bg-zinc-50 p-3 text-sm text-zinc-600"><LoaderCircle className="animate-spin" size={16} /> Waiting for verified payment confirmation</div>}
          {attemptFailed && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Your last attempt didn&apos;t go through. Choose a payment method and try again.</div>}
          {!detail.providers.length ? (
            <StatePanel icon={LockKeyhole} title="Payments unavailable" description="No payment provider is currently configured for this link. Please contact Hook support or try again shortly." />
          ) : (
            <>
              <h2 className="font-bold text-zinc-950">Choose how to pay</h2>
              <div className="mt-3 space-y-2">
                {detail.providers.map((provider) => (
                  <button key={provider.provider} type="button" onClick={() => setSelected(provider.provider)} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${selected === provider.provider ? "border-black bg-zinc-950 text-white" : "border-zinc-200 hover:border-zinc-400"}`}>
                    <PaymentProviderMark />
                    <span className="min-w-0 flex-1"><span className="block font-semibold">{providerName(provider.provider)}</span><span className={`block text-xs ${selected === provider.provider ? "text-zinc-300" : "text-zinc-500"}`}>Secure hosted checkout</span></span>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="my-5 space-y-2 border-y border-zinc-100 py-4 text-sm">
            <div className="flex justify-between text-zinc-500"><span>Products</span><span>{money(detail.order.subtotalMinor)}</span></div>
            <div className="flex justify-between text-zinc-500"><span>VAT{detail.order.vatRate ? ` (${detail.order.vatRate * 100}%)` : ""}</span><span>{money(detail.order.vatMinor)}</span></div>
            <div className="flex justify-between text-zinc-500"><span>Delivery</span><span>{money(detail.order.deliveryFeeMinor)}</span></div>
            {Number(detail.order.couponDiscountMinor || 0) > 0 ? (
              <div className="flex justify-between text-emerald-600"><span>{detail.order.couponCode ? `Coupon (${detail.order.couponCode})` : "Coupon"}</span><span>−{money(Number(detail.order.couponDiscountMinor))}</span></div>
            ) : null}
            {Number(detail.order.creditsAppliedMinor || 0) > 0 ? (
              <div className="flex justify-between text-emerald-600"><span>Hook Coin</span><span>−{money(Number(detail.order.creditsAppliedMinor))}</span></div>
            ) : null}
            <div className="flex justify-between pt-2 text-lg font-extrabold text-zinc-950"><span>Total</span><span>{money(detail.order.totalMinor)}</span></div>
          </div>
          {error && <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Button variant="brand" size="lg" className="h-12 w-full font-bold" disabled={!selected || !detail.providers.length || submitting} onClick={pay}>
            {submitting ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} Continue securely
          </Button>
          <p className="mt-3 text-center text-xs leading-5 text-zinc-400">Hook never marks a payment complete from this page alone. Your provider confirms it securely.</p>
        </section>
      </div>
    </PaymentShell>
  );
}

function PaymentShell({
  children,
  eyebrow = "Secure payment",
  title = "Complete your payment",
  description = "Pay for your Hook order through a secure hosted checkout.",
  centered = false,
  width = "3xl",
}: {
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  description?: string;
  centered?: boolean;
  width?: "lg" | "3xl";
}) {
  return (
    <PublicShell
      eyebrow={eyebrow}
      title={title}
      description={description}
      width={width}
      centered={centered}
      aside={
        <ul className="space-y-4 text-sm text-zinc-400">
          {[
            { icon: ShieldCheck, title: "Secure hosted checkout", body: "You pay on your provider's own page." },
            { icon: LockKeyhole, title: "Your card stays private", body: "Hook never sees or stores card details." },
            { icon: Check, title: "Confirmed by your provider", body: "An order is only marked paid after your provider verifies it." },
          ].map(({ icon: Icon, title: heading, body }) => (
            <li key={heading} className="flex gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand-gold/15 text-brand-gold"><Icon className="size-4" /></span>
              <span><span className="block font-semibold text-white">{heading}</span>{body}</span>
            </li>
          ))}
        </ul>
      }
    >
      {children}
    </PublicShell>
  );
}

function StatePanel({ icon: Icon, title, description, action, tone = "neutral" }: { icon: typeof Check; title: string; description: string; action?: React.ReactNode; tone?: "neutral" | "success" }) {
  return <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5"><div className={`flex size-14 items-center justify-center rounded-full ${tone === "success" ? "bg-emerald-100 text-emerald-700" : "bg-[#fff3bf] text-[#9a7400]"}`}><Icon size={26} /></div><h2 className="mt-5 text-2xl font-extrabold">{title}</h2><p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">{description}</p>{action && <div className="mt-6">{action}</div>}</div>;
}
