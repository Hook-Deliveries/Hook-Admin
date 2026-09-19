"use client";

import { useState } from "react";
import Link from "next/link";
import { AtSign, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
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
import { AuthCard } from "@/components/auth/AuthCard";
import { HookLoader } from "@/components/shared/HookLoader";
import { useAccountLogin } from "@/lib/query";
import type { AuthSession } from "@/lib/api";

interface LoginFormProps {
  onSuccess: (session: AuthSession) => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const login = useAccountLogin();
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [values, setValues] = useState({
    email: "",
    password: "",
  });

  function validate() {
    const nextErrors: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      nextErrors.email = "Please enter a valid email address";
    }
    if (!values.password) {
      nextErrors.password = "Password is required";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    try {
      const session = await login.mutateAsync(values);
      onSuccess(session);
    } catch {
      // Mutation errors are displayed globally through Sonner.
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      description="One secure sign-in for staff, Market Associates, and Hook Partners."
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={errors.email ? true : undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="email"
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

          <Field data-invalid={errors.password ? true : undefined}>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                href={`/forgot-password?email=${encodeURIComponent(values.email)}`}
                className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <InputGroup>
              <InputGroupInput
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={errors.password ? true : undefined}
                value={values.password}
                onChange={(event) =>
                  setValues((current) => ({ ...current, password: event.target.value }))
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
            <Button type="submit" variant="brand" disabled={login.isPending}>
              {login.isPending ? (
                <HookLoader size="button" label="Signing in..." />
              ) : (
                "Sign in"
              )}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
