"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminWorkflowSheet } from "@/components/shared/AdminWorkflowSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HookLoader } from "@/components/shared/HookLoader";
import { useApiQuery } from "@/lib/query";
import { apiPost } from "@/lib/api";

interface MarketOption {
  id?: string;
  publicId?: string;
  name?: string;
  stateName?: string;
}

const CONTACT_CHANNELS = [
  { label: "Phone call", value: "phone" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Email", value: "email" },
];

const PAYMENT_METHODS = [
  { label: "Cash", value: "cash" },
  { label: "Bank transfer", value: "bank_transfer" },
  { label: "Other", value: "other" },
];

const EMPTY = {
  marketId: "",
  businessName: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  preferredContactChannel: "phone",
  paymentMethod: "cash",
  bankName: "",
  accountName: "",
  accountNumber: "",
  notes: "",
};

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs font-semibold">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Admin-side vendor onboarding.
 *
 * Creating a vendor also issues their first invitation, so the email field is
 * called out as the thing that decides whether we can reach them
 * automatically — without it, staff have to pass the link on themselves.
 */
export function VendorOnboardingSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  // Only loaded while the sheet is open — the markets list is irrelevant until
  // staff actually start onboarding someone.
  const markets = useApiQuery<{ data?: MarketOption[] } | MarketOption[]>(
    ["admin", "markets", "vendor-onboarding"],
    "/admin/markets?limit=200",
    open,
  );

  const marketOptions = useMemo(() => {
    const raw = markets.data as any;
    const rows: MarketOption[] = Array.isArray(raw) ? raw : raw?.data || [];
    return rows.filter((market) => market.publicId || market.id);
  }, [markets.data]);

  const bankRequired = form.paymentMethod === "bank_transfer";
  const canSubmit =
    Boolean(form.marketId) &&
    form.businessName.trim().length >= 2 &&
    form.contactName.trim().length >= 2 &&
    form.phone.trim().length >= 7 &&
    (!bankRequired || (form.bankName.trim() && form.accountName.trim() && /^\d{6,20}$/.test(form.accountNumber.trim())));

  function update(patch: Partial<typeof EMPTY>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function close() {
    setForm({ ...EMPTY });
    onOpenChange(false);
  }

  async function submit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      // paymentProfile is required by the API even for cash vendors, and the
      // bank fields are only sent when they were actually asked for.
      const paymentProfile: Record<string, string> = { method: form.paymentMethod };
      if (bankRequired) {
        paymentProfile.bankName = form.bankName.trim();
        paymentProfile.accountName = form.accountName.trim();
        paymentProfile.accountNumber = form.accountNumber.trim();
      }

      const result = await apiPost<{ vendor?: { businessName?: string }; invitation?: { delivery?: { delivered?: boolean } } }>(
        `/admin/markets/${form.marketId}/vendors`,
        {
          businessName: form.businessName.trim(),
          contactName: form.contactName.trim(),
          phone: form.phone.trim(),
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
          ...(form.address.trim() ? { address: form.address.trim() } : {}),
          preferredContactChannel: form.preferredContactChannel,
          paymentProfile,
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        },
      );

      // Say what actually happened: with no email on file the invitation
      // exists but was never sent anywhere.
      toast.success(
        result?.invitation?.delivery?.delivered
          ? `${result?.vendor?.businessName || "Vendor"} onboarded. Invitation emailed.`
          : `${result?.vendor?.businessName || "Vendor"} onboarded. Share the invitation link from their profile.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["admin", "market-vendors"] });
      close();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message.replace(/^\d+:\s*/, "") : "Could not onboard this vendor.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminWorkflowSheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="Onboard a vendor"
      description="Add a supplier to a market and send them an invitation to confirm their details."
      className="sm:w-[min(70vw,76rem)]"
      footer={
        <>
          <Button type="button" variant="outline" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit || saving}>
            {saving ? <HookLoader size="button" variant="dark" /> : "Onboard vendor"}
          </Button>
        </>
      }
    >
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section className="min-w-0 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Business</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Who the supplier is and which market they trade in.
            </p>
          </div>

          <Field label="Market" required hint="The vendor is tracked against this market.">
            <Select value={form.marketId} onValueChange={(value) => update({ marketId: value })}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder={markets.isLoading ? "Loading markets..." : "Select a market"} />
              </SelectTrigger>
              <SelectContent>
                {marketOptions.map((market) => {
                  const value = String(market.publicId || market.id);
                  return (
                    <SelectItem key={value} value={value}>
                      {market.name}
                      {market.stateName ? ` · ${market.stateName}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Business name" required>
            <Input
              value={form.businessName}
              onChange={(event) => update({ businessName: event.target.value })}
              placeholder="Balogun Style House"
            />
          </Field>

          <Field label="Contact name" required>
            <Input
              value={form.contactName}
              onChange={(event) => update({ contactName: event.target.value })}
              placeholder="Amina Yusuf"
            />
          </Field>

          <Field label="Address">
            <Textarea
              value={form.address}
              onChange={(event) => update({ address: event.target.value })}
              placeholder="Shop 14, Balogun Market, Lagos Island"
              rows={2}
            />
          </Field>
        </section>

        <section className="min-w-0 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Contact &amp; payment</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              How Hook reaches this vendor and how they get paid.
            </p>
          </div>

          <Field label="Phone" required>
            <Input
              value={form.phone}
              onChange={(event) => update({ phone: event.target.value })}
              placeholder="08030000100"
              inputMode="tel"
            />
          </Field>

          <Field
            label="Email"
            hint="Without an email the invitation is created but must be shared manually."
          >
            <Input
              type="email"
              value={form.email}
              onChange={(event) => update({ email: event.target.value })}
              placeholder="supplier@example.com"
            />
          </Field>

          <Field label="Preferred contact channel">
            <Select
              value={form.preferredContactChannel}
              onValueChange={(value) => update({ preferredContactChannel: value })}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_CHANNELS.map((channel) => (
                  <SelectItem key={channel.value} value={channel.value}>
                    {channel.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Payment method">
            <Select value={form.paymentMethod} onValueChange={(value) => update({ paymentMethod: value })}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Bank details are only asked for when they apply — a cash vendor
              should not be shown three fields they must leave blank. */}
          {bankRequired ? (
            <div className="space-y-4 rounded-lg border border-border bg-muted/40 p-3">
              <Field label="Bank name" required>
                <Input
                  value={form.bankName}
                  onChange={(event) => update({ bankName: event.target.value })}
                  placeholder="Guaranty Trust Bank"
                />
              </Field>
              <Field label="Account name" required>
                <Input
                  value={form.accountName}
                  onChange={(event) => update({ accountName: event.target.value })}
                  placeholder="Balogun Style House"
                />
              </Field>
              <Field label="Account number" required hint="6–20 digits.">
                <Input
                  value={form.accountNumber}
                  onChange={(event) => update({ accountNumber: event.target.value.replace(/\D/g, "") })}
                  placeholder="0123456789"
                  inputMode="numeric"
                />
              </Field>
            </div>
          ) : null}

          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(event) => update({ notes: event.target.value })}
              placeholder="Anything the sourcing team should know."
              rows={2}
            />
          </Field>
        </section>
      </div>
    </AdminWorkflowSheet>
  );
}
