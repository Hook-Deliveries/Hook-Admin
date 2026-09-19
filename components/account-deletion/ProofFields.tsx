"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accountDeletionApi, type Proof } from "@/lib/public-account-deletion-api";

export type ProofState = {
  email: string;
  method: "password" | "code";
  password: string;
  code: string;
};

export const emptyProof: ProofState = { email: "", method: "password", password: "", code: "" };

export function proofReady(value: ProofState) {
  const emailOk = /^\S+@\S+\.\S+$/.test(value.email.trim());
  return emailOk && (value.method === "password" ? value.password.length > 0 : /^\d{6}$/.test(value.code));
}

export function toProof(value: ProofState): Proof {
  const email = value.email.trim().toLowerCase();
  return value.method === "password" ? { email, password: value.password } : { email, code: value.code };
}

/**
 * Email plus either a password or, for accounts created with Google or Apple
 * (which have no password), a 6-digit code sent to that email.
 */
export function ProofFields({
  value,
  onChange,
  disabled,
  idPrefix,
}: {
  value: ProofState;
  onChange: (next: ProofState) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const set = (patch: Partial<ProofState>) => onChange({ ...value, ...patch });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    setSending(true);
    setNote(null);
    try {
      await accountDeletionApi.sendCode(value.email.trim().toLowerCase());
      setSentTo(value.email.trim().toLowerCase());
      setCooldown(60);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "We couldn't send the code. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const emailValid = /^\S+@\S+\.\S+$/.test(value.email.trim());

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-email`}>Email address</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={value.email}
          disabled={disabled}
          onChange={(event) => set({ email: event.target.value })}
        />
      </div>

      {value.method === "password" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-password`}>Password</Label>
          <Input
            id={`${idPrefix}-password`}
            type="password"
            autoComplete="current-password"
            placeholder="Your Hook password"
            value={value.password}
            disabled={disabled}
            onChange={(event) => set({ password: event.target.value })}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-code`}>6-digit code</Label>
          <div className="flex gap-2">
            <Input
              id={`${idPrefix}-code`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={value.code}
              disabled={disabled}
              onChange={(event) => set({ code: event.target.value.replace(/\D/g, "").slice(0, 6) })}
            />
            <Button type="button" variant="outline" disabled={disabled || sending || !emailValid || cooldown > 0} onClick={sendCode}>
              {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : cooldown > 0 ? `Resend in ${cooldown}s` : sentTo ? "Resend code" : "Send code"}
            </Button>
          </div>
          {sentTo ? (
            <p className="text-xs text-muted-foreground">
              If a Google or Apple account exists for {sentTo}, a code is on its way. It expires in 10 minutes.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">We will email a code to this address.</p>
          )}
          {note ? <p className="text-xs text-destructive">{note}</p> : null}
        </div>
      )}

      <button
        type="button"
        className="text-xs font-medium text-brand-gold underline-offset-4 hover:underline disabled:opacity-50"
        disabled={disabled}
        onClick={() => set({ method: value.method === "password" ? "code" : "password", password: "", code: "" })}
      >
        {value.method === "password" ? "I signed in with Google or Apple" : "I have a Hook password"}
      </button>
    </div>
  );
}
