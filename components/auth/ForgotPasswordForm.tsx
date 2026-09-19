"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { AuthCard } from "@/components/auth/AuthCard";
import { HookLoader } from "@/components/shared/HookLoader";
import { useForgotPassword } from "@/lib/query";

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const forgot = useForgotPassword();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [emailError, setEmailError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError("");
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setEmailError("Please enter a valid Hook account email");
      return;
    }
    try {
      await forgot.mutateAsync({ email });
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch {
      // Mutation errors are displayed globally through Sonner.
    }
  }

  return (
    <AuthCard
      title="Reset admin password"
      description="Enter your Hook account email. If it exists, we will send an OTP to continue."
      backHref="/auth/login"
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={emailError ? true : undefined}>
            <FieldLabel htmlFor="forgot-email">Account email</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="you@hook.com"
                aria-invalid={emailError ? true : undefined}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <InputGroupAddon align="inline-start">
                <AtSign />
              </InputGroupAddon>
            </InputGroup>
            {emailError ? (
              <FieldError>{emailError}</FieldError>
            ) : (
              <FieldDescription>
                The code expires shortly after it is sent.
              </FieldDescription>
            )}
          </Field>

          <Field>
            <Button type="submit" variant="brand" disabled={forgot.isPending}>
              {forgot.isPending ? (
                <HookLoader size="button" label="Sending OTP..." />
              ) : (
                "Send OTP"
              )}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
