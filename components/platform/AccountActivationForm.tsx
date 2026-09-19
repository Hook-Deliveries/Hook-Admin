"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { PublicShell } from "@/components/public/PublicShell";
import { HookLoader } from "@/components/shared/HookLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api";

type AccountType = "staff" | "marketassociate" | "partner" | "customer";

const destinations: Record<AccountType, string> = {
  staff: "/auth/login",
  marketassociate: "/auth/login",
  partner: "/auth/login",
  customer: "/auth/login",
};

export function AccountActivationForm({ accountType }: { accountType: AccountType }) {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (!token) return toast.error("This invitation link is incomplete");
    if (password.length < 9) return toast.error("Use at least 9 characters");
    if (password !== confirmation) return toast.error("Passwords do not match");
    setPending(true);
    try {
      const result = await apiPost<{ activated: boolean; accountType: AccountType }>(
        "/auth/invitations/accept",
        { token, password },
      );
      if (result.accountType !== accountType) throw new Error("This invitation belongs to another Hook portal");
      setComplete(true);
      toast.success("Account activated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Unable to activate account");
    } finally {
      setPending(false);
    }
  }

  const heading = complete ? "Account ready" : "Set your password";
  const description = complete
    ? accountType === "customer"
      ? "Your Hook account is ready. Open the Hook app and sign in to start shopping."
      : `Your Hook ${accountType} account is ready to use.`
    : accountType === "customer"
      ? "Create a password to finish setting up your Hook account."
      : `Create a secure password for your Hook ${accountType} account.`;
  return (
    <PublicShell eyebrow="Welcome to Hook" title={heading} description={description} width="md" centered>
      <Card className="rounded-2xl py-6 shadow-sm">
        <CardHeader className="items-center px-6 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-brand-gold/20">
            {complete ? <CheckCircle2 className="size-6" /> : <KeyRound className="size-6" />}
          </div>
          <CardTitle className="mt-2 text-lg">{heading}</CardTitle>
        </CardHeader>
        <CardContent className="px-6">
          {complete ? (
            accountType === "customer" ? (
              <p className="text-center text-sm text-muted-foreground">
                You can close this page and continue in the Hook app.
              </p>
            ) : (
              <Button variant="brand" size="lg" className="w-full" onClick={() => router.replace(destinations[accountType])}>
                Continue to sign in
              </Button>
            )
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" autoComplete="new-password" minLength={9} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmation">Confirm password</Label>
                <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={9} required />
              </div>
              <Button variant="brand" size="lg" disabled={pending || !token} className="w-full">
                {pending ? <HookLoader size="button" variant="dark" /> : "Activate account"}
              </Button>
              {!token ? <p className="text-center text-sm text-destructive">Use the complete invitation link from your email.</p> : null}
            </form>
          )}
        </CardContent>
      </Card>
    </PublicShell>
  );
}
