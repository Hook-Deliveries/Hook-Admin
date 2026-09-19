"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AtSign, Eye, EyeOff, LockKeyhole } from "lucide-react";
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
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { AuthCard } from "@/components/auth/AuthCard";
import { HookLoader } from "@/components/shared/HookLoader";
import { useResetPassword } from "@/lib/query";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reset = useResetPassword();
  const [showPassword, setShowPassword] = useState(false);
  const [values, setValues] = useState({
    email: searchParams.get("email") || "",
    code: "",
    password: "",
  });
  const [errors, setErrors] = useState<{
    email?: string;
    code?: string;
    password?: string;
  }>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      nextErrors.email = "Please enter a valid Hook account email";
    }
    if (values.code.length < 4) {
      nextErrors.code = "Enter the OTP sent to your email";
    }
    if (values.password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      return;
    }
    try {
      await reset.mutateAsync(values);
      router.push("/auth/login");
    } catch {
      // Mutation errors are displayed globally through Sonner.
    }
  }

  return (
    <AuthCard
      title="Enter your OTP"
      description="Use the OTP from your email to create a new admin password."
      backHref="/auth/login"
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={errors.email ? true : undefined}>
            <FieldLabel htmlFor="reset-email">Account email</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="reset-email"
                type="email"
                autoComplete="email"
                placeholder="you@hook.com"
                aria-invalid={errors.email ? true : undefined}
                value={values.email}
                onChange={(event) =>
                  setValues((current) => ({ ...current, email: event.target.value }))
                }
              />
              <InputGroupAddon align="inline-start">
                <AtSign />
              </InputGroupAddon>
            </InputGroup>
            {errors.email && <FieldError>{errors.email}</FieldError>}
          </Field>

          <Field data-invalid={errors.code ? true : undefined}>
            <FieldLabel htmlFor="otp">OTP code</FieldLabel>
            <InputOTP
              id="otp"
              maxLength={6}
              value={values.code}
              onChange={(code) => setValues((current) => ({ ...current, code }))}
              aria-invalid={errors.code ? true : undefined}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            {errors.code ? (
              <FieldError>{errors.code}</FieldError>
            ) : (
              <FieldDescription>
                Enter the 6-digit code we emailed you.
              </FieldDescription>
            )}
          </Field>

          <Field data-invalid={errors.password ? true : undefined}>
            <FieldLabel htmlFor="new-password">New password</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                aria-invalid={errors.password ? true : undefined}
                value={values.password}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
              />
              <InputGroupAddon align="inline-start">
                <LockKeyhole />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {errors.password && <FieldError>{errors.password}</FieldError>}
          </Field>

          <Field>
            <Button type="submit" variant="brand" disabled={reset.isPending}>
              {reset.isPending ? (
                <HookLoader size="button" label="Resetting..." />
              ) : (
                "Reset password"
              )}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
